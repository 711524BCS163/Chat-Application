import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Chat from './components/Chat';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    const stored = localStorage.getItem('chat_user');
    if (stored) setUser(JSON.parse(stored));
  }, []);
  const handleLogin = (userData) => {
    localStorage.setItem('chat_user', JSON.stringify(userData));
    setUser(userData);
  };
  const handleLogout = () => {
    localStorage.removeItem('chat_user');
    setUser(null);
  };
  return user ? <Chat user={user} onLogout={handleLogout} /> : <Login onLogin={handleLogin} />;
}