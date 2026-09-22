import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, CircularProgress,
  TextField, MenuItem, Stack, Grid, Dialog, DialogTitle,
  DialogContent, DialogActions, Card, CardContent
} from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PaymentIcon from '@mui/icons-material/Payment';
import PrintIcon from '@mui/icons-material/Print';
import RefreshIcon from '@mui/icons-material/Refresh';
import api from '../utils/api';
import { useToast } from '../components/Toast';

export default function PayrollPage() {
  const { id: schoolId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState('');

  // Payment dialog
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paying, setPaying] = useState(false);

  const monthsBn = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];

  const fetchPayroll = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      let url = `/api/users/payroll/records/?school=${schoolId}&month=${month}&year=${year}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const res = await api.get(url);
      const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setPayrollRecords(data);
    } catch (err) {
      console.error('Failed to load payroll:', err);
      toast.error('পে-রোল ডাটা লোড করতে ব্যর্থ হয়েছে');
    } finally {
      setLoading(false);
    }
  }, [schoolId, month, year, statusFilter, toast]);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

  const handleGenerateMonthly = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/api/users/payroll/records/generate_monthly/', {
        school_id: schoolId,
        month,
        year
      });
      toast.success(res.data?.message || 'পে-রোল সফলভাবে জেনারেট হয়েছে');
      fetchPayroll();
    } catch (err) {
      console.error('Failed to generate payroll:', err);
      toast.error('পে-রোল জেনারেট করতে ব্যর্থ হয়েছে');
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenPayDialog = (record) => {
    setSelectedRecord(record);
    setPaymentMethod('cash');
    setPaymentRef('');
    setPaymentNote('');
    setPayDialogOpen(true);
  };

  const handleProcessPayment = async () => {
    if (!selectedRecord) return;
    setPaying(true);
    try {
      await api.post(`/api/users/payroll/records/${selectedRecord.id}/pay_salary/`, {
        payment_method: paymentMethod,
        payment_reference: paymentRef,
        note: paymentNote
      });
      toast.success('বেতন পরিশোধিত হিসেবে সেভ হয়েছে');
      setPayDialogOpen(false);
      fetchPayroll();
    } catch (err) {
      console.error('Failed to pay salary:', err);
      toast.error('পেমেন্ট প্রসেস করতে সমস্যা হয়েছে');
    } finally {
      setPaying(false);
    }
  };

  const totalNetSalary = payrollRecords.reduce((acc, r) => acc + (parseFloat(r.net_salary) || 0), 0);
  const totalPaid = payrollRecords.filter(r => r.status === 'paid').reduce((acc, r) => acc + (parseFloat(r.net_salary) || 0), 0);
  const totalPending = totalNetSalary - totalPaid;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, background: 'linear-gradient(135deg, #2e7d32 0%, #4caf50 100%)', color: 'white' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
              <AccountBalanceIcon sx={{ mr: 1, fontSize: 36 }} /> শিক্ষক/স্টাফ বেতন পে-রোল
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              মাসিক বেতন জেনারেশন, অনুমোদন এবং পেমেন্ট ট্র্যাকিং প্যানেল
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={handleGenerateMonthly}
              disabled={generating}
              sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}
            >
              {generating ? 'জেনারেট হচ্ছে...' : `${monthsBn[month - 1]} ${year}-এর বেতন জেনারেট করুন`}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#e8f5e9', borderLeft: '5px solid #2e7d32' }}>
            <CardContent>
              <Typography variant="subtitle2" color="textSecondary">মোট প্রদেয় বেতন</Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>৳ {totalNetSalary.toLocaleString()}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#e3f2fd', borderLeft: '5px solid #1976d2' }}>
            <CardContent>
              <Typography variant="subtitle2" color="textSecondary">পরিশোধিত</Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1976d2' }}>৳ {totalPaid.toLocaleString()}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#fff3e0', borderLeft: '5px solid #ed6c02' }}>
            <CardContent>
              <Typography variant="subtitle2" color="textSecondary">বকেয়া/পেন্ডিং</Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ed6c02' }}>৳ {totalPending.toLocaleString()}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filter Bar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              size="small"
              label="মাস"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {monthsBn.map((m, idx) => (
                <MenuItem key={idx + 1} value={idx + 1}>{m}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              size="small"
              label="বছর"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <MenuItem key={y} value={y}>{y}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              size="small"
              label="পেমেন্ট স্ট্যাটাস"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">সব স্ট্যাটাস</MenuItem>
              <MenuItem value="pending">পেন্ডিং (Pending)</MenuItem>
              <MenuItem value="paid">পরিশোধিত (Paid)</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {/* Table */}
      <Paper sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>শিক্ষকের নাম</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>পদবী</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>মূল বেতন</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>ভাতা</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>কর্তন</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>নিট বেতন</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>স্ট্যাটাস</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>অ্যাকশন</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payrollRecords.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell sx={{ fontWeight: 600 }}>{r.teacher_name}</TableCell>
                    <TableCell>{r.teacher_designation || '-'}</TableCell>
                    <TableCell align="right">৳ {Number(r.basic_salary).toLocaleString()}</TableCell>
                    <TableCell align="right">৳ {Number(r.allowances).toLocaleString()}</TableCell>
                    <TableCell align="right">৳ {Number(r.deductions).toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                      ৳ {Number(r.net_salary).toLocaleString()}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={r.status === 'paid' ? 'পরিশোধিত' : 'পেন্ডিং'}
                        color={r.status === 'paid' ? 'success' : 'warning'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        {r.status !== 'paid' && (
                          <Button
                            variant="contained"
                            color="success"
                            size="small"
                            startIcon={<PaymentIcon />}
                            onClick={() => handleOpenPayDialog(r)}
                          >
                            পে করুন
                          </Button>
                        )}
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<PrintIcon />}
                          onClick={() => navigate(`/school/${schoolId}/payslip/${r.id}`)}
                        >
                          পে স্লিপ
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {payrollRecords.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4, opacity: 0.7 }}>
                      {monthsBn[month - 1]} {year}-এর জন্য কোনো পে-রোল রেকর্ড পাওয়া যায়নি। উপরের বোতাম থেকে জেনারেট করুন।
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Pay Dialog */}
      <Dialog open={payDialogOpen} onClose={() => setPayDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>বেতন পরিশোধ করুন</DialogTitle>
        <DialogContent dividers>
          {selectedRecord && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body1">
                <strong>শিক্ষক:</strong> {selectedRecord.teacher_name}
              </Typography>
              <Typography variant="body1">
                <strong>নিট পরিমাণ:</strong> ৳ {Number(selectedRecord.net_salary).toLocaleString()}
              </Typography>

              <TextField
                select
                fullWidth
                label="পেমেন্ট মাধ্যম"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                size="small"
              >
                <MenuItem value="cash">নগদ (Cash)</MenuItem>
                <MenuItem value="bank_transfer">ব্যাংক ট্রান্সফার (Bank Transfer)</MenuItem>
                <MenuItem value="mobile_banking">মোবাইল ব্যাংকিং (bKash/Nagad)</MenuItem>
                <MenuItem value="cheque">চেক (Cheque)</MenuItem>
              </TextField>

              <TextField
                fullWidth
                label="ট্রানজিশন / চেক নাম্বার (ঐচ্ছিক)"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                size="small"
              />

              <TextField
                fullWidth
                label="মন্তব্য (ঐচ্ছিক)"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                multiline
                rows={2}
                size="small"
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayDialogOpen(false)}>বাতিল</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleProcessPayment}
            disabled={paying}
          >
            {paying ? 'প্রসেস হচ্ছে...' : 'কনফার্ম পে করুন'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
