import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import { Box, CircularProgress, Typography, Button } from '@mui/material';
import { useAuth } from '../context/AuthContext';

const ADMIN_ROLES = ['admin', 'super_admin', 'superadmin', 'bdadmin', 'school_admin'];

const ProtectedRoute = ({ children, allowedRoles }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: schoolId } = useParams();
  const [isChecking, setIsChecking] = useState(true);
  const { user, loading } = useAuth();
  
  // Extract role and user's school ID
  const role = ((user && (user.role || user.profile?.effective_role || user.profile?.role)) || '').trim().toLowerCase();
  const username = String(user?.username || user?.user?.username || '').toLowerCase().replace(/\u200d/g, '').trim();
  const rawSchool = user?.profile?.school_id || user?.profile?.school;
  const userSchoolId = rawSchool ? String(typeof rawSchool === 'object' ? rawSchool.id : rawSchool) : '';
  const isSchool6Staff = userSchoolId === '6' || userSchoolId === '6.0' || (user?.profile?.school?.id === 6);

  const isTrueAdmin = !!(
    user?.is_superuser || 
    user?.user?.is_superuser || 
    user?.profile?.is_superuser || 
    user?.is_staff || 
    user?.user?.is_staff ||
    ADMIN_ROLES.includes(role) ||
    username === 'bdadmin' || 
    username === 'shamir' ||
    username === 'umor'
  );

  // Cross-school navigation permission (BDapp School 6 staff or superusers can enter other schools)
  const canAccessMultipleSchools = isTrueAdmin || isSchool6Staff;

  useEffect(() => {
    const checkAuth = () => {
      const authenticated = isAuthenticated() || !!user;
      if (!authenticated) {
        const next = encodeURIComponent(location.pathname + location.search);
        navigate(`/login?next=${next}${Array.isArray(allowedRoles) && allowedRoles.length ? `&require=${allowedRoles.join(',')}` : ''}`, { replace: true });
        return;
      }

      // Check for school isolation
      if (schoolId && !canAccessMultipleSchools && userSchoolId) {
        if (String(schoolId) !== String(userSchoolId)) {
          setIsChecking(false);
          return;
        }
      }

      setIsChecking(false);
      
      if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
        const hasRole = !!role;
        const isAdminLike = ADMIN_ROLES.includes(role) || isTrueAdmin;
        const ok = isAdminLike ? true : (hasRole ? allowedRoles.map(r => String(r).toLowerCase()).includes(role) : false);
        if (!ok) {
          setIsChecking(false);
          return;
        }
      }
    };

    if (!loading) checkAuth();
  }, [navigate, user, loading, location.pathname, location.search, schoolId, userSchoolId, canAccessMultipleSchools, allowedRoles, role, isTrueAdmin]);

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

  // Special restriction: School 69 Admin Page is strictly for bdadmin
  const isSchool69 = String(schoolId) === '69' || location.pathname.includes('/school/69');
  const isAdminRoute = location.pathname.includes('/admin');
  const isBdAdminUser = username === 'bdadmin' || username.includes('bdadmin');

  if (isSchool69 && isAdminRoute && !isBdAdminUser) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="60vh" textAlign="center">
        <Typography variant="h5" color="error" gutterBottom sx={{ fontWeight: 'bold' }}>
          এক্সেস নিষিদ্ধ (Access Denied)
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          স্কুল ৬৯ (School 69)-এর এডমিন পেজে প্রবেশ করার অনুমতি শুধুমাত্র <strong>bdadmin</strong> এর রয়েছে।
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate(`/school/${schoolId || 69}`)}
          sx={{ mt: 2 }}
        >
          স্কুল ড্যাশবোর্ডে ফিরে যান
        </Button>
      </Box>
    );
  }

  // School isolation error message
  if (schoolId && !canAccessMultipleSchools && userSchoolId && String(schoolId) !== String(userSchoolId)) {
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

  // Role checking for Admin / Teacher / Student pages
  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const hasRole = !!role;
    const isAdminLike = ADMIN_ROLES.includes(role) || isTrueAdmin;
    const readOnlyRoles = ['student', 'parent', 'committee'];
    const ok = isAdminLike || (hasRole && allowedRoles.map(r => String(r).toLowerCase()).includes(role)) || readOnlyRoles.includes(role);

    if (!ok) {
        return (
          <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="60vh" textAlign="center">
            <Typography variant="h5" color="error" gutterBottom sx={{ fontWeight: 'bold' }}>
              আপনি এই পেজে প্রবেশের অনুমতি পাচ্ছেন না
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              এই পেজটিতে প্রবেশের জন্য প্রয়োজন: <strong>{allowedRoles.join(', ')}</strong> রোল। (আপনার বর্তমান ভূমিকা: {role || 'নাই'})
            </Typography>
            <Button variant="contained" onClick={() => navigate(-1)} sx={{ mr: 1 }}>
              পিছনে ফিরে যান
            </Button>
            <Button variant="outlined" onClick={() => navigate('/')}>
              হোমপেজ
            </Button>
          </Box>
        );
      }
  }

  return children;
};

export default ProtectedRoute;
