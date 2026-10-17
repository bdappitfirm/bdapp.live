import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Button,
  Table, TableHead, TableRow, TableCell, TableBody, Tabs, Tab,
  TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Stack, Divider, Chip
} from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PrintIcon from '@mui/icons-material/Print';
import SchoolIcon from '@mui/icons-material/School';
import { useToast } from '../components/Toast';
import dayjs from 'dayjs';

export default function SoftwareAccountsPage() {
  const toast = useToast();

  const [tabIndex, setTabIndex] = useState(0);
  const [summary, setSummary] = useState({
    total_income: 0,
    manual_income_total: 0,
    billing_income_total: 0,
    total_expense: 0,
    net_balance: 0,
    expense_by_category: [],
    income_by_type: [],
    schools_summary: []
  });
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [schools, setSchools] = useState([]);
  const [editingIncomeId, setEditingIncomeId] = useState(null);
  const [editingExpenseId, setEditingExpenseId] = useState(null);

  // Dialog states
  const [openIncomeDialog, setOpenIncomeDialog] = useState(false);
  const [openExpenseDialog, setOpenExpenseDialog] = useState(false);

  // Form states for Income
  const [incomeForm, setIncomeForm] = useState({
    school: '',
    title: 'Monthly Software Fee',
    amount: '',
    income_date: dayjs().format('YYYY-MM-DD'),
    payment_method: 'bKash',
    income_type: 'monthly',
    notes: ''
  });

  // Form states for Expense
  const [expenseForm, setExpenseForm] = useState({
    category: 'vps',
    title: '',
    amount: '',
    expense_date: dayjs().format('YYYY-MM-DD'),
    paid_to: '',
    notes: ''
  });

  const fetchData = async () => {
    try {
      const [summaryRes, incomesRes, expensesRes, schoolsRes] = await Promise.all([
        api.get('/api/software-accounts/summary/'),
        api.get('/api/software-accounts/incomes/'),
        api.get('/api/software-accounts/expenses/'),
        api.get('/api/schools/')
      ]);

      setSummary(summaryRes.data);
      setIncomes(Array.isArray(incomesRes.data) ? incomesRes.data : (incomesRes.data?.results || []));
      setExpenses(Array.isArray(expensesRes.data) ? expensesRes.data : (expensesRes.data?.results || []));
      setSchools(Array.isArray(schoolsRes.data) ? schoolsRes.data : (schoolsRes.data?.results || []));
    } catch (err) {
      console.error('Failed to fetch software accounts data', err);
      toast.error('ডেটা লোড করতে সমস্যা হয়েছে');
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEditIncome = (inc) => {
    setEditingIncomeId(inc.id);
    setIncomeForm({
      school: inc.school || '',
      title: inc.title || '',
      amount: inc.amount || '',
      income_date: inc.income_date || dayjs().format('YYYY-MM-DD'),
      payment_method: inc.payment_method || 'bKash',
      income_type: inc.income_type || 'monthly',
      notes: inc.notes || ''
    });
    setOpenIncomeDialog(true);
  };

  const handleSaveIncome = async () => {
    try {
      if (!incomeForm.amount || !incomeForm.title) {
        toast.error('অনুগ্রহ করে শিরোনাম ও পরিমাণ পূরণ করুন');
        return;
      }
      if (editingIncomeId) {
        await api.put(`/api/software-accounts/incomes/${editingIncomeId}/`, incomeForm);
        toast.success('আয় সফলভাবে আপডেট হয়েছে');
      } else {
        await api.post('/api/software-accounts/incomes/', incomeForm);
        toast.success('আয় সফলভাবে যুক্ত হয়েছে');
      }
      setOpenIncomeDialog(false);
      setEditingIncomeId(null);
      setIncomeForm({
        school: '',
        title: 'Monthly Software Fee',
        amount: '',
        income_date: dayjs().format('YYYY-MM-DD'),
        payment_method: 'bKash',
        income_type: 'monthly',
        notes: ''
      });
      fetchData();
    } catch (err) {
      toast.error('আয় সংরক্ষণে সমস্যা হয়েছে');
    }
  };

  const handleEditExpense = (exp) => {
    setEditingExpenseId(exp.id);
    setExpenseForm({
      category: exp.category || 'vps',
      title: exp.title || '',
      amount: exp.amount || '',
      expense_date: exp.expense_date || dayjs().format('YYYY-MM-DD'),
      paid_to: exp.paid_to || '',
      notes: exp.notes || ''
    });
    setOpenExpenseDialog(true);
  };

  const handleSaveExpense = async () => {
    try {
      if (!expenseForm.amount || !expenseForm.title || !expenseForm.category) {
        toast.error('অনুগ্রহ করে ক্যাটাগরি, শিরোনাম ও পরিমাণ পূরণ করুন');
        return;
      }
      if (editingExpenseId) {
        await api.put(`/api/software-accounts/expenses/${editingExpenseId}/`, expenseForm);
        toast.success('ব্যয় সফলভাবে আপডেট হয়েছে');
      } else {
        await api.post('/api/software-accounts/expenses/', expenseForm);
        toast.success('ব্যয় সফলভাবে যুক্ত হয়েছে');
      }
      setOpenExpenseDialog(false);
      setEditingExpenseId(null);
      setExpenseForm({
        category: 'vps',
        title: '',
        amount: '',
        expense_date: dayjs().format('YYYY-MM-DD'),
        paid_to: '',
        notes: ''
      });
      fetchData();
    } catch (err) {
      toast.error('ব্যয় সংরক্ষণে সমস্যা হয়েছে');
    }
  };

  const handleDeleteIncome = async (id) => {
    if (!window.confirm('আপনি কি এই আয়টি ডিলিট করতে চান?')) return;
    try {
      await api.delete(`/api/software-accounts/incomes/${id}/`);
      toast.success('আয় মুছে ফেলা হয়েছে');
      fetchData();
    } catch (err) {
      toast.error('মুছে ফেলতে সমস্যা হয়েছে');
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('আপনি কি এই ব্যয়টি ডিলিট করতে চান?')) return;
    try {
      await api.delete(`/api/software-accounts/expenses/${id}/`);
      toast.success('ব্যয় মুছে ফেলা হয়েছে');
      fetchData();
    } catch (err) {
      toast.error('মুছে ফেলতে সমস্যা হয়েছে');
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Paper sx={{ p: 3, mb: 3 }} elevation={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccountBalanceIcon color="primary" /> সর্বপ্রকার আয় ও ব্যয় হিসাব নিকাশ (সফটওয়্যার ফার্ম)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              সকল স্কুল থেকে সফটওয়্যার ফি ও পেমেন্ট এবং সকল প্রকার ব্যয় (ভিপিএস, ইন্টারনেট, অফিসভাড়া, বেতন, টিএ, ডিএ, বোনাস ইত্যাদি) অটোমেটিক হিসাব
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
              setEditingIncomeId(null);
              setIncomeForm({
                school: '',
                title: 'Monthly Software Fee',
                amount: '',
                income_date: dayjs().format('YYYY-MM-DD'),
                payment_method: 'bKash',
                income_type: 'monthly',
                notes: ''
              });
              setOpenIncomeDialog(true);
            }} color="success">
              নতুন আয় যোগ করুন
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
              setEditingExpenseId(null);
              setExpenseForm({
                category: 'vps',
                title: '',
                amount: '',
                expense_date: dayjs().format('YYYY-MM-DD'),
                paid_to: '',
                notes: ''
              });
              setOpenExpenseDialog(true);
            }} color="error">
              নতুন ব্যয় যোগ করুন
            </Button>
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()}>
              প্রিন্ট
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #2e7d32 0%, #4caf50 100%)', color: 'white' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="subtitle2">মোট আয় (Total Income)</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 1 }}>
                    ৳ {Number(summary.total_income).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
                <TrendingUpIcon sx={{ fontSize: 48, opacity: 0.8 }} />
              </Stack>
              <Typography variant="caption" sx={{ mt: 2, display: 'block', opacity: 0.9 }}>
                (স্কুল বিলিং ও অন্যান্য আয় সহ)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #c62828 0%, #e53935 100%)', color: 'white' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="subtitle2">মোট ব্যয় (Total Expense)</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 1 }}>
                    ৳ {Number(summary.total_expense).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
                <TrendingDownIcon sx={{ fontSize: 48, opacity: 0.8 }} />
              </Stack>
              <Typography variant="caption" sx={{ mt: 2, display: 'block', opacity: 0.9 }}>
                (ভিপিএস, ইন্টারনেট, অফিস, বেতন, বোনাস ইত্যাদি)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ background: summary.net_balance >= 0 ? 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)' : 'linear-gradient(135deg, #ef6c00 0%, #ffa726 100%)', color: 'white' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="subtitle2">উদ্ধৃত্ত / জের (Net Balance / উদ্ধুতি)</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 1 }}>
                    ৳ {Number(summary.net_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
                <AccountBalanceIcon sx={{ fontSize: 48, opacity: 0.8 }} />
              </Stack>
              <Typography variant="caption" sx={{ mt: 2, display: 'block', opacity: 0.9 }}>
                {summary.net_balance >= 0 ? 'অটোমেটিক আপডেট (লাভজনক অবস্থা)' : 'অটোমেটিক আপডেট (ঘাটতি অবস্থা)'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabIndex} onChange={(_, val) => setTabIndex(val)} variant="scrollable" scrollButtons="auto">
          <Tab label="সকল স্কুলের আয় ও পেমেন্ট (School Incomes)" />
          <Tab label="সকল ব্যয় হিসাব (All Expenses - VPS, Salary, Rent etc.)" />
          <Tab label="ম্যানুয়াল আয় এন্ট্রি (Manual Income Records)" />
          <Tab label="আয়-ব্যয় সারাংশ ও রিপোর্ট (Summary & Report)" />
        </Tabs>
      </Paper>

      {/* Tab 0: School Incomes / Billing Overview */}
      {tabIndex === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
            সকল স্কুল থেকে সফটওয়্যার বাবদ মাসিক/বাৎসরিক পেমেন্ট ও আয়
          </Typography>
          <Table size="small">
            <TableHead sx={{ bgcolor: 'grey.100' }}>
              <TableRow>
                <TableCell>স্কুল নাম</TableCell>
                <TableCell>EIIN</TableCell>
                <TableCell align="center">শিক্ষার্থী সংখ্যা</TableCell>
                <TableCell align="right">পরিশোধিত টাকা (Total Paid)</TableCell>
                <TableCell align="center">লিঙ্ক</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.schools_summary?.map((sch) => (
                <TableRow key={sch.id} hover>
                  <TableCell sx={{ fontWeight: 'medium' }}>{sch.name}</TableCell>
                  <TableCell>{sch.ein || 'N/A'}</TableCell>
                  <TableCell align="center">
                    <Chip label={sch.student_count} size="small" color="primary" variant="outlined" />
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                    ৳ {Number(sch.total_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell align="center">
                    <Button size="small" href={`/school/${sch.id}`} target="_blank" startIcon={<SchoolIcon />}>
                      ভিজিট
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Tab 1: All Expenses */}
      {tabIndex === 1 && (
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              সর্বপ্রকার ব্যয় (ভিপিএস, ইন্টারনেট, অফিসভাড়া, বিদ্যুৎ, বেতন, টিএ, ডিএ, বোনাস ইত্যাদি)
            </Typography>
            <Button variant="contained" size="small" onClick={() => {
              setEditingExpenseId(null);
              setExpenseForm({
                category: 'vps',
                title: '',
                amount: '',
                expense_date: dayjs().format('YYYY-MM-DD'),
                paid_to: '',
                notes: ''
              });
              setOpenExpenseDialog(true);
            }}>
              ব্যয় যোগ করুন
            </Button>
          </Stack>
          <Table size="small">
            <TableHead sx={{ bgcolor: 'grey.100' }}>
              <TableRow>
                <TableCell>তারিখ</TableCell>
                <TableCell>ক্যাটাগরি</TableCell>
                <TableCell>বিবরণ / শিরোনাম</TableCell>
                <TableCell>প্রাপক (Paid To)</TableCell>
                <TableCell align="right">পরিমাণ (BDT)</TableCell>
                <TableCell align="center">অ্যাকশন</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">কোনো ব্যয় এন্ট্রি পাওয়া যায়নি</TableCell>
                </TableRow>
              ) : (
                expenses.map((exp) => (
                  <TableRow key={exp.id} hover>
                    <TableCell>{exp.expense_date}</TableCell>
                    <TableCell>
                      <Chip label={exp.category_display || exp.category} size="small" color="error" variant="outlined" />
                    </TableCell>
                    <TableCell>{exp.title}</TableCell>
                    <TableCell>{exp.paid_to || '-'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                      ৳ {Number(exp.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <IconButton size="small" color="primary" onClick={() => handleEditExpense(exp)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDeleteExpense(exp.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Tab 2: Manual Income Records */}
      {tabIndex === 2 && (
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              ম্যানুয়াল আয় ও অতিরিক্ত পেমেন্ট এন্ট্রি
            </Typography>
            <Button variant="contained" size="small" onClick={() => {
              setEditingIncomeId(null);
              setIncomeForm({
                school: '',
                title: 'Monthly Software Fee',
                amount: '',
                income_date: dayjs().format('YYYY-MM-DD'),
                payment_method: 'bKash',
                income_type: 'monthly',
                notes: ''
              });
              setOpenIncomeDialog(true);
            }}>
              আয় যোগ করুন
            </Button>
          </Stack>
          <Table size="small">
            <TableHead sx={{ bgcolor: 'grey.100' }}>
              <TableRow>
                <TableCell>তারিখ</TableCell>
                <TableCell>স্কুল (যদি থাকে)</TableCell>
                <TableCell>শিরোনাম</TableCell>
                <TableCell>পেমেন্ট মাধ্যম</TableCell>
                <TableCell align="right">পরিমাণ (BDT)</TableCell>
                <TableCell align="center">অ্যাকশন</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {incomes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">কোনো ম্যানুয়াল আয় এন্ট্রি নেই</TableCell>
                </TableRow>
              ) : (
                incomes.map((inc) => (
                  <TableRow key={inc.id} hover>
                    <TableCell>{inc.income_date}</TableCell>
                    <TableCell>{inc.school_name || 'General / External'}</TableCell>
                    <TableCell>{inc.title}</TableCell>
                    <TableCell>{inc.payment_method}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                      ৳ {Number(inc.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <IconButton size="small" color="primary" onClick={() => handleEditIncome(inc)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDeleteIncome(inc.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Tab 3: Summary & Report */}
      {tabIndex === 3 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                ব্যয়ের ক্যাটাগরিভিত্তিক সারসংক্ষেপ
              </Typography>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    <TableCell>ব্যয়ের খাত</TableCell>
                    <TableCell align="right">মোট পরিমাণ (BDT)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summary.expense_by_category?.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.category_display}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                        ৳ {Number(item.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                আয় ও উদ্বৃত্ত বিবরণী
              </Typography>
              <Stack spacing={2} sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, bgcolor: 'success.light', color: 'success.contrastText', borderRadius: 1 }}>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>মোট আয়:</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>৳ {Number(summary.total_income).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, bgcolor: 'error.light', color: 'error.contrastText', borderRadius: 1 }}>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>মোট ব্যয়:</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>৳ {Number(summary.total_expense).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2, bgcolor: 'primary.main', color: 'white', borderRadius: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>নিট উদ্ধৃত্ত (Net Balance):</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>৳ {Number(summary.net_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Add Income Dialog */}
      <Dialog open={openIncomeDialog} onClose={() => setOpenIncomeDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          {editingIncomeId ? 'আয় এন্ট্রি এডিট করুন' : 'নতুন আয় এন্ট্রি যোগ করুন'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="স্কুল নির্বাচন করুন (ঐচ্ছিক)"
              fullWidth
              value={incomeForm.school}
              onChange={(e) => setIncomeForm({ ...incomeForm, school: e.target.value })}
            >
              <MenuItem value="">-- সাধারণ আয় / কোনো নির্দিষ্ট স্কুল নয় --</MenuItem>
              {schools.map(s => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="আয়ের শিরোনাম"
              fullWidth
              value={incomeForm.title}
              onChange={(e) => setIncomeForm({ ...incomeForm, title: e.target.value })}
            />
            <TextField
              label="পরিমাণ (BDT)"
              type="number"
              fullWidth
              value={incomeForm.amount}
              onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
            />
            <TextField
              select
              label="আয়ের ধরন"
              fullWidth
              value={incomeForm.income_type}
              onChange={(e) => setIncomeForm({ ...incomeForm, income_type: e.target.value })}
            >
              <MenuItem value="monthly">মাসিক সাবস্ক্রিপশন (Monthly)</MenuItem>
              <MenuItem value="yearly">বাৎসরিক সাবস্ক্রিপশন (Yearly)</MenuItem>
              <MenuItem value="one_time">এককালীন ফি (One-time)</MenuItem>
              <MenuItem value="other">অন্যান্য</MenuItem>
            </TextField>
            <TextField
              select
              label="পেমেন্ট মাধ্যম"
              fullWidth
              value={incomeForm.payment_method}
              onChange={(e) => setIncomeForm({ ...incomeForm, payment_method: e.target.value })}
            >
              <MenuItem value="bKash">বিকাশ (bKash)</MenuItem>
              <MenuItem value="Nagad">নগদ (Nagad)</MenuItem>
              <MenuItem value="Bank">ব্যাংক ট্রান্সফার (Bank)</MenuItem>
              <MenuItem value="Cash">নগদ টাকা (Cash)</MenuItem>
              <MenuItem value="Other">অন্যান্য</MenuItem>
            </TextField>
            <TextField
              label="তারিখ"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={incomeForm.income_date}
              onChange={(e) => setIncomeForm({ ...incomeForm, income_date: e.target.value })}
            />
            <TextField
              label="নোট / বিবরণ"
              multiline
              rows={2}
              fullWidth
              value={incomeForm.notes}
              onChange={(e) => setIncomeForm({ ...incomeForm, notes: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenIncomeDialog(false)}>বাতিল</Button>
          <Button variant="contained" onClick={handleSaveIncome}>সংরক্ষণ করুন</Button>
        </DialogActions>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog open={openExpenseDialog} onClose={() => setOpenExpenseDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          {editingExpenseId ? 'ব্যয় এন্ট্রি এডিট করুন' : 'নতুন ব্যয় এন্ট্রি যোগ করুন (ভিপিএস, ইন্টারনেট, বেতন ইত্যাদি)'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="ব্যয়ের ক্যাটাগরি"
              fullWidth
              value={expenseForm.category}
              onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
            >
              <MenuItem value="vps">ভিপিএস ও সার্ভার (VPS & Server)</MenuItem>
              <MenuItem value="internet">ইন্টারনেট বিল (Internet Bill)</MenuItem>
              <MenuItem value="office_rent">অফিস ভাড়া (Office Rent)</MenuItem>
              <MenuItem value="electricity">বিদ্যুৎ বিল (Electricity Bill)</MenuItem>
              <MenuItem value="salary">কর্মকর্তা-কর্মচারীদের বেতন (Salary)</MenuItem>
              <MenuItem value="ta_da">টিএ ও ডিএ (TA & DA)</MenuItem>
              <MenuItem value="bonus">বোনাস (Bonus)</MenuItem>
              <MenuItem value="other">অন্যান্য ব্যয় (Other Expenses)</MenuItem>
            </TextField>
            <TextField
              label="ব্যয়ের বিবরণ / শিরোনাম"
              fullWidth
              placeholder="যেমন: অক্টোবর মাসের অফিস ভাড়া / ক্লাউড সার্ভার বিল"
              value={expenseForm.title}
              onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
            />
            <TextField
              label="পরিমাণ (BDT)"
              type="number"
              fullWidth
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
            />
            <TextField
              label="প্রাপক / কার কাছে পরিশোধ করা হয়েছে"
              fullWidth
              placeholder="যেমন: ল্যান্ডলর্ড / আইএসপি / কর্মচারীর নাম"
              value={expenseForm.paid_to}
              onChange={(e) => setExpenseForm({ ...expenseForm, paid_to: e.target.value })}
            />
            <TextField
              label="তারিখ"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={expenseForm.expense_date}
              onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
            />
            <TextField
              label="নোট / মন্তব্য"
              multiline
              rows={2}
              fullWidth
              value={expenseForm.notes}
              onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenExpenseDialog(false)}>বাতিল</Button>
          <Button variant="contained" color="error" onClick={handleSaveExpense}>ব্যয় সংরক্ষণ করুন</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
