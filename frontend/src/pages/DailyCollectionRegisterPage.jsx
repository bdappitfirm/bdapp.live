import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Grid, TextField, MenuItem, Select,
  FormControl, InputLabel, CircularProgress, Alert, Snackbar, Stack,
  IconButton, ToggleButtonGroup, ToggleButton, Autocomplete
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../utils/api';
import dayjs from 'dayjs';
import { useAuth } from '../context/AuthContext';
import { useSchool } from '../context/SchoolContext';
import { resolveSchoolLogo } from '../utils/media';
import { canAccessDailyCollectionRegister, numberToBengaliWords } from '../utils/helpers';

const DailyCollectionRegisterPage = () => {
  const { id: schoolId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { school: schoolInfo } = useSchool();
  const schoolLogo = resolveSchoolLogo(schoolInfo);

  const [loading, setLoading] = useState(false);
  const [savingStatus, setSavingStatus] = useState(''); // 'saving', 'saved'
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Always use local dayjs format for current date
  const todayStr = dayjs().format('YYYY-MM-DD');
  const [reportMode, setReportMode] = useState('single_date'); // single_date, single_month, three_months, year_to_date
  const [selectedMonth, setSelectedMonth] = useState(() => dayjs().month() + 1);
  const [endMonth, setEndMonth] = useState(() => Math.min(dayjs().month() + 3, 12));
  const [selectedYear, setSelectedYear] = useState(() => dayjs().year());
  const [selectedDate, setSelectedDate] = useState(() => dayjs().format('YYYY-MM-DD'));

  // Class, Section selection
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');

  // Class students cache for quick lookup
  const [classStudents, setClassStudents] = useState([]);
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState(null);

  // Active students displayed in the collection register table
  const [activeStudents, setActiveStudents] = useState([]);
  const [editingRows, setEditingRows] = useState({}); // studentId -> fee heads object

  // Debounce timers reference for auto-save per student
  const saveTimersRef = useRef({});

  const monthsBn = [
    { value: 1, label: 'জানুয়ারি' },
    { value: 2, label: 'ফেব্রুয়ারি' },
    { value: 3, label: 'মার্চ' },
    { value: 4, label: 'এপ্রিল' },
    { value: 5, label: 'মে' },
    { value: 6, label: 'জুন' },
    { value: 7, label: 'জুলাই' },
    { value: 8, label: 'আগস্ট' },
    { value: 9, label: 'সেপ্টেম্বর' },
    { value: 10, label: 'অক্টোবর' },
    { value: 11, label: 'নভেম্বর' },
    { value: 12, label: 'ডিসেম্বর' },
  ];

  const yearsList = useMemo(() => {
    const currentY = new Date().getFullYear();
    const list = [];
    for (let y = currentY; y >= currentY - 8; y--) {
      list.push(y);
    }
    return list;
  }, []);

  const hasAccess = canAccessDailyCollectionRegister(user);

  // Fetch classes and sections on mount, and auto-load saved payments for current/selected date
  const loadSavedPaymentsForDate = useCallback(async () => {
    try {
      setLoading(true);
      const targetDate = reportMode === 'single_date' ? selectedDate : todayStr;
      let payUrl = `/api/fees/payments/?school=${schoolId}&page_size=1000`;
      if (reportMode === 'single_date') {
        payUrl += `&payment_date=${targetDate}`;
      }

      const [payRes, clsRes, secRes] = await Promise.all([
        api.get(payUrl),
        api.get(`/api/academics/classrooms/?school=${schoolId}&page_size=1000`),
        api.get(`/api/academics/sections/?school=${schoolId}&page_size=1000`)
      ]);

      setClasses(Array.isArray(clsRes.data) ? clsRes.data : clsRes.data?.results || []);
      setSections(Array.isArray(secRes.data) ? secRes.data : secRes.data?.results || []);

      const payData = Array.isArray(payRes.data) ? payRes.data : payRes.data?.results || [];

      // Filter payments based on report mode
      const datePayments = payData.filter(p => {
        if (!p.payment_date) return false;
        const pDate = String(p.payment_date).trim();
        if (reportMode === 'single_date') {
          return pDate === targetDate;
        }
        const [pYearStr, pMonthStr] = pDate.split('-');
        const pYear = parseInt(pYearStr, 10);
        const pMonth = parseInt(pMonthStr, 10);
        if (reportMode === 'single_month') {
          return pYear === selectedYear && pMonth === selectedMonth;
        }
        if (reportMode === 'three_months') {
          return pYear === selectedYear && pMonth >= selectedMonth && pMonth <= endMonth;
        }
        if (reportMode === 'year_to_date') {
          return pYear === selectedYear;
        }
        return pDate === targetDate;
      });

      if (datePayments.length > 0) {
        // শুধু যেসব শিক্ষার্থীর পেমেন্ট আছে তাদের আইডি দিয়ে আনা হয়, নয়তো শিক্ষার্থী তালিকার
        // পেজিনেশন সীমার (প্রথম ১০০) বাইরের পেমেন্টগুলো নীরবে বাদ পড়ে যায়
        const paidStudentIds = [...new Set(datePayments.map(p => String(p.student_id || p.student?.id || p.student)).filter(Boolean))];
        const studRes = await api.get(`/api/academics/students/?school=${schoolId}&ids=${paidStudentIds.join(',')}&page_size=${paidStudentIds.length}`);
        const allStudents = Array.isArray(studRes.data) ? studRes.data : studRes.data?.results || [];

        const studentMap = {};
        allStudents.forEach(s => {
          studentMap[String(s.id)] = {
            id: String(s.id),
            display_name: s.display_name || s.full_name || `${s.user?.first_name || ''} ${s.user?.last_name || ''}`.trim() || s.user?.username || 'Student',
            roll_number: s.roll_number || '',
            ...s
          };
        });

        const loadedStudents = [];
        const initialRows = {};

        const paymentsByStudent = {};
        datePayments.forEach(p => {
          const sId = String(p.student_id || p.student?.id || p.student);
          if (!paymentsByStudent[sId]) paymentsByStudent[sId] = [];
          paymentsByStudent[sId].push(p);
        });

        Object.entries(paymentsByStudent).forEach(([sId, payments]) => {
          const studentObj = studentMap[sId];
          if (studentObj) {
            loadedStudents.push(studentObj);
            const latest = payments[payments.length - 1];

            const aggregated = {
              receipt_number: latest.receipt_number || '—',
              due_amount: 0,
              sports_fee: 0,
              admission_fee: 0,
              admission_print_fee: 0,
              cert_reg_fee: 0,
              tuition_fee: 0,
              religion_fee: 0,
              session_fee: 0,
              exam_fee: 0,
              culture_library_fee: 0,
              refreshment_poor_fund_fee: 0,
              misc_fee: 0,
              existing_id: latest.id,
              payment_ids: payments.map(p => p.id)
            };

            payments.forEach(p => {
              ['due_amount', 'sports_fee', 'admission_fee', 'admission_print_fee', 'cert_reg_fee', 'tuition_fee', 'religion_fee', 'session_fee', 'exam_fee', 'culture_library_fee', 'refreshment_poor_fund_fee', 'misc_fee'].forEach(f => {
                const curr = parseFloat(aggregated[f]) || 0;
                const add = parseFloat(p[f]) || 0;
                aggregated[f] = curr + add;
              });
            });

            ['due_amount', 'sports_fee', 'admission_fee', 'admission_print_fee', 'cert_reg_fee', 'tuition_fee', 'religion_fee', 'session_fee', 'exam_fee', 'culture_library_fee', 'refreshment_poor_fund_fee', 'misc_fee'].forEach(f => {
              if (aggregated[f] === 0) aggregated[f] = '';
            });

            initialRows[sId] = aggregated;
          }
        });

        setActiveStudents(loadedStudents);
        setEditingRows(initialRows);
      } else {
        setActiveStudents([]);
        setEditingRows({});
      }
    } catch (err) {
      console.error('Error loading saved payments for date:', err);
    } finally {
      setLoading(false);
    }
  }, [schoolId, reportMode, selectedDate, todayStr, selectedMonth, endMonth, selectedYear]);

  useEffect(() => {
    if (hasAccess) {
      loadSavedPaymentsForDate();
    }
  }, [hasAccess, loadSavedPaymentsForDate]);

  const availableSections = useMemo(() => {
    if (!selectedClass) return [];
    return sections.filter(sec => String(sec.classroom?.id ?? sec.classroom) === String(selectedClass));
  }, [sections, selectedClass]);

  // Fetch student list for the selected class/section for autocomplete search
  const fetchClassStudents = useCallback(async (classId, sectionId) => {
    if (!classId) {
      setClassStudents([]);
      return;
    }
    try {
      let url = `/api/academics/students/?school=${schoolId}&classroom=${classId}`;
      if (sectionId) {
        url += `&section=${sectionId}`;
      }
      const res = await api.get(url);
      const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
      const formatted = data.map(s => {
        const dn = s.display_name || s.full_name || `${s.user?.first_name || ''} ${s.user?.last_name || ''}`.trim() || s.user?.username || 'Student';
        return { id: String(s.id), display_name: dn, roll_number: s.roll_number || '', ...s };
      }).sort((a, b) => {
        const ar = parseInt(String(a.roll_number).replace(/\D/g, ''), 10) || 0;
        const br = parseInt(String(b.roll_number).replace(/\D/g, ''), 10) || 0;
        return ar - br;
      });
      setClassStudents(formatted);
    } catch (err) {
      console.error('Error loading class students:', err);
    }
  }, [schoolId]);

  useEffect(() => {
    if (selectedClass) {
      fetchClassStudents(selectedClass, selectedSection);
    } else {
      setClassStudents([]);
    }
  }, [selectedClass, selectedSection, fetchClassStudents]);

  // Add selected student to active table view
  const handleAddStudent = () => {
    if (!selectedStudentToAdd) return;
    const student = selectedStudentToAdd;
    const sId = student.id;

    if (!activeStudents.some(s => s.id === sId)) {
      setActiveStudents(prev => [...prev, student]);

      const emptyFeeRow = {
        receipt_number: '—',
        due_amount: '',
        sports_fee: '',
        admission_fee: '',
        admission_print_fee: '',
        cert_reg_fee: '',
        tuition_fee: '',
        religion_fee: '',
        session_fee: '',
        exam_fee: '',
        culture_library_fee: '',
        refreshment_poor_fund_fee: '',
        misc_fee: '',
        existing_id: null
      };

      setEditingRows(prev => ({
        ...prev,
        [sId]: emptyFeeRow
      }));
    }
    setSelectedStudentToAdd(null);
  };

  const handleRemoveStudent = async (studentId) => {
    const rowData = editingRows[studentId];
    if (rowData) {
      try {
        const idsToDelete = rowData.payment_ids || (rowData.existing_id ? [rowData.existing_id] : []);
        if (idsToDelete.length > 0) {
          await Promise.all(idsToDelete.map(id => api.delete(`/api/fees/payments/${id}/`)));
        }
      } catch (err) {
        console.error('Error deleting payment(s):', err);
      }
    }
    setActiveStudents(prev => prev.filter(s => s.id !== studentId));
    setEditingRows(prev => {
      const copy = { ...prev };
      delete copy[studentId];
      return copy;
    });
    setSnackbar({ open: true, message: 'পেমেন্ট সফলভাবে মুছে ফেলা হয়েছে', severity: 'success' });
  };

  // Perform auto-save for a specific student row
  const persistStudentRow = async (studentId, currentRow) => {
    if (!currentRow) return;
    try {
      setSavingStatus('saving');
      const total = [
        'sports_fee', 'admission_fee', 'admission_print_fee', 'cert_reg_fee',
        'tuition_fee', 'religion_fee', 'session_fee', 'exam_fee',
        'culture_library_fee', 'refreshment_poor_fund_fee', 'misc_fee'
      ].reduce((sum, f) => sum + (parseFloat(currentRow[f]) || 0), 0);

      const payload = {
        student_id: studentId,
        amount: total,
        payment_date: selectedDate,
        payment_status: 'completed',
        payment_method: 'cash',
        due_amount: parseFloat(currentRow.due_amount) || 0,
        sports_fee: parseFloat(currentRow.sports_fee) || 0,
        admission_fee: parseFloat(currentRow.admission_fee) || 0,
        admission_print_fee: parseFloat(currentRow.admission_print_fee) || 0,
        cert_reg_fee: parseFloat(currentRow.cert_reg_fee) || 0,
        tuition_fee: parseFloat(currentRow.tuition_fee) || 0,
        religion_fee: parseFloat(currentRow.religion_fee) || 0,
        session_fee: parseFloat(currentRow.session_fee) || 0,
        exam_fee: parseFloat(currentRow.exam_fee) || 0,
        culture_library_fee: parseFloat(currentRow.culture_library_fee) || 0,
        refreshment_poor_fund_fee: parseFloat(currentRow.refreshment_poor_fund_fee) || 0,
        misc_fee: parseFloat(currentRow.misc_fee) || 0,
      };

      if (currentRow.existing_id) {
        const res = await api.put(`/api/fees/payments/${currentRow.existing_id}/`, payload);
        if (res.data?.receipt_number) {
          setEditingRows(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], receipt_number: res.data.receipt_number }
          }));
        }
      } else {
        const res = await api.post(`/api/fees/payments/`, payload);
        if (res.data?.id) {
          setEditingRows(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], existing_id: res.data.id, receipt_number: res.data.receipt_number || '—' }
          }));
        }
      }
      setSavingStatus('saved');
    } catch (err) {
      console.error('Auto-save error:', err);
      setSavingStatus('error');
    }
  };

  const handleFieldChange = (studentId, field, value) => {
    setEditingRows(prev => {
      const updatedRow = {
        ...prev[studentId],
        [field]: value
      };
      return {
        ...prev,
        [studentId]: updatedRow
      };
    });

    // Debounced auto-save (600ms after typing stops)
    if (saveTimersRef.current[studentId]) {
      clearTimeout(saveTimersRef.current[studentId]);
    }

    saveTimersRef.current[studentId] = setTimeout(() => {
      setEditingRows(latestState => {
        const rowToSave = latestState[studentId];
        persistStudentRow(studentId, rowToSave);
        return latestState;
      });
    }, 600);
  };

  const calculateRowTotal = (row) => {
    if (!row) return 0;
    const fields = [
      'sports_fee', 'admission_fee', 'admission_print_fee', 'cert_reg_fee',
      'tuition_fee', 'religion_fee', 'session_fee', 'exam_fee',
      'culture_library_fee', 'refreshment_poor_fund_fee', 'misc_fee'
    ];
    return fields.reduce((sum, f) => {
      const val = parseFloat(row[f]);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  };

  const grandTotal = useMemo(() => {
    let total = 0;
    activeStudents.forEach(s => {
      total += calculateRowTotal(editingRows[s.id]);
    });
    return total;
  }, [activeStudents, editingRows]);

  const handlePrint = () => {
    window.print();
  };

  const monthNameBn = monthsBn.find(m => m.value === Number(selectedMonth))?.label || 'জানুয়ারি';
  const endMonthNameBn = monthsBn.find(m => m.value === Number(endMonth))?.label || '';

  if (!hasAccess) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Alert severity="error" sx={{ mb: 2 }}>আপনার এই পেজটি দেখার অনুমতি নেই। শুধুমাত্র বিডিএডমিন, প্রধান শিক্ষক এবং হিসাব সহকারী এই রেজিস্টার দেখতে পারবেন।</Alert>
        <Button variant="contained" onClick={() => navigate(-1)}>ফিরে যান</Button>
      </Box>
    );
  }

  return (
    <Box className="dcr-root" sx={{ p: { xs: 2, md: 3 }, maxWidth: '100%', overflowX: 'auto' }}>
      <style>{`
        .dcr-print-header { display: none; }
        @media print {
          @page { size: A4 landscape; margin: 8mm; }

          /* শুধু মূল রেজিস্টার প্রিন্ট হবে — হেডার, নেভবার, সাইডবার ও কন্ট্রোল লুকানো হবে */
          .no-print,
          header, footer, nav,
          .MuiAppBar-root, .MuiToolbar-root, .MuiDrawer-root,
          .MuiBackdrop-root, .MuiSnackbar-root, .MuiAlert-root {
            display: none !important;
          }

          /* প্রিন্টে স্কুলের হেডার ও লোগো দেখানো হবে */
          .dcr-print-header { display: flex !important; }

          body, html, #root { height: auto !important; overflow: visible !important; background: #fff !important; }
          main, .print-content-wrapper, .dcr-root {
            margin: 0 !important; padding: 0 !important;
            overflow: visible !important; width: 100% !important; max-width: 100% !important;
          }

          /* টেবিল পুরোপুরি দেখাতে হবে — ডানে কাটা যাবে না, স্ক্রল-সীমাও থাকবে না */
          #printable-register {
            padding: 0 !important; margin: 0 !important;
            border: none !important; box-shadow: none !important;
            overflow: visible !important; width: 100% !important;
          }
          #printable-register .MuiTableContainer-root {
            overflow: visible !important; max-height: none !important; width: 100% !important;
          }
          #printable-register table {
            width: 100% !important; min-width: 0 !important;
            table-layout: fixed !important; border-collapse: collapse !important;
          }
          #printable-register th, #printable-register td {
            border: 1px solid #000 !important;
            font-size: 8pt !important; padding: 1px 2px !important; line-height: 1.15 !important;
          }
          /* কলাম প্রস্থ বিন্যাস (নাম ও রসিদ নং কলামে বেশি জায়গা) */
          #printable-register .dcr-main-table th:nth-child(1) { width: 4% !important; }
          #printable-register .dcr-main-table th:nth-child(2) { width: 5% !important; }
          #printable-register .dcr-main-table th:nth-child(3) { width: 5% !important; }
          #printable-register .dcr-main-table th:nth-child(4) { width: 4% !important; }
          #printable-register .dcr-main-table th:nth-child(5) { width: 12% !important; }
          #printable-register .dcr-main-table th:nth-child(6) { width: 7% !important; }

          /* এন্ট্রি বক্সগুলো প্রিন্টে সাধারণ টেক্সটের মতো দেখাবে */
          #printable-register .MuiFormControl-root { width: 100% !important; }
          #printable-register input {
            width: 100% !important; border: none !important; background: transparent !important;
            font-size: 8pt !important; padding: 0 !important; text-align: center !important;
          }
          #printable-register input::-webkit-outer-spin-button,
          #printable-register input::-webkit-inner-spin-button { -webkit-appearance: none !important; margin: 0 !important; }
          #printable-register input[type=number] { -moz-appearance: textfield !important; appearance: textfield !important; }

          tr { page-break-inside: avoid !important; break-inside: avoid !important; }
        }
      `}</style>

      {/* Top Header & Actions */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" mb={3} spacing={2} className="no-print">
        <Stack direction="row" spacing={2} alignItems="center">
          <IconButton onClick={() => navigate(-1)}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1a237e' }}>
            দৈনিক ও কালিক আদায় রেজিস্টার
          </Typography>
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center">
          {savingStatus === 'saving' && (
            <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
              অটো-সেভ হচ্ছে...
            </Typography>
          )}
          {savingStatus === 'saved' && (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'success.main' }}>
              <CloudDoneIcon fontSize="small" />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>সেভ হয়েছে</Typography>
            </Stack>
          )}
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
          >
            প্রিন্ট / পিডিএফ
          </Button>
        </Stack>
      </Stack>

      {snackbar.open && (
        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
        </Snackbar>
      )}

      {/* Class, Section & Student Selector Controls */}
      <Paper sx={{ p: 2, mb: 3 }} className="no-print">
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>রিপোর্টের ধরন:</Typography>
            <ToggleButtonGroup
              value={reportMode}
              exclusive
              onChange={(e, val) => val && setReportMode(val)}
              size="small"
              sx={{ flexWrap: 'wrap', gap: 1 }}
            >
              <ToggleButton value="single_date">নির্দিষ্ট তারিখ</ToggleButton>
              <ToggleButton value="single_month">সিঙ্গেল মাস</ToggleButton>
              <ToggleButton value="three_months">৩ মাসের হিসাব</ToggleButton>
              <ToggleButton value="year_to_date">জানুয়ারি ১ থেকে অদ্যবধি</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Grid container spacing={2} alignItems="center">
            {/* 1. Class Selector */}
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>শ্রেণি (Class)</InputLabel>
                <Select
                  value={selectedClass}
                  label="শ্রেণি (Class)"
                  onChange={(e) => {
                    setSelectedClass(e.target.value);
                    setSelectedSection('');
                    setSelectedStudentToAdd(null);
                  }}
                >
                  <MenuItem value="">সব শ্রেণি (All Classes)</MenuItem>
                  {classes.map(c => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* 2. Section Selector */}
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>শাখা (Section)</InputLabel>
                <Select
                  value={selectedSection}
                  label="শাখা (Section)"
                  onChange={(e) => {
                    setSelectedSection(e.target.value);
                    setSelectedStudentToAdd(null);
                  }}
                  disabled={!selectedClass}
                >
                  <MenuItem value="">সব শাখা (All Sections)</MenuItem>
                  {availableSections.map(s => (
                    <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* 3. Student Autocomplete (Roll/Name) to add to table */}
            <Grid item xs={12} sm={4}>
              <Autocomplete
                size="small"
                options={classStudents}
                getOptionLabel={(option) => `রোল: ${option.roll_number || '—'} | ${option.display_name}`}
                value={selectedStudentToAdd}
                onChange={(e, val) => setSelectedStudentToAdd(val)}
                renderInput={(params) => <TextField {...params} label="শিক্ষার্থী খুঁজুন (রোল বা নাম দিয়ে)" placeholder="রোল বা নাম লিখুন" />}
              />
            </Grid>

            <Grid item xs={12} sm={2}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddStudent}
                disabled={!selectedStudentToAdd}
              >
                যোগ করুন
              </Button>
            </Grid>

            {/* Date / Month / Year selectors */}
            {reportMode === 'single_date' && (
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="তারিখ"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </Grid>
            )}

            {(reportMode === 'single_month' || reportMode === 'three_months' || reportMode === 'year_to_date') && (
              <>
                <Grid item xs={12} sm={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>{reportMode === 'three_months' ? 'শুরু মাস' : 'মাসের নাম'}</InputLabel>
                    <Select
                      value={selectedMonth}
                      label={reportMode === 'three_months' ? 'শুরু মাস' : 'মাসের নাম'}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                    >
                      {monthsBn.map(m => (
                        <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {reportMode === 'three_months' && (
                  <Grid item xs={12} sm={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>শেষ মাস</InputLabel>
                      <Select
                        value={endMonth}
                        label="শেষ মাস"
                        onChange={(e) => setEndMonth(e.target.value)}
                      >
                        {monthsBn.map(m => (
                          <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}
              </>
            )}

            <Grid item xs={12} sm={2}>
              <FormControl fullWidth size="small">
                <InputLabel>সন (Year)</InputLabel>
                <Select
                  value={selectedYear}
                  label="সন (Year)"
                  onChange={(e) => setSelectedYear(e.target.value)}
                >
                  {yearsList.map(y => (
                    <MenuItem key={y} value={y}>{y}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Stack>
      </Paper>

      {/* Overview Quick Summary (শুধু স্ক্রিনে — প্রিন্টে বাদ) */}
      <Paper className="no-print" sx={{ p: 2, mb: 3, bgcolor: '#e8f5e9', border: '1px solid #c8e6c9' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#2e7d32', mb: 1 }}>
          তালিকায় যুক্ত মোট শিক্ষার্থী: {activeStudents.length} জন | মোট আদায়
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#1b5e20' }}>
          ৳{grandTotal.toLocaleString()}
        </Typography>
      </Paper>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Main Register Printable Area */}
      <Paper sx={{ p: 2, overflowX: 'auto' }} id="printable-register">
        {/* প্রিন্টে পেজের ওপরে স্কুলের হেডার ও লোগো (স্ক্রিনে দেখা যাবে না) */}
        <Box className="dcr-print-header" sx={{ display: 'none', alignItems: 'center', justifyContent: 'center', borderBottom: '2px solid #000', pb: 1, mb: 1.5 }}>
          {schoolLogo && <Box component="img" src={schoolLogo} alt="লোগো" sx={{ height: '18mm', mr: 2 }} />}
          <Box sx={{ textAlign: 'center', flex: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{schoolInfo?.name || ''}</Typography>
            {schoolInfo?.address && <Typography variant="body2">{schoolInfo.address}</Typography>}
          </Box>
          {schoolLogo && <Box component="img" src={schoolLogo} alt="লোগো" sx={{ height: '18mm', ml: 2 }} />}
        </Box>

        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>দৈনিক ও কালিক আদায় রেজিস্টার</Typography>
          <Typography variant="subtitle2" sx={{ mt: 0.5 }}>
            {selectedClass ? `শ্রেণি: ${classes.find(c => String(c.id) === String(selectedClass))?.name || ''}` : 'সব শ্রেণি'}
            {selectedSection ? ` | শাখা: ${sections.find(s => String(s.id) === String(selectedSection))?.name || ''}` : ''}
            {' '} | {reportMode === 'single_date' && `তারিখ: ${selectedDate}`}
            {reportMode === 'single_month' && `মাসের নাম: ${monthNameBn} | সন: ${selectedYear}`}
            {reportMode === 'three_months' && `সময়কাল: ${monthNameBn} - ${endMonthNameBn} | সন: ${selectedYear}`}
            {reportMode === 'year_to_date' && `হিসাবকাল: জানুয়ারি ১ থেকে অদ্যবধি (${selectedYear})`}
          </Typography>
        </Box>

        <TableContainer sx={{ maxHeight: 600 }}>
          <Table size="small" className="dcr-main-table" sx={{ minWidth: 1450, border: '1px solid #ddd' }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd', width: '50px' }}>ক্রমিক</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>শ্রেণি</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>শাখা</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>রোল</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>ছাত্র/ছাত্রীর নাম</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>রসিদ নং</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>বকেয়া</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>খেলাধুলা</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>ভর্তি</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>ভর্তি ছাপা</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>সনদ ও রেজি.</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>বেতন</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>ধর্ম</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>সেশন ফি</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>পরীক্ষার ফি</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>সংস্কৃতি/পাঠাগার</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>জলযোগ/দরিদ্র</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>বিবিধ</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>মোট</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd' }}>আদায়</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd', width: '60px' }} className="no-print">মুছুন</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {activeStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={21} align="center" sx={{ py: 4 }}>
                    <Typography variant="body1" color="textSecondary">
                      এই তারিখের জন্য কোনো আদায়ের ডেটা পাওয়া যায়নি। ওপরের সার্চ বক্স থেকে শিক্ষার্থী খুঁজে **্নযোগ করুন"** বাটনে ক্লিক করুন।
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                activeStudents.map((student, idx) => {
                  const rowData = editingRows[student.id] || {};
                  const rowTotal = calculateRowTotal(rowData);
                  const studentName = student.display_name || student.full_name || `${student.user?.first_name || ''} ${student.user?.last_name || ''}`.trim() || '—';
                  const className = student.classroom?.name || '—';
                  const sectionName = student.section?.name || '---';
                  const rollNo = student.roll_number || '—';

                  return (
                    <TableRow key={student.id} hover>
                      <TableCell sx={{ border: '1px solid #ddd' }}>{idx + 1}</TableCell>
                      <TableCell sx={{ border: '1px solid #ddd' }}>{className}</TableCell>
                      <TableCell sx={{ border: '1px solid #ddd' }}>{sectionName}</TableCell>
                      <TableCell sx={{ border: '1px solid #ddd' }}>{rollNo}</TableCell>
                      <TableCell sx={{ border: '1px solid #ddd', fontWeight: 500 }}>{studentName}</TableCell>
                      <TableCell sx={{ border: '1px solid #ddd' }}>{rowData.receipt_number || '—'}</TableCell>

                      {/* Fee Head Inputs */}
                      {['due_amount', 'sports_fee', 'admission_fee', 'admission_print_fee', 'cert_reg_fee', 'tuition_fee', 'religion_fee', 'session_fee', 'exam_fee', 'culture_library_fee', 'refreshment_poor_fund_fee', 'misc_fee'].map(field => {
                        const val = rowData[field];
                        const displayVal = val !== undefined && val !== null ? val : '';
                        return (
                          <TableCell key={field} sx={{ border: '1px solid #ddd', p: 0.5 }}>
                            <TextField
                              size="small"
                              type="number"
                              value={displayVal}
                              placeholder=""
                              onChange={(e) => handleFieldChange(student.id, field, e.target.value)}
                              sx={{ width: '70px', '& input': { p: '4px 6px', fontSize: '0.85rem' } }}
                            />
                          </TableCell>
                        );
                      })}

                      <TableCell sx={{ border: '1px solid #ddd', fontWeight: 'bold', bgcolor: '#fafafa' }}>
                        ৳{rowTotal}
                      </TableCell>
                      <TableCell sx={{ border: '1px solid #ddd', fontWeight: 'bold', color: 'success.main', bgcolor: '#f1f8e9' }}>
                        ৳{rowTotal}
                      </TableCell>
                      <TableCell sx={{ border: '1px solid #ddd' }} className="no-print">
                        <IconButton size="small" color="error" onClick={() => handleRemoveStudent(student.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Total Calculation Section */}
        <Box sx={{ mt: 4, width: { xs: '100%', sm: '50%' }, ml: 'auto' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
            মোট হিসাব
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>বিবরণ</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>টাকার পরিমাণ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>পরিমাণ (Total Collection)</TableCell>
                  <TableCell sx={{ textAlign: 'right', fontWeight: 'bold' }}>৳{grandTotal.toLocaleString()} টাকা</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>কথায় (In Words)</TableCell>
                  <TableCell sx={{ textAlign: 'right', fontStyle: 'italic' }}>{numberToBengaliWords(grandTotal)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Paper>
    </Box>
  );
};

export default DailyCollectionRegisterPage;
