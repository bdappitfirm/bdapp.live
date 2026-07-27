// src/pages/LoginPage.js
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login } = useAuth();
  const role = ((user && (user.profile?.role || user.role)) || '').toLowerCase();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await login(username, password);
      if (!res?.success) {
        setError(res?.error || 'Invalid username or password');
        return;
      }
      const params = new URLSearchParams(location.search || '');
      const next = params.get('next');
      const from = location.state?.from?.pathname;
      const lastSchoolId = localStorage.getItem('currentSchoolId');
      const lastPath = sessionStorage.getItem('lastPath');
      if (next) {
        navigate(next, { replace: true });
      } else if (from) {
        navigate(from, { replace: true });
      } else if (lastPath) {
        navigate(lastPath, { replace: true });
      } else if (lastSchoolId) {
        navigate(`/school/${lastSchoolId}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError('Invalid username or password');
    }
  };

  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search || '');
      const next = params.get('next');
      const require = (params.get('require') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      
      console.log('LoginPage useEffect - path:', location.pathname);
      const isAuth = isAuthenticated();
      console.log('LoginPage useEffect - isAuthenticated:', isAuth);
      console.log('LoginPage useEffect - user exists:', !!user);
      
      if (isAuth && user) {
        const lastSchoolId = localStorage.getItem('currentSchoolId');
        const lastPath = sessionStorage.getItem('lastPath');
        
        console.log('LoginPage - already authenticated, redirecting...');
        console.log('LoginPage - lastPath:', lastPath);
        console.log('LoginPage - lastSchoolId:', lastSchoolId);
        console.log('LoginPage - next:', next);

        const goHome = () => {
          if (lastPath && lastPath !== '/login') navigate(lastPath, { replace: true });
          else if (lastSchoolId) navigate(`/school/${lastSchoolId}`, { replace: true });
          else navigate('/', { replace: true });
        };
        if (require.length > 0 && (!role || !require.includes(role))) {
          goHome();
          return;
        }
        if (next) navigate(next, { replace: true });
        else goHome();
      }
    } catch (_) {}
  }, [location.search, location.pathname, role, user, navigate]);

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto' }}>
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="login-username">Username:</label>
          <input
            type="text"
            id="login-username"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="login-password">Password:</label>
          <input
            type="password"
            id="login-password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}

        <button type="submit" style={{ padding: '10px 20px' }}>Login</button>
      </form>
      <div style={{ marginTop: '10px' }}>
        <a href="/forgot-password">Forgot Password?</a>
      </div>
    </div>
  );
};

export default LoginPage;
