import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Card, Avatar, CardMedia, Button,
  Stack, Paper, useMediaQuery
} from "@mui/material";
import { useTheme } from '@mui/material/styles';
import SchoolCarousel from "../components/SchoolCarousel";
import api from "../utils/api";
import { getMediaUrl } from "../utils/media";
import { useAuth } from "../context/AuthContext";
import { isAuthenticated } from "../utils/auth";
import logo from "../components/bdschooapplogo.png";
import welcomeBg from "../components/welcome_bg.jpg";

const AdSlot = React.memo(({ items, slotIndex = 0 }) => {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef(null);
  
  useEffect(() => {
    if (!items || items.length <= 1) return;
    timerRef.current = setInterval(() => {
        setIdx(prev => (prev + 1) % items.length);
    }, 5000 + (slotIndex * 1000));
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [items, slotIndex]);

  if (!items || items.length === 0) return null;
  const ad = items[idx % items.length];
  const mediaUrl = getMediaUrl(ad.media_url || ad.media);
  
  return (
    <Card sx={{ width: { xs: '100%', sm: 350 }, height: 140, borderRadius: 3, boxShadow: 6, overflow: 'hidden', flexShrink: 0 }}>
      <CardMedia
        component={ad.type === 'video' ? 'video' : 'img'}
        src={mediaUrl}
        autoPlay={ad.type === 'video'}
        muted
        playsInline
        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </Card>
  );
});

const WelcomePage = () => {
  const [schools, setSchools] = useState([]);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery('(max-width:768px)');
  const isTablet = useMediaQuery('(min-width:769px) and (max-width:1024px)');
  const { user } = useAuth();

  const [numSlots, setNumSlots] = useState(3);

  useEffect(() => {
    if (isMobile) setNumSlots(1);
    else if (isTablet) setNumSlots(2);
    else setNumSlots(3);
  }, [isMobile, isTablet]);

  const fetchedRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    try {
      setLoading(true);
      const [schoolRes, adsRes] = await Promise.allSettled([
        api.get("/api/schools/"),
        api.get("/api/ads/").catch(() => api.get("/api/v1/ads/"))
      ]);

      if (schoolRes.status === 'fulfilled') {
        const data = schoolRes.value.data;
        // Handle both array and paginated response
        const schoolsArr = Array.isArray(data) ? data : (data?.results || []);
        setSchools(schoolsArr);
        console.log(`WelcomePage: Loaded ${schoolsArr.length} schools`);
      } else {
        console.warn("WelcomePage: Schools fetch failed. It might be due to network or empty cache.");
      }

      if (adsRes.status === 'fulfilled') {
        const data = adsRes.value.data;
        setAds(Array.isArray(data) ? data : (data?.results || []));
      }
    } catch (err) {
      console.error("WelcomePage: Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkRedirect = async () => {
      const isAuth = isAuthenticated();
      const lastSchoolId = localStorage.getItem('currentSchoolId');
      
      if (isAuth && lastSchoolId && user) {
        const username = String(user?.username || user?.user?.username || '').toLowerCase().trim();

        // BDAdmin is a superuser, they should NOT be redirected
        // All other users should go directly to their school dashboard
        if (username !== 'bdadmin') {
          navigate(`/school/${lastSchoolId}`, { replace: true });
        }
      }
    };
    
    checkRedirect();
  }, [navigate, user]);

  useEffect(() => {
    fetchData();

    // Also log the service worker registration
    if ('serviceWorker' in navigator) {
      console.log('WelcomePage: Service Worker API available');
      navigator.serviceWorker.ready.then((registration) => {
        console.log('WelcomePage: Service Worker registered:', registration);
      }).catch((err) => {
        console.error('WelcomePage: Service Worker registration error:', err);
      });
    }
  }, [fetchData]);

  return (
    <Box sx={{
      minHeight: "100vh",
      bgcolor: "#f0f2f5", // Facebook style background
      position: 'relative',
      overflowX: 'hidden'
    }}>

      {/* BIG CENTER ROTATING LOGO (zIndex: 0) - CENTERED 75% WIDTH */}
      <Box sx={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
        perspective: '1000px',
        contain: 'strict'
      }}>
        <Box component="img" 
          src={logo} 
          sx={{
            width: '100vw',
            height: '100vw',
            maxWidth: '1000px',
            maxHeight: '1000px',
            opacity: 0.12,
            animation: 'spin360 80s linear infinite', // Slightly slower for better stability
            filter: 'none',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            transform: 'translateZ(0)',
            objectFit: 'contain'
          }} 
        />
      </Box>

      {/* ADD CSS FOR ROTATION */}
      <style>{`
        @keyframes spin360 {
          from { transform: rotate(0deg) translateZ(0); }
          to { transform: rotate(360deg) translateZ(0); }
        }
      `}</style>

      {/* CONTENT LAYER (zIndex: 10+) */}
      <Box sx={{ position: 'relative', zIndex: 10 }}>

          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 2,
            p: 0,
            pt: 0, // No top padding
            overflowX: 'auto',
            width: '100%',
            mt: { xs: -1, sm: 0 }
          }}>
            {Array.from({ length: numSlots }, (_, i) => (
              <AdSlot key={i} items={ads} slotIndex={i} />
            ))}
          </Box>

          <Box sx={{ p: { xs: 0.5, sm: 2 }, mt: { xs: -2, sm: -4 } }}>
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><Typography variant="h5" color="white">লোড হচ্ছে...</Typography></Box>
            ) : (
                <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
                    <Box sx={{ mb: { xs: 1, sm: 4 } }}><SchoolCarousel schools={schools} /></Box>
                    <Typography variant="h6" color="white" align="center" sx={{ mb: 1, fontWeight: 'bold', textShadow: '2px 2px 4px rgba(0,0,0,0.5)', fontSize: { xs: '1rem', sm: '1.4rem' } }}>সকল স্কুল তালিকা</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(280px, 1fr))', md: 'repeat(auto-fill, minmax(300px, 1fr))' }, gap: { xs: 1.5, sm: 2 } }}>
                        {schools.map(s => (
                            <Card key={s.id} sx={{ cursor: 'pointer', p: 2, borderRadius: 4, transition: '0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: 10 } }} onClick={() => {
                                if (isAuthenticated()) {
                                    navigate(`/school/${s.id}`);
                                } else {
                                    navigate(`/login?next=${encodeURIComponent(`/school/${s.id}`)}`);
                                }
                            }}>
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <Avatar src={getMediaUrl(s.logo_thumbnail_url || s.logo)} sx={{ width: 50, height: 50 }} />
                                    <Box sx={{ overflow: 'hidden' }}>
                                        <Typography variant="h6" noWrap sx={{ fontWeight: 'bold', color: '#1a237e' }}>{s.name}</Typography>
                                        <Typography variant="caption" color="text.secondary" noWrap display="block">{s.address || 'ঠিকানা নেই'}</Typography>
                                    </Box>
                                </Stack>
                            </Card>
                        ))}
                    </Box>
                </Box>
            )}
          </Box>
      </Box>
    </Box>
  );
};

export default WelcomePage;
