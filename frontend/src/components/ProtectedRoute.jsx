import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import { Box, CircularProgress, Typography, Button } from '@mui/material';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: schoolId } = useParams();
  const [isChecking, setIsChecking] = useState(true);
  const { user, loading } = useAuth();
  
  // Extract role and user's school ID
  const role = ((user && (user.role || user.profile?.effective_role || user.profile?.role)) || '').trim().toLowerCase();
  const username = String(user?.username || user?.user?.username || '').toLowerCase().replace(/\u200d/g, '').trim();
  const userSchoolId = user?.profile?.school;
  const adminRoles = ['admin', 'super_admin', 'superadmin', 'bdadmin', 'school_admin'];
  const isSuperUser = !!(
    user?.is_superuser || 
    user?.user?.is_superuser || 
    user?.profile?.is_superuser || 
    user?.is_staff || 
    user?.user?.is_staff ||
    adminRoles.includes(role) || 
    username === 'bdadmin' || 
    username === 'shamir' ||
    username === 'umor'
  );

  useEffect(() => {
    const checkAuth = () => {
      const authenticated = isAuthenticated() || !!user;
      if (!authenticated) {
        const next = encodeURIComponent(location.pathname + location.search);
        navigate(`/login?next=${next}${Array.isArray(allowedRoles) && allowedRoles.length ? `&require=${allowedRoles.join(',')}` : ''}`, { replace: true });
        return;
      }

      // Check for school isolation if not a superuser
      if (schoolId && !isSuperUser && userSchoolId) {
        if (String(schoolId) !== String(userSchoolId)) {
          // User is trying to access another school's dashboard
          setIsChecking(false);
          return;
        }
      }

      setIsChecking(false);
      
      if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
        const hasRole = !!role;
        const isAdminLike = role === 'admin' || role === 'super_admin';
        const ok = isAdminLike ? true : (hasRole ? allowedRoles.map(r => String(r).toLowerCase()).includes(role) : true);
        if (hasRole && !ok) {
          setIsChecking(false);
          return;
        }
      }
    };


    if (!loading) checkAuth();
  }, [navigate, user, loading, location.pathname, location.search, schoolId, userSchoolId, isSuperUser]);

  if (isChecking || loading) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
      >
        <CircularProgress size={40} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Checking authentication...
        </Typography>
      </Box>
    );
  }

  if (!(isAuthenticated() || !!user)) {
    return null;
  }

  // School isolation error message
  if (schoolId && !isSuperUser && userSchoolId && String(schoolId) !== String(userSchoolId)) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="60vh">
        <Typography variant="h5" color="error" gutterBottom>
          এক্সেস রিফিউজড (Access Refused)
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          আপনি এই স্কুলের ড্যাশবোর্ডে প্রবেশের অনুমতি পাচ্ছেন না। আপনি কেবল আপনার নিজস্ব স্কুলের তথ্য দেখতে পারবেন।
        </Typography>
        <Button 
          variant="contained" 
          onClick={() => navigate(`/school/${userSchoolId}`)}
          sx={{ mt: 2 }}
        >
          আপনার স্কুলে ফিরে যান
        </Button>
      </Box>
    );
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const hasRole = !!role;
    const isAdminLike = adminRoles.includes(role);
    const readOnlyRoles = ['student', 'parent', 'committee'];
    const ok = isAdminLike || isSuperUser || (hasRole && allowedRoles.map(r => String(r).toLowerCase()).includes(role)) || readOnlyRoles.includes(role);
    if (!ok) {
        return (
          <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="60vh">
            <Typography variant="h6" sx={{ mb: 1 }}>
              আপনি এই পেজে প্রবেশের অনুমতি পাচ্ছেন না
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              প্রয়োজনীয় ভূমিকা: {allowedRoles.join(', ')}
            </Typography>
            <Button variant="contained" onClick={() => navigate(-1)} sx={{ mr: 1 }}>
              ব্যাক
            </Button>
            <Button variant="outlined" onClick={() => navigate('/')}>
              হোম
            </Button>
          </Box>
        );
      }
  }

  return children;
};

export default ProtectedRoute;
