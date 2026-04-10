import React, { useState, useEffect } from 'react';
import './NewChatModal.css';

const API = 'http://localhost:5000/api';

export default function NewChatModal({ user, onClose, onCreate, authHeaders }) {
  const [search, setSearch]   = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelect] = useState(null);
  const [chatType, setType]   = useState('private');
  const [groupName, setGName] = useState('');
  const [loading, setLoad]    = useState(false);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`${API}/users/search?q=${search}`, { headers: authHeaders });
      const data = await res.json();
      setResults(data);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const submit = async () => {
    if (!selected) return;
    setLoad(true);
    await onCreate({
      user_id: selected.user_id,
      username: selected.username,
      chat_type: chatType,
      chat_name: chatType === 'group' ? groupName : null
    });
    setLoad(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-header">
          <h3>New Conversation</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-type-toggle">
          <button className={chatType === 'private' ? 'active' : ''} onClick={() => setType('private')}>
            💬 Direct Message
          </button>
          <button className={chatType === 'group' ? 'active' : ''} onClick={() => setType('group')}>
            👥 Group Chat
          </button>
        </div>

        {chatType === 'group' && (
          <div className="modal-field">
            <input
              value={groupName}
              onChange={e => setGName(e.target.value)}
              placeholder="Group name…"
            />
          </div>
        )}

        <div className="modal-field">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users…"
            autoFocus
          />
        </div>

        {results.length > 0 && (
          <div className="modal-results">
            {results.map(u => (
              <div
                key={u.user_id}
                className={`modal-user ${selected?.user_id === u.user_id ? 'selected' : ''}`}
                onClick={() => setSelect(u)}
              >
                <div className="mu-avatar">{u.username.slice(0,2).toUpperCase()}</div>
                <div>
                  <div className="mu-name">{u.username}</div>
                  <div className="mu-status">{u.status}</div>
                </div>
                {selected?.user_id === u.user_id && <span className="mu-check">✓</span>}
              </div>
            ))}
          </div>
        )}

        {search && results.length === 0 && (
          <div className="modal-empty">No users found for "{search}"</div>
        )}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={submit}
            disabled={!selected || loading || (chatType === 'group' && !groupName.trim())}
          >
            {loading ? 'Starting…' : 'Start Chat →'}
          </button>
        </div>
      </div>
    </div>
  );
}
