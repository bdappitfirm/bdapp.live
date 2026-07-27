import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAccessToken, login as authLogin, logout as authLogout, clearTokens } from '../utils/auth';
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
        if (data.user && typeof data.user === 'object') {
          const flattened = {
            ...data.user,
            profile: data.profile || {},
            role: data.profile?.effective_role || data.profile?.role || data.user.role || (data.user.is_superuser ? 'admin' : 'student')
          };
          setUser(flattened);
        } else {
          setUser(data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      if (error.response && error.response.status === 401) {
        clearTokens();
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
      return {
        success: false, 
        error: error.response?.data?.detail || 'Login failed' 
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
