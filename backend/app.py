from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
import mysql.connector
import bcrypt
import jwt
import datetime
import os
from functools import wraps
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'chatapp_secret_key_change_in_production'
CORS(app, origins="*")
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# ─── DB CONFIG ───────────────────────────────────────────────────────────────
# Move credentials to environment variables in production — never hardcode in real projects.
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASS', 'root'),
    'database': os.getenv('DB_NAME', 'ChatAppDB')
}

def get_db():
    try:
        return mysql.connector.connect(**DB_CONFIG)
    except mysql.connector.Error as exc:
        app.logger.error('Database connection failed: %s', exc)
        raise

# ─── JWT HELPER ──────────────────────────────────────────────────────────────
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'Token missing'}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            request.user_id = data['user_id']
        except:
            return jsonify({'error': 'Invalid token'}), 401
        return f(*args, **kwargs)
    return decorated

# ─── AUTH ROUTES ─────────────────────────────────────────────────────────────
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username', '').strip()
    email    = data.get('email', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    db = get_db()
    cur = db.cursor()
    try:
        cur.execute(
            "INSERT INTO Users (username, email, password_hash) VALUES (%s, %s, %s)",
            (username, email, hashed)
        )
        db.commit()
        user_id = cur.lastrowid
        token = jwt.encode(
            {'user_id': user_id, 'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)},
            app.config['SECRET_KEY']
        )
        return jsonify({'token': token, 'user_id': user_id, 'username': username})
    except mysql.connector.IntegrityError:
        return jsonify({'error': 'Username or email already exists'}), 409
    finally:
        cur.close(); db.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '')

    db = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute("SELECT * FROM Users WHERE username = %s", (username,))
    user = cur.fetchone()
    cur.close(); db.close()

    if not user or not bcrypt.checkpw(password.encode(), user['password_hash'].encode()):
        return jsonify({'error': 'Invalid credentials'}), 401

    token = jwt.encode(
        {'user_id': user['user_id'], 'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)},
        app.config['SECRET_KEY']
    )
    return jsonify({'token': token, 'user_id': user['user_id'], 'username': user['username']})

# ─── USER ROUTES ─────────────────────────────────────────────────────────────
@app.route('/api/users/search', methods=['GET'])
@token_required
def search_users():
    q = request.args.get('q', '')
    db = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute(
        "SELECT user_id, username, status FROM Users WHERE username LIKE %s AND user_id != %s LIMIT 10",
        (f'%{q}%', request.user_id)
    )
    users = cur.fetchall()
    cur.close(); db.close()
    return jsonify(users)

@app.route('/api/users/status', methods=['PUT'])
@token_required
def update_status():
    status = request.json.get('status', 'online')
    db = get_db()
    cur = db.cursor()
    cur.execute("UPDATE Users SET status = %s WHERE user_id = %s", (status, request.user_id))
    db.commit()
    cur.close(); db.close()
    return jsonify({'ok': True})

# ─── CHAT ROUTES ─────────────────────────────────────────────────────────────
@app.route('/api/chats', methods=['GET'])
@token_required
def get_chats():
    db = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute("""
        SELECT c.chat_id, c.chat_type, c.chat_name,
               (SELECT message_text FROM Messages m
                WHERE m.chat_id = c.chat_id ORDER BY m.sent_at DESC LIMIT 1) AS last_message,
               (SELECT sent_at FROM Messages m
                WHERE m.chat_id = c.chat_id ORDER BY m.sent_at DESC LIMIT 1) AS last_time,
               (SELECT COUNT(*) FROM Messages m
                JOIN MessageStatus ms ON m.message_id = ms.message_id
                WHERE m.chat_id = c.chat_id AND ms.user_id = %s AND ms.status != 'seen') AS unread
        FROM Chats c
        JOIN ChatMembers cm ON c.chat_id = cm.chat_id
        WHERE cm.user_id = %s
        ORDER BY last_time DESC
    """, (request.user_id, request.user_id))
    chats = cur.fetchall()

    # For private chats, get the other user's name
    for chat in chats:
        if chat['chat_type'] == 'private':
            cur.execute("""
                SELECT u.username, u.status FROM Users u
                JOIN ChatMembers cm ON u.user_id = cm.user_id
                WHERE cm.chat_id = %s AND u.user_id != %s
            """, (chat['chat_id'], request.user_id))
            other = cur.fetchone()
            if other:
                chat['chat_name'] = other['username']
                chat['other_status'] = other['status']
        # serialize datetime
        if chat['last_time']:
            chat['last_time'] = str(chat['last_time'])

    cur.close(); db.close()
    return jsonify(chats)

@app.route('/api/chats', methods=['POST'])
@token_required
def create_chat():
    data = request.json
    chat_type = data.get('chat_type', 'private')
    chat_name = data.get('chat_name')
    members   = data.get('members', [])  # list of user_ids

    if request.user_id not in members:
        members.append(request.user_id)

    # For private chats, check if one already exists
    if chat_type == 'private' and len(members) == 2:
        db = get_db()
        cur = db.cursor(dictionary=True)
        other_id = [m for m in members if m != request.user_id][0]
        cur.execute("""
            SELECT c.chat_id FROM Chats c
            JOIN ChatMembers cm1 ON c.chat_id = cm1.chat_id AND cm1.user_id = %s
            JOIN ChatMembers cm2 ON c.chat_id = cm2.chat_id AND cm2.user_id = %s
            WHERE c.chat_type = 'private'
        """, (request.user_id, other_id))
        existing = cur.fetchone()
        if existing:
            cur.close(); db.close()
            return jsonify({'chat_id': existing['chat_id'], 'existed': True})
        cur.close(); db.close()

    db = get_db()
    cur = db.cursor()
    cur.execute("INSERT INTO Chats (chat_type, chat_name) VALUES (%s, %s)", (chat_type, chat_name))
    db.commit()
    chat_id = cur.lastrowid

    for uid in members:
        role = 'admin' if uid == request.user_id else 'member'
        cur.execute("INSERT INTO ChatMembers (chat_id, user_id, role) VALUES (%s, %s, %s)", (chat_id, uid, role))
    db.commit()
    cur.close(); db.close()
    return jsonify({'chat_id': chat_id})

# ─── MESSAGE ROUTES ───────────────────────────────────────────────────────────
@app.route('/api/chats/<int:chat_id>/messages', methods=['GET'])
@token_required
def get_messages(chat_id):
    db = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute("""
        SELECT m.message_id, m.sender_id, u.username AS sender_name,
               m.message_text, m.message_type, m.sent_at
        FROM Messages m
        JOIN Users u ON m.sender_id = u.user_id
        WHERE m.chat_id = %s
        ORDER BY m.sent_at ASC
        LIMIT 100
    """, (chat_id,))
    messages = cur.fetchall()
    for msg in messages:
        msg['sent_at'] = str(msg['sent_at'])
    cur.close(); db.close()
    return jsonify(messages)

# ─── SOCKET.IO EVENTS ─────────────────────────────────────────────────────────
online_users = {}  # socket_id -> user_id

@socketio.on('connect')
def on_connect():
    print(f'Client connected: {request.sid}')

@socketio.on('authenticate')
def on_authenticate(data):
    try:
        token = data.get('token', '')
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        user_id = payload['user_id']
        online_users[request.sid] = user_id

        # Update status to online
        db = get_db()
        cur = db.cursor()
        cur.execute("UPDATE Users SET status = 'online' WHERE user_id = %s", (user_id,))
        db.commit()
        cur.close(); db.close()

        emit('authenticated', {'user_id': user_id})
        emit('user_status', {'user_id': user_id, 'status': 'online'}, broadcast=True)
    except Exception as e:
        emit('error', {'message': str(e)})

@socketio.on('join_chat')
def on_join(data):
    room = f"chat_{data['chat_id']}"
    join_room(room)
    emit('joined', {'room': room})

@socketio.on('leave_chat')
def on_leave(data):
    room = f"chat_{data['chat_id']}"
    leave_room(room)

@socketio.on('send_message')
def on_message(data):
    chat_id     = data.get('chat_id')
    sender_id   = data.get('sender_id')
    message_text= data.get('message_text', '')
    message_type= data.get('message_type', 'text')

    if not chat_id or not sender_id or not message_text:
        return

    db = get_db()
    cur = db.cursor(dictionary=True)

    # Insert message
    cur.execute(
        "INSERT INTO Messages (chat_id, sender_id, message_text, message_type) VALUES (%s,%s,%s,%s)",
        (chat_id, sender_id, message_text, message_type)
    )
    db.commit()
    message_id = cur.lastrowid

    # Get sender name
    cur.execute("SELECT username FROM Users WHERE user_id = %s", (sender_id,))
    user = cur.fetchone()

    # Insert MessageStatus for all other members
    cur.execute("SELECT user_id FROM ChatMembers WHERE chat_id = %s AND user_id != %s", (chat_id, sender_id))
    members = cur.fetchall()
    for m in members:
        cur.execute(
            "INSERT INTO MessageStatus (message_id, user_id, status) VALUES (%s,%s,'delivered')",
            (message_id, m['user_id'])
        )
    db.commit()
    cur.close(); db.close()

    msg_data = {
        'message_id': message_id,
        'chat_id': chat_id,
        'sender_id': sender_id,
        'sender_name': user['username'] if user else '',
        'message_text': message_text,
        'message_type': message_type,
        'sent_at': str(datetime.datetime.now()),
        'status': 'sent'
    }
    emit('new_message', msg_data, room=f"chat_{chat_id}")

@socketio.on('typing')
def on_typing(data):
    room = f"chat_{data['chat_id']}"
    emit('user_typing', {
        'user_id': data['user_id'],
        'username': data['username'],
        'is_typing': data.get('is_typing', True)
    }, room=room, include_self=False)

@socketio.on('message_seen')
def on_seen(data):
    message_id = data.get('message_id')
    user_id    = data.get('user_id')
    chat_id    = data.get('chat_id')

    db = get_db()
    cur = db.cursor()
    cur.execute(
        "UPDATE MessageStatus SET status='seen' WHERE message_id=%s AND user_id=%s",
        (message_id, user_id)
    )
    db.commit()
    cur.close(); db.close()

    emit('message_status_update', {
        'message_id': message_id,
        'status': 'seen'
    }, room=f"chat_{chat_id}")

@socketio.on('disconnect')
def on_disconnect():
    user_id = online_users.pop(request.sid, None)
    if user_id:
        db = get_db()
        cur = db.cursor()
        cur.execute("UPDATE Users SET status = 'offline' WHERE user_id = %s", (user_id,))
        db.commit()
        cur.close(); db.close()
        emit('user_status', {'user_id': user_id, 'status': 'offline'}, broadcast=True)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
