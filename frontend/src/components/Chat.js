import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import Sidebar from './Sidebar';
import MessageArea from './MessageArea';
import NewChatModal from './NewChatModal';
import './Chat.css';

const API    = 'http://localhost:5000/api';
const SOCKET = 'http://localhost:5000';

export default function Chat({ user, onLogout }) {
  const [socket, setSocket]     = useState(null);
  const [chats, setChats]       = useState([]);
  const [activeChat, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingMap, setTyping]  = useState({});
  const [showModal, setModal]   = useState(false);

  const authHeaders = { Authorization: `Bearer ${user.token}` };

  useEffect(() => {
    const s = io(SOCKET, { transports: ['websocket'] });
    s.on('connect', () => s.emit('authenticate', { token: user.token }));
    s.on('new_message', (msg) => {
      setMessages(prev => prev.find(m => m.message_id === msg.message_id) ? prev : [...prev, msg]);
      setChats(prev => prev.map(c => c.chat_id === msg.chat_id ? { ...c, last_message: msg.message_text, last_time: msg.sent_at } : c));
    });
    s.on('user_typing', ({ chat_id, username, user_id, is_typing }) => {
      setTyping(prev => { const copy = { ...prev }; if (is_typing) copy[chat_id] = { username, user_id }; else delete copy[chat_id]; return copy; });
    });
    setSocket(s);
    return () => s.disconnect();
  }, [user.token]);

  const loadChats = useCallback(async () => {
    const res = await fetch(`${API}/chats`, { headers: authHeaders });
    const data = await res.json();
    setChats(data);
  }, [user.token]);

  useEffect(() => { loadChats(); }, [loadChats]);

  const selectChat = async (chat) => {
    if (activeChat) socket?.emit('leave_chat', { chat_id: activeChat.chat_id });
    setActive(chat);
    socket?.emit('join_chat', { chat_id: chat.chat_id });
    const res = await fetch(`${API}/chats/${chat.chat_id}/messages`, { headers: authHeaders });
    setMessages(await res.json());
  };

  const sendMessage = (text) => {
    if (!text.trim() || !activeChat || !socket) return;
    socket.emit('send_message', { chat_id: activeChat.chat_id, sender_id: user.user_id, message_text: text, message_type: 'text' });
  };

  const emitTyping = (isTyping) => {
    if (!activeChat || !socket) return;
    socket.emit('typing', { chat_id: activeChat.chat_id, user_id: user.user_id, username: user.username, is_typing: isTyping });
  };

  const createChat = async ({ user_id, chat_type, chat_name }) => {
    const body = chat_type === 'private'
      ? { chat_type: 'private', members: [user.user_id, user_id] }
      : { chat_type: 'group', chat_name, members: [user.user_id, user_id] };
    const res = await fetch(`${API}/chats`, { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    setModal(false);
    await loadChats();
    setTimeout(() => { setChats(prev => { const found = prev.find(c => c.chat_id === data.chat_id); if (found) selectChat(found); return prev; }); }, 300);
  };

  return (
    <div className="chat-app">
      <Sidebar user={user} chats={chats} activeChat={activeChat} onSelect={selectChat} onNewChat={() => setModal(true)} onLogout={() => { socket?.disconnect(); onLogout(); }} typingMap={typingMap} />
      {activeChat ? (
        <MessageArea user={user} chat={activeChat} messages={messages} onSend={sendMessage} onTyping={emitTyping} typing={typingMap[activeChat?.chat_id]} />
      ) : (
        <div className="empty-state">
          <div className="empty-icon">⚡</div>
          <h2>Welcome to Pulse</h2>
          <p>Select a conversation or start a new one</p>
          <button className="btn-primary" onClick={() => setModal(true)}>Start Chatting</button>
        </div>
      )}
      {showModal && <NewChatModal user={user} onClose={() => setModal(false)} onCreate={createChat} authHeaders={authHeaders} />}
    </div>
  );
}