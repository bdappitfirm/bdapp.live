import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Outlet, useNavigate, useParams, useLocation } from "react-router-dom";
import {
  AppBar, Toolbar, Typography, Drawer, List,
  ListItemButton, ListItemIcon, ListItemText, Box, Avatar,
  CssBaseline, Divider, Grid, Paper, Card, CardHeader,
  CardContent, CircularProgress, Stack, IconButton,
  TextField, Chip, Button,
  MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  Menu, MenuItem as MuiMenuItem, Collapse,
  FormControl, InputLabel, Select, OutlinedInput, Checkbox
} from "@mui/material";
import { useToast } from '../components/Toast';

// Icons
import PersonIcon from "@mui/icons-material/Person";
import SchoolIcon from "@mui/icons-material/School";
import GroupIcon from "@mui/icons-material/Group";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AssessmentIcon from "@mui/icons-material/Assessment";
import CardMembershipIcon from "@mui/icons-material/CardMembership";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import SmsIcon from "@mui/icons-material/Sms";
import BookIcon from "@mui/icons-material/Book";
import ClassIcon from "@mui/icons-material/Class";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import PaymentIcon from "@mui/icons-material/Payment";
import ReceiptIcon from "@mui/icons-material/Receipt";
import PeopleIcon from "@mui/icons-material/People";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import EventSeatIcon from "@mui/icons-material/EventSeat";
import DescriptionIcon from "@mui/icons-material/Description";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import MenuIcon from '@mui/icons-material/Menu';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HomeIcon from '@mui/icons-material/Home';
import LockIcon from '@mui/icons-material/Lock';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';

// Context & Services
import { useAuth } from '../context/AuthContext';
import { setCurrentSchoolId, getDashboardStats } from '../services/dashboardService';
import api from '../utils/api';
import { getMediaUrl } from '../utils/media';
import { canAccessFeesAndCollection } from '../utils/helpers';

// Dashboard Components
import AttendanceChart from '../components/dashboard/AttendanceChart';
import ClassDistributionChart from '../components/dashboard/ClassDistributionChart';
import FeeCollectionChart from '../components/dashboard/FeeCollectionChart';
import AdCarousel from '../components/dashboard/AdCarousel';
import ResultSummaryTable from '../components/dashboard/ResultSummaryTable';
import StatCardsSection from '../components/dashboard/StatCardsSection';

const drawerWidth = 260;

const SchoolDashboard = () => {
  const toast = useToast();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, loading: authLoading } = useAuth();

  const isMainDashboard = location.pathname === `/school/${id}` || location.pathname === `/school/${id}/`;
  const [schoolData, setSchoolData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [schoolsList, setSchoolsList] = useState([]);
  const [openSubmenus, setOpenSubmenus] = useState({});

  // Auth & Permissions
  const role = (user?.role || user?.profile?.effective_role || user?.profile?.role || '').toLowerCase();
  const username = (user?.username || '').toLowerCase();
  const isSuperUser = user?.is_superuser || role === 'admin' || username.includes('bdadmin');
  const isTeacher = role === 'teacher' || role === 'admin';

  const menuItems = useMemo(() => [
    { label: 'ড্যাশবোর্ড প্যানেল', icon: <AssessmentIcon />, key: 'dashboard-stats' },
    { label: 'শিক্ষক', icon: <PersonIcon />, key: 'teacher' },
    { label: 'ছাত্র-ছাত্রী', icon: <SchoolIcon />, key: 'student' },
    { label: 'একনজরে সকল শিক্ষার্থী', icon: <SchoolIcon />, key: 'all-students-overview' },
    { label: 'অভিভাবক', icon: <PeopleIcon />, key: 'parent' },
    { label: 'শ্রেণি ব্যবস্থাপনা', icon: <ClassIcon />, key: 'classes' },
    { label: 'বিষয়/সাবজেক্ট', icon: <BookIcon />, key: 'subjects' },
    { label: 'একাডেমিক ওভারভিউ', icon: <SchoolIcon />, key: 'academics' },
    { label: 'হাজিরা', icon: <CheckCircleIcon />, key: 'attendance' },
    { label: 'হাজিরা রেকর্ড', icon: <DescriptionIcon />, key: 'attendance/records' },
    { label: 'মাসিক হাজিরা রিপোর্ট', icon: <AssessmentIcon />, key: 'attendance/report-card' },
    { label: 'পরীক্ষা', icon: <AssessmentIcon />, key: 'examinations' },
    { label: 'রেজাল্ট', icon: <AssessmentIcon />, key: 'results' },
    { label: 'রেজাল্ট কার্ড', icon: <CardMembershipIcon />, key: 'result-card' },
    { label: 'ক্লাস রেজাল্টস', icon: <AssessmentIcon />, key: 'class-results' },
    { label: 'টপ শিট (Top Sheet)', icon: <DescriptionIcon />, key: 'top-sheet' },
    { label: 'Rank List (মেধাক্রম)', icon: <CardMembershipIcon />, key: 'rank-list' },
    { label: 'Merit List(মেধাতালিকা)', icon: <CardMembershipIcon />, key: 'merit-list' },
    { label: 'স্টুডেন্ট তালিকা', icon: <GroupIcon />, key: 'student-list' },
    { label: 'আইডি কার্ড', icon: <CardMembershipIcon />, key: 'id-card' },
    { label: 'প্রবেশপত্র', icon: <CardMembershipIcon />, key: 'admission-cards' },
    { label: 'সার্টিফিকেট', icon: <CardMembershipIcon />, key: 'certificate' },
    { label: 'ভোটার তালিকা', icon: <DescriptionIcon />, key: 'voter-list' },
    { label: 'টট লিস্ট', icon: <DescriptionIcon />, key: 'tot-list' },
    { label: 'ফি', icon: <PaymentIcon />, key: 'fees' },
    { label: 'দৈনিক আদায় রেজিস্টার', icon: <ReceiptIcon />, key: 'daily-collection-register' },
    { label: 'ফি পরিশোধ', icon: <ReceiptIcon />, key: 'fee-receipt' },
    { label: 'রিসিট বই', icon: <ReceiptIcon />, key: 'receipt-book' },
    { label: 'ব্যানবেইস',
      icon: (
        <Box component="img" src="/images/gov_logo.png"
          sx={{ width: 22, height: 22, objectFit: 'contain' }}
          onError={(e) => { e.target.src = '/logo192.png'; }}
        />
      ),
      key: 'banbeis'
    },
    { label: 'লাইভ ক্লাস', icon: <VideoCallIcon />, key: 'live-class' },
    { label: 'প্রমোশন', icon: <AssessmentIcon />, key: 'promotion' },
    { label: 'ভাই-বোন', icon: <GroupIcon />, key: 'siblings' },
    { label: 'সিট বন্টন', icon: <EventSeatIcon />, key: 'seat-allocation' },
    { label: 'এসএমএস', icon: <SmsIcon />, key: 'sms' },
    { label: 'কমিটি', icon: <GroupIcon />, key: 'committee' },
    { label: 'শিক্ষক পে-রোল (বেতন)', icon: <PaymentIcon />, key: 'payroll' },
    { label: 'আইডি লিস্ট', icon: <LockIcon />, key: 'credentials' },
    { label: 'এডমিন', icon: <AccountBalanceIcon />, key: 'admin' },
    { label: 'স্কুল সেটিংস', icon: <SchoolIcon />, key: 'settings' },
    { label: 'WhatsApp গেটওয়ে', icon: <WhatsAppIcon />, key: 'whatsapp' },
    { label: 'বিল জেনারেটর', icon: <ReceiptIcon />, key: 'billing' },
    { label: 'আয়-ব্যয় হিসাব নিকাশ', icon: <AccountBalanceIcon />, key: 'accounts' },
    { label: 'সফটওয়ার এ্যাসিসটেন্ট', icon: <SupportAgentIcon />, key: 'assistant' },
    { label: 'সাপোর্ট লাইভ', icon: <SupportAgentIcon />, key: 'support-live' },
    { label: 'প্রফাইল', icon: <AccountCircleIcon />, key: 'profile' },
  ], []);

  const filteredMenuItems = useMemo(() => menuItems.filter(item => {
    if (item.key === 'billing' || item.key === 'accounts') {
        return String(id) === '6' && (isSuperUser || username.includes('bdadmin') || role === 'admin');
    }
    if (item.key === 'rank-list') {
        return username === 'bdadmin';
    }
    if (['fees', 'daily-collection-register', 'fee-receipt', 'receipt-book'].includes(item.key)) {
        return canAccessFeesAndCollection(user);
    }
    return true;
  }), [menuItems, isSuperUser, id, username, user, role]);

  const toggleSubmenu = (label) => {
    setOpenSubmenus(prev => ({ ...prev, [label]: !prev[label] }));
  };

  // UI State & effects
  useEffect(() => {
    // Always close drawer when location changes
    setMobileOpen(false);
  }, [location.pathname]);

  const [anchorEl, setAnchorEl] = useState(null);
  const handleUserMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleUserMenuClose = () => setAnchorEl(null);

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryRows, setSummaryRows] = useState([]);
  const [feeYear, setFeeYear] = useState(new Date().getFullYear());
  
  const [adsOpen, setAdsOpen] = useState(false);
  const [adsSlots, setAdsSlots] = useState([]);
  const [adText, setAdText] = useState('');
  const [adLink, setAdLink] = useState('');
  const [adMediaType, setAdMediaType] = useState('image');
  const [adSlot, setAdSlot] = useState('slot1');
  const [selectedSchoolIds, setSelectedSchoolIds] = useState([String(id || '')]);
  const [adMediaDataUrl, setAdMediaDataUrl] = useState('');
  const [adMediaFile, setAdMediaFile] = useState(null);
  const [savingAd, setSavingAd] = useState(false);

  useEffect(() => {
    if (id) {
      setSelectedSchoolIds([String(id)]);
    }
  }, [id]);

  const handleAdsFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAdMediaFile(file);
    setAdMediaDataUrl(URL.createObjectURL(file));
  };

  const saveAds = async () => {
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
      else if (adMediaDataUrl) form.append('media_data_url', adMediaDataUrl);

      await api.post(`/api/ads/`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000 // 5 minutes timeout for large video/media uploads
      });
      await loadAdsFromApi(id);
      setAdsOpen(false);
      setAdText(''); setAdLink(''); setAdMediaDataUrl(''); setAdMediaFile(null);
      toast.success('বিজ্ঞাপন সফলভাবে সংরক্ষণ করা হয়েছে');
    } catch (err) {
      console.error("Error saving ad:", err);
      toast.error('বিজ্ঞাপন সংরক্ষণ করা যায়নি');
    } finally {
      setSavingAd(false);
    }
  };

  const removeAd = async (adId) => {
    if (!adId) return;
    try {
      await api.delete(`/api/ads/${adId}/`);
      await loadAdsFromApi(id);
      toast.success('বিজ্ঞাপন মুছে ফেলা হয়েছে');
    } catch (err) {
      console.error("Error removing ad:", err);
      toast.error('বিজ্ঞাপন মোছা যায়নি');
    }
  };

  const loadInitialData = useCallback(async () => {
    if (!id || authLoading) return;
    console.log('🏫 SchoolDashboard: Loading initial data for school', id);

    // Check for cached data first to show it immediately
    const isSimple = localStorage.getItem(`dashboardSimpleDue:${id}`) === 'on';
    const cachedStats = localStorage.getItem(`dashboard_stats_${id}`);

    if (cachedStats) {
      try {
        const parsed = JSON.parse(cachedStats);
        setStats(parsed);
        // If we have cached stats, don't show full page loading
        setLoading(false);
      } catch (e) {
        console.warn("Failed to parse cached stats", e);
      }
    } else {
      setLoading(true);
    }

    setError(null);
    try {
      setCurrentSchoolId(id);
      const schoolRes = await api.get(`/api/schools/${id}/`);
      setSchoolData(schoolRes.data);

      const statsRes = await getDashboardStats(id, feeYear, isSimple);
      setStats(statsRes);
    } catch (err) {
      console.error("Dashboard error:", err);
      if (!cachedStats) {
         setError("ইন্টারনেট সংযোগ নেই এবং কোনো ক্যাশ করা ডাটা পাওয়া যায়নি।");
      }
    } finally {
      setLoading(false);
    }
  }, [id, authLoading, feeYear]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Handle coming back online
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 App back online, syncing and refreshing data...');
      loadInitialData();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [loadInitialData]);

  useEffect(() => {
    if (!id || authLoading) return;
    const uname = (user?.username || '').toLowerCase();
    const isShamirOrUmor = uname === 'shamir' || uname === 'umor';
    const userSchoolId = String(user?.profile?.school_id || '');

    if (!user?.is_superuser && !uname.includes('bdadmin')) {
      if (isShamirOrUmor && String(id) !== '16') {
        setError('দুঃখিত, আপনি এই স্কুলে প্রবেশের জন্য অনুমোদিত ব্যক্তি নন।');
        setTimeout(() => navigate('/school/16'), 2000);
        return;
      }
      if (userSchoolId && String(userSchoolId) !== String(id)) {
        setError('দুঃখিত, আপনি এই স্কুলে প্রবেশের জন্য অনুমোদিত ব্যক্তি নন।');
        setTimeout(() => navigate(`/school/${userSchoolId}`), 2000);
        return;
      }
    }
  }, [id, user, navigate, authLoading]);

  useEffect(() => {
    api.get('/api/schools/')
      .then(res => setSchoolsList(Array.isArray(res.data) ? res.data : (res.data?.results || [])))
      .catch(err => console.error("Error loading schools list:", err));
  }, []);

  const loadAdsFromApi = useCallback(async (schoolId) => {
    try {
      const resp = await api.get(`/api/ads/`, { params: { school: schoolId } });
      const data = Array.isArray(resp.data) ? resp.data : (resp.data?.results || []);
      const normalized = data.map(item => ({
        id: item.id,
        text: item.text || '',
        link: item.link || '',
        type: (item.type || 'image').toLowerCase(),
        src: item.media || item.media_url || ''
      })).filter(a => a.src);

      setAdsSlots(normalized);
      return true;
    } catch (err) {
      console.error("Error loading ads:", err);
      return false;
    }
  }, []);

  useEffect(() => {
    loadAdsFromApi(id);
  }, [id, loadAdsFromApi]);

  const generateSummary = useCallback(async () => {
    if (!id) return;
    setSummaryLoading(true);
    try {
      const res = await api.get(`/api/results/overall/dashboard_result_summary/`, {
        params: { school: id }
      });
      setSummaryRows(res.data || []);
    } catch (err) {
      console.error("Error summary:", err);
    } finally {
      setSummaryLoading(false);
    }
  }, [id]);

  useEffect(() => { generateSummary(); }, [generateSummary]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const renderDashboardContent = () => {
    if (loading) return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: 2 }}>
        <CircularProgress size={50} />
        <Typography variant="h6" color="primary" sx={{ fontFamily: "'Hind Siliguri', sans-serif" }}>লোড হচ্ছে, দয়া করে অপেক্ষা করুন...</Typography>
      </Box>
    );

    if (error) return (
      <Paper sx={{ p: 4, textAlign: 'center', color: 'error.main' }}>
        <Typography variant="h6">{error}</Typography>
        <Button onClick={() => window.location.reload()} sx={{ mt: 2 }}>পুনরায় চেষ্টা করুন</Button>
      </Paper>
    );

    const baseItems = filteredMenuItems.filter(item => !(item.key === 'profile' || item.key === 'assistant'));
    const displayedItems = baseItems;

    return (
      <Box>
        {/* মেইন মেনু গ্রিড */}
        {isMainDashboard && (
          <Box sx={{
            mb: 6,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 4,
            px: { xs: 1, sm: 4 },
            background: 'radial-gradient(circle at top right, rgba(59, 130, 246, 0.02), transparent)',
            width: '100%',
            boxSizing: 'border-box',
            overflowX: 'hidden'
          }}>
            <Box sx={{ textAlign: 'center', mb: 6 }}>
              <Typography variant="h2" sx={{
                fontWeight: '900',
                mb: 1,
                background: 'linear-gradient(45deg, #1e3a8a 30%, #3b82f6 90%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontFamily: "'Hind Siliguri', sans-serif",
                fontSize: { xs: '2.2rem', sm: '3.2rem' }
              }}>
                {schoolData?.bn_name || schoolData?.name || 'স্কুল মেনু'}
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ fontFamily: "'Hind Siliguri', sans-serif", opacity: 0.8 }}>
                আপনার কাঙ্খিত অপশনটি নির্বাচন করুন
              </Typography>
            </Box>

            <Grid container spacing={2} sx={{ width: '100%', m: 0 }}>
              {displayedItems.map((item, idx) => (
                <Grid key={idx} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                  <Card
                    onClick={() => {
                      if (item.label === 'ড্যাশবোর্ড প্যানেল') {
                          navigate(`/school/${id}/dashboard-stats`);
                      } else if (item.key !== undefined) {
                          navigate(`/school/${id}/${item.key}`);
                      } else if (item.subItems && item.subItems.length > 0) {
                          // যদি সাব-আইটেম থাকে তবে প্রথমটিতে অথবা কোথাও নেভিগেট করতে হবে
                          // বা ড্রয়ার ওপেন করা যেতে পারে। আগের মত সব মেনু সরাসরি দেখালে এটাই ভালো।
                          toggleSubmenu(item.label);
                          setMobileOpen(true);
                      }
                    }}
                    sx={{
                      height: 110,
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      px: 2,
                      cursor: 'pointer',
                      borderRadius: 3,
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'all 0.3s ease',
                      background: '#ffffff',
                      border: '1px solid #eef2f6',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                      '&:hover': {
                        transform: 'translateY(-3px)',
                        boxShadow: '0 8px 16px rgba(30, 58, 138, 0.08)',
                        borderColor: 'primary.main',
                        '& .icon-box': {
                          color: 'primary.main',
                          transform: 'scale(1.1)'
                        }
                      }
                    }}
                  >
                    <Box
                      className="icon-box"
                      sx={{
                        color: 'primary.main',
                        mr: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.3s ease',
                        '& svg': { fontSize: 28 },
                        '& img': { width: 28, height: 28, objectFit: 'contain' }
                      }}
                    >
                      {item.icon}
                    </Box>
                    <Box sx={{ flexGrow: 1, textAlign: 'left', overflow: 'hidden' }}>
                      <Typography variant="h6" sx={{
                        fontWeight: '700',
                        fontFamily: "'Hind Siliguri', sans-serif",
                        color: '#2d3748',
                        fontSize: '0.95rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {item.label}
                      </Typography>
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* STATS SECTION - Always show if not loading/error */}
        <Paper elevation={3} sx={{ p: 3, mb: 4, borderRadius: 2, background: 'linear-gradient(135deg, #1976d2 0%, #64b5f6 100%)', color: 'white' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>{schoolData?.name || 'স্কুল ড্যাশবোর্ড'}</Typography>
              <Typography variant="subtitle1">{schoolData?.address || 'স্বাগতম স্কুল ম্যানেজমেন্ট ড্যাশবোর্ডে'}</Typography>
            </Box>
            <AdCarousel ads={adsSlots} schoolLogo={schoolData?.logo} schoolName={schoolData?.name} onAddAdClick={isSuperUser ? () => setAdsOpen(true) : undefined} />
          </Stack>
        </Paper>

        <StatCardsSection stats={stats} isTeacher={isTeacher} isSuperUser={isSuperUser} role={role} />

        <ResultSummaryTable
          summaryRows={summaryRows}
          loading={summaryLoading}
        />

        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardHeader title="শ্রেণি বণ্টন" />
              <CardContent sx={{ height: 350 }}><ClassDistributionChart classDistribution={stats?.class_distribution || []} /></CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardHeader title="হাজিরা সংক্ষিপ্তসার" />
              <CardContent>
                <AttendanceChart attendanceData={stats?.attendance_data || []} />
                {stats?.attendance_absent_by_class_today?.length > 0 && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>আজকের ক্লাসভিত্তিক অনুপস্থিতি:</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {stats.attendance_absent_by_class_today.map((row, i) => (
                        <Chip key={i} size="small" label={`${row.class_name}: ${row.absent}`} variant="outlined" />
                      ))}
                    </Stack>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
          {canAccessFeesAndCollection(user) && (
            <Grid size={{ xs: 12 }}>
              <Card>
                <CardHeader
                  title="ফি সংগ্রহের অবস্থা"
                  action={
                    <TextField select size="small" label="সাল" value={feeYear} onChange={(e) => setFeeYear(e.target.value)} sx={{ minWidth: 100 }}>
                      {[0,1,2].map(i => <MenuItem key={i} value={new Date().getFullYear()-i}>{new Date().getFullYear()-i}</MenuItem>)}
                    </TextField>
                  }
                />
                <CardContent>
                  <FeeCollectionChart feeData={stats?.fee_collection || []} feeDuesSummary={stats?.fee_dues_summary} feeDuesByClass={stats?.fee_dues_by_class} />
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </Box>
    );
  };

  return (
    <Box sx={{ display: "flex", minHeight: '100vh', bgcolor: '#f8f9fa' }}>
      <CssBaseline />
      <style>{`
        @media print {
          /* Reset root dashboard constraints to allow sub-pages to handle printing */
          body, html, #root {
            height: auto !important;
            overflow: visible !important;
            display: block !important;
          }
          .no-print { display: none !important; }
          main {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <AppBar position="fixed" className="no-print" sx={{
        width: '100%',
        background: 'linear-gradient(90deg, #1e3a8a 0%, #3b82f6 100%)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        zIndex: (theme) => theme.zIndex.drawer + 1
      }}>
        <Toolbar sx={{ px: { xs: 0.5, sm: 2 } }}>
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <IconButton color="inherit" edge="start" onClick={handleDrawerToggle}>
              <MenuIcon />
            </IconButton>
            <IconButton color="inherit" onClick={() => navigate(-1)} sx={{ display: isMainDashboard ? 'none' : 'inline-flex' }}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <IconButton color="inherit" onClick={() => navigate('/')}>
              <HomeIcon fontSize="small" />
            </IconButton>
            <Stack direction="row" spacing={1} alignItems="center" onClick={() => navigate(`/school/${id}`)} sx={{ cursor: 'pointer', py: 0.5 }}>
              {schoolData?.logo && (
                <Box component="img" src={getMediaUrl(schoolData.logo)} sx={{ width: { xs: 28, sm: 40 }, height: { xs: 28, sm: 40 }, borderRadius: '8px', bgcolor: '#fff', p: 0.5 }} />
              )}
              <Typography variant="h6" noWrap sx={{
                fontWeight: '900',
                fontSize: { xs: '0.9rem', sm: '1.2rem' },
                maxWidth: { xs: '120px', sm: '100%' },
                lineHeight: 1.5,
                pt: 0.5
              }}>
                {schoolData?.bn_name || schoolData?.name || 'Dashboard'}
              </Typography>
            </Stack>

            {/* Login/User Icon moved here - 20px after school name */}
            <Box sx={{ ml: '20px', display: 'flex', alignItems: 'center' }}>
              {user ? (
                <>
                  <IconButton onClick={handleUserMenuOpen} color="inherit" sx={{ p: 0.5 }}>
                    <Avatar src={user?.photo_url || user?.photo} sx={{ width: { xs: 30, sm: 36 }, height: { xs: 30, sm: 36 }, border: '2px solid #fff' }} />
                  </IconButton>
                  <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleUserMenuClose}>
                    <MuiMenuItem onClick={() => { handleUserMenuClose(); navigate(`/school/${id}/profile`); }}>প্রোফাইল</MuiMenuItem>
                    {isSuperUser && <MuiMenuItem onClick={() => { handleUserMenuClose(); setAdsOpen(true); }}>বিজ্ঞাপন</MuiMenuItem>}
                    <Divider />
                    <MuiMenuItem onClick={logout} sx={{ color: 'error.main' }}>লগআউট</MuiMenuItem>
                  </Menu>
                </>
              ) : (
                <Button color="inherit" size="small" onClick={() => navigate('/login')} sx={{ bgcolor: '#fff', color: '#1e3a8a', fontWeight: 'bold', minWidth: 'auto', px: 1.5 }}>লগইন</Button>
              )}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', px: 1 }}>
          </Box>

          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: 0 }}>
            {/* Right side is now empty or can be used for other things */}
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: 'block',
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: 'none',
            boxShadow: '2px 0 10px rgba(0,0,0,0.05)',
            bgcolor: '#ffffff',
          }
        }}
      >
        <Toolbar />
        <List sx={{ px: 1.5, py: 2 }}>
          <Box sx={{ p: 2 }}>
             <Button
                fullWidth
                variant="contained"
                startIcon={<HomeIcon />}
                onClick={() => navigate(`/school/${id}`)}
                sx={{
                  borderRadius: 2,
                  mb: 2,
                  background: 'linear-gradient(90deg, #1e3a8a 0%, #3b82f6 100%)',
                  fontWeight: 'bold',
                  fontFamily: "'Hind Siliguri', sans-serif"
                }}
             >
                মেইন মেনু
             </Button>
             <Divider />
          </Box>
          {filteredMenuItems.map((item, i) => (
            <React.Fragment key={i}>
              {item.subItems ? (
                <>
                  <ListItemButton
                    onClick={() => toggleSubmenu(item.label)}
                    sx={{
                      borderRadius: 2,
                      mb: 0.5,
                      py: 1.5,
                      px: { xs: 1, sm: 2 } // Reduce padding on mobile
                    }}
                  >
                    {item.icon && (
                      <ListItemIcon sx={{
                        minWidth: { xs: 30, sm: 40 }, // Reduce icon width on mobile
                        color: 'primary.main'
                      }}>
                        {item.icon}
                      </ListItemIcon>
                    )}
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontWeight: 600,
                        fontSize: { xs: '0.85rem', sm: '1rem' } // Smaller font on mobile
                      }}
                    />
                    {openSubmenus[item.label] ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                  </ListItemButton>
                  <Collapse in={openSubmenus[item.label]} timeout="auto">
                    <List component="div" disablePadding sx={{ pl: 2 }}>
                      {item.subItems.map((sub, j) => (
                        <ListItemButton
                          key={j}
                          onClick={() => navigate(`/school/${id}/${sub.key}`)}
                          selected={location.pathname === `/school/${id}/${sub.key}`}
                          sx={{
                            borderRadius: 2,
                            mb: 0.5,
                            px: { xs: 1, sm: 2 }, // Reduce padding on mobile
                            "&.Mui-selected": { bgcolor: 'primary.light', color: 'white', "& .MuiListItemIcon-root": { color: 'white' } }
                          }}
                        >
                          {sub.icon && (
                            <ListItemIcon sx={{
                              minWidth: { xs: 28, sm: 35 }, // Gain space
                              color: 'primary.main',
                              fontSize: '1.1rem'
                            }}>
                              {sub.icon}
                            </ListItemIcon>
                          )}
                          <ListItemText
                            primary={sub.label}
                            primaryTypographyProps={{
                              fontSize: { xs: '0.75rem', sm: '0.85rem' } // Smaller font for sub-items on mobile
                            }}
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  </Collapse>
                </>
              ) : (
                <ListItemButton
                  onClick={() => navigate(`/school/${id}/${item.key}`)}
                  selected={location.pathname === `/school/${id}/${item.key}`}
                  sx={{ borderRadius: 2, mb: 0.5, py: 1.5, "&.Mui-selected": { bgcolor: 'primary.light', color: 'white', "& .MuiListItemIcon-root": { color: 'white' } } }}
                >
                  {item.icon && <ListItemIcon sx={{ minWidth: 40, color: 'primary.main' }}>{item.icon}</ListItemIcon>}
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 600 }} />
                </ListItemButton>
              )}
              {item.divider && <Divider sx={{ my: 1 }} />}
            </React.Fragment>
          ))}
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1, sm: 3 },
          mt: { xs: 8, sm: 9 },
          minHeight: '100vh',
          bgcolor: '#f8f9fa',
          ml: 0,
          width: '100%',
          minWidth: 0,
          overflowX: 'auto',
          position: 'relative'
        }}
      >
        <div className="print-content-wrapper">
          <React.Suspense fallback={
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 2 }}>
              <CircularProgress />
              <Typography>পৃষ্ঠা লোড হচ্ছে...</Typography>
            </Box>
          }>
            {isMainDashboard ? renderDashboardContent() : <Outlet />}
          </React.Suspense>
        </div>
      </Box>

      <Dialog open={adsOpen} onClose={() => setAdsOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>
          বিজ্ঞাপন আপলোড ও ব্যবস্থাপনা
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="বিজ্ঞাপনের শিরোনাম / লেখা"
              size="small"
              fullWidth
              value={adText}
              onChange={(e) => setAdText(e.target.value)}
            />
            <TextField
              label="ওয়েবসাইট / লিংক (Optional)"
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
              <InputLabel id="sd-schools-label">স্কুল নির্বাচন করুন (একাধিক বা গ্লোবাল)</InputLabel>
              <Select
                labelId="sd-schools-label"
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
                  return selected.map(sid => schoolsList.find(s => String(s.id) === String(sid))?.name || sid).join(', ');
                }}
              >
                <MenuItem value="all">
                  <Checkbox checked={selectedSchoolIds.includes('all')} />
                  <ListItemText primary="সকল স্কুল (গ্লোবাল বিজ্ঞাপন)" />
                </MenuItem>
                {schoolsList.map((s) => (
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
                onChange={handleAdsFile}
              />
            </Button>
            {adMediaDataUrl && (
              <Box sx={{ mt: 1, textAlign: 'center' }}>
                {adMediaType === 'video' ? (
                  <Box component="video" src={adMediaDataUrl} controls sx={{ maxHeight: 150, maxWidth: '100%', borderRadius: 2 }} />
                ) : (
                  <Box component="img" src={adMediaDataUrl} alt="Preview" sx={{ maxHeight: 150, maxWidth: '100%', borderRadius: 2 }} />
                )}
              </Box>
            )}

            {adsSlots.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  বর্তমান বিজ্ঞাপনসমূহ ({adsSlots.length})
                </Typography>
                <Stack spacing={1} sx={{ maxHeight: 200, overflowY: 'auto' }}>
                  {adsSlots.map((ad, idx) => {
                    const slotNames = { slot1: 'প্রকাশনা', slot2: 'কর্পোরেট পার্টনার', slot3: 'ব্র্যান্ড ও সেবা' };
                    return (
                      <Stack key={ad.id || idx} direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ p: 1, border: '1px solid #ddd', borderRadius: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
                          <Box
                            component={ad.type === 'video' ? 'video' : 'img'}
                            src={getMediaUrl(ad.src)}
                            sx={{ width: 40, height: 40, borderRadius: 1, objectFit: 'cover' }}
                          />
                          <Box sx={{ overflow: 'hidden' }}>
                            <Typography variant="body2" noWrap fontWeight="bold">{ad.text || 'বিজ্ঞাপন'}</Typography>
                            <Chip label={slotNames[ad.slot] || 'প্রকাশনা'} size="small" color="primary" sx={{ fontSize: '0.65rem', height: 18 }} />
                          </Box>
                        </Box>
                        <Button size="small" color="error" variant="outlined" onClick={() => removeAd(ad.id)}>
                          মুছুন
                        </Button>
                      </Stack>
                    );
                  })}
                </Stack>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAdsOpen(false)}>বাতিল</Button>
          <Button variant="contained" onClick={saveAds} disabled={savingAd || (!adMediaFile && !adMediaDataUrl)}>
            {savingAd ? 'সংরক্ষণ হচ্ছে...' : 'বিজ্ঞাপন সেভ করুন'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SchoolDashboard;
