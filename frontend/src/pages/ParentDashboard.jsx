import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Stack,
  Divider,
  Chip,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  CircularProgress,
  Alert,
  Avatar,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  AppBar,
  Toolbar,
  Container
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  CalendarMonth as CalendarIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  ReceiptLong as ReceiptLongIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import { useNotifications } from '../context/NotificationContext';
import dayjs from 'dayjs';
import 'dayjs/locale/bn';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { styled } from '@mui/material/styles';
import { getMediaUrl, resolveStudentPhoto } from '../utils/media';

const toBnDigits = (s) => String(s).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);
const monthYearBn = `${dayjs().locale('bn').format('MMMM')} ${toBnDigits(dayjs().format('YYYY'))} ইং`;

const MONTHS_BN = ['জানুয়ারী','ফেব্রুয়ারী','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগষ্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];

const HeaderCard = styled(Paper)(({ theme }) => ({
  background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)',
  color: 'white',
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  borderRadius: theme.shape.borderRadius * 2,
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '" "',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: 'radial-gradient(circle at 90% 10%, rgba(255,255,255,0.1) 0%, transparent 20%)',
    pointerEvents: 'none',
  },
}));

const StyledAvatar = styled(Avatar)(({ theme }) => ({
  width: 100,
  height: 100,
  border: '4px solid white',
  boxShadow: theme.shadows[4],
  marginRight: theme.spacing(3),
  [theme.breakpoints.down('sm')]: {
    width: 80,
    height: 80,
    marginRight: 0,
    marginBottom: theme.spacing(2),
  },
}));

const SchoolLogo = styled('img')(({ theme }) => ({
  maxHeight: 80,
  maxWidth: 200,
  objectFit: 'contain',
  [theme.breakpoints.down('sm')]: {
    maxHeight: 60,
  },
}));

const ParentDashboard = () => {
  const { id, parentId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { addNotification } = useNotifications();
  const reportRef = useRef();
  const { user, isAuthenticated } = useAuth();

  // State
  const [parentInfo, setParentInfo] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [selectedTab, setSelectedTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [resultData, setResultData] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [absentDates, setAbsentDates] = useState([]);
  const [absentLoading, setAbsentLoading] = useState(false);
  const [feesData, setFeesData] = useState(null);
  const [schoolInfo, setSchoolInfo] = useState(null);
  const [feesLoading, setFeesLoading] = useState(false);
  const [feeTotals, setFeeTotals] = useState({ amount: 0, paid: 0, due: 0 });
  const [bkashForm, setBkashForm] = useState({ date: '', amount: '', from: '', method: 'BKASH', note: '' });
  const [bkashSubmitting, setBkashSubmitting] = useState(false);
  const [bkashSubmitted, setBkashSubmitted] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [removingStudentId, setRemovingStudentId] = useState(null);

  // Helper functions
  const getStructureLabel = useCallback((s, fallback) => {
    if (!s) return fallback;
    const { frequency, category, name, title, label, month, type, month_no, month_number, exam_code, exam_type, exam, _month_inferred } = s;
    const freq = String(frequency || '').toLowerCase();
    const catName = (category && (category.name || category.title)) || type || '';
    const m = Number(month || month_no || month_number || _month_inferred || 0);
    const rawName = String(name || title || label || '').toLowerCase();
    let examStr = String(exam_code || exam_type || exam || '').toLowerCase();
    if (!examStr) {
      if (/annual|final|বার্ষিক/.test(rawName)) examStr = 'annual';
      else if (/half|half_yearly|mid|অর্ধ/.test(rawName)) examStr = 'half';
      else if (/session|সেশন/.test(rawName)) examStr = 'session';
      else if (/monthly|মাসিক/.test(rawName)) examStr = 'monthly';
      else if (/exam|পরীক্ষা/.test(rawName)) examStr = 'exam';
    }

    const isTuition = String(catName || '').toLowerCase().includes('tuition') || freq === 'monthly';
    if (isTuition) {
      if (m >= 1 && m <= 12) return `মাসিক বেতন(${MONTHS_BN[m - 1]})`;
      return 'মাসিক বেতন';
    }

    if (freq === 'one_time' || String(catName).toLowerCase().includes('exam')) {
      let typeBn = 'পরীক্ষা';
      if (['half','half_yearly','mid'].includes(examStr)) typeBn = 'অর্ধ-বার্ষিকী';
      else if (['annual','final'].includes(examStr)) typeBn = 'বার্ষিক';
      else if (['session'].includes(examStr)) typeBn = 'সেশন';
      else if (['test','monthly'].includes(examStr)) typeBn = 'মাসিক';
      return `পরীক্ষার ফি(${typeBn})`;
    }

    return catName || fallback || 'ফি';
  }, []);

  // Data Fetching Functions
  const loadSchoolInfo = useCallback(async () => {
    try {
      const res = await api.get(`/api/schools/${id}/`);
      setSchoolInfo(res.data);
    } catch (error) {
      console.error('Failed to load school info:', error);
    }
  }, [id]);

  const loadFeesData = useCallback(async () => {
    if (!selectedChild) return;

    try {
      setFeesLoading(true);
      const [assignmentsRes, paymentsRes, feeStructuresRes] = await Promise.allSettled([
        api.get(`/api/fees/assignments/?student_id=${selectedChild.id}`),
        api.get(`/api/fees/payments/?student=${selectedChild.id}`),
        api.get(`/api/fees/fees/?classroom=${selectedChild.classroom?.id || ''}`)
      ]);

      let feeStructures = [];
      if (feeStructuresRes.status === 'fulfilled' && feeStructuresRes.value?.data) {
        const data = feeStructuresRes.value.data;
        feeStructures = Array.isArray(data) ? data : (data.results || data.data || []);
      }

      let assignments = [];
      if (assignmentsRes.status === 'fulfilled' && assignmentsRes.value?.data) {
        const data = assignmentsRes.value.data;
        assignments = Array.isArray(data) ? data : (data.results || data.data || []);
      }

      if (assignments.length === 0 && feeStructures.length > 0) {
        assignments = feeStructures.map(struct => ({
          id: `struct-${struct.id || Math.random()}`,
          fee_structure: struct,
          amount: struct.amount || 0,
          custom_amount: null, discount_amount: 0, discount_percentage: 0, due_date: null
        }));
      }

      let payments = [];
      if (paymentsRes.status === 'fulfilled' && paymentsRes.value?.data) {
        const data = paymentsRes.value.data;
        payments = Array.isArray(data) ? data : (data.results || data.data || []);
      }
      const sidStr = String(selectedChild.id);
      payments = (payments || []).filter(p => {
        const sid = p.student_id ?? p.studentId ?? (p.student?.id || p.student);
        return sid ? String(sid) === sidStr : false;
      });

      const sumByAssign = {};
      for (const pay of payments) {
        if ((pay.payment_status || pay.status || '').toLowerCase() === 'completed') {
          const aid = String(pay.assignment_id || pay.assignment || '');
          if (aid) sumByAssign[aid] = (sumByAssign[aid] || 0) + Number(pay.amount || 0);
        }
      }

      const feeRows = assignments.map(a => {
        const struct = a.fee_structure || {};
        const amount = parseFloat(a.custom_amount ?? a.amount ?? struct.amount ?? 0);
        const paid = parseFloat(sumByAssign[String(a.id)] || 0);
        return {
          id: a.id,
          name: getStructureLabel(struct, struct.name || 'ফি'),
          amount, paid, due: Math.max(0, amount - paid), due_date: a.due_date
        };
      });

      const formattedPayments = payments.map(p => ({
        id: p.id || Math.random(),
        date: p.payment_date || p.date || dayjs().format('YYYY-MM-DD'),
        amount: parseFloat(p.amount || 0),
        description: p.purpose || p.note || 'ফি পরিশোধ',
        payment_method: p.payment_method || 'নগদ',
        status: (p.status || 'completed').toLowerCase(),
        reference: p.reference || ''
      }));
      
      const monthlyFees = feeRows.filter(row => row.name.includes('মাসিক বেতন'));
      const examFees = feeRows.filter(row => !row.name.includes('মাসিক বেতন'));
      
      const currentMonthNum = parseInt(dayjs().format('M'), 10);
      const currentMonthNameBn = MONTHS_BN[currentMonthNum - 1];
      const currentMonthFeeData = monthlyFees.find(row => row.name.includes(currentMonthNameBn)) || { amount: 0, paid: 0 };

      const totalFeesAmount = feeRows.reduce((sum, row) => sum + (row.amount || 0), 0);
      const totalPaidAmount = feeRows.reduce((sum, row) => sum + (row.paid || 0), 0);

      setFeeTotals({ amount: totalFeesAmount, paid: totalPaidAmount, due: Math.max(0, totalFeesAmount - totalPaidAmount) });
      setFeesData({
        monthly_fees: monthlyFees, exam_fees: examFees,
        current_month: {
          name: currentMonthNameBn,
          total_amount: currentMonthFeeData.amount,
          paid_amount: currentMonthFeeData.paid,
          due_amount: Math.max(0, currentMonthFeeData.amount - currentMonthFeeData.paid),
          status: currentMonthFeeData.paid >= currentMonthFeeData.amount ? 'paid' : 'unpaid'
        },
        payments: formattedPayments
      });
    } catch (error) {
      console.error('Error in loadFeesData:', error);
    } finally {
      setFeesLoading(false);
    }
  }, [selectedChild, getStructureLabel]);

  const loadAbsentDatesForMonth = useCallback(async (monthStr) => {
    try {
      setAbsentLoading(true);
      const [year, month] = monthStr.split('-').map(n => parseInt(n, 10));
      const daysCount = dayjs(`${monthStr}-01`).daysInMonth();
      const dates = Array.from({ length: daysCount }, (_, i) => dayjs(new Date(year, month - 1, i + 1)).format('YYYY-MM-DD'));

      const requests = dates.map(d => api.get(`/api/attendance/records/?school=${id}&student=${selectedChild.id}&date=${d}`)
        .then(r => ({ date: d, records: Array.isArray(r.data) ? r.data : (r.data?.results || []) }))
        .catch(() => ({ date: d, records: [] }))
      );

      const results = await Promise.allSettled(requests);
      const absents = results
        .filter(r => r.status === 'fulfilled' && r.value.records[0]?.present === false)
        .map(r => r.value.date);
      setAbsentDates(absents);
    } finally {
      setAbsentLoading(false);
    }
  }, [id, selectedChild]);

  const loadAttendanceData = useCallback(async () => {
    try {
      const currentMonth = dayjs().format('YYYY-MM');
      const res = await api.get(`/api/attendance/records/monthly_report/?school=${id}&month=${currentMonth}&classroom=${selectedChild.classroom?.id}`);
      const studentData = res.data?.find(r => r.student_id === selectedChild.id);
      setAttendanceData(studentData || null);
      await loadAbsentDatesForMonth(currentMonth);
    } catch (error) {
      setAttendanceData(null);
      setAbsentDates([]);
    }
  }, [id, selectedChild, loadAbsentDatesForMonth]);

  const loadLatestResult = useCallback(async () => {
    try {
      const res = await api.get(`/api/results/results/?student=${selectedChild.id}`);
      const dataArr = Array.isArray(res.data) ? res.data : (res.data.results || []);
      if (dataArr.length > 0) {
        const examMap = {};
        dataArr.forEach(result => {
          const examId = result.examination?.id;
          if (!examMap[examId]) examMap[examId] = { examination: result.examination, results: [] };
          examMap[examId].results.push(result);
        });
        const examsArr = Object.values(examMap);
        const latest = examsArr.sort((a, b) => new Date(b.examination?.exam_date || 0) - new Date(a.examination?.exam_date || 0))[0];
        setResultData(latest);
      } else { setResultData(null); }
    } catch (error) { setResultData(null); }
  }, [selectedChild]);

  const loadChildData = useCallback(async () => {
    if (!selectedChild) return;
    if (selectedTab === 0) await loadAttendanceData();
    else if (selectedTab === 1) await loadLatestResult();
    else if (selectedTab === 2) await loadFeesData();
  }, [selectedChild, selectedTab, loadAttendanceData, loadLatestResult, loadFeesData]);

  const loadParentData = useCallback(async () => {
    setLoading(true);
    try {
      const parentRes = await api.get(`/api/users/parents/${parentId}/`);
      setParentInfo(parentRes.data);
      const parentUserId = parentRes.data.user?.id;
      
      if (!parentUserId) {
        toast.error('Parent user information not found');
        setLoading(false);
        return;
      }
      
      let childrenData = [];
      const profileChildren = parentRes.data.children || [];
      if (profileChildren.length) {
        const detailed = await Promise.all(profileChildren.map(async (c) => {
          try {
            const r = await api.get(`/api/academics/students/${c.id}/`);
            return r.data;
          } catch (_) { return null; }
        }));
        childrenData = detailed.filter(Boolean);
      }

      if (!childrenData.length) {
        const res = await api.get(`/api/academics/students/?guardian=${parentUserId}&school=${id}`);
        childrenData = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      }

      setChildren(childrenData);
      if (childrenData.length > 0) {
        setSelectedChild(childrenData[0]);
        setSelectedTab(0);
      }
    } catch (error) {
      toast.error('Failed to load parent data');
    } finally {
      setLoading(false);
    }
  }, [parentId, id, toast]);

  // Effects
  useEffect(() => {
    loadParentData();
    loadSchoolInfo();
  }, [loadParentData, loadSchoolInfo]);

  useEffect(() => {
    if (selectedChild) loadChildData();
  }, [selectedChild, selectedTab, loadChildData]);

  useEffect(() => {
    if (selectedTab === 2 && selectedChild) {
      loadFeesData();
      const interval = setInterval(() => loadFeesData(), 30000);
      return () => clearInterval(interval);
    }
  }, [selectedTab, selectedChild, loadFeesData]);

  // Event Handlers
  const handleOpenEditDialog = () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setRemovingStudentId(null);
  };

  const handleRemoveStudent = async (studentId) => {
    if (!studentId || !user?.id) return;
    try {
      setRemovingStudentId(studentId);
      await api.delete(`/api/academics/students/${studentId}/remove_guardian/`, { data: { guardian_id: user.id } });
      setChildren(prev => prev.filter(c => c.id !== studentId));
      if (selectedChild?.id === studentId) setSelectedChild(children.find(c => c.id !== studentId) || null);
      toast.success('শিক্ষার্থী সফলভাবে অপসারণ করা হয়েছে');
    } catch (error) {
      toast.error('শিক্ষার্থী অপসারণ করতে ব্যর্থ হয়েছে');
    } finally {
      setRemovingStudentId(null);
    }
  };

  const submitBkashPayment = async () => {
    if (!selectedChild || !bkashForm.amount || !bkashForm.from) {
      toast.error('অনুগ্রহ করে সঠিক তথ্য দিন');
      return;
    }
    setBkashSubmitting(true);
    try {
      const paymentData = {
        student_id: selectedChild.id,
        amount: parseFloat(bkashForm.amount),
        payment_date: bkashForm.date ? dayjs(bkashForm.date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        payment_method: 'mobile_banking',
        payment_status: 'pending',
        reference: `Sender: ${bkashForm.from}${bkashForm.note ? ` | Note: ${bkashForm.note}` : ''}`
      };
      await api.post('/api/fees/payments/', paymentData);
      setBkashSubmitted(true);
      setBkashForm({ date: '', amount: '', from: '', method: 'BKASH', note: '' });
      toast.success('পেমেন্ট রিকোয়েস্ট সফলভাবে পাঠানো হয়েছে');

      addNotification({
        title: 'নতুন পেমেন্ট রিকোয়েস্ট',
        message: `${selectedChild.display_name} - ${bkashForm.amount} টাকা`,
        type: 'payment',
        priority: 'high'
      });
    } catch (error) {
      toast.error('পেমেন্ট রিকোয়েস্ট পাঠাতে সমস্যা হয়েছে');
    } finally {
      setBkashSubmitting(false);
    }
  };

  const downloadPDF = async (type) => {
    if (!reportRef.current) return;
    toast.info('Generating PDF...');
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 10, imgWidth, imgHeight);
      pdf.save(`${selectedChild.user?.first_name}_${type}_${dayjs().format('YYYY-MM-DD')}.pdf`);
      toast.success('PDF downloaded!');
    } catch (error) {
      toast.error('Failed to generate PDF');
    }
  };

  const getGradeColor = (marks, total) => {
    const percentage = total > 0 ? (marks / total) * 100 : 0;
    if (percentage >= 80) return 'success';
    if (percentage >= 60) return 'warning';
    return 'error';
  };

  const getAttendanceColor = (percentage) => {
    if (percentage >= 90) return 'success';
    if (percentage >= 75) return 'primary';
    return 'error';
  };

  const parentName = parentInfo?.user ? `${parentInfo.user.first_name || ''} ${parentInfo.user.last_name || ''}`.trim() : 'Parent';

  return loading ? (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}><CircularProgress size={60} /></Box>
  ) : (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fa', pb: 5 }}>
      <AppBar position="static" color="inherit" elevation={1} sx={{ mb: 2, bgcolor: 'white' }}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} color="primary">Back</Button>
          {user && (
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{user.first_name || user.username}</Typography>
                <Typography variant="caption" color="text.secondary">ID: {user.username}</Typography>
              </Box>
              <Avatar src={user.photo_url || user.photo} sx={{ width: 32, height: 32 }} />
              <Button color="error" size="small" variant="outlined" onClick={() => { localStorage.removeItem('token'); window.location.href = '/login'; }}>লগআউট</Button>
            </Stack>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg">
        {/* Edit Profile Dialog */}
        <Dialog open={editDialogOpen} onClose={handleCloseEditDialog} fullWidth maxWidth="sm">
          <DialogTitle sx={{ textAlign: 'center', fontWeight: 'bold' }}>প্রোফাইল এডিট করুন</DialogTitle>
          <DialogContent dividers>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>লিঙ্ক করা শিক্ষার্থীরা</Typography>
            {children.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center">কোনো লিঙ্ক করা শিক্ষার্থী পাওয়া যায়নি</Typography>
            ) : (
              <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                {children.map((child) => (
                  <Box key={child.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, mb: 1, border: '1px solid #ddd', borderRadius: 1 }}>
                    <Box>
                      <Typography variant="subtitle2">{child.user?.first_name} {child.user?.last_name}</Typography>
                      <Typography variant="body2" color="text.secondary">শ্রেণি: {child.classroom?.name || 'N/A'} | রোল: {child.roll_number || 'N/A'}</Typography>
                    </Box>
                    <Button variant="outlined" color="error" size="small" disabled={removingStudentId === child.id} onClick={() => handleRemoveStudent(child.id)} startIcon={<DeleteIcon />}>
                      {removingStudentId === child.id ? 'অপসারণ হচ্ছে...' : 'অপসারণ'}
                    </Button>
                  </Box>
                ))}
              </Box>
            )}
          </DialogContent>
          <DialogActions><Button onClick={handleCloseEditDialog} variant="outlined">বন্ধ করুন</Button></DialogActions>
        </Dialog>

        {/* Header */}
        <Paper elevation={0} sx={{ mb: 3, p: 3, background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white', borderRadius: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={2}>
              <Avatar sx={{ width: 60, height: 60, bgcolor: 'white', color: 'primary.main', fontSize: '2rem' }}>{parentName.charAt(0).toUpperCase()}</Avatar>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>অভিভাবক ড্যাশবোর্ড</Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>আপনার সন্তানের হাজিরা, রেজাল্ট ও ফি দেখুন</Typography>
              </Box>
            </Stack>
            <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ bgcolor: 'white', color: 'primary.main' }}>অভিভাবক তালিকা</Button>
          </Stack>
        </Paper>

        {children.length === 0 ? (
          <Alert severity="info">এই অভিভাবকের সাথে কোনো ছাত্র/ছাত্রী যুক্ত নেই।</Alert>
        ) : (
          <>
            <Paper sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: 'primary.50' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>সন্তানের তালিকা ({children.length})</Typography>
              <Grid container spacing={2}>
                {children.map((child) => (
                  <Grid item xs={12} sm={6} md={4} key={child.id}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        border: selectedChild?.id === child.id ? '3px solid' : '1px solid #eee',
                        borderColor: selectedChild?.id === child.id ? 'primary.main' : 'transparent',
                        transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' }
                      }}
                      onClick={() => { setSelectedChild(child); toast.success(`Selected ${child.display_name}`); }}
                    >
                      <CardContent>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Avatar sx={{ bgcolor: 'primary.main' }}>{child.user?.first_name?.charAt(0)}</Avatar>
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>{child.display_name}</Typography>
                            <Typography variant="body2" color="text.secondary">শ্রেণি: {child.classroom?.name || 'N/A'}</Typography>
                          </Box>
                          {selectedChild?.id === child.id && <CheckCircleIcon color="primary" sx={{ ml: 'auto' }} />}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>

            {selectedChild && (
              <>
                <HeaderCard elevation={3}>
                  <Grid container alignItems="center" spacing={3}>
                    <Grid item><StyledAvatar src={resolveStudentPhoto(selectedChild)} /></Grid>
                    <Grid item xs>
                      <Typography variant="h4" sx={{ fontWeight: 600 }}>{selectedChild.display_name}</Typography>
                      <Typography variant="body1" sx={{ opacity: 0.8 }}>ID: {selectedChild.user?.username}</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Chip label={`রোল: ${selectedChild.roll_number || 'N/A'}`} sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
                        <Chip label={`শ্রেণি: ${selectedChild.classroom?.name || 'N/A'}`} sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
                      </Stack>
                    </Grid>
                    {schoolInfo?.logo && (
                      <Grid item sx={{ textAlign: 'center' }}>
                        <SchoolLogo src={getMediaUrl(schoolInfo.logo)} />
                        <Typography variant="subtitle2" sx={{ mt: 1 }}>{schoolInfo.name}</Typography>
                      </Grid>
                    )}
                  </Grid>
                </HeaderCard>

                <Paper sx={{ mb: 3, borderRadius: 2 }}>
                  <Tabs value={selectedTab} onChange={(e, v) => setSelectedTab(v)} variant="fullWidth">
                    <Tab icon={<CalendarIcon />} label="হাজিরা" iconPosition="start" />
                    <Tab icon={<AssessmentIcon />} label="রেজাল্ট" iconPosition="start" />
                    <Tab icon={<ReceiptLongIcon />} label="ফি" iconPosition="start" />
                  </Tabs>
                </Paper>

                <Stack direction="row" spacing={2} sx={{ mb: 3 }} justifyContent="center">
                  <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => downloadPDF(selectedTab === 0 ? 'Attendance' : selectedTab === 1 ? 'Result' : 'Fees')}>ডাউনলোড PDF</Button>
                  <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()}>প্রিন্ট</Button>
                </Stack>

                <Box ref={reportRef}>
                  {selectedTab === 0 && (
                    <Paper sx={{ p: 4 }}>
                      {attendanceData ? (
                        <>
                          <Typography variant="h6" gutterBottom>হাজিরা সারাংশ ({monthYearBn})</Typography>
                          <Grid container spacing={2} sx={{ mb: 3 }}>
                            <Grid item xs={6} sm={3}><Chip label={`মোট দিন: ${attendanceData.total_days}`} fullWidth /></Grid>
                            <Grid item xs={6} sm={3}><Chip label={`উপস্থিত: ${attendanceData.present_days}`} color="success" fullWidth /></Grid>
                            <Grid item xs={6} sm={3}><Chip label={`অনুপস্থিত: ${attendanceData.absent_days}`} color="error" fullWidth /></Grid>
                            <Grid item xs={6} sm={3}><Chip label={`${attendanceData.attendance_percentage}%`} color={getAttendanceColor(attendanceData.attendance_percentage)} fullWidth /></Grid>
                          </Grid>
                          <Divider sx={{ my: 2 }} />
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>অনুপস্থিত তারিখসমূহ:</Typography>
                          {absentLoading ? <CircularProgress size={24} /> : absentDates.length === 0 ? <Typography color="text.secondary">নেই</Typography> : (
                            <Stack direction="row" flexWrap="wrap" gap={1}>{absentDates.map(d => <Chip key={d} label={dayjs(d).format('DD MMM')} color="error" variant="outlined" />)}</Stack>
                          )}
                        </>
                      ) : <Alert severity="info">হাজিরার তথ্য পাওয়া যায়নি</Alert>}
                    </Paper>
                  )}

                  {selectedTab === 1 && (
                    <Paper sx={{ p: 4 }}>
                      {resultData ? (
                        <>
                          <Typography variant="h5" align="center" sx={{ fontWeight: 'bold', mb: 3 }}>পরীক্ষার ফলাফল কার্ড</Typography>
                          <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                              <TableHead sx={{ bgcolor: 'primary.main' }}>
                                <TableRow>
                                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>বিষয়</TableCell>
                                  <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>নম্বর</TableCell>
                                  <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>গ্রেড</TableCell>
                                  <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>GPA</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {resultData.results.map((r, i) => (
                                  <TableRow key={i}>
                                    <TableCell>{r.subject?.name}</TableCell>
                                    <TableCell align="center">{r.total_obtained}</TableCell>
                                    <TableCell align="center"><Chip label={r.grade} color={getGradeColor(r.total_obtained, 100)} size="small" /></TableCell>
                                    <TableCell align="center">{r.gpa}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </>
                      ) : <Alert severity="info">ফলাফল এখনও প্রকাশিত হয়নি</Alert>}
                    </Paper>
                  )}

                  {selectedTab === 2 && (
                    <Paper sx={{ p: 4 }}>
                      {feesLoading ? <Box align="center"><CircularProgress /></Box> : feesData ? (
                        <Grid container spacing={3}>
                          <Grid item xs={12} md={6}>
                            <Card variant="outlined">
                              <CardContent>
                                <Typography variant="h6" gutterBottom color="primary">সামগ্রিক ফি সারাংশ</Typography>
                                <Divider sx={{ mb: 2 }} />
                                <Stack spacing={1}>
                                  <Box display="flex" justifyContent="space-between"><Typography>মোট ফি:</Typography><Typography variant="h6">৳{feeTotals.amount}</Typography></Box>
                                  <Box display="flex" justifyContent="space-between"><Typography>পরিশোধিত:</Typography><Typography variant="h6" color="success.main">৳{feeTotals.paid}</Typography></Box>
                                  <Box display="flex" justifyContent="space-between"><Typography>বকেয়া:</Typography><Typography variant="h6" color="error.main">৳{feeTotals.due}</Typography></Box>
                                </Stack>
                              </CardContent>
                            </Card>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Card variant="outlined">
                              <CardContent>
                                <Typography variant="h6" gutterBottom color="primary">ফি পরিশোধ (বিকাশ/নগদ)</Typography>
                                <Stack spacing={2} sx={{ mt: 1 }}>
                                  <TextField label="টাকার পরিমাণ" type="number" value={bkashForm.amount} onChange={e => setBkashForm({ ...bkashForm, amount: e.target.value })} fullWidth size="small" />
                                  <TextField label="আপনার মোবাইল নম্বর" value={bkashForm.from} onChange={e => setBkashForm({ ...bkashForm, from: e.target.value })} fullWidth size="small" />
                                  <Button variant="contained" onClick={submitBkashPayment} disabled={bkashSubmitting} startIcon={<SaveIcon />}>জমা দিন</Button>
                                  {bkashSubmitted && <Alert severity="success">পেমেন্ট রিকোয়েস্ট পাঠানো হয়েছে। অনুমোদনের জন্য অপেক্ষা করুন।</Alert>}
                                </Stack>
                              </CardContent>
                            </Card>
                          </Grid>
                        </Grid>
                      ) : <Alert severity="info">ফির তথ্য পাওয়া যায়নি</Alert>}
                    </Paper>
                  )}
                </Box>

                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button variant="outlined" startIcon={<EditIcon />} onClick={handleOpenEditDialog} size="small">এডিট প্রোফাইল</Button>
                </Box>
              </>
            )}
          </>
        )}
      </Container>
    </Box>
  );
};

export default ParentDashboard;
