import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Typography, Button, TextField, MenuItem, Paper, Grid,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Checkbox, Stack, IconButton, CircularProgress, Dialog,
  DialogTitle, DialogContent, Avatar, Zoom
} from '@mui/material';
import {
  Close as CloseIcon,
  FlashOn as FlashOnIcon,
  FlashOff as FlashOffIcon
} from '@mui/icons-material';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../utils/api';
import { scopedGet, scopedPost } from '../utils/schoolApi';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { useSchool } from '../context/SchoolContext';
import dayjs from 'dayjs';
import { queueRequest, db, getCachedApiResponse } from '../utils/offlineDb';
import { getMediaUrl } from '../utils/media';
import InputGuidance from '../components/InputGuidance';

// --- HELPERS ---

// Get or generate Device ID
const getDeviceId = () => {
    let id = localStorage.getItem('bdapp_device_id');
    if (!id) {
        id = 'DEV-' + Math.random().toString(36).substring(2, 10).toUpperCase();
        localStorage.setItem('bdapp_device_id', id);
    }
    return id;
};

// Play Beep Sound
const playBeep = (freq = 800, duration = 200) => {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + duration / 1000);
    } catch (e) {
        console.warn('Audio feedback failed:', e);
    }
};

export default function AttendancePageNew() {
  const { id } = useParams(); // school ID
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser } = useAuth();
  const { school: schoolInfo } = useSchool();
  const toast = useToast();

  // SCANNER & DEVICE
  const deviceId = useMemo(() => getDeviceId(), []);
  const qrScannerRef = useRef(null);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const scannerRunningRef = useRef(false);

  // FILTERS
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassroom, setSelectedClassroom] = useState('');
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [manualStudentId, setManualStudentId] = useState('');

  // DATA
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const guidanceSteps = [
    { selector: '#attendance-date-picker', text: 'তারিখ নির্বাচন করুন', autoNext: false },
    { selector: '#attendance-class-select', text: 'শ্রেণি নির্বাচন করুন', autoNext: false },
    { selector: '#attendance-section-select', text: 'সেকশন নির্বাচন করুন', autoNext: false },
    { selector: '#attendance-save-btn', text: 'হাজিরা সেভ করুন', autoNext: false }
  ];

  useEffect(() => {
    if (!date) {
      setActiveStep(0);
    } else if (!selectedClassroom) {
      setActiveStep(1);
    } else if (sections.length > 0 && !selectedSection) {
      setActiveStep(2);
    } else {
      setActiveStep(3);
    }
  }, [date, selectedClassroom, selectedSection, sections]);

  // CACHE FOR UNIVERSAL SCANNING
  const allStudentsCacheRef = useRef([]);

  // SUCCESS OVERLAY
  const [scanSuccess, setScanSuccess] = useState(null); // { name, roll, photo, class, section, schoolName }
  const successTimerRef = useRef(null);

  // URL Sync
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cls = params.get('classroom');
    const sec = params.get('section');
    const d = params.get('date');
    if (cls) setSelectedClassroom(cls);
    if (sec) setSelectedSection(sec);
    if (d) setDate(d);
  }, [location.search]);

  const updateUrl = useCallback((cls, sec, d) => {
    const params = new URLSearchParams();
    if (cls) params.set('classroom', cls);
    if (sec) params.set('section', sec);
    if (d) params.set('date', d);
    navigate(`${location.pathname}?${params.toString()}`);
  }, [location.pathname, navigate]);

  // Auth Guard
  const role = String(currentUser?.role || currentUser?.profile?.effective_role || currentUser?.profile?.role || '').toLowerCase();
  const designation = String(currentUser?.profile?.designation || '').toLowerCase();
  const isAuthorized = role === 'admin' || role === 'teacher' || currentUser?.is_superuser || designation.includes('প্রধান') || designation.includes('principal') || designation.includes('headmaster');

  useEffect(() => {
    if (currentUser && !isAuthorized) {
        toast.error('আপনি এই পেজটি দেখার জন্য অনুমোদিত নন।');
        navigate(`/school/${id}`);
    }
  }, [isAuthorized, id, navigate, toast, currentUser]);

  // Load Metadata (Offline Friendly)
  const fetchInitial = useCallback(async () => {
    try {
      const classRes = await scopedGet('/api/academics/classrooms/', id, {});
      const data = Array.isArray(classRes.data) ? classRes.data : classRes.data.results || [];
      setClassrooms(data);
    } catch (err) {
      console.error(err);
      const cached = await db.classrooms.where({ 'school.id': parseInt(id) }).toArray();
      if (cached.length) {
        setClassrooms(cached);
      }
    }
  }, [id]);

  useEffect(() => { if (id) fetchInitial(); }, [id, fetchInitial]);

  const fetchSections = useCallback(async () => {
    if (!selectedClassroom) return;
    try {
      const res = await scopedGet('/api/academics/sections/', id, { classroom: selectedClassroom });
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setSections(data);
    } catch (err) {
      console.error(err);
      const cached = await db.sections.where({ 'classroom.id': parseInt(selectedClassroom) }).toArray();
      if (cached.length) {
        setSections(cached);
      }
    }
  }, [selectedClassroom, id]);

  useEffect(() => { fetchSections(); }, [fetchSections]);

  // UNIVERSAL STUDENT FETCH (For cross-class scanning)
  const fetchAllStudents = useCallback(async () => {
    try {
        const res = await scopedGet('/api/academics/students/', id, { page_size: 1000 });
        allStudentsCacheRef.current = Array.isArray(res.data) ? res.data : (res.data?.results || []);
    } catch (e) {
        console.warn('Universal student fetch failed, falling back to local DB');
        const cached = await db.students.toArray();
        if (cached.length) allStudentsCacheRef.current = cached;
    }
  }, [id]);

  useEffect(() => { fetchAllStudents(); }, [fetchAllStudents]);

  // Load Students and Attendance (Offline-First Optimized)
  const loadStudents = useCallback(async () => {
    if (!selectedClassroom) {
      setStudents([]);
      setAttendance({});
      return;
    }

    setLoading(true);
    try {
      // 1. Fetch Students (with large page size)
      const studentRes = await scopedGet('/api/academics/students/', id, {
        classroom: selectedClassroom,
        section: selectedSection || undefined,
        page_size: 1000
      });

      const rawStudents = Array.isArray(studentRes.data) ? studentRes.data : (studentRes.data?.results || []);

      // 2. Fetch Attendance Records for the selected date
      let records = [];
      try {
        const attendanceRes = await api.get(`/api/attendance/records/`, { params: { school: id, date, page_size: 1000 } });
        records = Array.isArray(attendanceRes.data) ? attendanceRes.data : (attendanceRes.data?.results || []);
      } catch (attErr) {
        console.error('Attendance records fetch failed. Status:', attErr.response?.status);
        console.error('Error Response Data:', attErr.response?.data);
        toast.error('হাজিরা রেকর্ড লোড করা যায়নি: ' + (attErr.response?.data?.detail || attErr.message || 'Server Error'));
      }

      const attMap = {};
      records.forEach(r => {
        if (r.student) attMap[r.student] = r.present;
      });

      const initialAtt = {};
      rawStudents.forEach(s => {
        initialAtt[s.id] = attMap[s.id] || false;
      });

      // Sort by roll number numerically
      const sortedStudents = [...rawStudents].sort((a, b) => {
        const ar = parseInt(String(a?.roll_number ?? '').replace(/\D/g, ''), 10);
        const br = parseInt(String(b?.roll_number ?? '').replace(/\D/g, ''), 10);
        if (!isNaN(ar) && !isNaN(br) && ar !== br) return ar - br;
        return String(a?.roll_number || '').localeCompare(String(b?.roll_number || ''), undefined, { numeric: true });
      });

      setStudents(sortedStudents);
      setAttendance(initialAtt);
    } catch (err) {
        console.error('Load students failed:', err);
        toast.error('শিক্ষার্থী তালিকা লোড করা যায়নি');
    } finally {
        setLoading(false);
    }
  }, [id, selectedClassroom, selectedSection, date, toast]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  // --- SCAN LOGIC ---

  const handleQrScanSuccess = useCallback(async (text) => {
    try {
      let studentId;
      if (text.startsWith('STU|')) {
        const parts = text.split('|');
        studentId = parseInt(parts[1]);
      } else {
        const data = JSON.parse(text);
        studentId = data.id || data.student_id;
      }

      if (!studentId) return;

      // Duplicate Check (Local State)
      if (attendance[studentId]) {
        playBeep(400, 300);
        toast.info('ইতিমধ্যে উপস্থিতি নেওয়া হয়েছে', { autoClose: 1000, position: 'top-center' });
        return;
      }

      // UNIVERSAL SEARCH (In current list OR in entire school cache)
      let student = students.find(s => s.id === studentId);
      if (!student) {
          student = allStudentsCacheRef.current.find(s => s.id === studentId);
      }

      if (!student) {
          playBeep(300, 500);
          toast.error('শিক্ষার্থী খুঁজে পাওয়া যায়নি');
          return;
      }

      // Success!
      playBeep(1000, 200);

      // Update local state if the student is in current view
      if (students.some(s => s.id === studentId)) {
          setAttendance(prev => ({ ...prev, [studentId]: true }));
      }

      // SHOW OVERLAY IMMEDIATELY (Attractive 3-line format)
      setScanSuccess({
          name: `${student.user?.first_name || ''} ${student.user?.last_name || ''}`.trim() || student.user?.username,
          roll: student.roll_number,
          class: student.classroom?.name || student.classroom,
          section: student.section?.name || student.section || 'N/A',
          photo: getMediaUrl(student.user?.photo || student.photo),
          schoolName: schoolInfo?.bn_name || schoolInfo?.name || ''
      });

      // Faster auto-hide to prevent queue jam
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setScanSuccess(null), 1500);

      // SAVE RECORD
      const currentYear = dayjs(date).format('YYYY');
      const rec = {
          school: parseInt(id),
          student: studentId,
          date,
          present: true,
          note: 'Universal QR Scan',
          device_id: deviceId,
          scan_time: new Date().toISOString(),
          session: currentYear
      };

      try {
        await scopedPost('/api/attendance/records/bulk_save/', id, { records: [rec] });
        console.log('QR Attendance saved successfully');
      } catch (saveErr) {
        console.error('Failed to save QR attendance immediately:', saveErr);
        // Interceptor in api.js will handle queuing if it was a network error
      }

    } catch (e) {
        console.error('Scan error:', e);
        toast.error('অবৈধ কোড');
    }
  }, [attendance, date, id, toast, students, deviceId, schoolInfo]);

  useEffect(() => {
    let html5QrCode;
    if (qrScannerOpen) {
      const startScanner = async () => {
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          const devices = await Html5Qrcode.getCameras().catch(() => []);
          html5QrCode = new Html5Qrcode("qr-reader");
          qrScannerRef.current = html5QrCode;
          const config = { fps: 25, qrbox: { width: 300, height: 300 }, aspectRatio: 1.0 };
          await html5QrCode.start({ facingMode: "environment" }, config, handleQrScanSuccess).catch(async () => {
            await html5QrCode.start({ facingMode: "user" }, config, handleQrScanSuccess);
          });
          scannerRunningRef.current = true;
        } catch (err) {
          toast.error("ক্যামেরা চালু করা যায়নি।");
          setQrScannerOpen(false);
        }
      };
      startScanner();
      return () => {
        if (qrScannerRef.current && scannerRunningRef.current) {
          try {
            qrScannerRef.current.stop().catch(() => {});
          } catch (e) {
            // Ignore any errors when stopping
          } finally {
            qrScannerRef.current = null;
            scannerRunningRef.current = false;
          }
        }
      };
    }
  }, [qrScannerOpen, handleQrScanSuccess, toast]);

  const toggleTorch = async () => {
    if (qrScannerRef.current && scannerRunningRef.current && qrScannerRef.current.isScanning) {
      try {
        const state = !torchOn;
        await qrScannerRef.current.applyVideoConstraints({ advanced: [{ torch: state }] });
        setTorchOn(state);
      } catch (err) { console.warn("Torch not supported"); }
    }
  };

  const handleBulkSave = async () => {
    if (students.length === 0) return;
    setSaving(true);
    try {
      const records = students.map(s => ({
        school: parseInt(id),
        student: s.id,
        date,
        present: !!attendance[s.id],
        note: 'Manual Save',
        device_id: deviceId,
        scan_time: new Date().toISOString(),
        session: dayjs(date).format('YYYY')
      }));

      const response = await scopedPost('/api/attendance/records/bulk_save/', id, { records });

      if (response.data?.offline) {
        toast.success('অফলাইন মোড: হাজিরা সংরক্ষিত হয়েছে এবং অনলাইনে ফিরলে সিঙ্ক হবে।');
      } else {
        toast.success('সফলভাবে সংরক্ষিত হয়েছে');
      }
    } catch (err) {
        console.error('Bulk Save Error Response:', err.response?.data);
        const serverMsg = err.response?.data?.error || err.response?.data?.detail || 'সংরক্ষণ করা যায়নি';
        toast.error(serverMsg);
    }
    finally { setSaving(false); }
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 3 } }}>
      {/* FILTER PANEL */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, border: '1px solid #e0e0e0' }} className="no-print">
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
              <Typography variant="caption" color="primary" sx={{ fontWeight: 'bold', ml: 1 }}>তারিখ নির্বাচন করুন</Typography>
              <TextField id="attendance-date-picker" type="date" fullWidth value={date} size="small" onChange={(e) => { setDate(e.target.value); updateUrl(selectedClassroom, selectedSection, e.target.value); }} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="primary" sx={{ fontWeight: 'bold', ml: 1 }}>শ্রেণি নির্বাচন</Typography>
            <TextField
              id="attendance-class-select"
              select
              fullWidth
              value={classrooms.some(c => String(c.id) === String(selectedClassroom)) ? selectedClassroom : ''}
              size="small"
              onChange={(e) => { setSelectedClassroom(e.target.value); setSelectedSection(''); updateUrl(e.target.value, '', date); }}
            >
              <MenuItem value="">নির্বাচন করুন</MenuItem>
              {classrooms.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={2}>
            <Typography variant="caption" color="primary" sx={{ fontWeight: 'bold', ml: 1 }}>সেকশন</Typography>
            <TextField
              id="attendance-section-select"
              select
              fullWidth
              value={sections.some(s => String(s.id) === String(selectedSection)) ? selectedSection : ''}
              size="small"
              onChange={(e) => { setSelectedSection(e.target.value); updateUrl(selectedClassroom, e.target.value, date); }}
            >
              <MenuItem value="">নির্বাচন করুন</MenuItem>
              {sections.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Stack direction="row" spacing={1} sx={{ mt: { xs: 1, sm: 2.5 } }}>
              <Button
                variant="contained"
                fullWidth
                onClick={() => setQrScannerOpen(true)}
                sx={{ height: 40, fontWeight: 'bold', bgcolor: '#1a237e' }}
              >
                স্ক্যানার
              </Button>
              <Button
                id="attendance-save-btn"
                variant="contained"
                fullWidth
                color="success"
                onClick={handleBulkSave}
                disabled={saving || !selectedClassroom}
                sx={{ height: 40, fontWeight: 'bold' }}
              >
                {saving ? <CircularProgress size={24} /> : 'সেভ করুন'}
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* STUDENT LIST */}
      {students.length === 0 && loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 10 }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }}>লোড হচ্ছে...</Typography>
          </Box>
      ) : (
        <Box sx={{ width: '100%', overflow: 'hidden' }}>
          {students.length > 0 ? (
            <TableContainer component={Paper} sx={{ boxShadow: 3, borderRadius: 2, overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 400 }}>
                <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>রোল</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>নাম</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>হাজিরা</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {students.map(s => (
                    <TableRow key={s.id} sx={{ bgcolor: attendance[s.id] ? '#e8f5e9' : 'inherit', transition: 'background 0.3s' }}>
                        <TableCell sx={{ fontWeight: attendance[s.id] ? 'bold' : 'normal' }}>{s.roll_number}</TableCell>
                        <TableCell>{s.user?.first_name} {s.user?.last_name}</TableCell>
                        <TableCell align="center">
                            <Checkbox
                                checked={!!attendance[s.id]}
                                color="success"
                                onChange={() => setAttendance(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                            />
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </TableContainer>
          ) : selectedClassroom && (
            <Box sx={{ textAlign: 'center', p: 5, bgcolor: '#fff', borderRadius: 2, border: '1px dashed #ccc' }}>
                <Typography color="text.secondary">এই ক্লাসে কোনো শিক্ষার্থী খুঁজে পাওয়া যায়নি</Typography>
            </Box>
          )}
        </Box>
      )}

      {/* SCANNER DIALOG */}
      <Dialog open={qrScannerOpen} onClose={() => setQrScannerOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>হাজিরা স্ক্যানার</Typography>
            <Stack direction="row" spacing={1}>
              <IconButton onClick={toggleTorch} color={torchOn ? "warning" : "default"}>
                {torchOn ? <FlashOnIcon /> : <FlashOffIcon />}
              </IconButton>
              <IconButton onClick={() => setQrScannerOpen(false)}><CloseIcon /></IconButton>
            </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, position: 'relative' }}>
          <Box id="qr-reader" sx={{ width: '100%', minHeight: '350px', bgcolor: '#000' }} />

          {/* SUCCESS OVERLAY (Attractive 3-line format) */}
          {scanSuccess && (
              <Zoom in={!!scanSuccess}>
                <Box sx={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'rgba(232, 245, 233, 0.98)', // Light green semi-transparent
                    py: 6, // Increased vertical padding to prevent clipping
                    px: 3,
                    textAlign: 'center',
                    border: '10px solid #2e7d32', // Strong green border
                    overflow: 'hidden'
                }}>
                    {/* Line 1: Roll, Section, Class */}
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1b5e20', mb: 1, letterSpacing: 1 }}>
                        রোল: {scanSuccess.roll} | শাখা: {scanSuccess.section} | শ্রেণি: {scanSuccess.class}
                    </Typography>

                    {/* Student Photo */}
                    <Avatar
                        src={scanSuccess.photo}
                        sx={{ width: 130, height: 130, mb: 2, border: '5px solid #2e7d32', boxShadow: 6 }}
                    >
                        {scanSuccess.name[0]}
                    </Avatar>

                    {/* Line 2: Student Name */}
                    <Typography variant="h3" sx={{
                        fontWeight: '900',
                        color: '#000',
                        mb: 1.5,
                        textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
                        fontSize: { xs: '1.8rem', sm: '3rem' } // Responsive name font
                    }}>
                        {scanSuccess.name}
                    </Typography>

                    {/* Status Badge */}
                    <Box sx={{ mb: 2, px: 4, py: 1, borderRadius: 10, bgcolor: '#2e7d32', color: 'white', boxShadow: 3 }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>উপস্থিতি নেওয়া হয়েছে</Typography>
                    </Box>

                    {/* Line 3: School Name */}
                    <Typography variant="h4" sx={{
                        fontWeight: '900',
                        color: '#1a237e',
                        mt: 'auto', // Push to bottom but within padding
                        fontSize: { xs: '1.4rem', sm: '2.4rem' },
                        textTransform: 'uppercase',
                        lineHeight: 1.1
                    }}>
                        {scanSuccess.schoolName}
                    </Typography>
                </Box>
              </Zoom>
          )}

          <Box sx={{ p: 2, display: 'flex', gap: 1, bgcolor: '#f9f9f9' }}>
            <TextField
                label="ম্যানুয়াল আইডি"
                fullWidth
                size="small"
                value={manualStudentId}
                onChange={(e) => setManualStudentId(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleQrScanSuccess(manualStudentId)}
            />
            <Button variant="contained" onClick={() => handleQrScanSuccess(manualStudentId)}>যোগ</Button>
          </Box>
        </DialogContent>
      </Dialog>

      <InputGuidance
        steps={guidanceSteps}
        activeStep={activeStep}
        onStepComplete={(step) => setActiveStep(step)}
      />
    </Box>
  );
}
