import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Paper, Stack, Button, TextField, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, Backdrop } from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import api from '../utils/api';
import { scopedGet } from '../utils/schoolApi';
import { useAcademics } from '../context/AcademicsContext';
import { useSchool } from '../context/SchoolContext';
import { getMediaUrl } from '../utils/media';

const UNWANTED_SUBJECTS = [];

const BN_TO_EN_CLASS_MAP = { 'প্রথম': 'One', 'দ্বিতীয়': 'Two', 'তৃতীয়': 'Three', 'তৃতীয়': 'Three', 'চতুর্থ': 'Four', 'পঞ্চম': 'Five', 'ষষ্ঠ': 'Six', 'সপ্তম': 'Seven', 'অষ্টম': 'Eight', 'নবম': 'Nine', 'দশম': 'Ten', 'শ্রেণী': '', 'শ্রেণি': '', 'শেণি': '', 'Class': '' };
const SEC_MAP = { 'মানবিক': 'Humanities', 'বিজ্ঞান': 'Science', 'ব্যবসায় শিক্ষা': 'Commerce', 'ব্যবসা': 'Commerce', 'ব্যবসায়': 'Commerce', 'ব্যবসায়': 'Commerce', 'ক': 'A', 'খ': 'B', 'গ': 'C', 'ঘ': 'D', 'এ': 'A', 'বি': 'B', 'সি': 'C', 'ডি': 'D' };

const CO_CURRICULAR_SUBJECTS = [
  'শারীরিক শিক্ষা ও স্বাস্থ্য', 'শারীরিক শিক্ষা', 'Physical Education', 'Physical Education and Health',
  'ক্যারিয়ার শিক্ষা', 'ক্যারিয়ার শিক্ষা', 'Career Education', 'ক্যারিয়ার', 'ক্যারিয়ার',
  'Word Collection Achievement Test', 'WCAT', 'Word Achievement',
  'বই পড়া', 'বই পড়া', 'চারু ও কারুকলা', 'Arts and Crafts', 'Continuous Assessment', 'ধারাবাহিক মূল্যায়ন', 'Life and Work',
  'Work and Life', 'Work and Life Education', 'কর্ম ও জীবনমুখী শিক্ষা', 'কর্ম ও জীবনমুখী'
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
  const [downloading, setDownloadInProgress] = useState(false);
  const [forceLanguage, setForceLanguage] = useState('bn');

  const labels = useMemo(() => ({
    bn: {
      roll: "রোল",
      name: "শিক্ষার্থীর নাম",
      total: "মোট",
      merit: "মেরিট",
      absent: "অনুপস্থিত",
      class: "শ্রেণি",
      section: "শাখা",
      resultsTitle: "শ্রেণি ভিত্তিক ফলাফল",
      all: "সব",
      back: "ব্যাক",
      print: "প্রিন্ট",
      download: "পিডিএফ ডাউনলোড",
      loading: "লোড হচ্ছে...",
      noData: "কোনো তথ্য পাওয়া যায়নি"
    },
    en: {
      roll: "Roll",
      name: "Student Name",
      total: "Total",
      merit: "Merit",
      absent: "Absent",
      class: "Class",
      section: "Section",
      resultsTitle: "Class-wise Results",
      all: "All",
      back: "Back",
      print: "Print",
      download: "Download PDF",
      loading: "Loading...",
      noData: "No data found"
    }
  }), []);

  const translateSubject = useCallback((name) => {
    if (forceLanguage === 'bn' || !name) return name;

    const subMap = {
      'বাংলাদেশ ও বিশ্বপরিচয়': 'BGS',
      'বাংলাদেশ ও বিশ্বপরিচয়': 'BGS',
      'বাংলাদেশ ও বিশ্ব পরিচয়': 'BGS',
      'তথ্য ও যোগাযোগ প্রযুক্তি': 'ICT',
      'উচ্চতর গণিত': 'Higher Math',
      'উচ্চতর গনিত': 'Higher Math',
      'ইসলাম ও নৈতিক শিক্ষা': 'Religion (Islam)',
      'ইসলাম শিক্ষা': 'Religion (Islam)',
      'হিন্দুধর্ম ও নৈতিক শিক্ষা': 'Religion (Hindu)',
      'হিন্দু ধর্ম শিক্ষা': 'Religion (Hindu)',
      'হিন্দু ধর্ম': 'Religion (Hindu)',
      'পৌরনীতি ও নাগরিকতা': 'Civics',
      'ইতিহাস ও বিশ্বসভ্যতা': 'History',
      'ভূগোল ও পরিবেশ': 'Geography',
      'হিসাববিজ্ঞান': 'Accounting',
      'হিসাব বিজ্ঞান': 'Accounting',
      'ব্যবসায় উদ্যোগ': 'Business Ent.',
      'ব্যবসায় শিক্ষা': 'Business Studies',
      'গার্হস্থ্য বিজ্ঞান': 'Home Science',
      'কৃষি শিক্ষা': 'Agriculture',
      'শারীরিক শিক্ষা ও স্বাস্থ্য': 'Physical Education',
      'শারীরিক শিক্ষা': 'Physical Ed.',
      'চারু ও কারুকলা': 'Arts & Crafts',
      'কর্ম ও জীবনমুখী শিক্ষা': 'Work & Life',
      'ক্যারিয়ার শিক্ষা': 'Career Ed.',
      'বই পড়া': 'Book Reading',
      'বাংলা ১ম পত্র': 'Bangla 1st Paper',
      'বাংলা ২য় পত্র': 'Bangla 2nd Paper',
      'বাংলা ২য় পত্র': 'Bangla 2nd Paper',
      'ইংরেজি ১ম পত্র': 'English 1st Paper',
      'ইংরেজি ২য় পত্র': 'English 2nd Paper',
      'ইংরেজি ২য় পত্র': 'English 2nd Paper',
      'বাংলা': 'Bangla',
      'ইংরেজি': 'English',
      'ইংরেজী': 'English',
      'গণিত': 'Mathematics',
      'বিজ্ঞান': 'Science',
      'ধর্ম': 'Religion',
      '১ম পত্র': '1st Paper',
      '২য় পত্র': '2nd Paper',
      '২য় পত্র': '2nd Paper',
      '১ম': '1st',
      '২য়': '2nd',
      '২য়': '2nd',
      'পদার্থ বিজ্ঞান': 'Physics',
      'পদার্থবিজ্ঞান': 'Physics',
      'রসায়ন': 'Chemistry',
      'রসায়ন': 'Chemistry',
      'জীববিজ্ঞান': 'Biology',
      'জীব বিজ্ঞান': 'Biology',
      'উচ্চতর গণিত': 'Higher Math'
    };

    let translated = String(name);
    // Sort keys by length descending to ensure longest phrases are replaced first
    const sortedKeys = Object.keys(subMap).sort((a, b) => b.length - a.length);

    sortedKeys.forEach(bn => {
      if (translated.includes(bn)) {
        translated = translated.replace(new RegExp(bn, 'g'), subMap[bn]);
      }
    });

    return translated.trim();
  }, [forceLanguage]);

  const n = useCallback((v) => {
    if (forceLanguage === 'en') return v;
    return String(v ?? '').replace(/[0-9]/g, d => ['০','১','২','৩','৪','৫','৬','৭','৮','৯'][d]);
  }, [forceLanguage]);

  const l = labels[forceLanguage] || labels.bn;

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
    const type = String(t || '').toLowerCase();

    // For Class 9/10, Pre-Test is effectively Half-Yearly
    const isNineTen = isClassNineOrTen;
    if (isNineTen) {
        if (/pre-test|প্রাক-নির্বাচনী/.test(n) || type === 'pre_test') return 'half_yearly';
    }

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
    return typeMap[type] || 'annual';
  };

  const isClassNineOrTen = useMemo(() => {
    const cls = classrooms.find(c => String(c.id) === String(selectedClass));
    if (!cls) return false;
    const text = String(cls.name || '').toLowerCase();
    return /নবম|দশম|ssc|\b9\b|\b10\b|\bnine\b|\bten\b|\bix\b|\bx\b|class\s*9|class\s*10|৯ম|১০ম/.test(text);
  }, [selectedClass, classrooms]);

  const isClassTen = useMemo(() => {
    const cls = classrooms.find(c => String(c.id) === String(selectedClass));
    if (!cls) return false;
    const text = String(cls.name || '').toLowerCase();
    return /দশম|ssc|\b10\b|\bten\b|class\s*10|১০ম/.test(text);
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

      const hasMarks = (w !== null && w !== undefined && w !== '') ||
                       (mcq !== null && mcq !== undefined && mcq !== '') ||
                       (pr !== null && pr !== undefined && pr !== '');

      const parts = [];
      if (w !== '' && w !== null) parts.push(w);
      if (mcq !== '' && mcq !== null) parts.push(mcq);
      if (pr !== '' && pr !== null) parts.push(pr);
      const components = parts.length > 0 ? `(${parts.join('+')})` : '';

      const finalVal = hasMarks ? `${Math.round(total)}=${parts.join('+')}` : 'Absent';
      m.set(key, { total, display: finalVal, grade: r.grade, is_passed: r.is_passed });
    }

    // Handle merged papers
    if (isClassNineOrTen) {
        if (papers.bangla.length > 0) {
            const sum = papers.bangla.reduce((s, r) => s + ((parseFloat(r.written_marks)||0) + (parseFloat(r.mcq_marks)||0) + (parseFloat(r.practical_marks)||0)), 0);
            const compStr = papers.bangla.map(r => Math.round((parseFloat(r.written_marks)||0) + (parseFloat(r.mcq_marks)||0) + (parseFloat(r.practical_marks)||0))).join('+');
            const hasAnyMarks = papers.bangla.some(r => (r.written_marks !== '' && r.written_marks !== null) || (r.mcq_marks !== '' && r.mcq_marks !== null) || (r.practical_marks !== '' && r.practical_marks !== null));
            const displayVal = hasAnyMarks ? `${Math.round(sum)}=${compStr}` : 'Absent';
            m.set('merged-bangla', { total: sum, display: displayVal });
        }
        if (papers.english.length > 0) {
            const sum = papers.english.reduce((s, r) => s + ((parseFloat(r.written_marks)||0) + (parseFloat(r.mcq_marks)||0) + (parseFloat(r.practical_marks)||0)), 0);
            const compStr = papers.english.map(r => Math.round((parseFloat(r.written_marks)||0) + (parseFloat(r.mcq_marks)||0) + (parseFloat(r.practical_marks)||0))).join('+');
            const hasAnyMarks = papers.english.some(r => (r.written_marks !== '' && r.written_marks !== null) || (r.mcq_marks !== '' && r.mcq_marks !== null) || (r.practical_marks !== '' && r.practical_marks !== null));
            const displayVal = hasAnyMarks ? `${Math.round(sum)}=${compStr}` : 'Absent';
            m.set('merged-english', { total: sum, display: displayVal });
        }
    }

    return m;
  }, [resultsByStudent, isClassNineOrTen]);

  useEffect(() => {
    if (!selectedClass) { setExaminations([]); setResultsByStudent(new Map()); return; }
    setLoading(true);
    scopedGet('/api/results/examinations/', id, { classroom: selectedClass, year: selectedYear, page_size: 1000 }).then(async res => {
        let all = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        const filterType = selectedExamType || 'all';
        let exams = filterType === 'all' ? all : all.filter(e => normalizeExamType(e.exam_type, e.name) === filterType);
        if (selectedExamId) exams = exams.filter(e => String(e.id) === String(selectedExamId));
        setExaminations(exams);

        const byStudent = new Map();
        try {
            // Optimized multi-page fetch: send year + section + exam filters to backend to minimize payload
            const fetchAllPages = async () => {
                let allItems = [];
                let page = 1;
                let hasNext = true;
                const maxPages = 5; // Year+section filtering reduces payload drastically

                while (hasNext && page <= maxPages) {
                    const rParams = {
                        classroom: selectedClass,
                        page: page,
                        page_size: 1000
                    };
                    if (selectedYear) rParams.year = selectedYear;
                    if (selectedSection) rParams.section = selectedSection;
                    if (selectedExamId) rParams.examination = selectedExamId;

                    const rRes = await scopedGet(`/api/results/results/`, id, rParams, { timeout: 60000 });
                    const data = rRes.data;
                    const items = Array.isArray(data) ? data : (data.results || []);
                    allItems = allItems.concat(items);

                    if (data.next && items.length > 0 && items.length >= (rParams.page_size || 1000)) {
                        page++;
                    } else {
                        hasNext = false;
                    }
                }

                // Fallback: if strict year+section returned 0 and we had filters, retry ONE PAGE WITHOUT year+section
                if (allItems.length === 0 && (selectedYear || selectedSection || selectedExamId)) {
                    try {
                        const fbParams = { classroom: selectedClass, page: 1, page_size: 1000 };
                        if (selectedExamId) fbParams.examination = selectedExamId;
                        const fbRes = await scopedGet('/api/results/results/', id, fbParams, { timeout: 45000 });
                        const fbData = fbRes.data;
                        allItems = Array.isArray(fbData) ? fbData : (fbData.results || []);
                    } catch (_) { /* ignore fallback error */ }
                }
                return allItems;
            };

            let arr = await fetchAllPages();

            // Filter by year on frontend to remain responsive to year changes
            if (selectedYear) {
                const yearStr = String(selectedYear);
                arr = arr.filter(r => {
                    const ex = r.examination || {};
                    const exYear = String(ex.year || ex.academic_year || '');
                    const dateYear = ex.exam_date ? String(new Date(ex.exam_date).getFullYear()) : '';

                    // If no year info, keep it (to be safe)
                    if (!exYear && !dateYear) return true;

                    return exYear === yearStr || dateYear === yearStr ||
                           (ex.name && ex.name.includes(yearStr));
                });
            }

            // Group by student
            for (const r of arr) {
                const sid = String(r.student?.id || r.student || '');
                if (!sid || sid === 'undefined') continue;
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
        if (cleanedByStudent.size === 0) setNoYearMessage(l.noData);
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

    // Detect group from: (1) section name, (2) classroom name, (3) MAJORITY of students' group field
    const cls = classrooms.find(c => String(c.id) === String(selectedClass));
    const sec = sections.find(s => String(s.id) === String(selectedSection));
    const groupName = (String(cls?.name || '') + ' ' + String(sec?.name || '')).toLowerCase();
    let isScienceGroup = groupName.includes('science') || groupName.includes('বিজ্ঞান');
    let isCommerceGroup = groupName.includes('commerce') || groupName.includes('business') || groupName.includes('ব্যবসায়') || groupName.includes('business studies');
    let isHumanitiesGroup = groupName.includes('arts') || groupName.includes('humanities') || groupName.includes('মানবিক');

    if (!isScienceGroup && !isCommerceGroup && !isHumanitiesGroup && students.length > 0) {
        const gCounts = { science: 0, commerce: 0, humanities: 0 };
        for (const s of students) {
            const g = String(s.student_group || s.group || '').toLowerCase();
            if (g === 'science' || g.includes('বিজ্ঞান')) gCounts.science++;
            else if (g === 'commerce' || g === 'business' || g.includes('ব্যবসায়') || g.includes('বাণিজ্য')) gCounts.commerce++;
            else if (g === 'arts' || g === 'humanities' || g.includes('মানবিক') || g.includes('কলা')) gCounts.humanities++;
        }
        const mx = Math.max(gCounts.science, gCounts.commerce, gCounts.humanities);
        if (mx > 0) {
            if (mx === gCounts.science) isScienceGroup = true;
            else if (mx === gCounts.commerce) isCommerceGroup = true;
            else if (mx === gCounts.humanities) isHumanitiesGroup = true;
        }
    }

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
            const artsSubjs = ['history', 'geography', 'civics', 'economics', 'ইতিহাস', 'ভূগোল', 'পৌরনীতি', 'পৌরণীতি', 'অর্থনীতি', 'পৌরনীতি ও নাগরিকতা', 'পৌরণীতি ও নাগরিকতা', 'বাংলাদেশের ইতিহাস ও বিশ্ব সভ্যতা', 'ভূগোল ও পরিবেশ'];
            const scienceSubjs = ['physics', 'chemistry', 'biology', 'higher math', 'পদার্থ', 'রসায়ন', 'জীব', 'উচ্চতর', 'bgs', 'বাংলাদেশ ও বিশ্ব', 'bangladesh and global', 'bangladesh & global'];

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

        if (clean === 'merged-bangla' || (clean.includes('বাংলা') && !clean.includes('বাংলাদেশ')) || (clean.includes('bangla') && !clean.includes('bangladesh'))) return 10;
        if (clean === 'merged-english' || clean.includes('english') || clean.includes('ইংরেজি') || clean.includes('ইংরেজী')) return 20;

        if (clean.includes('গণিত') || clean.includes('math')) {
            if (clean.includes('উচ্চতর') || clean.includes('higher')) return 1000;
            return 30;
        }
        if (clean.includes('ইসলাম') || clean.includes('islam') || clean.includes('ধর্ম') || clean.includes('religion')) return 40;
        if (clean.includes('আইসিটি') || clean.includes('ict') || clean.includes('তথ্য')) return 50;

        if (clean.includes('বাংলাদেশ') || clean.includes('bangladesh') || clean.includes('bgs')) {
            if (isScienceGroup) return 60;
            if (!isClassNineOrTen) return 60;
            return 75;
        }

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

        if (clean.includes('কৃষি') || clean.includes('agriculture') || clean.includes('গার্হস্থ্য') || clean.includes('home science')) return 1000;
        return 200;
    };

    const subjects = Array.from(set).map(s => ({
        label: translateSubject(s),
        key: s.toLowerCase(),
        isCoCurricular: CO_CURRICULAR_SUBJECTS.some(sub => s.toLowerCase().includes(sub.toLowerCase()))
    }));

    if (isClassNineOrTen) {
        if (hasEnglish) subjects.push({ label: forceLanguage === 'en' ? 'English (1st+2nd)' : 'ইংরেজি (১ম+২য়)', key: 'merged-english', isCoCurricular: false });
        if (hasBangla) subjects.push({ label: forceLanguage === 'en' ? 'Bangla (1st+2nd)' : 'বাংলা (১ম+২য়)', key: 'merged-bangla', isCoCurricular: false });
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
        const hasNoInfo = !fn && !ln && !username;

        return !isTC && !hasNoInfo;
    });
    list.sort((a, b) => {
        const ar = parseInt(String(a.roll_number || '').replace(/\D/g, ''), 10);
        const br = parseInt(String(b.roll_number || '').replace(/\D/g, ''), 10);
        if (!isNaN(ar) && !isNaN(br) && ar !== br) return ar - br;
        return String(a.roll_number || '').localeCompare(String(b.roll_number || ''), undefined, { numeric: true });
    });
    return list;
  }, [students]);

  const handleDownloadPDF = async () => {
    const tableEl = document.querySelector('.cr-table-wrap');
    if (!tableEl) return;
    setDownloadInProgress(true);
    try {
      const originalScrollY = window.scrollY;
      window.scrollTo(0, 0);

      // Add a temporary class to force print styles during capture
      document.body.classList.add('pdf-capture-active');

      const canvas = await html2canvas(tableEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1400 // Landscape-ish width
      });

      document.body.classList.remove('pdf-capture-active');
      window.scrollTo(0, originalScrollY);

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 5;
      const imgWidth = pdfWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const className = classrooms.find(c => String(c.id) === String(selectedClass))?.name || 'Class';
      const sectionName = sections.find(s => String(s.id) === String(selectedSection))?.name || 'All';
      pdf.save(`Results_${className}_${sectionName}_${selectedYear}.pdf`);
    } catch (err) {
      console.error('PDF Error:', err);
    } finally {
      setDownloadInProgress(false);
    }
  };

  return (
    <Box className="cr-print-container" sx={{ p: { xs: 1, sm: 3 }, "@media print": { p: 0, m: 0 } }}>
      <Stack className="no-print" direction={{ xs: 'column', sm: 'row' }} alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4"><AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />{l.resultsTitle}</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>{l.back}</Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadPDF}
            disabled={downloading || !sortedStudents.length}
            color="secondary"
          >
            {downloading ? l.loading : l.download}
          </Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>{l.print}</Button>
        </Stack>
      </Stack>

      <Paper className="no-print" sx={{ p: 2, mb: 3 }}>
        <Stack spacing={2} direction={{ xs: 'column', md: 'row' }}>
          <TextField
            select
            label={l.class}
            value={(classrooms && classrooms.length > 0 && classrooms.some(c => String(c.id) === String(selectedClass))) ? String(selectedClass) : ''}
            onChange={(e) => updateUrl(e.target.value, '', selectedExamType, '', selectedYear)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value=""><em>{forceLanguage === 'bn' ? 'শ্রেণি নির্বাচন করুন' : 'Select Class'}</em></MenuItem>
            {classrooms.map(cls => <MenuItem key={cls.id} value={String(cls.id)}>{cls.name}</MenuItem>)}
          </TextField>
          <TextField
            select
            label={l.section}
            value={(sections && sections.length > 0 && sections.some(s => String(s.id) === String(selectedSection))) ? String(selectedSection) : ''}
            onChange={(e) => updateUrl(selectedClass, e.target.value, selectedExamType, selectedExamId, selectedYear)}
            sx={{ minWidth: 150 }}
            disabled={!selectedClass}
          >
            <MenuItem value="">{l.all}</MenuItem>
            {sections.map(sec => <MenuItem key={sec.id} value={String(sec.id)}>{sec.name}</MenuItem>)}
          </TextField>
          <TextField type="number" label={forceLanguage === 'bn' ? 'সাল' : 'Year'} value={selectedYear} onChange={(e) => updateUrl(selectedClass, selectedSection, selectedExamType, selectedExamId, e.target.value)} sx={{ width: 100 }} />
          <TextField
            select
            label={forceLanguage === 'bn' ? 'ভাষা' : 'Language'}
            value={forceLanguage}
            onChange={(e) => setForceLanguage(e.target.value)}
            sx={{ minWidth: 100 }}
            size="small"
          >
            <MenuItem value="bn">বাংলা</MenuItem>
            <MenuItem value="en">English</MenuItem>
          </TextField>
          <Button variant="contained" onClick={() => updateUrl(selectedClass, '', 'all', '', new Date().getFullYear())}>{l.all}</Button>
        </Stack>
      </Paper>

      {sortedStudents.length > 0 && (
          <Box className="cr-table-wrap" sx={{ width: '100%', display: 'block' }}>
              {/* Print-only School Header - Moved outside Table to improve thead repetition */}
              <Box className="print-only" sx={{
                display: 'none',
                "@media print": {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  mb: 2,
                  borderBottom: '3px solid #000',
                  pb: 2,
                  pt: 1
                }
              }}>
                  <Box sx={{ width: '100px', textAlign: 'left' }}>
                      {schoolInfo?.logo && (
                          <Box component="img" src={getMediaUrl(schoolInfo.logo)} sx={{ height: '70px', objectFit: 'contain' }} />
                      )}
                  </Box>

                  <Box sx={{ textAlign: 'center', flex: 1, px: 2 }}>
                                  <Typography sx={{ fontWeight: 600, color: '#000', fontSize: '32px !important', lineHeight: 1.2, fontFamily: "'Hind Siliguri', sans-serif", textTransform: 'uppercase' }}>
                                      {(() => {
                                          if (forceLanguage === 'bn') return (schoolInfo?.bn_name || schoolInfo?.name);
                                          let name = schoolInfo?.name_en || schoolInfo?.name || "";
                                          const map = {
                                              'বহরিয়া': 'BAHORIA', 'উচ্চ বিদ্যালয়': 'HIGH SCHOOL', 'উচ্চ বিদ্যালয়': 'HIGH SCHOOL',
                                              'উচ্চ বিদ্যা লয়': 'HIGH SCHOOL', 'উচ্চ বিদ্যা লয়': 'HIGH SCHOOL',
                                              'সরকারি': 'GOVT.', 'সরকারী': 'GOVT.', 'বালিকা': 'GIRLS', 'বালক': 'BOYS',
                                              'হামানকর্দ্দি': 'HAMANKARDI', 'পল্লী মঙ্গল': 'POLLI MONGOL'
                                          };
                                          Object.entries(map).forEach(([bn, en]) => {
                                              name = name.replace(new RegExp(bn, 'g'), en);
                                          });
                                          return name.toUpperCase();
                                      })()}
                                  </Typography>
                                  <Typography sx={{ fontWeight: 600, color: '#000', fontSize: '22px !important', mt: 0.2 }}>
                                      {l.resultsTitle}
                                  </Typography>
                                  <Typography sx={{ fontWeight: 600, fontSize: '18px !important', color: '#000' }}>
                                      {selectedExamId ? (examinations.find(e => String(e.id) === String(selectedExamId))?.name) :
                                        (selectedExamType === 'all' ? (isClassTen ? (forceLanguage === 'en' ? `Pre-Test-${selectedYear}` : `প্রাক-নির্বাচনী-${selectedYear}`) : (forceLanguage === 'en' ? `Half Yearly-${selectedYear}` : `অর্ধ বার্ষিক-${selectedYear}`)) :
                                         (selectedExamType === 'half_yearly' ? (isClassTen ? (forceLanguage === 'en' ? `Pre-Test-${selectedYear}` : `প্রাক-নির্বাচনী-${selectedYear}`) : (forceLanguage === 'en' ? `Half Yearly Exam-${selectedYear}` : `অর্ধবার্ষিক পরীক্ষা-${selectedYear}`)) :
                                          (selectedExamType === 'annual' ? (forceLanguage === 'en' ? `Annual Exam-${selectedYear}` : `বার্ষিক পরীক্ষা-${selectedYear}`) :
                                            (selectedExamType === 'test' ? (forceLanguage === 'en' ? `Test Exam-${selectedYear}` : `টেস্ট পরীক্ষা-${selectedYear}`) :
                                              (selectedExamType === 'terminal' ? (forceLanguage === 'en' ? `Terminal Exam-${selectedYear}` : `টার্মিনাল পরীক্ষা-${selectedYear}`) : `${forceLanguage === 'en' ? 'Result' : 'ফলাফল'}-${selectedYear}`)))))}
                                  </Typography>
                                  <Typography sx={{ fontWeight: 600, fontSize: '16px !important', mt: 1 }}>
                                      {l.class} : {(() => {
                                          let name = classrooms.find(c => String(c.id) === String(selectedClass))?.name || '---';
                                          if (forceLanguage === 'en') {
                                              Object.keys(BN_TO_EN_CLASS_MAP).forEach(k => { name = name.replace(new RegExp(k, 'gi'), BN_TO_EN_CLASS_MAP[k]); });
                                          }
                                          return name.trim();
                                      })()} |
                                      {l.section} : {(() => {
                                          let sec = sections.find(s => String(s.id) === String(selectedSection))?.name || l.all;
                                          if (forceLanguage === 'en' && SEC_MAP[sec]) return SEC_MAP[sec];
                                          return sec;
                                      })()}
                                  </Typography>
                  </Box>

                  <Box sx={{ width: '100px', textAlign: 'right' }}>
                      {schoolInfo?.logo && (
                          <Box component="img" src={getMediaUrl(schoolInfo.logo)} sx={{ height: '70px', objectFit: 'contain' }} />
                      )}
                  </Box>
              </Box>

              <TableContainer
                component={Paper}
                sx={{
                  boxShadow: 'none',
                  background: 'white',
                  overflow: 'visible',
                  "@media print": {
                    display: 'table',
                    width: '100%'
                  }
                }}
              >
                <Table size="small" sx={{
                  minWidth: { xs: 800, print: '100%' },
                  tableLayout: 'auto',
                  borderCollapse: 'collapse',
                  "@media print": {
                    width: '100% !important',
                    display: 'table !important',
                    borderSpacing: 0
                  }
                }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#dddddd', backgroundImage: 'none', "@media print": { bgcolor: '#dddddd !important', display: 'table-row !important' } }}>
                      <TableCell sx={{ color: 'black', textAlign: 'center', fontWeight: 700, fontSize: { xs: '1.2rem', print: '9pt' }, border: '1.5px solid #000 !important', py: '4px !important', whiteSpace: 'nowrap' }}>{l.roll}</TableCell>
                      <TableCell sx={{ color: 'black', fontWeight: 700, fontSize: { xs: '1.2rem', print: '9pt' }, border: '1.5px solid #000 !important', py: '4px !important', whiteSpace: 'nowrap' }}>{l.name}</TableCell>
                      {displaySubjects.map(s => {
                        const isHindu = s.label.includes('হিন্দু');
                        const isEnglish = s.label.toLowerCase().includes('english') || s.label.includes('ইংরেজি');
                        return (
                          <TableCell
                            key={s.key}
                            sx={{
                              color: 'black',
                              textAlign: 'center',
                              fontWeight: 700,
                              fontSize: { xs: '1.1rem', print: '8pt' },
                              lineHeight: 1,
                              padding: '2px 1px',
                              border: '1.5px solid #000 !important',
                              whiteSpace: 'nowrap',
                              width: isHindu ? '45px' : (isEnglish ? '65px' : '60px'),
                              minWidth: isHindu ? '45px' : (isEnglish ? '65px' : '60px'),
                              bgcolor: '#dddddd !important',
                              WebkitPrintColorAdjust: 'exact'
                            }}
                            align="center"
                          >
                            {s.label}
                          </TableCell>
                        );
                      })}
                      <TableCell sx={{ color: 'black', fontWeight: 700, fontSize: { xs: '1.2rem', print: '11pt' }, border: '1.5px solid #000 !important', py: '4px !important' }} align="center">{l.total}</TableCell>
                      <TableCell sx={{ color: 'black', fontWeight: 700, fontSize: { xs: '1.2rem', print: '11pt' }, border: '1.5px solid #000 !important', py: '4px !important' }} align="center">{l.merit}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedStudents.map(stu => {
                      const resMap = getStudentResultsMap(stu.id);
                      return (
                        <TableRow key={stu.id} sx={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                          <TableCell align="center" sx={{ border: '1.2px solid #000 !important', py: '6px !important', fontWeight: 700, fontSize: { xs: '11pt', print: '9pt' }, whiteSpace: 'nowrap' }}>{n(stu.roll_number)}</TableCell>
                          <TableCell sx={{ border: '1.2px solid #000 !important', fontWeight: 700, whiteSpace: 'normal', wordBreak: 'break-word', py: '6px !important', fontSize: { xs: '11pt', print: '9pt' }, minWidth: '120px' }}>
                              {forceLanguage === 'en' ? (stu.user?.first_name_en || stu.user?.first_name) : stu.user?.first_name} {forceLanguage === 'en' ? (stu.user?.last_name_en || stu.user?.last_name) : stu.user?.last_name}
                          </TableCell>
                          {displaySubjects.map(sub => {
                            const isHindu = sub.label.includes('Religion (Hindu)') || sub.label.includes('হিন্দু');
                            const r = resMap.get(sub.key);
                            if (!r) {
                              const keys = Array.from(resMap.keys());
                              const lowSub = sub.key.toLowerCase();
                              const isReligion = lowSub.includes('ইসলাম') || lowSub.includes('islam') || lowSub.includes('হিন্দু') || lowSub.includes('hindu') || lowSub.includes('ধর্ম') || lowSub.includes('religion');
                              const isOptional = lowSub.includes('কৃষি') || lowSub.includes('agriculture') || lowSub.includes('উচ্চতর') || lowSub.includes('higher') || lowSub.includes('গার্হস্থ্য') || lowSub.includes('home science');

                              if (isReligion) {
                                  const hasOtherReligion = keys.some(k => (k.includes('ইসলাম') || k.includes('islam') || k.includes('হিন্দু') || k.includes('hindu') || k.includes('ধর্ম') || k.includes('religion')) && k !== lowSub);
                                  if (hasOtherReligion) return <TableCell key={sub.key} align="center" sx={{ border: '1px solid #000 !important', width: isHindu ? '45px' : '55px', minWidth: isHindu ? '45px' : '55px', py: '6px !important', fontSize: '8pt' }}>--</TableCell>;
                              }
                              if (isOptional) {
                                  const hasOtherOptional = keys.some(k => (k.includes('কৃষি') || k.includes('agriculture') || k.includes('উচ্চতর') || k.includes('higher') || k.includes('গার্হস্থ্য') || k.includes('home science')) && k !== lowSub);
                                  if (hasOtherOptional) return <TableCell key={sub.key} align="center" sx={{ border: '1px solid #000 !important', width: isHindu ? '45px' : '55px', minWidth: isHindu ? '45px' : '55px', py: '6px !important', fontSize: '8pt' }}>--</TableCell>;
                              }
                              return <TableCell key={sub.key} align="center" sx={{ color: 'red', border: '1px solid #000 !important', width: isHindu ? '45px' : '55px', minWidth: isHindu ? '45px' : '55px', py: '6px !important', fontSize: '8pt' }}>{l.absent}</TableCell>;
                            }
                            const isAbs = String(r.display || '').includes('Absent') || String(r.display || '').includes('অনুপস্থিত');
                            const isFail = r.grade === 'F' || r.is_passed === false;
                            return (
                              <TableCell key={sub.key} align="center" sx={{ color: (isAbs || isFail) ? 'red' : 'inherit', border: '1px solid #000 !important', fontWeight: 700, whiteSpace: 'normal', wordBreak: 'break-word', width: isHindu ? '45px' : '55px', minWidth: isHindu ? '45px' : '55px', py: '6px !important', fontSize: '8pt' }}>
                                {isAbs ? l.absent : n(r.display || r.total)}
                              </TableCell>
                            );
                          })}
                          <TableCell align="center" sx={{ border: '1.2px solid #000 !important', fontWeight: 700, py: '6px !important', fontSize: { xs: '11pt', print: '9pt' } }}>{n(overallTotals.get(String(stu.id)) || 0)}</TableCell>
                          <TableCell align="center" sx={{ border: '1.2px solid #000 !important', fontWeight: 700, py: '6px !important', fontSize: { xs: '11pt', print: '9pt' } }}>{n(meritRanks.get(String(stu.id)) || '--')}</TableCell>
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
            <Typography color="textSecondary">{noYearMessage || l.noData}</Typography>
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
              display: table !important;
            }

            .cr-print-container thead {
              display: table-header-group !important;
            }
            .cr-print-container thead tr {
              display: table-row !important;
            }
            .cr-print-container tbody {
              display: table-row-group !important;
            }
            .cr-print-container tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }

            .cr-print-container th,
            .cr-print-container td {
              border: 1pt solid #000 !important;
              padding: 6px 1px !important;
              font-size: 9pt !important;
              overflow: visible !important;
              white-space: normal !important;
              word-break: break-word !important;
              text-align: center !important;
              line-height: 1.1 !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              font-weight: 400 !important;
            }

            /* Name Column Specific */
            .cr-print-container th:nth-of-type(2),
            .cr-print-container td:nth-of-type(2) {
              text-align: left !important;
              padding-left: 4px !important;
              width: 140px !important;
              min-width: 140px !important;
              font-size: 11pt !important;
              font-weight: 400 !important;
            }
            /* Roll Column */
            .cr-print-container th:nth-of-type(1),
            .cr-print-container td:nth-of-type(1) {
              width: 40px !important;
              font-weight: 400 !important;
            }

            /* Last columns (Total, Merit) */
            .cr-print-container th:nth-last-of-type(1),
            .cr-print-container td:nth-last-of-type(1),
            .cr-print-container th:nth-last-of-type(2),
            .cr-print-container td:nth-last-of-type(2) {
               width: 55px !important;
               min-width: 55px !important;
               font-weight: 400 !important;
            }

            .cr-print-container thead th {
              background-color: #f0f0f0 !important;
              height: auto !important;
              vertical-align: middle !important;
              font-weight: bold !important;
              display: table-cell !important;
            }

            .cr-print-container table {
               display: table !important;
               width: 100% !important;
               border-collapse: collapse !important;
               table-layout: auto !important;
            }

            .cr-print-container thead {
               display: table-header-group !important;
            }

            .MuiTableContainer-root {
              box-shadow: none !important;
              overflow: visible !important;
              width: 100% !important;
              display: table !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            * {
              box-shadow: none !important;
              text-shadow: none !important;
            }
          }

          /* PDF Capture Styles to mimic print */
          .pdf-capture-active .print-only {
            display: table-row !important;
          }
          .pdf-capture-active .no-print {
            display: none !important;
          }
          .pdf-capture-active .cr-table-wrap {
            padding: 10px;
          }
        `}
      </style>
    </Box>
  );
}
