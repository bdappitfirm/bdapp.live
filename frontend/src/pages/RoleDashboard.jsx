import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import {
  Box,
  Typography,
  Avatar,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Paper,
  TextField,
  Stack,
  Grid,
  IconButton
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SchoolIcon from '@mui/icons-material/School';
import GroupIcon from '@mui/icons-material/Group';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { useToast } from '../components/Toast';

import StatCard from '../components/dashboard/StatCard';
import AttendanceChart from '../components/dashboard/AttendanceChart';
import FeeCollectionChart from '../components/dashboard/FeeCollectionChart';
import MasterMonitor from '../components/dashboard/MasterMonitor';
import { getDashboardStats } from '../services/dashboardService';
import { useAuth } from '../context/AuthContext';

const computeAdminStatsFallback = async (schoolId) => {
  const results = await Promise.allSettled([
    api.get(`/api/fees/payments/?school=${schoolId}`),
    api.get(`/api/fees/assignments/?school=${schoolId}`),
    api.get(`/api/fees/fees/?school=${schoolId}`),
    api.get(`/api/academics/students/?school=${schoolId}`),
    api.get(`/api/academics/classrooms/?school=${schoolId}`)
  ]);
  const payments = results[0].status === 'fulfilled' ? (results[0].value.data?.results || results[0].value.data || []) : [];
  const assignments = results[1].status === 'fulfilled' ? (results[1].value.data?.results || results[1].value.data || []) : [];
  const feeStructs = results[2].status === 'fulfilled' ? (results[2].value.data?.results || results[2].value.data || []) : [];
  const students = results[3].status === 'fulfilled' ? (results[3].value.data?.results || results[3].value.data || []) : [];
  const classrooms = results[4].status === 'fulfilled' ? (results[4].value.data?.results || results[4].value.data || []) : [];
  let teachers = [];
  try {
    const eps = [`/api/academics/teachers/?school=${schoolId}`, `/api/users/teachers/?school=${schoolId}`];
    for (const ep of eps) {
      try {
        const r = await api.get(ep);
        const arr = Array.isArray(r.data) ? r.data : (r.data?.results || []);
        if (arr.length) { teachers = arr; break; }
      } catch (_) {}
    }
  } catch (_) {}
  const byDate = new Map();
  const now = new Date();
  const cutoff = new Date(now.getTime() - 30*24*60*60*1000);
  for (const p of payments) {
    const ds = new Date(p.payment_date || p.date || p.created_at || now);
    if (isNaN(ds) || ds < cutoff) continue;
    const key = ds.toISOString().slice(0,10);
    byDate.set(key, (byDate.get(key) || 0) + Number(p.amount || 0));
  }
  const fee_collection = Array.from(byDate.entries()).sort(([a],[b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount }));
  const structMap = {};
  for (const s of feeStructs) { structMap[String(s.id)] = s; }
  const studentMap = new Map();
  for (const s of students) { studentMap.set(String(s.id), s); }
  const paidByAssign = new Map();
  for (const pay of payments) {
    const aid = String(pay.assignment_id || pay.assignment || '');
    if (aid) paidByAssign.set(aid, (paidByAssign.get(aid) || 0) + Number(pay.amount || 0));
  }
  const classMap = new Map();
  let tuition_due_total = 0;
  let exam_due_total = 0;
  for (const a of assignments) {
    const currentMonthNo = new Date().getMonth() + 1;
    const aid = String(a.id || '');
    const sObj = structMap[String(a.fee_structure_id || a.fee_structure || '')] || {};
    const base = Number(a.amount || sObj.amount || 0);
    const gross = Math.max(0, base - Number(a.discount_amount || 0) - (base * Number(a.discount_percentage || 0) / 100));
    const paid = Number(paidByAssign.get(aid) || 0);
    let due = Math.max(0, gross - paid);
    if (due <= 0) continue;
    const stu = studentMap.get(String(a.student_id || a.student || ''));
    const className = stu?.classroom?.name || 'Unknown';
    const freq = String(sObj.frequency || '').toLowerCase();
    const rtype = freq === 'monthly' ? 'tuition' : (freq === 'one_time' ? 'exam' : 'other');
    const entry = classMap.get(className) || { tuition_due: 0, exam_due: 0, total_due: 0 };
    if (rtype === 'tuition') {
      const m = Number(sObj.month || a.month || 0);
      if (m && m > currentMonthNo) continue;
      entry.tuition_due += due;
      tuition_due_total += due;
    } else if (rtype === 'exam') {
      entry.exam_due += due;
      exam_due_total += due;
    }
    entry.total_due += due;
    classMap.set(className, entry);
  }
  return { fee_collection, fee_dues_summary: { tuition_due_total, exam_due_total, total_due: tuition_due_total + exam_due_total }, fee_dues_by_class: Array.from(classMap.entries()).map(([class_name, v]) => ({ class_name, ...v })), students_count: students.length, teachers_count: teachers.length, classes_count: classrooms.length };
};

const RoleDashboard = ({ role: roleProp }) => {
  const { id, role: roleParam } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const role = roleProp || roleParam || '';
  const [, setData] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [, setAdminLoading] = useState(false);
  const [, setAdminError] = useState(null);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthLoading, setReauthLoading] = useState(false);
  const [, setReauthError] = useState('');
  const [pendingPayments, setPendingPayments] = useState([]);

  const enrichAdminStats = useCallback(async (incoming, schoolId) => {
    try {
      const needsCounts = !incoming || !('students_count' in incoming) || !('teachers_count' in incoming) || !('classes_count' in incoming);
      if (!needsCounts) return incoming;
      const fallback = await computeAdminStatsFallback(schoolId);
      return { ...(incoming || {}), ...fallback };
    } catch (_) { return incoming || {}; }
  }, []);

  const safeLoadAdminStats = useCallback(async (schoolId) => {
    try {
      setAdminLoading(true);
      setAdminError(null);
      const year = new Date().getFullYear();
      const stats = await getDashboardStats(schoolId, year);
      const enriched = await enrichAdminStats(stats, schoolId);
      setAdminStats(enriched);
    } catch (err) {
      try {
        const fallback = await computeAdminStatsFallback(schoolId);
        setAdminStats((prev) => ({ ...(prev || {}), ...fallback }));
      } catch (_) { setAdminError('Failed to load dashboard stats.'); }
    } finally { setAdminLoading(false); }
  }, [enrichAdminStats]);

  const fetchPendingPayments = useCallback(async () => {
    try {
      const schoolQ = id ? `&school=${encodeURIComponent(id)}` : '';
      const resp = await api.get(`/api/fees/payments/?status=pending${schoolQ}`);
      const data = Array.isArray(resp.data) ? resp.data : (resp.data?.results || []);
      setPendingPayments(data.filter(p => String(p.status || p.payment_status).toLowerCase() === 'pending'));
    } catch (e) { setPendingPayments([]); }
  }, [id]);

  useEffect(() => {
    if (!id || !role) return;
    if (role === 'admin') {
      safeLoadAdminStats(id);
      fetchPendingPayments();
      return;
    }
    const fetchRoleData = async () => {
      try {
        let url = '';
        if (role === 'student') url = `/api/academics/students/?school=${id}`;
        else if (role === 'parent') url = `/api/users/parents/?school=${id}`;
        else if (role === 'committee') url = `/api/users/committees/?school=${id}`;
        if (!url) return;
        const res = await api.get(url);
        const items = Array.isArray(res.data) ? res.data : (res.data.results || []);
        setData(items.map(it => ({ name: (it.user?.first_name ? `${it.user.first_name} ${it.user.last_name || ''}`.trim() : it.user?.username || 'Unnamed'), ...it })));
      } catch (_) { setData([]); }
    };
    fetchRoleData();
  }, [id, role, safeLoadAdminStats, fetchPendingPayments]);

  useEffect(() => {
    if (role !== 'admin' || !id) return;
    const interval = setInterval(fetchPendingPayments, 30000);
    return () => clearInterval(interval);
  }, [role, id, fetchPendingPayments]);

  const handleReauth = async () => {
    try {
      setReauthLoading(true);
      setReauthError('');
      if (!reauthPassword) { setReauthError('পাসওয়ার্ড দিন'); return; }
      await api.post('/api/users/password/verify/', { password: reauthPassword });
      sessionStorage.setItem(`adminReauth:${id}`, String(Date.now()));
      setReauthOpen(false);
      toast.success('অ্যাডমিন যাচাইকরণ সম্পন্ন');
      safeLoadAdminStats(id);
      fetchPendingPayments();
    } catch (e) { setReauthError('পাসওয়ার্ড সঠিক নয়'); }
    finally { setReauthLoading(false); }
  };

  const { user } = useAuth();
  const username = String(user?.username || user?.user?.username || '').toLowerCase().replace(/\u200d/g, '').trim();
  const isBdAdmin = username === 'bdadmin' || username.includes('bdadmin');
  const isSchool69 = String(id) === '69' || window.location.pathname.includes('/school/69');

  if (isSchool69 && (role === 'admin' || window.location.pathname.includes('/admin')) && !isBdAdmin) {
    return (
      <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 3, maxWidth: 500, bgcolor: '#fff0f0', border: '1px solid #ffcdd2' }}>
          <Typography variant="h5" color="error" gutterBottom sx={{ fontWeight: 'bold' }}>
            এক্সেস নিষিদ্ধ (Access Denied)
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
            স্কুল ৬৯ (School 69)-এর এডমিন পেজে প্রবেশ করার অনুমতি শুধুমাত্র <strong>bdadmin</strong> এর রয়েছে।
          </Typography>
          <Button variant="contained" color="primary" onClick={() => navigate(`/school/${id}`)}>
            স্কুল ড্যাশবোর্ডে ফিরে যান
          </Button>
        </Paper>
      </Box>
    );
  }

  const roleIcon = () => {
    switch (role) {
      case 'admin': return <PersonIcon />;
      case 'teacher': return <SchoolIcon />;
      case 'parent': return <GroupIcon />;
      case 'committee': return <AccountBalanceIcon />;
      default: return <PersonIcon />;
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Paper elevation={4} sx={{ p: 3, mb: 4, background: "linear-gradient(135deg, #2196F3 0%, #1565C0 100%)", color: 'white', borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="center" justifyContent="space-between" spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>{roleIcon()}</Avatar>
            <Box><Typography variant="h4" fontWeight="bold">{role.toUpperCase()} Dashboard</Typography><Typography variant="subtitle1">School ID: {id}</Typography></Box>
          </Stack>
          {role === 'admin' && (
            <Stack direction="row" spacing={1}>
              <IconButton color="inherit"><Badge color="error" badgeContent={pendingPayments.length}><NotificationsIcon /></Badge></IconButton>
              <Button variant="contained" sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} onClick={() => navigate(`/school/${id}/settings`)}>Settings</Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      {role === 'admin' && adminStats && (
        <Grid container spacing={3} mb={4}>
          <Grid size={{ xs: 12, sm: 4 }}><StatCard title="Students" value={adminStats.students_count} icon="👨‍🎓" color="border-blue-500" sx={{ height: 110 }} /></Grid>
          <Grid size={{ xs: 12, sm: 4 }}><StatCard title="Teachers" value={adminStats.teachers_count} icon="👨‍🏫" color="border-green-500" sx={{ height: 110 }} /></Grid>
          <Grid size={{ xs: 12, sm: 4 }}><StatCard title="Classes" value={adminStats.classes_count} icon="🏫" color="border-purple-500" sx={{ height: 110 }} /></Grid>
        </Grid>
      )}

      {role === 'admin' && adminStats && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, lg: 6 }}><Paper sx={{ p: 3, borderRadius: 2, height: 400 }}><Typography variant="h6" mb={2}>Attendance</Typography><AttendanceChart attendanceData={adminStats.attendance_data || []} /></Paper></Grid>
          <Grid size={{ xs: 12, lg: 6 }}><Paper sx={{ p: 3, borderRadius: 2, height: 400 }}><Typography variant="h6" mb={2}>Fee Collection</Typography><FeeCollectionChart feeData={adminStats.fee_collection || []} feeDuesSummary={adminStats.fee_dues_summary} feeDuesByClass={adminStats.fee_dues_by_class} /></Paper></Grid>
        </Grid>
      )}

      {role === 'admin' && (
        <Box sx={{ mt: 4 }}>
          <MasterMonitor schoolId={id} />
        </Box>
      )}

      <Dialog open={reauthOpen} disableEscapeKeyDown fullWidth maxWidth="xs">
        <DialogTitle>অ্যাডমিন যাচাইকরণ</DialogTitle>
        <DialogContent dividers><TextField label="পাসওয়ার্ড" type="password" value={reauthPassword} onChange={(e) => setReauthPassword(e.target.value)} fullWidth autoFocus /></DialogContent>
        <DialogActions><Button onClick={() => navigate(`/school/${id}`)}>বাতিল</Button><Button variant="contained" onClick={handleReauth} disabled={reauthLoading}>যাচাই করুন</Button></DialogActions>
      </Dialog>
    </Box>
  );
};

export default RoleDashboard;
