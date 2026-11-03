import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Card, Avatar, CardMedia,
  Stack, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem,
  Chip, FormControl, InputLabel, Select, OutlinedInput, Checkbox, ListItemText
} from "@mui/material";
import CampaignIcon from "@mui/icons-material/Campaign";
import SchoolCarousel from "../components/SchoolCarousel";
import api from "../utils/api";
import { getMediaUrl } from "../utils/media";
import { useAuth } from "../context/AuthContext";
import { isAuthenticated } from "../utils/auth";
import logo from "../components/bdschooapplogo.png";

const SLOTS_CONFIG = [
  { key: 'slot1', title: 'প্রকাশনা' },
  { key: 'slot2', title: 'কর্পোরেট পার্টনার' },
  { key: 'slot3', title: 'ব্র্যান্ড ও সেবা' },
];

const AdSlot = React.memo(({ slotTitle, items, isBdAdmin, onAddClick }) => {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    setIdx(0);
  }, [items?.length]);

  useEffect(() => {
    if (!items || items.length <= 1) return;

    const current = items[idx % items.length];
    if (current?.type === 'video') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setIdx(prev => (prev + 1) % items.length);
    }, 5000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [items, idx]);

  if (!items || items.length === 0) {
    return (
      <Card
        onClick={isBdAdmin ? onAddClick : undefined}
        sx={{
          width: { xs: '100%', sm: 350 },
          height: 140,
          borderRadius: 3,
          boxShadow: 3,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          bgcolor: 'rgba(255, 255, 255, 0.9)',
          cursor: isBdAdmin ? 'pointer' : 'default',
          border: '2px dashed #1a237e',
          p: 2,
          flexShrink: 0
        }}
      >
        <Chip label={slotTitle} size="small" color="primary" sx={{ mb: 1, fontWeight: 'bold' }} />
        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a237e' }}>
          {isBdAdmin ? '+ বিজ্ঞাপন যোগ করুন' : 'বিজ্ঞাপন খালি'}
        </Typography>
      </Card>
    );
  }

  const activeIndex = idx % items.length;
  const ad = items[activeIndex];
  const mediaUrl = getMediaUrl(ad.media_url || ad.media || ad.src);

  return (
    <Card
      onClick={() => { if (ad.link) window.open(ad.link, '_blank'); }}
      sx={{
        width: { xs: '100%', sm: 350 },
        height: 140,
        borderRadius: 3,
        boxShadow: 6,
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
        cursor: ad.link ? 'pointer' : 'default',
        bgcolor: '#000'
      }}
    >
      {ad.type === 'video' ? (
        <CardMedia
          component="video"
          src={mediaUrl}
          autoPlay
          muted
          playsInline
          onEnded={() => setIdx(prev => (prev + 1) % items.length)}
          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <CardMedia
          component="img"
          src={mediaUrl}
          alt={ad.text || slotTitle}
          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}

      {/* Header Slot Title Badge */}
      <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}>
        <Chip
          label={`${slotTitle} ${items.length > 1 ? `(${activeIndex + 1}/${items.length})` : ''}`}
          size="small"
          sx={{ bgcolor: 'rgba(0, 0, 0, 0.75)', color: 'white', fontWeight: 'bold', fontSize: '0.7rem' }}
        />
      </Box>

      {ad.text && (
        <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, bgcolor: 'rgba(0,0,0,0.65)', color: 'white', px: 1, py: 0.5 }}>
          <Typography variant="caption" noWrap display="block">{ad.text}</Typography>
        </Box>
      )}
    </Card>
  );
});

const WelcomePage = () => {
  const [schools, setSchools] = useState([]);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  const username = String(user?.username || user?.user?.username || '').toLowerCase().trim();
  const isBdAdmin = !!(user?.is_superuser || username === 'bdadmin' || username.includes('bdadmin'));
  const rawSchool = user?.profile?.school_id || user?.profile?.school || user?.school || user?.school_id;
  const userSchoolId = rawSchool ? String(typeof rawSchool === 'object' ? rawSchool.id : rawSchool) : (localStorage.getItem('currentSchoolId') || '');
  const userRole = String(user?.profile?.role || user?.role || '').toLowerCase();

  // Redirect non-School 6 teachers and school-specific staff directly to their school dashboard
  useEffect(() => {
    if (user && !isBdAdmin) {
      const isSchool6Staff = (userSchoolId === '6' || userSchoolId === '6.0');
      if (userRole === 'teacher' && !isSchool6Staff && userSchoolId) {
        navigate(`/school/${userSchoolId}`, { replace: true });
      }
    }
  }, [user, userRole, userSchoolId, isBdAdmin, navigate]);

  // Ad Management States for bdadmin
  const [adsOpen, setAdsOpen] = useState(false);
  const [adText, setAdText] = useState('');
  const [adLink, setAdLink] = useState('');
  const [adMediaType, setAdMediaType] = useState('image');
  const [adSlot, setAdSlot] = useState('slot1');
  const [selectedSchoolIds, setSelectedSchoolIds] = useState(['all']);
  const [adMediaFile, setAdMediaFile] = useState(null);
  const [adMediaPreview, setAdMediaPreview] = useState('');
  const [savingAd, setSavingAd] = useState(false);

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
    fetchData();
  }, [fetchData]);

  const handleAdsFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAdMediaFile(file);
    setAdMediaPreview(URL.createObjectURL(file));
  };

  const handleSaveAd = async () => {
    if (!adMediaFile && !adMediaPreview) return;
    try {
      setSavingAd(true);
      const form = new FormData();
      form.append('text', adText);
      form.append('link', adLink);
      form.append('type', adMediaType);
      form.append('slot', adSlot);

      if (selectedSchoolIds.includes('all') || selectedSchoolIds.length === 0) {
        form.append('school', '');
      } else {
        selectedSchoolIds.forEach(sid => form.append('school_ids', sid));
        form.append('school', selectedSchoolIds[0]);
      }

      if (adMediaFile) form.append('media', adMediaFile);
      else if (adMediaPreview) form.append('media_data_url', adMediaPreview);

      await api.post('/api/ads/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000 // 5 minutes timeout for large video/media uploads
      });
      const res = await api.get('/api/ads/');
      setAds(Array.isArray(res.data) ? res.data : (res.data?.results || []));
      setAdText(''); setAdLink(''); setAdMediaPreview(''); setAdMediaFile(null);
      setSelectedSchoolIds(['all']); setAdSlot('slot1');
      setAdsOpen(false);
    } catch (err) {
      console.error('Error saving ad:', err);
    } finally {
      setSavingAd(false);
    }
  };

  const handleRemoveAd = async (adId) => {
    try {
      await api.delete(`/api/ads/${adId}/`);
      const res = await api.get('/api/ads/');
      setAds(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (err) {
      console.error('Error removing ad:', err);
    }
  };

  return (
    <Box sx={{
      minHeight: "100vh",
      bgcolor: "#f0f2f5",
      position: 'relative',
      overflowX: 'hidden'
    }}>

      {isBdAdmin && (
        <Box sx={{ position: 'fixed', top: 16, right: 16, zIndex: 100 }}>
          <Button
            variant="contained"
            color="secondary"
            size="small"
            startIcon={<CampaignIcon />}
            onClick={() => setAdsOpen(true)}
            sx={{ borderRadius: 5, boxShadow: 4, fontWeight: 'bold' }}
          >
            বিজ্ঞাপন অপশন ({ads.length})
          </Button>
        </Box>
      )}

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

          {/* 3 SLOTS SIDE BY SIDE */}
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 2,
            p: 1,
            overflowX: 'auto',
            width: '100%',
            maxWidth: '100vw',
            mt: { xs: 0, sm: 1 },
            pt: isBdAdmin ? 5 : 1
          }}>
            {SLOTS_CONFIG.map((cfg, idx) => {
              const slotAds = ads.filter(a => (a.slot === cfg.key || (!a.slot && ads.indexOf(a) % 3 === idx)));
              return (
                <AdSlot
                  key={cfg.key}
                  slotTitle={cfg.title}
                  items={slotAds}
                  isBdAdmin={isBdAdmin}
                  onAddClick={() => { setAdSlot(cfg.key); setAdsOpen(true); }}
                />
              );
            })}
          </Box>

          <Box sx={{ p: { xs: 1, sm: 4 }, mt: { xs: -1, sm: -2 }, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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

      {/* BDADMIN AD MANAGEMENT DIALOG */}
      <Dialog open={adsOpen} onClose={() => setAdsOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white' }}>
          বিজ্ঞাপন আপলোড ও ব্যবস্থাপনা (Admin)
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="বিজ্ঞাপনের লেখা / শিরোনাম"
              size="small"
              fullWidth
              value={adText}
              onChange={(e) => setAdText(e.target.value)}
            />
            <TextField
              label="ক্লিক করলে ওয়েবসাইট খুলবে (URL Optional)"
              size="small"
              fullWidth
              value={adLink}
              onChange={(e) => setAdLink(e.target.value)}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="মিডিয়া টাইপ"
                select
                size="small"
                value={adMediaType}
                onChange={(e) => setAdMediaType(e.target.value)}
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="image">ছবি (Image)</MenuItem>
                <MenuItem value="video">ভিডিও (Video)</MenuItem>
              </TextField>
              <TextField
                label="স্লট নির্বাচন করুন"
                select
                size="small"
                value={adSlot}
                onChange={(e) => setAdSlot(e.target.value)}
                sx={{ flex: 1 }}
              >
                <MenuItem value="slot1">স্লট-১: প্রকাশনা</MenuItem>
                <MenuItem value="slot2">স্লট-২: কর্পোরেট পার্টনার</MenuItem>
                <MenuItem value="slot3">স্লট-৩: ব্র্যান্ড ও সেবা</MenuItem>
              </TextField>
            </Stack>

            {/* MULTI-SCHOOL SELECTOR */}
            <FormControl fullWidth size="small">
              <InputLabel id="welcome-schools-label">স্কুল নির্বাচন করুন (একাধিক বা গ্লোবাল)</InputLabel>
              <Select
                labelId="welcome-schools-label"
                multiple
                value={selectedSchoolIds}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.includes('all')) {
                    if (!selectedSchoolIds.includes('all')) {
                      setSelectedSchoolIds(['all']);
                    } else {
                      setSelectedSchoolIds(val.filter(v => v !== 'all'));
                    }
                  } else {
                    setSelectedSchoolIds(val);
                  }
                }}
                input={<OutlinedInput label="স্কুল নির্বাচন করুন (একাধিক বা গ্লোবাল)" />}
                renderValue={(selected) => {
                  if (selected.includes('all') || selected.length === 0) return 'সকল স্কুল (গ্লোবাল বিজ্ঞাপন)';
                  return selected.map(id => schools.find(s => String(s.id) === String(id))?.name || id).join(', ');
                }}
              >
                <MenuItem value="all">
                  <Checkbox checked={selectedSchoolIds.includes('all') || selectedSchoolIds.length === 0} />
                  <ListItemText primary="সকল স্কুল (গ্লোবাল বিজ্ঞাপন)" />
                </MenuItem>
                {schools.map((s) => (
                  <MenuItem key={s.id} value={String(s.id)}>
                    <Checkbox checked={selectedSchoolIds.includes(String(s.id)) && !selectedSchoolIds.includes('all')} />
                    <ListItemText primary={`${s.name} (EIIN: ${s.ein || s.id})`} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button variant="outlined" component="label" fullWidth sx={{ py: 1 }}>
              {adMediaFile ? adMediaFile.name : 'ছবি অথবা ভিডিও ফাইল নির্বাচন করুন'}
              <input
                hidden
                type="file"
                accept={adMediaType === 'video' ? 'video/*' : 'image/*'}
                onChange={handleAdsFileChange}
              />
            </Button>

            {adMediaPreview && (
              <Box sx={{ mt: 1, textAlign: 'center' }}>
                {adMediaType === 'video' ? (
                  <Box component="video" src={adMediaPreview} controls sx={{ maxHeight: 150, maxWidth: '100%', borderRadius: 2 }} />
                ) : (
                  <Box component="img" src={adMediaPreview} alt="Preview" sx={{ maxHeight: 150, maxWidth: '100%', borderRadius: 2 }} />
                )}
              </Box>
            )}

            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mt: 2 }}>
              বর্তমান বিজ্ঞাপনসমূহ ({ads.length})
            </Typography>
            {ads.length === 0 ? (
              <Typography variant="body2" color="text.secondary">কোনো বিজ্ঞাপন নেই</Typography>
            ) : (
              <Stack spacing={1} sx={{ maxHeight: 220, overflowY: 'auto' }}>
                {ads.map((ad) => {
                  const sTitle = SLOTS_CONFIG.find(c => c.key === ad.slot)?.title || 'প্রকাশনা';
                  return (
                    <Stack key={ad.id} direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ p: 1, border: '1px solid #ddd', borderRadius: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
                        <Box
                          component={ad.type === 'video' ? 'video' : 'img'}
                          src={getMediaUrl(ad.media_url || ad.media)}
                          sx={{ width: 44, height: 44, borderRadius: 1, objectFit: 'cover' }}
                        />
                        <Box sx={{ overflow: 'hidden' }}>
                          <Typography variant="body2" noWrap fontWeight="bold">{ad.text || 'বিজ্ঞাপন'}</Typography>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Chip label={sTitle} size="small" color="primary" sx={{ fontSize: '0.65rem', height: 18 }} />
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {ad.schools && ad.schools.length > 0 ? `(${ad.schools.length}টি স্কুল)` : '(গ্লোবাল)'}
                            </Typography>
                          </Stack>
                        </Box>
                      </Box>
                      <Button size="small" color="error" variant="outlined" onClick={() => handleRemoveAd(ad.id)}>
                        মুছুন
                      </Button>
                    </Stack>
                  );
                })}
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAdsOpen(false)}>বাতিল</Button>
          <Button variant="contained" onClick={handleSaveAd} disabled={savingAd || (!adMediaFile && !adMediaPreview)}>
            {savingAd ? 'সংরক্ষণ হচ্ছে...' : 'বিজ্ঞাপন সেভ করুন'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WelcomePage;
