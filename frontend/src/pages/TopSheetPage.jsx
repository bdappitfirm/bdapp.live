import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Typography, Paper, Stack, Button, TextField, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Grid, FormControl, InputLabel, Select, Alert
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DescriptionIcon from '@mui/icons-material/Description';
import RefreshIcon from '@mui/icons-material/Refresh';
import { scopedGet } from '../utils/schoolApi';
import { useSchool } from '../context/SchoolContext';
import { getMediaUrl } from '../utils/media';
import dayjs from 'dayjs';

// Helper function to calculate subject marks structure (CQ, MCQ, Practical)
const getSubjectMaxima = (name, isNT, group = '') => {
  let lower = String(name || '').toLowerCase();
  const g = String(group || '').toLowerCase();

  // Handle combined subjects (e.g. Physics/Geography/Accounting)
  if (lower.includes('/') && g) {
    const parts = lower.split('/');
    const sciPool = ['physics', 'chemistry', 'biology', 'higher', 'পদার্থ', 'রসায়ন', 'রসায়ন', 'জীব', 'উচ্চতর'];
    const comPool = ['accounting', 'finance', 'business', 'হিসাব', 'ফিন্যান্স', 'ব্যবসায়', 'ব্যবসায়', 'entrepreneurship', 'উদ্যোগ'];
    const humPool = ['history', 'geography', 'civics', 'economics', 'ইতিহাস', 'ভূগোল', 'পৌরনীতি', 'পৌরণীতি', 'অর্থনীতি'];

    let found = '';
    if (g.includes('science')) found = parts.find(p => sciPool.some(kw => p.includes(kw)));
    else if (g.includes('commerce') || g.includes('business')) found = parts.find(p => comPool.some(kw => p.includes(kw)));
    else if (g.includes('arts') || g.includes('humanities') || g.includes('manobik') || g.includes('মানবিক')) found = parts.find(p => humPool.some(kw => p.includes(kw)));

    if (found) lower = found.trim();
  }

  if (lower.includes('বাংলা') || lower.includes('bangla')) {
    if (isNT && (lower.includes('১ম+২য়') || lower.includes('1st+2nd'))) return { cq: 140, mcq: 60, pr: 0 };
    if (!isNT && (lower.includes('২য়') || lower.includes('২য়') || lower.includes('2nd') || lower.includes('second') || lower.includes('ii'))) return { cq: 50, mcq: 0, pr: 0 };
    if (!isNT) return { cq: 100, mcq: 30, pr: 0 };
    return { cq: 70, mcq: 30, pr: 0 };
  }

  if (lower.includes('english') || lower.includes('ইংরেজি') || lower.includes('ইংরেজী') || lower.includes('eng')) {
    if (isNT && (lower.includes('১ম+২য়') || lower.includes('1st+2nd'))) return { cq: 200, mcq: 0, pr: 0 };
    if (isNT) return { cq: 100, mcq: 0, pr: 0 };
    if (!isNT && (lower.includes('২য়') || lower.includes('২য়') || lower.includes('2nd') || lower.includes('second') || lower.includes('ii'))) return { cq: 50, mcq: 0, pr: 0 };
    return { cq: 100, mcq: 0, pr: 0 };
  }

  if (lower.includes('ict') || lower.includes('তথ্য') || lower.includes('information') || lower.includes('যোগাযোগ')) {
    return isNT ? { cq: 0, mcq: 25, pr: 25 } : { cq: 10, mcq: 15, pr: 25 };
  }

  const isPracticalScience = lower.includes('পদার্থ') || lower.includes('physics') || lower.includes('রসায়ন') || lower.includes('রসায়ন') || lower.includes('chemistry') || lower.includes('জীব') || lower.includes('biology') || lower.includes('উচ্চতর') || lower.includes('higher');
  const isAgriHome = lower.includes('কৃষি') || lower.includes('agriculture') || lower.includes('গার্হস্থ্য') || lower.includes('home science') || lower.includes('home economics');
  const isCA = lower.includes('শারীরিক') || lower.includes('physical') || lower.includes('career') || lower.includes('ক্যারিয়ার') || lower.includes('ক্যারিয়ার') || lower.includes('word') || lower.includes('book') || lower.includes('পড়া') || lower.includes('পড়া') || lower.includes('achievement');

  if (isNT) {
    if (isPracticalScience || isAgriHome) return { cq: 50, mcq: 25, pr: 25 };
    if (isCA) return { cq: 0, mcq: 0, pr: 100 };
  } else {
    if (isPracticalScience) return { cq: 50, mcq: 25, pr: 25 };
    if (isAgriHome) return { cq: 35, mcq: 15, pr: 0 };
    if (isCA) return { cq: 0, mcq: 0, pr: 50 };
    if (lower.includes('ধর্ম') || lower.includes('religion') || lower.includes('islam') || lower.includes('hindu') || lower.includes('ইসলাম') || lower.includes('হিন্দ')) return { cq: 100, mcq: 30, pr: 0 };
    return { cq: 100, mcq: 30, pr: 0 };
  }

  return isNT ? { cq: 70, mcq: 30, pr: 0 } : { cq: 100, mcq: 30, pr: 0 };
};

export default function TopSheetPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { school: schoolInfo } = useSchool();

  // State
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassroom, setSelectedClassroom] = useState('');
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [allSubjects, setAllSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [students, setStudents] = useState([]);

  const [selectedExam, setSelectedExam] = useState('half_yearly');
  const [customExamName, setCustomExamName] = useState('');
  const [selectedYear, setSelectedYear] = useState(dayjs().year().toString());
  const [fullMarks, setFullMarks] = useState('100');
  const [examDate, setExamDate] = useState(dayjs().format('DD/MM/YYYY'));
  const [columnMode, setColumnMode] = useState('auto'); // 'auto', 'single', 'cq_mcq', 'full_split'

  const [loading, setLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Read URL params if available
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const clsParam = params.get('classroom') || '';
    const secParam = params.get('section') || '';
    const subParam = params.get('subject') || '';
    const examParam = params.get('exam') || 'half_yearly';
    const yearParam = params.get('year') || dayjs().year().toString();

    if (clsParam) setSelectedClassroom(clsParam);
    if (secParam) setSelectedSection(secParam);
    if (subParam) setSelectedSubject(subParam);
    if (examParam) setSelectedExam(examParam);
    if (yearParam) setSelectedYear(yearParam);
  }, [location.search]);

  // Sync state changes with URL query string
  const updateUrl = useCallback((newParams) => {
    const params = new URLSearchParams(location.search);
    Object.keys(newParams).forEach(key => {
      if (newParams[key] !== undefined && newParams[key] !== null) {
        if (newParams[key] === '') {
          params.delete(key);
        } else {
          params.set(key, newParams[key]);
        }
      }
    });
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  }, [location.pathname, location.search, navigate]);

  // Load Classrooms and Subjects on initial render
  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [clsRes, subRes] = await Promise.all([
          scopedGet('/api/academics/classrooms/', id),
          scopedGet('/api/academics/subjects/', id)
        ]);

        if (!isMounted) return;

        const clsData = Array.isArray(clsRes.data) ? clsRes.data : (clsRes.data?.results || []);
        const subData = Array.isArray(subRes.data) ? subRes.data : (subRes.data?.results || []);

        setClassrooms(clsData);
        setAllSubjects(subData);

        // Auto-select first classroom if none selected
        if (clsData.length > 0) {
          setSelectedClassroom(prev => prev || String(clsData[0].id));
        }
      } catch (err) {
        console.error('Failed to load initial academics data for Top Sheet:', err);
        if (isMounted) setError('শ্রেণি ও বিষয় তথ্য লোড করতে সমস্যা হয়েছে।');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (id) fetchInitialData();
    return () => { isMounted = false; };
  }, [id]);

  // Load Sections whenever selectedClassroom changes
  useEffect(() => {
    let isMounted = true;
    const fetchSections = async () => {
      if (!selectedClassroom) {
        setSections([]);
        setSelectedSection('');
        return;
      }

      try {
        const secRes = await scopedGet('/api/academics/sections/', id, { classroom: selectedClassroom });
        if (!isMounted) return;
        const secData = Array.isArray(secRes.data) ? secRes.data : (secRes.data?.results || []);
        setSections(secData);

        // If previously selected section is not in new section list, reset section
        setSelectedSection(prev => {
          if (prev && !secData.some(s => String(s.id) === String(prev))) {
            return '';
          }
          return prev;
        });
      } catch (err) {
        console.error('Failed to load sections:', err);
      }
    };

    fetchSections();
    return () => { isMounted = false; };
  }, [id, selectedClassroom]);

  // Filter subjects for the selected classroom
  const filteredSubjects = useMemo(() => {
    if (!selectedClassroom || !allSubjects.length) return allSubjects;
    return allSubjects.filter(sub => {
      const linkedClasses = Array.isArray(sub.classrooms) ? sub.classrooms : [];
      if (linkedClasses.length === 0) return true;
      return linkedClasses.some(c => String(c.id || c) === String(selectedClassroom));
    });
  }, [allSubjects, selectedClassroom]);

  // Load Students whenever selectedClassroom or selectedSection changes
  const fetchStudents = useCallback(async () => {
    if (!selectedClassroom || !id) {
      setStudents([]);
      return;
    }

    setStudentsLoading(true);
    try {
      const params = {
        classroom: selectedClassroom,
        page_size: 1000
      };
      if (selectedSection) {
        params.section = selectedSection;
      }

      const res = await scopedGet('/api/academics/students/', id, params);
      const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setStudents(data);
    } catch (err) {
      console.error('Failed to load students for Top Sheet:', err);
      setError('শিক্ষার্থীদের তালিকা লোড করা যায়নি।');
    } finally {
      setStudentsLoading(false);
    }
  }, [id, selectedClassroom, selectedSection]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Sorted student list (numerically by Roll Number)
  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const rollA = parseInt(a.roll_number ?? a.roll ?? 0, 10);
      const rollB = parseInt(b.roll_number ?? b.roll ?? 0, 10);

      if (!isNaN(rollA) && !isNaN(rollB) && rollA !== rollB) {
        return rollA - rollB;
      }
      return String(a.roll_number || '').localeCompare(String(b.roll_number || ''), undefined, { numeric: true });
    });
  }, [students]);

  // Calculate dynamic columns based on selected Class, Subject & ColumnMode
  const computedColumns = useMemo(() => {
    if (columnMode === 'single') {
      return [
        { key: 'single', label: 'প্রাপ্ত নম্বর (Marks Obtained)', width: '220px' }
      ];
    }
    if (columnMode === 'cq_mcq') {
      return [
        { key: 'cq', label: 'CQ / সৃজনশীল', width: '90px' },
        { key: 'mcq', label: 'MCQ / নৈর্ব্যক্তিক', width: '90px' },
        { key: 'total', label: 'মোট নম্বর', width: '100px' }
      ];
    }
    if (columnMode === 'full_split') {
      return [
        { key: 'cq', label: 'CQ / সৃজনশীল', width: '80px' },
        { key: 'mcq', label: 'MCQ / নৈর্ব্যক্তিক', width: '80px' },
        { key: 'pr', label: 'ব্যবহারিক', width: '80px' },
        { key: 'total', label: 'মোট নম্বর', width: '90px' }
      ];
    }

    // AUTO Mode ('auto'):
    if (!selectedSubject) {
      return [
        { key: 'cq', label: 'CQ / সৃজনশীল', width: '90px' },
        { key: 'mcq', label: 'MCQ / নৈর্ব্যক্তিক', width: '90px' },
        { key: 'total', label: 'মোট নম্বর', width: '100px' }
      ];
    }

    const subjObj = allSubjects.find(s => String(s.id) === String(selectedSubject));
    const subjName = subjObj?.name || '';
    const clsObj = classrooms.find(c => String(c.id) === String(selectedClassroom));
    const clsName = clsObj?.name || '';

    const isNT = /নবম|দশম|ssc|\b9\b|\b10\b|\bnine\b|\bten\b|\bix\b|\bx\b|class\s*9|class\s*10|৯ম|১০ম/i.test(clsName.toLowerCase());
    const isPrimary = !/ষষ্ঠ|six|\b6\b|সপ্তম|seven|\b7\b|অষ্টম|eight|\b8\b|নবম|nine|\b9\b|দশম|ten|\b10\b|ssc|ix|x/i.test(clsName.toLowerCase());

    if (isPrimary) {
      return [
        { key: 'single', label: 'প্রাপ্ত নম্বর (Marks Obtained)', width: '220px' }
      ];
    }

    const spec = getSubjectMaxima(subjName, isNT);
    const cols = [];

    if (spec.cq > 0) {
      cols.push({ key: 'cq', label: `CQ / সৃজনশীল (${spec.cq})`, width: '100px' });
    }
    if (spec.mcq > 0) {
      cols.push({ key: 'mcq', label: `MCQ / নৈর্ব্যক্তিক (${spec.mcq})`, width: '100px' });
    }
    if (spec.pr > 0) {
      cols.push({ key: 'pr', label: `ব্যবহারিক (${spec.pr})`, width: '100px' });
    }

    if (cols.length === 0) {
      return [
        { key: 'single', label: 'প্রাপ্ত নম্বর (Marks Obtained)', width: '220px' }
      ];
    }

    if (cols.length === 1) {
      return [
        { key: cols[0].key, label: 'প্রাপ্ত নম্বর (Marks Obtained)', width: '220px' }
      ];
    }

    const totalMax = (spec.cq || 0) + (spec.mcq || 0) + (spec.pr || 0);
    cols.push({ key: 'total', label: `মোট নম্বর (${totalMax || 100})`, width: '100px' });

    return cols;
  }, [columnMode, selectedSubject, selectedClassroom, allSubjects, classrooms]);

  // Update default fullMarks display when computedColumns update
  useEffect(() => {
    if (!selectedSubject) return;
    const subjObj = allSubjects.find(s => String(s.id) === String(selectedSubject));
    const subjName = subjObj?.name || '';
    const clsObj = classrooms.find(c => String(c.id) === String(selectedClassroom));
    const clsName = clsObj?.name || '';
    const isNT = /নবম|দশম|ssc|\b9\b|\b10\b|\bnine\b|\bten\b|\bix\b|\bx\b|class\s*9|class\s*10|৯ম|১০ম/i.test(clsName.toLowerCase());
    const spec = getSubjectMaxima(subjName, isNT);
    const total = (spec.cq || 0) + (spec.mcq || 0) + (spec.pr || 0);
    if (total > 0) {
      setFullMarks(String(total));
    }
  }, [selectedSubject, selectedClassroom, allSubjects, classrooms]);

  // Get labels
  const currentClassObj = classrooms.find(c => String(c.id) === String(selectedClassroom));
  const currentClassLabel = currentClassObj?.name || '—';

  const currentSectionObj = sections.find(s => String(s.id) === String(selectedSection));
  const currentSectionLabel = selectedSection ? (currentSectionObj?.name || '—') : 'সকল শাখা';

  const currentSubjectObj = allSubjects.find(s => String(s.id) === String(selectedSubject));
  const currentSubjectLabel = currentSubjectObj ? `${currentSubjectObj.name}${currentSubjectObj.code ? ` (${currentSubjectObj.code})` : ''}` : (selectedSubject || '—');

  const getExamTitle = () => {
    if (selectedExam === 'custom') return customExamName || 'পরীক্ষা';
    if (selectedExam === 'half_yearly') return 'অর্ধ-বার্ষিক পরীক্ষা';
    if (selectedExam === 'annual') return 'বার্ষিক পরীক্ষা';
    if (selectedExam === 'first_term') return 'প্রথম সাময়িক পরীক্ষা';
    if (selectedExam === 'second_term') return 'দ্বিতীয় সাময়িক পরীক্ষা';
    if (selectedExam === 'pre_test') return 'প্রাক-নির্বাচনী পরীক্ষা';
    if (selectedExam === 'test') return 'নির্বাচনী (টেস্ট) পরীক্ষা';
    if (selectedExam === 'model') return 'মডেল টেস্ট';
    if (selectedExam === 'class_test') return 'ক্লাস টেস্ট / টিউটোরিয়াল';
    return selectedExam;
  };

  const getStudentName = (stu) => {
    if (!stu) return '';
    const fName = stu.user?.first_name || stu.first_name || '';
    const lName = stu.user?.last_name || stu.last_name || '';
    const full = `${fName} ${lName}`.trim();
    if (full) return full;
    if (stu.father_name) return `(অভিঃ ${stu.father_name})`;
    return stu.user?.username || '—';
  };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 }, bgcolor: '#f4f6f8', minHeight: '100vh' }}>
      {/* Top Header Controls (Hidden during print) */}
      <Stack
        className="no-print"
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <DescriptionIcon color="primary" sx={{ fontSize: 36 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#1a237e' }}>
              নম্বর প্রদান টপ শিট (Top Sheet)
            </Typography>
            <Typography variant="body2" color="textSecondary">
              শিক্ষকদের নম্বর তোলার জন্য প্রিন্টযোগ্য খালি মার্কস শিট জেনারেটর
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
          >
            পিছনে
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<RefreshIcon />}
            onClick={fetchStudents}
          >
            রিফ্রেশ
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<PrintIcon />}
            onClick={() => window.print()}
            disabled={sortedStudents.length === 0}
            sx={{ fontWeight: 'bold', px: 3 }}
          >
            প্রিন্ট করুন
          </Button>
        </Stack>
      </Stack>

      {/* Filter Options Panel (Hidden during print) */}
      <Paper className="no-print" elevation={2} sx={{ p: 2.5, mb: 3, borderRadius: 2, borderTop: '4px solid #1a237e' }}>
        <Grid container spacing={2} alignItems="center">
          {/* Class Select */}
          <Grid item xs={12} sm={6} md={2.5}>
            <FormControl fullWidth size="small">
              <InputLabel id="class-select-label">শ্রেণি (Class) *</InputLabel>
              <Select
                labelId="class-select-label"
                value={selectedClassroom}
                label="শ্রেণি (Class) *"
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedClassroom(val);
                  setSelectedSection('');
                  updateUrl({ classroom: val, section: '' });
                }}
              >
                {classrooms.map(c => (
                  <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Section Select */}
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small" disabled={!selectedClassroom}>
              <InputLabel id="section-select-label">শাখা (Section)</InputLabel>
              <Select
                labelId="section-select-label"
                value={selectedSection}
                label="শাখা (Section)"
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedSection(val);
                  updateUrl({ section: val });
                }}
              >
                <MenuItem value="">সকল শাখা (All)</MenuItem>
                {sections.map(s => (
                  <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Subject Select */}
          <Grid item xs={12} sm={6} md={2.5}>
            <FormControl fullWidth size="small">
              <InputLabel id="subject-select-label">বিষয় (Subject)</InputLabel>
              <Select
                labelId="subject-select-label"
                value={selectedSubject}
                label="বিষয় (Subject)"
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedSubject(val);
                  updateUrl({ subject: val });
                }}
              >
                <MenuItem value="">-- বিষয় সিলেক্ট করুন --</MenuItem>
                {filteredSubjects.map(sub => (
                  <MenuItem key={sub.id} value={String(sub.id)}>
                    {sub.name} {sub.code ? `(${sub.code})` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Exam Select */}
          <Grid item xs={12} sm={6} md={2.5}>
            <FormControl fullWidth size="small">
              <InputLabel id="exam-select-label">পরীক্ষার নাম</InputLabel>
              <Select
                labelId="exam-select-label"
                value={selectedExam}
                label="পরীক্ষার নাম"
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedExam(val);
                  updateUrl({ exam: val });
                }}
              >
                <MenuItem value="half_yearly">অর্ধ-বার্ষিক পরীক্ষা</MenuItem>
                <MenuItem value="annual">বার্ষিক পরীক্ষা</MenuItem>
                <MenuItem value="first_term">প্রথম সাময়িক পরীক্ষা</MenuItem>
                <MenuItem value="second_term">দ্বিতীয় সাময়িক পরীক্ষা</MenuItem>
                <MenuItem value="pre_test">প্রাক-নির্বাচনী পরীক্ষা</MenuItem>
                <MenuItem value="test">নির্বাচনী (টেস্ট) পরীক্ষা</MenuItem>
                <MenuItem value="model">মডেল টেস্ট</MenuItem>
                <MenuItem value="class_test">ক্লাস টেস্ট / টিউটোরিয়াল</MenuItem>
                <MenuItem value="custom">অন্যান্য (নিজের মত লিখুন)</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Custom Exam Input */}
          {selectedExam === 'custom' && (
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField
                fullWidth
                size="small"
                label="পরীক্ষার নাম লিখুন"
                value={customExamName}
                onChange={(e) => setCustomExamName(e.target.value)}
              />
            </Grid>
          )}

          {/* Full Marks */}
          <Grid item xs={6} sm={3} md={1.2}>
            <TextField
              fullWidth
              size="small"
              label="পূর্ণমান"
              type="text"
              value={fullMarks}
              onChange={(e) => setFullMarks(e.target.value)}
            />
          </Grid>

          {/* Year */}
          <Grid item xs={6} sm={3} md={1.3}>
            <FormControl fullWidth size="small">
              <InputLabel>শিক্ষাবর্ষ</InputLabel>
              <Select
                value={selectedYear}
                label="শিক্ষাবর্ষ"
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedYear(val);
                  updateUrl({ year: val });
                }}
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <MenuItem key={y} value={String(y)}>{y}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Column Mode */}
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>কলামের ধরন</InputLabel>
              <Select
                value={columnMode}
                label="কলামের ধরন"
                onChange={(e) => setColumnMode(e.target.value)}
              >
                <MenuItem value="auto">অটোমেটিক (বিষয় অনুযায়ী)</MenuItem>
                <MenuItem value="single">একক নম্বর ঘর (Single Box)</MenuItem>
                <MenuItem value="cq_mcq">CQ + MCQ + মোট</MenuItem>
                <MenuItem value="full_split">CQ + MCQ + ব্যবহারিক + মোট</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Exam Date */}
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              size="small"
              label="তারিখ"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Main Top Sheet Printable Canvas */}
      {loading || studentsLoading ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress size={48} />
          <Typography variant="body1" sx={{ mt: 2, fontWeight: 500 }}>
            শিক্ষার্থীদের তথ্য সংগ্রহ করা হচ্ছে...
          </Typography>
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      ) : sortedStudents.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 2 }}>
          <Typography variant="h6" color="textSecondary">
            বাছাইকৃত শ্রেণি ও সেকশনে কোন শিক্ষার্থী পাওয়া যায়নি।
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            অনুগ্রহ করে অন্য শ্রেণি বা শাখা পরিবর্তন করে চেষ্টা করুন।
          </Typography>
        </Paper>
      ) : (
        <Paper
          className="print-sheet"
          elevation={3}
          sx={{
            p: { xs: 2, sm: 4 },
            bgcolor: 'white',
            borderRadius: 2,
            maxWidth: '1000px',
            mx: 'auto'
          }}
        >
          {/* Header Section */}
          <Box
            sx={{
              textAlign: 'center',
              mb: 2.5,
              borderBottom: '2px dashed #000',
              pb: 2
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                mb: 1
              }}
            >
              {schoolInfo?.logo && (
                <img
                  src={getMediaUrl(schoolInfo.logo)}
                  alt="School Logo"
                  style={{ height: '70px', width: 'auto', objectFit: 'contain' }}
                />
              )}
              <Box>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 800,
                    fontSize: { xs: '1.4rem', sm: '1.8rem' },
                    color: '#000',
                    lineHeight: 1.2
                  }}
                >
                  {schoolInfo?.name || 'প্রতিষ্ঠানের নাম'}
                </Typography>
                {schoolInfo?.address && (
                  <Typography variant="body2" sx={{ fontSize: '0.95rem', color: '#333', mt: 0.5 }}>
                    {schoolInfo.address}
                  </Typography>
                )}
              </Box>
            </Box>

            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                fontSize: '1.3rem',
                textDecoration: 'underline',
                mt: 1,
                color: '#000',
                letterSpacing: '0.5px'
              }}
            >
              পরীক্ষার নম্বর প্রদান টপ শিট (Top Sheet)
            </Typography>
          </Box>

          {/* Meta Info Grid / Summary Box */}
          <Box
            sx={{
              border: '1px solid #000',
              borderRadius: '4px',
              p: 1.5,
              mb: 2.5,
              bgcolor: '#fafafa',
              '@media print': {
                bgcolor: '#fff !important'
              }
            }}
          >
            <Grid container spacing={1.5} sx={{ fontSize: '0.95rem' }}>
              <Grid item xs={6} sm={3}>
                <strong>শ্রেণি:</strong> {currentClassLabel}
              </Grid>
              <Grid item xs={6} sm={3}>
                <strong>শাখা:</strong> {currentSectionLabel}
              </Grid>
              <Grid item xs={6} sm={3}>
                <strong>বিষয়:</strong> {currentSubjectLabel}
              </Grid>
              <Grid item xs={6} sm={3}>
                <strong>পরীক্ষা:</strong> {getExamTitle()}
              </Grid>
              <Grid item xs={6} sm={3}>
                <strong>পূর্ণমান:</strong> {fullMarks || '১০০'}
              </Grid>
              <Grid item xs={6} sm={3}>
                <strong>শিক্ষাবর্ষ:</strong> {selectedYear}
              </Grid>
              <Grid item xs={6} sm={3}>
                <strong>মোট শিক্ষার্থী:</strong> {sortedStudents.length} জন
              </Grid>
              <Grid item xs={6} sm={3}>
                <strong>তারিখ:</strong> {examDate}
              </Grid>
            </Grid>
          </Box>

          {/* Student List Table */}
          <TableContainer>
            <Table
              size="small"
              sx={{
                width: '100%',
                borderCollapse: 'collapse',
                '& th, & td': {
                  border: '1px solid #000 !important',
                  px: 1,
                  py: 1,
                  color: '#000 !important'
                }
              }}
            >
              <TableHead>
                <TableRow
                  sx={{
                    bgcolor: '#f0f0f0 !important',
                    WebkitPrintColorAdjust: 'exact',
                    '& th': {
                      fontWeight: 'bold',
                      fontSize: '0.95rem'
                    }
                  }}
                >
                  <TableCell align="center" style={{ width: '60px' }}>ক্রঃ নং</TableCell>
                  <TableCell align="center" style={{ width: '80px' }}>রোল নং</TableCell>
                  <TableCell align="left">শিক্ষার্থীর নাম</TableCell>

                  {computedColumns.map((col) => (
                    <TableCell key={col.key} align="center" style={{ width: col.width }}>
                      {col.label}
                    </TableCell>
                  ))}

                  <TableCell align="center" style={{ width: '130px' }}>মন্তব্য</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {sortedStudents.map((stu, index) => {
                  const rollStr = stu.roll_number ?? stu.roll ?? '—';
                  const nameStr = getStudentName(stu);

                  return (
                    <TableRow key={stu.id || index} sx={{ height: '42px', pageBreakInside: 'avoid' }}>
                      {/* SL */}
                      <TableCell align="center" sx={{ fontWeight: 500 }}>
                        {index + 1}
                      </TableCell>

                      {/* Roll */}
                      <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '1rem' }}>
                        {rollStr}
                      </TableCell>

                      {/* Name */}
                      <TableCell align="left" sx={{ fontWeight: 600 }}>
                        {nameStr}
                      </TableCell>

                      {/* Dynamic Marks Blank Cells */}
                      {computedColumns.map((col) => (
                        <TableCell key={col.key} align="center" sx={{ bgcolor: '#fff' }}>
                          {/* Empty spacious cell for teacher handwriting */}
                        </TableCell>
                      ))}

                      {/* Remarks Blank Cell */}
                      <TableCell align="center" sx={{ bgcolor: '#fff' }} />
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Bottom Signatures Block */}
          <Box
            sx={{
              mt: 6,
              pt: 2,
              pageBreakInside: 'avoid',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              px: 2
            }}
          >
            <Box sx={{ textAlign: 'center', width: '220px' }}>
              <Box sx={{ borderTop: '1px solid #000', pt: 0.8, fontWeight: 'bold', fontSize: '0.95rem' }}>
                বিষয় শিক্ষকের স্বাক্ষর ও তারিখ
              </Box>
            </Box>

            <Box sx={{ textAlign: 'center', width: '220px' }}>
              <Box sx={{ borderTop: '1px solid #000', pt: 0.8, fontWeight: 'bold', fontSize: '0.95rem' }}>
                পরীক্ষা নিয়ন্ত্রক / প্রধান শিক্ষক
              </Box>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Print CSS Styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            font-family: 'SolaimanLipi', 'Kalpurush', 'Siyam Rupali', Roboto, sans-serif !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm 10mm 10mm 10mm;
          }
          .print-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          table {
            width: 100% !important;
            table-layout: auto !important;
            border-collapse: collapse !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </Box>
  );
}
