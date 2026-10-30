import React, { useState } from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  IconButton, 
  Drawer, 
  List, 
  ListItem, 
  ListItemText, 
  Box, 
  useMediaQuery, 
  useTheme,
  Divider
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccessFeesAndCollection } from '../utils/helpers';

const Navbar = ({ role }) => {
  const navigate = useNavigate();
  const { id: schoolId } = useParams();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // Check if user is effective admin (superuser, admin role, or principal)
  const isEffectiveAdmin = user?.is_superuser || user?.role === 'admin' || user?.profile?.effective_role === 'admin';
  
  const pathMap = {
    'ড্যাশবোর্ড': '',
    'শিক্ষক': 'teacher',
    'ছাত্র-ছাত্রী': 'student',
    'একনজরে সকল শিক্ষার্থী': 'all-students-overview',
    'অভিভাবক': 'parent',
    'কমিটি': 'committee',
    'লাইভ ক্লাস': 'live-class',
    'সফটওয়্যার অ্যাসিস্ট্যান্ট': 'assistant',
    'প্রবেশপত্র': 'admission-cards',
    'আমার শ্রেণি': 'classes',
    'হাজিরা': 'attendance',
    'বিষয়সমূহ': 'subjects',
    'পরীক্ষা': 'examinations',
    'ফলাফল': 'results',
    'টপ শিট': 'top-sheet',
    'ফি': 'fees',
    'দৈনিক আদায় রেজিস্টার': 'daily-collection-register',
    'প্রোফাইল': 'profile',
    'আমার সন্তান': 'parent/dashboard',
    'স্কুল তথ্য': 'schools',
    'স্কুল সেটিংস': 'settings',
    'সাপোর্ট লাইভ': 'support-live'
  };

  const handleNavigation = (e, item) => {
    if (e) e.preventDefault();
    const path = pathMap[item];
    if (path !== undefined) {
      navigate(`/school/${schoolId}/${path}`);
    }
    setDrawerOpen(false);
  };

  let menuItems = [];
  switch(role) {
    case 'Admin':
      menuItems = ['ড্যাশবোর্ড', 'শিক্ষক', 'ছাত্র-ছাত্রী', 'একনজরে সকল শিক্ষার্থী', 'অভিভাবক', 'কমিটি', 'প্রবেশপত্র', 'হাজিরা', 'বিষয়সমূহ', 'পরীক্ষা', 'ফলাফল', 'টপ শিট', 'ফি', 'স্কুল তথ্য', 'স্কুল সেটিংস', 'সাপোর্ট লাইভ', 'প্রোফাইল'];
      break;
    case 'Teacher':
      menuItems = ['ড্যাশবোর্ড', 'শিক্ষক', 'ছাত্র-ছাত্রী', 'একনজরে সকল শিক্ষার্থী', 'বিষয়সমূহ', 'পরীক্ষা', 'ফলাফল', 'টপ শিট', 'হাজিরা', 'স্কুল তথ্য', 'সাপোর্ট লাইভ', 'প্রোফাইল'];
      break;
    case 'Student':
      // Read-only wide menu for students
      menuItems = ['ড্যাশবোর্ড', 'আমার শ্রেণি', 'লাইভ ক্লাস', 'শিক্ষক', 'ছাত্র-ছাত্রী', 'একনজরে সকল শিক্ষার্থী', 'অভিভাবক', 'কমিটি', 'বিষয়সমূহ', 'পরীক্ষা', 'ফলাফল', 'হাজিরা', 'স্কুল তথ্য', 'সফটওয়্যার অ্যাসিস্ট্যান্ট', 'সাপোর্ট লাইভ', 'প্রোফাইল'];
      break;
    case 'Parent':
      // Read-only wide menu for parents
      menuItems = ['ড্যাশবোর্ড', 'আমার সন্তান', 'লাইভ ক্লাস', 'শিক্ষক', 'ছাত্র-ছাত্রী', 'একনজরে সকল শিক্ষার্থী', 'অভিভাবক', 'কমিটি', 'বিষয়সমূহ', 'পরীক্ষা', 'ফলাফল', 'হাজিরা', 'স্কুল তথ্য', 'সফটওয়্যার অ্যাসিস্ট্যান্ট', 'সাপোর্ট লাইভ', 'প্রোফাইল'];
      break;
    case 'Committee':
      // Read-only wide menu for committee members
      menuItems = ['ড্যাশবোর্ড', 'লাইভ ক্লাস', 'শিক্ষক', 'ছাত্র-ছাত্রী', 'একনজরে সকল শিক্ষার্থী', 'অভিভাবক', 'কমিটি', 'বিষয়সমূহ', 'পরীক্ষা', 'ফলাফল', 'হাজিরা', 'স্কুল তথ্য', 'সফটওয়্যার অ্যাসিস্ট্যান্ট', 'সাপোর্ট লাইভ', 'প্রোফাইল'];
      break;
    default:
      menuItems = [];
  }

  if (canAccessFeesAndCollection(user)) {
    if (!menuItems.includes('ফি')) menuItems.push('ফি');
    if (!menuItems.includes('দৈনিক আদায় রেজিস্টার')) menuItems.push('দৈনিক আদায় রেজিস্টার');
  } else {
    menuItems = menuItems.filter(item => item !== 'ফি' && item !== 'দৈনিক আদায় রেজিস্টার');
  }

  return (
    <AppBar position="sticky" sx={{ mb: 2 }}>
      <Toolbar>
        {isMobile && (
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={() => setDrawerOpen(true)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
        )}
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          BD School App
        </Typography>
        {!isMobile && menuItems.map(item => (
          <Button 
            key={item} 
            color="inherit"
            onClick={(e) => handleNavigation(e, item)}
            sx={{ 
              mx: 0.2,
              fontSize: '0.85rem',
              '&:hover': { 
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                transform: 'translateY(-1px)'
              },
              transition: 'all 0.2s'
            }}
          >
            {item}
          </Button>
        ))}
      </Toolbar>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Box sx={{ width: 280 }} role="presentation">
          <Box sx={{ 
            p: 2, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            backgroundColor: '#1a237e',
            color: 'white'
          }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              {isEffectiveAdmin ? 'এডমিন মেনু' : role ? `${role} মেনু` : 'মেনু'}
            </Typography>
            <IconButton 
              color="inherit" 
              onClick={() => setDrawerOpen(false)}
            >
              <CloseIcon />
            </IconButton>
          </Box>
          <Divider />
          <List sx={{ p: 1 }}>
            {menuItems.map((item) => (
              <ListItem 
                button 
                key={item} 
                onClick={(e) => handleNavigation(e, item)}
                sx={{ 
                  borderRadius: 1, 
                  mb: 0.5,
                  py: 1.5,
                  '&:hover': {
                    backgroundColor: 'rgba(26, 35, 126, 0.1)'
                  }
                }}
              >
                <ListItemText 
                  primary={item} 
                  primaryTypographyProps={{
                    fontSize: '1rem',
                    fontWeight: 500
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
    </AppBar>
  );
};

export default Navbar;
