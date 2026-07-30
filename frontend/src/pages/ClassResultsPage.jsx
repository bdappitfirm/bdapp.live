import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Paper, Stack, Button, TextField, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress } from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PrintIcon from '@mui/icons-material/Print';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import api from '../utils/api';
import { scopedGet } from '../utils/schoolApi';
import { useAcademics } from '../context/AcademicsContext';
import { useSchool } from '../context/SchoolContext';

const UNWANTED_SUBJECTS = [
  'আরবি', 'বাংলা', 'ভৌৌতবিজ্ঞান', 'ইংরেজি', 'সামাজিক বিজ্ঞান',
  'ইংরেজী', 'সমাজ', 'ধর্ম', 'ইংরেজি-1', 'ইংরেজি-2', 'বাংলা-1', 'বাংলা-2'
];

const CO_CURRICULAR_SUBJECTS = [
  'শারীরিক শিক্ষা ও স্বাস্থ্য', 'শারীরিক শিক্ষা', 'Physical Education', 'Physical Education and Health',
  'ক্যারিয়ার শিক্ষা', 'ক্যারিয়ার শিক্ষা', 'Career Education', 'ক্যারিয়ার', 'ক্যারিয়ার',
  'Word Collection Achievement Test', 'WCAT',
  'বই পড়া', 'বই পড়া'
];

export default function ClassResultsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { classrooms, refreshClassrooms } = useAcademics();
  const { school: schoolInfo } = useSchool();
  const [selectedClass, setSelectedClass] = useState('');
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedExamType, setSelectedExamType] = useState('all');
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [students, setStudents] = useState([]);
  const [examinations, setExaminations] = useState([]);
  const [resultsByStudent, setResultsByStudent] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [overallTotals, setOverallTotals] = useState(new Map());
  const [noYearMessage, setNoYearMessage] = useState('');

  const updateUrl = useCallback((cls, sec, type, exam, year) => {
    const params = new URLSearchParams();
    if (cls) params.set('classroom', cls);
    if (sec) params.set('section', sec);
    if (type) params.set('type', type);
    if (exam) params.set('exam', exam);
    if (year) params.set('year', year);
    navigate(`${location.pathname}?${params.toString()}`);
  }, [location.pathname, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cls = params.get('classroom');
    const sec = params.get('section');
    const type = params.get('type');
    const exam = params.get('exam');
    const year = params.get('year');
    if (cls) setSelectedClass(cls);
    if (sec) setSelectedSection(sec);
    if (type) setSelectedExamType(type);
    if (exam) setSelectedExamId(exam);
    if (year) setSelectedYear(year);
  }, [location.search]);

  useEffect(() => { if (id) refreshClassrooms(id).catch(() => {}); }, [id, refreshClassrooms]);

  useEffect(() => {
    if (!selectedClass) { setSections([]); setStudents([]); return; }
    scopedGet('/api/academics/sections/', id, { classroom: selectedClass }).then(res => {
      setSections(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    }).catch(() => setSections([]));

    (async () => {
        const params = { classroom: selectedClass, page_size: 500 };
        if (selectedSection) params.section = selectedSection;
        try {
            const res = await scopedGet('/api/academics/students/', id, params);
            setStudents(res.data.results || res.data || []);
        } catch { setStudents([]); }
    })();
  }, [id, selectedClass, selectedSection]);

  const normalizeExamType = (t, name = '') => {
    const n = String(name || '').toLowerCase();
    if (/বার্ষিক|annual|final/.test(n)) return 'annual';
    if (/অর্ধ|half|mid/.test(n)) return 'half_yearly';
    return String(t || '').toLowerCase() || 'annual';
  };

  const getStudentResultsMap = useCallback((sid) => {
    const arr = resultsByStudent.get(String(sid)) || [];
    const m = new Map();
    for (const r of arr) {
      const nm = String(r.subject?.name || r.subject_name || '').trim();
      const key = nm.toLowerCase();
      const w = parseFloat(r.written_marks) || 0;
      const mcq = parseFloat(r.mcq_marks) || 0;
      const pr = parseFloat(r.practical_marks) || 0;
      const total = r.total_obtained != null ? parseFloat(r.total_obtained) : (w + mcq + pr);

      // Build components string: (CQ+MCQ+PRAC)
      const parts = [];
      if (w > 0) parts.push(w);
      if (mcq > 0) parts.push(mcq);
      if (pr > 0) parts.push(pr);
      const components = parts.length > 0 ? ` (${parts.join('+')})` : '';

      m.set(key, { total, components, grade: r.grade, is_passed: r.is_passed });
    }
    return m;
  }, [resultsByStudent]);

  useEffect(() => {
    if (!selectedClass) { setExaminations([]); setResultsByStudent(new Map()); return; }
    setLoading(true);
    scopedGet('/api/results/examinations/', id, { classroom: selectedClass, year: selectedYear }).then(async res => {
        let all = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        const filterType = selectedExamType || 'all';
        let exams = filterType === 'all' ? all : all.filter(e => normalizeExamType(e.exam_type, e.name) === filterType);
        if (selectedExamId) exams = exams.filter(e => String(e.id) === String(selectedExamId));
        setExaminations(exams);

        const byStudent = new Map();
        try {
            // Efficiently fetch ALL results for the classroom and year in one call
            const rRes = await scopedGet(`/api/results/results/`, id, {
                classroom: selectedClass,
                year: selectedYear,
                page_size: 5000
            });
            const arr = rRes.data.results || rRes.data || [];

            // Only keep results that belong to the matching exams
            const validExamIds = new Set(exams.map(e => String(e.id)));

            for (const r of arr) {
                const exId = String(r.examination?.id || r.examination);
                if (validExamIds.has(exId)) {
                    const sid = String(typeof r.student === 'object' ? r.student?.id : r.student);
                    if (!byStudent.has(sid)) byStudent.set(sid, []);
                    byStudent.get(sid).push(r);
                }
            }
        } catch (err) {
            console.error("Result fetch error:", err);
        }

        setResultsByStudent(byStudent);
        if (byStudent.size === 0) setNoYearMessage('কোনো তথ্য পাওয়া যায়নি');
        else setNoYearMessage('');

        const mt = new Map();
        for (const [sid, arr] of byStudent.entries()) {
            const tot = arr.reduce((s, r) => {
              const nm = String(r.subject?.name || r.subject_name || '').toLowerCase();
              const isCoCurricular = CO_CURRICULAR_SUBJECTS.some(sub => nm.includes(sub.toLowerCase()));
              if (isCoCurricular) return s;
              return s + (parseFloat(r.total_obtained || 0));
            }, 0);
            mt.set(sid, tot);
        }
        setOverallTotals(mt);
    }).finally(() => setLoading(false));
  }, [id, selectedClass, selectedExamType, selectedSection, selectedYear, selectedExamId]);

  const displaySubjects = useMemo(() => {
    const set = new Set();
    const currentStudentIds = new Set(students.map(s => String(s.id)));

    for (const [sid, arr] of resultsByStudent.entries()) {
      if (!currentStudentIds.has(sid)) continue;

      for (const r of arr) {
        const nm = String(r.subject?.name || r.subject_name || '').trim();
        const isCoCurricular = CO_CURRICULAR_SUBJECTS.some(sub => nm.toLowerCase().includes(sub.toLowerCase()));
        if (nm && !UNWANTED_SUBJECTS.includes(nm) && !isCoCurricular) {
          // Add subject if a result record exists, regardless of the mark value
          set.add(nm);
        }
      }
    }
    return Array.from(set).map(s => ({ label: s, key: s.toLowerCase() }));
  }, [resultsByStudent, students]);

  const sortedStudents = useMemo(() => {
    const list = [...students];
    list.sort((a,b) => (overallTotals.get(String(b.id)) || 0) - (overallTotals.get(String(a.id)) || 0));
    return list;
  }, [students, overallTotals]);

  return (
    <Box className="cr-print-container" sx={{ p: { xs: 1, sm: 3 }, "@media print": { p: 0, m: 0 } }}>
      {/* Print-only Header */}
      <Box className="print-only cr-print-only" sx={{ display: 'none', flexDirection: 'column', alignItems: 'center', mb: 1, mt: 0, borderBottom: '1px solid #000', pb: 1, width: '100%' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: '100%', px: 1 }}>
          {schoolInfo?.logo ? (
            <Box component="img" src={schoolInfo.logo} sx={{ height: '20mm', objectFit: 'contain' }} />
          ) : <Box sx={{ width: '20mm' }} />}

          <Box sx={{ textAlign: 'center', flex: 1, px: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#000', mb: 0.2, fontSize: '1.2rem !important', lineHeight: 1.1 }}>
              {schoolInfo?.bn_name || schoolInfo?.name}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 'medium', color: '#333', fontSize: '0.9rem !important' }}>
              শ্রেণিভিত্তিক ফলাফল (Class Results)
            </Typography>
            <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 'bold', fontSize: '0.8rem !important' }}>
              শ্রেণি: {classrooms.find(c => String(c.id) === String(selectedClass))?.name || '---'} |
              শাখা: {sections.find(s => String(s.id) === String(selectedSection))?.name || 'সব'} |
              সাল: {selectedYear}
            </Typography>
          </Box>

          {schoolInfo?.logo ? (
            <Box component="img" src={schoolInfo.logo} sx={{ height: '20mm', objectFit: 'contain' }} />
          ) : <Box sx={{ width: '20mm' }} />}
        </Stack>
      </Box>

      <Stack className="no-print" direction={{ xs: 'column', sm: 'row' }} alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4"><AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />ক্লাস রেজাল্টস</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>ব্যাক</Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>প্রিন্ট</Button>
        </Stack>
      </Stack>

      <Paper className="no-print" sx={{ p: 2, mb: 3 }}>
        <Stack spacing={2} direction={{ xs: 'column', md: 'row' }}>
          <TextField select label="শ্রেণি" value={selectedClass} onChange={(e) => updateUrl(e.target.value, '', selectedExamType, '', selectedYear)} sx={{ minWidth: 200 }}>
            {classrooms.map(cls => <MenuItem key={cls.id} value={cls.id}>{cls.name}</MenuItem>)}
          </TextField>
          <TextField select label="সেকশন" value={selectedSection} onChange={(e) => updateUrl(selectedClass, e.target.value, selectedExamType, selectedExamId, selectedYear)} sx={{ minWidth: 150 }} disabled={!selectedClass}>
            <MenuItem value="">সব</MenuItem>
            {sections.map(sec => <MenuItem key={sec.id} value={sec.id}>{sec.name}</MenuItem>)}
          </TextField>
          <TextField type="number" label="সাল" value={selectedYear} onChange={(e) => updateUrl(selectedClass, selectedSection, selectedExamType, selectedExamId, e.target.value)} sx={{ width: 100 }} />
          <Button variant="contained" onClick={() => updateUrl(selectedClass, '', 'all', '', new Date().getFullYear())}>সব দেখাও</Button>
        </Stack>
      </Paper>

      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box> : (
        sortedStudents.length > 0 ? (
          <Box sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer component={Paper} sx={{
              boxShadow: 'none',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              background: 'white'
            }}>
              <Table size="small" sx={{
                minWidth: { xs: 800, print: '100%' },
                tableLayout: 'fixed'
              }}>
                <colgroup>
                  <col style={{ width: '5%' }} />  {/* Roll */}
                  <col style={{ width: '13%' }} /> {/* Name */}
                  <col style={{ width: '6%' }} />  {/* Total */}
                  {displaySubjects.map((_, i) => (
                    <col key={i} style={{ width: `${76 / displaySubjects.length}%` }} />
                  ))}
                </colgroup>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main', backgroundImage: 'none' }}>
                    <TableCell sx={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem', boxShadow: 'none' }}>রোল</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.85rem', boxShadow: 'none' }}>নাম</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.85rem', boxShadow: 'none' }} align="center">মোট</TableCell>
                    {displaySubjects.map(s => (
                      <TableCell
                        key={s.key}
                        sx={{
                          color: 'white',
                          textAlign: 'center',
                          fontWeight: 'bold',
                          fontSize: '0.75rem',
                          lineHeight: 1.1,
                          padding: '4px 2px',
                          whiteSpace: 'normal',
                          wordBreak: 'break-word',
                          boxShadow: 'none'
                        }}
                        align="center"
                      >
                        {s.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedStudents.map(stu => {
                    const resMap = getStudentResultsMap(stu.id);
                    return (
                      <TableRow key={stu.id}>
                        <TableCell align="center">{stu.roll_number}</TableCell>
                        <TableCell>{stu.user?.first_name} {stu.user?.last_name}</TableCell>
                        <TableCell align="center">{overallTotals.get(String(stu.id)) || 0}</TableCell>
                        {displaySubjects.map(sub => {
                          const r = resMap.get(sub.key);
                          if (!r) return <TableCell key={sub.key} align="center">—</TableCell>;
                          return (
                            <TableCell key={sub.key} align="center">
                              {r.total}{r.components}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ) : (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="textSecondary">{noYearMessage || 'কোনো তথ্য পাওয়া যায়নি'}</Typography>
          </Paper>
        )
      )}

      <style>
        {`
          @media print {
            .no-print, header, footer, nav, aside, .MuiAppBar-root, .MuiDrawer-root, .MuiToolbar-root, .MuiSnackbar-root, .MuiAlert-root {
                display: none !important;
            }
            @page {
              size: landscape;
              margin: 0 !important; /* Hides browser headers and footers (date, URL, etc) */
            }

            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              width: 100% !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              forced-color-adjust: none !important;
              color-scheme: light !important;
            }

            .cr-print-container {
              display: block !important;
              background: white !important;
              margin: 0 !important;
              padding: 10mm !important; /* Internal padding for safe content */
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
              box-sizing: border-box !important;
              box-shadow: none !important;
              border: none !important;
            }

            .cr-print-container .MuiPaper-root {
              box-shadow: none !important;
              border: none !important;
              background-image: none !important;
              background-color: transparent !important;
            }

            .cr-print-only {
              display: flex !important;
              margin-top: 0 !important;
              margin-bottom: 15px !important;
              width: 100% !important;
            }

            .cr-print-container table {
              width: 100% !important;
              border-collapse: collapse !important;
              table-layout: fixed !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              border: 0.5pt solid #000 !important;
            }
            .cr-print-container th,
            .cr-print-container td {
              border: 0.5pt solid #000 !important;
              color: black !important;
              padding: 4px 2px !important;
              font-size: 9pt !important;
              overflow: visible !important;
              white-space: normal !important;
              word-break: break-word !important;
              overflow-wrap: break-word !important;
              text-align: center !important;
              height: auto !important;
              line-height: 1.2 !important;
              box-shadow: none !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            /* Name Column Specific */
            .cr-print-container th:nth-of-type(2),
            .cr-print-container td:nth-of-type(2) {
              text-align: left !important;
              padding-left: 5px !important;
              width: 25% !important;
            }
            /* Roll Column */
            .cr-print-container th:nth-of-type(1),
            .cr-print-container td:nth-of-type(1) {
              width: 5% !important;
            }
            /* Total Column */
            .cr-print-container th:nth-of-type(3),
            .cr-print-container td:nth-of-type(3) {
              width: 7% !important;
            }

            .cr-print-container th {
              background-color: #f0f0f0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              font-weight: bold !important;
            }

            /* Remove MUI table shadows and decorations */
            .MuiTableContainer-root {
              box-shadow: none !important;
              overflow: visible !important;
              width: 100% !important;
            }

            .MuiTableRow-root {
              background-color: transparent !important;
            }

            * {
              box-shadow: none !important;
              text-shadow: none !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              forced-color-adjust: none !important;
            }
          }
        `}
      </style>
    </Box>
  );
}
