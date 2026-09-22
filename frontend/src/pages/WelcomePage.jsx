import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Card, Avatar, CardMedia,
  Stack, useMediaQuery
} from "@mui/material";
import { useTheme } from '@mui/material/styles';
import SchoolCarousel from "../components/SchoolCarousel";
import api from "../utils/api";
import { getMediaUrl } from "../utils/media";
import { useAuth } from "../context/AuthContext";
import { isAuthenticated } from "../utils/auth";
import logo from "../components/bdschooapplogo.png";

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
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
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
        const schoolsArr = Array.isArray(data) ? data : (data?.results || []);
        setSchools(schoolsArr);
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
        if (username !== 'bdadmin') {
          navigate(`/school/${lastSchoolId}`, { replace: true });
        }
      }
    };
    
    checkRedirect();
  }, [navigate, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <Box sx={{
      minHeight: "100vh",
      bgcolor: "#f0f2f5",
      position: 'relative',
      overflowX: 'hidden'
    }}>

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
            animation: 'spin360 80s linear infinite',
            filter: 'none',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            transform: 'translateZ(0)',
            objectFit: 'contain'
          }} 
        />
      </Box>

      <style>{`
        @keyframes spin360 {
          from { transform: rotate(0deg) translateZ(0); }
          to { transform: rotate(360deg) translateZ(0); }
        }
      `}</style>

      {/* CONTENT LAYER (zIndex: 10+) */}
      <Box sx={{ position: 'relative', zIndex: 10, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 2,
            p: 0,
            overflowX: 'auto',
            width: '100%',
            maxWidth: '100vw',
            mt: { xs: -1, sm: 0 }
          }}>
            {Array.from({ length: numSlots }, (_, i) => (
              <AdSlot key={i} items={ads} slotIndex={i} />
            ))}
          </Box>

          <Box sx={{ p: { xs: 1, sm: 4 }, mt: { xs: -2, sm: -4 }, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><Typography variant="h5" color="white">লোড হচ্ছে...</Typography></Box>
            ) : (
                <Box sx={{ width: '100%', maxWidth: 1200, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Box sx={{ mb: { xs: 2, sm: 6 }, width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <SchoolCarousel schools={schools} />
                    </Box>
                    <Typography variant="h6" color="white" align="center" sx={{ mb: 3, fontWeight: 'bold', textShadow: '2px 2px 4px rgba(0,0,0,0.5)', fontSize: { xs: '1.2rem', sm: '1.8rem' } }}>সকল স্কুল তালিকা</Typography>
                    <Box sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: { xs: 2, sm: 4 },
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: '100%',
                        px: { xs: 1, sm: 2 }
                    }}>
                        {schools.map(s => (
                            <Box key={s.id} sx={{ width: { xs: '100%', sm: 300, md: 340 }, display: 'flex', justifyContent: 'center' }}>
                                <Card sx={{
                                    cursor: 'pointer',
                                    p: 2.5,
                                    borderRadius: 5,
                                    transition: 'all 0.3s ease',
                                    width: '100%',
                                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                                    backdropFilter: 'blur(10px)',
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                                    '&:hover': { transform: 'translateY(-8px)', boxShadow: '0 12px 48px rgba(0,0,0,0.2)' }
                                }} onClick={() => {
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
                            </Box>
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
