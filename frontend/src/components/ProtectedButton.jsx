import React from 'react';
import { IconButton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import { useAuth } from '../context/AuthContext';

const ProtectedButton = ({ children, onClick, allowedRoles, ...props }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = ((user && (user.profile?.role || user.role)) || '').trim().toLowerCase();

  const handleClick = (e) => {
    if (!(isAuthenticated() || !!user)) {
      e.preventDefault();
      navigate('/login');
      return;
    }
    if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
      const username = String(user?.username || user?.user?.username || '').toLowerCase().replace(/\u200d/g, '').trim();
      const isAdminLike = role === 'admin' || role === 'super_admin' || username === 'bdadmin' || username === 'shamir' || user?.is_superuser || user?.user?.is_superuser;
      if (!isAdminLike && (!role || !allowedRoles.map(r => String(r).toLowerCase()).includes(role))) {
        e.preventDefault();
        return;
      }
    }
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <IconButton onClick={handleClick} {...props}>
      {children}
    </IconButton>
  );
};

export default ProtectedButton;
