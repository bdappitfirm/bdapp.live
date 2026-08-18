import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Paper, Stack, Button, TextField, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress } from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PrintIcon from '@mui/icons-material/Print';
import { scopedGet } from '../utils/schoolApi';
import { useAcademics } from '../context/AcademicsContext';
import { useSchool } from '../context/SchoolContext';
import { getMediaUrl } from '../utils/media';

const getSubjectMaxima = (name, isNT) => {
  const lower = String(name || '').toLowerCase();

  if (lower.includes('বাংলা') || lower.includes('bangla')) {
    if (isNT && (lower.includes('১ম+২য়') || lower.includes('1st+2nd'))) return { cq: 140, mcq: 60, pr: 0 };
    if (!isNT && (lower.includes('২য়') || lower.includes('২য়') || lower.includes('2nd') || lower.includes('second') || lower.includes('ii'))) return { cq: 35, mcq: 15, pr: 0 };
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
    if (lower.includes('ধর্ম') || lower.includes('religion') || lower.includes('islam') || lower.includes('hindu') || lower.includes('ইসলাম') || lower.includes('হিন্দ')) return { cq: 70, mcq: 30, pr: 0 };
  }

  return { cq: 70, mcq: 30, pr: 0 };
};

const computeGpa = (pct) => {
  if (pct >= 80) return 5.0; if (pct >= 70) return 4.0; if (pct >= 60) return 3.5;
  if (pct >= 50) return 3.0; if (pct >= 40) return 2.0; if (pct >= 33) return 1.0;
  return 0.0;
};

const normalizeSubjKey = (n) => {
    const low = String(n).toLowerCase().trim();
    // Use very strict detection for papers to avoid English word matching 'i'
    const is2 = /([- ](২য়|২য়|2nd|second|ii|দ্বি[তত]ীয|দ্বিতীয়|দ্বিতীয়)(\s|$))|(\bii\b)/i.test(low);
    const has1 = /([- ]([১1]ম|1st|first|i|প্রথম)(\s|$))|(\bi\b)/i.test(low);

    if (low.includes('higher') || low.includes('উচ্চতর')) return 'higher';
    if (low.includes('math') || low.includes('গণিত')) return 'math';
    if (low.includes('history') || low.includes('ইতিহাস') || low.includes('সভ্যতা')) return 'history';
    if (low.includes('bgs') || (low.includes('বাংলাদেশ') && (low.includes('পরিচয়') || low.includes('পরিচয়') || low.includes('বিজিএস'))) || (low.includes('বাঃ') && low.includes('পরিচয়')) || low.includes('global studies')) return 'bgs';

    if ((low.includes('bangla') || low.includes('বাংলা')) && !low.includes('বাংলাদেশ') && !low.includes('bangladesh')) {
        if (is2 && !has1) return 'bangla_p2';
        if (has1 && !is2) return 'bangla_p1';
        if (is2 && has1) return 'bangla_combined';
        return 'bangla';
    }
    if (low.includes('english') || low.includes('ইংরেজি') || low.includes('ইংরেজী')) {
        if (is2 && !has1) return 'english_p2';
        if (has1 && !is2) return 'english_p1';
        if (is2 && has1) return 'english_combined';
        return 'english';
    }

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

    if (is2 && !has1) return low.replace(/([২2][য়য়য]|2nd|second|ii|দ্বিতীয়|দ্বিতীয়)/gi, '').replace(/[- ]/g, '').trim() + '_p2';
    if (has1 && !is2) return low.replace(/([১1][ম]|1st|first|i|প্রথম)/gi, '').replace(/[- ]/g, '').trim() + '_p1';

    return low;
};

const isScienceGroup = (g) => { const l = String(g || '').toLowerCase(); return l.includes('science') || l.includes('বিজ্ঞান'); };
const isCommerceGroup = (g) => { const l = String(g || '').toLowerCase(); return l.includes('commerce') || l.includes('business') || l.includes('ব্যবসায়') || l.includes('ব্যবসায়'); };
const isHumanitiesGroup = (g) => { const l = String(g || '').toLowerCase(); return l.includes('arts') || l.includes('humanities') || l.includes('মানবিক'); };

const getExpectedSubjects = (studentGroup, isNT, classSubjs) => {
    const subjects = new Set(['math', 'religion', 'ict']);
    const g = String(studentGroup || '').toLowerCase();
    const checkPaper = (base) => {
        if (isNT) return [base];
        const normSubjs = Array.from(classSubjs).map(s => normalizeSubjKey(s));
        const hasP1 = normSubjs.some(k => k === base + '_p1');
        const hasP2 = normSubjs.some(k => k === base + '_p2');
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
        if (isScienceGroup(g)) {
            ['physics', 'chemistry', 'biology', 'bgs'].forEach(s => subjects.add(s));
        } else if (isCommerceGroup(g)) {
            ['accounting', 'finance', 'business', 'science'].forEach(s => subjects.add(s));
        } else if (isHumanitiesGroup(g)) {
            ['history', 'civics', 'science'].forEach(s => subjects.add(s));
            if (classSubjs.has('economics')) subjects.add('economics');
            else if (classSubjs.has('geography')) subjects.add('geography');
            else subjects.add('geography');
        }
    } else {
        ['science', 'bgs'].forEach(s => subjects.add(s));
    }
    return subjects;
};

const CO_CURRICULAR = [
  'শারীরিক', 'বই পড়া', 'achievement', 'continuous', 'wcat', 'শারিরীক',
  'ক্যারিয়ার', 'ক্যারিয়ার', 'career', 'চারু', 'কারুকলা', 'arts', 'crafts',
  'life and work', 'জীবনমুখী', 'কর্ম', 'word collection', 'ওয়ার্ড কালেকশন'
];
const isRelSubj = (n) => /religion|islam|hindu|buddhist|christian|ধর্ম|ইসলাম|হিন্দু|বৌদ্ধ|খ্রিস্ট/i.test(String(n));

const BN_1ST_REGEX = /(^|[\s-])([১1]ম|1st|first|প্রথম|\bi\b|1)(\s|$|পত্র|paper|part)/i;
const BN_2ND_REGEX = /(^|[\s-])([২2][য়য]়?|2nd|second|দ্বিতীয়|দ্বিতীয়|\bii\b|2)(\s|$|পত্র|paper|part)/i;

const inferGroup = (resList, isNT) => {
    if (!isNT || !resList || resList.length === 0) return '';
    const count = (regex) => resList.filter(r => {
        const hasMarks = (parseFloat(r.written_marks) > 0 || parseFloat(r.mcq_marks) > 0 || parseFloat(r.practical_marks) > 0);
        return hasMarks && regex.test(String(r.subject?.name || r.subject_name || '').toLowerCase());
    }).length;
    const sciCount = count(/physics|chemistry|biology|higher|পদার্থ|রসায়ন|জীব|উচ্চতর/i);
    const comCount = count(/accounting|finance|entrepreneurship|ব্যবসায়|হিসাব|ফিন্যান্স/i);
    const humCount = count(/history|geography|civics|ইতিহাস|ভূগোল|পৌরনীতি|economics|অর্থনীতি/i);

    const takesGeneralScience = resList.some(r => {
        const name = (r.subject?.name || r.subject_name || '').toLowerCase();
        const hasMarks = (parseFloat(r.written_marks) > 0 || parseFloat(r.mcq_marks) > 0);
        return hasMarks && (name === 'science' || name === 'বিজ্ঞান' || name === 'general science' || name === 'সাধারণ বিজ্ঞান');
    });

    if (takesGeneralScience && sciCount < 2) {
        if (comCount > humCount) return 'commerce';
        return 'humanities';
    }

    if (sciCount > 0 && sciCount >= comCount && sciCount >= humCount) return 'science';
    if (comCount > 0 && comCount >= humCount) return 'commerce';
    if (humCount > 0) return 'humanities';
    return '';
};

export default function ClassResultsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { classrooms, refreshClassrooms } = useAcademics();
  const { school: schoolInfo } = useSchool();
  const isMounted = React.useRef(true);
  const [selectedClass, setSelectedClass] = useState('');
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const pendingClassRef = React.useRef('');
  const pendingSectionRef = React.useRef('');

  // SAFETY: Only apply pending classroom/section after async lists finish loading.
  // Prevents MUI Select "out-of-range value" error on URL-hydration with query params.
  useEffect(() => {
    const pending = pendingClassRef.current;
    if (!pending) return;
    if (classrooms.some(c => String(c.id) === String(pending))) {
      setSelectedClass(String(pending));
      pendingClassRef.current = '';
    }
  }, [classrooms]);
  useEffect(() => {
    const pending = pendingSectionRef.current;
    if (!pending) return;
    if (sections.some(s => String(s.id) === String(pending))) {
      setSelectedSection(String(pending));
      pendingSectionRef.current = '';
    }
  }, [sections]);

  const [students, setStudents] = useState([]);
  const [resultsByStudent, setResultsByStudent] = useState(new Map());
  const [overallTotals, setOverallTotals] = useState(new Map());
  const [backendRanks, setBackendRanks] = useState(new Map());
  const [loading, setLoading] = useState(false);

  const isClassNineOrTen = useMemo(() => {
    const cls = classrooms.find(c => String(c.id) === String(selectedClass));
    if (!cls) return false;
    const text = String(cls.name || '').toLowerCase();
    return /নবম|দশম|ssc|\b9\b|\b10\b|\bnine\b|\bten\b|\bix\b|\bx\b|class\s*9|class\s*10|৯ম|১০ম/i.test(text);
  }, [selectedClass, classrooms]);

  const currentGroupFromURL = useMemo(() => {
    const cls = classrooms.find(c => String(c.id) === String(selectedClass));
    const sec = sections.find(s => String(s.id) === String(selectedSection));
    const text = (String(cls?.name || '') + ' ' + String(sec?.name || '')).toLowerCase();
    if (text.includes('science') || text.includes('বিজ্ঞান')) return 'Science';
    if (text.includes('commerce') || text.includes('business') || text.includes('ব্যবসায়')) return 'Commerce';
    if (text.includes('arts') || text.includes('humanities') || text.includes('মানবিক')) return 'Humanities';
    return '';
  }, [selectedClass, selectedSection, classrooms, sections]);

  const studentListFiltered = useMemo(() => {
    return students.filter(s => {
        const fn = (s.user?.first_name || '').toUpperCase();
        const ln = (s.user?.last_name || '').toUpperCase();
        const fullName = (fn + ' ' + ln).trim();
        const isTC = fullName.includes('TC') || fn.includes('TC') || ln.includes('TC');
        const hasNoInfo = !fn && !ln && !s.roll_number;
        if (selectedSection && String(s.section?.id || s.section) !== String(selectedSection)) return false;
        return !isTC && !hasNoInfo;
    }).sort((a, b) => (parseInt(a.roll_number) || 999) - (parseInt(b.roll_number) || 999));
  }, [students, selectedSection]);

  const detectedGroup = useMemo(() => {
    if (!isClassNineOrTen) return '';

    // ১. প্রথমে প্রোফাইল থেকে গ্রুপ খোঁজার চেষ্টা করি
    const firstWithGroup = studentListFiltered.find(s => s.student_group || s.group);
    let g = (firstWithGroup?.student_group || firstWithGroup?.group || '').toLowerCase();

    // ২. যদি প্রোফাইলে না থাকে, তবে ইউআরএল বা ক্লাস/সেকশন নাম থেকে খুঁজি
    if (!g) g = (currentGroupFromURL || '').toLowerCase();

    // ৩. যদি তাতেও না পাওয়া যায়, তবে রেজাল্ট ডাটা থেকে ইনফার করার চেষ্টা করি (সবচেয়ে নির্ভরযোগ্য)
    if (!g && resultsByStudent.size > 0) {
        // প্রথম ৩ জন ছাত্রের রেজাল্ট চেক করি
        const sampleStudents = Array.from(resultsByStudent.values()).slice(0, 3);
        for (const resList of sampleStudents) {
            const inferred = inferGroup(resList, true);
            if (inferred) { g = inferred; break; }
        }
    }

    if (g.includes('science') || g.includes('বিজ্ঞান')) return 'science';
    if (g.includes('commerce') || g.includes('business') || g.includes('ব্যবসায়') || g.includes('ব্যবসায়')) return 'commerce';
    if (g.includes('arts') || g.includes('humanities') || g.includes('মানবিক')) return 'humanities';
    return '';
  }, [studentListFiltered, currentGroupFromURL, isClassNineOrTen, resultsByStudent]);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => { if (id) refreshClassrooms(id); }, [id, refreshClassrooms]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qClass = params.get('classroom') || '';
    const qSection = params.get('section') || '';
    const qYear = params.get('year') || '';
    if (qClass) {
      const ok = classrooms.some(c => String(c.id) === String(qClass));
      if (ok) setSelectedClass(String(qClass));
      else pendingClassRef.current = qClass;
    }
    if (qSection) {
      const ok = sections.some(s => String(s.id) === String(qSection));
      if (ok) setSelectedSection(String(qSection));
      else pendingSectionRef.current = qSection;
    }
    if (qYear) setSelectedYear(qYear);
  }, [location.search, classrooms, sections]);

  useEffect(() => {
    if (!id || !selectedClass) return;
    const currentId = id;
    const currentClass = selectedClass;
    const currentSection = selectedSection;

    scopedGet('/api/academics/sections/', currentId, { classroom: currentClass }).then(res => {
        if (isMounted.current && currentId === id && currentClass === selectedClass)
            setSections(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    });

    scopedGet('/api/academics/students/', currentId, { classroom: currentClass, section: currentSection, page_size: 500 }).then(res => {
        if (isMounted.current && currentId === id && currentClass === selectedClass && currentSection === selectedSection)
            setStudents(res.data.results || res.data || []);
    });
  }, [id, selectedClass, selectedSection]);


  const lastFetched = React.useRef("");
  const fetchController = React.useRef(null);

  useEffect(() => {
    const fetchKey = `${id}-${selectedClass}-${selectedSection}-${selectedYear}-${studentListFiltered.length}`;
    if (fetchKey === lastFetched.current || !id || !selectedClass || studentListFiltered.length === 0) {
        // Only clear results if explicitly no classroom is selected
        if (!selectedClass && resultsByStudent.size > 0) {
            setResultsByStudent(new Map());
            setOverallTotals(new Map());
            lastFetched.current = "";
        }
        return;
    }

    lastFetched.current = fetchKey;
    if (fetchController.current) fetchController.current.abort();
    fetchController.current = new AbortController();

    setLoading(true);
    const currentSchoolId = id;

    (async () => {
        try {
            let allResults = [], page = 1, hasNext = true;
            while (hasNext && page <= 25) {
                const res = await scopedGet('/api/results/results/', currentSchoolId, {
                    classroom: selectedClass,
                    section: selectedSection,
                    year: selectedYear,
                    page,
                    page_size: 500
                });
                if (!isMounted.current || currentSchoolId !== id) return;

                const data = res.data;
                allResults = allResults.concat(Array.isArray(data) ? data : (data.results || []));
                if (data.next) page++; else hasNext = false;
            }

            if (!isMounted.current) return;

        const classSubjects = new Set();
        allResults.forEach(r => {
            const sn = String(r.subject?.name || r.subject_name || '').toLowerCase();
            if (!CO_CURRICULAR.some(c => sn.includes(c.toLowerCase()))) classSubjects.add(sn);
        });

        const allResultsSorted = (Array.isArray(allResults) ? [...allResults] : []).sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));

        const cleanedMap = new Map();
        const sumStr = (s) => String(s || '').split('+').reduce((acc, v) => acc + (parseFloat(v) || 0), 0);

        for (const s of studentListFiltered) {
            const stuRes = allResultsSorted.filter(r => String(r.student?.id || r.student) === String(s.id));

            // Religion suppression for table display (Matches Merit List logic)
            const relResults = stuRes.filter(r => isRelSubj(r.subject?.name || r.subject_name));
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
            stuRes.forEach(r => {
                const sid = String(r.subject?.id || r.subject || r.subject_name);
                if (suppressedIds.has(sid)) return;

                const rawName = String(r.subject_name || r.subject?.name || '').toLowerCase().trim();
                let key = normalizeSubjKey(rawName);

                // Skip redundant combined records if specific papers exist (Matches Merit List logic)
                const isCombined = !rawName.match(/(1st|2nd|১ম|২য়|২য়)/);
                const hasSpecificPapers = stuRes.some(x => {
                    const xName = String(x.subject?.name || x.subject_name || '').toLowerCase();
                    const xKey = normalizeSubjKey(xName);
                    // Match by prefix (e.g., english_p1 matches english) or exact match
                    return (xKey.startsWith(key.split('_')[0]) && xName.match(/(1st|2nd|১ম|২য়|২য়)/)) || xKey === key + '_p1' || xKey === key + '_p2';
                });
                if (isClassNineOrTen && isCombined && hasSpecificPapers) return;

                const w = sumStr(r.written_marks), m = sumStr(r.mcq_marks), p = sumStr(r.practical_marks);
                const rTotal = (w + m + p) > 0 ? (w + m + p) : (parseFloat(r.total_obtained) || 0);

                // CRITICAL: hasMarks should only be true if actual part marks are entered.
                // This prevents junk "total_obtained" records from overriding real data.
                const hasActualMarks = (r.written_marks !== '' && r.written_marks !== null) || (r.mcq_marks !== '' && r.mcq_marks !== null) || (r.practical_marks !== '' && r.practical_marks !== null);
                const hasInput = hasActualMarks || (parseFloat(r.total_obtained) > 0);

                // Prefer record with marks (Aggressive Deduplication)
                const existing = subjectMap.get(key);
                // Priority: 1. Record with actual part marks, 2. Higher total
                if (!existing || (hasActualMarks && !existing.hasActualMarks) || (hasActualMarks === !!existing.hasActualMarks && rTotal > (existing.total_obtained || 0))) {
                    subjectMap.set(key, { ...r, sumW: w, sumM: m, sumP: p, hasMarks: hasInput, hasActualMarks, total_obtained: rTotal, standard_key: key });
                }
            });
            cleanedMap.set(String(s.id), Array.from(subjectMap.values()));
        }
        setResultsByStudent(cleanedMap);

        // Fetch overall results to get backend ranks
        try {
            const examRes = await scopedGet('/api/results/examinations/', currentSchoolId, {
                classroom: selectedClass,
                year: selectedYear,
                page_size: 5
            });
            const exams = Array.isArray(examRes.data) ? examRes.data : (examRes.data?.results || []);
            if (exams.length > 0) {
                const latestExam = exams[0];
                const overallRes = await scopedGet('/api/results/overall/', currentSchoolId, {
                    examination: latestExam.id,
                    page_size: 1000
                });
                const overallData = Array.isArray(overallRes.data) ? overallRes.data : (overallRes.data?.results || []);
                const rankMap = new Map();
                overallData.forEach(item => {
                    rankMap.set(String(item.student?.id || item.student), item.rank);
                });
                if (isMounted.current) setBackendRanks(rankMap);
            }
        } catch (e) {
            console.warn("Could not fetch backend ranks:", e);
        }

        const totals = new Map();
        for (const stu of studentListFiltered) {
            const sid = String(stu.id);
            const resList = cleanedMap.get(sid) || [];
            const virtualMap = new Map();
            resList.forEach(r => {
                const key = r.standard_key || normalizeSubjKey(r.subject?.name || r.subject_name || '');
                if (!virtualMap.has(key)) virtualMap.set(key, []);
                virtualMap.get(key).push(r);
            });

            const getGroupFromContext = () => {
                const clsObj = classrooms.find(c => String(c.id) === String(selectedClass));
                const secObj = sections.find(s => String(s.id) === String(stu?.section?.id || stu?.section));
                const text = (String(clsObj?.name || '') + ' ' + String(secObj?.name || '')).toLowerCase();
                if (text.includes('science') || text.includes('বিজ্ঞান')) return 'science';
                if (text.includes('commerce') || text.includes('business') || text.includes('ব্যবসায়') || text.includes('ব্যবসায়')) return 'commerce';
                if (text.includes('humanities') || text.includes('arts') || text.includes('মানবিক')) return 'humanities';
                return '';
            };

            // Detect class-level group as fallback
            let classLevelGroup = '';
            const groupCounts = { science: 0, commerce: 0, humanities: 0 };
            studentListFiltered.forEach(s => {
                const g = (s?.student_group || s?.group || '').toLowerCase();
                if (g.includes('science')) groupCounts.science++;
                else if (g.includes('commerce') || g.includes('business')) groupCounts.commerce++;
                else if (g.includes('arts') || g.includes('humanities')) groupCounts.humanities++;
            });
            if (groupCounts.science >= groupCounts.commerce && groupCounts.science >= groupCounts.humanities && groupCounts.science > 0) classLevelGroup = 'science';
            else if (groupCounts.commerce >= groupCounts.humanities && groupCounts.commerce > 0) classLevelGroup = 'commerce';
            else if (groupCounts.humanities > 0) classLevelGroup = 'humanities';

            const group = (stu?.student_group || stu?.group || inferGroup(resList, isClassNineOrTen) || getGroupFromContext() || classLevelGroup || currentGroupFromURL || detectedGroup).toLowerCase();
            const expectedKeys = getExpectedSubjects(group, isClassNineOrTen, classSubjects);
            const takenRelId = resList.find(r => isRelSubj(r.subject?.name || r.subject_name) && (parseFloat(r.total_obtained) > 0))?.subject?.id || resList.find(r => isRelSubj(r.subject?.name || r.subject_name) && (parseFloat(r.total_obtained) > 0))?.subject;

            let score = 0, fails = 0, hasAnyMarks = false, totalPoints = 0, subjectCount = 0;

            const hmList = resList.filter(r => /higher|উচ্চতর/.test(String(r.subject?.name || r.subject_name).toLowerCase()));
            const agriList = resList.filter(r => /agriculture|home|কৃষি|গার্হস্থ্য/.test(String(r.subject?.name || r.subject_name).toLowerCase()));

            // Optional subject priority logic:
            const assignedOpt = stu?.optional_subject;
            const assignedOptId = String(assignedOpt?.id || assignedOpt || '');
            const assignedOptName = String(assignedOpt?.name || '').toLowerCase();

            let showHM = false, showAgri = false;
            const hasHM = hmList.some(r => (parseFloat(r.total_obtained) || 0) > 0);
            const hasAgri = agriList.some(r => (parseFloat(r.total_obtained) || 0) > 0);

            if (assignedOptId || assignedOptName) {
                const isHMAssigned = (assignedOptId && hmList.some(r => String(r.subject?.id || r.subject) === assignedOptId)) || (assignedOptName && assignedOptName.includes('higher'));
                const isAgriAssigned = (assignedOptId && agriList.some(r => String(r.subject?.id || r.subject) === assignedOptId)) || (assignedOptName && (assignedOptName.includes('agri') || assignedOptName.includes('কৃষি')));
                if (isHMAssigned) showHM = true;
                else if (isAgriAssigned) showAgri = true;
                else {
                    const hmTotal = hmList.reduce((s, r) => s + (parseFloat(r.total_obtained)||0), 0);
                    const agriTotal = agriList.reduce((s, r) => s + (parseFloat(r.total_obtained)||0), 0);
                    showHM = isClassNineOrTen && (hmTotal >= agriTotal && hmTotal > 0);
                    showAgri = isClassNineOrTen && (agriTotal > hmTotal && agriTotal > 0);
                }
            } else {
                const hmTotal = hmList.reduce((s, r) => s + (parseFloat(r.total_obtained)||0), 0);
                const agriTotal = agriList.reduce((s, r) => s + (parseFloat(r.total_obtained)||0), 0);
                showHM = isClassNineOrTen && (hmTotal >= agriTotal && hmTotal > 0);
                showAgri = isClassNineOrTen && (agriTotal > hmTotal && agriTotal > 0);
            }

            const allKeys = new Set([...expectedKeys, 'higher', 'agriculture', 'civics', 'economics']);
            let electiveCounted = false;

            allKeys.forEach(key => {
                let papers = virtualMap.get(key) || [];
                if (key === 'bangla' || key === 'english') {
                    const merged = [
                        ...(virtualMap.get(key + '_p1') || []),
                        ...(virtualMap.get(key + '_p2') || []),
                        ...(virtualMap.get(key + '_combined') || []),
                        ...(virtualMap.get(key) || [])
                    ];
                    if (merged.length > 0) papers = merged;
                }
                if ((key.endsWith('_p1') || key.endsWith('_p2') || key.endsWith('_combined')) && papers.length === 0) {
                    const base = key.replace(/_(p1|p2|combined)$/, '');
                    const fallback = virtualMap.get(base) || [];
                    if (fallback.length > 0) papers = fallback;
                }
                const isRel = isRelSubj(key);
                let isMandatory = expectedKeys.has(key);

                // Group Pools for automatic inclusion
                const sciPool = ['physics', 'chemistry', 'biology'];
                const comPool = ['accounting', 'finance', 'business'];
                const humPool = ['history', 'geography', 'civics', 'economics'];

                const belongsToGroup = (isScienceGroup(group) && sciPool.includes(key)) ||
                                       (isCommerceGroup(group) && comPool.includes(key)) ||
                                       (isHumanitiesGroup(group) && humPool.includes(key));

                // Elective logic for Humanities (Civics/Economics)
                if (isClassNineOrTen && isHumanitiesGroup(group)) {
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
                        if (isClassNineOrTen) {
                            if (group.includes('science')) { if (key === 'science') return; }
                            else {
                                if (['physics', 'chemistry', 'biology'].includes(key)) return;
                                // For BGS/Science in non-science groups, check if taken at all
                                if (/bgs|বাংলাদেশ|science|বিজ্ঞান/i.test(key)) {
                                    const hasAnyRecord = resList.some(r => normalizeSubjKey(r.subject?.name || r.subject_name) === normalizeSubjKey(key));
                                    if (!hasAnyRecord) return;
                                }
                            }
                        }
                        fails++; // Mark as fail if mandatory subject is missing/absent
                    }
                    return;
                }

                let totalW = 0, totalM = 0, totalP = 0, totalObtained = 0, totalPossible = 0, cqM = 0, mcqM = 0, prM = 0;
                let isAnyPaperPresentForSub = false;
                papers.forEach(r => {
                    if (r.hasMarks) { hasAnyMarks = true; isAnyPaperPresentForSub = true; }
                    const w = r.sumW, m = r.sumM, pr = r.sumP;
                    const spec = getSubjectMaxima(r.subject?.name || r.subject_name, isClassNineOrTen);
                    const paperMax = (spec.cq + spec.mcq + spec.pr || 100);

                    let obtained = (w + m + pr) > 0 ? (w + m + pr) : (parseFloat(r.total_obtained) || 0);
                    // Surgical Cap: ensure obtained marks do not exceed total possible
                    if (obtained > paperMax) obtained = paperMax;

                    totalW += w; totalM += m; totalP += pr; totalObtained += obtained;
                    totalPossible += paperMax;
                    cqM += spec.cq; mcqM += spec.mcq; prM += spec.pr;
                });
                if (isClassNineOrTen && (key === 'bangla' || key === 'english')) {
                     totalPossible = Math.max(totalPossible, 200);
                     if (totalObtained > 200) totalObtained = 200;
                }

                const cqPass = cqM === 0 || totalW >= Math.round(cqM * 0.33 - 0.5);
                const mcqPass = mcqM === 0 || totalM >= Math.round(mcqM * 0.33 - 0.5);
                const prPass = prM === 0 || totalP >= Math.round(prM * 0.33 - 0.5);
                const totPass = totalObtained >= Math.round(totalPossible * 0.33 - 0.5);

                const isCoCurric = CO_CURRICULAR.some(c => String(key || '').toLowerCase().includes(c.toLowerCase()));
                let isSubjectPassed = isAnyPaperPresentForSub && (isClassNineOrTen ? (isCoCurric ? totPass : (cqPass && mcqPass && prPass && totPass)) : totPass);

                const gp = isSubjectPassed ? computeGpa((totalObtained / totalPossible) * 100) : 0;
                const isAgricultureSub = (key === 'higher' || key === 'agriculture');

                if ((key === 'higher' && showHM) || (key === 'agriculture' && showAgri)) {
                    const threshold = totalPossible * 0.4;
                    if (totalObtained > threshold) { score += (totalObtained - threshold); }
                    totalPoints += Math.max(0, gp - 2.0);
                } else if (isMandatory || belongsToGroup) {
                    if (!isClassNineOrTen && isAgricultureSub) return;
                    if (isClassNineOrTen && (key === 'bgs' || key === 'science') && !group.includes('science')) { if (!isAnyPaperPresentForSub) return; }
                    if (isRel && takenRelId && !papers.some(r => String(r.subject?.id || r.subject) === String(takenRelId))) return;
                    score += totalObtained; totalPoints += gp;
                    if (isMandatory && (!isAnyPaperPresentForSub || !isSubjectPassed)) { if (!(isClassNineOrTen === false && (key.includes('শারীরিক') || key.includes('physical')))) { fails++; } }
                }
            });

            if (!hasAnyMarks) fails = 999;
            const finalCgpa = (subjectCount > 0 && fails === 0) ? Math.min(5.0, totalPoints / subjectCount) : 0;
            totals.set(sid, { total: Math.round(score), rawScore: score, points: finalCgpa, fails, isAbsent: !hasAnyMarks, roll: parseInt(stu.roll_number) || 999, group });
        }
        if (isMounted.current) {
            setResultsByStudent(cleanedMap);
            setOverallTotals(totals);
        }
    } catch (err) {
        if (err.name !== 'AbortError') console.error("Fetch error:", err);
    } finally {
        if (isMounted.current && currentSchoolId === id) setLoading(false);
    }
    })();
    return () => { if (fetchController.current) fetchController.current.abort(); };
  }, [id, selectedClass, selectedSection, selectedYear, studentListFiltered.length, isClassNineOrTen, currentGroupFromURL, detectedGroup]);

  const displaySubjects = useMemo(() => {
    const set = new Set();
    const g = detectedGroup;
    const sciOnly = ['physics', 'chemistry', 'biology', 'higher', 'পদার্থ', 'রসায়ন', 'রসায়ন', 'জীব', 'উচ্চতর', 'বিজ্ঞান বিভাগ'];
    const comOnly = ['accounting', 'finance', 'business', 'হিসাব', 'ফিন্যান্স', 'ব্যবসায়', 'ব্যবসায়', 'উদ্যোগ', 'entrepreneurship', 'ব্যবসায় শিক্ষা'];
    const artOnly = ['history', 'geography', 'civics', 'economics', 'ইতিহাস', 'ভূগোল', 'পৌরনীতি', 'পৌরণীতি', 'অর্থনীতি', 'মানবিক বিভাগ'];
    const subjectsWithMarks = new Map(); // key -> label

    resultsByStudent.forEach(list => list.forEach(r => {
        if (r.hasMarks) {
            const rawName = String(r.subject_name || r.subject?.name || '');
            const key = r.standard_key || normalizeSubjKey(rawName);

            // যদি এই কি (key) আগে না থাকে, তবে যোগ করি
            if (!subjectsWithMarks.has(key)) {
                subjectsWithMarks.set(key, rawName);
            }
        }
    }));

    subjectsWithMarks.forEach((label, key) => {
        // নবম-দশম শ্রেণিতে বাংলা ও ইংরেজি আলাদা কলামে না দেখিয়ে মার্জ করা কলামে দেখানো হয়
        if (isClassNineOrTen && (key.startsWith('bangla') || key.startsWith('english'))) return;

        // ধর্ম সমন্বয়: হিন্দু ধর্ম বা ইসলাম শিক্ষা যাই হোক, সব 'ধর্ম' হিসেবে দেখাবো
        if (isRelSubj(label)) {
            set.add({ label: 'ধর্ম', key: 'religion_merged' });
            return;
        }

        // নবম-দশম শ্রেণিতে গ্রুপ অনুযায়ী সাবজেক্ট ফিল্টারিং (আরও কঠোর করা হলো)
        if (isClassNineOrTen && g) {
            const lLow = label.toLowerCase();
            const isScienceSub = key === 'physics' || key === 'chemistry' || key === 'biology' || key === 'higher' || sciOnly.some(x => lLow.includes(x.toLowerCase()));
            const isCommerceSub = key === 'accounting' || key === 'finance' || key === 'business' || comOnly.some(x => lLow.includes(x.toLowerCase()));
            const isHumanitiesSub = key === 'history' || key === 'geography' || key === 'civics' || key === 'economics' || artOnly.some(x => lLow.includes(x.toLowerCase())) || lLow.includes('ভুগোল');
            const isBGS = key === 'bgs' || /bgs|bangladesh|global|বাংলাদেশ ও বিশ্ব|বিশ্বপরিচয়/i.test(lLow);
            const isGenScience = key === 'science' || /^(science|বিজ্ঞান|general science|সাধারণ বিজ্ঞান)$/i.test(lLow.trim());

            if (g === 'science') {
                if (isCommerceSub || isHumanitiesSub || isGenScience) return;
            } else if (g === 'commerce') {
                if (isScienceSub || isHumanitiesSub || isBGS) return;
            } else if (g === 'humanities') {
                if (isScienceSub || isCommerceSub || isBGS) return;
            }
        }

        set.add({ label, key }); // Store both label and standardized key
    });

    const getWeight = (name) => {
        const n = name.toLowerCase();
        if (n.includes('bgs') || n.includes('বাংলাদেশ') || n.includes('global') || n.includes('world') || n.includes('বিশ্ব') || n.includes('social')) {
            if (!n.includes('bangla') && !n.includes('pure science')) return 60;
        }
        if ((n.includes('bangla') || n.includes('বাংলা')) && !n.includes('বাংলাদেশ') && !n.includes('bangladesh')) return (n.includes('২য়') || n.includes('২য়') || n.includes('2nd') || n.includes('second') || n.includes('ii')) ? 12 : 11;
        if (n.includes('english') || n.includes('ইংরেজি')) return (n.includes('২য়') || n.includes('২য়') || n.includes('2nd') || n.includes('second') || n.includes('ii')) ? 22 : 21;
        if (n.includes('math') || n.includes('গণিত')) return (n.includes('উচ্চতর') || n.includes('higher')) ? 1000 : 30;
        if (n.includes('religion') || n.includes('islam') || n.includes('hindu') || n.includes('ধর্ম') || n.includes('ইসলাম') || n.includes('হিন্দু') || n.includes('moral')) return 40;
        if (n.includes('ict') || n.includes('তথ্য')) return 50;
        if (n.includes('physics') || n.includes('পদার্থ')) return 70;
        if (n.includes('chemistry') || n.includes('রসায়ন') || n.includes('রসায়ন')) return 80;
        if (n.includes('biology') || n.includes('জীব')) return 90;
        if (n.includes('science') || n.includes('বিজ্ঞান')) return 100;
        return 500;
    };
    const subjects = [];
    if (isClassNineOrTen) { subjects.push({ label: 'বাংলা (১ম+২য়)', key: 'merged-bangla' }, { label: 'ইংরেজি (১ম+২য়)', key: 'merged-english' }); }
    Array.from(set).forEach(s => {
        subjects.push(s);
    });
    return subjects.sort((a, b) => getWeight(a.label) - getWeight(b.label));
  }, [resultsByStudent, isClassNineOrTen, detectedGroup]);

  const getResultsMap = useCallback((sid) => {
    let list = resultsByStudent.get(String(sid)) || [];

    // Religion suppression for table display
    const relResults = list.filter(r => isRelSubj(r.subject?.name || r.subject_name));
    let suppressedKeys = new Set();
    if (relResults.length > 1) {
        const withMarks = relResults.filter(r => (parseFloat(r.total_obtained) > 0));
        if (withMarks.length > 0) {
            const bestRelKey = (withMarks[0].standard_key || normalizeSubjKey(withMarks[0].subject?.name || withMarks[0].subject_name)).toLowerCase();
            relResults.forEach(r => {
                const rKey = (r.standard_key || normalizeSubjKey(r.subject?.name || r.subject_name)).toLowerCase();
                if (rKey !== bestRelKey) suppressedKeys.add(rKey);
            });
        } else {
            const islam = relResults.find(r => /islam|ইসলাম/i.test(r.subject?.name || r.subject_name));
            const primaryRel = islam || relResults[0];
            const pKey = (primaryRel.standard_key || normalizeSubjKey(primaryRel.subject?.name || primaryRel.subject_name)).toLowerCase();
            relResults.forEach(r => {
                const rKey = (r.standard_key || normalizeSubjKey(r.subject?.name || r.subject_name)).toLowerCase();
                if (rKey !== pKey) suppressedKeys.add(rKey);
            });
        }
    }

    if (isClassNineOrTen) {
        const hmList = list.filter(r => /higher|উচ্চতর/.test(String(r.subject?.name || r.subject_name).toLowerCase()));
        const agriList = list.filter(r => /agriculture|home|কৃষি|গার্হস্থ্য/.test(String(r.subject?.name || r.subject_name).toLowerCase()));

        const assignedOpt = list.find(r => r.student)?.student?.optional_subject;
        const assignedOptId = String(assignedOpt?.id || assignedOpt || '');

        let showHM = false;
        const hmTotal = hmList.reduce((s, r) => s + (parseFloat(r.total_obtained)||0), 0);
        const agriTotal = agriList.reduce((s, r) => s + (parseFloat(r.total_obtained)||0), 0);

        if (assignedOptId) {
            const isHMAssigned = hmList.some(r => String(r.subject?.id || r.subject) === assignedOptId);
            const isAgriAssigned = agriList.some(r => String(r.subject?.id || r.subject) === assignedOptId);
            if (isHMAssigned) showHM = true;
            else if (isAgriAssigned) showHM = false;
            else showHM = hmTotal >= agriTotal;
        } else {
            showHM = hmTotal >= agriTotal;
        }

        if (hmTotal > 0 || agriTotal > 0) {
            list = list.filter(r => { const ln = String(r.subject?.name || r.subject_name).toLowerCase(); if (/higher|উচ্চতর/.test(ln)) return showHM; if (/agriculture|home|কৃষি|গার্হস্থ্য/.test(ln)) return !showHM; return true; });
        }
    }
    const m = new Map(), b = [], e = [], rel = [];
    list.forEach(r => {
        const key = (r.standard_key || normalizeSubjKey(r.subject_name || r.subject?.name || '')).toLowerCase();
        if (suppressedKeys.has(key)) return;

        if (isRelSubj(r.subject?.name || r.subject_name)) {
            rel.push(r);
            return;
        }

        if (isClassNineOrTen) {
            if (key.startsWith('bangla')) { b.push(r); return; }
            if (key.startsWith('english')) { e.push(r); return; }
        }

        const w = parseFloat(r.written_marks)||0, mcq = parseFloat(r.mcq_marks)||0, pr = parseFloat(r.practical_marks)||0, has = r.hasMarks;
        const spec = getSubjectMaxima(r.subject_name || r.subject?.name || '', isClassNineOrTen);
        const totalPossible = (spec.cq + spec.mcq + spec.pr || 100);

        // Consistent with ResultCard and MeritList: fallback to total_obtained if sum of parts is 0
        let tot = (w + mcq + pr) > 0 ? (w + mcq + pr) : (parseFloat(r.total_obtained) || 0);
        if (tot > totalPossible) tot = totalPossible;

        const p = [];
        if (spec.cq > 0) p.push(r.written_marks !== '' && r.written_marks !== null ? Math.round(w) : '0');
        if (spec.mcq > 0) p.push(r.mcq_marks !== '' && r.mcq_marks !== null ? Math.round(mcq) : '0');
        if (spec.pr > 0) p.push(r.practical_marks !== '' && r.practical_marks !== null ? Math.round(pr) : '0');

        const cqPass = spec.cq === 0 || w >= Math.round(spec.cq * 0.33 - 0.5),
              mcqPass = spec.mcq === 0 || mcq >= Math.round(spec.mcq * 0.33 - 0.5),
              prPass = spec.pr === 0 || pr >= Math.round(spec.pr * 0.33 - 0.5),
              totPass = tot >= Math.round(totalPossible * 0.33 - 0.5);
        const isPassed = has && (isClassNineOrTen ? (cqPass && mcqPass && prPass && totPass) : totPass);

        m.set(key, { total: tot, display: (has && tot > 0) ? (p.length > 1 ? `${Math.round(tot)} = ${p.join('+')}` : String(Math.round(tot))) : (has && tot === 0 ? '0' : 'Absent'), is_passed: isPassed, hasMarks: has });
    });
    const merge = (arr, key) => {
        if (arr.length === 0) return null;
        const getPN = (nm) => { const low = nm.toLowerCase(); if (low.includes('১ম') || low.includes('1st')) return 1; if (low.includes('২য়') || low.includes('2nd')) return 2; return 1; };
        arr.sort((a, b) => getPN(a.subject?.name || a.subject_name) - getPN(b.subject?.name || b.subject_name));
        const anyM = arr.some(r => r.hasMarks), sum = arr.reduce((s, r) => s + (parseFloat(r.total_obtained)||0), 0);
        let disp = 'Absent';
        if (anyM) {
            const p = arr.map(r => Math.round(parseFloat(r.total_obtained)||0));
            if (sum === 0) disp = 'Absent'; else disp = (p.length > 1 ? `${Math.round(sum)} = ${p.join('+')}` : String(Math.round(sum)));
        }
        let cqM = 0, mcqM = 0, prM = 0, sumW = 0, sumM = 0, sumP = 0;
        arr.forEach(r => { const spec = getSubjectMaxima(r.subject?.name || r.subject_name, isClassNineOrTen); cqM += spec.cq; mcqM += spec.mcq; prM += spec.pr; sumW += (parseFloat(r.written_marks)||0); sumM += (parseFloat(r.mcq_marks)||0); sumP += (parseFloat(r.practical_marks)||0); });
        if (isClassNineOrTen && (key === 'merged-bangla' || key === 'merged-english')) { if (cqM + mcqM + prM < 200) cqM = 200; }
        const cqP = cqM === 0 || sumW >= Math.round(cqM * 0.33 - 0.5), mcqP = mcqM === 0 || sumM >= Math.round(mcqM * 0.33 - 0.5), prP = prM === 0 || sumP >= Math.round(prM * 0.33 - 0.5), totP = sum >= ((cqM+mcqM+prM)*0.33-0.5);
        return { total: sum, display: disp, is_passed: anyM && (isClassNineOrTen ? (cqP && mcqP && prP && totP) : totP), hasMarks: anyM };
    };
    if (isClassNineOrTen) { if (b.length>0) m.set('merged-bangla', merge(b, 'merged-bangla')); if (e.length>0) m.set('merged-english', merge(e, 'merged-english')); }
    if (rel.length > 0) m.set('religion_merged', merge(rel, 'religion_merged'));
    return m;
  }, [resultsByStudent, isClassNineOrTen]);

  const meritRanks = useMemo(() => {
    const sectionGroups = new Map();
    studentListFiltered.forEach(stu => {
        const data = overallTotals.get(String(stu.id));
        if (!data) return;
        // Grouping by Section ID is crucial for section-wise ranking
        const secId = (selectedSection ? 'single' : (stu.section?.id || stu.section || 'other'));
        if (!sectionGroups.has(secId)) sectionGroups.set(secId, []);
        sectionGroups.get(secId).push({ ...data, sid: String(stu.id) });
    });

    const ranks = new Map();
    sectionGroups.forEach(scores => {
        scores.sort((a, b) => {
            if (a.isAbsent !== b.isAbsent) return a.isAbsent ? 1 : -1;
            // Standard board priority within section: 1. Fewer Fails, 2. Higher GPA, 3. Higher Total, 4. Roll
            if (a.fails !== b.fails) return a.fails - b.fails;
            if (Math.abs(b.points - a.points) > 0.0001) return b.points - a.points;
            if (Math.abs(b.rawScore - a.rawScore) > 0.01) return b.rawScore - a.rawScore;
            return a.roll - b.roll;
        });
        scores.forEach((s, i) => {
            ranks.set(s.sid, i + 1);
        });
    });
    return ranks;
  }, [overallTotals, studentListFiltered, selectedSection]);

  const studentListSortedByRoll = useMemo(() => { return [...studentListFiltered].sort((a, b) => (parseInt(a.roll_number) || 999) - (parseInt(b.roll_number) || 999)); }, [studentListFiltered]);
  const currentClassLabel = classrooms.find(c => String(c.id) === String(selectedClass))?.name || '---';
  const currentSectionLabel = sections.find(s => String(s.id) === String(selectedSection))?.name || 'সব শাখা';

  return (
    <Box sx={{ p: 3 }}>
      <Stack className="no-print" direction="row" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h4"><AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} /> Class Results</Typography>
        <Stack direction="row" spacing={1}><Button variant="outlined" onClick={() => navigate(-1)}>Back</Button><Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>Print</Button></Stack>
      </Stack>
      <Paper className="no-print" sx={{ p: 2, mb: 3 }}><Stack direction="row" spacing={2}><TextField select label="Class" value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); }} sx={{ minWidth: 200 }}>{classrooms.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}</TextField><TextField select label="Section" value={selectedSection} onChange={e => setSelectedSection(e.target.value)} sx={{ minWidth: 150 }} disabled={!selectedClass}><MenuItem value="">All</MenuItem>{sections.map(s => <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>)}</TextField><TextField type="number" label="Year" value={selectedYear} onChange={e => setSelectedYear(e.target.value)} sx={{ width: 100 }} /></Stack></Paper>
      <Box className="print-only" sx={{ display: 'none', textAlign: 'center', mb: 3, borderBottom: '2px solid black', pb: 2, "@media print": { display: 'block' } }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mb: 1 }}>{schoolInfo?.logo && <img src={getMediaUrl(schoolInfo.logo)} alt="Logo" style={{ height: '80px' }} />}<Box><Typography variant="h5" sx={{ fontWeight: 800, fontSize: '1.6rem' }}>{schoolInfo?.name}</Typography><Typography variant="body1" sx={{ fontSize: '1rem' }}>{schoolInfo?.address || ''}</Typography></Box></Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mt: 1, fontSize: '1.4rem' }}>শ্রেণি ভিত্তিক ফলাফল (Class Results)</Typography><Typography variant="h6" sx={{ fontSize: '1rem' }}>শ্রেণি: {currentClassLabel} | শাখা: {currentSectionLabel} | বছর: {selectedYear}</Typography>
      </Box>
      {loading ? <CircularProgress /> : (
        <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
          <Table size="small" sx={{ borderCollapse: 'collapse', '& td, & th': { border: '1.2px solid black !important', fontSize: { xs: '0.8rem', print: '7pt' }, py: 0.5, px: 0.3 } }}>
            <TableHead><TableRow sx={{ bgcolor: '#eee', "@media print": { bgcolor: '#eee !important', WebkitPrintColorAdjust: 'exact' } }}><TableCell align="center">রোল</TableCell><TableCell>Name</TableCell>{displaySubjects.map(s => <TableCell key={s.key} align="center" sx={{ fontWeight: 'bold' }}>{s.label}</TableCell>)}<TableCell align="center" sx={{ fontWeight: 'bold' }}>মোট</TableCell><TableCell align="center" sx={{ fontWeight: 'bold' }}>মেধাক্রম</TableCell></TableRow></TableHead>
            <TableBody>{studentListSortedByRoll.map(stu => {
              const stuData = overallTotals.get(String(stu.id));
              const stuGroup = (stuData?.group || stu?.student_group || stu?.group || currentGroupFromURL).toLowerCase();
              const stuResList = resultsByStudent.get(String(stu.id)) || [];
              const isSubMandatory = (subKey) => {
                  if (subKey.includes('merged')) return true;
                  const lowKey = subKey.toLowerCase();
                  if (isClassNineOrTen) {
                      const isHM = /higher|উচ্চতর/.test(lowKey), isAgri = /agriculture|home|কৃষি|গার্হস্থ্য/.test(lowKey);
                      if (isHM || isAgri) {
                          // Check if student HAS marks in either
                          const hms = stuResList.filter(r => /higher|উচ্চতর/.test(String(r.subject?.name || r.subject_name).toLowerCase())), agris = stuResList.filter(r => /agriculture|home|কৃষি|গার্হস্থ্য/.test(String(r.subject?.name || r.subject_name).toLowerCase()));
                          const hmT = hms.reduce((s, r) => s + (parseFloat(r.total_obtained)||0), 0), agriT = agris.reduce((s, r) => s + (parseFloat(r.total_obtained)||0), 0);

                          if (hmT > 0 && agriT > 0) { return hmT >= agriT ? isHM : isAgri; }
                          if (hmT > 0) return isHM;
                          if (agriT > 0) return isAgri;

                          // Default fallback if no marks in either
                          return stuGroup.includes('science') ? isHM : isAgri;
                      }
                      if (stuGroup.includes('science')) { if (['accounting', 'finance', 'business', 'history', 'geography', 'civics'].some(x=>lowKey.includes(x)) || lowKey === 'science') return false; return true; }
                      else { if (['physics', 'chemistry', 'biology'].some(x=>lowKey.includes(x))) return false;
                          if (/bgs|বাংলাদেশ|science|বিজ্ঞান/i.test(lowKey)) return stuResList.some(r => normalizeSubjKey(r.subject?.name || r.subject_name) === normalizeSubjKey(lowKey) && (parseFloat(r.total_obtained) > 0));
                          return true;
                      }
                  }
                  return /bangla|english|math|religion|ict|science|bgs|তথ্য|বাংলাদেশ|বিজ্ঞান/i.test(lowKey);
              };
              return (
                <TableRow key={stu.id} sx={{ pageBreakInside: 'avoid' }}>
                  <TableCell align="center">{stu.roll_number}</TableCell><TableCell sx={{ fontWeight: 'bold', minWidth: '100px' }}>{stu.user?.first_name} {stu.user?.last_name}</TableCell>
                  {(() => { const resMap = getResultsMap(stu.id); return displaySubjects.map(sub => {
                      const r = resMap.get(sub.key); const mandatory = isSubMandatory(sub.key); const isOpt = /higher|উচ্চতর|agriculture|home|কৃষি|গার্হস্থ্য/.test(sub.key);
                      const isF = !isOpt && ((r && r.hasMarks && r.is_passed === false) || (!r && mandatory && stuData && !stuData.isAbsent));
                      const display = r?.display === 'Absent' || (!r && mandatory) ? <span style={{ color: 'red', fontWeight: 'normal' }}>Absent</span> : (r?.display || '');
                      return <TableCell key={sub.key} align="center" sx={{ color: isF ? 'red' : 'inherit' }}>{display}</TableCell>;
                  }); })()}
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>{stuData?.total || 0}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', color: stuData?.isAbsent ? 'red' : 'inherit' }}>
                    {meritRanks.get(String(stu.id)) || '--'}
                  </TableCell>
                </TableRow>
              );
            })}</TableBody>
          </Table>
        </TableContainer>
      )}
      <style>{`@media print { .no-print { display: none !important; } body { background: white !important; margin: 0 !important; padding: 5mm !important; } @page { size: landscape; margin: 5mm; } .print-only { display: block !important; } .MuiTableContainer-root { overflow: visible !important; width: 100% !important; } table { width: 100% !important; table-layout: fixed !important; } th, td { word-break: break-word !important; line-height: 1.1 !important; } }`}</style>
    </Box>
  );
}
