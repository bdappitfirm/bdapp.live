import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  TextField,
  MenuItem,
  Paper,
  Grid,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Stack,
  Divider,
  Chip,
  CircularProgress
} from '@mui/material';
import {
  Download as DownloadIcon,
  Print as PrintIcon,
  Visibility as VisibilityIcon,
  CheckCircle as PresentIcon,
  Cancel as AbsentIcon,
  Analytics as AnalyticsIcon,
  PictureAsPdf as PdfIcon
} from '@mui/icons-material';
import api from '../utils/api';
import { scopedGet } from '../utils/schoolApi';
import { useToast } from '../components/Toast';
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function AttendanceReportCard() {
  const { id } = useParams();
  const toast = useToast();

  const [reportType, setReportType] = useState('monthly'); // 'daily' | 'monthly' | 'custom' | 'yearly'
  const [reportFor, setReportFor] = useState('student'); // 'student' | 'employee'
  const [category, setCategory] = useState('section');
  const [viewMode, setViewMode] = useState('datewise'); // 'datewise' | 'summary'
  const [selectedClassroom, setSelectedClassroom] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [startDate, setStartDate] = useState(dayjs().subtract(1, 'month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [selectedYear, setSelectedYear] = useState(dayjs().format('YYYY'));

  const [schoolInfo, setSchoolInfo] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // Extract dates that have at least 1 attendance record in the selected month/custom range
  const activeDates = React.useMemo(() => {
    if (reportType !== 'monthly' && reportType !== 'custom') return [];
    const dateSet = new Set();
    reportData.forEach(r => {
      if (r.attendance) {
        Object.keys(r.attendance).forEach(dStr => {
          if (r.attendance[dStr] !== undefined) {
            dateSet.add(dStr);
          }
        });
      }
    });
    return Array.from(dateSet).sort();
  }, [reportData, reportType]);

  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [schRes, clsRes] = await Promise.all([
          api.get(`/api/schools/${id}/`),
          scopedGet('/api/academics/classrooms/', id)
        ]);
        setSchoolInfo(schRes.data);
        setClassrooms(Array.isArray(clsRes.data) ? clsRes.data : (clsRes.data?.results || []));
      } catch (e) { console.error(e); }
    };
    if (id) loadInitial();
  }, [id]);

  useEffect(() => {
    if (selectedClassroom) {
      scopedGet('/api/academics/sections/', id, { classroom: selectedClassroom })
        .then(res => setSections(Array.isArray(res.data) ? res.data : (res.data?.results || [])));
    } else {
      setSections([]);
      setSelectedSection('');
    }
  }, [selectedClassroom, id]);

  // Employee mode: load departments
  useEffect(() => {
    if (reportFor !== 'employee') return;
    scopedGet('/api/employees/departments/', id)
      .then(res => setDepartments(Array.isArray(res.data) ? res.data : (res.data?.results || [])))
      .catch(() => setDepartments([]));
  }, [reportFor, id]);

  // Employee mode: load employees of the selected department
  useEffect(() => {
    if (reportFor !== 'employee') return;
    scopedGet('/api/employees/employees/', id, { department: selectedDepartment || undefined, page_size: 1000 })
      .then(res => setEmployees(Array.isArray(res.data) ? res.data : (res.data?.results || [])))
      .catch(() => setEmployees([]));
    setSelectedEmployee('');
  }, [reportFor, selectedDepartment, id]);

  useEffect(() => {
    if (selectedClassroom) {
      scopedGet('/api/academics/students/', id, { classroom: selectedClassroom, section: selectedSection || undefined, page_size: 1000 })
        .then(res => {
          const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
          // Sort students numerically by roll
          const sorted = [...data].sort((a, b) => {
            const ar = parseInt(String(a?.roll_number ?? '').replace(/\D/g, ''), 10);
            const br = parseInt(String(b?.roll_number ?? '').replace(/\D/g, ''), 10);
            if (!isNaN(ar) && !isNaN(br)) return ar - br;
            return String(a?.roll_number || '').localeCompare(String(b?.roll_number || ''), undefined, { numeric: true });
          });
          setStudents(sorted);
        });
    } else {
      setStudents([]);
      setSelectedStudent('');
    }
  }, [selectedClassroom, selectedSection, id]);

  const generateReport = async () => {
    if (reportFor === 'student' && !selectedClassroom) { toast.warning('দয়া করে একটি শ্রেণি নির্বাচন করুন'); return; }
    if (reportFor === 'student' && category === 'student' && !selectedStudent) { toast.warning('দয়া করে একজন শিক্ষার্থী নির্বাচন করুন'); return; }

    setLoading(true); setReportData([]); setShowReport(false);
    try {
      // ---------- EMPLOYEE (STAFF) REPORT ----------
      if (reportFor === 'employee') {
        if (reportType === 'daily') {
          const [empRes, attRes] = await Promise.all([
            scopedGet('/api/employees/employees/', id, { department: selectedDepartment || undefined, page_size: 1000 }),
            scopedGet('/api/attendance/records/', id, { date: selectedDate, staff: 1, page_size: 1000 })
          ]);
          const emps = Array.isArray(empRes.data) ? empRes.data : (empRes.data?.results || []);
          const records = Array.isArray(attRes.data) ? attRes.data : (attRes.data?.results || []);
          const list = selectedEmployee ? emps.filter(e => e.id === parseInt(selectedEmployee)) : emps;
          setReportData(list.map(e => {
            const rec = records.find(r => r.employee === e.id);
            return {
              roll_number: e.employee_id,
              name: e.name_en || e.name_bn || 'Employee',
              designation: e.designation_name || '',
              department: e.department_name || '',
              present: rec ? rec.present : false,
              time: rec ? dayjs(rec.scan_time || rec.created_at).format('hh:mm A') : '-',
              note: rec?.note || ''
            };
          }));
        } else {
          const params = { employee: 1 };
          if (selectedDepartment) params.department = selectedDepartment;
          if (selectedEmployee) params.employee_id = selectedEmployee;
          if (reportType === 'custom') {
            if (startDate > endDate) {
              toast.warning('শুরুর তারিখ শেষের তারিখের চেয়ে বড় হতে পারে না');
              setLoading(false);
              return;
            }
            params.start_date = startDate;
            params.end_date = endDate;
          } else if (reportType === 'monthly') {
            params.month = selectedMonth;
          } else {
            params.year = selectedYear;
          }

          const res = await scopedGet('/api/attendance/records/monthly_report/', id, params);
          const rawData = res.data || [];
          const rawMap = new Map(rawData.map(r => [r.employee_id, r]));

          const empList = selectedEmployee
            ? employees.filter(e => e.id === parseInt(selectedEmployee))
            : employees;

          const baseList = empList.length > 0 ? empList : rawData;

          const data = baseList.map(e => {
            const isEmpObj = Boolean(e.employee_id !== undefined && (e.name_en || e.name_bn));
            const empId = isEmpObj ? e.id : e.employee_id;
            const r = isEmpObj ? (rawMap.get(empId) || {
              employee_id: empId,
              name: e.name_en || e.name_bn || 'Employee',
              roll: e.employee_id,
              designation: e.designation_name || '',
              department: e.department_name || '',
              attendance: {}
            }) : e;

            const attValues = Object.values(r.attendance || {});
            const present = attValues.filter(v => v === true).length;
            const total = attValues.length;
            return {
              ...r,
              roll_number: r.roll || e.employee_id,
              name: r.name || e.name_en || e.name_bn,
              designation: r.designation || e.designation_name || '',
              department: r.department || e.department_name || '',
              present_days: present,
              total_days: total,
              attendance_percentage: total > 0 ? ((present / total) * 100).toFixed(1) : 0
            };
          });

          setReportData(data);
        }
        setShowReport(true);
        return;
      }

      let endpoint = '/api/attendance/records/monthly_report/';
      let params = { school: id, classroom: selectedClassroom };
      if (selectedSection) params.section = selectedSection;

      if (reportType === 'daily') {
        const res = await api.get(`/api/attendance/records/`, { params: { school: id, date: selectedDate, classroom: selectedClassroom, section: selectedSection || undefined, page_size: 1000 } });
        const records = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        const data = students.map(s => {
          const rec = records.find(r => r.student === s.id);
          return { student_id: s.id, student_name: `${s.user?.first_name || ''} ${s.user?.last_name || ''}`.trim(), roll_number: s.roll_number, present: rec ? rec.present : false, time: rec ? dayjs(rec.created_at).format('hh:mm A') : '-', note: rec?.note || '' };
        });
        setReportData(data);
      } else if (reportType === 'monthly' || reportType === 'custom') {
        if (reportType === 'custom') {
          if (startDate > endDate) {
            toast.warning('শুরুর তারিখ শেষের তারিখের চেয়ে বড় হতে পারে না');
            setLoading(false);
            return;
          }
          params.start_date = startDate;
          params.end_date = endDate;
        } else {
          params.month = selectedMonth;
        }

        const res = await scopedGet(endpoint, id, params);
        let rawData = res.data || [];
        if (category === 'student' && selectedStudent) rawData = rawData.filter(r => r.student_id === parseInt(selectedStudent));

        const rawMap = new Map(rawData.map(r => [r.student_id, r]));

        const studentList = (category === 'student' && selectedStudent)
          ? students.filter(s => s.id === parseInt(selectedStudent))
          : students;

        const baseList = studentList.length > 0 ? studentList : rawData;

        const data = baseList.map(s => {
          const isStudentObj = Boolean(s.user || s.roll_number);
          const stuId = isStudentObj ? s.id : s.student_id;
          const r = isStudentObj ? (rawMap.get(stuId) || {
            student_id: stuId,
            name: `${s.user?.first_name || ''} ${s.user?.last_name || ''}`.trim() || s.user?.username || '',
            roll: s.roll_number,
            attendance: {}
          }) : s;

          const attValues = Object.values(r.attendance || {});
          const present = attValues.filter(v => v === true).length;
          const total = attValues.length;
          return {
            ...r,
            student_name: r.name || `${s.user?.first_name || ''} ${s.user?.last_name || ''}`.trim(),
            roll_number: r.roll || s.roll_number,
            present_days: present,
            total_days: total,
            attendance_percentage: total > 0 ? ((present / total) * 100).toFixed(1) : 0
          };
        });

        data.sort((a, b) => {
          const ar = parseInt(String(a?.roll_number ?? '').replace(/\D/g, ''), 10);
          const br = parseInt(String(b?.roll_number ?? '').replace(/\D/g, ''), 10);
          if (!isNaN(ar) && !isNaN(br)) return ar - br;
          return String(a?.roll_number || '').localeCompare(String(b?.roll_number || ''), undefined, { numeric: true });
        });

        setReportData(data);
      } else if (reportType === 'yearly') {
        const res = await api.get(`/api/attendance/records/`, { params: { school: id, student: category === 'student' ? selectedStudent : undefined, date__year: selectedYear, page_size: 5000 } });
        const allRecords = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        const studentMap = new Map();
        allRecords.forEach(r => {
          if (!studentMap.has(r.student)) studentMap.set(r.student, { present: 0, total: 0 });
          const stats = studentMap.get(r.student); stats.total += 1; if (r.present) stats.present += 1;
        });
        const data = students.filter(s => category !== 'student' || s.id === parseInt(selectedStudent)).map(s => {
          const stats = studentMap.get(s.id) || { present: 0, total: 0 };
          return { student_id: s.id, student_name: `${s.user?.first_name || ''} ${s.user?.last_name || ''}`.trim(), roll_number: s.roll_number, present_days: stats.present, total_days: stats.total, attendance_percentage: stats.total > 0 ? ((stats.present / stats.total) * 100).toFixed(1) : 0 };
        });
        setReportData(data);
      }
      setShowReport(true);
    } catch (error) { toast.error('প্রতিবেদন তৈরি করা যায়নি'); } finally { setLoading(false); }
  };

  const handleDownloadCSV = () => {
    if (reportData.length === 0) return;
    const isEmp = reportFor === 'employee';

    let headers = [];
    if (reportType === 'daily') {
      headers = [isEmp ? 'আইডি' : 'রোল', isEmp ? 'কর্মীর নাম' : 'নাম', 'অবস্থা', 'সময়', 'মন্তব্য'];
    } else if ((reportType === 'monthly' || reportType === 'custom') && viewMode === 'datewise') {
      const activeDateHeaders = activeDates.map(dStr => reportType === 'custom' ? dayjs(dStr).format('DD/MM/YYYY') : String(dayjs(dStr).date()));
      headers = [isEmp ? 'আইডি' : 'রোল', isEmp ? 'কর্মীর নাম' : 'নাম', ...activeDateHeaders, 'উপস্থিত দিন', 'মোট দিন', 'শতকরা (%)'];
    } else {
      headers = [isEmp ? 'আইডি' : 'রোল', isEmp ? 'কর্মীর নাম' : 'নাম', 'উপস্থিত দিন', 'মোট দিন', 'শতকরা (%)'];
    }

    const rows = reportData.map(r => {
      const nm = r.student_name || r.name || '';
      if (reportType === 'daily') {
        return [r.roll_number, nm, r.present ? 'উপস্থিত' : 'অনুপস্থিত', r.time, r.note];
      } else if ((reportType === 'monthly' || reportType === 'custom') && viewMode === 'datewise') {
        const dayCols = activeDates.map(dStr => {
          const val = r.attendance?.[dStr];
          return val === true ? 'P' : val === false ? 'A' : '-';
        });
        return [r.roll_number, nm, ...dayCols, r.present_days, r.total_days, `${r.attendance_percentage}%`];
      } else {
        return [r.roll_number, nm, r.present_days, r.total_days, `${r.attendance_percentage}%`];
      }
    });

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\r\n";
    rows.forEach(row => { csvContent += row.map(c => `"${c}"`).join(",") + "\r\n"; });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Attendance_${reportType}_${dayjs().format('YYYY-MM-DD')}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('printable-area');
    if (!element) return;

    toast.info('পিডিএফ তৈরি হচ্ছে...');
    try {
      const isLandscape = (reportType === 'monthly' || reportType === 'custom') && viewMode === 'datewise';
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF(isLandscape ? 'l' : 'p', 'mm', 'a4');
      const imgWidth = isLandscape ? 297 : 210;
      const pageHeight = isLandscape ? 210 : 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`Attendance_Report_${reportType}_${dayjs().format('YYYY-MM-DD')}.pdf`);
      toast.success('পিডিএফ ডাউনলোড সফল হয়েছে');
    } catch (e) {
      console.error(e);
      toast.error('পিডিএফ তৈরি করা যায়নি');
    }
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 3 } }}>
      <Paper elevation={0} sx={{ mb: 3, p: 3, borderRadius: 3, background: 'linear-gradient(135deg, #1b5e20 0%, #43a047 100%)', color: 'white' }} className="no-print">
        <Stack direction="row" alignItems="center" spacing={2}>
          <AnalyticsIcon sx={{ fontSize: 40 }} />
          <Box><Typography variant="h4" sx={{ fontWeight: 'bold' }}>হাজিরা প্রতিবেদন কেন্দ্র</Typography><Typography variant="body1">দৈনিক, মাসিক, তারিখ সীমা এবং বাৎসরিক রিপোর্ট দেখুন</Typography></Box>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, mb: 3, borderRadius: 2, boxShadow: 2 }} className="no-print">
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack direction="row" spacing={1}>
              <Button variant={reportFor === 'student' ? 'contained' : 'outlined'} color="primary" onClick={() => { setReportFor('student'); setReportData([]); setShowReport(false); }} fullWidth>🎓 শিক্ষার্থী</Button>
              <Button variant={reportFor === 'employee' ? 'contained' : 'outlined'} color="primary" onClick={() => { setReportFor('employee'); setReportData([]); setShowReport(false); }} fullWidth>👨‍💼 কর্মী</Button>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <Stack direction="row" spacing={1}>
              <Button variant={reportType === 'daily' ? 'contained' : 'outlined'} onClick={() => setReportType('daily')} fullWidth>দৈনিক</Button>
              <Button variant={reportType === 'monthly' ? 'contained' : 'outlined'} onClick={() => setReportType('monthly')} fullWidth>মাসিক</Button>
              <Button variant={reportType === 'custom' ? 'contained' : 'outlined'} onClick={() => setReportType('custom')} fullWidth>তারিখ সীমা</Button>
              <Button variant={reportType === 'yearly' ? 'contained' : 'outlined'} onClick={() => setReportType('yearly')} fullWidth>বাৎসরিক</Button>
            </Stack>
          </Grid>
          {reportFor === 'student' ? (
            <>
              <Grid size={{ xs: 12, md: 6 }}><Stack direction="row" spacing={1}><Button variant={category === 'class' ? 'contained' : 'outlined'} color="secondary" onClick={() => { setCategory('class'); setSelectedSection(''); }} fullWidth>ক্লাস-ভিত্তিক</Button><Button variant={category === 'section' ? 'contained' : 'outlined'} color="secondary" onClick={() => setCategory('section')} fullWidth>শাখা-ভিত্তিক</Button><Button variant={category === 'student' ? 'contained' : 'outlined'} color="secondary" onClick={() => setCategory('student')} fullWidth>শিক্ষার্থী-ভিত্তিক</Button></Stack></Grid>
              <Grid size={{ xs: 12, md: 3 }}><TextField select fullWidth label="শ্রেণি" value={selectedClassroom} onChange={(e) => setSelectedClassroom(e.target.value)}>{classrooms.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}</TextField></Grid>
              {(category === 'section' || category === 'student') && <Grid size={{ xs: 12, md: 2 }}><TextField select fullWidth label="শাখা" value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)}><MenuItem value="">সব শাখা</MenuItem>{sections.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}</TextField></Grid>}
              {category === 'student' && <Grid size={{ xs: 12, md: 3 }}><TextField select fullWidth label="শিক্ষার্থী" value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>{students.map(s => <MenuItem key={s.id} value={s.id}>{s.user?.first_name} {s.user?.last_name} ({s.roll_number})</MenuItem>)}</TextField></Grid>}
            </>
          ) : (
            <>
              <Grid size={{ xs: 12, md: 4 }}><TextField select fullWidth label="বিভাগ (Department)" value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)}><MenuItem value="">সকল বিভাগ</MenuItem>{departments.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}</TextField></Grid>
              <Grid size={{ xs: 12, md: 4 }}><TextField select fullWidth label="কর্মী" value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}><MenuItem value="">সকল কর্মী</MenuItem>{employees.map(e => <MenuItem key={e.id} value={e.id}>{e.name_en || e.name_bn} ({e.employee_id})</MenuItem>)}</TextField></Grid>
            </>
          )}

          <Grid size={{ xs: 12, md: reportType === 'custom' ? 6 : (reportFor === 'student' && category === 'student' ? 2 : (reportFor === 'employee' ? 2 : 4)) }}>
            {reportType === 'daily' && <TextField type="date" fullWidth label="তারিখ" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} InputLabelProps={{ shrink: true }} />}
            {reportType === 'monthly' && <TextField type="month" fullWidth label="মাস" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} InputLabelProps={{ shrink: true }} />}
            {reportType === 'custom' && (
              <Stack direction="row" spacing={1}>
                <TextField type="date" fullWidth label="হতে (Start Date)" value={startDate} onChange={e => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                <TextField type="date" fullWidth label="পর্যন্ত (End Date)" value={endDate} onChange={e => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} />
              </Stack>
            )}
            {reportType === 'yearly' && <TextField select fullWidth label="বছর" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>{[0,1,2].map(i => { const y = dayjs().subtract(i, 'year').format('YYYY'); return <MenuItem key={y} value={y}>{y}</MenuItem> })}</TextField>}
          </Grid>

          {(reportType === 'monthly' || reportType === 'custom') && (
            <Grid size={{ xs: 12 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" sx={{ fontWeight: 'bold', mr: 1, color: 'text.secondary' }}>ভিউ মোড:</Typography>
                <Button
                  size="small"
                  variant={viewMode === 'datewise' ? 'contained' : 'outlined'}
                  color="success"
                  onClick={() => setViewMode('datewise')}
                >
                  📅 তারিখ অনুযায়ী ম্যাট্রিক্স (Date-wise)
                </Button>
                <Button
                  size="small"
                  variant={viewMode === 'summary' ? 'contained' : 'outlined'}
                  color="success"
                  onClick={() => setViewMode('summary')}
                >
                  📊 সংক্ষিপ্ত বিবরণী (Summary)
                </Button>
              </Stack>
            </Grid>
          )}

          <Grid size={{ xs: 12, md: 2 }}><Button variant="contained" fullWidth size="large" sx={{ height: '100%' }} startIcon={<VisibilityIcon />} onClick={generateReport} disabled={loading}>দেখুন</Button></Grid>
        </Grid>
      </Paper>

      {showReport && reportData.length > 0 && (
        <Stack direction="column" spacing={1} sx={{ mb: 2 }} className="no-print">
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button variant="contained" color="info" startIcon={<DownloadIcon />} onClick={handleDownloadCSV}>CSV</Button>
            <Button variant="contained" color="error" startIcon={<PdfIcon />} onClick={handleDownloadPDF}>PDF</Button>
            <Button variant="contained" color="secondary" startIcon={<PrintIcon />} onClick={() => window.print()}>প্রিন্ট</Button>
          </Stack>
          {(reportType === 'monthly' || reportType === 'custom') && viewMode === 'datewise' && (
            <Stack direction="row" spacing={1.5} justifyContent="center" sx={{ pt: 1, flexWrap: 'wrap' }}>
              <Chip label="P = উপস্থিত" size="small" sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 'bold' }} />
              <Chip label="A = অনুপস্থিত" size="small" sx={{ bgcolor: '#ffebee', color: '#c62828', fontWeight: 'bold' }} />
              <Chip label="- = রেকর্ড নেই" size="small" variant="outlined" />
              <Chip label="শুক্রবার = সাপ্তাহিক ছুটি" size="small" sx={{ bgcolor: '#ffe0b2', color: '#e65100', fontWeight: 'bold' }} />
            </Stack>
          )}
        </Stack>
      )}

      {loading ? <Box align="center" py={10}><CircularProgress /></Box> : showReport && (
        <Box id="printable-area">
          <Box className="print-only" sx={{ display: 'none', textAlign: 'center', mb: 4 }}>
            <Typography variant="h3" sx={{ fontWeight: 'bold' }}>{schoolInfo?.name}</Typography>
            <Typography variant="h5">
              হাজিরা প্রতিবেদন — {
                reportType === 'daily' ? 'দৈনিক'
                : reportType === 'monthly' ? `মাসিক (${dayjs(selectedMonth, 'YYYY-MM').format('MMMM YYYY')})`
                : reportType === 'custom' ? `তারিখ সীমা (${dayjs(startDate).format('DD/MM/YYYY')} হতে ${dayjs(endDate).format('DD/MM/YYYY')})`
                : 'বাৎসরিক'
              }{reportFor === 'employee' ? ' (কর্মী)' : ''}
            </Typography>
            {reportFor === 'student' ? (
              <Typography variant="h6">শ্রেণি: {classrooms.find(c=>c.id===parseInt(selectedClassroom))?.name} | শাখা: {sections.find(s=>s.id===parseInt(selectedSection))?.name || 'সব'}</Typography>
            ) : (
              <Typography variant="h6">বিভাগ: {departments.find(d=>d.id===parseInt(selectedDepartment))?.name || 'সকল'}</Typography>
            )}
            <Divider sx={{ my: 2, borderColor: 'black' }} />
          </Box>
          <TableContainer component={Paper} sx={{ overflowX: 'auto', maxWidth: '100%' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', bgcolor: '#f5f5f5' }}>{reportFor === 'employee' ? 'আইডি' : 'রোল'}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', bgcolor: '#f5f5f5', minWidth: 150 }}>{reportFor === 'employee' ? 'কর্মীর নাম ও পদবী' : 'শিক্ষার্থীর নাম'}</TableCell>
                  {reportType === 'daily' ? (
                    <>
                      <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>অবস্থা</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>সময়</TableCell>
                    </>
                  ) : (reportType === 'monthly' || reportType === 'custom') && viewMode === 'datewise' ? (
                    <>
                      {activeDates.length === 0 ? (
                        <TableCell align="center" sx={{ fontWeight: 'bold', color: 'text.secondary', bgcolor: '#f5f5f5' }}>কোনো তথ্য নেই</TableCell>
                      ) : (
                        activeDates.map(dStr => {
                          const displayLabel = reportType === 'custom' ? dayjs(dStr).format('DD/MM') : dayjs(dStr).date();
                          const isFri = dayjs(dStr).day() === 5;
                          return (
                            <TableCell
                              key={dStr}
                              align="center"
                              sx={{
                                fontWeight: 'bold',
                                p: '4px 2px',
                                minWidth: reportType === 'custom' ? 38 : 28,
                                bgcolor: isFri ? '#ffe0b2' : '#f5f5f5',
                                color: isFri ? '#e65100' : 'inherit',
                                whiteSpace: 'nowrap'
                              }}
                              title={dStr}
                            >
                              {displayLabel}
                            </TableCell>
                          );
                        })
                      )}
                      <TableCell align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', bgcolor: '#f5f5f5' }}>উপস্থিত</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', bgcolor: '#f5f5f5' }}>মোট দিন</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', bgcolor: '#f5f5f5' }}>শতকরা (%)</TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>উপস্থিত</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>মোট দিন</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>শতকরা (%)</TableCell>
                    </>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {reportData.map((row, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.roll_number}</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                      {row.student_name || row.name}
                      {reportFor === 'employee' && row.designation ? <Typography variant="caption" color="text.secondary" display="block">{row.designation}</Typography> : null}
                    </TableCell>

                    {reportType === 'daily' ? (
                      <>
                        <TableCell align="center">{row.present ? <PresentIcon color="success" /> : <AbsentIcon color="error" />}</TableCell>
                        <TableCell align="center">{row.time}</TableCell>
                      </>
                    ) : (reportType === 'monthly' || reportType === 'custom') && viewMode === 'datewise' ? (
                      <>
                        {activeDates.length === 0 ? (
                          <TableCell align="center" sx={{ color: 'text.secondary' }}>-</TableCell>
                        ) : (
                          activeDates.map(dStr => {
                            const val = row.attendance?.[dStr];
                            const isFri = dayjs(dStr).day() === 5;
                            let content = '-';
                            let color = 'text.disabled';
                            let bg = isFri ? '#fff3e0' : 'inherit';

                            if (val === true) {
                              content = 'P';
                              color = '#2e7d32';
                              bg = '#e8f5e9';
                            } else if (val === false) {
                              content = 'A';
                              color = '#c62828';
                              bg = '#ffebee';
                            }

                            return (
                              <TableCell
                                key={dStr}
                                align="center"
                                sx={{
                                  p: '2px',
                                  bgcolor: bg,
                                  color: color,
                                  fontWeight: val !== undefined ? 'bold' : 'normal',
                                  fontSize: '0.82rem'
                                }}
                              >
                                {content}
                              </TableCell>
                            );
                          })
                        )}
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>{row.present_days}</TableCell>
                        <TableCell align="center">{row.total_days}</TableCell>
                        <TableCell align="center">
                          <Chip label={`${row.attendance_percentage}%`} color={parseFloat(row.attendance_percentage) >= 80 ? 'success' : 'error'} size="small" />
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell align="center">{row.present_days}</TableCell>
                        <TableCell align="center">{row.total_days}</TableCell>
                        <TableCell align="center">
                          <Chip label={`${row.attendance_percentage}%`} color={parseFloat(row.attendance_percentage) >= 80 ? 'success' : 'error'} size="small" />
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          #printable-area { padding: 5mm; width: 100%; }
          @page { size: landscape; margin: 8mm; }
          table { font-size: 11px !important; }
          th, td { padding: 3px 2px !important; }
        }
      `}</style>
    </Box>
  );
}

