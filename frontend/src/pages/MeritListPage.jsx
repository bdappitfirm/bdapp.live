import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, Grid, FormControl, InputLabel, Select, MenuItem, Button, Stack } from '@mui/material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { scopedGet } from '../utils/schoolApi';
import { useAcademics } from '../context/AcademicsContext';
import { useSchool } from '../context/SchoolContext';
import PrintIcon from '@mui/icons-material/Print';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { getMediaUrl } from '../utils/media';
import { bengaliToEnglishNumber } from '../utils/helpers';

// --- SHARED LOGIC ENGINE (MIRROR OF CLASSRESULTSPAGE) ---
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
    const low = String(n).toLowerCase().trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
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
    if (low.includes('bgs') || low.includes('বাংলাদেশ') || low.includes('বিশ্বপরিচয়') || low.includes('বিজিএস') || low.includes('বিএজিএস') || low.includes('bangladesh studies')) return 'bgs';

    if (is2 && !has1) return low.replace(/([২2][য়য়য]|2nd|second|ii|দ্বিতীয়|Boy|দ্বিতীয়)/gi, '').replace(/[- ]/g, '').trim() + '_p2';
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
        if (isScienceGroup(g)) { ['physics', 'chemistry', 'biology', 'bgs'].forEach(s => subjects.add(s)); }
        else if (isCommerceGroup(g)) { ['accounting', 'finance', 'business', 'science'].forEach(s => subjects.add(s)); }
        else if (isHumanitiesGroup(g)) {
            ['history', 'civics', 'science'].forEach(s => subjects.add(s));
            if (classSubjs.has('economics')) subjects.add('economics'); else subjects.add('geography');
        }
    } else { ['science', 'bgs'].forEach(s => subjects.add(s)); }
    return subjects;
};

const CO_CURRICULAR = [
  'শারীরিক', 'বই পড়া', 'achievement', 'continuous', 'wcat', 'শারিরীক',
  'ক্যারিয়ার', 'ক্যারিয়ার', 'career', 'চারু', 'কারুকলা', 'arts', 'crafts',
  'life and work', 'জীবনমুখী', 'কর্ম', 'word collection', 'ওয়ার্ড কালেকশন'
];
const isRelSubj = (n) => /religion|islam|hindu|buddhist|christian|ধর্ম|ইসলাম|হিন্দু|বৌদ্ধ|খ্রিস্ট/i.test(String(n));

const translateSub = (n) => {
    const low = String(n).toLowerCase().trim();
    if (low.includes('bangla')) return 'বাংলা';
    if (low.includes('english')) return 'ইংরেজি';
    if (low.includes('math')) return 'গণিত';
    if (low.includes('islam') || low.includes('hindu') || low.includes('religion') || low.includes('ধর্ম')) return 'ধর্ম';
    if (low.includes('ict')) return 'আইসিটি';
    if (low.includes('bgs') || low.includes('বাংলাদেশ')) return 'বিজিএস';
    if (low.includes('science') || low.includes('বিজ্ঞান')) return 'বিজ্ঞান';
    if (low.includes('physics')) return 'পদার্থ';
    if (low.includes('chemistry')) return 'রসায়ন';
    if (low.includes('biology')) return 'জীববিজ্ঞান';
    return n;
};

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
    if (takesGeneralScience && sciCount < 2) { if (comCount > humCount) return 'commerce'; return 'humanities'; }
    if (sciCount > 0 && sciCount >= comCount && sciCount >= humCount) return 'science';
    if (comCount > 0 && comCount >= humCount) return 'commerce';
    if (humCount > 0) return 'humanities';
    return '';
};

const parseRoll = (r) => {
  const eng = bengaliToEnglishNumber(String(r || ''));
  const n = parseInt(eng.replace(/\D/g, ''));
  return isNaN(n) ? 999999 : n;
};

const MeritListPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { classrooms, refreshClassrooms } = useAcademics();
  const { school: schoolInfo } = useSchool();

  const [sections, setSections] = useState([]);

  // Lazy initialize state from URL to prevent resets
  const initialUrl = new URLSearchParams(window.location.search);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedYear, setSelectedYear] = useState(() => {
    return parseInt(initialUrl.get('year')) || new Date().getFullYear();
  });
  const pendingClassRef = useRef(initialUrl.get('classroom') || '');
  const pendingSectionRef = useRef(initialUrl.get('section') || '');
  const pendingGroupRef = useRef(initialUrl.get('group') || '');

  // SAFETY-1: Only set selectedClass once the classroom option actually
  // exists in the `classrooms` array.  Otherwise Select gets out-of-range value.
  useEffect(() => {
    const pending = pendingClassRef.current;
    if (!pending) return;
    const ok = classrooms.some(c => String(c.id) === String(pending));
    if (ok) {
      setSelectedClass(String(pending));
      pendingClassRef.current = '';
    }
  }, [classrooms]);

  // SAFETY-2: Only set selectedSection once the section option exists.
  useEffect(() => {
    const pending = pendingSectionRef.current;
    if (!pending) return;
    const ok = sections.some(s => String(s.id) === String(pending));
    if (ok) {
      setSelectedSection(String(pending));
      pendingSectionRef.current = '';
    }
  }, [sections]);

  // SAFETY-3: Apply pending group value (immediate: group MenuItems are static, not async)
  useEffect(() => {
    const pending = pendingGroupRef.current;
    if (pending) {
      setSelectedGroup(String(pending));
      pendingGroupRef.current = '';
    }
  }, []);

  const [students, setStudents] = useState([]);
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isMounted = useRef(true);
  const lastFetched = useRef("");

  useEffect(() => {
    isMounted.current = true;
    if (id) refreshClassrooms(id);
    return () => { isMounted.current = false; };
  }, [id, refreshClassrooms]);

  // Sync state with URL changes (back button support)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qClass = params.get('classroom') || '';
    const qSection = params.get('section') || '';
    const qGroup = params.get('group') || '';
    const qYear = parseInt(params.get('year')) || new Date().getFullYear();

    // Only apply qClass if the classroom option EXISTS in the loaded list.
    if (qClass !== selectedClass) {
      const isValid = !qClass || classrooms.some(c => String(c.id) === String(qClass));
      if (isValid) setSelectedClass(qClass);
      else pendingClassRef.current = qClass;
    }
    if (qSection !== selectedSection) {
      const isValid = !qSection || sections.some(s => String(s.id) === String(qSection));
      if (isValid) setSelectedSection(qSection);
      else pendingSectionRef.current = qSection;
    }
    if (qGroup !== selectedGroup) setSelectedGroup(qGroup);
    if (qYear !== selectedYear) setSelectedYear(qYear);
  }, [location.search, selectedClass, selectedSection, selectedGroup, selectedYear, classrooms, sections]);

  // Helper to update URL
  const updateUrl = useCallback((updates) => {
    const params = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([key, val]) => {
        if (val === '' || val === null || val === undefined) params.delete(key);
        else params.set(key, val);
    });
    const newSearch = params.toString();
    if (window.location.search.substring(1) !== newSearch) {
        navigate({ search: newSearch }, { replace: true });
    }
  }, [navigate]);

  const fetchStudentsController = useRef(null);

  useEffect(() => {
    if (!id || !selectedClass) {
        setStudents([]);
        setSections([]);
        return;
    }

    if (fetchStudentsController.current) fetchStudentsController.current.abort();
    fetchStudentsController.current = new AbortController();

    scopedGet('/api/academics/sections/', id, { classroom: selectedClass }).then(res => {
        if (isMounted.current) setSections(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    });

    scopedGet('/api/academics/students/', id, {
        classroom: selectedClass,
        section: selectedSection,
        page_size: 500
    }).then(res => {
        if (isMounted.current) setStudents(res.data.results || res.data || []);
    });
  }, [id, selectedClass, selectedSection]);

  const studentListFiltered = useMemo(() => {
    return students.filter(s => {
        const fn = (s.user?.first_name || '').toUpperCase();
        const ln = (s.user?.last_name || '').toUpperCase();
        const fullName = (fn + ' ' + ln).trim();
        const isTC = fullName.includes('TC') || fn.includes('TC') || ln.includes('TC');

        // 1. Strict Section filtering
        if (selectedSection) {
            const stuSecId = String(s.section?.id || s.section || s.section_id || '');
            if (stuSecId !== String(selectedSection)) return false;
        }

        return !isTC && (fn || ln || s.roll_number);
    }).sort((a, b) => parseRoll(a.roll_number) - parseRoll(b.roll_number));
  }, [students, selectedSection]);

  const fetchResultsController = useRef(null);

  // AUTO-FETCH logic like ClassResultsPage
  useEffect(() => {
    const fetchKey = `${id}-${selectedClass}-${selectedSection}-${selectedGroup}-${selectedYear}-${studentListFiltered.length}`;
    if (fetchKey === lastFetched.current || !id || !selectedClass || studentListFiltered.length === 0) {
        if (!selectedClass) setRankings([]);
        return;
    }

    lastFetched.current = fetchKey;
    if (fetchResultsController.current) fetchResultsController.current.abort();
    fetchResultsController.current = new AbortController();

    setLoading(true); setRankings([]); setErrorMessage('');

    (async () => {
        try {
            // Fetch Raw Results for Browser Calculation
            let allResults = [], page = 1, hasNext = true;
            while (hasNext && page <= 25) {
                const res = await scopedGet('/api/results/results/', id, {
                    classroom: selectedClass,
                    section: selectedSection,
                    year: selectedYear,
                    page,
                    page_size: 500
                });
                if (!isMounted.current) return;
                const data = res.data;
                allResults = allResults.concat(Array.isArray(data) ? data : (data.results || []));
                if (data.next) page++; else hasNext = false;
            }

            if (!isMounted.current) return;

            const clsObj = classrooms.find(c => String(c.id) === String(selectedClass));
            const isNT = clsObj ? /নবম|দশম|ssc|\b9\b|\b10\b|\bnine\b|\bten\b|\bix\b|\bx\b|class\s*9|class\s*10|৯ম|১০ম/i.test(clsObj.name.toLowerCase()) : false;

            const currentGroupFromURL = (() => {
                const text = (String(clsObj?.name || '')).toLowerCase();
                if (text.includes('science') || text.includes('বিজ্ঞান')) return 'Science';
                if (text.includes('commerce') || text.includes('business') || text.includes('ব্যবসায়')) return 'Commerce';
                if (text.includes('arts') || text.includes('humanities') || text.includes('মানবিক')) return 'Humanities';
                return '';
            })();

            const classSubjects = new Set();
            allResults.forEach(r => {
                const sn = String(r.subject?.name || r.subject_name || '').toLowerCase();
                if (!CO_CURRICULAR.some(c => sn.includes(c.toLowerCase()))) classSubjects.add(sn);
            });

            const allResultsSorted = [...allResults].sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));
            const sumStr = (s) => String(s || '').split('+').reduce((acc, v) => acc + (parseFloat(v) || 0), 0);

            const finalData = [];
            for (const s of studentListFiltered) {
                const stuRes = allResultsSorted.filter(r => String(r.student?.id || r.student) === String(s.id));

                // Religion check
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
                        relResults.forEach(r => { if (String(r.subject?.id || r.subject || r.subject_name) !== bestRelSubId) suppressedIds.add(String(r.subject?.id || r.subject || r.subject_name)); });
                    }
                }
                const takenRelId = relResults.find(r => !suppressedIds.has(String(r.subject?.id || r.subject || r.subject_name)) && (sumStr(r.written_marks) + sumStr(r.mcq_marks) + sumStr(r.practical_marks) + (parseFloat(r.total_obtained)||0)) > 0)?.subject?.id;

                const subjectMap = new Map();
                stuRes.forEach(r => {
                    const sid = String(r.subject?.id || r.subject || r.subject_name);
                    if (suppressedIds.has(sid)) return;

                    const rawName = String(r.subject_name || r.subject?.name || '').toLowerCase().trim();
                    let key = normalizeSubjKey(rawName);

                    const isCombined = !rawName.match(/(1st|2nd|১ম|২য়|২য়)/);
                    const hasSpecificPapers = stuRes.some(x => {
                        const xName = String(x.subject?.name || x.subject_name || '').toLowerCase();
                        const xKey = normalizeSubjKey(xName);
                        return (xKey.startsWith(key.split('_')[0]) && xName.match(/(1st|2nd|১ম|২য়|২য়)/)) || xKey === key + '_p1' || xKey === key + '_p2';
                    });
                    if (isNT && isCombined && hasSpecificPapers) return;

                    const w = sumStr(r.written_marks), m = sumStr(r.mcq_marks), p = sumStr(r.practical_marks);
                    const rTotal = (w + m + p) > 0 ? (w + m + p) : (parseFloat(r.total_obtained) || 0);
                    const hasActualMarks = (r.written_marks !== '' && r.written_marks !== null) || (r.mcq_marks !== '' && r.mcq_marks !== null) || (r.practical_marks !== '' && r.practical_marks !== null);

                    const existing = subjectMap.get(key);
                    if (!existing || (hasActualMarks && !existing.hasActualMarks) || (hasActualMarks === !!existing.hasActualMarks && rTotal > (existing.total_obtained || 0))) {
                        subjectMap.set(key, { ...r, sumW: w, sumM: m, sumP: p, hasActualMarks, total_obtained: rTotal, standard_key: key });
                    }
                });

                const resList = Array.from(subjectMap.values());
                const virtualMap = new Map();
                resList.forEach(r => {
                    const key = r.standard_key || normalizeSubjKey(r.subject?.name || r.subject_name || '');
                    if (!virtualMap.has(key)) virtualMap.set(key, []);
                    virtualMap.get(key).push(r);
                });

                const getGroupFromContext = () => {
                    const secObj = sections.find(sec => String(sec.id) === String(s?.section?.id || s?.section));
                    const text = (String(clsObj?.name || '') + ' ' + String(secObj?.name || '')).toLowerCase();
                    if (text.includes('science') || text.includes('বিজ্ঞান')) return 'science';
                    if (text.includes('commerce') || text.includes('business') || text.includes('ব্যবসায়') || text.includes('ব্যবসায়')) return 'commerce';
                    if (text.includes('humanities') || text.includes('arts') || text.includes('মানবিক')) return 'humanities';
                    return '';
                };

                let classLevelGroup = '';
                const groupCounts = { science: 0, commerce: 0, humanities: 0 };
                studentListFiltered.forEach(st => {
                    const g = (st?.student_group || st?.group || '').toLowerCase();
                    if (g.includes('science')) groupCounts.science++;
                    else if (g.includes('commerce') || g.includes('business')) groupCounts.commerce++;
                    else if (g.includes('arts') || g.includes('humanities')) groupCounts.humanities++;
                });
                if (groupCounts.science >= groupCounts.commerce && groupCounts.science >= groupCounts.humanities && groupCounts.science > 0) classLevelGroup = 'science';
                else if (groupCounts.commerce >= groupCounts.humanities && groupCounts.commerce > 0) classLevelGroup = 'commerce';
                else if (groupCounts.humanities > 0) classLevelGroup = 'humanities';

                const group = (s?.student_group || s?.group || inferGroup(resList, isNT) || getGroupFromContext() || classLevelGroup || currentGroupFromURL || (selectedGroup || '')).toLowerCase();
                const expectedKeys = getExpectedSubjects(group, isNT, classSubjects);

                let score = 0, fails = 0, failedList = [], hasAnyMarks = false, totalPoints = 0, subCount = 0;

                const hmList = resList.filter(r => /higher|উচ্চতর/.test(String(r.subject?.name || r.subject_name).toLowerCase()));
                const agriList = resList.filter(r => /agriculture|home|কৃষি|গার্হস্থ্য/.test(String(r.subject?.name || r.subject_name).toLowerCase()));

                const assignedOpt = s?.optional_subject;
                const assignedOptId = String(assignedOpt?.id || assignedOpt || '');
                const assignedOptName = String(assignedOpt?.name || '').toLowerCase();

                let showHM = false, showAgri = false;
                if (assignedOptId || assignedOptName) {
                    const isHMAssigned = (assignedOptId && hmList.some(r => String(r.subject?.id || r.subject) === assignedOptId)) || (assignedOptName && assignedOptName.includes('higher'));
                    const isAgriAssigned = (assignedOptId && agriList.some(r => String(r.subject?.id || r.subject) === assignedOptId)) || (assignedOptName && (assignedOptName.includes('agri') || assignedOptName.includes('কৃষি')));
                    if (isHMAssigned) showHM = true;
                    else if (isAgriAssigned) showAgri = true;
                    else {
                        const hmTotal = hmList.reduce((sum, r) => sum + (parseFloat(r.total_obtained)||0), 0);
                        const agriTotal = agriList.reduce((sum, r) => sum + (parseFloat(r.total_obtained)||0), 0);
                        showHM = isNT && (hmTotal >= agriTotal && hmTotal > 0);
                        showAgri = isNT && (agriTotal > hmTotal && agriTotal > 0);
                    }
                } else {
                    const hmTotal = hmList.reduce((sum, r) => sum + (parseFloat(r.total_obtained)||0), 0);
                    const agriTotal = agriList.reduce((sum, r) => sum + (parseFloat(r.total_obtained)||0), 0);
                    showHM = isNT && (hmTotal >= agriTotal && hmTotal > 0);
                    showAgri = isNT && (agriTotal > hmTotal && agriTotal > 0);
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

                    const sciPool = ['physics', 'chemistry', 'biology'];
                    const comPool = ['accounting', 'finance', 'business'];
                    const humPool = ['history', 'geography', 'civics', 'economics'];

                    const belongsToGroup = (isScienceGroup(group) && sciPool.includes(key)) ||
                                           (isCommerceGroup(group) && comPool.includes(key)) ||
                                           (isHumanitiesGroup(group) && humPool.includes(key));

                    if (isNT && isHumanitiesGroup(group)) {
                        if ((key === 'civics' || key === 'economics') && papers.length > 0 && !electiveCounted) { isMandatory = true; electiveCounted = true; }
                        else if (key === 'civics' && !electiveCounted && !virtualMap.has('economics')) { isMandatory = true; electiveCounted = true; }
                    }

                    if (isMandatory || belongsToGroup) {
                        if (!isRel || (isRel && !takenRelId) || (isRel && papers.length > 0)) subCount++;
                    }

                    if (papers.length === 0) {
                        if (isMandatory) {
                            if (isRel && takenRelId) return;
                            if (isNT) {
                                if (group.includes('science')) { if (key === 'science') return; }
                                else {
                                    if (['physics', 'chemistry', 'biology'].includes(key)) return;
                                    if (/bgs|বাংলাদেশ|science|বিজ্ঞান/i.test(key)) {
                                        const hasAnyRecord = resList.some(r => normalizeSubjKey(r.subject?.name || r.subject_name) === normalizeSubjKey(key));
                                        if (!hasAnyRecord) return;
                                    }
                                }
                            }
                            fails++; failedList.push(translateSub(key));
                        }
                        return;
                    }

                    let tW=0, tM=0, tP=0, tO=0, tPossible=0, cqM=0, mcqM=0, prM=0, pPresent=false;
                    papers.forEach(r => {
                        const hasActualMarks = (r.written_marks !== '' && r.written_marks !== null) || (r.mcq_marks !== '' && r.mcq_marks !== null) || (r.practical_marks !== '' && r.practical_marks !== null);
                        if (hasActualMarks || r.total_obtained > 0) { hasAnyMarks = true; pPresent = true; }
                        const spec = getSubjectMaxima(r.subject?.name || r.subject_name, isNT);
                        const pMax = (spec.cq + spec.mcq + spec.pr || 100);
                        tW += r.sumW; tM += r.sumM; tP += r.sumP; tO += Math.min(r.total_obtained, pMax);
                        tPossible += pMax; cqM += spec.cq; mcqM += spec.mcq; prM += spec.pr;
                    });
                    if (isNT && (key === 'bangla' || key === 'english')) tPossible = Math.max(tPossible, 200);

                    const cqPass = cqM === 0 || tW >= Math.round(cqM * 0.33 - 0.5);
                    const mcqPass = mcqM === 0 || tM >= Math.round(mcqM * 0.33 - 0.5);
                    const prPass = prM === 0 || tP >= Math.round(prM * 0.33 - 0.5);
                    const totPass = tO >= Math.round(tPossible * 0.33 - 0.5);

                    const isCoCurric = CO_CURRICULAR.some(c => String(key || '').toLowerCase().includes(c.toLowerCase()));
                    let isSubjectPassed = pPresent && (isNT ? (isCoCurric ? totPass : (cqPass && mcqPass && prPass && totPass)) : totPass);
                    const gp = isSubjectPassed ? computeGpa((tO / tPossible) * 100) : 0;

                    if ((key === 'higher' && showHM) || (key === 'agriculture' && showAgri)) {
                        const threshold = tPossible * 0.4;
                        if (tO > threshold) score += (tO - threshold);
                        totalPoints += Math.max(0, gp - 2.0);
                    } else if (isMandatory || belongsToGroup) {
                        if (isRel && takenRelId && !papers.some(r => String(r.subject?.id || r.subject) === String(takenRelId))) return;
                        score += tO; totalPoints += gp;
                        if (isMandatory && !isSubjectPassed) {
                            if (!(isNT === false && (key.includes('শারীরিক') || key.includes('physical')))) {
                                fails++; failedList.push(translateSub(key));
                            }
                        }
                    }
                });

                if (!hasAnyMarks) fails = 999;
                const finalCgpa = (subCount > 0 && fails === 0) ? Math.min(5.0, totalPoints / subCount) : 0;

                finalData.push({
                    student: s,
                    total: Math.round(score),
                    rawScore: score,
                    points: finalCgpa,
                    fails,
                    failedList: Array.from(new Set(failedList)),
                    isAbsent: !hasAnyMarks,
                    roll: parseRoll(s.roll_number),
                    section_name: s.section?.name || sections.find(sec => String(sec.id) === String(s.section?.id || s.section || s.section_id))?.name || 'N/A',
                    section_id: String(s.section?.id || s.section || s.section_id || '')
                });
            }

            // Ranks calculation
            const bySection = new Map();
            finalData.forEach(d => {
                const sid = selectedSection ? 'all' : (d.section_id || 'none');
                if (!bySection.has(sid)) bySection.set(sid, []);
                bySection.get(sid).push(d);
            });
            const ranked = [];
            bySection.forEach(list => {
                list.sort((a, b) => {
                    if (a.isAbsent !== b.isAbsent) return a.isAbsent ? 1 : -1;
                    if (a.fails !== b.fails) return a.fails - b.fails;
                    if (Math.abs(b.points - a.points) > 0.0001) return b.points - a.points;
                    if (Math.abs(b.rawScore - a.rawScore) > 0.01) return b.rawScore - a.rawScore;
                    // Standard board priority: use browser roll as tie-breaker
                    return a.roll - b.roll;
                });
                list.forEach((it, i) => { it.browserRank = i + 1; ranked.push(it); });
            });

            if (isMounted.current) {
                // Final display sorting
                const finalSorted = ranked.sort((a, b) => {
                    if (!selectedSection) {
                        if (a.section_name !== b.section_name) return (a.section_name || '').localeCompare(b.section_name || '');
                    }
                    return a.roll - b.roll;
                });
                setRankings(finalSorted);
            }
        } catch (e) {
            console.error(e);
            if (isMounted.current) setErrorMessage('ডাটা লোড করতে সমস্যা হয়েছে।');
        } finally {
            if (isMounted.current) setLoading(false);
        }
    })();
  }, [id, selectedClass, selectedSection, selectedGroup, selectedYear, studentListFiltered, classrooms]);

  const currentClassLabel = classrooms.find(c => String(c.id) === String(selectedClass))?.name || '---';
  const currentSectionLabel = sections.find(s => String(s.id) === String(selectedSection))?.name || 'সব শাখা';

  return (
    <Box sx={{ p: 3, bgcolor: '#f5f5f5', minHeight: '100vh' }} className="merit-list-root">
      <Stack className="no-print" direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>মেধাতালিকা (Merit List) <VerifiedUserIcon color="success" sx={{ verticalAlign: 'middle', ml: 1 }} /></Typography>
        <Stack direction="row" spacing={1}><Button variant="outlined" onClick={() => navigate(-1)}>Back</Button><Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>প্রিন্ট</Button></Stack>
      </Stack>

      <Paper className="no-print" sx={{ p: 2, mb: 3, borderTop: '4px solid #2e7d32' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}><FormControl fullWidth><InputLabel>শ্রেণি</InputLabel><Select value={selectedClass} onChange={e => {
              const val = e.target.value;
              updateUrl({ classroom: val, section: '', group: '' });
          }} sx={{ height: '56px' }}>{classrooms.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}</Select></FormControl></Grid>
          <Grid item xs={12} md={2}><FormControl fullWidth><InputLabel>শাখা</InputLabel><Select value={selectedSection} onChange={e => {
              const val = e.target.value;
              updateUrl({ section: val });
          }} sx={{ height: '56px' }} disabled={!selectedClass}><MenuItem value="">সব শাখা</MenuItem>{sections.map(s => <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>)}</Select></FormControl></Grid>

          {(() => {
              const cls = classrooms.find(c => String(c.id) === String(selectedClass));
              const isNineTen = cls ? /নবম|দশম|ssc|\b9\b|\b10\b|\bnine\b|\bten\b|\bix\b|\bx\b|class\s*9|class\s*10|৯ম|১০ম/i.test(cls.name.toLowerCase()) : false;
              if (isNineTen) {
                  return (
                    <Grid item xs={12} md={2}>
                      <FormControl fullWidth>
                        <InputLabel>বিভাগ</InputLabel>
                        <Select value={selectedGroup} onChange={e => {
                            const val = e.target.value;
                            updateUrl({ group: val });
                        }} sx={{ height: '56px' }}>
                          <MenuItem value="">সব বিভাগ</MenuItem>
                          <MenuItem value="science">বিজ্ঞান (Science)</MenuItem>
                          <MenuItem value="commerce">ব্যবসায় শিক্ষা (Commerce)</MenuItem>
                          <MenuItem value="humanities">মানবিক (Humanities)</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  );
              }
              return null;
          })()}

          <Grid item xs={12} md={2}><FormControl fullWidth><InputLabel>সাল</InputLabel><Select value={String(selectedYear)} onChange={e => {
              const val = e.target.value;
              updateUrl({ year: val });
          }} sx={{ height: '56px' }}>{[2024, 2025, 2026].map(y => <MenuItem key={y} value={String(y)}>{y}</MenuItem>)}</Select></FormControl></Grid>
          <Grid item xs={12} md={3}><Box sx={{ textAlign: 'center', p: 1, bgcolor: '#e8f5e9', borderRadius: 1 }}><Typography variant="caption" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>ক্লাস রেজাল্টস থেকে রিয়েল-টাইম সিঙ্ক সক্রিয়</Typography></Box></Grid>
        </Grid>
      </Paper>

      <Box className="print-only" sx={{ display: 'none', textAlign: 'center', mb: 3, borderBottom: '2px solid black', pb: 2, "@media print": { display: 'block' } }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mb: 1 }}>{schoolInfo?.logo && <img src={getMediaUrl(schoolInfo.logo)} alt="Logo" style={{ height: '80px' }} />}<Box><Typography variant="h5" sx={{ fontWeight: 800, fontSize: '1.6rem' }}>{schoolInfo?.name}</Typography><Typography variant="body1" sx={{ fontSize: '1.0rem' }}>{schoolInfo?.address || ''}</Typography></Box></Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mt: 1, textDecoration: 'underline' }}>মেধাতালিকা (Merit List)</Typography>
          <Typography variant="h6">শ্রেণি: {currentClassLabel} | শাখা: {currentSectionLabel} | বছর: {selectedYear}</Typography>
      </Box>

      {loading ? <Box sx={{ textAlign: 'center', py: 5 }}><CircularProgress color="success" /><Typography sx={{ mt: 2, fontWeight: 'bold' }}>তথ্য প্রস্তুত করা হচ্ছে...</Typography></Box> : rankings.length > 0 ? (
        <TableContainer component={Paper} sx={{ boxShadow: 3, width: '100%', borderRadius: 2 }}>
          <Table size="small" sx={{ width: '100%', borderCollapse: 'collapse', '& td, & th': { border: '1px solid #ddd', py: 1.2, px: 1.5 } }}>
            <TableHead><TableRow sx={{ bgcolor: '#2e7d32', "& th": { color: 'white !important', fontWeight: 'bold' }, "@media print": { bgcolor: '#eee !important', "& th": { color: 'black !important' }, WebkitPrintColorAdjust: 'exact' } }}><TableCell align="center">রোল</TableCell><TableCell>শিক্ষার্থীর নাম</TableCell>{!selectedSection && <TableCell align="center">শাখা</TableCell>}<TableCell align="center">মোট নম্বর</TableCell><TableCell align="center">GPA</TableCell><TableCell align="center">মেধাক্রম</TableCell><TableCell>ফেইল করা বিষয়সমূহ</TableCell></TableRow></TableHead>
            <TableBody>{rankings.map((r, idx) => (
              <React.Fragment key={r.student.id}>
                {!selectedSection && (idx === 0 || rankings[idx-1].section_name !== r.section_name) && (
                  <TableRow sx={{ bgcolor: '#f0f4f0' }}>
                    <TableCell colSpan={7} sx={{ fontWeight: 'bold', textAlign: 'center', py: 1 }}>শাখা: {r.section_name}</TableCell>
                  </TableRow>
                )}
                <TableRow sx={{ pageBreakInside: 'avoid', "&:hover": { bgcolor: '#f5f5f5' }, bgcolor: r.isAbsent ? '#fff9f9' : 'inherit' }}>
                  <TableCell align="center">{r.student.roll_number}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>{r.student.user?.first_name} {r.student.user?.last_name}</TableCell>
                  {!selectedSection && <TableCell align="center">{r.section_name}</TableCell>}
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>{r.total}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', color: r.points >= 5 ? '#2e7d32' : 'inherit' }}>{r.isAbsent ? '--' : r.points.toFixed(2)}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', color: '#1a237e' }}>{r.browserRank}</TableCell>
                  <TableCell sx={{ color: 'red', fontSize: '0.85rem', fontWeight: 500 }}>{r.isAbsent ? 'অনুপস্থিত (Absent)' : r.failedList.join(', ')}</TableCell>
                </TableRow>
              </React.Fragment>
            ))}</TableBody>
          </Table>
        </TableContainer>
      ) : selectedClass && <Box sx={{ p: 5, textAlign: 'center' }}><Typography variant="h6" color="textSecondary">কোন তথ্য পাওয়া যায়নি।</Typography></Box>}

      <style>{`@media print { .no-print { display: none !important; } body { background: white !important; margin: 0 !important; padding: 0 !important; } @page { size: portrait; margin: 10mm; } .merit-list-root { padding: 0 !important; } .MuiTableContainer-root { overflow: visible !important; width: 100% !important; border: none !important; } table { width: 100% !important; table-layout: auto !important; } .print-only { display: block !important; padding-top: 7mm !important; } }`}</style>
    </Box>
  );
};

export default MeritListPage;
