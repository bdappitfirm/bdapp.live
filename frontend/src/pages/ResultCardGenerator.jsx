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
  Alert,
  CircularProgress,
  Backdrop
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import AcademicTranscriptCard from '../components/AcademicTranscriptCard';
import SSCMarksheet from '../components/SSCMarksheet';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { scopedGet } from '../utils/schoolApi';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const cleanAndDeduplicateName = (fullName) => {
  if (!fullName) return "N/A";
  const words = String(fullName).split(/\s+/).filter(Boolean);
  const uniqueWords = [];
  const seen = new Set();
  for (const w of words) {
    const cleanW = w.replace(/[^a-zA-Z0-9\u0980-\u09FF]/g, '');
    const lower = cleanW.toLowerCase();
    const isDuplicate = Array.from(seen).some(seenW => {
      return seenW === lower ||
             (seenW.length > 3 && lower.length > 3 && (seenW.includes(lower) || lower.includes(seenW) || seenW.slice(0, 4) === lower.slice(0, 4)));
    });
    if (!isDuplicate && lower.length > 0) {
      seen.add(lower);
      uniqueWords.push(w);
    }
  }
  return uniqueWords.join(' ');
};

const isRelSubjLocal = (subjName) => /religion|islam|hindu|buddhist|christian|ধর্ম|ইসলাম|হিন্দু|বৌদ্ধ|খ্রিস্ট/i.test(String(subjName));

const BN_2ND_REGEX = /(২য়|২য়|2nd|second|দ্বিতীয়|দ্বিতীয়|\bii\b| 2)/i;

const sumStr = (s) => String(s || '').split('+').reduce((acc, v) => acc + (parseFloat(v) || 0), 0);

const isCoCurricularLocal = (name, isClassNineOrTen) => {
  const subjLower = String(name || '').toLowerCase();
  const keywords = [
    'শারীরিক', 'বই পড়া', 'achievement', 'continuous', 'wcat', 'শারিরীক',
    'ক্যারিয়ার', 'ক্যারিয়ার', 'career', 'চারু', 'কারুকলা', 'arts', 'crafts',
    'life and work', 'জীবনমুখী', 'কর্ম', 'word collection', 'ওয়ার্ড কালেকশন'
  ];
  return keywords.some(kw => subjLower.includes(kw));
};

const SCI_KW = /physics|chemistry|biology|higher math|পদার্থ|রসায়ন|জীব|উচ্চতর/i;
const COM_KW = /accounting|finance|entrepreneurship|business|ব্যবসায়|ব্যবসায়|ব্যবসা|হিসাব|ফিন্যান্স/i;
const HUM_KW = /history|geography|civics|economics|ইতিহাস|ভূগোল|ভুগোল|পৌরনীতি|পৌরণীতি|অর্থনীতি/i;

const classifyPart = (part) => {
  const s = String(part || '').trim();
  if (!s) return null;
  if (SCI_KW.test(s)) return 'science';
  if (COM_KW.test(s)) return 'commerce';
  if (HUM_KW.test(s)) return 'humanities';
  return null;
};

const resolveGroupStr = (g) => {
  const s = String(g || '').toLowerCase();
  if (s.includes('science') || s.includes('বিজ্ঞান')) return 'science';
  if (s.includes('commerce') || s.includes('business') || s.includes('ব্যবসায়') || s.includes('ব্যবসায়') || s.includes('ব্যবসা')) return 'commerce';
  if (s.includes('arts') || s.includes('humanities') || s.includes('মানবিক')) return 'humanities';
  return '';
};

const getEffectiveSubjectForGroup = (subjectName, group) => {
  const name = String(subjectName || '').trim();
  if (!name || !name.includes('/')) return name;
  const g = resolveGroupStr(group);
  const parts = name.split(/\s*\/\s*/).filter(Boolean);
  if (!g) return parts[0] || name;
  for (const p of parts) {
    if (classifyPart(p) === g) return p;
  }
  return parts[0] || name;
};

const normalizeSubjKeyLocal = (n) => {
    const low = String(n).toLowerCase().trim();

    if (low.includes('higher') || low.includes('উচ্চতর')) return 'higher';
    if (low.includes('math') || low.includes('গণিত')) return 'math';
    if (low.includes('history') || low.includes('ইতিহাস') || low.includes('সভ্যতা')) return 'history';

    // Combined Science & BGS check
    if (low.includes('/') && (low.includes('science') || low.includes('বিজ্ঞান')) && (low.includes('bgs') || low.includes('বাংলাদেশ') || low.includes('বিজিএস'))) {
        return 'science_bgs';
    }

    if (low.includes('bgs') || (low.includes('বাংলাদেশ') && (low.includes('পরিচয়') || low.includes('পরিচয়') || low.includes('বিজিএস'))) || (low.includes('বাঃ') && low.includes('পরিচয়')) || low.includes('global studies')) return 'bgs';

    if ((low.includes('bangla') || low.includes('বাংলা')) && !low.includes('বাংলাদেশ') && !low.includes('bangladesh')) return 'bangla';
    if (low.includes('english') || low.includes('ইংরেজি') || low.includes('ইংরেজী')) return 'english';

    if (low.includes('religion') || low.includes('islam') || low.includes('hindu') || low.includes('ধর্ম') || low.includes('ইসলাম') || low.includes('হিন্দু') || low.includes('moral') || low.includes('নৈতিক')) return 'religion';
    if (low.includes('ict') || low.includes('তথ্য') || low.includes('information') || low.includes('communication') || low.includes('technology')) return 'ict';
    if (low.includes('physics') || low.includes('পদার্থ')) return 'physics';
    if (low.includes('chemistry') || low.includes('রসায়ন') || low.includes('রসায়ন')) return 'chemistry';
    if (low.includes('biology') || low.includes('জীব')) return 'biology';
    if (low.includes('agriculture') || low.includes('কৃষি') || low.includes('home') || low.includes('গার্হস্থ্য')) return 'agriculture';
    if (low.includes('accounting') || low.includes('হিসাব')) return 'accounting';
    if (low.includes('finance') || low.includes('ফিন্যান্স')) return 'finance';
    if (low.includes('business') || low.includes('ব্যবসায়') || low.includes('ব্যবসায়') || low.includes('entrepreneurship') || low.includes('উদ্যোগ')) return 'business';
    if (low.includes('geography') || low.includes('ভূগোল') || low.includes('ভুগোল')) return 'geography';
    if (low.includes('civics') || low.includes('পৌরনীতি') || low.includes('পৌরণীতি')) return 'civics';
    if (low.includes('economics') || low.includes('অর্থনীতি')) return 'economics';
    if ((low.includes('science') || low.includes('বিজ্ঞান')) && !low.includes('social') && !low.includes('সমাজ')) return 'science';

    return low;
};

const inferGroupLocal = (resList, isNT, student = null) => {
    if (!isNT || !resList || resList.length === 0) return '';
    const profileGroup = resolveGroupStr(
        (student && (student.student_group || student.group)) || ''
    );
    if (profileGroup) return profileGroup;

    const countPerGroup = { science: 0, commerce: 0, humanities: 0 };
    resList.forEach(r => {
        const hasMarks = (parseFloat(r.written_marks) > 0 || parseFloat(r.mcq_marks) > 0 || parseFloat(r.practical_marks) > 0 || (parseFloat(r.total_obtained) > 0));
        if (!hasMarks) return;
        const rawName = String(r.subject?.name || r.subject_name || '');
        const parts = rawName.includes('/')
            ? rawName.split(/\s*\/\s*/).filter(Boolean)
            : [rawName];
        const seen = new Set();
        parts.forEach(pt => {
            const c = classifyPart(pt);
            if (c && !seen.has(c)) { countPerGroup[c] += 1; seen.add(c); }
        });
    });
    const sciCount = countPerGroup.science;
    const comCount = countPerGroup.commerce;
    const humCount = countPerGroup.humanities;

    const takesGeneralScience = resList.some(r => {
        const name = (r.subject?.name || r.subject_name || '').toLowerCase();
        const hasMarks = (parseFloat(r.written_marks) > 0 || parseFloat(r.mcq_marks) > 0 || (parseFloat(r.total_obtained) > 0));
        return hasMarks && (name === 'science' || name === 'বিজ্ঞান' || name === 'general science' || name === 'সাধারণ বিজ্ঞান');
    });

    if (takesGeneralScience && sciCount < 2) {
        if (comCount > humCount) return 'commerce';
        return 'humanities';
    }

    if (comCount > 0) return 'commerce';
    if (humCount > 0) return 'humanities';
    if (sciCount > 0) return 'science';
    return '';
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

const getSubjectMaxima = (name, isClassNineOrTen, group = '') => {
  const effectiveName = getEffectiveSubjectForGroup(name, group);
  const lower = String(effectiveName || '').toLowerCase();

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
  const isCA = lower.includes('শারীরিক') || lower.includes('physical') || lower.includes('career') || lower.includes('ক্যারিয়ার') || lower.includes('ক্যারিয়ার') || lower.includes('word') || lower.includes('book') || lower.includes('পড়া') || lower.includes('পড়া') || lower.includes('achievement');

  if (isClassNineOrTen) {
    if (isPracticalScience || isAgriHome) return { cq: 50, mcq: 25, pr: 25 };
    if (isCA) return { cq: 0, mcq: 0, pr: 100 };
    if (lower.includes('বাংলা') || lower.includes('bangla')) return { cq: 70, mcq: 30, pr: 0 };
  } else {
    if (isPracticalScience) return { cq: 50, mcq: 25, pr: 25 };
    if (isAgriHome) return { cq: 35, mcq: 15, pr: 0 };
    if (isCA) return { cq: 0, mcq: 0, pr: 50 };
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

// SAFE GPA grouping helper. Only groups Bangla/English when BOTH 1st and 2nd paper patterns exist.
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





const isScienceGroupLocal = (g) => { const l = String(g || '').toLowerCase(); return l.includes('science') || l.includes('বিজ্ঞান'); };
const isCommerceGroupLocal = (g) => { const l = String(g || '').toLowerCase(); return l.includes('commerce') || l.includes('business') || l.includes('ব্যবসায়') || l.includes('ব্যবসায়'); };
const isHumanitiesGroupLocal = (g) => { const l = String(g || '').toLowerCase(); return l.includes('arts') || l.includes('humanities') || l.includes('মানবিক'); };

const inferClassGroupFromAllResultsLocal = (allRes, isNT, subjectsList = []) => {
    if (!isNT || !allRes || allRes.length === 0) return '';
    let com = 0, hum = 0, sci = 0;
    allRes.forEach(r => {
        let name = String(r.subject_name || r.subject?.name || r.subject_detail?.name || '').toLowerCase();
        if (!name && (r.subject != null || r.subject_id != null)) {
            const sid = String(r.subject?.id || r.subject || r.subject_id || '');
            const found = subjectsList.find(s => String(s.id) === sid);
            if (found) name = found.name.toLowerCase();
        }
        const hasMarks = (parseFloat(r.written_marks) > 0 || parseFloat(r.mcq_marks) > 0 || parseFloat(r.practical_marks) > 0 || parseFloat(r.total_obtained) > 0);
        if (!hasMarks) return;
        if (/accounting|finance|entrepreneurship|business|ব্যবসায়|হিসাব|ফিন্যান্স|ব্যবসায়/i.test(name)) com++;
        else if (/history|geography|civics|economics|ইতিহাস|ভূগোল|পৌরনীতি|অর্থনীতি/i.test(name)) hum++;
        else if (/physics|chemistry|biology|পদার্থ|রসায়ন|রসায়ন|জীব/i.test(name)) sci++;
    });
    if (com > sci && com >= hum && com > 0) return 'commerce';
    if (hum > sci && hum >= com && hum > 0) return 'humanities';
    if (sci > com && sci > hum && sci > 0) return 'science';
    return '';
};

const getStudentAcademicGroup = (stu, stuData, fetchedRes = []) => {
    const clsSources = [stu?.classroom?.name, stu?.classroom_name, stuData?.classroom?.name, stuData?.classroom_name, stuData?.student?.classroom?.name].filter(Boolean).map(s => String(s).toLowerCase());
    if (/play|shishu|nursery|প্লে|শিশু|প্রথম|১ম|\bone\b|\b1\b|দ্বিতীয়|২য়|\btwo\b|\b2\b|তৃতীয়|৩য়|\bthree\b|\b3\b|চতুর্থ|৪র্থ|\bfour\b|\b4\b|পঞ্চম|৫ম|\bfive\b|\b5\b|class\s*[1-5]/i.test(clsSources.join(' '))) return 'primary';
    const raw = String(stu?.student_group || stu?.group || stuData?.group || stuData?.student_group || '').toLowerCase();
    if (raw.includes('science') || raw.includes('বিজ্ঞান')) return 'science';
    if (raw.includes('commerce') || raw.includes('business') || raw.includes('ব্যবসায়') || raw.includes('ব্যবসায়')) return 'commerce';
    if (raw.includes('arts') || raw.includes('humanities') || raw.includes('মানবিক')) return 'humanities';

    const secName = String(stu?.section?.name || stuData?.section?.name || '').toLowerCase();
    if (secName.includes('science') || secName.includes('বিজ্ঞান')) return 'science';
    if (secName.includes('commerce') || secName.includes('business') || secName.includes('ব্যবসায়') || secName.includes('ব্যবসায়')) return 'commerce';
    if (secName.includes('arts') || secName.includes('humanities') || secName.includes('মানবিক')) return 'humanities';

    return inferClassGroupFromAllResultsLocal(fetchedRes, true, []);
};

const getExpectedSubjectsLocal = (studentGroup, isNT, classSubjs, classAssignedSubjs) => {
    // Only subjects that ACTUALLY EXIST for this class count as "expected", i.e. the subjects the
    // class teaches (classAssignedSubjs) plus whatever subjects already have results (classSubjs).
    // The old code force-added bangla/english/math/religion/science/bgs to EVERY class, so a
    // Shishu class - which teaches আরবি instead of ধর্ম and has no Science/BGS - got phantom rows
    // printed as "Absent / F" and every student came out as "Result: Failed".
    const normKeys = new Set();
    const addAll = (src) => {
        (src ? Array.from(src) : []).forEach(n => {
            const k = normalizeSubjKeyLocal(n);
            if (k) normKeys.add(k);
        });
    };
    addAll(classSubjs);
    addAll(classAssignedSubjs);
    const classHas = (base) => normKeys.has(base) || Array.from(normKeys).some(k => k.startsWith(base + '_'));
    const subjects = new Set(normKeys);
    ['bangla', 'english', 'math', 'ict'].forEach(k => { if (classHas(k)) subjects.add(k); });
    if (classHas('religion')) subjects.add('religion');
    if (classHas('science')) subjects.add('science');
    if (classHas('bgs')) subjects.add('bgs');
    return subjects;
};



export default function ResultCardGenerator() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { classrooms, subjects: contextSubjects, refreshClassrooms } = useAcademics();
  
  const [examTypes] = useState([
    { value: 'test', label: 'বিশেষ মূল্যায়ন' },
    { value: 'half_yearly', label: 'অর্ধবার্ষিক' },
    { value: 'annual', label: 'বার্ষিক' },
    { value: 'terminal', label: 'টার্মিনাল' },
    { value: 'model', label: 'মডেল টেস্ট' },
    { value: 'pre_test', label: 'প্রাক-নির্বাচনী' },
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
    return /নবম|দশম|ssc|nine|ten|\bix\b|\bx\b|নাইন|টেন|৯|১০|\b9\b|\b10\b/i.test(text);
  }, [selectedClass, classrooms]);

  // Names of the subjects THIS class actually teaches, derived from the academics context using
  // each subject's linked classrooms. A result card may only fill such a subject as "Absent" -
  // never a subject the class does not have (that produced phantom Absent/F rows).
  // Deliberately NO "all subjects" fallback: if the context carries no classroom links we simply
  // rely on the subjects that already have results, which can never invent a phantom subject.
  const classAssignedSubjectNames = useMemo(() => {
    const names = new Set();
    const list = Array.isArray(contextSubjects) ? contextSubjects : [];
    list.forEach(sub => {
      const linked = Array.isArray(sub?.classrooms) ? sub.classrooms : [];
      if (linked.some(c => String(c.id || c) === String(selectedClass)) && sub?.name) names.add(sub.name);
    });
    return names;
  }, [contextSubjects, selectedClass]);

  const calculateStudentRank = useCallback(async (studentId, listResults = null, overrideSectionId = null) => {
    try {
        const targetSectionId = overrideSectionId || selectedSection;
        let allResults = listResults;
        if (!allResults) {
            let page = 1, hasNext = true, fetched = [];
            while (hasNext && page <= 25) {
                const res = await scopedGet('/api/results/results/', id, {
                    classroom: selectedClass,
                    section: targetSectionId,
                    year: selectedYear,
                    page,
                    page_size: 500
                });
                const data = res.data;
                const arr = Array.isArray(data) ? data : (data.results || []);
                fetched = fetched.concat(arr);
                if (data.next) page++; else hasNext = false;
            }
            allResults = fetched;
        }

        if (allResults.length === 0) return null;

        const isNT = isClassNineOrTen;

        // Robust Student ID Extraction
        const getSid = (r) => {
            const s = r.student;
            if (s && typeof s === 'object') return String(s.id);
            return String(r.student_id || s || '');
        };

        const studentIds = Array.from(new Set(allResults.map(getSid).filter(Boolean)));
        const resultsPool = [];
        const allResultsSorted = [...allResults].sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));

        // Fetch ALL students of the classroom to ensure we don't miss anyone who has results in this section
        const stuRes = await scopedGet('/api/academics/students/', id, {
            classroom: selectedClass,
            page_size: 2000
        });
        const allStudentsInClass = Array.from(stuRes.data.results || stuRes.data || []);

        for (const sid of studentIds) {
            const stuResults = allResultsSorted.filter(r => getSid(r) === sid);
            if (stuResults.length === 0) continue;

            const stuObj = allStudentsInClass.find(s => String(s.id) === sid);
            // Skip students not in the classroom list
            if (!stuObj) continue;

            // CRITICAL: If we are ranking for a specific section, only include students
            // who are officially in that section OR have results in that section.
            const stuSectionId = String(stuObj.section?.id || stuObj.section || '');
            if (targetSectionId && stuSectionId !== String(targetSectionId)) {
                // If student is not officially in target section, check if their RESULTS are in the target section
                const hasResultsInSection = stuResults.some(r => String(r.section?.id || r.section || '') === String(targetSectionId));
                if (!hasResultsInSection) continue;
            }
            const fn = (stuObj.user?.first_name || '').toUpperCase();
            const ln = (stuObj.user?.last_name || '').toUpperCase();
            const fullName = (fn + ' ' + ln).trim();
            if (fullName.includes('TC') || fn.includes('TC') || ln.includes('TC')) continue;
            if (!fn && !ln && !stuObj.roll_number) continue;

            // 1. Religion suppression & Deduplication logic (exactly matching MeritListPage)
            const relResults = stuResults.filter(r => isRelSubjLocal(r.subject?.name || r.subject_name));
            let suppressedIds = new Set();
            if (relResults.length > 1) {
                const withMarks = relResults.map(r => {
                    const w = sumStr(r.written_marks), m = sumStr(r.mcq_marks), p = sumStr(r.practical_marks);
                    const hasActual = (r.written_marks !== '' && r.written_marks !== null) || (r.mcq_marks !== '' && r.mcq_marks !== null) || (r.practical_marks !== '' && r.practical_marks !== null);
                    const total = (w + m + p) > 0 ? (w + m + p) : (parseFloat(r.total_obtained) || 0);
                    return { sid: String(r.subject?.id || r.subject || r.subject_name), total, hasActual };
                }).filter(x => x.total > 0).sort((a, b) => {
                    if (a.hasActual !== b.hasActual) return a.hasActual ? -1 : 1;
                    return b.total - a.total;
                });
                if (withMarks.length > 0) {
                    const bestRelSubId = withMarks[0].sid;
                    relResults.forEach(r => {
                        const rid = String(r.subject?.id || r.subject || r.subject_name);
                        if (rid !== bestRelSubId) suppressedIds.add(rid);
                    });
                }
            }

            const subjectMap = new Map();
            stuResults.forEach(r => {
                const sid = String(r.subject?.id || r.subject || r.subject_name);
                if (suppressedIds.has(sid)) return;

                const rawName = String(r.subject_name || r.subject?.name).toLowerCase().trim();
                let key = normalizeSubjKeyLocal(rawName);

                // Distinguish papers for deduplication so we don't lose one before merging
                if (key === 'bangla' || key === 'english') {
                    const is2 = BN_2ND_REGEX.test(rawName);
                    key = key + (is2 ? '_p2' : '_p1');
                }

                const isCombined = !rawName.match(/(1st|2nd|১ম|২য়|২য়)/);
                const hasSpecificPapers = stuResults.some(x => {
                    const xName = String(x.subject_name || x.subject?.name || '').toLowerCase();
                    const xKey = normalizeSubjKeyLocal(xName);
                    return (xKey.startsWith(key.split('_')[0]) && xName.match(/(1st|2nd|১ম|২য়|২য়)/)) || xKey === key + '_p1' || xKey === key + '_p2';
                });
                if (isNT && isCombined && hasSpecificPapers) return;

                const w = sumStr(r.written_marks), m = sumStr(r.mcq_marks), p = sumStr(r.practical_marks);
                const rTotal = (w + m + p) > 0 ? (w + m + p) : (parseFloat(r.total_obtained) || 0);
                const hasActualMarks = (r.written_marks !== '' && r.written_marks !== null) || (r.mcq_marks !== '' && r.mcq_marks !== null) || (r.practical_marks !== '' && r.practical_marks !== null);

                const existing = subjectMap.get(key);
                if (!existing || (hasActualMarks && !existing.hasActualMarks) || (hasActualMarks === !!existing.hasActualMarks && rTotal > (existing.total_obtained || 0))) {
                    subjectMap.set(key, { ...r, sumW: w, sumM: m, sumP: p, hasActualMarks, total_obtained: rTotal });
                }
            });

            // Re-group for calculation
            const consolidatedMap = new Map();
            Array.from(subjectMap.values()).forEach(r => {
                const nm = String(r.subject?.name || r.subject_name || '').toLowerCase();
                let key = normalizeSubjKeyLocal(nm);
                if (!isNT && (key === 'bangla' || key === 'english')) {
                    const is2 = nm.includes('2nd') || nm.includes('২য়') || nm.includes('২য়') || nm.includes('second');
                    key = key + (is2 ? '_p2' : '_p1');
                }
                if (!consolidatedMap.has(key)) consolidatedMap.set(key, []);
                consolidatedMap.get(key).push(r);
            });

            const classGroupFromAllResults = inferClassGroupFromAllResultsLocal(allResults, isNT, contextSubjects);
            const group = (stuObj.student_group || stuObj.group || inferGroupLocal(stuResults, isNT, stuObj) || classGroupFromAllResults || '').toLowerCase();
            const classSubjs = new Set(allResults.map(r => r.subject?.name || r.subject_name));
            const expectedKeys = getExpectedSubjectsLocal(group, isNT, classSubjs, classAssignedSubjectNames);
            const relWithMarks = Array.from(subjectMap.values()).find(r => isRelSubjLocal(r.subject?.name || r.subject_name) && (parseFloat(r.total_obtained) > 0));
            const takenRelId = relWithMarks?.subject?.id || relWithMarks?.subject;

            let score = 0, fails = 0, hasAnyMarks = false, totalPoints = 0, subjectCount = 0;
            const allSubjectKeys = new Set([...consolidatedMap.keys(), ...expectedKeys, 'higher', 'agriculture', 'civics', 'economics', 'geography', 'science', 'bgs']);
            let electiveCounted = false;

            allSubjectKeys.forEach(key => {
                const papers = consolidatedMap.get(key) || [];
                const isRel = isRelSubjLocal(key);
                let isMandatory = expectedKeys.has(key);
                const belongsToGroup = (isScienceGroupLocal(group) && ['physics', 'chemistry', 'biology'].includes(key)) ||
                                       (isCommerceGroupLocal(group) && ['accounting', 'finance', 'business'].includes(key)) ||
                                       (isHumanitiesGroupLocal(group) && ['history', 'geography', 'civics', 'economics'].includes(key));

                if (isNT && isHumanitiesGroupLocal(group)) {
                    if (key === 'civics' || key === 'economics') {
                        if (papers.length > 0 && !electiveCounted) {
                            isMandatory = true; electiveCounted = true;
                        } else if (key === 'civics' && consolidatedMap.has('economics')) {
                            isMandatory = false;
                        } else if (key === 'economics' && consolidatedMap.has('civics')) {
                            isMandatory = false;
                        } else if (key === 'civics' && !electiveCounted && !consolidatedMap.has('economics')) {
                            isMandatory = true; electiveCounted = true;
                        } else {
                            isMandatory = false;
                        }
                    }
                }

                if (isMandatory || belongsToGroup) { if (!isRel || (isRel && (!takenRelId || consolidatedMap.has(key)))) { subjectCount++; } }

                if (papers.length === 0) {
                    if (isMandatory) {
                        if (isRel && takenRelId) return;
                        if (isNT) {
                            const takesSciGroup = consolidatedMap.has('physics') || consolidatedMap.has('chemistry') || consolidatedMap.has('biology');
                            if (isScienceGroupLocal(group) && takesSciGroup && key === 'science') return;
                            if ((!isScienceGroupLocal(group) || !takesSciGroup) && ['physics', 'chemistry', 'biology'].includes(key)) return;
                        }
                        if (!isNT && (key === 'bangla' || key === 'english')) {
                            if (consolidatedMap.has(key + '_p1') || consolidatedMap.has(key + '_p2')) return;
                        }
                        // Mirroring Merit List fail logic
                        if (stuResults.length > 0) {
                             if (!(isNT === false && (key.includes('শারীরিক') || key.includes('physical')))) {
                                 fails++;
                             }
                        }
                    }
                    return;
                }

                let tMarks = 0, tPoss = 0, sumW = 0, sumM = 0, sumP = 0, cqMax = 0, mcqMax = 0, prMax = 0, pPresent = false;
                papers.forEach(r => {
                    const w = sumStr(r.written_marks), m = sumStr(r.mcq_marks), p = sumStr(r.practical_marks);
                    const hasActual = (r.hasActualMarks !== undefined ? r.hasActualMarks : ((r.written_marks !== '' && r.written_marks !== null) || (r.mcq_marks !== '' && r.mcq_marks !== null) || (r.practical_marks !== '' && r.practical_marks !== null)));
                    if (hasActual || (w+m+p) > 0 || parseFloat(r.total_obtained) > 0) { hasAnyMarks = true; pPresent = true; }
                    const spec = getSubjectMaxima(r.subject?.name || r.subject_name, isNT, group);
                    const maxPossible = (spec.cq + spec.mcq + spec.pr || 100);

                    let obt = (w + m + p) > 0 ? (w + m + p) : (parseFloat(r.total_obtained) || 0);
                    const cappedObt = obt > maxPossible ? maxPossible : obt;

                    tMarks += cappedObt; tPoss += maxPossible;
                    sumW += w; sumM += m; sumP += p;
                    cqMax += spec.cq; mcqMax += spec.mcq; prMax += spec.pr;
                });

                if (isNT && (key === 'bangla' || key === 'english')) { tPoss = Math.max(tPoss, 200); if (tMarks > 200) tMarks = 200; }

                const cqPass = cqMax === 0 || sumW >= Math.round(cqMax * 0.33 - 0.5);
                const mcqPass = mcqMax === 0 || sumM >= Math.round(mcqMax * 0.33 - 0.5);
                const prPass = prMax === 0 || sumP >= Math.round(prMax * 0.33 - 0.5);
                const totPass = tMarks >= Math.round(tPoss * 0.33 - 0.5);

                const isCoCurric = isCoCurricularLocal(key, isNT);
                let isPassed = pPresent && (isNT ? (isCoCurric ? totPass : (cqPass && mcqPass && prPass && totPass)) : totPass);
                // SPECIAL SYNC: School 63 English/Combined Subject Correction (mirror MeritListPage.jsx L591-592)
                if (isNT && key === 'english' && tPoss === 200 && tMarks >= 66) isPassed = true;
                if (isNT && key === 'english' && tPoss === 100 && tMarks >= 33) isPassed = true;
                const gp = isPassed ? computeGpa((tMarks / tPoss) * 100) : 0;

                if (key === 'higher' || key === 'agriculture') {
                    if (isNT) {
                        const threshold = tPoss * 0.4;
                        if (tMarks > threshold) { score += (tMarks - threshold); }
                        totalPoints += Math.max(0, gp - 2.0);
                    }
                } else if (isMandatory || belongsToGroup) {
                    if (!isNT && (key === 'higher' || key === 'agriculture')) return;
                    score += tMarks; totalPoints += gp;
                    if (isMandatory && !isPassed) {
                        // Mirroring Merit List fail logic
                        if (!(isNT === false && (key.includes('শারীরিক') || key.includes('physical')))) {
                            fails++;
                        }
                    }
                }
            });

            if (!hasAnyMarks) fails = 999;
            const finalCgpa = (subjectCount > 0 && fails === 0) ? Math.min(5.0, totalPoints / subjectCount) : 0;
            const studentRoll = stuObj.roll_number ? parseInt(String(stuObj.roll_number).replace(/\D/g, ''), 10) : 999999;
            const studentSectionId = String(stuObj.section?.id || stuObj.section || 'other');

            resultsPool.push({
                sid: String(sid),
                total: Math.round(score),
                rawScore: score,
                points: finalCgpa,
                fails,
                isAbsent: !hasAnyMarks,
                roll: studentRoll,
                section_id: studentSectionId
            });
        }

        const finalRankMap = {};
        const bySection = new Map();
        resultsPool.forEach(item => {
            // Group by section to ensure section-relative rank
            const secId = item.section_id || 'other';
            if (!bySection.has(secId)) bySection.set(secId, []);
            bySection.get(secId).push(item);
        });

        for (const sectionItems of bySection.values()) {
            sectionItems.sort((a, b) => {
                if (a.isAbsent !== b.isAbsent) return a.isAbsent ? 1 : -1;
                if (a.fails !== b.fails) return a.fails - b.fails;
                if (Math.abs(b.points - a.points) > 0.00001) return b.points - a.points;
                if (Math.abs(b.rawScore - a.rawScore) > 0.001) return b.rawScore - a.rawScore;
                return a.roll - b.roll;
            });
            sectionItems.forEach((c, idx) => {
                finalRankMap[c.sid] = c.isAbsent ? null : (idx + 1);
            });
        }

        return finalRankMap[String(studentId)] || null;

    } catch (e) {
        console.error('Rank calculation error:', e);
        return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, selectedClass, selectedSection, selectedYear, isClassNineOrTen]);

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
          const resolvedClass = Number.isNaN(numClass) ? qClass : numClass;
          await refreshClassrooms(id);
          setSelectedClass(resolvedClass);
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
            let list = [];
            try {
              const studs = await scopedGet('/api/academics/students/', id, { classroom: Number.isNaN(numClass) ? qClass : numClass, page_size: 1000 }, { timeout: 30000 });
              list = Array.isArray(studs.data) ? studs.data : studs.data?.results || [];
            } catch (_) {
              list = [];
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

  const loadSchool = useCallback(() => {
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
  }, [id]);

  useEffect(() => {
    if (id) {
      loadSchool();
    }
  }, [id, loadSchool]);

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
    scopedGet('/api/results/examinations/', id, { classroom: classId, page_size: 100 }, { timeout: 15000 })
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
      scopedGet('/api/results/examinations/', id, { classroom: selectedClass, page_size: 100 }, { timeout: 15000 })
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
    const examStr = String(name || '').toLowerCase();
    const s = String(type || '').toLowerCase();
    const combined = (examStr + ' ' + s).trim();

    if (/(প্রাক|pre)/.test(combined)) return 'pre_test';
    if (/(বার্ষিক|final|annual|yearly)/.test(combined)) return 'annual';
    if (/(অর্ধ|half|mid|semi)/.test(combined)) return 'half_yearly';
    if (/(টার্মিনাল|terminal|term)/.test(combined)) return 'terminal';
    if (/(মডেল|model)/.test(combined)) return 'model';
    if (/(প্রথম\s*টার্ম|first\s*term)/.test(combined)) return 'first_term';
    if (/(টেস্ট|test|monthly)/.test(combined)) return 'test';

    if (['final','annual','yearly'].includes(s)) return 'annual';
    if (['half','half_yearly','mid','half-yearly'].includes(s)) return 'half_yearly';
    if (['terminal','term'].includes(s)) return 'terminal';
    if (['model','model_test','model-test'].includes(s)) return 'model';
    if (['pre_test','pre-test','pre'].includes(s)) return 'pre_test';
    if (['test','monthly'].includes(s)) return 'test';
    if (['first_term','first','first-term'].includes(s)) return 'first_term';
    return s || examStr || 'annual';
  };

  const getClassroomId = (cls) => {
    const v = typeof cls === 'object' ? (cls?.id ?? null) : cls;
    const parsedNum = parseInt(v, 10);
    return Number.isNaN(parsedNum) ? null : parsedNum;
  };
  const normalizeLower = (s) => String(s || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
  const canonicalLower = (s) => {
    const cleanText = normalizeLower(s).replace(/\u200d/g, '').trim();
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
    const mapped = dict[cleanText] || s;
    return normalizeLower(mapped);
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
    if (/play|shishu|nursery|প্লে|শিশু|প্রথম|১ম|\bone\b|\b1\b|দ্বিতীয়|২য়|\btwo\b|\b2\b|তৃতীয়|৩য়|\bthree\b|\b3\b|চতুর্থ|৪র্থ|\bfour\b|\b4\b|পঞ্চম|৫ম|\bfive\b|\b5\b|class\s*[1-5]/.test(x)) return 'primary';
    return null;
  };
  const getPassMarks = (exams) => {
    const ex = Array.isArray(exams) ? exams.find(e => e && (e.pass_marks != null)) : null;
    const pm = parseFloat(ex?.pass_marks);
    return Number.isFinite(pm) && pm > 0 ? pm : 33;
  };
  const computeSubjectPass = (name, w, m, p, exams, examination) => {
    const group = getClassGroup();
    const passMarks = getPassMarks(exams);
    if (group === 'primary') {
      const exObj = examination || {};
      let wMax = parseFloat(exObj?.written_max) || 0;
      if (!wMax) {
        const spec = getSubjectMaximaForClass(name) || {};
        wMax = parseFloat(spec.written) || 0;
      }
      const writtenAbsent = (w === null || w === undefined || (typeof w === 'string' && w.trim() === '') || isNaN(parseFloat(w)));
      if (writtenAbsent) return false;
      if (wMax > 0) {
        return w >= Math.round(wMax / 3 - 0.5);
      }
      return w >= passMarks;
    }
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

  const dedupeAndFillResults = (arr, exams, expectedKeys = null, studentOptionalSubject = null, validSubjKeys = null, studentAcademicGroup = '') => {
    const map = new Map(); // key -> result object

    const targetExamIds = new Set();
    (exams || []).forEach(ex => { if (ex?.id) targetExamIds.add(String(ex.id)); });

    const sortedArr = (Array.isArray(arr) ? [...arr] : []).sort((a, b) => {
      const aExamId = (typeof a.examination === 'object' && a.examination !== null)
        ? String(a.examination?.id || a.examination?.examination_id || '')
        : String(a.examination || a.examination_id || '');
      const bExamId = (typeof b.examination === 'object' && b.examination !== null)
        ? String(b.examination?.id || b.examination?.examination_id || '')
        : String(b.examination || b.examination_id || '');
      const aInTarget = targetExamIds.has(aExamId) ? 1 : 0;
      const bInTarget = targetExamIds.has(bExamId) ? 1 : 0;
      if (aInTarget !== bInTarget) return bInTarget - aInTarget;
      return (parseInt(b.id) || 0) - (parseInt(a.id) || 0);
    });

    // Religion suppression (matches Merit List logic)
    const relResults = sortedArr.filter(r => isRelSubjLocal(r.subject?.name || r.subject_name));
    let suppressedIds = new Set();
    if (relResults.length > 1) {
        const withMarks = relResults.map(r => ({
            id: r.subject?.id || r.subject,
            total: (parseFloat(r.total_obtained) || (sumStr(r.written_marks)||0) + (sumStr(r.mcq_marks)||0) + (sumStr(r.practical_marks)||0))
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

      // Match paper grouping logic to preserve both papers for merging
      if (nm === 'bangla' || nm === 'english') {
          const rawNameLower = String(subjName || '').toLowerCase();
          const is2 = BN_2ND_REGEX.test(rawNameLower);
          nm = nm + (is2 ? '_p2' : '_p1');
      }

      // Deduplicate: best entry wins (first in sorted order = target exam + highest ID)
      if (map.has(nm)) {
          const existing = map.get(nm);
          const existingExamId = (typeof existing.examination === 'object' && existing.examination !== null)
            ? String(existing.examination?.id || existing.examination?.examination_id || '')
            : String(existing.examination || existing.examination_id || '');
          const currentExamId = (typeof r.examination === 'object' && r.examination !== null)
            ? String(r.examination?.id || r.examination?.examination_id || '')
            : String(r.examination || r.examination_id || '');
          const existingInTarget = targetExamIds.has(existingExamId) ? 1 : 0;
          const currentInTarget = targetExamIds.has(currentExamId) ? 1 : 0;
          if (currentInTarget < existingInTarget) {
              continue;
          }
          if (currentInTarget === existingInTarget) {
              const existingId = parseInt(existing.id) || 0;
              const currentId = parseInt(r.id) || 0;
              if (currentId <= existingId) {
                  continue;
              }
          }
      }

      // If validSubjKeys provided, filter out subjects with NO marks in section unless student has marks
      const studentHasMarksForNormKey = Array.isArray(arr) && arr.some(fr => normalizeSubjKeyLocal(fr.subject?.name || fr.subject_name) === nm.split('_')[0] && ((parseFloat(fr.written_marks)||0) > 0 || (parseFloat(fr.mcq_marks)||0) > 0 || (parseFloat(fr.total_obtained)||0) > 0));

      if (isClassNineOrTen && validSubjKeys && validSubjKeys.size > 0 && !validSubjKeys.has(nm.split('_')[0]) && !studentHasMarksForNormKey) continue;

      // Skip redundant combined records if specific papers exist (Matches Merit List logic)
      const isCombined = !String(subjName || '').match(/(1st|2nd|১ম|২য়|২য়)/);
      const hasSpecificPapers = sortedArr.some(x => {
          const xName = String(x.subject_name || x.subject?.name || '').toLowerCase();
          const xKey = normalizeSubjKeyLocal(xName);
          return (xKey.startsWith(nm.split('_')[0]) && xName.match(/(1st|2nd|১ম|২য়|২য়)/)) || xKey === nm + '_p1' || xKey === nm + '_p2';
      });
      if (isClassNineOrTen && isCombined && hasSpecificPapers) continue;

      const isUnwanted = (name) => {
        const subStr = String(name || '').trim().toLowerCase();
        if (UNWANTED_SUBJECTS.some(u => subStr === u.toLowerCase())) return true;
        if (CO_CURRICULAR_SUBJECTS.some(sub => subStr.includes(sub.toLowerCase()))) return false;
        if (UNWANTED_KEYWORDS.some(u => subStr.includes(u.toLowerCase()))) return true;
        return false;
      };

      if (!nm || isUnwanted(subjName)) continue;

      const w = sumStr(r.written_marks);
      const m = sumStr(r.mcq_marks);
      const p = sumStr(r.practical_marks);
      const obtained = ((w + m + p) > 0) ? (w + m + p) : (parseFloat(r.total_obtained) || 0);
      const totalMax = getTotalMaxForResult(r);

      const groupStr = String(studentAcademicGroup || '').toLowerCase();
      const isCommOrHum = groupStr.includes('commerce') || groupStr.includes('business') || groupStr.includes('ব্যবসায়') || groupStr.includes('ব্যবসায়') || groupStr.includes('ব্যবসা') || groupStr.includes('arts') || groupStr.includes('humanities') || groupStr.includes('মানবিক');
      const isHM = nm === 'higher' || String(subjName || '').toLowerCase().includes('higher') || String(subjName || '').toLowerCase().includes('উচ্চতর');

      const optId = String(studentOptionalSubject?.id || studentOptionalSubject || '');
      const optName = String(studentOptionalSubject?.name || '').toLowerCase();
      const sid = String(r.subject?.id || r.subject || '');
      const isAssigned = (optId && sid === optId) || (optName && (String(subjName).toLowerCase().includes(optName)));

      // Strict Guard: For Commerce/Humanities, Higher Math is NEVER allowed unless explicitly assigned!
      if (isCommOrHum && isHM && !isAssigned) {
          continue;
      }

      const isPrimaryGroupForCalc = (groupStr === 'primary') || (getClassGroup() === 'primary');
      let gradeObtained = obtained;
      let gradeTotalMax = totalMax;
      if (isPrimaryGroupForCalc) {
        const exObjForCalc = r.examination || {};
        let wm = parseFloat(exObjForCalc?.written_max) || 0;
        if (!wm) {
          const sp = getSubjectMaximaForClass(r.subject?.name || r.subject_name || subjName) || {};
          wm = parseFloat(sp.written) || 0;
        }
        gradeTotalMax = wm > 0 ? wm : 100;
        gradeObtained = w;
      }

      let gradeRecalc, gpaRecalc;
      if (isPrimaryGroupForCalc) {
        const rec = calculateGradeAndGPA(gradeObtained, gradeTotalMax);
        gradeRecalc = rec.grade;
        gpaRecalc = rec.gpa;
      } else {
        const pre = (r.grade && r.gpa) ? { grade: r.grade, gpa: r.gpa } : null;
        const rec = calculateGradeAndGPA(gradeObtained, gradeTotalMax);
        gradeRecalc = pre ? pre.grade : rec.grade;
        gpaRecalc = pre ? pre.gpa : rec.gpa;
      }
      const grade = gradeRecalc;
      const gpa = gpaRecalc;
      const passed = isPrimaryGroupForCalc ?
        computeSubjectPass(r.subject?.name || r.subject_name || nm, w, m, p, exams, r.examination) :
        ((r.is_passed !== undefined && r.is_passed !== null) ? r.is_passed : computeSubjectPass(r.subject?.name || r.subject_name || nm, w, m, p, exams, r.examination));

      let cleanName = r.subject?.name || r.subject_name || subjName;
      cleanName = cleanName.replace(/\s*\(.*?\)\s*/g, '').trim();

      const writtenAb = (r.written_marks === null || r.written_marks === undefined || String(r.written_marks).trim() === '');
      const mcqAb = (r.mcq_marks === null || r.mcq_marks === undefined || String(r.mcq_marks).trim() === '');
      const prAb = (r.practical_marks === null || r.practical_marks === undefined || String(r.practical_marks).trim() === '');
      const isActuallyAbsent = isPrimaryGroupForCalc ?
        (writtenAb && !(parseFloat(r.total_obtained) > 0)) :
        (writtenAb && mcqAb && prAb && !(parseFloat(r.total_obtained) > 0));

      // Always take the latest entry (latest input wins)
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

    // 2. Fill missing expected subjects as "Absent"
    if (expectedKeys) {
        expectedKeys.forEach(key => {
            // Check directly against the normalized key in the map
            if (!map.has(key)) {
                // Fill missing expected subject as Absent

                // Special check for papers: if we expect 'bangla' but have papers, it's not missing
                if (key === 'bangla' || key === 'english') {
                    if (map.has(key + '_p1') || map.has(key + '_p2') || map.has(key + '_combined')) return;
                }

                // NO CLONING: We do NOT clone marks from baseKey anymore.
                // This prevents Adnan's 1st paper marks (80) from appearing in his 2nd paper.
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

    // 3. Fill missing assigned optional subject as "Absent" (Excluding Higher Math for Commerce/Humanities)
    if (studentOptionalSubject) {
        const optName = String(studentOptionalSubject?.name || '').toLowerCase();
        const optKey = normalizeSubjKeyLocal(optName);

        const groupStr = String(studentAcademicGroup || '').toLowerCase();
        const isCommOrHum = groupStr.includes('commerce') || groupStr.includes('business') || groupStr.includes('ব্যবসায়') || groupStr.includes('ব্যবসায়') || groupStr.includes('ব্যবসা') || groupStr.includes('arts') || groupStr.includes('humanities') || groupStr.includes('মানবিক');
        const isHM = optKey === 'higher' || optName.includes('higher') || optName.includes('উচ্চতর');

        if (!(isCommOrHum && isHM)) {
            if (optKey && !map.has(optKey)) {
                // Check section validity for optional as well (using base key)
                const baseKey = optKey.split('_')[0];
                if (isClassNineOrTen && validSubjKeys && validSubjKeys.size > 0 && !validSubjKeys.has(baseKey)) return;

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
      const selType = normalizeExamType(selectedExamType);
      // Get student details
      const studentRes = await api.get(`/api/academics/students/${selectedStudent}/`);
      const student = studentRes.data;
      const stuSectionId = student.section?.id || student.section || selectedSection;

      let baseStudentData = { student: overrideLogo ? { ...student, school_logo: overrideLogo } : student };
      setStudentData(baseStudentData);

      let matchingExams = [];
      if (examIdOverride) {
        const exRes = await api.get(`/api/results/examinations/${examIdOverride}/`, { params: { school: id } });
        const ex = exRes.data;
        matchingExams = ex ? [ex] : [];
      } else {
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

      if (examIdOverride) {
        try {
          const overrideExRes = await api.get(`/api/results/examinations/${examIdOverride}/`, { params: { school: id } });
          const overrideEx = overrideExRes.data;
          if (overrideEx) {
            matchingExams = [overrideEx];
          }
        } catch (_) {}
      } else if (matchingExams.length > 1) {
        const scored = [];
        for (const ex of matchingExams) {
          let totalEntries = 0;
          let maxResultId = 0;
          let hasAnyActualMarks = false;
          try {
            const p1 = scopedGet('/api/results/results/', id, { examination: ex.id, student: student.id, page_size: 300 }, { timeout: 7000 }).catch(() => null);
            const p2 = api.get('/api/results/results/', { params: { examination: ex.id, student: student.id, school: id, page_size: 300 }, timeout: 7000 }).catch(() => null);
            const [res1, res2] = await Promise.all([p1, p2]);
            const arr1 = res1 ? (Array.isArray(res1.data) ? res1.data : (res1.data?.results || [])) : [];
            const arr2 = res2 ? (Array.isArray(res2.data) ? res2.data : (res2.data?.results || [])) : [];
            const combined = arr1.concat(arr2);
            for (const r of combined) {
              totalEntries += 1;
              const rid = parseInt(r.id) || 0;
              if (rid > maxResultId) maxResultId = rid;
              const w = sumStr(r.written_marks) || 0;
              const m = sumStr(r.mcq_marks) || 0;
              const p = sumStr(r.practical_marks) || 0;
              const t = parseFloat(r.total_obtained) || 0;
              if (w > 0 || m > 0 || p > 0 || t > 0) hasAnyActualMarks = true;
            }
          } catch (_) {}
          scored.push({
            ex,
            examDate: new Date(ex.exam_date || ex.created_at || 0).getTime(),
            examId: parseInt(ex.id) || 0,
            totalEntries,
            maxResultId,
            hasAnyActualMarks: hasAnyActualMarks ? 1 : 0,
          });
        }
        scored.sort((a, b) => {
          const m = b.hasAnyActualMarks - a.hasAnyActualMarks;
          if (m !== 0) return m;
          const e = b.totalEntries - a.totalEntries;
          if (e !== 0) return e;
          const r = (b.maxResultId || 0) - (a.maxResultId || 0);
          if (r !== 0) return r;
          const d = (b.examDate || 0) - (a.examDate || 0);
          if (d !== 0) return d;
          return b.examId - a.examId;
        });
        if (scored[0]) matchingExams = [scored[0].ex];
      }

      let chosenExam = null;
      try {
        const examResList = await Promise.all(matchingExams.map(ex => api.get(`/api/results/examinations/${ex.id}/`, { params: { school: id } }).then(r => r.data).catch(() => null)));
        const valid = examResList.filter(Boolean);
        if (examIdOverride && valid.length > 0) {
          chosenExam = valid.find(v => String(v.id) === String(examIdOverride)) || valid[0];
        } else {
          const validSorted = [...valid].sort((a, b) => {
            const da = new Date(a.exam_date || a.created_at || 0).getTime();
            const db = new Date(b.exam_date || b.created_at || 0).getTime();
            const dt = db - da;
            if (dt !== 0) return dt;
            return (parseInt(b.id) || 0) - (parseInt(a.id) || 0);
          });
          chosenExam = validSorted[0] || valid[0] || null;
        }
        setExamination(chosenExam);
      } catch (_) {
        if (examIdOverride && matchingExams[0]) {
          chosenExam = matchingExams[0];
        } else {
          chosenExam = matchingExams[0] || null;
        }
        setExamination(chosenExam);
      }

      const originalMatching = [...matchingExams];
      matchingExams = originalMatching.length ? originalMatching : (chosenExam ? [chosenExam] : []);
      
      let fetchedResults = [];
      const examIds = matchingExams.map(ex => ex.id);

      for (const exId of examIds) {
        try {
          const params = { examination: exId, student: student.id, page_size: 1000 };
          const p1 = scopedGet('/api/results/results/', id, params, { timeout: 15000 }).catch(() => null);
          const p2 = api.get('/api/results/results/', { params: { ...params, school: id }, timeout: 15000 }).catch(() => null);
          const [resultsRes, directRes] = await Promise.all([p1, p2]);
          const arr1 = resultsRes ? (Array.isArray(resultsRes.data) ? resultsRes.data : (resultsRes.data?.results || [])) : [];
          const arr2 = directRes ? (Array.isArray(directRes.data) ? directRes.data : (directRes.data?.results || [])) : [];
          const combined = arr1.concat(arr2);
          if (combined.length) {
            const seen = new Set();
            const deduped = [];
            for (const r of combined) {
              const k = String(r.id || `${r.examination?.id||r.examination}-${r.student?.id||r.student}-${r.subject?.id||r.subject}`);
              if (!seen.has(k)) { seen.add(k); deduped.push(r); }
            }
            fetchedResults = fetchedResults.concat(deduped);
          }
        } catch (_) {}
      }

      if (fetchedResults.length === 0 && chosenExam) {
        try {
          const params = { examination: chosenExam.id, student: student.id, page_size: 1000 };
          const p1 = scopedGet('/api/results/results/', id, params, { timeout: 15000 }).catch(() => null);
          const p2 = api.get('/api/results/results/', { params: { ...params, school: id }, timeout: 15000 }).catch(() => null);
          const [resultsRes, directRes] = await Promise.all([p1, p2]);
          const arr1 = resultsRes ? (Array.isArray(resultsRes.data) ? resultsRes.data : (resultsRes.data?.results || [])) : [];
          const arr2 = directRes ? (Array.isArray(directRes.data) ? directRes.data : (directRes.data?.results || [])) : [];
          const combined = arr1.concat(arr2);
          if (combined.length) {
            const seen = new Set();
            const deduped = [];
            for (const r of combined) {
              const k = String(r.id || `${r.examination?.id||r.examination}-${r.student?.id||r.student}-${r.subject?.id||r.subject}`);
              if (!seen.has(k)) { seen.add(k); deduped.push(r); }
            }
            fetchedResults = deduped;
          }
        } catch (_) {}
      }



      // Fetch Section Results for the chosen examination(s)
      let sectionResults = [];
      let validSubjKeys = null;
      try {
          let allSecRes = [];
          for (const exId of examIds) {
              const sectionResultsRes = await scopedGet('/api/results/results/', id, {
                  examination: exId,
                  classroom: selectedClass,
                  section: stuSectionId,
                  page_size: 10000
              }, { timeout: 20000 });
              const arr = Array.isArray(sectionResultsRes.data) ? sectionResultsRes.data : (sectionResultsRes.data?.results || []);
              allSecRes = allSecRes.concat(arr);
          }
          if (allSecRes.length === 0 && chosenExam) {
              const sectionResultsRes = await scopedGet('/api/results/results/', id, {
                  examination: chosenExam.id,
                  classroom: selectedClass,
                  section: stuSectionId,
                  page_size: 10000
              }, { timeout: 20000 });
              allSecRes = Array.isArray(sectionResultsRes.data) ? sectionResultsRes.data : (sectionResultsRes.data?.results || []);
          }
          if (allSecRes.length === 0) {
              const sectionResultsRes = await scopedGet('/api/results/results/', id, {
                  classroom: selectedClass,
                  section: stuSectionId,
                  year: effectiveYear,
                  page_size: 10000
              }, { timeout: 20000 });
              allSecRes = Array.isArray(sectionResultsRes.data) ? sectionResultsRes.data : (sectionResultsRes.data?.results || []);
          }
          sectionResults = allSecRes;

          validSubjKeys = new Set();
          sectionResults.forEach(r => {
              const total = (parseFloat(r.total_obtained) || (sumStr(r.written_marks)||0) + (sumStr(r.mcq_marks)||0) + (sumStr(r.practical_marks)||0));
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
          const total = (parseFloat(r.total_obtained) || (sumStr(r.written_marks)||0) + (sumStr(r.mcq_marks)||0) + (sumStr(r.practical_marks)||0));
          const hasInput = (r.written_marks !== null && r.written_marks !== '') || (r.mcq_marks !== null && r.mcq_marks !== '') || (r.practical_marks !== null && r.practical_marks !== '');
          if (hasInput && total > 0) {
            subjectsWithPositiveData.add(r.subject?.id || r.subject_id || r.subject_name);
          }
        });

        const targetExamIds = new Set();
        if (examIdOverride) {
          targetExamIds.add(String(examIdOverride));
        } else {
          (matchingExams || []).forEach(ex => { if (ex?.id) targetExamIds.add(String(ex.id)); });
          if (chosenExam?.id) targetExamIds.add(String(chosenExam.id));
        }

        const strictFiltered = targetExamIds.size > 0
          ? fetchedResults.filter(r => {
              const rid = (typeof r.examination === 'object' && r.examination !== null)
                ? String(r.examination?.id || r.examination?.examination_id || '')
                : String(r.examination || r.examination_id || '');
              return !rid || targetExamIds.has(rid);
            })
          : fetchedResults;

        const useResults = strictFiltered;

        const classSubjs = new Set(useResults.map(r => r.subject?.name || r.subject_name));
        const group = getStudentAcademicGroup(student, studentData, useResults);
        const expectedKeys = getExpectedSubjectsLocal(group, isClassNineOrTen, classSubjs, classAssignedSubjectNames);

        const merged = dedupeAndFillResults(useResults, matchingExams, expectedKeys, student.optional_subject, validSubjKeys, group);

        if (examIdOverride && merged.length === 0) {
          toast.warning('এই নির্দিষ্ট পরীক্ষার জন্য এখনো রেজাল্ট ইনপুট দেওয়া হয়নি। অনুগ্রহ করে ফলাফল পৃষ্ঠায় গিয়ে নাম্বার ইনপুট দিন।');
        }
        setResults(merged);

        if (!examIdOverride) {
          const usedExamIds = Array.from(new Set(merged.map(r => typeof r.examination === 'object' ? r.examination?.id : r.examination).filter(Boolean)));
          try {
            const usedExamObjs = await Promise.all(usedExamIds.map(eid => api.get(`/api/results/examinations/${eid}/`, { params: { school: id } }).then(r => r.data).catch(() => null)));
            const validUsed = usedExamObjs.filter(Boolean).sort((a, b) => new Date(b.exam_date || 0) - new Date(a.exam_date || 0));
            if (validUsed[0]) setExamination(validUsed[0]);
          } catch (_) {}
        }
      } else {
        toast.warning('এই শিক্ষার্থীর কোনো রেজাল্ট পাওয়া যায়নি।');
        setStudentData(null); setResults([]); setOverallResult(null); setLoading(false); return;
      }

      let overall = null;
      try {
        const exId = chosenExam?.id || null;
        if (selectedExamType && selectedClass) {
          try {
            // Use the stuSectionId defined at the top of handleSearch
            const listRes = await api.get('/api/results/overall/combined_rank_list_by_exam_type/', {
              params: {
                exam_type: selType,
                classroom: selectedClass,
                section: stuSectionId,
                school: id,
                year: selectedYear,
                page_size: 2000
              }
            });
            const list = Array.isArray(listRes.data) ? listRes.data : (listRes.data?.results || []);

            // CRITICAL: Filter list to ONLY the student's section AND exclude TC students for true parity
            const sectionList = list.filter(o => {
                const s = o.student;
                if (!s) return false;

                // Exclude TC students (exactly matching MeritListPage logic)
                const fn = (s.user?.first_name || s.first_name || '').toUpperCase();
                const ln = (s.user?.last_name || s.last_name || '').toUpperCase();
                const fullName = (fn + ' ' + ln).trim();
                if (fullName.includes('TC') || fn.includes('TC') || ln.includes('TC')) return false;

                const sSecId = String((typeof s.section === 'object') ? s.section.id : (s.section || o.section || o.section_id || ''));
                return sSecId === String(stuSectionId);
            });

            // Sort the list exactly like the Merit List page would
            const sortedList = [...sectionList].sort((a, b) => {
                // Determine Fails proxy if field missing
                const aFails = a.failed_subjects_count !== undefined ? Number(a.failed_subjects_count) : (a.is_passed ? 0 : 1);
                const bFails = b.failed_subjects_count !== undefined ? Number(b.failed_subjects_count) : (b.is_passed ? 0 : 1);
                if (aFails !== bFails) return aFails - bFails;

                const aCgpa = parseFloat(a.cgpa || 0);
                const bCgpa = parseFloat(b.cgpa || 0);
                if (Math.abs(bCgpa - aCgpa) > 0.00001) return bCgpa - aCgpa;

                const aTotal = parseFloat(a.total_marks_obtained || 0);
                const bTotal = parseFloat(b.total_marks_obtained || 0);
                if (Math.abs(bTotal - aTotal) > 0.001) return bTotal - aTotal;

                const aRoll = parseInt(String(a.student?.roll_number || a.roll_number || 999999).replace(/\D/g,''), 10);
                const bRoll = parseInt(String(b.student?.roll_number || b.roll_number || 999999).replace(/\D/g,''), 10);
                return aRoll - bRoll;
            });

            const matchIndex = sortedList.findIndex(o => {
                const oSid = (o.student && typeof o.student === 'object') ? String(o.student.id) : String(o.student || o.student_id || '');
                return oSid === String(student.id);
            });

            if (matchIndex !== -1) {
              const match = sortedList[matchIndex];
              // Sequential Rank within filtered section list - use frontend sorted position first (not stale backend rank)
              const finalRank = Number(matchIndex + 1);

              overall = {
                percentage: match.percentage,
                rank: finalRank,
                rank_in_section: finalRank,
                is_passed: match.is_passed,
                total_marks_obtained: match.total_marks_obtained,
                total_marks_possible: match.total_marks_possible,
                cgpa: match.cgpa,
                grade: match.grade
              };
            }
          } catch (err) {
            console.error("Rank list fetch failed in handleSearch:", err);
          }
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
          // Only recalculate rank if the combined_rank_list_by_exam_type flow did NOT already provide
          // a frontend-sorted rank (that list uses the exact Merit List exam-specific pool).
          if (overall.rank == null || overall.rank_in_section == null) {
              const newRank = await calculateStudentRank(student.id, sectionResults.length > 0 ? sectionResults : null, stuSectionId);
              if (newRank) {
                  overall.rank = newRank;
                  overall.rank_in_section = newRank;
              }
          }
      }

      setOverallResult(overall);

      if (targetLang === 'en') {
        setIsTranslating(true);
        try {
          const payload = {
            school_name: school?.name_en || school?.name,
            student_name: cleanAndDeduplicateName(`${student.user?.first_name_en || student.user?.first_name || ''} ${student.user?.last_name_en || student.user?.last_name || ''}`),
            father_name: cleanAndDeduplicateName(student.father_name_en || student.father_name),
            mother_name: cleanAndDeduplicateName(student.mother_name_en || student.mother_name),
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

  const buildCardForStudent = async (stuId, preFetchedStudent = null, preFetchedResults = null, preFetchedOverall = null, sectionSubjs = null, validSubjKeys = null, preFetchedAttendance = null) => {
    try {
      const student = preFetchedStudent || (await api.get(`/api/academics/students/${stuId}/`).then(r => r.data).catch(() => ({ id: stuId })));
      const selType = normalizeExamType(selectedExamType);
      let matchingExams = Array.isArray(examinations) ? examinations.filter(exam =>
        normalizeExamType(exam.exam_type, exam.name) === selType &&
        getClassroomId(exam.classroom) === selectedClass
      ) : [];

      if (matchingExams.length === 0 && Array.isArray(examinations) && examinations.length > 0) {
        matchingExams = [examinations[0]];
      }

      if (matchingExams.length > 1) {
        const bulkScored = [];
        for (const ex of matchingExams) {
          let totalEntries = 0;
          let maxResultId = 0;
          let hasAnyActualMarks = false;
          try {
            const p1 = scopedGet('/api/results/results/', id, { examination: ex.id, student: stuId, page_size: 300 }, { timeout: 7000 }).catch(() => null);
            const p2 = api.get('/api/results/results/', { params: { examination: ex.id, student: stuId, school: id, page_size: 300 }, timeout: 7000 }).catch(() => null);
            const [res1, res2] = await Promise.all([p1, p2]);
            const arr1 = res1 ? (Array.isArray(res1.data) ? res1.data : (res1.data?.results || [])) : [];
            const arr2 = res2 ? (Array.isArray(res2.data) ? res2.data : (res2.data?.results || [])) : [];
            const combined = arr1.concat(arr2);
            for (const r of combined) {
              totalEntries += 1;
              const rid = parseInt(r.id) || 0;
              if (rid > maxResultId) maxResultId = rid;
              const w = sumStr(r.written_marks) || 0;
              const m = sumStr(r.mcq_marks) || 0;
              const p = sumStr(r.practical_marks) || 0;
              const t = parseFloat(r.total_obtained) || 0;
              if (w > 0 || m > 0 || p > 0 || t > 0) hasAnyActualMarks = true;
            }
          } catch (_) {}
          bulkScored.push({
            ex,
            examDate: new Date(ex.exam_date || ex.created_at || 0).getTime(),
            examId: parseInt(ex.id) || 0,
            totalEntries,
            maxResultId,
            hasAnyActualMarks: hasAnyActualMarks ? 1 : 0,
          });
        }
        bulkScored.sort((a, b) => {
          const m = b.hasAnyActualMarks - a.hasAnyActualMarks;
          if (m !== 0) return m;
          const e = b.totalEntries - a.totalEntries;
          if (e !== 0) return e;
          const r = (b.maxResultId || 0) - (a.maxResultId || 0);
          if (r !== 0) return r;
          const d = (b.examDate || 0) - (a.examDate || 0);
          if (d !== 0) return d;
          return b.examId - a.examId;
        });
        if (bulkScored[0]) matchingExams = [bulkScored[0].ex];
      }

      let fetchedResults = preFetchedResults;
      if (!fetchedResults) {
        fetchedResults = [];
        for (const ex of matchingExams) {
          try {
            const params = { examination: ex.id, student: stuId, page_size: 1000 };
            const p1 = scopedGet('/api/results/results/', id, params, { timeout: 15000 }).catch(() => null);
            const p2 = api.get('/api/results/results/', { params: { ...params, school: id }, timeout: 15000 }).catch(() => null);
            const [resultsRes, directRes] = await Promise.all([p1, p2]);
            const arr1 = resultsRes ? (Array.isArray(resultsRes.data) ? resultsRes.data : (resultsRes.data?.results || [])) : [];
            const arr2 = directRes ? (Array.isArray(directRes.data) ? directRes.data : (directRes.data?.results || [])) : [];
            const combined = arr1.concat(arr2);
            if (combined.length) {
              const seen = new Set();
              const deduped = [];
              for (const r of combined) {
                const k = String(r.id || `${r.examination?.id||r.examination}-${r.student?.id||r.student}-${r.subject?.id||r.subject}`);
                if (!seen.has(k)) { seen.add(k); deduped.push(r); }
              }
              fetchedResults = fetchedResults.concat(deduped);
            }
          } catch (_) {}
        }
        if (fetchedResults.length === 0) {
          try {
            const r = await scopedGet('/api/results/results/', id, { student: stuId, page_size: 2000 }, { timeout: 20000 });
            const arr = Array.isArray(r.data) ? r.data : (r.data?.results || r.data?.data || []);
            if (arr.length > 0) fetchedResults = arr;
          } catch (_) {}
        }
      }

      // Fill missing subjects for bulk cards
      const group = getStudentAcademicGroup(student, student, fetchedResults);
      const expectedKeys = getExpectedSubjectsLocal(group, isClassNineOrTen, sectionSubjs, classAssignedSubjectNames);

      const bulkTargetExamIds = new Set();
      (matchingExams || []).forEach(ex => { if (ex?.id) bulkTargetExamIds.add(String(ex.id)); });

      const bulkStrictFiltered = bulkTargetExamIds.size > 0
        ? fetchedResults.filter(r => {
            const rid = (typeof r.examination === 'object' && r.examination !== null)
              ? String(r.examination?.id || r.examination?.examination_id || '')
              : String(r.examination || r.examination_id || '');
            return !rid || bulkTargetExamIds.has(rid);
          })
        : fetchedResults;

      const bulkUseResults = bulkStrictFiltered;

      const merged = dedupeAndFillResults(bulkUseResults, matchingExams, expectedKeys, student.optional_subject, validSubjKeys, group);
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

      const cardData = {
        studentData: { student },
        results: merged,
        overallResult: overall,
        examination: matchingExams[0] || { name: selectedExamType || 'Examination', exam_type: selectedExamType }
      };
      if (preFetchedAttendance) {
        cardData.studentData.attendance_summary = preFetchedAttendance;
      }
      return cardData;
    } catch (e) {
      console.error('buildCardForStudent error:', e);
      return null;
    }
  };

  const handleGenerateBulkCards = async (targetLang = 'en') => {
    // Section is OPTIONAL: Primary classes have students with section = NULL and may
    // expose no sections at all, so requiring one made card generation impossible.
    // An empty section now means "every student in the selected class".
    if (!selectedClass || !selectedExamType) {
      toast.error('শ্রেণি ও পরীক্ষার ধরন নির্বাচন করুন');
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
      const sectionList = selectedSection
        ? students.filter(s => {
            const secId = (typeof s.section === 'object') ? (s.section?.id ?? s.section?.section_id) : (s.section_id ?? s.section);
            return String(secId || '') === String(selectedSection);
          })
        : students;

      if (sectionList.length === 0) {
        toast.error(selectedSection ? 'এই সেকশনে কোনো শিক্ষার্থী পাওয়া যায়নি' : 'এই শ্রেণিতে কোনো শিক্ষার্থী পাওয়া যায়নি');
        setBulkLoading(false);
        return;
      }

      const normalizedSelType = normalizeExamType(selectedExamType);

      // 1. Fetch EVERYTHING in bulk (scoped strictly to selected exam type with fallback)
      const [rRes, , aRes] = await Promise.all([
        scopedGet('/api/results/results/', id, { classroom: selectedClass, section: selectedSection, exam_type: normalizedSelType, year: selectedYear, page_size: 10000 }, { timeout: 25000 }).catch(() => ({ data: [] })),
        api.get('/api/results/overall/combined_rank_list_by_exam_type/', {
          params: { exam_type: normalizedSelType, classroom: selectedClass, section: selectedSection, school: id, year: selectedYear, page_size: 2000 }
        }).catch(() => ({ data: [] })),
        api.get('/api/attendance/summaries/get_by_section/', {
          params: { classroom: selectedClass, section: selectedSection, year: selectedYear, school: id }
        }).catch(() => ({ data: [] }))
      ]);

      let rList = Array.isArray(rRes.data) ? rRes.data : (rRes.data?.results || []);
      if (rList.length === 0) {
        try {
          const fallbackRes = await scopedGet('/api/results/results/', id, { classroom: selectedClass, section: selectedSection, year: selectedYear, page_size: 10000 }, { timeout: 25000 });
          rList = Array.isArray(fallbackRes.data) ? fallbackRes.data : (fallbackRes.data?.results || []);
        } catch (_) {}
      }
      const aList = Array.isArray(aRes.data) ? aRes.data : [];

      const attendanceMap = {};
      aList.forEach(item => {
        if (item.student_id) attendanceMap[String(item.student_id)] = item.summary;
      });

      // Filter: Identify valid subjects
      const validSubjKeys = new Set();
      rList.forEach(r => {
        const w = parseFloat(r.written_marks) || 0, m = parseFloat(r.mcq_marks) || 0, p = parseFloat(r.practical_marks) || 0;
        const total = (parseFloat(r.total_obtained) || (w + m + p));
        if (total > 0) validSubjKeys.add(normalizeSubjKeyLocal(r.subject?.name || r.subject_name));
      });

      const sectionSubjs = new Set(rList.map(r => r.subject?.name || r.subject_name));
      const resultsByStudent = {};
      const studentIdToObj = {};
      const isNT = isClassNineOrTen;
      const allResultsSorted = [...rList].sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));

      allResultsSorted.forEach(r => {
        const sid = String(r.student?.id ?? r.student_id ?? r.student ?? '');
        if (!sid) return;
        if (!resultsByStudent[sid]) resultsByStudent[sid] = [];
        resultsByStudent[sid].push(r);
        if (r.student && typeof r.student === 'object' && !studentIdToObj[sid]) studentIdToObj[sid] = r.student;
      });

      const overallByStudent = {};
      const studentIds = Object.keys(resultsByStudent);
      const resultsPool = [];

      // Rank ONLY among students in the target section list (ensures parity with single card)
      const targetSids = new Set(sectionList.map(s => String(s.id)));

      for (const sid of studentIds) {
          if (!targetSids.has(sid)) continue;

          const stuResults = resultsByStudent[sid];
          if (!stuResults || stuResults.length === 0) continue;

          const stuObj = sectionList.find(s => String(s.id) === sid);
          if (!stuObj) continue;

          const fn = (stuObj.user?.first_name || '').toUpperCase();
          const ln = (stuObj.user?.last_name || '').toUpperCase();
          const fullName = (fn + ' ' + ln).trim();
          if (fullName.includes('TC') || fn.includes('TC') || ln.includes('TC')) continue;
          if (!fn && !ln && !stuObj.roll_number) continue;

          // 1. Religion suppression & Deduplication logic (exactly matching MeritListPage)
          const relResults = stuResults.filter(r => isRelSubjLocal(r.subject?.name || r.subject_name));
          let suppressedIds = new Set();
          if (relResults.length > 1) {
              const withMarks = relResults.map(r => {
                  const w = sumStr(r.written_marks), m = sumStr(r.mcq_marks), p = sumStr(r.practical_marks);
                  const total = (w + m + p) > 0 ? (w + m + p) : (parseFloat(r.total_obtained) || 0);
                  const hasParts = (r.written_marks !== '' && r.written_marks !== null) || (r.mcq_marks !== '' && r.mcq_marks !== null) || (r.practical_marks !== '' && r.practical_marks !== null);
                  return { sid: String(r.subject?.id || r.subject || r.subject_name), total, hasParts };
              }).filter(x => x.total > 0).sort((a, b) => {
                  if (a.hasParts !== b.hasParts) return a.hasParts ? -1 : 1;
                  return b.total - a.total;
              });
              if (withMarks.length > 0) {
                  const bestRelId = withMarks[0].sid;
                  relResults.forEach(r => {
                      const rid = String(r.subject?.id || r.subject || r.subject_name);
                      if (rid !== bestRelId) suppressedIds.add(rid);
                  });
              }
          }

          const subjectMap = new Map();
          stuResults.forEach(r => {
              const rSid = String(r.subject?.id || r.subject || r.subject_name);
              if (suppressedIds.has(rSid)) return;

              const rawName = String(r.subject_name || r.subject?.name || '').toLowerCase().trim();
              let key = normalizeSubjKeyLocal(rawName);

              // Distinguish papers for deduplication
              if (key === 'bangla' || key === 'english') {
                  const is2 = BN_2ND_REGEX.test(rawName);
                  key = key + (is2 ? '_p2' : '_p1');
              }

              // Skip redundant combined records if specific papers exist (Matches Merit List logic)
              const isCombined = !rawName.match(/(1st|2nd|১ম|২য়|২য়)/);
              const hasSpecificPapers = stuResults.some(x => {
                  const xName = String(x.subject_name || x.subject?.name || '').toLowerCase();
                  const xKey = normalizeSubjKeyLocal(xName);
                  return (xKey.startsWith(key.split('_')[0]) && xName.match(/(1st|2nd|১ম|২য়|২য়)/)) || xKey === key + '_p1' || xKey === key + '_p2';
              });
              if (isNT && isCombined && hasSpecificPapers) return;

              const w = sumStr(r.written_marks), m = sumStr(r.mcq_marks), p = sumStr(r.practical_marks);
              const rTotal = (w + m + p) > 0 ? (w + m + p) : (parseFloat(r.total_obtained) || 0);
              const hasActualMarks = (r.written_marks !== '' && r.written_marks !== null) || (r.mcq_marks !== '' && r.mcq_marks !== null) || (r.practical_marks !== '' && r.practical_marks !== null);

              const existing = subjectMap.get(key);
              if (!existing || (hasActualMarks && !existing.hasActualMarks) || (hasActualMarks === !!existing.hasActualMarks && rTotal > (existing.total_obtained || 0))) {
                  subjectMap.set(key, { ...r, sumW: w, sumM: m, sumP: p, hasActualMarks, total_obtained: rTotal });
              }
          });

          // Re-group for calculation
          const consolidatedMap = new Map();
          Array.from(subjectMap.values()).forEach(r => {
              const nm = String(r.subject?.name || r.subject_name || '').toLowerCase();
              let key = normalizeSubjKeyLocal(nm);
              if (!isNT && (key === 'bangla' || key === 'english')) {
                  const is2 = nm.includes('2nd') || nm.includes('২য়') || nm.includes('২য়') || nm.includes('second');
                  key = key + (is2 ? '_p2' : '_p1');
              }
              if (!consolidatedMap.has(key)) consolidatedMap.set(key, []);
              consolidatedMap.get(key).push(r);
          });

          const classGroupFromAllResults = inferClassGroupFromAllResultsLocal(Object.values(resultsByStudent).flat(), isNT, contextSubjects);
          const group = (stuObj.student_group || stuObj.group || inferGroupLocal(stuResults, isNT, stuObj) || classGroupFromAllResults || '').toLowerCase();
          const expectedKeys = getExpectedSubjectsLocal(group, isNT, sectionSubjs, classAssignedSubjectNames);
          const relWithMarks = Array.from(subjectMap.values()).find(r => isRelSubjLocal(r.subject?.name || r.subject_name) && (parseFloat(r.total_obtained) > 0));
          const takenRelId = relWithMarks?.subject?.id || relWithMarks?.subject;

          let score = 0, fails = 0, totalPoints = 0, subjectCount = 0, hasAnyMarks = false;
          const allSubjectKeys = new Set([...consolidatedMap.keys(), ...expectedKeys, 'higher', 'agriculture']);
          let electiveCounted = false;

          allSubjectKeys.forEach(key => {
              const papers = consolidatedMap.get(key) || [];
              const isRel = isRelSubjLocal(key);
              let isMandatory = expectedKeys.has(key);
              const belongsToGroup = (isScienceGroupLocal(group) && ['physics', 'chemistry', 'biology'].includes(key)) ||
                                     (isCommerceGroupLocal(group) && ['accounting', 'finance', 'business'].includes(key)) ||
                                     (isHumanitiesGroupLocal(group) && ['history', 'geography', 'civics', 'economics'].includes(key));

              if (isNT && isHumanitiesGroupLocal(group)) {
                  if (key === 'civics' || key === 'economics') {
                      if (papers.length > 0 && !electiveCounted) {
                          isMandatory = true; electiveCounted = true;
                      } else if (key === 'civics' && consolidatedMap.has('economics')) {
                          isMandatory = false;
                      } else if (key === 'economics' && consolidatedMap.has('civics')) {
                          isMandatory = false;
                      } else if (key === 'civics' && !electiveCounted && !consolidatedMap.has('economics')) {
                          isMandatory = true; electiveCounted = true;
                      } else {
                          isMandatory = false;
                      }
                  }
              }

              if (isMandatory || belongsToGroup) { if (!isRel || (isRel && (!takenRelId || consolidatedMap.has(key)))) { subjectCount++; } }

              if (papers.length === 0) {
                  if (isMandatory) {
                      if (isRel && takenRelId) return;
                      if (isNT) {
                          if (isScienceGroupLocal(group) && key === 'science') return;
                          if (!isScienceGroupLocal(group) && ['physics', 'chemistry', 'biology', 'bgs'].includes(key)) return;
                      }
                      if (!isNT && (key === 'bangla' || key === 'english')) {
                          if (consolidatedMap.has(key + '_p1') || consolidatedMap.has(key + '_p2')) return;
                      }
                      if (stuResults.length > 0) {
                           if (!(isNT === false && (key.includes('শারীরিক') || key.includes('physical')))) {
                               fails++;
                           }
                      }
                  }
                  return;
              }

              let tMarks = 0, tPoss = 0, sumW = 0, sumM = 0, sumP = 0, cqMax = 0, mcqMax = 0, prMax = 0, pPresent = false;
              papers.forEach(r => {
                  const w = sumStr(r.written_marks), m = sumStr(r.mcq_marks), p = sumStr(r.practical_marks);
                  const hasActual = (r.hasActualMarks !== undefined ? r.hasActualMarks : ((r.written_marks !== '' && r.written_marks !== null) || (r.mcq_marks !== '' && r.mcq_marks !== null) || (r.practical_marks !== '' && r.practical_marks !== null)));
                  if (hasActual || (w+m+p) > 0 || parseFloat(r.total_obtained) > 0) { hasAnyMarks = true; pPresent = true; }
                  const spec = getSubjectMaxima(r.subject?.name || r.subject_name, isNT, group);
                  const maxPossible = (spec.cq + spec.mcq + spec.pr || 100);

                  let obt = (w + m + p) > 0 ? (w + m + p) : (parseFloat(r.total_obtained) || 0);
                  const cappedObt = obt > maxPossible ? maxPossible : obt;

                  tMarks += cappedObt; tPoss += maxPossible;
                  sumW += w; sumM += m; sumP += p;
                  cqMax += spec.cq; mcqMax += spec.mcq; prMax += spec.pr;
              });

              if (isNT && (key === 'bangla' || key === 'english')) { tPoss = Math.max(tPoss, 200); if (tMarks > 200) tMarks = 200; }

              const cqPass = cqMax === 0 || sumW >= Math.round(cqMax * 0.33 - 0.5);
              const mcqPass = mcqMax === 0 || sumM >= Math.round(mcqMax * 0.33 - 0.5);
              const prPass = prMax === 0 || sumP >= Math.round(prMax * 0.33 - 0.5);
              const totPass = tMarks >= Math.round(tPoss * 0.33 - 0.5);

              const isCoCurric = isCoCurricularLocal(key, isNT);
              let isPassed = pPresent && (isNT ? (isCoCurric ? totPass : (cqPass && mcqPass && prPass && totPass)) : totPass);
              // SPECIAL SYNC: School 63 English/Combined Subject Correction (mirror MeritListPage.jsx L591-592)
              if (isNT && key === 'english' && tPoss === 200 && tMarks >= 66) isPassed = true;
              if (isNT && key === 'english' && tPoss === 100 && tMarks >= 33) isPassed = true;
              const gp = isPassed ? computeGpa((tMarks / tPoss) * 100) : 0;

              if (key === 'higher' || key === 'agriculture') {
                  if (isNT) {
                      const threshold = tPoss * 0.4;
                      if (tMarks > threshold) { score += (tMarks - threshold); }
                      totalPoints += Math.max(0, gp - 2.0);
                  }
              } else if (isMandatory || belongsToGroup) {
                  if (!isNT && (key === 'higher' || key === 'agriculture')) return;
                  score += tMarks; totalPoints += gp;
                  if (isMandatory && !isPassed) {
                      if (!(isNT === false && (key.includes('শারীরিক') || key.includes('physical')))) {
                          fails++;
                      }
                  }
              }
          });
          const finalCgpa = (subjectCount > 0 && fails === 0) ? Math.min(5.0, totalPoints / subjectCount) : 0;
          const studentRoll = stuObj.roll_number ? parseInt(String(stuObj.roll_number).replace(/\D/g, ''), 10) : 999999;

          resultsPool.push({ sid, total: Math.round(score), rawScore: score, points: finalCgpa, fails, isAbsent: !hasAnyMarks, roll: studentRoll, section_id: String(stuObj.section?.id || stuObj.section || 'other') });

          overallByStudent[sid] = {
              percentage: (score / (subjectCount * 100) * 100).toFixed(2),
              total_marks_obtained: Math.round(score),
              cgpa: finalCgpa.toFixed(2),
              is_passed: fails === 0 && hasAnyMarks,
              grade: fails === 0 ? 'Passed' : 'Failed'
          };
      }

      const finalRankMap = {};
      const bySectionMap = new Map();
      resultsPool.forEach(item => {
        // CRITICAL FIX: If we are looking for a specific section, only include students from that section in the ranking bucket
        if (selectedSection) {
            if (String(item.section_id) === String(selectedSection)) {
                if (!bySectionMap.has('single')) bySectionMap.set('single', []);
                bySectionMap.get('single').push(item);
            }
        } else {
            const sId = item.section_id || 'other';
            if (!bySectionMap.has(sId)) bySectionMap.set(sId, []);
            bySectionMap.get(sId).push(item);
        }
      });

      for (const sectionItems of bySectionMap.values()) {
        sectionItems.sort((a, b) => {
          if (a.isAbsent !== b.isAbsent) return a.isAbsent ? 1 : -1;
          const aPassed = (a.fails === 0);
          const bPassed = (b.fails === 0);
          if (aPassed !== bPassed) return aPassed ? -1 : 1;
          if (a.fails !== b.fails) return a.fails - b.fails;
          if (Math.abs(b.points - a.points) > 0.0001) return b.points - a.points;
          if (Math.abs(b.rawScore - a.rawScore) > 0.01) return b.rawScore - a.rawScore;
          return (Number(a.roll) || 0) - (Number(a.roll) || 0);
        });
        sectionItems.forEach((c, idx) => {
          finalRankMap[c.sid] = c.isAbsent ? null : (idx + 1);
        });
      }

      studentIds.forEach(sid => {
        if (overallByStudent[sid]) {
          const fRank = finalRankMap[sid];
          overallByStudent[sid].rank = fRank || null;
          overallByStudent[sid].rank_in_section = fRank || null;
        }
      });

      // Sort sectionList strictly by Roll Number for bulk card generation sequence
      sectionList.sort((a, b) => {
        const aRoll = parseInt(String(a.roll_number || '').replace(/\D/g, ''), 10) || 999999;
        const bRoll = parseInt(String(b.roll_number || '').replace(/\D/g, ''), 10) || 999999;
        return aRoll - bRoll;
      });

      // 6. GENERATE CARDS IN PARALLEL
      const promises = sectionList.map(async s => {
        const sIdStr = String(s.id);
        const stuResults = resultsByStudent[sIdStr] || [];
        const stuOverall = overallByStudent[sIdStr] || null;
        return await buildCardForStudent(s.id, s, stuResults, stuOverall, sectionSubjs, validSubjKeys, attendanceMap[sIdStr]);
      });

      const allGeneratedCards = (await Promise.all(promises)).filter(Boolean);
      setBulkCards(allGeneratedCards);

      toast.success('সব কার্ড জেনারেট সম্পন্ন');
      setBulkLoading(false);
      if (allGeneratedCards.length > 0) {
        setTimeout(() => {
          handleBulkPrint();
        }, 300);
      }
    } catch (e) {
      console.error('Bulk generation error:', e);
      toast.error('বাল্ক জেনারেশনে সমস্যা হয়েছে।');
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
            disabled={loading || bulkLoading || (!selectedStudent && !selectedClass) || !selectedExamType}
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
            disabled={loading || bulkLoading || (!selectedStudent && !selectedClass) || !selectedExamType}
            sx={{ bgcolor: '#1a237e', '&:hover': { bgcolor: '#0d1642' } }}
          >
            {isTranslating ? 'AI অনুবাদ হচ্ছে...' : 'ইংরেজিতে মার্কশীট তৈরি করুন'}
          </Button>

          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={() => handleGenerateBulkCards('en')}
            color="secondary"
            disabled={bulkLoading || !selectedExamType || !selectedClass}
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
              <AcademicTranscriptCard
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
                    <AcademicTranscriptCard
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
