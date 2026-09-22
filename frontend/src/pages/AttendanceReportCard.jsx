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

  const [reportType, setReportType] = useState('monthly');
  const [category, setCategory] = useState('section');
  const [selectedClassroom, setSelectedClassroom] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [selectedYear, setSelectedYear] = useState(dayjs().format('YYYY'));

  const [schoolInfo, setSchoolInfo] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);

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
    if (!selectedClassroom) { toast.warning('দয়া করে একটি শ্রেণি নির্বাচন করুন'); return; }
    if (category === 'student' && !selectedStudent) { toast.warning('দয়া করে একজন শিক্ষার্থী নির্বাচন করুন'); return; }

    setLoading(true); setReportData([]); setShowReport(false);
    try {
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
      } else if (reportType === 'monthly') {
        params.month = selectedMonth;
        const res = await scopedGet(endpoint, id, params);
        let rawData = res.data || [];
        if (category === 'student' && selectedStudent) rawData = rawData.filter(r => r.student_id === parseInt(selectedStudent));

        // Process monthly data to include stats
        const data = rawData.map(r => {
          const attValues = Object.values(r.attendance || {});
          const present = attValues.filter(v => v === true).length;
          const total = attValues.length;
          return {
            ...r,
            student_name: r.name,
            roll_number: r.roll,
            present_days: present,
            total_days: total,
            attendance_percentage: total > 0 ? ((present / total) * 100).toFixed(1) : 0
          };
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
    const headers = reportType === 'daily' ? ['রোল', 'নাম', 'অবস্থা', 'সময়', 'মন্তব্য'] : ['রোল', 'নাম', 'উপস্থিত দিন', 'মোট দিন', 'শতকরা (%)'];
    const rows = reportData.map(r => reportType === 'daily' ? [r.roll_number, r.student_name, r.present ? 'উপস্থিত' : 'অনুপস্থিত', r.time, r.note] : [r.roll_number, r.student_name, r.present_days, r.total_days, r.attendance_percentage]);
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
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
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
          <Box><Typography variant="h4" sx={{ fontWeight: 'bold' }}>হাজিরা প্রতিবেদন কেন্দ্র</Typography><Typography variant="body1">দৈনিক, মাসিক এবং বাৎসরিক রিপোর্ট দেখুন</Typography></Box>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, mb: 3, borderRadius: 2, boxShadow: 2 }} className="no-print">
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}><Stack direction="row" spacing={1}><Button variant={reportType === 'daily' ? 'contained' : 'outlined'} onClick={() => setReportType('daily')} fullWidth>দৈনিক</Button><Button variant={reportType === 'monthly' ? 'contained' : 'outlined'} onClick={() => setReportType('monthly')} fullWidth>মাসিক</Button><Button variant={reportType === 'yearly' ? 'contained' : 'outlined'} onClick={() => setReportType('yearly')} fullWidth>বাৎসরিক</Button></Stack></Grid>
          <Grid size={{ xs: 12, md: 6 }}><Stack direction="row" spacing={1}><Button variant={category === 'class' ? 'contained' : 'outlined'} color="secondary" onClick={() => { setCategory('class'); setSelectedSection(''); }} fullWidth>ক্লাস-ভিত্তিক</Button><Button variant={category === 'section' ? 'contained' : 'outlined'} color="secondary" onClick={() => setCategory('section')} fullWidth>শাখা-ভিত্তিক</Button><Button variant={category === 'student' ? 'contained' : 'outlined'} color="secondary" onClick={() => setCategory('student')} fullWidth>শিক্ষার্থী-ভিত্তিক</Button></Stack></Grid>
          <Grid size={{ xs: 12, md: 3 }}><TextField select fullWidth label="শ্রেণি" value={selectedClassroom} onChange={(e) => setSelectedClassroom(e.target.value)}>{classrooms.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}</TextField></Grid>
          {(category === 'section' || category === 'student') && <Grid size={{ xs: 12, md: 2 }}><TextField select fullWidth label="শাখা" value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)}><MenuItem value="">সব শাখা</MenuItem>{sections.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}</TextField></Grid>}
          {category === 'student' && <Grid size={{ xs: 12, md: 3 }}><TextField select fullWidth label="শিক্ষার্থী" value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>{students.map(s => <MenuItem key={s.id} value={s.id}>{s.user?.first_name} {s.user?.last_name} ({s.roll_number})</MenuItem>)}</TextField></Grid>}
          <Grid size={{ xs: 12, md: category === 'student' ? 2 : 4 }}>{reportType === 'daily' && <TextField type="date" fullWidth label="তারিখ" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} InputLabelProps={{ shrink: true }} />}{reportType === 'monthly' && <TextField type="month" fullWidth label="মাস" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} InputLabelProps={{ shrink: true }} />}{reportType === 'yearly' && <TextField select fullWidth label="বছর" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>{[0,1,2].map(i => { const y = dayjs().subtract(i, 'year').format('YYYY'); return <MenuItem key={y} value={y}>{y}</MenuItem> })}</TextField>}</Grid>
          <Grid size={{ xs: 12, md: 2 }}><Button variant="contained" fullWidth size="large" sx={{ height: '100%' }} startIcon={<VisibilityIcon />} onClick={generateReport} disabled={loading}>দেখুন</Button></Grid>
        </Grid>
      </Paper>

      {showReport && reportData.length > 0 && (
        <Stack direction="row" spacing={2} sx={{ mb: 3 }} className="no-print" justifyContent="center">
          <Button variant="contained" color="info" startIcon={<DownloadIcon />} onClick={handleDownloadCSV}>CSV</Button>
          <Button variant="contained" color="error" startIcon={<PdfIcon />} onClick={handleDownloadPDF}>PDF</Button>
          <Button variant="contained" color="secondary" startIcon={<PrintIcon />} onClick={() => window.print()}>প্রিন্ট</Button>
        </Stack>
      )}

      {loading ? <Box align="center" py={10}><CircularProgress /></Box> : showReport && (
        <Box id="printable-area">
          <Box className="print-only" sx={{ display: 'none', textAlign: 'center', mb: 4 }}>
            <Typography variant="h3" sx={{ fontWeight: 'bold' }}>{schoolInfo?.name}</Typography>
            <Typography variant="h5">হাজিরা প্রতিবেদন — {reportType === 'daily' ? 'দৈনিক' : reportType === 'monthly' ? 'মাসিক' : 'বাৎসরিক'}</Typography>
            <Typography variant="h6">শ্রেণি: {classrooms.find(c=>c.id===parseInt(selectedClassroom))?.name} | শাখা: {sections.find(s=>s.id===parseInt(selectedSection))?.name || 'সব'}</Typography>
            <Divider sx={{ my: 2, borderColor: 'black' }} />
          </Box>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>রোল</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>শিক্ষার্থীর নাম</TableCell>
                  {reportType === 'daily' ? (<><TableCell align="center">অবস্থা</TableCell><TableCell align="center">সময়</TableCell></>) : (<><TableCell align="center">উপস্থিত</TableCell><TableCell align="center">মোট দিন</TableCell><TableCell align="center">শতকরা (%)</TableCell></>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {reportData.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{row.roll_number}</TableCell><TableCell sx={{ fontWeight: 'bold' }}>{row.student_name}</TableCell>
                    {reportType === 'daily' ? (<><TableCell align="center">{row.present ? <PresentIcon color="success" /> : <AbsentIcon color="error" />}</TableCell><TableCell align="center">{row.time}</TableCell></>) : (<><TableCell align="center">{row.present_days}</TableCell><TableCell align="center">{row.total_days}</TableCell><TableCell align="center"><Chip label={`${row.attendance_percentage}%`} color={parseFloat(row.attendance_percentage) >= 80 ? 'success' : 'error'} size="small" /></TableCell></>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
      <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } #printable-area { padding: 10mm; } }`}</style>
    </Box>
  );
}
