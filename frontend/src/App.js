import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import '@/App.css';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import AuthPage from '@/components/AuthPage';
import MainLayout from '@/components/MainLayout';
import Feed from '@/components/Feed';
import Messages from '@/components/Messages';
import Friends from '@/components/Friends';
import Profile from '@/components/Profile';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Set axios default headers
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('zoq_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('zoq_token');
    if (token) {
      try {
        const response = await axios.get(`${API}/auth/me`);
        setUser(response.data);
      } catch (error) {
        localStorage.removeItem('zoq_token');
      }
    }
    setLoading(false);
  };

  const handleLogin = (userData, token) => {
    localStorage.setItem('zoq_token', token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('zoq_token');
    setUser(null);
    toast.success('Logged out successfully');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          {!user ? (
            <>
              <Route path="/" element={<AuthPage onLogin={handleLogin} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<MainLayout user={user} onLogout={handleLogout} />}>
                <Route index element={<Feed user={user} />} />
                <Route path="messages" element={<Messages user={user} />} />
                <Route path="messages/:userId" element={<Messages user={user} />} />
                <Route path="friends" element={<Friends user={user} />} />
                <Route path="profile" element={<Profile user={user} setUser={setUser} />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </div>
  );
}

export default App;