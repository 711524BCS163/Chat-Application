import React from 'react';
import './Sidebar.css';

function avatar(name = '') {
  return name.slice(0, 2).toUpperCase();
}

function timeAgo(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff/60)}m`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function Sidebar({ user, chats, activeChat, onSelect, onNewChat, onLogout, typingMap }) {
  return (
    <div className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <span className="brand-icon">⚡</span>
          <span className="brand-name">Pulse</span>
        </div>
        <div className="header-actions">
          <button className="icon-btn" onClick={onNewChat} title="New chat">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>
      </div>

      {/* User info */}
      <div className="user-pill">
        <div className="avatar avatar-sm">
          {avatar(user.username)}
          <span className="status-dot online" />
        </div>
        <div className="user-info">
          <span className="user-name">{user.username}</span>
          <span className="user-status">Online</span>
        </div>
        <button className="icon-btn logout-btn" onClick={onLogout} title="Sign out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
        </button>
      </div>

      {/* Chat list */}
      <div className="chat-list-label">Messages</div>
      <div className="chat-list">
        {chats.length === 0 && (
          <div className="no-chats">No conversations yet.<br/>Start one with the + button!</div>
        )}
        {chats.map(chat => {
          const isActive  = activeChat?.chat_id === chat.chat_id;
          const isTyping  = typingMap?.[chat.chat_id];
          const isOnline  = chat.other_status === 'online';

          return (
            <div
              key={chat.chat_id}
              className={`chat-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelect(chat)}
            >
              <div className="avatar">
                {chat.chat_type === 'group'
                  ? <span style={{fontSize:18}}>👥</span>
                  : avatar(chat.chat_name)}
                {chat.chat_type === 'private' && (
                  <span className={`status-dot ${isOnline ? 'online' : ''}`} />
                )}
              </div>

              <div className="chat-item-body">
                <div className="chat-item-top">
                  <span className="chat-item-name">{chat.chat_name || 'Unnamed'}</span>
                  <span className="chat-item-time">{timeAgo(chat.last_time)}</span>
                </div>
                <div className="chat-item-bottom">
                  <span className="chat-item-preview">
                    {isTyping
                      ? <span className="typing-preview">typing…</span>
                      : (chat.last_message || 'No messages yet')}
                  </span>
                  {chat.unread > 0 && (
                    <span className="unread-badge">{chat.unread}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
