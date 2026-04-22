# ⚡ Pulse — Real-time Chat App

**Stack:** Python Flask + Socket.IO · MySQL · React

---

## 🎨 Color Palette (4 colors)

| Name     | Hex       | Usage                                    |
|----------|-----------|------------------------------------------|
| Obsidian | `#1A1A2E` | Primary dark background                  |
| Violet   | `#7C3AED` | Brand color, sent messages, accents      |
| Sage     | `#10B981` | Online status, typing, success states    |
| Cream    | `#F5F0E8` | Text, received message bubbles           |

---

## 🗂️ Project Structure

```
chat-app/
├── backend/
│   ├── app.py              ← Flask + Socket.IO server
│   └── requirements.txt    ← Python dependencies
└── frontend/
    ├── public/index.html
    ├── package.json
    └── src/
        ├── App.js / App.css
        └── components/
            ├── Login.js / Login.css
            ├── Chat.js / Chat.css
            ├── Sidebar.js / Sidebar.css
            ├── MessageArea.js / MessageArea.css
            └── NewChatModal.js / NewChatModal.css
```

## ✅ Features

- 🔐 JWT authentication (register / login)
- 💬 Private 1-to-1 chats
- 👥 Group chats
- ⚡ Real-time messaging via Socket.IO
- ✍️ Live typing indicator
- 🟢 Online / offline status
- ✔✔ Message delivered / seen tracking
- 🔔 Unread message badge
- 🗄️ Full MySQL integration (ChatAppDB)

---
