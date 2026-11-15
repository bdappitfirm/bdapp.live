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
import { db } from '../utils/offlineDb';
import { getMediaUrl } from '../utils/media';

// --- HELPERS ---

const getDeviceId = () => {
    let id = localStorage.getItem('bdapp_device_id');
    if (!id) {
        id = 'DEV-' + Math.random().toString(36).substring(2, 10).toUpperCase();
        localStorage.setItem('bdapp_device_id', id);
    }
    return id;
};

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

const MemoizedStudentAttendanceRow = React.memo(({ student, isPresent, onToggle }) => {
  const name = `${student.user?.first_name || ''} ${student.user?.last_name || ''}`.trim() || student.user?.username || '-';
  return (
    <TableRow sx={{ bgcolor: isPresent ? '#e8f5e9' : 'inherit', transition: 'background 0.15s ease' }}>
      <TableCell sx={{ fontWeight: isPresent ? 'bold' : 'normal', py: 1 }}>{student.roll_number || '-'}</TableCell>
      <TableCell sx={{ py: 1 }}>{name}</TableCell>
      <TableCell align="center" sx={{ py: 1 }}>
        <Checkbox
          checked={isPresent}
          color="success"
          onChange={() => onToggle(student.id)}
        />
      </TableCell>
    </TableRow>
  );
});

const MemoizedEmployeeAttendanceRow = React.memo(({ employee, isPresent, onToggle }) => {
  const name = employee.name_en || employee.name_bn || 'Employee';
  const desig = employee.designation_name || employee.designation?.name || '-';
  const empId = employee.employee_id || '-';
  return (
    <TableRow sx={{ bgcolor: isPresent ? '#e8f5e9' : 'inherit', transition: 'background 0.15s ease' }}>
      <TableCell sx={{ fontWeight: isPresent ? 'bold' : 'normal', py: 1 }}>{empId}</TableCell>
      <TableCell sx={{ py: 1 }}>{name} <Typography variant="caption" color="text.secondary" display="block">{desig}</Typography></TableCell>
      <TableCell align="center" sx={{ py: 1 }}>
        <Checkbox
          checked={isPresent}
          color="success"
          onChange={() => onToggle(employee.id)}
        />
      </TableCell>
    </TableRow>
  );
});

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

  // MODE: 'student' or 'employee'
  const [attendanceType, setAttendanceType] = useState('student');

  // FILTERS (Student)
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassroom, setSelectedClassroom] = useState('');
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');

  // FILTERS (Employee)
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');

  // DATA
  const [students, setStudents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // CACHE FOR UNIVERSAL SCANNING
  const allStudentsCacheRef = useRef([]);

  // SUCCESS OVERLAY
  const [scanSuccess, setScanSuccess] = useState(null);
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

  // Load Metadata (Classrooms & Departments)
  const fetchInitial = useCallback(async () => {
    try {
      const classRes = await scopedGet('/api/academics/classrooms/', id, {});
      const data = Array.isArray(classRes.data) ? classRes.data : classRes.data.results || [];
      setClassrooms(data);
    } catch (err) {
      console.error(err);
      const cached = await db.classrooms.where({ 'school.id': parseInt(id) }).toArray();
      if (cached.length) setClassrooms(cached);
    }
  }, [id]);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await scopedGet('/api/employees/departments/', id, {});
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setDepartments(data);
    } catch (err) {
      console.error(err);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchInitial();
      fetchDepartments();
    }
  }, [id, fetchInitial, fetchDepartments]);

  const fetchSections = useCallback(async () => {
    if (!selectedClassroom) return;
    try {
      const res = await scopedGet('/api/academics/sections/', id, { classroom: selectedClassroom });
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setSections(data);
    } catch (err) {
      console.error(err);
    }
  }, [selectedClassroom, id]);

  useEffect(() => { fetchSections(); }, [fetchSections]);

  const fetchAllStudents = useCallback(async () => {
    try {
        const res = await scopedGet('/api/academics/students/', id, { page_size: 1000 });
        allStudentsCacheRef.current = Array.isArray(res.data) ? res.data : (res.data?.results || []);
    } catch (e) {
        const cached = await db.students.toArray();
        if (cached.length) allStudentsCacheRef.current = cached;
    }
  }, [id]);

  useEffect(() => { fetchAllStudents(); }, [fetchAllStudents]);

  const allEmployeesCacheRef = useRef([]);

  const fetchAllEmployees = useCallback(async () => {
    try {
        const res = await scopedGet('/api/employees/employees/', id, { page_size: 1000 });
        allEmployeesCacheRef.current = Array.isArray(res.data) ? res.data : (res.data?.results || []);
    } catch (e) {}
  }, [id]);

  useEffect(() => { fetchAllEmployees(); }, [fetchAllEmployees]);

  // Load Students Attendance
  const loadStudents = useCallback(async () => {
    if (attendanceType !== 'student' || !selectedClassroom) {
      if (attendanceType === 'student') {
        setStudents([]);
        setAttendance({});
      }
      return;
    }

    setLoading(true);
    try {
      const studentRes = await scopedGet('/api/academics/students/', id, {
        classroom: selectedClassroom,
        section: selectedSection || undefined,
        page_size: 1000
      });

      const rawStudents = Array.isArray(studentRes.data) ? studentRes.data : (studentRes.data?.results || []);
      if (rawStudents.length > 0) {
        try { await db.students.bulkPut(rawStudents); } catch (e) {}
      }

      let records = [];
      try {
        const attendanceRes = await api.get(`/api/attendance/records/`, {
            params: { school: id, date, page_size: 1000 }
        });
        records = Array.isArray(attendanceRes.data) ? attendanceRes.data : (attendanceRes.data?.results || []);
      } catch (attErr) {
        console.warn('Attendance fetch failed:', attErr);
      }

      const attMap = {};
      records.forEach(r => {
        if (r.student) attMap[r.student] = r.present;
      });

      const initialAtt = {};
      rawStudents.forEach(s => {
        initialAtt[s.id] = attMap[s.id] || false;
      });

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
    } finally {
      setLoading(false);
    }
  }, [id, selectedClassroom, selectedSection, date, attendanceType]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  // Load Employees Attendance
  const loadEmployees = useCallback(async () => {
    if (attendanceType !== 'employee') return;

    setLoading(true);
    try {
      const empRes = await scopedGet('/api/employees/employees/', id, {
        department: selectedDepartment || undefined,
        page_size: 1000
      });
      const rawEmps = Array.isArray(empRes.data) ? empRes.data : (empRes.data?.results || []);

      let records = [];
      try {
        const attRes = await api.get('/api/attendance/records/', {
          params: { school: id, date, page_size: 1000 }
        });
        records = Array.isArray(attRes.data) ? attRes.data : (attRes.data?.results || []);
      } catch (e) {}

      const attMap = {};
      records.forEach(r => {
        if (r.employee) attMap[r.employee] = r.present;
      });

      const initialAtt = {};
      rawEmps.forEach(e => {
        initialAtt[e.id] = attMap[e.id] || false;
      });

      setEmployees(rawEmps);
      setAttendance(initialAtt);
    } catch (err) {
      console.error('Load employees failed:', err);
    } finally {
      setLoading(false);
    }
  }, [id, selectedDepartment, date, attendanceType]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const toggleAttendance = useCallback((itemId) => {
    setAttendance(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  }, []);

  // --- SCAN LOGIC ---

  const handleQrScanSuccess = useCallback(async (text) => {
    try {
      let studentId;
      let employeeId;
      const cleanText = String(text || '').trim();
      if (cleanText.startsWith('STU|')) {
        const parts = cleanText.split('|');
        studentId = parseInt(parts[1], 10);
      } else if (cleanText.startsWith('EMP|')) {
        const parts = cleanText.split('|');
        employeeId = parseInt(parts[1], 10);
      } else {
        try {
          const data = JSON.parse(cleanText);
          studentId = data.id || data.student_id;
        } catch (e) {
          studentId = parseInt(cleanText, 10);
        }
      }

      // Handle Employee QR Scan
      if (employeeId && !isNaN(employeeId)) {
        try {
          let emp = employees.find(e => e.id === employeeId);
          if (!emp) {
            emp = allEmployeesCacheRef.current.find(e => e.id === employeeId);
          }
          if (!emp) {
            const res = await scopedGet(`/api/employees/employees/${employeeId}/`, id);
            emp = res.data;
          }
          if (emp) {
            if (attendance[employeeId]) {
              playBeep(400, 300);
              toast.info('ইতিমধ্যে উপস্থিতি নেওয়া হয়েছে', { autoClose: 1000, position: 'top-center' });
              return;
            }

            playBeep(1000, 200);
            if (employees.some(e => e.id === employeeId)) {
              setAttendance(prev => ({ ...prev, [employeeId]: true }));
            }

            setScanSuccess({
              name: emp.name_en || emp.name_bn || 'Employee',
              roll: emp.employee_id,
              class: emp.designation_name || emp.designation?.name || 'Staff',
              section: emp.department_name || emp.department?.name || '',
              photo: getMediaUrl(emp.photo_url || emp.photo),
              schoolName: schoolInfo?.bn_name || schoolInfo?.name || ''
            });

            if (successTimerRef.current) clearTimeout(successTimerRef.current);
            successTimerRef.current = setTimeout(() => setScanSuccess(null), 2000);

            // Save record immediately
            const currentYear = dayjs(date).format('YYYY');
            const rec = {
              school: parseInt(id),
              employee: employeeId,
              date,
              present: true,
              note: 'QR Scan Employee',
              device_id: deviceId,
              scan_time: new Date().toISOString(),
              session: currentYear
            };

            await scopedPost('/api/attendance/records/bulk_save/', id, { records: [rec] });
            toast.success(`কর্মী উপস্থিতি সফল: ${emp.name_en || emp.name_bn}`);
            return;
          }
        } catch (err) {
          playBeep(300, 500);
          toast.error('কর্মী খুঁজে পাওয়া যায়নি');
          return;
        }
      }

      if (!studentId || isNaN(studentId)) return;

      // Duplicate Check (Local State)
      if (attendance[studentId]) {
        playBeep(400, 300);
        toast.info('ইতিমধ্যে উপস্থিতি নেওয়া হয়েছে', { autoClose: 1000, position: 'top-center' });
        return;
      }

      // UNIVERSAL SEARCH
      let student = students.find(s => s.id === studentId);
      if (!student) {
          student = allStudentsCacheRef.current.find(s => s.id === studentId);
      }
      if (!student) {
          try {
              const res = await scopedGet(`/api/academics/students/${studentId}/`, id);
              if (res.data) student = res.data;
          } catch (err) {}
      }

      if (!student) {
          playBeep(300, 500);
          toast.error('শিক্ষার্থী খুঁজে পাওয়া যায়নি');
          return;
      }

      // Success!
      playBeep(1000, 200);

      if (students.some(s => s.id === studentId)) {
          setAttendance(prev => ({ ...prev, [studentId]: true }));
      }

      setScanSuccess({
          name: `${student.user?.first_name || ''} ${student.user?.last_name || ''}`.trim() || student.user?.username,
          roll: student.roll_number,
          class: student.classroom?.name || student.classroom,
          section: student.section?.name || student.section || 'N/A',
          photo: getMediaUrl(student.user?.photo || student.photo),
          schoolName: schoolInfo?.bn_name || schoolInfo?.name || ''
      });

      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setScanSuccess(null), 1500);

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
        toast.success(`হাজিরা নেওয়া হয়েছে: ${student.user?.first_name || ''}`);
      } catch (saveErr) {
        console.error('Failed to save QR attendance immediately:', saveErr);
      }

    } catch (e) {
      console.error('Scan error:', e);
    }
  }, [students, employees, attendance, id, date, deviceId, schoolInfo, toast]);

  // SCANNER EFFECT
  useEffect(() => {
    let html5QrCode;
    if (qrScannerOpen) {
      const startScanner = async () => {
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          html5QrCode = new Html5Qrcode("qr-reader");
          qrScannerRef.current = html5QrCode;
          const config = { fps: 25, qrbox: { width: 300, height: 300 }, aspectRatio: 1.0 };

          let started = false;

          // 1. Try listing cameras and using back/environment camera deviceId if available
          try {
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
              const backCamera = devices.find(d => /back|rear|environment/i.test(d.label)) || devices[devices.length - 1];
              await html5QrCode.start(backCamera.id, config, handleQrScanSuccess);
              started = true;
            }
          } catch (camErr) {
            console.warn('getCameras failed, falling back to facingMode:', camErr);
          }

          // 2. Try facingMode environment
          if (!started) {
            try {
              await html5QrCode.start({ facingMode: "environment" }, config, handleQrScanSuccess);
              started = true;
            } catch (envErr) {
              console.warn('facingMode environment failed:', envErr);
            }
          }

          // 3. Try facingMode user
          if (!started) {
            try {
              await html5QrCode.start({ facingMode: "user" }, config, handleQrScanSuccess);
              started = true;
            } catch (userErr) {
              console.warn('facingMode user failed:', userErr);
            }
          }

          // 4. Try true (any default camera)
          if (!started) {
            await html5QrCode.start(true, config, handleQrScanSuccess);
            started = true;
          }

          if (started) {
            scannerRunningRef.current = true;
          } else {
            throw new Error('All camera start methods failed');
          }
        } catch (err) {
          console.error('Camera start error:', err);
          toast.error('ক্যামেরা চালু করা যায়নি');
          setQrScannerOpen(false);
        }
      };
      startScanner();
      return () => {
        if (qrScannerRef.current && scannerRunningRef.current) {
          try {
            qrScannerRef.current.stop().catch(() => {});
          } catch (e) {} finally {
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
    const items = attendanceType === 'student' ? students : employees;
    if (items.length === 0) return;
    setSaving(true);
    try {
      const records = items.map(item => ({
        school: parseInt(id),
        [attendanceType === 'student' ? 'student' : 'employee']: item.id,
        date,
        present: !!attendance[item.id],
        note: 'Manual Save',
        device_id: deviceId,
        scan_time: new Date().toISOString(),
        session: dayjs(date).format('YYYY')
      }));

      await scopedPost('/api/attendance/records/bulk_save/', id, { records });
      toast.success('সফলভাবে সংরক্ষিত হয়েছে');
    } catch (err) {
        console.error('Bulk Save Error:', err);
        toast.error('সংরক্ষণ করা যায়নি');
    }
    finally { setSaving(false); }
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 3 } }}>
      {/* ATTENDANCE TYPE SWITCHER */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button
          variant={attendanceType === 'student' ? 'contained' : 'outlined'}
          onClick={() => { setAttendanceType('student'); setSelectedClassroom(''); setSelectedSection(''); }}
          sx={{ fontWeight: 'bold', borderRadius: 2 }}
        >
          🎓 শিক্ষার্থী উপস্থিতি (Student)
        </Button>
        <Button
          variant={attendanceType === 'employee' ? 'contained' : 'outlined'}
          onClick={() => { setAttendanceType('employee'); setSelectedDepartment(''); }}
          sx={{ fontWeight: 'bold', borderRadius: 2 }}
        >
          👨‍💼 কর্মী উপস্থিতি (Employee / Staff)
        </Button>
      </Stack>

      {/* FILTER PANEL */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, border: '1px solid #e0e0e0' }} className="no-print">
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={attendanceType === 'student' ? 3 : 4}>
              <Typography variant="caption" color="primary" sx={{ fontWeight: 'bold', ml: 1 }}>তারিখ নির্বাচন করুন</Typography>
              <TextField id="attendance-date-picker" type="date" fullWidth value={date} size="small" onChange={(e) => setDate(e.target.value)} />
          </Grid>

          {attendanceType === 'student' ? (
            <>
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
            </>
          ) : (
            <Grid item xs={12} sm={5}>
              <Typography variant="caption" color="primary" sx={{ fontWeight: 'bold', ml: 1 }}>বিভাগ (Department) নির্বাচন</Typography>
              <TextField
                select
                fullWidth
                value={departments.some(d => String(d.id) === String(selectedDepartment)) ? selectedDepartment : ''}
                size="small"
                onChange={(e) => setSelectedDepartment(e.target.value)}
              >
                <MenuItem value="">সকল বিভাগ (All Departments)</MenuItem>
                {departments.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
              </TextField>
            </Grid>
          )}

          <Grid item xs={12} sm={3}>
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
                disabled={saving || (attendanceType === 'student' && !selectedClassroom)}
                sx={{ height: 40, fontWeight: 'bold' }}
              >
                {saving ? <CircularProgress size={24} /> : 'সেভ করুন'}
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* LIST (Student or Employee) */}
      {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 10 }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }}>লোড হচ্ছে...</Typography>
          </Box>
      ) : (
        <Box sx={{ width: '100%', overflow: 'hidden' }}>
          {attendanceType === 'student' ? (
            students.length > 0 ? (
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
                        <MemoizedStudentAttendanceRow
                          key={s.id}
                          student={s}
                          isPresent={!!attendance[s.id]}
                          onToggle={toggleAttendance}
                        />
                      ))}
                  </TableBody>
                  </Table>
              </TableContainer>
            ) : selectedClassroom && (
              <Box sx={{ textAlign: 'center', p: 5, bgcolor: '#fff', borderRadius: 2, border: '1px dashed #ccc' }}>
                  <Typography color="text.secondary">এই ক্লাসে কোনো শিক্ষার্থী খুঁজে পাওয়া যায়নি</Typography>
              </Box>
            )
          ) : (
            employees.length > 0 ? (
              <TableContainer component={Paper} sx={{ boxShadow: 3, borderRadius: 2, overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 400 }}>
                  <TableHead>
                      <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                          <TableCell sx={{ fontWeight: 'bold' }}>আইডি</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>কর্মীর নাম ও পদবী</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 'bold' }}>হাজিরা</TableCell>
                      </TableRow>
                  </TableHead>
                  <TableBody>
                      {employees.map(e => (
                        <MemoizedEmployeeAttendanceRow
                          key={e.id}
                          employee={e}
                          isPresent={!!attendance[e.id]}
                          onToggle={toggleAttendance}
                        />
                      ))}
                  </TableBody>
                  </Table>
              </TableContainer>
            ) : (
              <Box sx={{ textAlign: 'center', p: 5, bgcolor: '#fff', borderRadius: 2, border: '1px dashed #ccc' }}>
                  <Typography color="text.secondary">কোনো কর্মী খুঁজে পাওয়া যায়নি</Typography>
              </Box>
            )
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

          {/* SUCCESS OVERLAY */}
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
                    bgcolor: 'rgba(232, 245, 233, 0.98)',
                    py: 6,
                    px: 3,
                    textAlign: 'center',
                    border: '10px solid #2e7d32',
                    overflow: 'hidden'
                }}>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1b5e20', mb: 1, letterSpacing: 1 }}>
                        আইডি/রোল: {scanSuccess.roll} | বিভাগ/শাখা: {scanSuccess.section} | পদবী/শ্রেণি: {scanSuccess.class}
                    </Typography>

                    <Avatar
                        src={scanSuccess.photo}
                        sx={{ width: 130, height: 130, mb: 2, border: '5px solid #2e7d32', boxShadow: 6 }}
                    >
                        {scanSuccess.name[0]}
                    </Avatar>

                    <Typography variant="h3" sx={{
                        fontWeight: '900',
                        color: '#000',
                        mb: 1.5,
                        fontSize: { xs: '1.8rem', sm: '3rem' }
                    }}>
                        {scanSuccess.name}
                    </Typography>

                    <Box sx={{ mb: 2, px: 4, py: 1, borderRadius: 10, bgcolor: '#2e7d32', color: 'white', boxShadow: 3 }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>হাজিরা সফলভাবে নেওয়া হয়েছে ✓</Typography>
                    </Box>

                    <Typography variant="subtitle1" sx={{ color: '#333', fontWeight: 'bold' }}>
                        {scanSuccess.schoolName}
                    </Typography>
                </Box>
              </Zoom>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
