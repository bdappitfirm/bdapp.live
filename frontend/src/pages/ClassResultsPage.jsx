import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Paper, Stack, Button, TextField, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, Backdrop } from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PrintIcon from '@mui/icons-material/Print';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import api from '../utils/api';
import { scopedGet } from '../utils/schoolApi';
import { useAcademics } from '../context/AcademicsContext';
import { useSchool } from '../context/SchoolContext';

const UNWANTED_SUBJECTS = [];

const CO_CURRICULAR_SUBJECTS = [
  'শারীরিক শিক্ষা ও স্বাস্থ্য', 'শারীরিক শিক্ষা', 'Physical Education', 'Physical Education and Health',
  'ক্যারিয়ার শিক্ষা', 'ক্যারিয়ার শিক্ষা', 'Career Education', 'Word Collection Achievement Test', 'WCAT',
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
    if (/বার্ষিক|annual|yearly|final/.test(n)) return 'annual';
    if (/অর্ধ|half|mid|semi/.test(n)) return 'half_yearly';
    if (/টার্মিনাল|terminal|term/.test(n)) return 'terminal';
    if (/মডেল|model/.test(n)) return 'model';
    if (/টেস্ট|test|monthly|নির্বাচনী/.test(n)) return 'test';
    if (/pre-test|প্রাক-নির্বাচনী/.test(n)) return 'pre_test';

    const typeMap = {
        'annual': 'annual',
        'half_yearly': 'half_yearly',
        'terminal': 'terminal',
        'model': 'model',
        'test': 'test',
        'pre_test': 'pre_test'
    };
    return typeMap[String(t).toLowerCase()] || 'annual';
  };

  const isClassNineOrTen = useMemo(() => {
    const cls = classrooms.find(c => String(c.id) === String(selectedClass));
    if (!cls) return false;
    const text = String(cls.name || '').toLowerCase();
    return /নবম|দশম|ssc|\b9\b|\b10\b|\bnine\b|\bten\b|\bix\b|\bx\b|class\s*9|class\s*10/.test(text);
  }, [selectedClass, classrooms]);

  const getStudentResultsMap = useCallback((sid) => {
    const arr = resultsByStudent.get(String(sid)) || [];
    const m = new Map();

    // For merging Bangla/English
    const papers = {
        bangla: [],
        english: []
    };

    for (const r of arr) {
      const nm = String(r.subject?.name || r.subject_name || '').trim();
      const lowerNm = nm.toLowerCase();

      if (isClassNineOrTen) {
          if ((lowerNm.includes('বাংলা') || lowerNm.includes('bangla')) && !lowerNm.includes('বাংলাদেশ')) {
              papers.bangla.push(r);
              continue;
          }
          if (lowerNm.includes('english') || lowerNm.includes('ইংরেজি') || lowerNm.includes('ইংরেজী')) {
              papers.english.push(r);
              continue;
          }
      }

      const key = lowerNm;
      const w = parseFloat(r.written_marks) || 0;
      const mcq = parseFloat(r.mcq_marks) || 0;
      const pr = parseFloat(r.practical_marks) || 0;
      const total = w + mcq + pr; // Recalculate to reflect latest edits

      const parts = [];
      if (w > 0) parts.push(w);
      if (mcq > 0) parts.push(mcq);
      if (pr > 0) parts.push(pr);
      const components = parts.length > 0 ? `(${parts.join('+')})` : '';

      const finalVal = total > 0 ? `${Math.round(total)}${components}` : 'Absent';
      m.set(key, { total, display: finalVal, grade: r.grade, is_passed: r.is_passed });
    }

    // Handle merged papers
    if (isClassNineOrTen) {
        if (papers.bangla.length > 0) {
            const sum = papers.bangla.reduce((s, r) => s + ((parseFloat(r.written_marks)||0) + (parseFloat(r.mcq_marks)||0) + (parseFloat(r.practical_marks)||0)), 0);
            const compStr = papers.bangla.map(r => Math.round((parseFloat(r.written_marks)||0) + (parseFloat(r.mcq_marks)||0) + (parseFloat(r.practical_marks)||0))).join('+');
            const displayVal = sum > 0 ? `${Math.round(sum)}(${compStr})` : 'Absent';
            m.set('merged-bangla', { total: sum, display: displayVal });
        }
        if (papers.english.length > 0) {
            const sum = papers.english.reduce((s, r) => s + ((parseFloat(r.written_marks)||0) + (parseFloat(r.mcq_marks)||0) + (parseFloat(r.practical_marks)||0)), 0);
            const compStr = papers.english.map(r => Math.round((parseFloat(r.written_marks)||0) + (parseFloat(r.mcq_marks)||0) + (parseFloat(r.practical_marks)||0))).join('+');
            const displayVal = sum > 0 ? `${Math.round(sum)}(${compStr})` : 'Absent';
            m.set('merged-english', { total: sum, display: displayVal });
        }
    }

    return m;
  }, [resultsByStudent, isClassNineOrTen]);

  useEffect(() => {
    if (!selectedClass) { setExaminations([]); setResultsByStudent(new Map()); return; }
    // Removed setLoading(true) for faster feel
    scopedGet('/api/results/examinations/', id, { classroom: selectedClass, page_size: 1000 }).then(async res => {
        let all = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        const filterType = selectedExamType || 'all';
        let exams = filterType === 'all' ? all : all.filter(e => normalizeExamType(e.exam_type, e.name) === filterType);
        if (selectedExamId) exams = exams.filter(e => String(e.id) === String(selectedExamId));
        setExaminations(exams);

        const byStudent = new Map();
        try {
            // Broad fetch: get results for this class
            const rRes = await scopedGet(`/api/results/results/`, id, {
                classroom: selectedClass,
                page_size: 5000
            });
            let arr = rRes.data.results || rRes.data || [];

            // Only keep results that belong to the class
            for (const r of arr) {
                const sid = String(typeof r.student === 'object' ? r.student?.id : r.student);
                if (!byStudent.has(sid)) byStudent.set(sid, []);
                byStudent.get(sid).push(r);
            }
        } catch (err) {
            console.error("Result fetch error:", err);
        }

        // Clean duplicates: Only keep the latest record for each (student, subject)
        const cleanedByStudent = new Map();
        for (const [sid, results] of byStudent.entries()) {
            const subjectMap = new Map();
            for (const r of results) {
                const subjName = String(r.subject?.name || r.subject_name || '').toLowerCase().trim();
                const recordDate = new Date(r.updated_at || r.created_at || 0).getTime();

                if (!subjectMap.has(subjName) || recordDate > subjectMap.get(subjName).date) {
                    subjectMap.set(subjName, { record: r, date: recordDate });
                }
            }
            cleanedByStudent.set(sid, Array.from(subjectMap.values()).map(v => v.record));
        }

        setResultsByStudent(cleanedByStudent);
        if (cleanedByStudent.size === 0) setNoYearMessage('কোনো তথ্য পাওয়া যায়নি');
        else setNoYearMessage('');

        const mt = new Map();
        for (const [sid, arr] of cleanedByStudent.entries()) {
            const tot = arr.reduce((s, r) => {
              const nm = String(r.subject?.name || r.subject_name || '').toLowerCase();
              const isCoCurricular = CO_CURRICULAR_SUBJECTS.some(sub => nm.includes(sub.toLowerCase()));
              if (isCoCurricular) return s;

              // Recalculate total from parts to reflect latest edits
              const w = parseFloat(r.written_marks) || 0;
              const mcq = parseFloat(r.mcq_marks) || 0;
              const pr = parseFloat(r.practical_marks) || 0;
              return s + (w + mcq + pr);
            }, 0);
            mt.set(sid, tot);
        }
        setOverallTotals(mt);
    }).finally(() => setLoading(false));
  }, [id, selectedClass, selectedExamType, selectedSection, selectedYear, selectedExamId]);

  const displaySubjects = useMemo(() => {
    const set = new Set();
    const currentStudentIds = new Set(students.map(s => String(s.id)));

    let hasBangla = false;
    let hasEnglish = false;

    // Get current classroom/section group
    const cls = classrooms.find(c => String(c.id) === String(selectedClass));
    const sec = sections.find(s => String(s.id) === String(selectedSection));
    const groupName = (String(cls?.name || '') + ' ' + String(sec?.name || '')).toLowerCase();
    const isScienceGroup = groupName.includes('science') || groupName.includes('বিজ্ঞান');
    const isCommerceGroup = groupName.includes('commerce') || groupName.includes('business') || groupName.includes('ব্যবসায়') || groupName.includes('business studies');
    const isHumanitiesGroup = groupName.includes('arts') || groupName.includes('humanities') || groupName.includes('মানবিক');

    for (const [sid, arr] of resultsByStudent.entries()) {
      if (!currentStudentIds.has(sid)) continue;

      for (const r of arr) {
        const nm = String(r.subject?.name || r.subject_name || '').trim();
        const lowerNm = nm.toLowerCase();

        // Filtering logic
        if (isClassNineOrTen) {
            if ((lowerNm.includes('বাংলা') || lowerNm.includes('bangla')) && !lowerNm.includes('বাংলাদেশ')) {
                hasBangla = true;
                continue;
            }
            if (lowerNm.includes('english') || lowerNm.includes('ইংরেজি') || lowerNm.includes('ইংরেজী')) {
                hasEnglish = true;
                continue;
            }

            // Science group shouldn't have general science
            if (isScienceGroup && (lowerNm === 'science' || lowerNm === 'বিজ্ঞান')) continue;

            // Filtering other group subjects
            const commerceSubjs = ['accounting', 'finance', 'business', 'হিসাব', 'ফিন্যান্স', 'ব্যবসায়'];
            const artsSubjs = ['history', 'geography', 'civics', 'economics', 'ইতিহাস', 'ভূগোল', 'পৌরনীতি', 'অর্থনীতি', 'পৌরনীতি ও নাগরিকতা', 'বাংলাদেশের ইতিহাস ও বিশ্ব সভ্যতা', 'ভূগোল ও পরিবেশ'];
            const scienceSubjs = ['physics', 'chemistry', 'biology', 'higher math', 'পদার্থ', 'রসায়ন', 'জীব', 'উচ্চতর'];

            if (isScienceGroup && (commerceSubjs.some(s => lowerNm.includes(s)) || artsSubjs.some(s => lowerNm.includes(s)))) continue;
            if (isCommerceGroup && (scienceSubjs.some(s => lowerNm.includes(s)) || artsSubjs.some(s => lowerNm.includes(s)))) continue;
            if (isHumanitiesGroup && (scienceSubjs.some(s => lowerNm.includes(s)) || commerceSubjs.some(s => lowerNm.includes(s)))) continue;
        }

        if (nm && !UNWANTED_SUBJECTS.includes(nm)) {
          set.add(nm);
        }
      }
    }

    const getWeight = (name) => {
        const clean = name.toLowerCase();

        // Priority: Check BGS first to avoid matching "Bangla"
        if (clean.includes('বাংলাদেশ') || clean.includes('bangladesh') || clean.includes('bgs')) {
            if (isScienceGroup) return 60;
            if (!isClassNineOrTen) return 60;
            return 75; // Humanities/Commerce history/science logic
        }

        if (clean === 'merged-bangla' || (clean.includes('বাংলা') && !clean.includes('বাংলাদেশ')) || (clean.includes('bangla') && !clean.includes('bangladesh'))) return 10;
        if (clean === 'merged-english' || clean.includes('english') || clean.includes('ইংরেজি')) return 20;
        if (clean.includes('গণিত') || clean.includes('math')) {
            if (clean.includes('উচ্চতর') || clean.includes('higher')) return 1000;
            return 30;
        }
        if (clean.includes('ইসলাম') || clean.includes('islam') || clean.includes('ধর্ম') || clean.includes('religion')) return 40;
        if (clean.includes('আইসিটি') || clean.includes('ict') || clean.includes('তথ্য')) return 50;

        if (isScienceGroup) {
            if (clean.includes('পদার্থ') || clean.includes('physics')) return 70;
            if (clean.includes('রসায়ন') || clean.includes('chemistry')) return 80;
            if (clean.includes('জীব') || clean.includes('biology')) return 90;
        } else {
            if (clean === 'science' || clean === 'বিজ্ঞান') return 60;
            if (isCommerceGroup) {
                if (clean.includes('হিসাব') || clean.includes('accounting')) return 70;
                if (clean.includes('ফিন্যান্স') || clean.includes('finance')) return 80;
                if (clean.includes('ব্যবসায়') || clean.includes('business')) return 90;
            } else if (isHumanitiesGroup) {
                if (clean.includes('ইতিহাস') || clean.includes('history')) return 70;
                if (clean.includes('পৌরনীতি') || clean.includes('civics')) return 80;
                if (clean.includes('ভূগোল') || clean.includes('geography')) return 90;
            }
        }

        if (clean.includes('কৃষি') || clean.includes('agriculture') || clean.includes('গার্হস্থ্য') || clean.includes('home science') || clean.includes('উচ্চতর') || clean.includes('higher')) return 1000;
        return 200;
    };

    const subjects = Array.from(set).map(s => ({
        label: s,
        key: s.toLowerCase(),
        isCoCurricular: CO_CURRICULAR_SUBJECTS.some(sub => s.toLowerCase().includes(sub.toLowerCase()))
    }));

    if (isClassNineOrTen) {
        if (hasEnglish) subjects.push({ label: 'ইংরেজি (১ম+২য়)', key: 'merged-english', isCoCurricular: false });
        if (hasBangla) subjects.push({ label: 'বাংলা (১ম+২য়)', key: 'merged-bangla', isCoCurricular: false });
    }

    subjects.sort((a, b) => {
        const ca = !!a.isCoCurricular;
        const cb = !!b.isCoCurricular;
        if (ca !== cb) return ca ? 1 : -1;
        const wa = getWeight(a.key);
        const wb = getWeight(b.key);
        if (wa !== wb) return wa - wb;
        return a.label.localeCompare(b.label, 'bn');
    });

    return subjects;
  }, [resultsByStudent, students, isClassNineOrTen, selectedClass, classrooms]);

  const meritRanks = useMemo(() => {
    const scores = Array.from(overallTotals.entries()).map(([sid, total]) => ({ sid, total }));
    scores.sort((a, b) => b.total - a.total);
    const ranks = new Map();
    let currentRank = 1;
    for (let i = 0; i < scores.length; i++) {
        if (i > 0 && scores[i].total < scores[i-1].total) {
            currentRank = i + 1;
        }
        ranks.set(scores[i].sid, currentRank);
    }
    return ranks;
  }, [overallTotals]);

  const sortedStudents = useMemo(() => {
    let list = students.filter(s => {
        const fn = (s.user?.first_name || '').trim().toUpperCase();
        const ln = (s.user?.last_name || '').trim().toUpperCase();
        const username = (s.user?.username || '').trim().toUpperCase();
        const fullName = `${fn} ${ln}`.trim();

        const isTC = fullName === 'TC' || fn === 'TC' || ln === 'TC' || username === 'TC';
        const hasNoName = !fn && !ln;

        return !isTC && !hasNoName;
    });
    list.sort((a, b) => {
        const ar = parseInt(String(a.roll_number || '').replace(/\D/g, ''), 10);
        const br = parseInt(String(b.roll_number || '').replace(/\D/g, ''), 10);
        if (!isNaN(ar) && !isNaN(br) && ar !== br) return ar - br;
        return String(a.roll_number || '').localeCompare(String(b.roll_number || ''), undefined, { numeric: true });
    });
    return list;
  }, [students]);

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

      {sortedStudents.length > 0 && (
          <Box sx={{ width: '100%', overflow: { xs: 'hidden', print: 'visible' }, display: { print: 'block' } }}>
            <TableContainer component={Paper} sx={{
              boxShadow: 'none',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              background: 'white',
              "@media print": { overflow: 'visible', display: 'block', position: 'static' }
            }}>
              <Table size="small" sx={{
                minWidth: { xs: 800, print: '100%' },
                tableLayout: 'fixed'
              }}>
                <colgroup><col style={{ width: '5%' }} /><col style={{ width: '13%' }} /><col style={{ width: '6%' }} /><col style={{ width: '6%' }} />{displaySubjects.map((_, i) => (<col key={i} style={{ width: `${70 / displaySubjects.length}%` }} />))}</colgroup>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main', backgroundImage: 'none' }}>
                    <TableCell sx={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem', boxShadow: 'none' }}>রোল</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.85rem', boxShadow: 'none' }}>নাম</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.85rem', boxShadow: 'none' }} align="center">মোট</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.85rem', boxShadow: 'none' }} align="center">মেধাস্থান</TableCell>
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
                        <TableCell align="center">{meritRanks.get(String(stu.id)) || '--'}</TableCell>
                        {displaySubjects.map(sub => {
                          const r = resMap.get(sub.key);
                          if (!r) return <TableCell key={sub.key} align="center">Absent</TableCell>;
                          return (
                            <TableCell key={sub.key} align="center">
                              {r.display || r.total || 'Absent'}
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
        )}

      {!sortedStudents.length && (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="textSecondary">{noYearMessage || 'কোনো তথ্য পাওয়া যায়নি'}</Typography>
          </Paper>
      )}

      <style>
        {`
          @media print {
            .no-print, header, footer, nav, aside, .MuiAppBar-root, .MuiDrawer-root, .MuiToolbar-root, .MuiSnackbar-root, .MuiAlert-root {
                display: none !important;
            }
            @page {
              size: landscape !important;
              margin: 5mm !important;
            }

            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              width: 100% !important;
              height: auto !important;
              min-height: auto !important;
              overflow: visible !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              forced-color-adjust: none !important;
              color-scheme: light !important;
            }

            #root, main, .cr-print-container {
              display: block !important;
              height: auto !important;
              min-height: auto !important;
              overflow: visible !important;
              position: static !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            .cr-print-container {
              background: white !important;
              padding: 5mm !important;
              width: 100% !important;
              box-sizing: border-box !important;
            }

            .cr-print-only {
              display: flex !important;
              margin-top: 0 !important;
              margin-bottom: 10px !important;
              width: 100% !important;
              page-break-after: avoid !important;
            }

            .cr-print-container table {
              width: 100% !important;
              border-collapse: collapse !important;
              table-layout: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              border: 0.5pt solid #000 !important;
              page-break-inside: auto !important;
              page-break-before: avoid !important;
              break-before: avoid !important;
            }

            .cr-print-container thead,
            .cr-print-container tbody,
            .cr-print-container tfoot {
              display: table-header-group !important;
              page-break-inside: auto !important;
              break-inside: auto !important;
            }

            .cr-print-container tr {
              page-break-inside: avoid !important;
              page-break-after: auto !important;
              break-inside: avoid !important;
            }

            .cr-print-container th,
            .cr-print-container td {
              border: 0.5pt solid #000 !important;
              color: black !important;
              padding: 4px 2px !important;
              font-size: 8pt !important;
              overflow: visible !important;
              white-space: normal !important;
              word-break: break-word !important;
              text-align: center !important;
              line-height: 1.1 !important;
              page-break-inside: auto !important;
              break-inside: auto !important;
            }

            /* Name Column Specific */
            .cr-print-container th:nth-of-type(2),
            .cr-print-container td:nth-of-type(2) {
              text-align: left !important;
              padding-left: 5px !important;
              width: 180px !important;
              min-width: 180px !important;
            }
            /* Roll Column */
            .cr-print-container th:nth-of-type(1),
            .cr-print-container td:nth-of-type(1) {
              width: 40px !important;
            }

            .cr-print-container th {
              background-color: #f0f0f0 !important;
              font-weight: bold !important;
            }

            .MuiTableContainer-root {
              box-shadow: none !important;
              overflow: visible !important;
              width: 100% !important;
              display: block !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            * {
              box-shadow: none !important;
              text-shadow: none !important;
            }
          }
        `}
      </style>
    </Box>
  );
}
