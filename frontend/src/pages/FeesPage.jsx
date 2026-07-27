import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Divider,
  Snackbar,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import api from '../utils/api';
import StudentFeeSlipCard from '../components/StudentFeeSlipCard';
import { useSchool } from '../context/SchoolContext';
import { isAuthenticated } from '../utils/auth';
import { useAuth } from '../context/AuthContext';
import InputGuidance from '../components/InputGuidance';

const StudentAvatar = ({ photo, name, size = 40 }) => {
  if (photo) {
    return (
      <Avatar
        src={photo}
        alt={name}
        sx={{ width: size, height: size }}
        onError={(e) => {
          e.target.style.display = 'none';
          e.target.nextSibling.style.display = 'flex';
        }}
      />
    );
  }
  return (
    <Avatar sx={{ width: size, height: size, bgcolor: 'primary.main' }}>
      {name ? name.charAt(0).toUpperCase() : <PersonIcon />}
    </Avatar>
  );
};

const FeesPage = () => {
  const { id: schoolId } = useParams();
  const navigate = useNavigate();
  const { school } = useSchool();
  const { user } = useAuth();

  // States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [feeStructures, setFeeStructures] = useState([]);
  const [isLoadingFeeStructures, setIsLoadingFeeStructures] = useState(false);
  const [selectedLedgerStudentId, setSelectedLedgerStudentId] = useState('');
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  const [ledger, setLedger] = useState({ assignments: [], collections: [], rows: [], totals: { amount: 0, paid: 0, due: 0 } });
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [inlinePayment, setInlinePayment] = useState({ amount: '', paymentDate: new Date(), method: 'cash', reference: '', note: '', bkash_to: '', bkash_from: '' });
  const [isDueSlipOpen, setIsDueSlipOpen] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [planForm, setPlanForm] = useState({
    monthlyAmount: '', halfYearlyAmount: '', annualAmount: '', sessionAmount: ''
  });
  const [feeForm, setFeeForm] = useState({ studentId: '', feeStructureId: '', amount: '', dueDate: null, description: '' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [activeStep, setActiveStep] = useState(0);

  const guidanceSteps = [
    { selector: '#class-select', text: 'শ্রেণি নির্বাচন করুন', autoNext: false },
    { selector: '#student-select', text: 'শিক্ষার্থী নির্বাচন করুন', autoNext: false },
    { selector: '#inline-amount-input', text: 'টাকার পরিমাণ লিখুন', autoNext: false },
    { selector: '#save-payment-button', text: 'সেভ করুন', autoNext: true }
  ];

  useEffect(() => {
    if (!selectedClass) {
      setActiveStep(0);
    } else if (!selectedLedgerStudentId) {
      setActiveStep(1);
    } else if (!inlinePayment.amount) {
      setActiveStep(2);
    } else {
      setActiveStep(3);
    }
  }, [selectedClass, selectedLedgerStudentId, inlinePayment.amount]);

  const studentsFetchTimer = useRef(null);

  // Helper Functions
  const sendWhatsAppMessage = async (phone, message) => {
    try {
      await fetch('http://localhost:3001/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message })
      });
    } catch (err) { console.warn('WhatsApp send failed:', err); }
  };

  const getFeeCategoryName = useCallback((s) => {
    if (!s) return null;
    const name = String(s.name || '').toLowerCase();
    const freq = String(s.frequency || '').toLowerCase();
    if (name.includes('registration')) return 'রেজিস্ট্রেশন ফি';
    if (name.includes('session')) return 'সেশন ফি';
    if (name.includes('half') || name.includes('অর্ধ')) return 'অর্ধ-বার্ষিকী পরীক্ষার ফি';
    if (name.includes('annual') || name.includes('বার্ষিক')) return 'বার্ষিক পরীক্ষার ফি';
    if (freq === 'monthly') return 'মাসিক বেতন';
    return s.name || 'ফি';
  }, []);

  const fetchFees = useCallback(async () => {
    try {
      setLoading(true);
      await api.get(`/api/fees/assignments/`);
      setError(null);
    } catch (err) { setError(err.message || 'Failed to load fees'); }
    finally { setLoading(false); }
  }, []);

  const fetchClasses = useCallback(async () => {
    try {
      if (!schoolId) return [];
      const response = await api.get(`/api/academics/classrooms/?school=${schoolId}`);
      let classesData = Array.isArray(response.data) ? response.data : response.data?.results || [];
      const formatted = classesData.map(cls => ({ id: cls.id || cls._id, name: cls.name || `Class ${cls.id}`, ...cls }));
      setClasses(formatted);
      return formatted;
    } catch (error) { return []; }
  }, [schoolId]);

  const fetchStudents = useCallback(async (classId) => {
    if (!classId) return [];
    try {
      setIsLoadingStudents(true);
      const response = await api.get(`/api/academics/students/?school=${schoolId}&classroom=${classId}`);
      let data = Array.isArray(response.data) ? response.data : response.data?.results || [];
      const formatted = data.map(s => {
        const dn = s.display_name || s.full_name || `${s.user?.first_name || ''} ${s.user?.last_name || ''}`.trim();
        return { id: String(s.id), display_name: dn, roll_number: s.roll_number || '', ...s };
      }).sort((a, b) => {
        const ar = parseInt(String(a.roll_number).replace(/\D/g, ''), 10);
        const br = parseInt(String(b.roll_number).replace(/\D/g, ''), 10);
        return (Number.isNaN(ar) || Number.isNaN(br)) ? 0 : ar - br;
      });
      setStudents(formatted);
      return formatted;
    } catch (error) { return []; }
    finally { setIsLoadingStudents(false); }
  }, [schoolId]);

  const fetchFeeStructures = useCallback(async (classId) => {
    const cls = classId || selectedClass;
    if (!cls) return [];
    try {
      setIsLoadingFeeStructures(true);
      const response = await api.get(`/api/fees/fees/?school=${schoolId}&classroom=${cls}`);
      const list = Array.isArray(response.data) ? response.data : response.data?.results || [];
      const formatted = list.map(item => ({ id: String(item.id), name: item.name || `Structure ${item.id}`, amount: item.amount || 0, ...item }));
      setFeeStructures(formatted);
      return formatted;
    } catch (e) { return []; }
    finally { setIsLoadingFeeStructures(false); }
  }, [schoolId, selectedClass]);

  const fetchPaymentHistory = useCallback(async (studentId) => {
    if (!studentId) { setPaymentHistory([]); return; }
    try {
      setIsLoadingPayments(true);
      const resp = await api.get(`/api/fees/payments/?student_id=${studentId}`);
      const payments = Array.isArray(resp.data) ? resp.data : resp.data?.results || [];
      const formatted = payments.map(p => ({
        id: p.id, date: p.payment_date || p.created_at, amount: Number(p.amount || 0),
        method: p.payment_method || 'N/A', reference: p.reference || '',
        assignmentId: String(p.assignment_id || ''), assignment_name: p.assignment?.fee_structure?.name || 'Payment'
      }));
      setPaymentHistory(formatted.sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (e) { setPaymentHistory([]); }
    finally { setIsLoadingPayments(false); }
  }, []);

  const fetchStudentLedger = useCallback(async (studentId) => {
    if (!studentId) { setLedger({ assignments: [], collections: [], rows: [], totals: { amount: 0, paid: 0, due: 0 } }); return; }
    try {
      setIsLoadingLedger(true);
      const aResp = await api.get(`/api/fees/assignments/?student_id=${studentId}&school=${schoolId}`);
      let assignments = Array.isArray(aResp.data) ? aResp.data : aResp.data?.results || [];
      const pResp = await api.get(`/api/fees/payments/?student_id=${studentId}`);
      const payments = Array.isArray(pResp.data) ? pResp.data : pResp.data?.results || [];
      const sumByAssignment = {};
      payments.forEach(pay => { if (pay.assignment_id) sumByAssignment[pay.assignment_id] = (sumByAssignment[pay.assignment_id] || 0) + Number(pay.amount); });
      const rows = assignments.map(a => ({
        id: String(a.id), name: getFeeCategoryName(a.fee_structure) || a.name || 'ফি',
        amount: Number(a.amount || 0), paid: Number(sumByAssignment[a.id] || 0),
        due: Math.max(0, Number(a.amount || 0) - Number(sumByAssignment[a.id] || 0)),
        due_date: a.due_date, month: a.fee_structure?.month
      }));
      const totals = rows.reduce((acc, r) => ({ amount: acc.amount + r.amount, paid: acc.paid + r.paid, due: acc.due + r.due }), { amount: 0, paid: 0, due: 0 });
      setLedger({ assignments, collections: payments, rows, totals });
    } catch (e) { } finally { setIsLoadingLedger(false); }
  }, [schoolId, getFeeCategoryName]);

  const deriveClassPlan = useCallback((classId) => {
    const cid = String(classId || selectedClass || '');
    const list = feeStructures.filter(s => String(s.classroom_id || s.classroom) === cid);
    if (!list.length) return null;
    const monthly = list.filter(x => String(x.frequency).toLowerCase() === 'monthly');
    const oneTime = list.filter(x => String(x.frequency).toLowerCase() === 'one_time');
    const pickByName = (arr, hints) => Number(arr.find(x => hints.some(h => String(x.name || '').toLowerCase().includes(h)))?.amount || 0);
    return {
      monthlyAmount: Number(monthly[0]?.amount || 0),
      halfYearlyAmount: pickByName(oneTime, ['half', 'অর্ধ']),
      annualAmount: pickByName(oneTime, ['annual', 'বার্ষিক']),
      sessionAmount: pickByName(list, ['session', 'সেশন'])
    };
  }, [feeStructures, selectedClass]);

  const ensureStudentAssignments = useCallback(async (studentId) => {
    if (!studentId || !selectedClass) return;
    try {
      await api.post('/api/fees/assignments/bulk_assign/', { school_id: schoolId, classroom_id: selectedClass, student_id: studentId });
    } catch (e) { console.warn('Assignment sync failed'); }
  }, [schoolId, selectedClass]);

  // Effects
  useEffect(() => { fetchClasses(); fetchFees(); }, [fetchClasses, fetchFees]);

  useEffect(() => {
    if (studentsFetchTimer.current) clearTimeout(studentsFetchTimer.current);
    if (!selectedClass) { setStudents([]); return; }
    studentsFetchTimer.current = setTimeout(() => { fetchStudents(selectedClass); fetchFeeStructures(selectedClass); }, 300);
    return () => clearTimeout(studentsFetchTimer.current);
  }, [selectedClass, fetchStudents, fetchFeeStructures]);

  // Event Handlers
  const handleClassChange = (e) => { setSelectedClass(e.target.value); setSelectedLedgerStudentId(''); setStudents([]); };

  const handleOpenDialog = () => {
    if (!isAuthenticated()) { navigate('/login'); return; }
    setFeeForm({ studentId: '', feeStructureId: '', amount: '', dueDate: null, description: '' });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => setIsDialogOpen(false);

  const handleLedgerStudentChange = useCallback(async (e) => {
    const sid = e.target.value; setSelectedLedgerStudentId(sid);
    if (sid) { await ensureStudentAssignments(sid); await fetchStudentLedger(sid); await fetchPaymentHistory(sid); }
  }, [ensureStudentAssignments, fetchStudentLedger, fetchPaymentHistory]);

  const handleSubmitFee = async (e) => {
    e.preventDefault();
    if (!feeForm.studentId || !feeForm.feeStructureId || !feeForm.dueDate || Number(feeForm.amount) <= 0) {
      setSnackbar({ open: true, message: 'সবগুলো ঘর সঠিক তথ্য দিয়ে পূরণ করুন', severity: 'warning' });
      return;
    }
    try {
      setIsSubmitting(true);
      await api.post('/api/fees/assignments/', {
        student_id: feeForm.studentId, fee_structure_id: feeForm.feeStructureId,
        amount: parseFloat(feeForm.amount), due_date: feeForm.dueDate.toISOString().split('T')[0], school: schoolId,
      });
      setSnackbar({ open: true, message: 'ফি সফলভাবে সংরক্ষিত', severity: 'success' });
      handleCloseDialog(); fetchFees();
    } catch (error) { setSnackbar({ open: true, message: 'সংরক্ষণে সমস্যা হয়েছে', severity: 'error' }); }
    finally { setIsSubmitting(false); }
  };

  const submitInlinePayment = async () => {
    if (!selectedLedgerStudentId || !inlinePayment.amount) return;
    try {
      setIsSubmittingPayment(true);
      await api.post('/api/fees/payments/', {
        student_id: selectedLedgerStudentId, amount: parseFloat(inlinePayment.amount),
        payment_date: inlinePayment.paymentDate.toISOString().split('T')[0],
        payment_method: inlinePayment.method, reference: inlinePayment.reference, school: schoolId
      });
      setSnackbar({ open: true, message: 'পেমেন্ট সফলভাবে সংরক্ষিত', severity: 'success' });
      const student = students.find(s => s.id === selectedLedgerStudentId);
      if (student?.guardian_phone) {
        sendWhatsAppMessage(student.guardian_phone, `সুপ্রিয় অভিভাবক, আপনার সন্তান ${student.display_name}-এর ৳${inlinePayment.amount} ফি জমা হয়েছে। ধন্যবাদ।`);
      }
      setInlinePayment({ amount: '', paymentDate: new Date(), method: 'cash', reference: '', note: '', bkash_to: '', bkash_from: '' });
      fetchStudentLedger(selectedLedgerStudentId); fetchPaymentHistory(selectedLedgerStudentId);
    } catch (e) { setSnackbar({ open: true, message: 'পেমেন্ট সংরক্ষণে ব্যর্থ', severity: 'error' }); }
    finally { setIsSubmittingPayment(false); }
  };

  const handleCloseSnackbar = () => setSnackbar(prev => ({ ...prev, open: false }));

  const handleOpenPlanDialog = () => {
    const plan = deriveClassPlan(selectedClass);
    if (plan) {
      setPlanForm(prev => ({
        ...prev, monthlyAmount: plan.monthlyAmount, halfYearlyAmount: plan.halfYearlyAmount,
        annualAmount: plan.annualAmount, sessionAmount: plan.sessionAmount
      }));
    }
    setIsPlanDialogOpen(true);
  };

  const saveClassPlan = async () => {
    if (!selectedClass) return;
    try {
      setIsSavingPlan(true);
      await api.post('/api/fees/fees/bulk_setup/', {
        school_id: schoolId, classroom_id: selectedClass,
        structures: [
          { name: 'মাসিক বেতন', frequency: 'monthly', amount: Number(planForm.monthlyAmount) },
          { name: 'অর্ধ-বার্ষিকী পরীক্ষার ফি', frequency: 'one_time', amount: Number(planForm.halfYearlyAmount) },
          { name: 'বার্ষিক পরীক্ষার ফি', frequency: 'one_time', amount: Number(planForm.annualAmount) },
          { name: 'সেশন ফি', frequency: 'one_time', amount: Number(planForm.sessionAmount) }
        ]
      });
      setSnackbar({ open: true, message: 'ফি প্ল্যান সংরক্ষিত', severity: 'success' });
      setIsPlanDialogOpen(false); fetchFeeStructures(selectedClass);
    } catch (e) { setSnackbar({ open: true, message: 'প্ল্যান সংরক্ষণে ব্যর্থ', severity: 'error' }); }
    finally { setIsSavingPlan(false); }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box p={2}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h5">ফি ব্যবস্থাপনা</Typography>
          <Box display="flex" gap={1} sx={{ flexWrap: 'wrap' }}>
            <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>ব্যাক</Button>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchFees} disabled={loading}>রিফ্রেশ</Button>
            <Button variant="outlined" onClick={handleOpenPlanDialog} disabled={!selectedClass}>মাসিক/বার্ষিক ফি সেট</Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenDialog}>ফি যোগ করুন</Button>
          </Box>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" my={4}><CircularProgress /></Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Grid container spacing={2}>
            {/* Student Ledger Section */}
            <Grid size={{ xs: 12 }}>
              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom>শিক্ষার্থীর লেজার</Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl id="class-select" fullWidth>
                      <InputLabel>শ্রেণি নির্বাচন করুন</InputLabel>
                      <Select value={selectedClass} label="শ্রেণি নির্বাচন করুন" onChange={handleClassChange}>
                        {classes.map(cls => <MenuItem key={cls.id} value={String(cls.id)}>{cls.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl id="student-select" fullWidth disabled={!selectedClass || isLoadingStudents}>
                      <InputLabel>শিক্ষার্থী নির্বাচন করুন</InputLabel>
                      <Select value={selectedLedgerStudentId} label="শিক্ষার্থী নির্বাচন করুন" onChange={handleLedgerStudentChange}>
                        {students.map(st => <MenuItem key={st.id} value={String(st.id)}>{st.display_name} (রোল: {st.roll_number})</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                {isLoadingLedger ? (
                  <Box display="flex" justifyContent="center"><CircularProgress size={24} /></Box>
                ) : selectedLedgerStudentId && ledger.rows.length > 0 ? (
                  <Box>
                    <StudentFeeSlipCard school={school} student={students.find(s => s.id === selectedLedgerStudentId)} rows={ledger.rows} totals={ledger.totals} />
                    <Button variant="outlined" sx={{ mt: 2 }} onClick={() => setIsDueSlipOpen(true)}>বকেয়া ফি স্লিপ দেখুন</Button>
                  </Box>
                ) : selectedLedgerStudentId && <Typography color="text.secondary">কোন ফি রেকর্ড পাওয়া যায়নি</Typography>}
              </Paper>
            </Grid>

            {/* Payment History Section */}
            <Grid size={{ xs: 12 }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>পেমেন্ট মেথড লেজার</Typography>
                <TableContainer component={Paper} sx={{ mb: 3 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.100' }}>
                        <TableCell>তারিখ</TableCell>
                        <TableCell>আইটেম</TableCell>
                        <TableCell align="right">পরিমাণ</TableCell>
                        <TableCell>পদ্ধতি</TableCell>
                        <TableCell>রেফারেন্স</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paymentHistory.map(p => (
                        <TableRow key={p.id}>
                          <TableCell>{new Date(p.date).toLocaleDateString('bn-BD')}</TableCell>
                          <TableCell>{p.assignment_name}</TableCell>
                          <TableCell align="right">৳{p.amount.toLocaleString()}</TableCell>
                          <TableCell><Chip size="small" label={p.method} color="success" variant="outlined" /></TableCell>
                          <TableCell>{p.reference || '-'}</TableCell>
                        </TableRow>
                      ))}
                      {paymentHistory.length === 0 && <TableRow><TableCell colSpan={5} align="center">রেকর্ড নেই</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Inline Payment Input */}
                <Typography variant="subtitle1" gutterBottom>নতুন পেমেন্ট যোগ করুন (Unassigned)</Typography>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell>
                          <DatePicker value={inlinePayment.paymentDate} onChange={(d) => setInlinePayment(p => ({ ...p, paymentDate: d }))} slotProps={{ textField: { size: 'small' } }} />
                        </TableCell>
                        <TableCell>
                          <TextField id="inline-amount-input" size="small" type="number" placeholder="পরিমাণ" value={inlinePayment.amount} onChange={(e) => setInlinePayment(p => ({ ...p, amount: e.target.value }))} />
                        </TableCell>
                        <TableCell>
                          <Select size="small" value={inlinePayment.method} onChange={(e) => setInlinePayment(p => ({ ...p, method: e.target.value }))} sx={{ minWidth: 120 }}>
                            <MenuItem value="cash">ক্যাশ</MenuItem>
                            <MenuItem value="bkash">বিকাশ</MenuItem>
                            <MenuItem value="bank">ব্যাংক</MenuItem>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <TextField size="small" placeholder="রেফারেন্স/নোট" value={inlinePayment.reference} onChange={(e) => setInlinePayment(p => ({ ...p, reference: e.target.value }))} />
                        </TableCell>
                        <TableCell>
                          <Button id="save-payment-button" variant="contained" size="small" onClick={submitInlinePayment} disabled={isSubmittingPayment || !selectedLedgerStudentId}>Save</Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* Add Fee Dialog */}
        <Dialog open={isDialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm">
          <DialogTitle>ম্যানুয়ালি ফি যোগ করুন</DialogTitle>
          <DialogContent>
            <Box component="form" onSubmit={handleSubmitFee} sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>শিক্ষার্থী নির্বাচন করুন</InputLabel>
                <Select value={feeForm.studentId} label="শিক্ষার্থী নির্বাচন করুন" onChange={(e) => setFeeForm(p => ({ ...p, studentId: e.target.value }))} required>
                  {students.map(st => <MenuItem key={st.id} value={st.id}>{st.display_name} (রোল: {st.roll_number})</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>ফি ক্যাটেগরি</InputLabel>
                <Select value={feeForm.feeStructureId} label="ফি ক্যাটেগরি" onChange={(e) => {
                  const fs = feeStructures.find(x => x.id === e.target.value);
                  setFeeForm(p => ({ ...p, feeStructureId: e.target.value, amount: fs?.amount || '' }));
                }} required>
                  {feeStructures.map(fs => <MenuItem key={fs.id} value={fs.id}>{fs.name} (৳{fs.amount})</MenuItem>)}
                </Select>
              </FormControl>
              <TextField fullWidth label="টাকার পরিমাণ" type="number" value={feeForm.amount} onChange={(e) => setFeeForm(p => ({ ...p, amount: e.target.value }))} required />
              <DatePicker label="শেষ তারিখ" value={feeForm.dueDate} onChange={(d) => setFeeForm(p => ({ ...p, dueDate: d }))} slotProps={{ textField: { fullWidth: true, required: true } }} />
              <DialogActions>
                <Button onClick={handleCloseDialog}>বাতিল</Button>
                <Button type="submit" variant="contained" disabled={isSubmitting}>সংরক্ষণ করুন</Button>
              </DialogActions>
            </Box>
          </DialogContent>
        </Dialog>

        {/* Class Plan Dialog */}
        <Dialog open={isPlanDialogOpen} onClose={() => setIsPlanDialogOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>ক্লাস ভিত্তিক ফি নির্ধারণ</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField fullWidth label="মাসিক বেতন" type="number" value={planForm.monthlyAmount} onChange={(e) => setPlanForm(p => ({ ...p, monthlyAmount: e.target.value }))} />
            <TextField fullWidth label="অর্ধ-বার্ষিকী পরীক্ষার ফি" type="number" value={planForm.halfYearlyAmount} onChange={(e) => setPlanForm(p => ({ ...p, halfYearlyAmount: e.target.value }))} />
            <TextField fullWidth label="বার্ষিক পরীক্ষার ফি" type="number" value={planForm.annualAmount} onChange={(e) => setPlanForm(p => ({ ...p, annualAmount: e.target.value }))} />
            <TextField fullWidth label="সেশন ফি" type="number" value={planForm.sessionAmount} onChange={(e) => setPlanForm(p => ({ ...p, sessionAmount: e.target.value }))} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsPlanDialogOpen(false)}>বাতিল</Button>
            <Button variant="contained" onClick={saveClassPlan} disabled={isSavingPlan}>সেভ করুন</Button>
          </DialogActions>
        </Dialog>

        {/* Due Slip Dialog */}
        <Dialog open={isDueSlipOpen} onClose={() => setIsDueSlipOpen(false)} fullWidth maxWidth="md">
          <DialogTitle>বকেয়া ফি স্লিপ</DialogTitle>
          <DialogContent dividers>
            <StudentFeeSlipCard title="বকেয়া ফি স্লিপ" school={school} student={students.find(s => s.id === selectedLedgerStudentId)} rows={ledger.rows.filter(r => r.due > 0)} totals={{ amount: ledger.totals.due, paid: 0, due: ledger.totals.due }} />
          </DialogContent>
          <DialogActions>
            <Button variant="contained" onClick={() => window.print()}>প্রিন্ট করুন</Button>
            <Button onClick={() => setIsDueSlipOpen(false)}>বন্ধ করুন</Button>
          </DialogActions>
        </Dialog>

        <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar}>
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
        </Snackbar>

        <InputGuidance
          steps={guidanceSteps}
          activeStep={activeStep}
          onStepComplete={() => setActiveStep(prev => prev + 1)}
        />
      </Box>
    </LocalizationProvider>
  );
};

export default FeesPage;
