import React, { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAcademics } from '../context/AcademicsContext';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  MenuItem,
  Paper,
  IconButton,
  Tooltip,
  Alert
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import ResultCard from '../components/ResultCard';
import SSCMarksheet from '../components/SSCMarksheet';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { scopedGet } from '../utils/schoolApi';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

// SAFE GPA grouping helper. Only groups Bangla/English when BOTH 1st and 2nd paper patterns exist.
// Default: every unique subject ID is its OWN group (handles duplicate names safely).
const SAFE_PAPER_1 = /(১ম|1st|first|১ম\s*পত্র|1st\s*paper)/i;
const SAFE_PAPER_2 = /(২য়|২য়|2nd|second|২য়\s*পত্র|২য়\s*পত্র|2nd\s*paper)/i;
const SAFE_BANGLA  = /(bangla|বাংলা)/i;
const SAFE_ENGLISH = /(english|ইংরেজি|ইংরেজী)/i;

function safeGroupSubjects(results, unwantedCheck) {
  const paperDetector = {};
  results.forEach(r => {
    const name = (r.subject?.name || r.subject_name || '');
    if (unwantedCheck && unwantedCheck(name)) return;
    let grp = null;
    if (SAFE_BANGLA.test(name)) grp = 'bangla';
    else if (SAFE_ENGLISH.test(name)) grp = 'english';
    if (!grp) return;
    if (!paperDetector[grp]) paperDetector[grp] = {1: false, 2: false};
    if (SAFE_PAPER_1.test(name)) paperDetector[grp][1] = true;
    if (SAFE_PAPER_2.test(name)) paperDetector[grp][2] = true;
  });

  const grouped = {};
  results.forEach(r => {
    const name = (r.subject?.name || r.subject_name || '');
    if (unwantedCheck && unwantedCheck(name)) return;
    const sid = r.subject?.id ?? r.subject_id;
    let groupKey = `__id_${sid ?? Math.random().toString(36).slice(2,10)}`;
    if (SAFE_BANGLA.test(name)) {
      const grp = 'bangla';
      if (paperDetector[grp]?.[1] && paperDetector[grp]?.[2] && (SAFE_PAPER_1.test(name) || SAFE_PAPER_2.test(name))) {
        groupKey = grp;
      }
    } else if (SAFE_ENGLISH.test(name)) {
      const grp = 'english';
      if (paperDetector[grp]?.[1] && paperDetector[grp]?.[2] && (SAFE_PAPER_1.test(name) || SAFE_PAPER_2.test(name))) {
        groupKey = grp;
      }
    }
    if (!grouped[groupKey]) grouped[groupKey] = [];
    grouped[groupKey].push(parseFloat(r.gpa) || 0);
  });
  return grouped;
}

const UNWANTED_SUBJECTS = [
  'ভৌৌতবিজ্ঞান', 'সামাজিক বিজ্ঞান'
];

const UNWANTED_KEYWORDS = [
  'অর্ধ-বার্ষিক', 'বার্ষিক', 'অর্ধবার্ষিক', 'test', 'model test'
];

const CO_CURRICULAR_SUBJECTS = [
  'শারীরিক শিক্ষা ও স্বাস্থ্য', 'শারীরিক শিক্ষা', 'Physical Education', 'Physical Education and Health',
  'ক্যারিয়ার শিক্ষা', 'ক্যারিয়ার শিক্ষা', 'Career Education', 'ক্যারিয়ার', 'ক্যারিয়ার',
  'Word Collection Achievement Test', 'WCAT',
  'বই পড়া', 'বই পড়া', 'চারু ও কারুকলা', 'Arts and Crafts',
  'কর্ম ও জীবনমুখী', 'Life and Work', 'Continuous Assessment', 'ধারাবাহিক মূল্যায়ন'
];

export default function ResultCardGenerator() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { classrooms, refreshClassrooms } = useAcademics();
  
  const [examTypes, setExamTypes] = useState([
    { value: 'test', label: 'বিশেষ মূল্যায়ন' },
    { value: 'half_yearly', label: 'অর্ধবার্ষিক' },
    { value: 'annual', label: 'বার্ষিক' },
    { value: 'terminal', label: 'টার্মিনাল' },
    { value: 'model', label: 'মডেল টেস্ট' },
    { value: 'first_term', label: 'প্রথম টার্ম' },
    { value: 'final', label: 'ফাইনাল' }
  ]);
  const [selectedExamType, setSelectedExamType] = useState('');
  const [examinations, setExaminations] = useState([]);
  // classrooms state removed, using context
  const [selectedClass, setSelectedClass] = useState('');
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkCards, setBulkCards] = useState([]);
  
  // Result data
  const [studentData, setStudentData] = useState(null);
  const [results, setResults] = useState([]);
  const [overallResult, setOverallResult] = useState(null);
  const [school, setSchool] = useState(null);
  const [examination, setExamination] = useState(null);
  const [overrideLogo, setOverrideLogo] = useState('');
  const [noYearMessage, setNoYearMessage] = useState('');
  const [forceLanguage, setForceLanguage] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedData, setTranslatedData] = useState(null);
  const [layout, setLayout] = useState('standard');


  const isMounted = React.useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    refreshClassrooms(id)
      .then(data => {
        if (data && data.length > 0) {
          // toast.success(`Loaded ${data.length} classes`);
        } else {
          // toast.info('No classes found for this school');
        }
      })
      .catch(() => toast.error('Failed to load classes'));
    loadSchool();
  }, [id, refreshClassrooms]);

  // Apply deep-link query params and auto-generate if requested
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const qClass = qs.get('classroom');
    const qStudent = qs.get('student');
    const qExam = qs.get('exam_type');
    const qExamId = qs.get('exam');
    const qSection = qs.get('section');
    const qLogo = qs.get('logo') || qs.get('school_logo');
    const qAuto = qs.get('auto');
    let timeout;
    (async () => {
      try {
        if (qClass) {
          const numClass = parseInt(qClass, 10);
          setSelectedClass(Number.isNaN(numClass) ? '' : numClass);
          await refreshClassrooms(id);
          try {
            const secRes = await scopedGet('/api/academics/sections/', id, { classroom: Number.isNaN(numClass) ? qClass : numClass }, { timeout: 15000 });
            const secs = Array.isArray(secRes.data) ? secRes.data : secRes.data?.results || [];
            setSections(secs);
          } catch (_) {}
          if (qSection) {
            const numSec = parseInt(qSection, 10);
            let list = [];
            try {
              const studs = await scopedGet('/api/academics/students/', id, { classroom: Number.isNaN(numClass) ? qClass : numClass, section: Number.isNaN(numSec) ? qSection : numSec }, { timeout: 30000 });
              list = Array.isArray(studs.data) ? studs.data : studs.data?.results || [];
            } catch (err) {
              if (err?.code === 'ECONNABORTED' || /timeout/i.test(String(err?.message || ''))) {
                try {
                  const studsFallback = await scopedGet('/api/academics/students/', id, { classroom: Number.isNaN(numClass) ? qClass : numClass }, { timeout: 45000 });
                  list = Array.isArray(studsFallback.data) ? studsFallback.data : studsFallback.data?.results || [];
                } catch (_) {
                  list = [];
                }
              } else {
                list = [];
              }
            }
            const sorted = [...list].sort((a, b) => {
              const ar = parseInt(String(a?.roll_number ?? '').replace(/\D/g, ''), 10);
              const br = parseInt(String(b?.roll_number ?? '').replace(/\D/g, ''), 10);
              const aNum = Number.isNaN(ar) ? null : ar;
              const bNum = Number.isNaN(br) ? null : br;
              if (aNum !== null && bNum !== null) return aNum - bNum;
              const as = String(a?.roll_number ?? '');
              const bs = String(b?.roll_number ?? '');
              return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' });
            });
            setStudents(sorted);
          } else {
            setStudents([]);
          }
        }
        if (qSection) {
          const numSecOnly = parseInt(qSection, 10);
          setSelectedSection(Number.isNaN(numSecOnly) ? '' : numSecOnly);
        }
        if (qStudent) {
          const numStudent = parseInt(qStudent, 10);
          setSelectedStudent(Number.isNaN(numStudent) ? '' : numStudent);
        }
        if (qExam) setSelectedExamType(qExam);
        if (qLogo) {
          const raw = String(qLogo || '').trim();
          if (raw) {
            setOverrideLogo(raw);
            setSchool(prev => {
              const base = prev && typeof prev === 'object' ? prev : {};
              return { ...base, logo: raw };
            });
          }
        }
        if (qAuto === '1' && qClass && qStudent && (qExam || qExamId)) {
          timeout = setTimeout(() => handleSearch(qExamId || null), 200);
        }
      } catch (e) {
        console.warn('Deep link setup failed:', e);
      }
    })();
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const loadSchool = () => {
    api.get(`/api/schools/${id}/`, { timeout: 15000 })
      .then(res => {
        if (isMounted.current) setSchool(res.data);
      })
      .catch(async (err) => {
        console.error(err);
        try {
          const listRes = await api.get('/api/schools/', { timeout: 15000 });
          const arr = Array.isArray(listRes.data) ? listRes.data : (listRes.data?.results || []);
          const found = arr.find(s => String(s.id) === String(id));
          if (found && isMounted.current) setSchool(found);
        } catch (_) {}
      });
  };

  useEffect(() => {
    if (id) {
      loadSchool();
    }
  }, [id]);

  useEffect(() => {
    try {
      let url = '';
      const raw1 = school?.logo || school?.image;
      if (typeof raw1 === 'string') url = raw1;
      else if (raw1 && typeof raw1.url === 'string') url = raw1.url;
      if (!url) url = school?.logo_url || school?.image_url || school?.photo_url || '';
      url = String(url || '').trim();
      if (url && !overrideLogo) setOverrideLogo(url);
    } catch (_) {}
  }, [school, overrideLogo]);


  const handleClassChange = (classIdRaw) => {
    const parsed = parseInt(classIdRaw, 10);
    const classId = Number.isNaN(parsed) ? '' : parsed;
    setSelectedClass(classId);
    setSelectedStudent('');
    setSelectedExamType('');
    setStudentData(null);
    setResults([]);
    setOverallResult(null);
    setSelectedSection('');
    
    if (!classId) {
      setStudents([]);
      setExaminations([]);
      setSections([]);
      return;
    }
    
    // Load sections for this class
    scopedGet('/api/academics/sections/', id, { classroom: classId }, { timeout: 15000 })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setSections(data);
        if (data.length === 0) {
          scopedGet('/api/academics/students/', id, { classroom: classId }, { timeout: 15000 })
            .then(r => {
              const list = Array.isArray(r.data) ? r.data : r.data?.results || [];
              const sorted = [...list].sort((a, b) => {
                const ar = parseInt(String(a?.roll_number ?? '').replace(/\D/g, ''), 10);
                const br = parseInt(String(b?.roll_number ?? '').replace(/\D/g, ''), 10);
                const aNum = Number.isNaN(ar) ? null : ar;
                const bNum = Number.isNaN(br) ? null : br;
                if (aNum !== null && bNum !== null) return aNum - bNum;
                const as = String(a?.roll_number ?? '');
                const bs = String(b?.roll_number ?? '');
                return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' });
              });
              setStudents(sorted);
            })
            .catch(() => setStudents([]));
        }
      })
      .catch(() => setSections([]));
    
    // Do not load students yet; wait for section selection
    setStudents([]);
    
    // Load examinations for this class only
    scopedGet('/api/results/examinations/', id, { classroom: classId, year: selectedYear }, { timeout: 15000 })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        const classExams = data.filter(exam => getClassroomId(exam.classroom) === classId);
        setExaminations(classExams);
      })
      .catch(err => {
        console.error('Error loading examinations:', err);
        toast.error('Failed to load examinations');
      });
  };

  useEffect(() => {
    if (selectedClass) {
      scopedGet('/api/results/examinations/', id, { classroom: selectedClass, year: selectedYear }, { timeout: 15000 })
        .then(res => {
          const data = Array.isArray(res.data) ? res.data : res.data.results || [];
          const classExams = data.filter(exam => getClassroomId(exam.classroom) === selectedClass);
          setExaminations(classExams);
        })
        .catch(() => setExaminations([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  const normalizeExamType = (type, name) => {
    const s = String(type || '').toLowerCase();
    if (!s) {
      const rn = String(name || '').toLowerCase();
      if (/(বার্ষিক|final|annual)/.test(rn)) return 'annual';
      if (/(অর্ধ|half|mid)/.test(rn)) return 'half_yearly';
      if (/(টার্মিনাল|terminal)/.test(rn)) return 'terminal';
      if (/(মডেল|model)/.test(rn)) return 'model';
      if (/(টেস্ট|test|monthly)/.test(rn)) return 'test';
    }
    if (['final','annual','yearly'].includes(s)) return 'annual';
    if (['half','half_yearly','mid','half-yearly'].includes(s)) return 'half_yearly';
    if (['terminal','term'].includes(s)) return 'terminal';
    if (['model','model_test','model-test'].includes(s)) return 'model';
    if (['test','monthly'].includes(s)) return 'test';
    if (['first_term','first','first-term'].includes(s)) return 'first_term';
    return s || 'annual';
  };

  const getClassroomId = (cls) => {
    const v = typeof cls === 'object' ? (cls?.id ?? null) : cls;
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  };
  const normalizeLower = (s) => String(s || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
  const canonicalLower = (s) => {
    const n = normalizeLower(s).replace(/\u200d/g, '').trim();
    const dict = {
      'বাংলা-১ম': 'বাংলা প্রথম পত্র',
      'বাংলা-২য়': 'বাংলা দ্বিতীয় পত্র',
      'ইংরেজি-১ম': 'ইংরেজি প্রথম পত্র',
      'ইংরেজী-১ম': 'ইংরেজি প্রথম পত্র',
      'ইংরেজি-২য়': 'ইংরেজি দ্বিতীয় পত্র',
      'ইংরেজী-২য়': 'ইংরেজি দ্বিতীয় পত্র',
      'গনিত': 'গণিত',
      'সাধারন গণিত': 'গণিত',
      'সাধারন গনিত': 'গণিত'
    };
    const mapped = dict[n] || s;
    return normalizeLower(mapped);
  };
  const normalizeSubjectName = (name) => {
    const base = String(name || '').replace(/\s*\(.*?\)\s*/g, '').replace(/\u200d/g, '').trim();
    const clsObj = classrooms.find(c => parseInt(c.id, 10) === parseInt(selectedClass, 10)) || {};
    const nm = String(clsObj?.name || '').toLowerCase();
    const isNineTen = /নবম|nine|\b9\b|দশম|ten|\b10\b/.test(nm);
    if (!isNineTen) {
      const lower = base.trim().toLowerCase();
      if (/(ict|আইসিটি|তথ্য\s*ও\s*(যোগাযোগ|যোগযোগ)\s*প্রযুক্তি)/i.test(lower)) return 'ict';
      if (/(বাংলাদেশ\s*ও\s*বিশ্বপরিচয়|বাংলাদেশ\s*ও\s*বিশ্বপরিয়|bangladesh\s*and\s*global\s*studies|bgs)/i.test(lower)) return 'bgs';
      if (/(english|ইংরেজি|ইংরেজী)/i.test(lower)) return lower;
      if (/(গণিত|গনিত|math)/i.test(lower)) return 'math';
      return lower;
    }
    const lower = base.toLowerCase();
    const paperNo = (/(১ম|1st|first)/i.test(lower) ? 1 : (/(২য়|২য়|2nd|second)/i.test(lower) ? 2 : null));

    // Distinguish Higher Math from General Math
    if (lower.includes('উচ্চতর') || lower.includes('higher')) return 'higher_math';

    if (/(বাংলা|bangla|bengali)/i.test(lower)) return paperNo ? `bangla__paper${paperNo}` : 'bangla';
    if (/(english|ইংরেজি|ইংরেজী)/i.test(lower)) return paperNo ? `english__paper${paperNo}` : 'english';
    if (/(গণিত|গনিত|math)/i.test(lower)) return paperNo ? `math__paper${paperNo}` : 'math';
    const s = base.replace(/[- ]?(১ম|২য়|২য়|1st|2nd|first|second)([- ]?(paper|পত্র))?/gi, '').trim();
    return s.toLowerCase();
  };

  const calculateGradeAndGPA = (obtained, total) => {
    if (!total || total === 0) return { grade: 'F', gpa: '0.00', is_passed: false };
    const percentage = (obtained / total) * 100;
    let grade = 'F';
    let gpa = 0.00;
    
    if (percentage >= 80) { grade = 'A+'; gpa = 5.00; }
    else if (percentage >= 70) { grade = 'A'; gpa = 4.00; }
    else if (percentage >= 60) { grade = 'A-'; gpa = 3.50; }
    else if (percentage >= 50) { grade = 'B'; gpa = 3.00; }
    else if (percentage >= 40) { grade = 'C'; gpa = 2.00; }
    else if (percentage >= 33) { grade = 'D'; gpa = 1.00; }
    
    return { grade, gpa: gpa.toFixed(2), is_passed: grade !== 'F' };
  };

  const getExamMax = (ex) => {
    const obj = ex || {};
    const wm = parseFloat(obj.written_max) || 0;
    const mm = parseFloat(obj.mcq_max) || 0;
    const pm = parseFloat(obj.practical_max) || 0;
    if (wm || mm || pm) return wm + mm + pm;
    const t = parseFloat(obj.total_marks);
    return Number.isFinite(t) ? t : 100;
  };
  const getClassGroup = () => {
    const clsObj = classrooms.find(c => parseInt(c.id, 10) === parseInt(selectedClass, 10)) || {};
    const x = String(clsObj?.name || '').toLowerCase();
    if (/ষষ্ঠ|six|\b6\b|সপ্তম|seven|\b7\b|অষ্টম|eight|\b8\b/.test(x)) return 'six_to_eight';
    if (/নবম|nine|\b9\b|দশম|ten|\b10\b/.test(x)) return 'nine_ten';
    return null;
  };
  const getPassMarks = (exams) => {
    const ex = Array.isArray(exams) ? exams.find(e => e && (e.pass_marks != null)) : null;
    const pm = parseFloat(ex?.pass_marks);
    return Number.isFinite(pm) && pm > 0 ? pm : 33;
  };
  const computeSubjectPass = (name, w, m, p, exams, examination) => {
    const group = getClassGroup();
    const lower = canonicalLower(name);
    const passMarks = getPassMarks(exams);
    if (group === 'six_to_eight') {
      const exObj = examination || {};
      let wMax = parseFloat(exObj?.written_max) || 0;
      let mMax = parseFloat(exObj?.mcq_max) || 0;
      let pMax = parseFloat(exObj?.practical_max) || 0;
      if (!(wMax || mMax || pMax)) {
        const spec = getSubjectMaximaForClass(name) || {};
        wMax = parseFloat(spec.written) || 0;
        mMax = parseFloat(spec.mcq) || 0;
        pMax = parseFloat(spec.practical) || 0;
      }
      const requireCQ = wMax > 0;
      const requireMCQ = mMax > 0;
      const requirePR = pMax > 0;
      const tCQ = requireCQ ? Math.round(wMax / 3) : 0;
      const tMCQ = requireMCQ ? Math.round(mMax / 3) : 0;
      const tPR = requirePR ? Math.round(pMax / 3) : 0;
      const cqOk = requireCQ ? (w >= tCQ) : true;
      const mcqOk = requireMCQ ? (m >= tMCQ) : true;
      const prOk = requirePR ? (p >= tPR) : true;
      return cqOk && mcqOk && prOk;
    }
    return ((w + m + p) >= passMarks);
  };
  const SUBJECT_MAXIMA = {
    six_to_eight: {
      'বাংলা প্রথম পত্র': { written: 70, mcq: 30, practical: 0 },
      'bangla first paper': { written: 70, mcq: 30, practical: 0 },
      'বাংলা দ্বিতীয় পত্র': { written: 35, mcq: 15, practical: 0 },
      'bangla second paper': { written: 35, mcq: 15, practical: 0 },
      'ইংরেজি প্রথম পত্র': { written: 100, mcq: 0, practical: 0 },
      'english first paper': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজি দ্বিতীয় পত্র': { written: 50, mcq: 0, practical: 0 },
      'english second paper': { written: 50, mcq: 0, practical: 0 },
      'গণিত': { written: 70, mcq: 30, practical: 0 },
      'গনিত': { written: 70, mcq: 30, practical: 0 },
      'mathematics': { written: 70, mcq: 30, practical: 0 },
      'general math': { written: 70, mcq: 30, practical: 0 },
      'সাধারণ গণিত': { written: 70, mcq: 30, practical: 0 },
      'সাধারণ গনিত': { written: 70, mcq: 30, practical: 0 },
      'বিজ্ঞান': { written: 70, mcq: 30, practical: 0 },
      'science': { written: 70, mcq: 30, practical: 0 },
      'বাংলাদেশ ও বিশ্বপরিচয়': { written: 70, mcq: 30, practical: 0 },
      'বাংলাদেশ ও বিশ্বপরিয়': { written: 70, mcq: 30, practical: 0 },
      'bgs': { written: 70, mcq: 30, practical: 0 },
      'বাংলাদেশ ও বিশ্বপরিচয়': { written: 70, mcq: 30, practical: 0 },
      'আইসিটি': { written: 10, mcq: 15, practical: 25 },
      'ict': { written: 10, mcq: 15, practical: 25 },
      'তথ্য ও যোগাযোগ প্রযুক্তি': { written: 10, mcq: 15, practical: 25 },
      'তথ্য ও যোগযোগ প্রযুক্তি': { written: 10, mcq: 15, practical: 25 },
      'religion': { written: 70, mcq: 30, practical: 0 },
      'ধর্ম': { written: 70, mcq: 30, practical: 0 },
      'কৃষি': { written: 35, mcq: 15, practical: 0 },
      'agriculture': { written: 35, mcq: 15, practical: 0 },
      'কৃষি শিক্ষা': { written: 35, mcq: 15, practical: 0 },
      'গার্হস্থ্য': { written: 35, mcq: 15, practical: 0 },
      'home economics': { written: 35, mcq: 15, practical: 0 }
    }
  };
  const getSubjectMaximaForClass = (subjectName) => {
    const grp = getClassGroup();
    if (!grp || grp !== 'six_to_eight') return null;
    const s = canonicalLower(subjectName);
    const keys = Object.keys(SUBJECT_MAXIMA.six_to_eight);

    // 1. Try exact match first
    const hit = keys.find(k => normalizeLower(k) === s);
    if (hit) return SUBJECT_MAXIMA.six_to_eight[hit];

    // 2. Try substring match for Agriculture/Home Economics
    if (s.includes('কৃষি') || s.includes('agri')) return SUBJECT_MAXIMA.six_to_eight['কৃষি'];
    if (s.includes('গার্হস্থ্য') || s.includes('home')) return SUBJECT_MAXIMA.six_to_eight['গার্হস্থ্য'];

    return null;
  };
  const getTotalMaxForResult = (r) => {
    const ex = r.examination || {};
    const nm = r.subject?.name || r.subject_name || '';

    // For Class 6-8, ensure we don't accidentally use 200 as total possible
    const group = getClassGroup();
    const isNineTen = group === 'nine_ten';

    const m = getSubjectMaximaForClass(nm);
    const subjectTotal = m ? (m.written + m.mcq + m.practical) : null;
    const direct = getExamMax(ex);
    const rawTotal = parseFloat(r.total_marks);
    const hasExplicitExMax = (parseFloat(ex?.written_max) || 0) || (parseFloat(ex?.mcq_max) || 0) || (parseFloat(ex?.practical_max) || 0);

    if (subjectTotal && !hasExplicitExMax) return subjectTotal;

    let finalMax = 100;
    if (Number.isFinite(rawTotal) && rawTotal > 0) finalMax = rawTotal;
    else if (hasExplicitExMax) finalMax = direct;
    else finalMax = subjectTotal || direct || 100;

    // Safety guard: If NOT Class 9/10, a single subject shouldn't exceed 100 normally
    if (!isNineTen && finalMax > 100) return 100;

    return finalMax;
  };

  const dedupeAndFillResults = (arr, exams) => {
    const map = new Map();
    
    // Process existing results
    for (const r of (Array.isArray(arr) ? arr : [])) {
      let subjName = r.subject?.name || r.subject_name;
      if (!subjName && r.examination?.name) {
         // Fallback to exam name only if it doesn't look like a generic exam type
         const exName = String(r.examination.name).toLowerCase();
         if (!/(অর্ধ|বার্ষিক|test|model|terminal|half|annual)/.test(exName)) {
             subjName = r.examination.name;
         }
      }

      const nm = normalizeSubjectName(subjName);
      const isUnwanted = (name) => {
        const n = String(name || '').trim().toLowerCase();
        if (UNWANTED_SUBJECTS.some(u => n === u.toLowerCase())) return true;
        if (CO_CURRICULAR_SUBJECTS.some(sub => n.includes(sub.toLowerCase()))) return false;
        if (UNWANTED_KEYWORDS.some(u => n.includes(u.toLowerCase()))) return true;
        return false;
      };

      if (!nm || isUnwanted(nm) || isUnwanted(subjName)) continue;

      const prev = map.get(nm);
      if (prev) {
        const prevExId = typeof prev.examination === 'object' ? prev.examination?.id : prev.examination;
        const currExId = typeof r.examination === 'object' ? r.examination?.id : r.examination;
        if (prevExId === currExId) {
          const pw = parseFloat(prev.written_marks) || 0;
          const pmq = parseFloat(prev.mcq_marks) || 0;
          const pp = parseFloat(prev.practical_marks) || 0;
          const po = ((pw + pmq + pp) > 0) ? (pw + pmq + pp) : (parseFloat(prev.total_obtained) || 0);
          const pt = getTotalMaxForResult(prev);
          let { grade: pGrade, gpa: pGpa } = (prev.grade && prev.gpa) ? { grade: prev.grade, gpa: prev.gpa } : calculateGradeAndGPA(po, pt);
          let pPassed = (prev.is_passed !== undefined && prev.is_passed !== null) ? prev.is_passed : computeSubjectPass(prev.subject?.name || prev.subject_name || nm, pw, pmq, pp, exams, prev.examination);
          const rw = parseFloat(r.written_marks) || 0;
          const rmq = parseFloat(r.mcq_marks) || 0;
          const rp = parseFloat(r.practical_marks) || 0;
          const ro = ((rw + rmq + rp) > 0) ? (rw + rmq + rp) : (parseFloat(r.total_obtained) || 0);
          const rt = getTotalMaxForResult(r);
          let { grade: rGrade, gpa: rGpa } = (r.grade && r.gpa) ? { grade: r.grade, gpa: r.gpa } : calculateGradeAndGPA(ro, rt);
          let rPassed = (r.is_passed !== undefined && r.is_passed !== null) ? r.is_passed : computeSubjectPass(r.subject?.name || r.subject_name || nm, rw, rmq, rp, exams, r.examination);

          // Priority logic: Always prefer the result with the LATEST date, not necessarily the highest mark
          const prevDate = new Date(prev.created_at || prev.updated_at || 0).getTime();
          const currDate = new Date(r.created_at || r.updated_at || 0).getTime();

          const useCurr = currDate >= prevDate;
          const chosen = useCurr ? { base: r, w: rw, m: rmq, p: rp, o: ro, t: rt, grade: rGrade, gpa: rGpa, pass: rPassed } : { base: prev, w: parseFloat(prev.written_marks)||0, m: parseFloat(prev.mcq_marks)||0, p: parseFloat(prev.practical_marks)||0, o: parseFloat(prev.total_obtained)||0, t: getTotalMaxForResult(prev), grade: prev.grade, gpa: prev.gpa, pass: prev.is_passed };
          // Keep original name so ResultCard merging logic can detect 1st/2nd paper
          let cleanName = chosen.base.subject?.name || chosen.base.subject_name || nm;
          cleanName = cleanName.replace(/\s*\(.*?\)\s*/g, '').trim();

          map.set(nm, {
            ...chosen.base,
            written_marks: chosen.w,
            mcq_marks: chosen.m,
            practical_marks: chosen.p,
            total_obtained: chosen.o,
            total_marks: chosen.t,
            grade: chosen.grade,
            gpa: chosen.gpa,
            is_passed: chosen.pass,
            subject: { ...(chosen.base.subject || {}), name: cleanName },
            subject_name: cleanName
          });
        } else {
          const prevDate = new Date((typeof prev.examination === 'object' ? prev.examination?.exam_date : null) || 0).getTime();
          const currDate = new Date((typeof r.examination === 'object' ? r.examination?.exam_date : null) || 0).getTime();
          const useCurr = currDate && (!prevDate || currDate >= prevDate);
          const base = useCurr ? r : prev;
          const w = parseFloat(base.written_marks) || 0;
          const m = parseFloat(base.mcq_marks) || 0;
          const p = parseFloat(base.practical_marks) || 0;
          const o = ((w + m + p) > 0) ? (w + m + p) : (parseFloat(base.total_obtained) || 0);
          const t = getTotalMaxForResult(base);
          let { grade, gpa } = (base.grade && base.gpa) ? { grade: base.grade, gpa: base.gpa } : calculateGradeAndGPA(o, t);
          let passed = (base.is_passed !== undefined && base.is_passed !== null) ? base.is_passed : computeSubjectPass(base.subject?.name || base.subject_name || nm, w, m, p, exams, base.examination);
          // Keep original name so ResultCard merging logic can detect 1st/2nd paper
          let cleanName = base.subject?.name || base.subject_name || nm;
          cleanName = cleanName.replace(/\s*\(.*?\)\s*/g, '').trim();

          map.set(nm, {
            ...base,
            written_marks: w,
            mcq_marks: m,
            practical_marks: p,
            total_obtained: o,
            total_marks: t,
            grade,
            gpa,
            is_passed: passed,
            subject: { ...(base.subject || {}), name: cleanName },
            subject_name: cleanName
          });
        }
      } else {
        const w = parseFloat(r.written_marks) || 0;
        const m = parseFloat(r.mcq_marks) || 0;
        const p = parseFloat(r.practical_marks) || 0;
        const obtained = ((w + m + p) > 0) ? (w + m + p) : (parseFloat(r.total_obtained) || 0);
        const totalMax = getTotalMaxForResult(r);
        let { grade, gpa } = (r.grade && r.gpa) ? { grade: r.grade, gpa: r.gpa } : calculateGradeAndGPA(obtained, totalMax);
        let passed = (r.is_passed !== undefined && r.is_passed !== null) ? r.is_passed : computeSubjectPass(r.subject?.name || r.subject_name || nm, w, m, p, exams, r.examination);
        let cleanName = r.subject?.name || r.subject_name || nm;
        cleanName = cleanName.replace(/\s*\(.*?\)\s*/g, '').trim();

        map.set(nm, {
          ...r,
          written_marks: w,
          mcq_marks: m,
          practical_marks: p,
          total_obtained: obtained,
          total_marks: totalMax,
          grade,
          gpa,
          is_passed: passed,
          subject: { ...(r.subject || {}), name: cleanName },
          subject_name: cleanName
        });
      }
    }
    
    // Do not auto-fill missing exams with zero rows; only display what the student actually has results for
    const unsorted = Array.from(map.values());
    const getSubjW = (r) => {
      if (!r) return 9999;
      const raw = String(r.subject?.name || r.subject_name || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase().replace(/\u200d/g, '');
      const hasP = /(১ম|1st|first|২য়|২য়|2nd|second|প্রথম|দ্বিতীয়|paper|পত্র)/i.test(raw);
      if ((raw.includes('বাংলা') || raw.includes('bangla')) && !raw.includes('বাংলাদেশ')) {
        if (hasP) {
          if (/(১ম|1st|first|প্রথম)/i.test(raw)) return 1;
          return 2;
        }
        return 2;
      }
      if (raw.includes('ইংরেজি') || raw.includes('ইংরেজী') || raw.includes('english')) {
        if (hasP) {
          if (/(১ম|1st|first|প্রথম)/i.test(raw)) return 11;
          return 12;
        }
        return 12;
      }
      if (raw.includes('গণিত') || raw.includes('গনিত') || raw.includes('math')) return 21;
      if (raw.includes('ইসলাম') || raw.includes('হিন্দু') || raw.includes('ধর্ম') || raw.includes('religion')) return 31;
      if (raw.includes('আইসিটি') || raw.includes('ict') || raw.includes('তথ্য')) return 41;
      if (raw.includes('বিজ্ঞান') || raw.includes('science')) return 51;
      if (raw.includes('বাংলাদেশ') || raw.includes('বিশ্বপরিচয়') || raw.includes('বিশ্বপরিয়') || raw.includes('bangladesh') || raw.includes('global studies') || raw.includes('bgs')) return 61;
      if (raw.includes('physics') || raw.includes('পদার্থ')) return 71;
      if (raw.includes('chemistry') || raw.includes('রসায়ন')) return 72;
      if (raw.includes('biology') || raw.includes('জীব')) return 73;
      if (raw.includes('উচ্চতর') || raw.includes('higher math')) return 74;
      if (raw.includes('ইতিহাস') || raw.includes('history')) return 81;
      if (raw.includes('ভূগোল') || raw.includes('geography')) return 82;
      if (raw.includes('পৌরনীতি') || raw.includes('civics') || raw.includes('নাগরিকতা')) return 83;
      if (raw.includes('অর্থনীতি') || raw.includes('economics')) return 84;
      if (raw.includes('হিসাব') || raw.includes('accounting')) return 85;
      if (raw.includes('ফিন্যান্স') || raw.includes('finance') || raw.includes('ব্যাংকিং')) return 86;
      if (raw.includes('ব্যবসায়') || raw.includes('business') || raw.includes('উদ্যোগ')) return 87;
      if (raw.includes('কৃষি') || raw.includes('agriculture')) return 91;
      if (raw.includes('গার্হস্থ্য') || raw.includes('home economics')) return 92;
      if (raw.includes('ক্যারিয়ার') || raw.includes('career education')) return 93;
      return 100 + raw.length;
    };
    return unsorted.sort((a, b) => {
      const wa = getSubjW(a), wb = getSubjW(b);
      if (wa !== wb) return wa - wb;
      const na = String(a?.subject?.name || a?.subject_name || '').toLowerCase();
      const nb = String(b?.subject?.name || b?.subject_name || '').toLowerCase();
      return na.localeCompare(nb, 'bn', { sensitivity: 'base' });
    });
  };

  const getGradeFromCgpa = (cgpa) => {
    const v = parseFloat(cgpa);
    if (v >= 5.0) return 'A+';
    if (v >= 4.0) return 'A';
    if (v >= 3.5) return 'A-';
    if (v >= 3.0) return 'B';
    if (v >= 2.0) return 'C';
    if (v >= 1.0) return 'D';
    return 'F';
  };

  const handleSearch = async (examIdOverride = null, targetLang = null) => {
    if (!selectedStudent || (!selectedExamType && !examIdOverride)) {
      toast.warning('Please select class, student, and exam type');
      return;
    }

    setLoading(true);
    setForceLanguage(targetLang);
    setTranslatedData(null);

    try {
      // Get student details
      const studentRes = await api.get(`/api/academics/students/${selectedStudent}/`);
      const student = studentRes.data;

      let baseStudentData = { student: overrideLogo ? { ...student, school_logo: overrideLogo } : student };
      setStudentData(baseStudentData);

      let matchingExams = [];
      if (examIdOverride) {
        const exRes = await api.get(`/api/results/examinations/${examIdOverride}/`, { params: { school: id } });
        const ex = exRes.data;
        matchingExams = ex ? [ex] : [];
      } else {
        const selType = normalizeExamType(selectedExamType);
        matchingExams = examinations.filter(exam => 
          normalizeExamType(exam.exam_type, exam.name) === selType && 
          getClassroomId(exam.classroom) === selectedClass
        );
      }

      if (matchingExams.length === 0) {
        // Fallback: try by regex on names within class
        const fallbackExams = examinations.filter(ex => getClassroomId(ex.classroom) === selectedClass);
        let alt = [];
        const sel = normalizeExamType(selectedExamType);
        if (sel === 'annual') alt = fallbackExams.filter(ex => /(বার্ষিক|final|annual)/i.test(String(ex.name || '')));
        else if (sel === 'half_yearly') alt = fallbackExams.filter(ex => /(অর্ধ|half|mid)/i.test(String(ex.name || '')));
        else if (sel === 'terminal') alt = fallbackExams.filter(ex => /(টার্মিনাল|terminal|term)/i.test(String(ex.name || '')));
        else if (sel === 'model') alt = fallbackExams.filter(ex => /(মডেল|model)/i.test(String(ex.name || '')));
        else if (sel === 'test') alt = fallbackExams.filter(ex => /(টেস্ট|test|monthly)/i.test(String(ex.name || '')));
        else if (sel === 'first_term') alt = fallbackExams.filter(ex => /(first\s*term|প্রথম\s*টার্ম)/i.test(String(ex.name || '')));

        if (alt.length > 0) {
          matchingExams = alt;
        } else {
          // Fallback 2: derive exam from student's existing results
          try {
            const rs = await scopedGet('/api/results/results/', id, { student: student.id, year: selectedYear, page_size: 2000 }, { timeout: 20000 });
            let arr = Array.isArray(rs.data) ? rs.data : (rs.data?.results || []);
            if (!arr.length) {
              const rsNoYear = await scopedGet('/api/results/results/', id, { student: student.id, page_size: 2000 }, { timeout: 20000 });
              arr = Array.isArray(rsNoYear.data) ? rsNoYear.data : (rsNoYear.data?.results || []);
            }
            const examIds = Array.from(new Set(arr.map(r => (typeof r.examination === 'object' ? r.examination?.id : r.examination)).filter(Boolean)));
            let found = null;
            for (const exId of examIds) {
              try {
                const exRes = await api.get(`/api/results/examinations/${exId}/`, { params: { school: id } });
                const ex = exRes.data;
                if (getClassroomId(ex.classroom) === selectedClass && normalizeExamType(ex.exam_type, ex.name) === sel) {
                  found = ex;
                  break;
                }
              } catch (_) {}
            }
            if (found) matchingExams = [found];
          } catch (_) {}

          if (matchingExams.length === 0) {
            setStudentData(null);
            setResults([]);
            setOverallResult(null);
            setNoYearMessage(`দুঃখিত ${selectedYear} সালের রেজাল্ট এই স্কুলে এখনও ইনপুট দেওয়া হয়নি, দয়া করে অত্র বিদ্যালয়ের প্রধান শিক্ষক অথবা এ্যাডমিনের সাথে যোগাযোগ করুন। ধন্যবাদ।`);
            toast.error(`দুঃখিত ${selectedYear} সালের রেজাল্ট পাওয়া যায়নি`);
            setLoading(false);
            return;
          }
        }
      }

      let chosenExam = null;
      const possibleExams = [...matchingExams];
      try {
        const examResList = await Promise.all(matchingExams.map(ex => api.get(`/api/results/examinations/${ex.id}/`, { params: { school: id } }).then(r => r.data).catch(() => null)));
        const valid = examResList.filter(Boolean);
        const validSorted = [...valid].sort((a, b) => new Date(b.exam_date || 0) - new Date(a.exam_date || 0));
        chosenExam = validSorted[0] || valid[0] || null;
        setExamination(chosenExam);
      } catch (_) {
        chosenExam = matchingExams[0] || null;
        setExamination(chosenExam);
      }
      // Keep all matching examinations for subject coverage; chosenExam is only for header
      const originalMatching = [...matchingExams];
      matchingExams = originalMatching.length ? originalMatching : (chosenExam ? [chosenExam] : []);
      
      // Fetch results for all matching examinations and merge
      let fetchedResults = [];
      
      // BROAD FETCH: Always fetch all results for this student in this classroom
      // This ensures we don't miss subjects that might be in slightly different exam entries
      try {
        const broadParams = { 
          student: student.id, 
          classroom: selectedClass, 
          page_size: 1000 
        };
        const broadRes = await scopedGet('/api/results/results/', id, broadParams, { timeout: 20000 });
        const broadArr = Array.isArray(broadRes.data) ? broadRes.data : (broadRes.data?.results || []);
        
        if (broadArr.length > 0) {
          // Double verify student ID on frontend to ensure no data leakage from server top-N results
          fetchedResults = broadArr.filter(r => {
            const rid = String(r.student?.id || r.student || '');
            return rid === String(student.id);
          });
        }
      } catch (err) {
        console.warn('Broad fetch failed, falling back to specific exam fetch', err);
      }

      // Specific exam fetch (if broad fetch failed or returned nothing)
      if (fetchedResults.length === 0) {
        for (const ex of matchingExams) {
          try {
            const params = { examination: ex.id, student: student.id, page_size: 1000 };
            const resultsRes = await scopedGet('/api/results/results/', id, params, { timeout: 15000 });
            const arr = Array.isArray(resultsRes.data) ? resultsRes.data : (resultsRes.data?.results || []);
            if (arr.length) {
              fetchedResults = fetchedResults.concat(arr);
            }
          } catch (_) {}
        }
      }

      if (fetchedResults.length === 0) {
        try {
          const r = await scopedGet('/api/results/results/', id, { student: student.id, page_size: 2000 }, { timeout: 20000 });
          const arr = Array.isArray(r.data) ? r.data : (r.data?.results || r.data?.data || []);
          if (arr.length > 0) {
            fetchedResults = arr;
          }
        } catch (_) {}
      }
      
      if (fetchedResults.length > 0) {
        const merged = dedupeAndFillResults(fetchedResults, matchingExams);
        setResults(merged);
        const usedExamIds = Array.from(new Set(merged.map(r => {
          const exObj = r.examination;
          return typeof exObj === 'object' ? exObj?.id : exObj;
        }).filter(Boolean)));
        try {
          const usedExamObjs = await Promise.all(usedExamIds.map(eid => api.get(`/api/results/examinations/${eid}/`, { params: { school: id } }).then(r => r.data).catch(() => null)));
          const validUsed = usedExamObjs.filter(Boolean).sort((a, b) => new Date(b.exam_date || 0) - new Date(a.exam_date || 0));
          if (validUsed[0]) setExamination(validUsed[0]);
        } catch (_) {}
      } else {
        const merged = dedupeAndFillResults([], matchingExams);
        setResults(merged);
      }

      // Get overall result with rank - try multiple methods
      let overall = null;
      try {
        const exId = chosenExam?.id || null;
        
        // Method 1: Try student-specific combined overall result (Best for rank calculation)
        if (selectedExamType && selectedClass) {
          try {
            const combinedRes = await api.get('/api/results/overall/combined_by_exam_type/', {
              params: {
                student: student.id,
                exam_type: selectedExamType,
                classroom: selectedClass,
                section: selectedSection,
                year: selectedYear
              }
            });
            if (combinedRes.data && combinedRes.data.rank) {
              overall = {
                percentage: combinedRes.data.percentage,
                rank: combinedRes.data.rank,
                is_passed: combinedRes.data.is_passed,
                total_marks_obtained: combinedRes.data.total_marks_obtained,
                total_marks_possible: combinedRes.data.total_marks_possible,
                cgpa: combinedRes.data.cgpa,
                grade: combinedRes.data.grade
              };
            }
          } catch (err) {
            console.warn('Combined by exam type failed', err);
          }
        }

        // Method 2: If no rank yet, try single exam student-specific overall result
        if (!overall && exId) {
          try {
            const res = await api.get('/api/results/overall/', { 
              params: { student: student.id, examination: exId } 
            });
            const results = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            const me = results[0];
            if (me) {
              overall = {
                percentage: me.percentage,
                rank: Number(me.rank || me.position || 0) || null,
                is_passed: me.is_passed,
                total_marks_obtained: me.total_marks_obtained,
                total_marks_possible: me.total_marks_possible,
                cgpa: me.cgpa,
                grade: me.grade
              };
            }
          } catch (err) {
            console.warn('Single student overall fetch failed', err);
          }
        }
        
        // Method 3: Fallback to list-based approach if needed (Even for single exam)
        if (!overall && selectedExamType && selectedClass) {
          try {
            const combinedRes = await api.get('/api/results/overall/combined_rank_list_by_exam_type/', {
              params: {
                exam_type: selectedExamType,
                classroom: selectedClass,
                section: selectedSection,
                school: id,
                year: selectedYear,
                page_size: 2500 // Increased to handle large schools
              }
            });
            const list = Array.isArray(combinedRes.data) ? combinedRes.data : (combinedRes.data?.results || []);
            const me = (list || []).find(item => {
              const sid = item?.student?.id ?? item?.student_id;
              return String(sid) === String(student.id);
            });
            if (me) {
              overall = {
                percentage: me.percentage,
                rank: Number(me.rank || me.position || 0) || null,
                is_passed: me.is_passed,
                total_marks_obtained: me.total_marks_obtained,
                total_marks_possible: me.total_marks_possible,
                cgpa: me.cgpa,
                grade: me.grade
              };
            }
          } catch (err) {
            console.warn('Combined rank fetch failed', err);
          }
        }
        
        // Method 4: Fallback to single exam list fetch
        if (!overall && exId) {
          const classOverallRes = await scopedGet('/api/results/overall/', id, { examination: exId, page_size: 1000 }, { timeout: 15000 });
          const list = Array.isArray(classOverallRes.data) ? classOverallRes.data : (classOverallRes.data?.results || []);
          const me = (list || []).find(item => {
            const sid = item?.student?.id ?? item?.student_id;
            return String(sid) === String(student.id);
          });
          if (me) {
            overall = {
              percentage: me.percentage,
              rank: Number(me.rank || me.position || 0) || null,
              is_passed: me.is_passed,
              total_marks_obtained: me.total_marks_obtained,
              total_marks_possible: me.total_marks_possible,
              cgpa: me.cgpa,
              grade: me.grade
            };
          }
        }
      } catch (err) {
        console.warn('Overall API failed, will fallback to manual calculation', err);
      }

      // If overall still null, calculate on frontend
      if (!overall && fetchedResults.length > 0) {
        const totalObtained = fetchedResults.reduce((sum, r) => sum + (parseFloat(r.total_obtained) || 0), 0);
        const totalPossible = fetchedResults.reduce((sum, r) => {
          const ex = r.examination || {};
          const wm = parseFloat(ex.written_max) || 0;
          const mm = parseFloat(ex.mcq_max) || 0;
          const pm = parseFloat(ex.practical_max) || 0;
          const maximaSum = (wm || mm || pm) ? (wm + mm + pm) : (parseFloat(ex.total_marks) || 100);
          const rMax = parseFloat(r.total_marks);
          return sum + (rMax > 0 ? rMax : maximaSum);
        }, 0);
        
        // Accurate GPA calculation with SAFE grouping (ID-first, only 1st+2nd paper merge when both exist)
        const UNWANTED = [...UNWANTED_SUBJECTS, ...CO_CURRICULAR_SUBJECTS];
        const unwantedCheck = (name) => {
          const ln = String(name || '').toLowerCase();
          if (UNWANTED.some(u => ln.includes(u.toLowerCase()))) return true;
          if (ln.includes('optional') || ln.includes('ঐচ্ছিক')) return true;
          return false;
        };
        const filtered = fetchedResults.filter(r => {
          if (r.is_optional) return false;
          return !unwantedCheck(r.subject?.name || r.subject_name || '');
        });
        const grouped = safeGroupSubjects(filtered, null);

        let sumGP = 0;
        const subCount = Object.keys(grouped).length;
        Object.values(grouped).forEach(gpas => {
          sumGP += gpas.reduce((a, b) => a + b, 0) / gpas.length;
        });

        const percentage = totalPossible > 0 ? (totalObtained / totalPossible * 100).toFixed(2) : 0;
        const isPassed = fetchedResults.every(r => r.is_passed);
        
        const finalGPA = subCount > 0 ? Math.min(5, sumGP / subCount) : 0;
        const grade = calculateGradeAndGPA(totalObtained, totalPossible).grade; // Fallback to percentage-based grade if GP average is tricky
        
        overall = {
          total_marks_obtained: totalObtained.toFixed(2),
          total_marks_possible: totalPossible.toFixed(2),
          percentage: percentage,
          cgpa: finalGPA.toFixed(2),
          grade: getGradeFromCgpa(finalGPA),
          is_passed: isPassed,
          rank: null
        };
      }
      setOverallResult(overall);

      // Handle Translation if requested
      if (targetLang === 'en') {
        setIsTranslating(true);
        try {
          const payload = {
            school_name: school?.name,
            student_name: `${student.user?.first_name || ''} ${student.user?.last_name || ''}`.trim(),
            father_name: student.father_name,
            mother_name: student.mother_name,
            guardian_name: student.guardian_name,
            address: student.address || school?.address,
            class_name: `${student.classroom?.name || ''} ${student.section?.name ? `(${student.section.name})` : ''}`,
            examination_name: `${examination?.academic_year || ''} ${examination?.name || ''}`.trim(),
            subjects: fetchedResults.map(r => r.subject?.name || r.subject_name)
          };
          const transRes = await api.post('/api/results/overall/translate_card/', payload);
          setTranslatedData(transRes.data);
        } catch (err) {
          console.error('Translation failed', err);
          toast.error('AI অনুবাদ ব্যর্থ হয়েছে, মূল ডাটা দেখানো হচ্ছে');
        } finally {
          setIsTranslating(false);
        }
      }

      // Fetch "New Roll" from StudentYearRecord
      try {
        const historyRes = await api.get('/api/academics/students/history/', { 
          params: { school: id, year: selectedYear, student_id: student.id } 
        });
        const records = Array.isArray(historyRes.data) ? historyRes.data : (historyRes.data?.results || []);
        const me = records.find(r => String(r.student?.id || r.student) === String(student.id));
        if (me && me.roll_number) {
          setStudentData(prev => ({
            ...prev,
            student: { ...prev.student, promoted_roll: me.roll_number }
          }));
        }
      } catch (_) {}

      toast.success(`Result card generated with ${Array.isArray(results) ? results.length : 0} subjects!`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate result card');
      setStudentData(null);
      setResults([]);
      setOverallResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!studentData) {
      toast.warning('Please generate a result card first');
      return;
    }
    toast.info('Opening print dialog...');
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleDownloadPDF = async () => {
    if (!studentData) {
      toast.warning('Please generate a result card first');
      return;
    }
    setLoading(true);
    try {
      const cardEl = document.querySelector('.result-card-container');
      if (!cardEl) {
        toast.error('Could not find the result card to export');
        setLoading(false);
        return;
      }

      // Pre-capture preparation: scroll to top
      const originalScrollY = window.scrollY;
      window.scrollTo(0, 0);

      const canvas = await html2canvas(cardEl, {
        scale: 3,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          // Fix for MUI elements that might lose color in capture
          const chips = clonedDoc.querySelectorAll('.MuiChip-root');
          chips.forEach(chip => {
            chip.style.opacity = '1';
            chip.style.visibility = 'visible';
          });

          const watermarks = clonedDoc.querySelectorAll('.result-card-container > div');
          watermarks.forEach(div => {
            const op = parseFloat(div.style.opacity || '0');
            if (op > 0 && op <= 0.3) {
              div.style.opacity = Math.max(0.05, op * 0.6).toFixed(2);
            }
          });
        }
      });

      // Restore scroll
      window.scrollTo(0, originalScrollY);

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const margin = 10;
      const imgWidth = pdfWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // If content is longer than one page
      if (imgHeight > (pdfHeight - (margin * 2))) {
        const ratio = (pdfHeight - (margin * 2)) / imgHeight;
        const scaledWidth = imgWidth * ratio;
        const x = (pdfWidth - scaledWidth) / 2;
        pdf.addImage(imgData, 'PNG', x, margin, scaledWidth, pdfHeight - (margin * 2));
      } else {
        const x = (pdfWidth - imgWidth) / 2;
        pdf.addImage(imgData, 'PNG', x, margin, imgWidth, imgHeight);
      }

      const fileName = `result-card-${studentData.student?.user?.username || 'student'}.pdf`;
      pdf.save(fileName);
      toast.success('PDF ডাউনলোড সফল হয়েছে');
    } catch (e) {
      console.error('PDF generation error:', e);
      toast.error('পিডিএফ তৈরি করতে সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  const buildCardForStudent = async (stuId) => {
    try {
      const studentRes = await api.get(`/api/academics/students/${stuId}/`);
      const student = studentRes.data;
      const selType = normalizeExamType(selectedExamType);
      let matchingExams = examinations.filter(exam =>
        normalizeExamType(exam.exam_type, exam.name) === selType &&
        getClassroomId(exam.classroom) === selectedClass
      );
      if (matchingExams.length === 0) {
        const fallbackExams = examinations.filter(ex => getClassroomId(ex.classroom) === selectedClass);
        let alt = [];
        if (selType === 'annual') alt = fallbackExams.filter(ex => /(বার্ষিক|final|annual)/i.test(String(ex.name || '')));
        else if (selType === 'half_yearly') alt = fallbackExams.filter(ex => /(অর্ধ|half|mid)/i.test(String(ex.name || '')));
        else if (selType === 'terminal') alt = fallbackExams.filter(ex => /(টার্মিনাল|terminal|term)/i.test(String(ex.name || '')));
        else if (selType === 'model') alt = fallbackExams.filter(ex => /(মডেল|model)/i.test(String(ex.name || '')));
        else if (selType === 'test') alt = fallbackExams.filter(ex => /(টেস্ট|test|monthly)/i.test(String(ex.name || '')));
        else if (selType === 'first_term') alt = fallbackExams.filter(ex => /(first\s*term|প্রথম\s*টার্ম)/i.test(String(ex.name || '')));
        if (alt.length > 0) matchingExams = alt;
      }
      let chosenExam = null;
      try {
        const examResList = await Promise.all(matchingExams.map(ex => api.get(`/api/results/examinations/${ex.id}/`, { params: { school: id } }).then(r => r.data).catch(() => null)));
        const valid = examResList.filter(Boolean);
        const validSorted = [...valid].sort((a, b) => new Date(b.exam_date || 0) - new Date(a.exam_date || 0));
        chosenExam = validSorted[0] || valid[0] || null;
      } catch (_) {
        chosenExam = matchingExams[0] || null;
      }
      const originalMatching = [...matchingExams];
      matchingExams = originalMatching.length ? originalMatching : (chosenExam ? [chosenExam] : []);
      let fetchedResults = [];
      for (const ex of matchingExams) {
        try {
          const params = { examination: ex.id, student: stuId, page_size: 1000 };
          if (selectedSection) params.section = selectedSection;
          const resultsRes = await scopedGet('/api/results/results/', id, params, { timeout: 15000 });
          const arr = Array.isArray(resultsRes.data) ? resultsRes.data : (resultsRes.data?.results || []);
          fetchedResults = fetchedResults.concat(arr);
        } catch (_) {}
      }
      if ((!fetchedResults || fetchedResults.length === 0) && matchingExams.length > 1) {
        const sortedPossible = [...matchingExams].sort((a, b) => new Date(b.exam_date || 0) - new Date(a.exam_date || 0));
        for (const ex of sortedPossible) {
          try {
            const params = { examination: ex.id, student: stuId, page_size: 1000 };
            if (selectedSection) params.section = selectedSection;
            const resA = await scopedGet('/api/results/results/', id, params, { timeout: 15000 });
            const arrA = Array.isArray(resA.data) ? resA.data : (resA.data?.results || []);
            if (arrA && arrA.length) {
              fetchedResults = arrA;
              matchingExams = [ex];
              chosenExam = ex;
              break;
            }
          } catch (_) {}
        }
      }
      const merged = dedupeAndFillResults(fetchedResults, matchingExams);
      let overall = null;
      try {
        const exId = chosenExam?.id || null;
        
        // Method 1: Try student-specific combined overall result (Best for rank calculation)
        if (selectedExamType && selectedClass) {
          try {
            const combinedRes = await api.get('/api/results/overall/combined_by_exam_type/', {
              params: {
                student: stuId,
                exam_type: selectedExamType,
                classroom: selectedClass,
                section: selectedSection,
                year: selectedYear
              }
            });
            if (combinedRes.data && combinedRes.data.rank) {
              overall = {
                percentage: combinedRes.data.percentage,
                rank: combinedRes.data.rank,
                is_passed: combinedRes.data.is_passed,
                total_marks_obtained: combinedRes.data.total_marks_obtained,
                total_marks_possible: combinedRes.data.total_marks_possible,
                cgpa: combinedRes.data.cgpa,
                grade: combinedRes.data.grade
              };
            }
          } catch (err) {
            console.warn('Combined by exam type failed in buildCardForStudent', err);
          }
        }

        // Method 2: Try single student overall result
        if (!overall && exId) {
          try {
            const res = await api.get('/api/results/overall/', { 
              params: { student: stuId, examination: exId } 
            });
            const results = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            const me = results[0];
            if (me) {
              overall = {
                percentage: me.percentage,
                rank: Number(me.rank || me.position || 0) || null,
                is_passed: me.is_passed,
                total_marks_obtained: me.total_marks_obtained,
                total_marks_possible: me.total_marks_possible,
                cgpa: me.cgpa,
                grade: me.grade
              };
            }
          } catch (err) {
            console.warn('Single student overall fetch failed in buildCardForStudent', err);
          }
        }

        // Method 3: Fallback to list-based approach (Even for single exam)
        if (!overall && selectedExamType && selectedClass) {
          try {
            const combinedRes = await api.get('/api/results/overall/combined_rank_list_by_exam_type/', {
              params: {
                exam_type: selectedExamType,
                classroom: selectedClass,
                section: selectedSection,
                school: id,
                year: selectedYear,
                page_size: 2500 // Increased to handle large schools
              }
            });
            const list = Array.isArray(combinedRes.data) ? combinedRes.data : (combinedRes.data?.results || []);
            const me = (list || []).find(item => {
              const sid = item?.student?.id ?? item?.student_id;
              return String(sid) === String(stuId);
            });
            if (me) {
              overall = {
                percentage: me.percentage,
                rank: Number(me.rank || me.position || 0) || null,
                is_passed: me.is_passed,
                total_marks_obtained: me.total_marks_obtained,
                total_marks_possible: me.total_marks_possible,
                cgpa: me.cgpa,
                grade: me.grade
              };
            }
          } catch (err) {
            console.warn('Combined rank fetch failed in buildCardForStudent', err);
          }
        }
        
        // Method 4: Final fallback to single exam list fetch
        if (!overall && exId) {
          const classOverallRes = await scopedGet('/api/results/overall/', id, { examination: exId, page_size: 2500 }, { timeout: 15000 });
          const list = Array.isArray(classOverallRes.data) ? classOverallRes.data : (classOverallRes.data?.results || []);
          const me = (list || []).find(item => {
            const sid = item?.student?.id ?? item?.student_id;
            return String(sid) === String(stuId);
          });
          if (me) {
            overall = {
              percentage: me.percentage,
              rank: Number(me.rank || me.position || 0) || null,
              is_passed: me.is_passed,
              total_marks_obtained: me.total_marks_obtained,
              total_marks_possible: me.total_marks_possible,
              cgpa: me.cgpa,
              grade: me.grade
            };
          }
        }
      } catch (_) {
        overall = null;
      }

      // IMPROVED FALLBACK FOR BULK
      if (!overall && merged.length > 0) {
        const totalObtained = merged.reduce((sum, r) => sum + (parseFloat(r.total_obtained) || 0), 0);
        const totalPossible = merged.reduce((sum, r) => sum + (parseFloat(r.total_marks) || 100), 0);

        const grouped = {};
        merged.forEach(r => {
          const name = (r.subject?.name || r.subject_name || '').toLowerCase();
          let baseName = name;
          if (name.includes('bangla') || name.includes('বাংলা')) baseName = 'bangla';
          else if (name.includes('english') || name.includes('ইংরেজি') || name.includes('ইংরেজী')) baseName = 'english';
          if (!grouped[baseName]) grouped[baseName] = [];
          grouped[baseName].push(parseFloat(r.gpa) || 0);
        });

        let sumGP = 0;
        const subCount = Object.keys(grouped).length;
        Object.values(grouped).forEach(gpas => {
          sumGP += gpas.reduce((a, b) => a + b, 0) / gpas.length;
        });

        const finalGPA = subCount > 0 ? Math.min(5, sumGP / subCount) : 0;
        overall = {
          total_marks_obtained: totalObtained,
          total_marks_possible: totalPossible,
          cgpa: finalGPA.toFixed(2),
          grade: getGradeFromCgpa(finalGPA),
          is_passed: merged.every(r => r.is_passed)
        };
      }
      const examObj = chosenExam || (merged.length ? merged[0]?.examination : null);
      return {
        studentData: { student },
        results: merged,
        overallResult: overall,
        examination: examObj
      };
    } catch (_) {
      return null;
    }
  };

  const handleGenerateBulkCards = async () => {
    if (!selectedClass || !selectedSection || !selectedExamType) {
      toast.error('শ্রেণি, সেকশন ও পরীক্ষার ধরন নির্বাচন করুন');
      return;
    }
    if (!Array.isArray(students) || students.length === 0) {
      toast.error('এই সেকশনে কোনো শিক্ষার্থী পাওয়া যায়নি');
      return;
    }
    setBulkLoading(true);
    setBulkCards([]);
    try {
      const list = students.filter(s => {
        const secId = (typeof s.section === 'object') ? (s.section?.id ?? s.section?.section_id) : s.section_id;
        return String(secId || '') === String(selectedSection || '');
      });
      const cards = [];
      const studentIdsDone = new Set();
      for (const s of list) {
        if (studentIdsDone.has(s.id)) continue;
        studentIdsDone.add(s.id);
        const card = await buildCardForStudent(s.id);
        if (card) {
          cards.push(card);
        }
      }
      setBulkCards(cards);
      if (!cards.length) {
        toast.warning('কোনো কার্ড তৈরি হয়নি');
      } else {
        toast.success(`মোট ${cards.length} শিক্ষার্থীর কার্ড তৈরি হয়েছে`);
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkPrint = () => {
    if (!bulkCards.length) {
      toast.warning('প্রিন্ট করার জন্য কার্ড তৈরি করুন');
      return;
    }

    toast.info('প্রিন্ট ডায়ালগ খুলছে, দয়া করে অপেক্ষা করুন...');

    // Instead of setting states which causes re-renders, we use CSS classes
    document.body.classList.add('bulk-print-active');

    setTimeout(() => {
      window.print();
      document.body.classList.remove('bulk-print-active');
    }, 1500);
  };

  const handleDownloadBulkPDF = async () => {
    if (!bulkCards.length) {
      toast.warning('ডাউনলোড করার জন্য আগে বাল্ক কার্ড জেনারেট করুন');
      return;
    }
    setLoading(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 5;

      // Temporary div to render cards one by one for capture
      const container = document.querySelector('.bulk-print-mode');
      const cardElements = container.querySelectorAll('.result-card-container');

      for (let i = 0; i < cardElements.length; i++) {
        const canvas = await html2canvas(cardElements[i], {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png', 0.8);
        const imgWidth = pdfWidth - (margin * 2);
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (i > 0) pdf.addPage();

        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, Math.min(imgHeight, pdfHeight - (margin * 2)));
      }

      pdf.save(`bulk-result-cards-${selectedClass}-${selectedSection}.pdf`);
      toast.success('সব কার্ড পিডিএফ হিসেবে ডাউনলোড হয়েছে');
    } catch (e) {
      console.error('Bulk PDF error:', e);
      toast.error('বাল্ক পিডিএফ ডাউনলোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedClass('');
    setSelectedStudent('');
    setSelectedExamType('');
    setStudents([]);
    setExaminations([]);
    setStudentData(null);
    setResults([]);
    setOverallResult(null);
    setSelectedSection('');
    toast.info('Form reset');
  };

  const handleSectionChange = (e) => {
    const p = parseInt(e.target.value, 10);
    const secId = Number.isNaN(p) ? '' : p;
    setSelectedSection(secId);
    
    if (selectedClass) {
      if (secId) {
        scopedGet('/api/academics/students/', id, { classroom: selectedClass, section: secId }, { timeout: 30000 })
          .then(res => {
            const data = Array.isArray(res.data) ? res.data : res.data.results || [];
            const sorted = [...data].sort((a, b) => {
              const ar = parseInt(String(a?.roll_number ?? '').replace(/\D/g, ''), 10);
              const br = parseInt(String(b?.roll_number ?? '').replace(/\D/g, ''), 10);
              const aNum = Number.isNaN(ar) ? null : ar;
              const bNum = Number.isNaN(br) ? null : br;
              if (aNum !== null && bNum !== null) return aNum - bNum;
              const as = String(a?.roll_number ?? '');
              const bs = String(b?.roll_number ?? '');
              return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' });
            });
            setStudents(sorted);
          })
          .catch(err => {
            if (err?.code === 'ECONNABORTED' || /timeout/i.test(String(err?.message || ''))) {
              scopedGet('/api/academics/students/', id, { classroom: selectedClass }, { timeout: 45000 })
                .then(res2 => {
                  const data2 = Array.isArray(res2.data) ? res2.data : res2.data.results || [];
                  const sorted2 = [...data2].sort((a, b) => {
                    const ar = parseInt(String(a?.roll_number ?? '').replace(/\D/g, ''), 10);
                    const br = parseInt(String(b?.roll_number ?? '').replace(/\D/g, ''), 10);
                    const aNum = Number.isNaN(ar) ? null : ar;
                    const bNum = Number.isNaN(br) ? null : br;
                    if (aNum !== null && bNum !== null) return aNum - bNum;
                    const as = String(a?.roll_number ?? '');
                    const bs = String(b?.roll_number ?? '');
                    return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' });
                  });
                  toast.warning('Section query timed out, loaded class students instead');
                  setStudents(sorted2);
                })
                .catch(e2 => {
                  console.error('Error loading students (fallback):', e2);
                  toast.error('Failed to load students');
                  setStudents([]);
                });
            } else {
              console.error('Error loading students:', err);
              toast.error('Failed to load students');
            }
          });
      } else {
        scopedGet('/api/academics/students/', id, { classroom: selectedClass }, { timeout: 15000 })
          .then(res => {
            const data = Array.isArray(res.data) ? res.data : res.data.results || [];
            const sorted = [...data].sort((a, b) => {
              const ar = parseInt(String(a?.roll_number ?? '').replace(/\D/g, ''), 10);
              const br = parseInt(String(b?.roll_number ?? '').replace(/\D/g, ''), 10);
              const aNum = Number.isNaN(ar) ? null : ar;
              const bNum = Number.isNaN(br) ? null : br;
              if (aNum !== null && bNum !== null) return aNum - bNum;
              const as = String(a?.roll_number ?? '');
              const bs = String(b?.roll_number ?? '');
              return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' });
            });
            setStudents(sorted);
          })
          .catch(() => setStudents([]));
      }
    }
  };

  const handleStudentChange = (e) => {
    const p = parseInt(e.target.value, 10);
    setSelectedStudent(Number.isNaN(p) ? '' : p);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack className="no-print" direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4">
          <AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          রেজাল্ট কার্ড জেনারেটর
        </Typography>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>ব্যাক</Button>
      </Stack>

      {/* Search Form */}
      <Paper sx={{ p: 3, mb: 3, boxShadow: 3 }} className="no-print">
        <Typography variant="h6" gutterBottom>রেজাল্ট কার্ড তৈরি করুন</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          সব বিষয়ে রেজাল্ট কার্ড তৈরির জন্য শ্রেণি, শিক্ষার্থী এবং পরীক্ষার ধরন নির্বাচন করুন
        </Typography>
        
        <Stack spacing={2} sx={{ mb: 2 }}>
          {/* ধাপ ১: শ্রেণি নির্বাচন */}
          <TextField
            select
            label="ধাপ ১: শ্রেণি নির্বাচন করুন"
            value={selectedClass}
            onChange={(e) => handleClassChange(e.target.value)}
            fullWidth
          >
            <MenuItem value="">
              {classrooms.length === 0 ? "কোনো শ্রেণি পাওয়া যায়নি (লোড হচ্ছে...)" : "একটি শ্রেণি নির্বাচন করুন"}
            </MenuItem>
            {classrooms.map((classroom) => (
              <MenuItem key={classroom.id} value={classroom.id}>
                {classroom.name}
              </MenuItem>
            ))}
          </TextField>

          {/* ধাপ ১.৫: সেকশন নির্বাচন */}
          <TextField
            select
            label="ধাপ ১.৫: সেকশন নির্বাচন করুন"
            value={selectedSection}
            onChange={handleSectionChange}
            fullWidth
            disabled={!selectedClass}
          >
            <MenuItem value="">
              {sections.length === 0 ? "কোনো সেকশন পাওয়া যায়নি" : "সেকশন নির্বাচন করুন"}
            </MenuItem>
            {sections.map((sec) => (
              <MenuItem key={sec.id} value={sec.id}>
                {sec.name}
              </MenuItem>
            ))}
          </TextField>

          {/* ধাপ ২: শিক্ষার্থী নির্বাচন */}
          <TextField
            select
            label="ধাপ ২: শিক্ষার্থী নির্বাচন করুন"
            value={selectedStudent}
            onChange={handleStudentChange}
            fullWidth
            disabled={!selectedClass}
          >
            <MenuItem value="">
              {students.length === 0 ? "কোনো শিক্ষার্থী পাওয়া যায়নি" : "একজন শিক্ষার্থী নির্বাচন করুন"}
            </MenuItem>
            {students.map((student) => (
              <MenuItem key={student.id} value={student.id}>
                {student.user?.first_name} {student.user?.last_name} - Roll: {student.roll_number || 'N/A'}
              </MenuItem>
            ))}
          </TextField>

          {/* ধাপ ২.৫: সাল নির্বাচন */}
          <TextField
            type="number"
            label="ধাপ ২.৫: সাল নির্বাচন করুন"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value || String(new Date().getFullYear()), 10) || new Date().getFullYear())}
            fullWidth
            disabled={!selectedClass}
            inputProps={{ min: 2000, max: 2100 }}
          />

          {/* ধাপ ৩: পরীক্ষার ধরন নির্বাচন */}
          <TextField
            select
            label="ধাপ ৩: পরীক্ষার ধরন নির্বাচন করুন"
            value={selectedExamType}
            onChange={(e) => setSelectedExamType(e.target.value)}
            fullWidth
            disabled={!selectedClass}
          >
            <MenuItem value="">পরীক্ষার ধরন নির্বাচন করুন</MenuItem>
            {examTypes.map((type) => (
              <MenuItem key={type.value} value={type.value}>
                {type.label}
              </MenuItem>
            ))}
          </TextField>

          {/* লেআউট নির্বাচন */}
          <TextField
            select
            label="লেআউট নির্বাচন করুন"
            value={layout}
            onChange={(e) => setLayout(e.target.value)}
            fullWidth
            disabled={!selectedClass}
          >
            <MenuItem value="standard">স্ট্যান্ডার্ড লেআউট</MenuItem>
            <MenuItem value="ssc">SSC বোর্ড লেআউট (নতুন)</MenuItem>
          </TextField>
        </Stack>

        <Stack direction="row" spacing={2} flexWrap="wrap">
          <Button
            variant="contained"
            startIcon={<AssessmentIcon />}
            onClick={() => handleSearch(null, 'bn')}
            disabled={loading || !selectedStudent || !selectedExamType}
            color="primary"
          >
            {loading && !forceLanguage ? 'তৈরি হচ্ছে...' : 'বাংলায় মার্কশীট তৈরি করুন'}
          </Button>

          <Button
            variant="contained"
            startIcon={<AssessmentIcon />}
            onClick={() => handleSearch(null, 'en')}
            disabled={loading || !selectedStudent || !selectedExamType}
            sx={{ bgcolor: '#1a237e', '&:hover': { bgcolor: '#0d1642' } }}
          >
            {isTranslating ? 'AI অনুবাদ হচ্ছে...' : 'ইংরেজিতে মার্কশীট তৈরি করুন'}
          </Button>

          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handleGenerateBulkCards}
            color="secondary"
            disabled={!selectedSection || bulkLoading || !selectedExamType}
          >
            {bulkLoading ? 'লোড হচ্ছে...' : 'সেকশনের সব কার্ড তৈরি'}
          </Button>
          
          {studentData && (
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              color="primary"
            >
              প্রিন্ট
            </Button>
          )}

          {bulkCards.length > 0 && (
            <>
              <Button
                variant="contained"
                startIcon={<PrintIcon />}
                onClick={handleBulkPrint}
                color="success"
              >
                সব কার্ড প্রিন্ট
              </Button>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadBulkPDF}
                color="info"
              >
                সব পিডিএফ ডাউনলোড
              </Button>
            </>
          )}

          {studentData && (
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadPDF}
              color="secondary"
            >
              পিডিএফ ডাউনলোড
            </Button>
          )}
          
          <Button
            variant="text"
            startIcon={<RefreshIcon />}
            onClick={handleReset}
          >
            রিসেট
          </Button>
        </Stack>

        {classrooms.length === 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            কোনো শ্রেণি পাওয়া যায়নি। আগে শ্রেণি তৈরি করুন।
          </Alert>
        )}
        
        {selectedClass && students.length === 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            এই শ্রেণিতে কোনো শিক্ষার্থী নেই। আগে শিক্ষার্থী যোগ করুন।
          </Alert>
        )}
        
        {selectedClass && selectedExamType && examinations.length > 0 && 
         !examinations.find(e => normalizeExamType(e.exam_type, e.name) === normalizeExamType(selectedExamType) && getClassroomId(e.classroom) === selectedClass) && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            এই শ্রেণির জন্য কোনো {examTypes.find(t => t.value === selectedExamType)?.label} পরীক্ষা পাওয়া যায়নি। আগে একটি পরীক্ষা তৈরি করুন।
          </Alert>
        )}
      </Paper>

      

      {/* Result Card Display */}
      <Box className="result-display-area">
        {studentData && (
          <Box className="single-card-view">
            {layout === 'ssc' ? (
              <SSCMarksheet
                studentData={studentData}
                results={results}
                overallResult={overallResult}
                examination={examination}
                school={school || {}}
                forceLanguage={forceLanguage}
              />
            ) : (
              <ResultCard
                studentData={translatedData ? {
                  ...studentData,
                  student: {
                    ...(studentData?.student || {}),
                    user: {
                      ...(studentData?.student?.user || {}),
                      first_name: translatedData.student_name?.split(' ')[0] || studentData?.student?.user?.first_name || '',
                      last_name: translatedData.student_name?.split(' ').slice(1).join(' ') || studentData?.student?.user?.last_name || ''
                    },
                    father_name: translatedData.father_name || studentData?.student?.father_name || '',
                    mother_name: translatedData.mother_name || studentData?.student?.mother_name || '',
                    guardian_name: translatedData.guardian_name || studentData?.student?.guardian_name || '',
                    address: translatedData.address || studentData?.student?.address || ''
                  }
                } : studentData}
                results={translatedData ? results.map(r => {
                  const name = r.subject?.name || r.subject_name;
                  const transName = translatedData.subjects?.[name] || translatedData.subjects?.[name.toLowerCase()] || name;
                  return { ...r, subject: { ...r.subject, name: transName }, subject_name: transName };
                }) : results}
                overallResult={overallResult}
                examination={overrideLogo ? { ...(examination || {}), school_logo: overrideLogo } : examination}
                school={translatedData ? { ...school, name: translatedData.school_name, address: translatedData.address } : (school || {})}
                schoolId={id}
                forceLanguage={forceLanguage}
                translatedData={translatedData}
              />
            )}
          </Box>
        )}

        {bulkCards.length > 0 && (
          <Box sx={{ mt: studentData ? 8 : 0 }} className="bulk-print-mode">
            {bulkCards.map((card, idx) => (
              <Box key={`${card.studentData.student.id}-${idx}`} className="bulk-sheet">
                <Box className="bulk-card-wrap">
                  {layout === 'ssc' ? (
                    <SSCMarksheet
                      studentData={card.studentData}
                      results={card.results}
                      overallResult={card.overallResult}
                      examination={card.examination}
                      school={school || {}}
                      forceLanguage={forceLanguage}
                    />
                  ) : (
                    <ResultCard
                      studentData={card.studentData}
                      results={card.results}
                      overallResult={card.overallResult}
                      examination={card.examination}
                      school={school || {}}
                      schoolId={id}
                      forceLanguage={forceLanguage}
                    />
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {!studentData && bulkCards.length === 0 && (
        <EmptyState
          icon={AssessmentIcon}
          title={noYearMessage ? "রেজাল্ট পাওয়া যায়নি" : "কোনো রেজাল্ট কার্ড তৈরি হয়নি"}
          message={noYearMessage || "সব বিষয়ে রেজাল্ট কার্ড তৈরির জন্য শ্রেণি, শিক্ষার্থী এবং পরীক্ষার ধরন নির্বাচন করুন"}
        />
      )}
      <style>
        {`
          @media print {
            .no-print, header, footer, nav, aside, .MuiAppBar-root, .MuiDrawer-root, .MuiToolbar-root, .MuiSnackbar-root, .MuiAlert-root {
              display: none !important;
            }

            body, html {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            .result-display-area, .single-card-view {
              margin: 0 !important;
              padding: 0 !important;
              display: block !important;
              visibility: visible !important;
            }

            .bulk-sheet {
              page-break-after: always !important;
              break-after: page !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            .bulk-card-wrap {
              width: 100% !important;
              display: flex !important;
              justify-content: center !important;
            }
          }
        `}
      </style>
    </Box>
  );
}
