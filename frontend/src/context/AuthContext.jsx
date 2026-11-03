import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAccessToken, saveTokens, login as authLogin, logout as authLogout, clearTokens } from '../utils/auth';
import api from '../utils/api';
import { CircularProgress, Box, Typography } from '@mui/material';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const initAuth = async () => {
      try {
        const savedUser = localStorage.getItem('cached_user_profile');
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch (_) {}
        }
        const token = getAccessToken();
        if (token) {
          await fetchUser();
        }
      } catch (error) {
        console.error('Initial auth initialization failed:', error);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await api.get('/api/users/me/', { timeout: 15000 });
      if (response.data && Object.keys(response.data).length > 0) {
        const data = response.data;
        let userData = data;
        if (data.user && typeof data.user === 'object') {
          userData = {
            ...data.user,
            profile: data.profile || {},
            role: data.profile?.effective_role || data.profile?.role || data.user.role || (data.user.is_superuser ? 'admin' : 'student')
          };
        }
        setUser(userData);
        localStorage.setItem('cached_user_profile', JSON.stringify(userData));
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      const savedUser = localStorage.getItem('cached_user_profile');
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
          return;
        } catch (_) {}
      }
      if (error.response && error.response.status === 401) {
        clearTokens();
        localStorage.removeItem('cached_user_profile');
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const schoolId = localStorage.getItem('currentSchoolId');
      await authLogin(username, password, schoolId);
      await fetchUser();
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      const isOffline = !navigator.onLine || !error.response || error.code === 'ECONNABORTED' || error.message === 'Network Error';

      if (isOffline) {
        const savedUserStr = localStorage.getItem('cached_user_profile');
        if (savedUserStr) {
          try {
            const cachedUser = JSON.parse(savedUserStr);
            const inputUser = (username || '').trim().toLowerCase();
            const cachedUsername = (cachedUser.username || cachedUser.user?.username || '').trim().toLowerCase();
            const cachedEmail = (cachedUser.email || cachedUser.user?.email || '').trim().toLowerCase();
            const cachedPhone = (cachedUser.phone_number || cachedUser.mobile_number || cachedUser.profile?.phone_number || '').trim().toLowerCase();

            const isMatch = (inputUser === cachedUsername) ||
                            (inputUser && cachedEmail && inputUser === cachedEmail) ||
                            (inputUser && cachedPhone && inputUser === cachedPhone);

            if (isMatch) {
              if (!getAccessToken()) {
                saveTokens('offline_access_token', 'offline_refresh_token');
              }
              setUser(cachedUser);
              return { success: true, offline: true };
            } else {
              return {
                success: false,
                error: 'অফলাইনে লগইন করতে পূর্বে এই ডিভাইসে লগইন করা একই ইউজার দিয়ে প্রবেশ করুন।'
              };
            }
          } catch (_) {}
        }
        return {
          success: false,
          error: 'অফলাইনে লগইন করতে পূর্বে অন্তত একবার এই ডিভাইসে সফলভাবে অনলাইনে লগইন থাকতে হবে।'
        };
      }

      return {
        success: false, 
        error: error.response?.data?.detail || error.response?.data?.error || 'Login failed'
      };
    }
  };

  const logout = () => {
    authLogout();
    setUser(null);
    navigate('/login');
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 2,
          bgcolor: '#f5f7fa'
        }}
      >
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">সিস্টেম লোড হচ্ছে...</Typography>
      </Box>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
