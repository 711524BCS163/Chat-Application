import React, { useState, useEffect, useRef } from 'react';
import './MessageArea.css';

function avatar(name = '') { return name.slice(0, 2).toUpperCase(); }

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageArea({ user, chat, messages, onSend, onTyping, typing }) {
  const [text, setText]       = useState('');
  const [typing_, setTyping]  = useState(false);
  const bottomRef             = useRef(null);
  const typingTimer           = useRef(null);
  const inputRef              = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setText('');
    inputRef.current?.focus();
  }, [chat.chat_id]);

  const handleType = (e) => {
    setText(e.target.value);
    if (!typing_) { setTyping(true); onTyping(true); }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => { setTyping(false); onTyping(false); }, 1500);
  };

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text);
    setText('');
    setTyping(false);
    onTyping(false);
    clearTimeout(typingTimer.current);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Group messages by sender for bubble grouping
  const grouped = messages.map((msg, i) => ({
    ...msg,
    isOwn: msg.sender_id === user.user_id,
    showAvatar: i === 0 || messages[i-1].sender_id !== msg.sender_id,
    showName: i === 0 || messages[i-1].sender_id !== msg.sender_id,
  }));

  return (
    <div className="message-area">
      {/* Header */}
      <div className="msg-header">
        <div className="avatar" style={{background:'var(--violet-dim)',color:'var(--violet-light)'}}>
          {chat.chat_type === 'group' ? '👥' : avatar(chat.chat_name)}
          {chat.chat_type === 'private' && (
            <span className={`status-dot ${chat.other_status === 'online' ? 'online' : ''}`} />
          )}
        </div>
        <div className="msg-header-info">
          <span className="msg-header-name">{chat.chat_name || 'Chat'}</span>
          <span className="msg-header-status">
            {typing
              ? <span className="typing-indicator"><span/><span/><span/> {typing.username} is typing…</span>
              : chat.chat_type === 'private'
                ? (chat.other_status === 'online' ? '🟢 Online' : '⚫ Offline')
                : 'Group chat'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-scroll">
        {grouped.length === 0 && (
          <div className="no-messages">
            <p>No messages yet.</p>
            <p>Say hello! 👋</p>
          </div>
        )}
        {grouped.map((msg, i) => (
          <div key={msg.message_id} className={`msg-row ${msg.isOwn ? 'own' : 'other'}`}>
            {!msg.isOwn && (
              <div className={`msg-avatar ${msg.showAvatar ? '' : 'invisible'}`}>
                {avatar(msg.sender_name)}
              </div>
            )}
            <div className="msg-col">
              {!msg.isOwn && msg.showName && (
                <span className="msg-sender">{msg.sender_name}</span>
              )}
              <div className="bubble">
                {msg.message_text}
                <span className="bubble-time">{formatTime(msg.sent_at)}</span>
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="input-area">
        <div className="input-wrap">
          <input
            ref={inputRef}
            value={text}
            onChange={handleType}
            onKeyDown={handleKey}
            placeholder={`Message ${chat.chat_name}…`}
            className="msg-input"
          />
          <button
            className={`send-btn ${text.trim() ? 'active' : ''}`}
            onClick={handleSend}
            disabled={!text.trim()}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
