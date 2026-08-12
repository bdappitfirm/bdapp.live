import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Alert,
  CircularProgress,
  Backdrop
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

const UNWANTED_KEYWORDS = [];

const CO_CURRICULAR_SUBJECTS = [
  'শারীরিক শিক্ষা ও স্বাস্থ্য', 'শারীরিক শিক্ষা', 'Physical Education', 'Physical Education and Health',
  'ক্যারিয়ার শিক্ষা', 'ক্যারিয়ার শিক্ষা', 'Career Education', 'ক্যারিয়ার', 'ক্যারিয়ার',
  'Word Collection Achievement Test', 'WCAT',
  'বই পড়া', 'বই পড়া', 'চারু ও কারুকলা', 'Arts and Crafts',
  'কর্ম ও জীবনমুখী', 'Life and Work', 'Continuous Assessment', 'ধারাবাহিক মূল্যায়ন'
];

const getSubjectMaxima = (name, isClassNineOrTen) => {
  const lower = String(name || '').toLowerCase();

  if (lower.includes('english') || lower.includes('ইংরেজি') || lower.includes('ইংরেজী') || lower.includes('eng')) {
    if (isClassNineOrTen) return { cq: 100, mcq: 0, pr: 0 };
    if (lower.includes('২য়') || lower.includes('২য়') || lower.includes('2nd') || lower.includes('second') || lower.includes('ii')) return { cq: 50, mcq: 0, pr: 0 };
    return { cq: 100, mcq: 0, pr: 0 };
  }

  if (lower.includes('ict') || lower.includes('তথ্য') || lower.includes('information') || lower.includes('যোগাযোগ')) {
    return isClassNineOrTen ? { cq: 0, mcq: 25, pr: 25 } : { cq: 10, mcq: 15, pr: 25 };
  }

  const isPracticalScience = lower.includes('পদার্থ') || lower.includes('physics') || lower.includes('রসায়ন') || lower.includes('রসায়ন') || lower.includes('chemistry') || lower.includes('জীব') || lower.includes('biology') || lower.includes('উচ্চতর') || lower.includes('higher');
  const isAgriHome = lower.includes('কৃষি') || lower.includes('agriculture') || lower.includes('গার্হস্থ্য') || lower.includes('home science') || lower.includes('home economics');

  if (isClassNineOrTen) {
    if (isPracticalScience || isAgriHome) return { cq: 50, mcq: 25, pr: 25 };
    if (lower.includes('বাংলা') || lower.includes('bangla')) return { cq: 70, mcq: 30, pr: 0 };
  } else {
    if (isPracticalScience) return { cq: 50, mcq: 25, pr: 25 };
    if (isAgriHome) return { cq: 35, mcq: 15, pr: 0 };
    if ((lower.includes('বাংলা') || lower.includes('bangla')) && (lower.includes('২য়') || lower.includes('২য়') || lower.includes('2nd') || lower.includes('second') || lower.includes('ii'))) return { cq: 35, mcq: 15, pr: 0 };
    if (lower.includes('ধর্ম') || lower.includes('religion') || lower.includes('ইসলাম') || lower.includes('হিন্দ')) return { cq: 70, mcq: 30, pr: 0 };
  }
  return { cq: 70, mcq: 30, pr: 0 };
};

const computeGpa = (pct) => {
  if (pct >= 80) return 5.0; if (pct >= 70) return 4.0; if (pct >= 60) return 3.5;
  if (pct >= 50) return 3.0; if (pct >= 40) return 2.0; if (pct >= 33) return 1.0;
  return 0.0;
};

const sumStrLocal = (s) => String(s || '').split('+').reduce((acc, v) => acc + (parseFloat(v) || 0), 0);

// Helpers moved to top for broader access
const normalizeSubjKeyLocal = (n) => {
    const low = String(n).toLowerCase().trim();
    if (low.includes('higher') || low.includes('উচ্চতর')) return 'higher';
    if (low.includes('math') || low.includes('গণিত')) return 'math';
    if (low.includes('history') || low.includes('ইতিহাস') || low.includes('সভ্যতা')) return 'history';
    if (low.includes('bgs') || (low.includes('বাংলাদেশ') && (low.includes('পরিচয়') || low.includes('পরিচয়'))) || low.includes('global studies')) return 'bgs';
    if ((low.includes('bangla') || low.includes('বাংলা')) && !low.includes('বাংলাদেশ') && !low.includes('bangladesh')) return 'bangla';
    if (low.includes('english') || low.includes('ইংরেজি')) return 'english';
    if (low.includes('religion') || low.includes('islam') || low.includes('hindu') || low.includes('ধর্ম') || low.includes('ইসলাম') || low.includes('হিন্দু') || low.includes('moral') || low.includes('নৈতিক')) return 'religion';
    if (low.includes('ict') || low.includes('তথ্য') || low.includes('information') || low.includes('communication') || low.includes('technology')) return 'ict';
    if (low.includes('physics') || low.includes('পদার্থ')) return 'physics';
    if (low.includes('chemistry') || low.includes('রসায়ন') || low.includes('রসায়ন')) return 'chemistry';
    if (low.includes('biology') || low.includes('জীব')) return 'biology';
    if (low.includes('agriculture') || low.includes('কৃষি') || low.includes('home') || low.includes('গার্হস্থ্য')) return 'agriculture';
    if (low.includes('accounting') || low.includes('হিসাব')) return 'accounting';
    if (low.includes('finance') || low.includes('ফিন্যান্স')) return 'finance';
    if (low.includes('business') || low.includes('ব্যবসায়') || low.includes('ব্যবসায়') || low.includes('entrepreneurship') || low.includes('উদ্যোগ')) return 'business';
    if (low.includes('geography') || low.includes('ভূগোল')) return 'geography';
    if (low.includes('civics') || low.includes('পৌরনীতি') || low.includes('পৌরণীতি')) return 'civics';
    if (low.includes('economics') || low.includes('অর্থনীতি')) return 'economics';
    if ((low.includes('science') || low.includes('বিজ্ঞান')) && !low.includes('social') && !low.includes('সমাজ')) return 'science';
    return low;
};

const inferGroupLocal = (resList, isNT) => {
    if (!isNT || !resList || resList.length === 0) return '';
    const count = (regex) => resList.filter(r => {
        const hasMarks = (parseFloat(r.written_marks) > 0 || parseFloat(r.mcq_marks) > 0 || parseFloat(r.practical_marks) > 0 || (parseFloat(r.total_obtained) > 0));
        return hasMarks && regex.test(String(r.subject?.name || r.subject_name || '').toLowerCase());
    }).length;
    const sciCount = count(/physics|chemistry|biology|higher|পদার্থ|রসায়ন|জীব|উচ্চতর/i);
    const comCount = count(/accounting|finance|entrepreneurship|ব্যবসায়|হিসাব|ফিন্যান্স/i);
    const humCount = count(/history|geography|civics|ইতিহাস|ভূগোল|পৌরনীতি|economics|অর্থনীতি/i);
    if (sciCount > 0 && sciCount >= comCount && sciCount >= humCount) return 'science';
    if (comCount > 0 && comCount >= humCount) return 'commerce';
    if (humCount > 0) return 'humanities';
    return '';
};

const isScienceGroupLocal = (g) => { const l = String(g || '').toLowerCase(); return l.includes('science') || l.includes('বিজ্ঞান'); };
const isCommerceGroupLocal = (g) => { const l = String(g || '').toLowerCase(); return l.includes('commerce') || l.includes('business') || l.includes('ব্যবসায়') || l.includes('ব্যবসায়'); };
const isHumanitiesGroupLocal = (g) => { const l = String(g || '').toLowerCase(); return l.includes('arts') || l.includes('humanities') || l.includes('মানবিক'); };

const getExpectedSubjectsLocal = (studentGroup, isNT, classSubjs) => {
    const subjects = new Set(['math', 'religion', 'ict']);
    const g = String(studentGroup || '').toLowerCase();
    const checkPaper = (base) => {
        if (isNT) return [base];
        const hasP1 = Array.from(classSubjs).some(s => normalizeSubjKeyLocal(s) === base && !s.includes('2nd') && !s.includes('২য়') && !s.includes('২য়') && !s.includes('second'));
        const hasP2 = Array.from(classSubjs).some(s => normalizeSubjKeyLocal(s) === base && (s.includes('2nd') || s.includes('২য়') || s.includes('২য়') || s.includes('second')));
        if (hasP1 || hasP2) {
            const res = [];
            if (hasP1) res.push(base + '_p1');
            if (hasP2) res.push(base + '_p2');
            return res;
        }
        return [base];
    };
    checkPaper('bangla').forEach(s => subjects.add(s));
    checkPaper('english').forEach(s => subjects.add(s));

    if (isNT) {
        if (isScienceGroupLocal(g)) {
            ['physics', 'chemistry', 'biology', 'bgs'].forEach(s => subjects.add(s));
        } else if (isCommerceGroupLocal(g)) {
            ['accounting', 'finance', 'business', 'science'].forEach(s => subjects.add(s));
        } else if (isHumanitiesGroupLocal(g)) {
            ['history', 'geography', 'civics', 'economics', 'science'].forEach(s => subjects.add(s));
        }
    } else {
        ['science', 'bgs'].forEach(s => subjects.add(s));
    }
    return subjects;
};

const translateSubLocal = (key) => {
    const map = {
        'bangla': 'Bangla', 'bangla_p1': 'Bangla 1st Paper', 'bangla_p2': 'Bangla 2nd Paper',
        'english': 'English', 'english_p1': 'English 1st Paper', 'english_p2': 'English 2nd Paper',
        'math': 'Mathematics', 'religion': 'Religion', 'ict': 'ICT', 'science': 'Science', 'bgs': 'BGS',
        'physics': 'Physics', 'chemistry': 'Chemistry', 'biology': 'Biology', 'higher': 'Higher Mathematics',
        'accounting': 'Accounting', 'finance': 'Finance & Banking', 'business': 'Business Entrepreneurship',
        'history': 'History', 'geography': 'Geography', 'civics': 'Civics & Citizenship', 'economics': 'Economics',
        'agriculture': 'Agriculture'
    };
    return map[key] || key;
};

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
  const [forceLanguage, setForceLanguage] = useState('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedData, setTranslatedData] = useState(null);
  const [layout, setLayout] = useState('standard');


  const isMounted = React.useRef(true);

  const isClassNineOrTen = useMemo(() => {
    const cls = classrooms.find(c => String(c.id) === String(selectedClass));
    if (!cls) return false;
    const text = String(cls.name || '').toLowerCase();
    return /নবম|দশম|ssc|\b9\b|\b10\b|\bnine\b|\bten\b|\bix\b|\bx\b|class\s*9|class\s*10|৯ম|১০ম/i.test(text);
  }, [selectedClass, classrooms]);

  const calculateStudentRank = useCallback(async (studentId, listResults = null) => {
    try {
        let allResults = listResults;
        if (!allResults) {
            const res = await scopedGet('/api/results/results/', id, {
                classroom: selectedClass,
                section: selectedSection,
                year: selectedYear,
                page_size: 10000
            });
            allResults = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        }

        if (allResults.length === 0) return null;

        const isNT = isClassNineOrTen;

        const classSubjects = new Set();
        allResults.forEach(r => {
            const sn = String(r.subject?.name || r.subject_name || '').toLowerCase();
            if (!/শারীরিক|বই\s*পড়া|achievement|continuous|wcat|শারিরীক/i.test(sn)) classSubjects.add(sn);
        });

        const isRelSubjLocal = (n) => /religion|islam|hindu|buddhist|christian|ধর্ম|ইসলাম|হিন্দু|বৌদ্ধ|খ্রিস্ট/i.test(String(n));

        // Group by student
        const studentIds = Array.from(new Set(allResults.map(r => String(r.student?.id ?? r.student_id ?? r.student ?? '')).filter(Boolean)));
        const resultsPool = [];

        // Sort all results by ID once to ensure consistent deduplication
        const allResultsSorted = [...allResults].sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));

        for (const sid of studentIds) {
            const stuResults = allResultsSorted.filter(r => String(r.student?.id || r.student) === sid);
            if (stuResults.length === 0) continue;

            const student = stuResults[0].student;

            // Religion suppression (matches Merit List logic)
            const relResults = stuResults.filter(r => isRelSubjLocal(r.subject?.name || r.subject_name));
            let suppressedIds = new Set();
            if (relResults.length > 1) {
                const withMarks = relResults.map(r => ({
                    sid: String(r.subject?.id || r.subject || r.subject_name),
                    total: (parseFloat(r.total_obtained) || (sumStrLocal(r.written_marks)||0) + (sumStrLocal(r.mcq_marks)||0) + (sumStrLocal(r.practical_marks)||0))
                })).filter(x => x.total > 0).sort((a, b) => b.total - a.total);

                if (withMarks.length > 0) {
                    const bestRelSubId = withMarks[0].sid;
                    relResults.forEach(r => {
                        const rid = String(r.subject?.id || r.subject || r.subject_name);
                        if (rid !== bestRelSubId) suppressedIds.add(rid);
                    });
                } else {
                    const islam = relResults.find(r => /islam|ইসলাম/i.test(r.subject?.name || r.subject_name));
                    const primaryRel = islam || relResults[0];
                    const pid = String(primaryRel.subject?.id || primaryRel.subject || primaryRel.subject_name);
                    relResults.forEach(r => {
                        const rid = String(r.subject?.id || r.subject || r.subject_name);
                        if (rid !== pid) suppressedIds.add(rid);
                    });
                }
            }

        const subjectMap = new Map();

        stuResults.forEach(r => {
            const sid = String(r.subject?.id || r.subject || r.subject_name);
            if (suppressedIds.has(sid)) return;

            const rawName = String(r.subject?.name || r.subject_name).toLowerCase().trim();
            let normKey = normalizeSubjKeyLocal(rawName);
            let key = normKey;

            // ALWAYS distinguish papers during deduplication to prevent data loss
            const is2 = /(২য়|২য়|2nd|second| ii | ii$| 2)/i.test(rawName);
            const has1 = /(১ম|1st|first| i | i$| 1)/i.test(rawName);

            if (normKey === 'bangla' || normKey === 'english') {
                if (is2 && !has1) key = normKey + '_p2';
                else if (has1 && !is2) key = normKey + '_p1';
                else key = normKey + '_combined';
            }

            // Skip redundant combined records if specific papers exist (Matches Merit List logic)
            const isCombined = !rawName.match(/(1st|2nd|১ম|২য়|২য়)/);
            const hasSpecificPapers = stuResults.some(x => {
                const xName = String(x.subject?.name || x.subject_name || '').toLowerCase();
                return normalizeSubjKeyLocal(xName) === normKey && xName.match(/(1st|2nd|১ম|২য়|২য়)/);
            });
            if (isNT && isCombined && hasSpecificPapers) return;

            const w = sumStrLocal(r.written_marks), m = sumStrLocal(r.mcq_marks), p = sumStrLocal(r.practical_marks);
            const hasInput = (r.written_marks !== '' && r.written_marks !== null) || (r.mcq_marks !== '' && r.mcq_marks !== null) || (r.practical_marks !== '' && r.practical_marks !== null) || (parseFloat(r.total_obtained) > 0);
            const rTotal = hasInput ? ((w + m + p) > 0 ? (w + m + p) : (parseFloat(r.total_obtained) || 0)) : 0;

            // Prefer record with marks (Aggressive Deduplication)
            const existing = subjectMap.get(key);
            if (!existing || rTotal > (existing.total_obtained || 0) || (hasInput && !existing.hasMarks)) {
                subjectMap.set(key, { ...r, sumW: w, sumM: m, sumP: p, hasMarks: hasInput, total_obtained: rTotal });
            }
        });

        const virtualMap = new Map();
        Array.from(subjectMap.values()).forEach(r => {
            const nm = String(r.subject?.name || r.subject_name || '').toLowerCase();
            let norm = normalizeSubjKeyLocal(nm);
            let key = norm;

            // For summing/scoring, 9-10 uses the base 'bangla'/'english' key to group papers
            if (isNT && (norm === 'bangla' || norm === 'english')) {
                 key = norm;
            } else if (norm === 'bangla' || norm === 'english') {
                const is2 = nm.includes('2nd') || nm.includes('২য়') || nm.includes('২য়') || nm.includes('second');
                if (is2) key = norm + '_p2'; else key = norm + '_p1';
            }
            if (!virtualMap.has(key)) virtualMap.set(key, []);
            virtualMap.get(key).push(r);
        });

            // Detect class-level group as fallback
            let classLevelGroup = '';
            const groupCounts = { science: 0, commerce: 0, humanities: 0 };
            students.forEach(s => {
                const g = (s?.student_group || s?.group || '').toLowerCase();
                if (g.includes('science')) groupCounts.science++;
                else if (g.includes('commerce') || g.includes('business')) groupCounts.commerce++;
                else if (g.includes('arts') || g.includes('humanities')) groupCounts.humanities++;
            });
            if (groupCounts.science >= groupCounts.commerce && groupCounts.science >= groupCounts.humanities && groupCounts.science > 0) classLevelGroup = 'science';
            else if (groupCounts.commerce >= groupCounts.humanities && groupCounts.commerce > 0) classLevelGroup = 'commerce';
            else if (groupCounts.humanities > 0) classLevelGroup = 'humanities';

            const group = (student?.student_group || student?.group || inferGroupLocal(Array.from(subjectMap.values()), isNT) || classLevelGroup).toLowerCase();
            const expectedKeys = getExpectedSubjectsLocal(group, isNT, classSubjects);
            const takenRelId = Array.from(subjectMap.values()).find(r => isRelSubjLocal(r.subject?.name || r.subject_name) && (parseFloat(r.total_obtained) > 0))?.subject?.id;

            let score = 0, fails = 0, hasAnyMarks = false, totalPoints = 0, subjectCount = 0;

            const hmList = Array.from(subjectMap.values()).filter(r => /higher|উচ্চতর/.test(String(r.subject?.name || r.subject_name).toLowerCase()));
            const agriList = Array.from(subjectMap.values()).filter(r => /agriculture|home|কৃষি|গার্হস্থ্য/.test(String(r.subject?.name || r.subject_name).toLowerCase()));

            const assignedOpt = student?.optional_subject;
            const assignedOptId = String(assignedOpt?.id || assignedOpt || '');
            const assignedOptName = String(assignedOpt?.name || '').toLowerCase();

            let showHM = false, showAgri = false;
            const hasHM = hmList.some(r => (parseFloat(r.total_obtained) || 0) > 0);
            const hasAgri = agriList.some(r => (parseFloat(r.total_obtained) || 0) > 0);

            if (assignedOptId || assignedOptName) {
                const isHMAssigned = (assignedOptId && hmList.some(r => String(r.subject?.id || r.subject) === assignedOptId)) || (assignedOptName && assignedOptName.includes('higher'));
                const isAgriAssigned = (assignedOptId && agriList.some(r => String(r.subject?.id || r.subject) === assignedOptId)) || (assignedOptName && (assignedOptName.includes('agri') || assignedOptName.includes('কৃষি')));

                if (isHMAssigned && hasHM) showHM = true;
                else if (isAgriAssigned && hasAgri) showAgri = true;
                else {
                    const hmTotal = hmList.reduce((s, r) => s + (parseFloat(r.total_obtained)||0), 0);
                    const agriTotal = agriList.reduce((s, r) => s + (parseFloat(r.total_obtained)||0), 0);
                    showHM = isNT && (hmTotal >= agriTotal && hmTotal > 0);
                    showAgri = isNT && (agriTotal > hmTotal && agriTotal > 0);
                }
            } else {
                const hmTotal = hmList.reduce((s, r) => s + (parseFloat(r.total_obtained)||0), 0);
                const agriTotal = agriList.reduce((s, r) => s + (parseFloat(r.total_obtained)||0), 0);
                showHM = isNT && (hmTotal >= agriTotal && hmTotal > 0);
                showAgri = isNT && (agriTotal > hmTotal && agriTotal > 0);
            }

            const allKeys = new Set([...expectedKeys, 'higher', 'agriculture', 'civics', 'economics', 'accounting', 'finance', 'business']);

            // Track if we've counted an elective for the group
            let electiveCounted = false;

            allKeys.forEach(key => {
                const papers = virtualMap.get(key) || [];
                const isRel = isRelSubjLocal(key);
                let isMandatory = expectedKeys.has(key);

                // Group Pools for automatic inclusion
                const sciPool = ['physics', 'chemistry', 'biology'];
                const comPool = ['accounting', 'finance', 'business'];
                const humPool = ['history', 'geography', 'civics', 'economics'];
                const belongsToGroup = (isScienceGroupLocal(group) && sciPool.includes(key)) ||
                                       (isCommerceGroupLocal(group) && comPool.includes(key)) ||
                                       (isHumanitiesGroupLocal(group) && humPool.includes(key));

                // Elective logic for Humanities (Civics/Economics)
                if (isNT && isHumanitiesGroupLocal(group)) {
                    if (key === 'civics' || key === 'economics') {
                        if (papers.length > 0 && !electiveCounted) { isMandatory = true; electiveCounted = true; }
                        else if (key === 'civics' && !electiveCounted && !virtualMap.has('economics')) { isMandatory = true; electiveCounted = true; }
                    }
                }

                if (isMandatory || belongsToGroup) {
                    if (!isRel || (isRel && !takenRelId) || (isRel && papers.length > 0)) {
                         subjectCount++;
                    }
                }

                if (papers.length === 0) {
                    if (isMandatory) {
                        if (isRel && takenRelId) return;
                        if (isNT) {
                            if (isScienceGroupLocal(group)) {
                                if (key === 'science') return;
                            } else {
                                if (key === 'bgs' || key === 'physics' || key === 'chemistry' || key === 'biology') return;
                            }
                            if (['civics', 'economics', 'accounting', 'finance', 'business'].includes(key)) return;
                        }
                        if (!isNT && (key === 'bangla' || key === 'english')) { if (virtualMap.has(key + '_p1') || virtualMap.has(key + '_p2')) return; }
                        if (stuResults.length > 0) fails++;
                    }
                    return;
                }

                let totalW = 0, totalM = 0, totalP = 0, totalMarks = 0, totalPossible = 0, cqM = 0, mcqM = 0, prM = 0;
                let isAnyPaperPresent = false;
                papers.forEach(r => {
                    if (r.hasMarks) { hasAnyMarks = true; isAnyPaperPresent = true; }
                    const w = r.sumW, m = r.sumM, pr = r.sumP;
                    const spec = getSubjectMaxima(r.subject?.name || r.subject_name, isNT);
                    totalW += w; totalM += m; totalP += pr; totalMarks += (w + m + pr) > 0 ? (w + m + pr) : (parseFloat(r.total_obtained) || 0);
                    totalPossible += (spec.cq + spec.mcq + spec.pr || 100);
                    cqM += spec.cq; mcqM += spec.mcq; prM += spec.pr;
                });

                if (isNT && (key === 'bangla' || key === 'english')) {
                    totalPossible = Math.max(totalPossible, 200);
                    if (totalMarks > 200) totalMarks = 200;
                }

                const cqPass = cqM === 0 || totalW >= Math.round(cqM * 0.33 - 0.5);
                const mcqPass = mcqM === 0 || totalM >= Math.round(mcqM * 0.33 - 0.5);
                const prPass = prM === 0 || totalP >= Math.round(prM * 0.33 - 0.5);
                const totPass = totalMarks >= Math.round(totalPossible * 0.33 - 0.5);

                let isSubjectPassed = isAnyPaperPresent && (isNT ? (cqPass && mcqPass && prPass && totPass) : totPass);

                const gp = isSubjectPassed ? computeGpa((totalMarks / totalPossible) * 100) : 0;
                const isAgriculture = (key === 'higher' || key === 'agriculture');

                if ((key === 'higher' && showHM) || (key === 'agriculture' && showAgri)) {
                    if (totalMarks > (totalPossible * 0.4)) { score += (totalMarks - (totalPossible * 0.4)); }
                    totalPoints += Math.max(0, gp - 2.0);
                } else if (isMandatory || belongsToGroup || (!isNT && isAgriculture)) {
                    if (!isNT && isAgriculture) return;
                    if (isNT && (key === 'bgs' || key === 'science') && !isScienceGroupLocal(group)) { if (!isAnyPaperPresent) return; }
                    if (isRel && takenRelId && !papers.some(r => String(r.subject?.id) === String(takenRelId))) return;
                    score += totalMarks; totalPoints += gp;
                    if (isMandatory && (!isAnyPaperPresent || !isSubjectPassed)) { if (!(isNT === false && (key.includes('শারীরিক') || key.includes('physical')))) { fails++; } }
                } else { if (!isNT) score += totalMarks; }
            });

            if (!hasAnyMarks) fails = 999;
            const finalCgpa = subjectCount > 0 ? Math.min(5.0, totalPoints / subjectCount) : 0;

            resultsPool.push({
                sid,
                total: Math.round(score),
                rawScore: score,
                points: finalCgpa,
                fails,
                isAbsent: !hasAnyMarks,
                roll: student?.roll_number ? parseInt(String(student.roll_number).replace(/\D/g, ''), 10) : 999999,
                section_id: String(student?.section?.id || student?.section || 'other')
            });
        }

        // Section-wise Sorting
        const bySection = new Map();
        resultsPool.forEach(item => {
            const secId = selectedSection ? 'single' : (item.section_id || 'other');
            if (!bySection.has(secId)) bySection.set(secId, []);
            bySection.get(secId).push(item);
        });

        const finalRankMap = {};
        for (const sectionItems of bySection.values()) {
            sectionItems.sort((a, b) => {
                if (a.isAbsent !== b.isAbsent) return a.isAbsent ? 1 : -1;
                // Match Merit List exactly: 1. Fewer Fails, 2. Higher GPA (points), 3. Higher Total Marks (rawScore)
                return (a.fails - b.fails) || (b.points - a.points) || (b.rawScore - a.rawScore) || (a.roll - b.roll);
            });
            let lastRank = 0, lastValues = null;
            sectionItems.forEach((c, idx) => {
                if (c.isAbsent) {
                    finalRankMap[c.sid] = null;
                } else {
                    const currentValues = `${c.fails}-${c.points.toFixed(2)}-${c.rawScore.toFixed(2)}`;
                    if (currentValues !== lastValues) {
                        lastRank = idx + 1;
                        lastValues = currentValues;
                    }
                    finalRankMap[c.sid] = lastRank;
                }
            });
        }

        return finalRankMap[String(studentId)] || null;

    } catch (e) {
        console.error('Rank calculation error:', e);
        return null;
    }
  }, [id, selectedClass, selectedSection, selectedYear, isClassNineOrTen, classrooms, students]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    refreshClassrooms(id)
      .then(data => {
        // success
      })
      .catch(() => {});
    loadSchool();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Apply deep-link query params and auto-generate if requested
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const qClass = qs.get('classroom');
    const qStudent = qs.get('student');
    const qExam = qs.get('exam_type');
    const qExamId = qs.get('exam');
    const qSection = qs.get('section');
    const qYear = qs.get('year') || qs.get('academic_year');
    const qLogo = qs.get('logo') || qs.get('school_logo');
    const qAuto = qs.get('auto');
    let timeout;
    (async () => {
      try {
        if (isMounted.current === false) return;

        console.log('🔗 Deep link processing:', location.search);

        if (qYear) {
          const numYear = parseInt(qYear, 10);
          if (!Number.isNaN(numYear)) setSelectedYear(numYear);
        }
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
          const autoYear = qYear ? parseInt(qYear, 10) : selectedYear;
          timeout = setTimeout(() => handleSearch(qExamId || null, null, autoYear), 200);
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
    scopedGet('/api/results/examinations/', id, { classroom: classId }, { timeout: 15000 })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        let classExams = data.filter(exam => getClassroomId(exam.classroom) === classId);

        // Apply year filter on frontend if needed
        if (selectedYear) {
            const yStr = String(selectedYear);
            classExams = classExams.filter(ex => {
                const exY = String(ex.year || ex.academic_year || '');
                return !exY || exY === yStr || ex.name?.includes(yStr);
            });
        }
        setExaminations(classExams);
      })
      .catch(err => {
        console.error('Error loading examinations:', err);
        toast.error('Failed to load examinations');
      });
  };

  useEffect(() => {
    if (selectedClass) {
      scopedGet('/api/results/examinations/', id, { classroom: selectedClass }, { timeout: 15000 })
        .then(res => {
          const data = Array.isArray(res.data) ? res.data : res.data.results || [];
          let classExams = data.filter(exam => getClassroomId(exam.classroom) === selectedClass);

          if (selectedYear) {
              const yStr = String(selectedYear);
              classExams = classExams.filter(ex => {
                  const exY = String(ex.year || ex.academic_year || '');
                  return !exY || exY === yStr || ex.name?.includes(yStr);
              });
          }
          setExaminations(classExams);
        })
        .catch(() => setExaminations([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedClass]);

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
    const lower = base.toLowerCase();

    // Normalize Unicode for য় vs য়
    const normalized = lower.replace(/\u09df/g, '\u09af\u09bc');

    const clsObj = classrooms.find(c => parseInt(c.id, 10) === parseInt(selectedClass, 10)) || {};
    const nm = String(clsObj?.name || '').toLowerCase();
    const isNineTen = /নবম|nine|\b9\b|দশম|ten|\b10\b/.test(nm);

    const paperNo = (/(১ম|1st|first|প্রথম| i | i$| 1)/i.test(normalized) ? 1 : (/(২য়|২য়|2nd|second|দ্বিতীয়| ii | ii$| 2)/i.test(normalized) ? 2 : null));

    if (!isNineTen) {
      if (/(ict|আইসিটি|তথ্য\s*ও\s*(যোগাযোগ|যোগযোগ)\s*প্রযুক্তি)/i.test(normalized)) return 'ict';
      if (/(বাংলাদেশ|bangladesh|bgs|বিশ্বপরিচ)/i.test(normalized)) return 'bgs';
      if (/(বাংলা|bangla)/i.test(normalized)) return paperNo ? `bangla__paper${paperNo}` : 'bangla';
      if (/(english|ইংরেজি|ইংরেজী)/i.test(normalized)) return paperNo ? `english__paper${paperNo}` : 'english';
      if (/(গণিত|গনিত|math)/i.test(normalized)) return paperNo ? `math__paper${paperNo}` : 'math';
      return normalized;
    }

    // Distinguish Higher Math from General Math
    if (normalized.includes('উচ্চতর') || normalized.includes('higher')) return 'higher_math';

    if (/(বাংলাদেশ|bangladesh|bgs|বিশ্বপরিচ)/i.test(normalized)) return 'bgs';
    if (/(বাংলা|bangla|bengali)/i.test(normalized)) return paperNo ? `bangla__paper${paperNo}` : 'bangla';
    if (/(english|ইংরেজি|ইংরেজী)/i.test(normalized)) return paperNo ? `english__paper${paperNo}` : 'english';
    if (/(গণিত|গনিত|math)/i.test(normalized)) return paperNo ? `math__paper${paperNo}` : 'math';

    const s = normalized.replace(/[- ]?(১ম|২য়|২য়|1st|2nd|first|second)([- ]?(paper|পত্র))?/gi, '').trim();
    return s;
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

    // 2. Try substring match
    if (s.includes('english') || s.includes('ইংরেজি') || s.includes('ইংরেজী') || s.includes('eng')) {
        if (s.includes('২য়') || s.includes('২য়') || s.includes('2nd') || s.includes('second') || s.includes('ii')) {
            return SUBJECT_MAXIMA.six_to_eight['english second paper'] || { written: 50, mcq: 0, practical: 0 };
        }
        return SUBJECT_MAXIMA.six_to_eight['english first paper'] || { written: 100, mcq: 0, practical: 0 };
    }
    if (s.includes('bangla') || s.includes('বাংলা')) {
        if (s.includes('২য়') || s.includes('২য়') || s.includes('2nd') || s.includes('second') || s.includes('ii')) {
            return SUBJECT_MAXIMA.six_to_eight['bangla second paper'] || { written: 35, mcq: 15, practical: 0 };
        }
        return SUBJECT_MAXIMA.six_to_eight['bangla first paper'] || { written: 70, mcq: 30, practical: 0 };
    }

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

  const dedupeAndFillResults = (arr, exams, expectedKeys = null, studentOptionalSubject = null, validSubjKeys = null) => {
    const map = new Map(); // key -> result object
    const sortedArr = (Array.isArray(arr) ? [...arr] : []).sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));

    const isRelSubjLocal = (n) => /religion|islam|hindu|buddhist|christian|ধর্ম|ইসলাম|হিন্দু|বৌদ্ধ|খ্রিস্ট/i.test(String(n));

    // Religion suppression (matches Merit List logic)
    const relResults = sortedArr.filter(r => isRelSubjLocal(r.subject?.name || r.subject_name));
    let suppressedIds = new Set();
    if (relResults.length > 1) {
        const withMarks = relResults.map(r => ({
            id: r.subject?.id || r.subject,
            total: (parseFloat(r.total_obtained) || (sumStrLocal(r.written_marks)||0) + (sumStrLocal(r.mcq_marks)||0) + (sumStrLocal(r.practical_marks)||0))
        })).filter(x => x.total > 0).sort((a, b) => b.total - a.total);

        if (withMarks.length > 0) {
            const bestRelId = withMarks[0].id;
            relResults.forEach(r => {
                const rid = r.subject?.id || r.subject;
                if (String(rid) !== String(bestRelId)) suppressedIds.add(String(rid));
            });
        } else {
            const islam = relResults.find(r => /islam|ইসলাম/i.test(r.subject?.name || r.subject_name));
            const primaryRel = islam || relResults[0];
            const pid = primaryRel.subject?.id || primaryRel.subject;
            relResults.forEach(r => {
                const rid = r.subject?.id || r.subject;
                if (String(rid) !== String(pid)) suppressedIds.add(String(rid));
            });
        }
    }

    // 1. Process existing results with robust normalization
    for (const r of sortedArr) {
      if (suppressedIds.has(String(r.subject?.id || r.subject))) continue;

      let subjName = r.subject?.name || r.subject_name;
      if (!subjName && r.examination?.name) {
         const exName = String(r.examination.name).toLowerCase();
         if (!/(অর্ধ|বার্ষিক|test|model|terminal|half|annual)/.test(exName)) {
             subjName = r.examination.name;
         }
      }

      // Use the robust local normalizer for grouping
      let nm = normalizeSubjKeyLocal(subjName);

      // If validSubjKeys provided, filter out subjects with NO marks in section
      if (validSubjKeys && !validSubjKeys.has(nm)) continue;

      // Distinguish papers for Bangla and English with robust detection
      if (nm === 'bangla' || nm === 'english') {
          const is2 = /(২য়|২য়|2nd|second|Paper 2| ii | ii$| 2)/i.test(subjName);
          const has1 = /(১ম|1st|first|Paper 1| i | i$| 1)/i.test(subjName);
          if (is2 && has1) nm = nm + '_combined';
          else if (is2) nm = nm + '_p2';
          else if (has1) nm = nm + '_p1';
          else nm = nm + '_combined';
      }

      // Skip redundant combined records if specific papers exist (Matches Merit List logic)
      const isCombined = !subjName.match(/(1st|2nd|১ম|২য়|২য়)/);
      const hasSpecificPapers = sortedArr.some(x => {
          const xName = String(x.subject?.name || x.subject_name || '').toLowerCase();
          return normalizeSubjKeyLocal(xName) === normalizeSubjKeyLocal(subjName) && xName.match(/(1st|2nd|১ম|২য়|২য়)/);
      });
      if (isClassNineOrTen && isCombined && hasSpecificPapers) continue;

      const isUnwanted = (name) => {
        const n = String(name || '').trim().toLowerCase();
        if (UNWANTED_SUBJECTS.some(u => n === u.toLowerCase())) return true;
        if (CO_CURRICULAR_SUBJECTS.some(sub => n.includes(sub.toLowerCase()))) return false;
        if (UNWANTED_KEYWORDS.some(u => n.includes(u.toLowerCase()))) return true;
        return false;
      };

      if (!nm || isUnwanted(subjName)) continue;

      const w = sumStrLocal(r.written_marks);
      const m = sumStrLocal(r.mcq_marks);
      const p = sumStrLocal(r.practical_marks);
      const obtained = ((w + m + p) > 0) ? (w + m + p) : (parseFloat(r.total_obtained) || 0);
      const totalMax = getTotalMaxForResult(r);

      let { grade, gpa } = (r.grade && r.gpa) ? { grade: r.grade, gpa: r.gpa } : calculateGradeAndGPA(obtained, totalMax);
      let passed = (r.is_passed !== undefined && r.is_passed !== null) ? r.is_passed : computeSubjectPass(r.subject?.name || r.subject_name || nm, w, m, p, exams, r.examination);

      let cleanName = r.subject?.name || r.subject_name || subjName;
      cleanName = cleanName.replace(/\s*\(.*?\)\s*/g, '').trim();

      const isActuallyAbsent = (r.written_marks === null || r.written_marks === '') && (r.mcq_marks === null || r.mcq_marks === '') && (r.practical_marks === null || r.practical_marks === '') && !(parseFloat(r.total_obtained) > 0);

      // Prefer the record that actually has marks (Deduplication refinement)
      const existing = map.get(nm);
      if (!existing || obtained > (existing.total_obtained || 0) || (!isActuallyAbsent && existing.isActuallyAbsent)) {
          map.set(nm, {
            ...r,
            written_marks: r.written_marks,
            mcq_marks: r.mcq_marks,
            practical_marks: r.practical_marks,
            total_obtained: obtained,
            total_marks: totalMax,
            grade,
            gpa,
            is_passed: passed,
            subject: { ...(r.subject || {}), name: cleanName },
            subject_name: cleanName,
            isActuallyAbsent: isActuallyAbsent
          });
      }
    }

    // 2. Fill missing expected subjects as "Absent"
    if (expectedKeys) {
        expectedKeys.forEach(key => {
            // Check directly against the normalized key in the map
            if (!map.has(key)) {
                // If validSubjKeys provided, don't fill missing subjects that have no marks for ANYONE
                if (validSubjKeys && !validSubjKeys.has(key)) return;

                // Special check for papers: if we expect 'bangla' but have papers, it's not missing
                if (key === 'bangla' || key === 'english') {
                    if (map.has(key + '_p1') || map.has(key + '_p2') || map.has(key + '_combined')) return;
                }
                const friendlyName = translateSubLocal(key);
                map.set(key, {
                    id: `missing-${key}`,
                    subject: { name: friendlyName },
                    subject_name: friendlyName,
                    written_marks: null,
                    mcq_marks: null,
                    practical_marks: null,
                    total_obtained: 0,
                    grade: 'F',
                    gpa: '0.00',
                    is_passed: false,
                    isActuallyAbsent: true,
                    total_marks: 100
                });
            }
        });
    }

    // 3. Fill missing assigned optional subject as "Absent"
    if (studentOptionalSubject) {
        const optName = String(studentOptionalSubject?.name || '').toLowerCase();
        const optKey = normalizeSubjKeyLocal(optName);
        if (optKey && !map.has(optKey)) {
            // Check section validity for optional as well
            if (validSubjKeys && !validSubjKeys.has(optKey)) return;

            const friendlyName = translateSubLocal(optKey);
            map.set(optKey, {
                id: `missing-opt-${optKey}`,
                subject: { ...(typeof studentOptionalSubject === 'object' ? studentOptionalSubject : {}), name: friendlyName },
                subject_name: friendlyName,
                written_marks: null,
                mcq_marks: null,
                practical_marks: null,
                total_obtained: 0,
                grade: 'F',
                gpa: '0.00',
                is_passed: false,
                isActuallyAbsent: true,
                total_marks: 100,
                is_optional: true // Hint for ResultCard
            });
        }
    }
    
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

  const handleSearch = async (examIdOverride = null, targetLang = null, yearOverride = null) => {
    if (loading) return; // Prevent double-triggering

    if (!selectedStudent || (!selectedExamType && !examIdOverride)) {
      toast.warning('Please select class, student, and exam type');
      return;
    }

    const effectiveYear = yearOverride || selectedYear;
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
        } else if (fallbackExams.length > 0) {
          // If still no match by name but we have exams for this class, just use the latest one
          matchingExams = [fallbackExams.sort((a, b) => new Date(b.exam_date || 0) - new Date(a.exam_date || 0))[0]];
        } else {
          // Fallback 2: derive exam from student's existing results
          try {
            const rs = await scopedGet('/api/results/results/', id, { student: student.id, page_size: 100 }, { timeout: 20000 });
            const arr = Array.isArray(rs.data) ? rs.data : (rs.data?.results || []);
            const examIds = Array.from(new Set(arr.map(r => (typeof r.examination === 'object' ? r.examination?.id : r.examination)).filter(Boolean)));
            if (examIds.length > 0) {
                const exRes = await api.get(`/api/results/examinations/${examIds[0]}/`, { params: { school: id } });
                if (exRes.data) matchingExams = [exRes.data];
            }
          } catch (_) {}
        }

        if (matchingExams.length === 0) {
          setStudentData(null);
          setResults([]);
          setOverallResult(null);
          setNoYearMessage(`দুঃখিত ${effectiveYear} সালের রেজাল্ট এই স্কুলে এখনও ইনপুট দেওয়া হয়নি, দয়া করে অত্র বিদ্যালয়ের প্রধান শিক্ষক অথবা এ্যাডমিনের সাথে যোগাযোগ করুন। ধন্যবাদ।`);
          toast.error(`দুঃখিত ${effectiveYear} সালের রেজাল্ট পাওয়া যায়নি`);
          setLoading(false);
          return;
        }
      }

      let chosenExam = null;
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

      const originalMatching = [...matchingExams];
      matchingExams = originalMatching.length ? originalMatching : (chosenExam ? [chosenExam] : []);
      
      let fetchedResults = [];
      
      try {
        const broadParams = { 
          student: student.id, 
          classroom: selectedClass, 
          year: effectiveYear,
          page_size: 1000
        };
        const broadRes = await scopedGet('/api/results/results/', id, broadParams, { timeout: 20000 });
        const broadArr = Array.isArray(broadRes.data) ? broadRes.data : (broadRes.data?.results || []);
        
        if (broadArr.length > 0) {
          fetchedResults = broadArr.filter(r => String(r.student?.id || r.student || '') === String(student.id));
        }
      } catch (err) {
        console.warn('Broad fetch failed', err);
      }

      if (fetchedResults.length === 0) {
        for (const ex of matchingExams) {
          try {
            const params = { examination: ex.id, student: student.id, page_size: 1000 };
            const resultsRes = await scopedGet('/api/results/results/', id, params, { timeout: 15000 });
            const arr = Array.isArray(resultsRes.data) ? resultsRes.data : (resultsRes.data?.results || []);
            if (arr.length) fetchedResults = fetchedResults.concat(arr);
          } catch (_) {}
        }
      }

      if (fetchedResults.length === 0) {
        try {
          const r = await scopedGet('/api/results/results/', id, { student: student.id, page_size: 2000 }, { timeout: 20000 });
          const arr = Array.isArray(r.data) ? r.data : (r.data?.results || r.data?.data || []);
          if (arr.length > 0) fetchedResults = arr;
        } catch (_) {}
      }

      // Fetch ALL Section Results to determine rank AND valid subjects (Performance Optimization)
      let sectionResults = [];
      let validSubjKeys = null;
      try {
          const sectionResultsRes = await scopedGet('/api/results/results/', id, {
              classroom: selectedClass,
              section: selectedSection,
              year: effectiveYear,
              page_size: 10000
          }, { timeout: 20000 });
          sectionResults = Array.isArray(sectionResultsRes.data) ? sectionResultsRes.data : (sectionResultsRes.data?.results || []);

          validSubjKeys = new Set();
          sectionResults.forEach(r => {
              const total = (parseFloat(r.total_obtained) || (sumStrLocal(r.written_marks)||0) + (sumStrLocal(r.mcq_marks)||0) + (sumStrLocal(r.practical_marks)||0));
              if (total > 0) {
                  validSubjKeys.add(normalizeSubjKeyLocal(r.subject?.name || r.subject_name));
              }
          });
      } catch (err) {
          console.warn('Failed to fetch section results', err);
      }
      
      if (fetchedResults.length > 0) {
        const subjectsWithPositiveData = new Set();
        fetchedResults.forEach(r => {
          const total = (parseFloat(r.total_obtained) || (sumStrLocal(r.written_marks)||0) + (sumStrLocal(r.mcq_marks)||0) + (sumStrLocal(r.practical_marks)||0));
          const hasInput = (r.written_marks !== null && r.written_marks !== '') || (r.mcq_marks !== null && r.mcq_marks !== '') || (r.practical_marks !== null && r.practical_marks !== '');
          if (hasInput && total > 0) {
            subjectsWithPositiveData.add(r.subject?.id || r.subject_id || r.subject_name);
          }
        });

        if (subjectsWithPositiveData.size < 3) {
          toast.warning('নূন্যতম ৩টি বিষয়ে প্রকৃত নম্বর (০ এর বেশি) না থাকায় রেজাল্ট কার্ড জেনারেট করা সম্ভব নয়।');
          setStudentData(null); setResults([]); setOverallResult(null); setLoading(false); return;
        }

        const classSubjs = new Set(fetchedResults.map(r => r.subject?.name || r.subject_name));
        const group = (student?.student_group || student?.group || '').toLowerCase();
        const expectedKeys = getExpectedSubjectsLocal(group, isClassNineOrTen, classSubjs);

        const merged = dedupeAndFillResults(fetchedResults, matchingExams, expectedKeys, student.optional_subject, validSubjKeys);
        setResults(merged);

        const usedExamIds = Array.from(new Set(merged.map(r => typeof r.examination === 'object' ? r.examination?.id : r.examination).filter(Boolean)));
        try {
          const usedExamObjs = await Promise.all(usedExamIds.map(eid => api.get(`/api/results/examinations/${eid}/`, { params: { school: id } }).then(r => r.data).catch(() => null)));
          const validUsed = usedExamObjs.filter(Boolean).sort((a, b) => new Date(b.exam_date || 0) - new Date(a.exam_date || 0));
          if (validUsed[0]) setExamination(validUsed[0]);
        } catch (_) {}
      } else {
        toast.warning('এই শিক্ষার্থীর কোনো রেজাল্ট পাওয়া যায়নি।');
        setStudentData(null); setResults([]); setOverallResult(null); setLoading(false); return;
      }

      let overall = null;
      try {
        const exId = chosenExam?.id || null;
        if (selectedExamType && selectedClass) {
          try {
            const combinedRes = await api.get('/api/results/overall/combined_by_exam_type/', {
              params: { student: student.id, exam_type: selectedExamType, classroom: selectedClass, section: selectedSection, year: selectedYear }
            });
            if (combinedRes.data && combinedRes.data.rank) {
              overall = {
                percentage: combinedRes.data.percentage, rank: combinedRes.data.rank, is_passed: combinedRes.data.is_passed,
                total_marks_obtained: combinedRes.data.total_marks_obtained, total_marks_possible: combinedRes.data.total_marks_possible,
                cgpa: combinedRes.data.cgpa, grade: combinedRes.data.grade
              };
            }
          } catch (_) {}
        }

        if (!overall && exId) {
          try {
            const res = await api.get('/api/results/overall/', { params: { student: student.id, examination: exId } });
            const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            if (list[0]) {
              overall = {
                percentage: list[0].percentage, rank: Number(list[0].rank || list[0].position || 0) || null,
                is_passed: list[0].is_passed, total_marks_obtained: list[0].total_marks_obtained,
                total_marks_possible: list[0].total_marks_possible, cgpa: list[0].cgpa, grade: list[0].grade
              };
            }
          } catch (_) {}
        }
      } catch (_) {}

      if (!overall && fetchedResults.length > 0) {
        const totalObtained = fetchedResults.reduce((sum, r) => sum + (parseFloat(r.total_obtained) || 0), 0);
        const totalPossible = fetchedResults.reduce((sum, r) => {
          const ex = r.examination || {};
          const rMax = parseFloat(r.total_marks);
          return sum + (rMax > 0 ? rMax : 100);
        }, 0);

        overall = {
          total_marks_obtained: totalObtained.toFixed(2),
          total_marks_possible: totalPossible.toFixed(2),
          percentage: (totalPossible > 0 ? (totalObtained / totalPossible * 100).toFixed(2) : 0),
          cgpa: "0.00", grade: 'F', is_passed: false, rank: null
        };
      }

      if (overall) {
          const newRank = await calculateStudentRank(student.id, sectionResults.length > 0 ? sectionResults : null);
          if (newRank) { overall.rank = newRank; overall.rank_in_section = newRank; }
      }

      setOverallResult(overall);

      if (targetLang === 'en') {
        setIsTranslating(true);
        try {
          const payload = {
            school_name: school?.name_en || school?.name,
            student_name: `${student.user?.first_name_en || student.user?.first_name || ''} ${student.user?.last_name_en || student.user?.last_name || ''}`.trim(),
            father_name: student.father_name_en || student.father_name,
            mother_name: student.mother_name_en || student.mother_name,
            guardian_name: student.guardian_name, address: student.address || school?.address,
            class_name: `${student.classroom?.name || ''} ${student.section?.name ? `(${student.section.name})` : ''}`,
            examination_name: `${examination?.academic_year || ''} ${examination?.name || ''}`.trim(),
            subjects: fetchedResults.map(r => r.subject?.name || r.subject_name)
          };
          const transRes = await api.post('/api/results/overall/translate_card/', payload);
          setTranslatedData(transRes.data);
        } catch (_) { toast.error('AI অনুবাদ ব্যর্থ হয়েছে'); } finally { setIsTranslating(false); }
      }

      try {
        const historyRes = await api.get('/api/academics/students/history/', { params: { school: id, year: selectedYear, student_id: student.id } });
        const records = Array.isArray(historyRes.data) ? historyRes.data : (historyRes.data?.results || []);
        const me = records.find(r => String(r.student?.id || r.student) === String(student.id));
        if (me && me.roll_number) setStudentData(prev => ({ ...prev, student: { ...prev.student, promoted_roll: me.roll_number } }));
      } catch (_) {}

      try {
        const attRes = await api.get('/api/attendance/summaries/', { params: { student: student.id, year: effectiveYear, school: id } });
        const summaries = Array.isArray(attRes.data) ? attRes.data : (attRes.data?.results || []);
        if (summaries && summaries[0]) setStudentData(prev => ({ ...prev, attendance_summary: summaries[0] }));
      } catch (_) {}

      toast.success('রেজাল্ট কার্ড জেনারেট হয়েছে');
    } catch (err) {
      console.error(err); toast.error('Failed to generate result card');
    } finally { setLoading(false); }
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

      const originalScrollY = window.scrollY;
      window.scrollTo(0, 0);

      const canvas = await html2canvas(cardEl, {
        scale: 4,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#fff4e5',
        onclone: (clonedDoc) => {
          const container = clonedDoc.querySelector('.result-card-container');
          if (container) {
             container.style.border = '2px solid #000';
             container.style.boxShadow = 'none';
          }
          const watermarks = clonedDoc.querySelectorAll('.result-card-container img');
          watermarks.forEach(img => { img.style.display = 'block'; });
        }
      });

      window.scrollTo(0, originalScrollY);

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pdfWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

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

  const buildCardForStudent = async (stuId, preFetchedStudent = null, preFetchedResults = null, preFetchedOverall = null, sectionSubjs = null, validSubjKeys = null) => {
    try {
      const student = preFetchedStudent || (await api.get(`/api/academics/students/${stuId}/`).then(r => r.data));
      const selType = normalizeExamType(selectedExamType);
      let matchingExams = examinations.filter(exam =>
        normalizeExamType(exam.exam_type, exam.name) === selType &&
        getClassroomId(exam.classroom) === selectedClass
      );

      let fetchedResults = preFetchedResults;
      if (!fetchedResults) {
        fetchedResults = [];
        for (const ex of matchingExams) {
          try {
            const params = { examination: ex.id, student: stuId, page_size: 1000 };
            const resultsRes = await scopedGet('/api/results/results/', id, params);
            const arr = Array.isArray(resultsRes.data) ? resultsRes.data : (resultsRes.data?.results || []);
            fetchedResults = fetchedResults.concat(arr);
          } catch (_) {}
        }
      }

      // Fill missing subjects for bulk cards
      const group = (student?.student_group || student?.group || '').toLowerCase();
      const expectedKeys = getExpectedSubjectsLocal(group, isClassNineOrTen, sectionSubjs);

      const merged = dedupeAndFillResults(fetchedResults, matchingExams, expectedKeys, student.optional_subject, validSubjKeys);
      let overall = preFetchedOverall;
      if (!overall && matchingExams[0]?.id) {
         try {
           const res = await api.get('/api/results/overall/', { params: { student: stuId, examination: matchingExams[0].id } });
           const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
           if (list[0]) {
             overall = {
               percentage: list[0].percentage, rank: Number(list[0].rank || 0), is_passed: list[0].is_passed,
               total_marks_obtained: list[0].total_marks_obtained, total_marks_possible: list[0].total_marks_possible,
               cgpa: list[0].cgpa, grade: list[0].grade
             };
           }
         } catch (_) {}
      }

      return { studentData: { student }, results: merged, overallResult: overall, examination: matchingExams[0] };
    } catch (_) { return null; }
  };

  const handleGenerateBulkCards = async (targetLang = 'en') => {
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
    setForceLanguage(targetLang);

    try {
      const sectionList = students.filter(s => {
        const secId = (typeof s.section === 'object') ? (s.section?.id ?? s.section?.section_id) : s.section_id;
        return String(secId || '') === String(selectedSection || '');
      });

      if (sectionList.length === 0) {
          toast.error('এই সেকশনে কোনো শিক্ষার্থী পাওয়া যায়নি');
          setBulkLoading(false);
          return;
      }

      // 1. Fetch EVERYTHING in bulk first - This is the KEY to speed
      const [rRes, oRes] = await Promise.all([
        scopedGet('/api/results/results/', id, { classroom: selectedClass, section: selectedSection, year: selectedYear, page_size: 10000 }),
        api.get('/api/results/overall/combined_rank_list_by_exam_type/', {
          params: { exam_type: selectedExamType, classroom: selectedClass, section: selectedSection, school: id, year: selectedYear, page_size: 2000 }
        }).catch(() => ({ data: [] }))
      ]);

      const rList = Array.isArray(rRes.data) ? rRes.data : (rRes.data?.results || []);
      const oList = Array.isArray(oRes.data) ? oRes.data : (oRes.data?.results || []);

      // Filter: Identify valid subjects (at least one student in section has marks > 0)
      const validSubjKeys = new Set();
      rList.forEach(r => {
          const w = parseFloat(r.written_marks) || 0, m = parseFloat(r.mcq_marks) || 0, p = parseFloat(r.practical_marks) || 0;
          const total = (parseFloat(r.total_obtained) || (w + m + p));
          if (total > 0) {
              validSubjKeys.add(normalizeSubjKeyLocal(r.subject?.name || r.subject_name));
          }
      });

      // Collect all unique subjects in this section to pass to builder
      const sectionSubjs = new Set(rList.map(r => r.subject?.name || r.subject_name));

      const resultsByStudent = {};
      rList.forEach(r => {
        const sid = r.student?.id ?? r.student_id ?? r.student;
        if (!resultsByStudent[sid]) resultsByStudent[sid] = [];
        resultsByStudent[sid].push(r);
      });

      const overallByStudent = {};

      // RE-CALCULATE ALL RANKS IN FRONTEND (Match Merit List Logic)
      const studentIds = Array.from(new Set(rList.map(r => String(r.student?.id ?? r.student_id ?? r.student ?? '')).filter(Boolean)));
      const resultsPool = [];
      const isNT = isClassNineOrTen;

      // Sort all results by ID once to ensure consistent deduplication
      const rListSorted = [...rList].sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));

      const classSubjects = new Set();
      rListSorted.forEach(r => {
          const sn = String(r.subject?.name || r.subject_name || '').toLowerCase();
          if (!/শারীরিক|বই\s*পড়া|achievement|continuous|wcat|শারিরীক/i.test(sn)) classSubjects.add(sn);
      });

      const isRelSubjLocal = (n) => /religion|islam|hindu|buddhist|christian|ধর্ম|ইসলাম|হিন্দু|বৌদ্ধ|খ্রিস্ট/i.test(String(n));

      for (const sid of studentIds) {
          const stuResults = rListSorted.filter(r => String(r.student?.id || r.student) === sid);
          if (stuResults.length === 0) continue;
          const student = stuResults[0].student;

          const relResults = stuResults.filter(r => isRelSubjLocal(r.subject?.name || r.subject_name));
          let suppressedIds = new Set();
          if (relResults.length > 1) {
              const withMarks = relResults.map(r => ({
                  id: r.subject?.id || r.subject,
                  total: (parseFloat(r.total_obtained) || (sumStrLocal(r.written_marks)||0) + (sumStrLocal(r.mcq_marks)||0) + (sumStrLocal(r.practical_marks)||0))
              })).filter(x => x.total > 0).sort((a, b) => b.total - a.total);

              if (withMarks.length > 0) {
                  const bestRelId = withMarks[0].id;
                  relResults.forEach(r => { if (String(r.subject?.id || r.subject) !== String(bestRelId)) suppressedIds.add(String(r.subject?.id || r.subject)); });
              } else {
                  const islam = relResults.find(r => /islam|ইসলাম/i.test(r.subject?.name || r.subject_name));
                  const primaryRel = islam || relResults[0];
                  const pid = primaryRel.subject?.id || primaryRel.subject;
                  relResults.forEach(r => { if (String(r.subject?.id || r.subject) !== String(pid)) suppressedIds.add(String(r.subject?.id || r.subject)); });
              }
          }

          const subjectMap = new Map();
          stuResults.forEach(r => {
              if (suppressedIds.has(String(r.subject?.id || r.subject))) return;
              const rawName = String(r.subject?.name || r.subject_name).toLowerCase().trim();
              let normKey = normalizeSubjKeyLocal(rawName);
              let key = normKey;

              // Distinguish papers to prevent overwriting
              const is2 = /(২য়|২য়|2nd|second|Paper 2| ii | ii$| 2)/i.test(rawName);
              const has1 = /(১ম|1st|first|Paper 1| i | i$| 1)/i.test(rawName);
              if (is2) key = normKey + '_p2';
              else if (has1) key = normKey + '_p1';

              const w = sumStrLocal(r.written_marks), m = sumStrLocal(r.mcq_marks), p = sumStrLocal(r.practical_marks);
              const rTotal = (w + m + p) > 0 ? (w + m + p) : (parseFloat(r.total_obtained) || 0);
              const hasInput = (r.written_marks !== '' && r.written_marks !== null) || (r.mcq_marks !== '' && r.mcq_marks !== null) || (r.practical_marks !== '' && r.practical_marks !== null) || (parseFloat(r.total_obtained) > 0);

              // Prefer record with marks (Deduplication refinement)
              const existing = subjectMap.get(key);
              if (!existing || hasInput || !existing.hasMarks) {
                  subjectMap.set(key, { ...r, sumW: w, sumM: m, sumP: p, hasMarks: hasInput, total_obtained: rTotal });
              }
          });

          const virtualMap = new Map();
          Array.from(subjectMap.values()).forEach(r => {
              const nm = String(r.subject?.name || r.subject_name || '').toLowerCase();
              let key = normalizeSubjKeyLocal(nm);
              if (isNT && (key === 'bangla' || key === 'english')) { } else if (key === 'bangla' || key === 'english') {
                  const is2 = nm.includes('2nd') || nm.includes('২য়') || nm.includes('২য়') || nm.includes('second');
                  const has1 = nm.includes('1st') || nm.includes('১ম') || nm.includes('first') || nm.includes('পত্র') || nm.includes('paper');
                  if (is2 || has1) { key = key + (is2 ? '_p2' : '_p1'); }
              }
              if (!virtualMap.has(key)) virtualMap.set(key, []);
              virtualMap.get(key).push(r);
          });

          const group = (student?.student_group || student?.group || inferGroupLocal(Array.from(subjectMap.values()), isNT)).toLowerCase();
          const expectedKeys = getExpectedSubjectsLocal(group, isNT, classSubjects);
          const takenRelId = Array.from(subjectMap.values()).find(r => isRelSubjLocal(r.subject?.name || r.subject_name) && (parseFloat(r.total_obtained) > 0))?.subject?.id;

          let score = 0, fails = 0, hasAnyMarks = false, totalPoints = 0, subjectCount = 0;
          const hmList = Array.from(subjectMap.values()).filter(r => /higher|উচ্চতর/.test(String(r.subject?.name || r.subject_name).toLowerCase()));
          const agriList = Array.from(subjectMap.values()).filter(r => /agriculture|home|কৃষি|গার্হস্থ্য/.test(String(r.subject?.name || r.subject_name).toLowerCase()));

          const assignedOpt = student?.optional_subject;
          const assignedOptId = String(assignedOpt?.id || assignedOpt || '');
          const assignedOptName = String(assignedOpt?.name || '').toLowerCase();

          let showHM = false, showAgri = false;
          const hasHM = hmList.some(r => (parseFloat(r.total_obtained) || 0) > 0);
          const hasAgri = agriList.some(r => (parseFloat(r.total_obtained) || 0) > 0);

          if (assignedOptId || assignedOptName) {
              const isHMAssigned = (assignedOptId && hmList.some(r => String(r.subject?.id || r.subject) === assignedOptId)) || (assignedOptName && assignedOptName.includes('higher'));
              const isAgriAssigned = (assignedOptId && agriList.some(r => String(r.subject?.id || r.subject) === assignedOptId)) || (assignedOptName && (assignedOptName.includes('agri') || assignedOptName.includes('কৃষি')));

              if (isHMAssigned && hasHM) showHM = true;
              else if (isAgriAssigned && hasAgri) showAgri = true;
              else {
                  const hmTotal = hmList.reduce((s, r) => s + (parseFloat(r.total_obtained)||0), 0);
                  const agriTotal = agriList.reduce((s, r) => s + (parseFloat(r.total_obtained)||0), 0);
                  showHM = isNT && (hmTotal >= agriTotal && hmTotal > 0);
                  showAgri = isNT && (agriTotal > hmTotal && agriTotal > 0);
              }
          } else {
              const hmTotal = hmList.reduce((s, r) => s + (parseFloat(r.total_obtained)||0), 0);
              const agriTotal = agriList.reduce((s, r) => s + (parseFloat(r.total_obtained)||0), 0);
              showHM = isNT && (hmTotal >= agriTotal && hmTotal > 0);
              showAgri = isNT && (agriTotal > hmTotal && agriTotal > 0);
          }

          const allKeys = new Set([...expectedKeys, 'higher', 'agriculture', 'civics', 'economics', 'accounting', 'finance', 'business']);

          // Track if we've counted an elective for the group
          let electiveCounted = false;

          allKeys.forEach(key => {
              const papers = virtualMap.get(key) || [];
              const isRel = isRelSubjLocal(key);
              let isMandatory = expectedKeys.has(key);

              // Group Pools for automatic inclusion
              const sciPool = ['physics', 'chemistry', 'biology'];
              const comPool = ['accounting', 'finance', 'business'];
              const humPool = ['history', 'geography', 'civics', 'economics'];
              const belongsToGroup = (isScienceGroupLocal(group) && sciPool.includes(key)) ||
                                     (isCommerceGroupLocal(group) && comPool.includes(key)) ||
                                     (isHumanitiesGroupLocal(group) && humPool.includes(key));

              // Elective logic for Humanities (Civics/Economics)
              if (isNT && isHumanitiesGroupLocal(group)) {
                  if (key === 'civics' || key === 'economics') {
                      if (papers.length > 0 && !electiveCounted) { isMandatory = true; electiveCounted = true; }
                      else if (key === 'civics' && !electiveCounted && !virtualMap.has('economics')) { isMandatory = true; electiveCounted = true; }
                  }
              }

              if (isMandatory || belongsToGroup) {
                  if (!isRel || (isRel && !takenRelId) || (isRel && papers.length > 0)) {
                       subjectCount++;
                  }
              }

              if (papers.length === 0) {
                  if (isMandatory) {
                      if (isRel && takenRelId) return;
                      if (isNT) {
                          if (isScienceGroupLocal(group)) {
                              if (key === 'science') return;
                          } else {
                              if (key === 'bgs' || key === 'physics' || key === 'chemistry' || key === 'biology') return;
                          }
                          if (['civics', 'economics', 'accounting', 'finance', 'business'].includes(key)) return;
                      }
                      if (!isNT && (key === 'bangla' || key === 'english')) { if (virtualMap.has(key + '_p1') || virtualMap.has(key + '_p2')) return; }
                      if (stuResults.length > 0) fails++;
                  }
                  return;
              }
              let totalW = 0, totalM = 0, totalP = 0, totalMarks = 0, totalPossible = 0, cqM = 0, mcqM = 0, prM = 0;
              let isAnyPaperPresent = false;
              papers.forEach(r => {
                  if (r.hasMarks) { hasAnyMarks = true; isAnyPaperPresent = true; }
                  const w = r.sumW, m = r.sumM, pr = r.sumP;
                  const spec = getSubjectMaxima(r.subject?.name || r.subject_name, isNT);
                  totalW += w; totalM += m; totalP += pr; totalMarks += (w + m + pr) > 0 ? (w + m + pr) : (parseFloat(r.total_obtained) || 0);
                  totalPossible += (spec.cq + spec.mcq + spec.pr || 100);
                  cqM += spec.cq; mcqM += spec.mcq; prM += spec.pr;
              });
              if (isNT && (key === 'bangla' || key === 'english')) {
                  totalPossible = Math.max(totalPossible, 200);
                  if (totalMarks > 200) totalMarks = 200;
              }
              const cqPass = cqM === 0 || totalW >= Math.round(cqM * 0.33 - 0.5),
                    mcqPass = mcqM === 0 || totalM >= Math.round(mcqM * 0.33 - 0.5),
                    prPass = prM === 0 || totalP >= Math.round(prM * 0.33 - 0.5),
                    totPass = totalMarks >= Math.round(totalPossible * 0.33 - 0.5);
              let isSubjectPassed = isAnyPaperPresent && (isNT ? (cqPass && mcqPass && prPass && totPass) : totPass);
              const gp = isSubjectPassed ? computeGpa((totalMarks / totalPossible) * 100) : 0;
              if ((key === 'higher' && showHM) || (key === 'agriculture' && showAgri)) {
                  if (totalMarks > (totalPossible * 0.4)) { score += (totalMarks - (totalPossible * 0.4)); }
                  totalPoints += Math.max(0, gp - 2.0);
              } else if (isMandatory || belongsToGroup || (!isNT && (key==='higher'||key==='agriculture'))) {
                  if (!isNT && (key==='higher'||key==='agriculture')) return;
                  if (isNT && (key === 'bgs' || key === 'science') && !isScienceGroupLocal(group)) { if (!isAnyPaperPresent) return; }
                  if (isRel && takenRelId && !papers.some(r => String(r.subject?.id) === String(takenRelId))) return;
                  score += totalMarks; totalPoints += gp;
                  if (isMandatory && (!isAnyPaperPresent || !isSubjectPassed)) fails++;
              } else { if (!isNT) score += totalMarks; }
          });
          if (!hasAnyMarks) fails = 999;
          const finalCgpa = (subjectCount > 0 && fails === 0) ? Math.min(5.0, totalPoints / subjectCount) : 0;
          resultsPool.push({ sid, total: Math.round(score), rawScore: score, points: finalCgpa, fails, isAbsent: !hasAnyMarks, roll: student?.roll_number ? parseInt(String(student.roll_number).replace(/\D/g, ''), 10) : 999999, section_id: String(student?.section?.id || student?.section || 'other') });
      }

      const finalRankMap = {};
      const bySec = new Map();
      resultsPool.forEach(item => { const sId = selectedSection ? 'single' : (item.section_id || 'other'); if (!bySec.has(sId)) bySec.set(sId, []); bySec.get(sId).push(item); });
      for (const sectionItems of bySec.values()) {
          sectionItems.sort((a, b) => {
              if (a.isAbsent !== b.isAbsent) return a.isAbsent ? 1 : -1;
              // Strict Priority: 1. Fewer Fails, 2. Higher GPA (points), 3. Higher Total Marks (rawScore)
              return (a.fails - b.fails) || (b.points - a.points) || (b.rawScore - a.rawScore) || (a.roll - b.roll);
          });
          let lastR = 0, lastV = null;
          sectionItems.forEach((c, idx) => {
              if (c.isAbsent) { finalRankMap[c.sid] = null; } else {
                  const curV = `${c.fails}-${c.points.toFixed(2)}-${c.rawScore.toFixed(2)}`;
                  if (curV !== lastV) { lastR = idx + 1; lastV = curV; }
                  finalRankMap[c.sid] = lastR;
              }
          });
      }

      // Apply to overall results
      oList.forEach(o => {
        const sid = o.student?.id ?? o.student_id ?? o.student;
        const newRank = finalRankMap[sid] || Number(o.rank || 0);
        overallByStudent[sid] = {
          percentage: o.percentage, rank: newRank, rank_in_section: newRank, is_passed: o.is_passed,
          total_marks_obtained: o.total_marks_obtained, total_marks_possible: o.total_marks_possible,
          cgpa: o.cgpa, grade: o.grade
        };
      });

      const selType = normalizeExamType(selectedExamType);
      const matchingExams = examinations.filter(exam =>
        normalizeExamType(exam.exam_type, exam.name) === selType &&
        getClassroomId(exam.classroom) === selectedClass
      );

      // 2. Fast synchronous generation
      const allGeneratedCards = [];
      // 3. Fast generation
      for (let i = 0; i < sectionList.length; i++) {
        const s = sectionList[i];
        const stuResults = resultsByStudent[s.id] || [];

        // Skip if fewer than 3 subjects with positive marks (>0)
        const subjectsWithPositiveData = new Set();
        stuResults.forEach(r => {
          const total = (parseFloat(r.total_obtained) || (parseFloat(r.written_marks)||0) + (parseFloat(r.mcq_marks)||0) + (parseFloat(r.practical_marks)||0));
          const hasInput = (r.written_marks !== null && r.written_marks !== '') ||
                           (r.mcq_marks !== null && r.mcq_marks !== '') ||
                           (r.practical_marks !== null && r.practical_marks !== '');
          if (hasInput && total > 0) {
            subjectsWithPositiveData.add(r.subject?.id || r.subject_id || r.subject_name);
          }
        });
        if (subjectsWithPositiveData.size < 3) continue;

        const card = await buildCardForStudent(s.id, s, resultsByStudent[s.id], overallByStudent[s.id], sectionSubjs, validSubjKeys);
        if (card) {
          allGeneratedCards.push(card);
          // Batch update every student to keep it sequential but responsive
          setBulkCards([...allGeneratedCards]);
          // Short delay for stability
          await new Promise(r => setTimeout(r, 10));
        }
      }

      toast.success('সব কার্ড জেনারেট সম্পন্ন');

      // Automatically trigger print if requested
      if (allGeneratedCards.length > 0) {
        setTimeout(() => {
          handleBulkPrint();
        }, 500);
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

    toast.info('প্রিন্ট ডায়ালগ খুলছে...');

    // Ensure all cards are visible in the DOM before printing
    document.body.classList.add('bulk-print-active');

    // Faster response
    setTimeout(() => {
      window.print();
      // We don't remove the class immediately to avoid layout shifts if the user cancels
      setTimeout(() => {
        document.body.classList.remove('bulk-print-active');
      }, 1000);
    }, 100);
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
          scale: 3,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#fff4e5',
          onclone: (clonedDoc) => {
            const container = clonedDoc.querySelectorAll('.result-card-container')[i];
            if (container) {
               container.style.border = '2px solid #000';
            }
          }
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
    setForceLanguage('en');
    setTranslatedData(null);
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
    <Box sx={{ p: 3, '@media print': { p: 0, m: 0 } }}>
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
            onClick={() => {
              if (selectedStudent) handleSearch(null, 'bn');
              else handleGenerateBulkCards('bn');
            }}
            disabled={loading || bulkLoading || (!selectedStudent && !selectedSection) || !selectedExamType}
            color="primary"
          >
            {loading && !forceLanguage ? 'তৈরি হচ্ছে...' : 'বাংলায় মার্কশীট তৈরি করুন'}
          </Button>

          <Button
            variant="contained"
            startIcon={<AssessmentIcon />}
            onClick={() => {
              if (selectedStudent) handleSearch(null, 'en');
              else handleGenerateBulkCards('en');
            }}
            disabled={loading || bulkLoading || (!selectedStudent && !selectedSection) || !selectedExamType}
            sx={{ bgcolor: '#1a237e', '&:hover': { bgcolor: '#0d1642' } }}
          >
            {isTranslating ? 'AI অনুবাদ হচ্ছে...' : 'ইংরেজিতে মার্কশীট তৈরি করুন'}
          </Button>

          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={() => handleGenerateBulkCards('en')}
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

      <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }} open={loading || bulkLoading || isTranslating}>
        <CircularProgress color="inherit" />
      </Backdrop>

      {/* Result Card Display */}
      <Box className="result-display-area" sx={{ minHeight: '600px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {studentData && (
          <Box className="single-card-view">
            {layout === 'ssc' ? (
              <SSCMarksheet
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
                      school={translatedData ? { ...school, name: translatedData.school_name, address: translatedData.address } : (school || {})}
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
            @page {
              size: A4 portrait;
              margin: 0 !important;
            }

            .no-print, header, footer, nav, aside, .MuiAppBar-root, .MuiDrawer-root, .MuiToolbar-root, .MuiSnackbar-root, .MuiAlert-root, .MuiTabs-root, .MuiBackdrop-root {
              display: none !important;
            }

            body, html {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            #root, main, .result-display-area, .bulk-print-mode {
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
            }

            .single-card-view {
              display: block !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              height: auto !important;
              page-break-inside: avoid !important;
              break-inside: avoid-page !important;
              position: relative !important;
              overflow: visible !important;
            }

            .bulk-sheet, .bulk-card-wrap {
              display: block !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              height: calc(280mm - 5px) !important;
              max-height: calc(280mm - 5px) !important;
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid-page !important;
              position: relative !important;
              overflow: hidden !important;
              box-sizing: border-box !important;
            }

            .result-card-container {
              box-shadow: none !important;
              filter: none !important;
              outline: none !important;
              margin: 0 auto !important;
              width: calc(200mm + 55px) !important;
              height: calc(280mm - 5px) !important;
              display: block !important;
              position: relative !important;
              overflow: hidden !important;
              page-break-inside: avoid !important;
              break-inside: avoid-page !important;
              box-sizing: border-box !important;
              visibility: visible !important;
            }

            .result-card-signatures {
              position: absolute !important;
              left: 0 !important;
              right: 0 !important;
              bottom: 15mm !important;
              page-break-inside: avoid !important;
              break-inside: avoid-page !important;
              break-before: avoid-page !important;
            }

            .result-card-main-content {
              page-break-inside: auto !important;
              break-inside: auto !important;
              break-after: avoid-page !important;
              padding-bottom: 34mm !important;
            }

            .result-card-main-content table {
              page-break-inside: auto !important;
              break-inside: auto !important;
            }

            .result-card-main-content tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }

            .extra-border-side,
            .extra-border-topbottom {
              display: none !important;
              visibility: hidden !important;
            }

            * {
              box-shadow: none !important;
              filter: none !important;
            }
          }
        `}
      </style>
    </Box>
  );
}
