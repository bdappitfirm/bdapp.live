import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Paper, Stack, Button, TextField, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress } from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PrintIcon from '@mui/icons-material/Print';
import { scopedGet } from '../utils/schoolApi';
import { useAcademics } from '../context/AcademicsContext';
import { useSchool } from '../context/SchoolContext';
import { primaryWrittenMax } from '../utils/primaryMaxima';
import { getMediaUrl } from '../utils/media';

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

// PRIMARY written ceiling: 100 for every subject, 50 for drawing (অংকন) - imported from
// utils/primaryMaxima so this table, the Result Card, the transcript and the merit list all use
// the same maxima as the backend (results/utils.py get_subject_maxima + Result.save()).

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
    if (low.includes('math') || low.includes('গণিত') || low.includes('গনিত')) return 'math';
    if (low.includes('history') || low.includes('ইতিহাস') || low.includes('সভ্যতা')) return 'history';

    // Combined Science & BGS subject check (e.g. Science/BGS or বিজ্ঞান/বিজিএস)
    if (low.includes('/') && (low.includes('science') || low.includes('বিজ্ঞান')) && (low.includes('bgs') || low.includes('বাংলাদেশ') || low.includes('বিজিএস'))) {
        return 'science_bgs';
    }

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
    if (low.includes('arabic') || low.includes('আরবি')) {
        if (is2 && !has1) return 'arabic_p2';
        if (has1 && !is2) return 'arabic_p1';
        if (is2 && has1) return 'arabic_combined';
        return 'arabic';
    }
    if (low.includes('drawing') || low.includes('অংকন') || low.includes('আঁকা')) return 'drawing';

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
    if (low.includes('career') || low.includes('ক্যারিয়ার') || low.includes('ক্যারিয়ার')) return 'career';
    if (low.includes('physical') || low.includes('শারীরিক') || low.includes('স্বাস্থ্য')) return 'physical_edu';
    if ((low.includes('science') || low.includes('বিজ্ঞান')) && !low.includes('social') && !low.includes('সমাজ')) return 'science';

    if (is2 && !has1) return low.replace(/([২2][য়য়য]|2nd|second|ii|দ্বিতীয়|দ্বিতীয়)/gi, '').replace(/[- ]/g, '').trim() + '_p2';
    if (has1 && !is2) return low.replace(/([১1][ম]|1st|first|i|প্রথম)/gi, '').replace(/[- ]/g, '').trim() + '_p1';

    return low;
};

const isScienceGroup = (g) => { const l = String(g || '').toLowerCase(); return l.includes('science') || l.includes('বিজ্ঞান'); };
const isCommerceGroup = (g) => { const l = String(g || '').toLowerCase(); return l.includes('commerce') || l.includes('business') || l.includes('ব্যবসায়') || l.includes('ব্যবসায়'); };
const isHumanitiesGroup = (g) => { const l = String(g || '').toLowerCase(); return l.includes('arts') || l.includes('humanities') || l.includes('মানবিক'); };

const getExpectedSubjects = (studentGroup, isNT, classSubjs, religionInPlay, onlyPrimary) => {
    // Only subjects that actually exist for THIS class/exam count as "expected".
    // A hardcoded global list previously made Primary classes report phantom subjects:
    // শিশু–২য় teach Arabic instead of Religion and have no ICT/Science/BGS, so those
    // showed up as mandatory and every student was marked "Absent" (and counted as failed).
    const normKeys = new Set(Array.from(classSubjs).map(s => normalizeSubjKey(s)));
    const classHas = (base) => normKeys.has(base) || Array.from(normKeys).some(k => k.startsWith(base + '_'));
    const subjects = new Set();
    ['math', 'ict'].forEach(k => { if (classHas(k)) subjects.add(k); });
    if (religionInPlay === undefined ? classHas('religion') : religionInPlay) subjects.add('religion');
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
        } else {
            subjects.add('science');
            if (isCommerceGroup(g) || classSubjs.has('accounting') || classSubjs.has('finance') || classSubjs.has('business')) {
                ['accounting', 'finance', 'business'].forEach(s => subjects.add(s));
            }
            if (isHumanitiesGroup(g) || classSubjs.has('history') || classSubjs.has('geography') || classSubjs.has('economics') || classSubjs.has('civics')) {
                ['history', 'geography'].forEach(s => subjects.add(s));
                if (classSubjs.has('economics')) subjects.add('economics');
                if (classSubjs.has('civics')) subjects.add('civics');
            }
        }
    } else {
        // PRIMARY: every subject the class actually teaches counts as expected. Without this,
        // subjects outside the core list - আরবি, অংকন, ... - were neither mandatory nor part of a
        // group, so their marks were skipped entirely: they never reached মোট / টিউটোরিয়াল and the
        // merit rank disagreed with the Result Card (a 586-mark student showed মোট 359, rank 1
        // instead of 2). Primary classes have no optional/partial subjects, so this is safe.
        // 6-8 is deliberately NOT included here: those classes do have partial subjects
        // (হিন্দু ধর্ম, শারীরিক শিক্ষা, half-entered papers) and treating them as mandatory would
        // mark students as failed - that needs a separate, school-confirmed change.
        if (onlyPrimary) {
            normKeys.forEach(k => subjects.add(k));
        }
        ['science', 'bgs'].forEach(k => { if (classHas(k)) subjects.add(k); });
    }
    return subjects;
};

const CO_CURRICULAR = [
  'শারীরিক', 'বই পড়া', 'achievement', 'continuous', 'wcat', 'শারিরীক',
  'ক্যারিয়ার', 'ক্যারিয়ার', 'career', 'চারু', 'কারুকলা', 'arts', 'crafts',
  'life and work', 'জীবনমুখী', 'কর্ম', 'word collection', 'ওয়ার্ড কালেকশন'
];
const isRelSubj = (n) => /religion|islam|hindu|buddhist|christian|ধর্ম|ইসলাম|হিন্দু|বৌদ্ধ|খ্রিস্ট/i.test(String(n));
const isArabicSubj = (n) => /arabic|আরবি|আরবী/i.test(String(n));
// Early Primary grades (শিশু–২য়) teach Arabic in place of Religion. ৩য়–৫ম DO teach ধর্ম,
// so the substitution must never be applied to them.
const EARLY_PRIMARY_PAT = /প্লে|play|nursery|শিশু|প্রথম|১ম|\b1st\b|\b1\b|দ্বিতীয়|দ্বিতীয়|২য়|২য়|\b2nd\b|\b2\b|class\s*[12]\b|শ্রেণি\s*[১২]|শ্রেণী\s*[১২]/i;
const isEarlyPrimaryName = (n) => EARLY_PRIMARY_PAT.test(String(n || ''));

const getSubjectName = (r, subjectsList = []) => {
    if (r.subject_name) return r.subject_name;
    if (r.subject?.name) return r.subject.name;
    if (r.subject_detail?.name) return r.subject_detail.name;
    if (r.subject != null || r.subject_id != null) {
        const sid = String(r.subject?.id || r.subject || r.subject_id || '');
        const found = subjectsList.find(s => String(s.id) === sid);
        if (found) return found.name;
    }
    return '';
};

const inferGroup = (resList, isNT, subjectsList = []) => {
    if (!isNT || !resList || resList.length === 0) return '';
    const count = (regex) => resList.filter(r => {
        const name = getSubjectName(r, subjectsList);
        const hasMarks = (parseFloat(r.written_marks) > 0 || parseFloat(r.mcq_marks) > 0 || parseFloat(r.practical_marks) > 0 || parseFloat(r.total_obtained) > 0);
        return hasMarks && regex.test(String(name).toLowerCase());
    }).length;
    // Core group subjects (excluding optional higher math to avoid misclassifying commerce/humanities)
    const sciCount = count(/physics|chemistry|biology|পদার্থ|রসায়ন|রসায়ন|জীব/i);
    const comCount = count(/accounting|finance|entrepreneurship|business|ব্যবসায়|হিসাব|ফিন্যান্স|ব্যবসায়/i);
    const humCount = count(/history|geography|civics|economics|ইতিহাস|ভূগোল|পৌরনীতি|অর্থনীতি/i);
    const takesGeneralScience = resList.some(r => {
        const name = getSubjectName(r, subjectsList).toLowerCase();
        const hasMarks = (parseFloat(r.written_marks) > 0 || parseFloat(r.mcq_marks) > 0 || parseFloat(r.practical_marks) > 0 || parseFloat(r.total_obtained) > 0);
        return hasMarks && (name === 'science' || name === 'বিজ্ঞান' || name === 'general science' || name === 'সাধারণ বিজ্ঞান');
    });

    if (takesGeneralScience && sciCount < 2) {
        if (comCount > humCount) return 'commerce';
        if (humCount > comCount) return 'humanities';
        if (comCount > 0) return 'commerce';
        if (humCount > 0) return 'humanities';
    }

    if (sciCount > 0 && sciCount > comCount && sciCount > humCount) return 'science';
    if (comCount > 0 && comCount >= humCount && comCount >= sciCount) return 'commerce';
    if (humCount > 0 && humCount >= comCount && humCount >= sciCount) return 'humanities';
    return '';
};

const inferClassGroupFromAllResults = (allRes, isNT, subjectsList = []) => {
    if (!isNT || !allRes || allRes.length === 0) return '';
    let com = 0, hum = 0, sci = 0;
    allRes.forEach(r => {
        const name = String(getSubjectName(r, subjectsList)).toLowerCase();
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

const parseRoll = (r) => {
  const eng = String(r || '').replace(/[০-৯]/g, d => "০১২৩৪৫৬৭৮৯".indexOf(d));
  const n = parseInt(eng.replace(/\D/g, ''));
  return isNaN(n) ? 999999 : n;
};

const normalizeExamType = (type, name = '') => {
  const t = (type || '').toLowerCase().trim();
  const n = (name || '').toLowerCase().trim();
  const combined = `${t} ${n}`;
  if (/pre[-_\s]?test|প্রাক[-_\s]?নির্বাচনী/i.test(combined)) return 'pre_test';
  if (/half[-_\s]?yearly|semi|mid|অর্ধ[-_\s]?বার্ষিক/i.test(combined)) return 'half_yearly';
  if (/annual|final|বার্ষিক/i.test(combined)) return 'annual';
  if (/test|নির্বাচনী|টেস্ট/i.test(combined)) return 'test';
  if (/model|মডেল/i.test(combined)) return 'model';
  if (/first[-_\s]?term|প্রথম[-_\s]?সাময়িক/i.test(combined)) return 'first_term';
  if (/terminal|টার্মিনাল/i.test(combined)) return 'terminal';
  if (['half_yearly', 'pre_test', 'annual', 'test', 'model', 'first_term', 'terminal'].includes(t)) {
    return t;
  }
  return t || 'other';
};

export default function ClassResultsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { classrooms, subjects: contextSubjects, refreshClassrooms } = useAcademics();
  const { school: schoolInfo } = useSchool();
  const isMounted = React.useRef(true);
  const [selectedClass, setSelectedClass] = useState(() => {
    return new URLSearchParams(window.location.search).get('classroom') || '';
  });
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(() => {
    return new URLSearchParams(window.location.search).get('section') || '';
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    return new URLSearchParams(window.location.search).get('year') || new Date().getFullYear();
  });
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
  const [classSubjectsList, setClassSubjectsList] = useState([]);
  const [resultsByStudent, setResultsByStudent] = useState(new Map());
  const [overallTotals, setOverallTotals] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [selectedExam, setSelectedExam] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('exam') || p.get('examination') || 'half_yearly';
  });

  const isClassNineOrTen = useMemo(() => {
    const cls = classrooms.find(c => String(c.id) === String(selectedClass));
    if (!cls) return false;
    const text = String(cls.name || '').toLowerCase();
    return /নবম|দশম|ssc|nine|ten|\bix\b|\bx\b|নাইন|টেন|৯|১০|\b9\b|\b10\b/i.test(text);
  }, [selectedClass, classrooms]);

  const currentGroupFromURL = useMemo(() => {
    const sec = sections.find(s => String(s.id) === String(selectedSection));
    const text = String(sec?.name || '').toLowerCase();
    if (text.includes('commerce') || text.includes('business') || text.includes('ব্যবসায়') || text.includes('ব্যবসায়')) return 'Commerce';
    if (text.includes('arts') || text.includes('humanities') || text.includes('মানবিক')) return 'Humanities';
    if (text.includes('science') || text.includes('বিজ্ঞান')) return 'Science';
    return '';
  }, [selectedSection, sections]);

  const studentListFiltered = useMemo(() => {
    return students.filter(s => {
        const fn = (s.user?.first_name || '').toUpperCase();
        const ln = (s.user?.last_name || '').toUpperCase();
        const fullName = (fn + ' ' + ln).trim();
        const isTC = fullName.includes('TC') || fn.includes('TC') || ln.includes('TC');
        const hasNoInfo = !fn && !ln && !s.roll_number;

        if (selectedSection && String(s.section?.id || s.section) !== String(selectedSection)) return false;
        return !isTC && !hasNoInfo;
    }).sort((a, b) => parseRoll(a.roll_number) - parseRoll(b.roll_number));
  }, [students, selectedSection]);

  const detectedGroup = useMemo(() => {
    if (!isClassNineOrTen) return '';

    // ১. সিলেক্টেড সেকশনের নাম বা ইউআরএল গ্রুপ সবার আগে প্রাধান্য পাবে (সবচেয়ে নির্ভরযোগ্য)
    if (currentGroupFromURL) {
        const urlG = currentGroupFromURL.toLowerCase();
        if (urlG.includes('science') || urlG.includes('বিজ্ঞান')) return 'science';
        if (urlG.includes('commerce') || urlG.includes('business') || urlG.includes('ব্যবসায়') || urlG.includes('ব্যবসায়')) return 'commerce';
        if (urlG.includes('arts') || urlG.includes('humanities') || urlG.includes('মানবিক')) return 'humanities';
    }

    // ১.১ সেকশন অবজেক্ট থেকে সরাসরি সার্চ
    if (selectedSection) {
        const sec = sections.find(s => String(s.id) === String(selectedSection));
        if (sec?.name) {
            const secName = String(sec.name).toLowerCase();
            if (secName.includes('science') || secName.includes('বিজ্ঞান')) return 'science';
            if (secName.includes('commerce') || secName.includes('business') || secName.includes('ব্যবসায়') || secName.includes('ব্যবসায়')) return 'commerce';
            if (secName.includes('arts') || secName.includes('humanities') || secName.includes('মানবিক')) return 'humanities';
        }
    }

    // ২. শিক্ষার্থীদের প্রোফাইল থেকে গ্রুপ চেক করা
    const firstWithGroup = studentListFiltered.find(s => s.student_group || s.group);
    if (firstWithGroup?.student_group || firstWithGroup?.group) {
        let g = (firstWithGroup.student_group || firstWithGroup.group).toLowerCase();
        if (g.includes('science') || g.includes('বিজ্ঞান')) return 'science';
        if (g.includes('commerce') || g.includes('business') || g.includes('ব্যবসায়') || g.includes('ব্যবসায়')) return 'commerce';
        if (g.includes('arts') || g.includes('humanities') || g.includes('মানবিক')) return 'humanities';
    }

    // ৩. সেকশনের সকল রেজাল্ট ডাটা থেকে ইনফার করা
    if (resultsByStudent.size > 0) {
        let sciCount = 0, comCount = 0, humCount = 0;
        for (const resList of resultsByStudent.values()) {
            const inferred = inferGroup(resList, true, contextSubjects);
            if (inferred === 'commerce') comCount++;
            else if (inferred === 'humanities') humCount++;
            else if (inferred === 'science') sciCount++;
        }
        if (comCount >= sciCount && comCount >= humCount && comCount > 0) return 'commerce';
        if (humCount >= sciCount && humCount >= comCount && humCount > 0) return 'humanities';
        if (sciCount > comCount && sciCount > humCount && sciCount > 0) return 'science';

        // ৩.১ ফলাফলের মাধ্যমে যদি গ্রুপ বের করা যায় (যেমন: ব্যবসায় সাবজেক্টের নম্বর থাকলে)
        let hasComSubjs = false, hasHumSubjs = false, hasSciSubjs = false;
        for (const resList of resultsByStudent.values()) {
            for (const r of resList) {
                const tot = parseFloat(r.total_obtained) || 0;
                const sumParts = (parseFloat(r.written_marks)||0) + (parseFloat(r.mcq_marks)||0) + (parseFloat(r.practical_marks)||0);
                if (tot > 0 || sumParts > 0) {
                    const name = String(getSubjectName(r, contextSubjects)).toLowerCase();
                    if (/accounting|finance|entrepreneurship|business|ব্যবসায়|হিসাব|ফিন্যান্স|ব্যবসায়/i.test(name)) hasComSubjs = true;
                    if (/history|geography|civics|economics|ইতিহাস|ভূগোল|পৌরনীতি|অর্থনীতি/i.test(name)) hasHumSubjs = true;
                    if (/physics|chemistry|biology|পদার্থ|রসায়ন|রসায়ন|জীব/i.test(name)) hasSciSubjs = true;
                }
            }
        }
        if (hasComSubjs && !hasSciSubjs) return 'commerce';
        if (hasHumSubjs && !hasSciSubjs) return 'humanities';
        if (hasSciSubjs && !hasComSubjs && !hasHumSubjs) return 'science';
    }

    return '';
  }, [selectedSection, sections, studentListFiltered, currentGroupFromURL, isClassNineOrTen, resultsByStudent, contextSubjects]);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const updateUrl = useCallback((updates) => {
    const params = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([key, val]) => {
      if (val === '' || val === null || val === undefined) params.delete(key);
      else params.set(key, String(val));
    });
    const newSearch = params.toString();
    if (window.location.search.substring(1) !== newSearch) {
      navigate({ search: newSearch }, { replace: true });
    }
  }, [navigate]);

  useEffect(() => { if (id) refreshClassrooms(id); }, [id, refreshClassrooms]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qClass = params.get('classroom') || '';
    const qSection = params.get('section') || '';
    const qYear = params.get('year') || '';
    const qExam = params.get('exam') || params.get('examination') || '';

    if (qClass && qClass !== selectedClass) {
      const ok = classrooms.some(c => String(c.id) === String(qClass));
      if (ok) setSelectedClass(String(qClass));
      else pendingClassRef.current = qClass;
    }
    if (qSection && qSection !== selectedSection) {
      const ok = sections.some(s => String(s.id) === String(qSection));
      if (ok) setSelectedSection(String(qSection));
      else pendingSectionRef.current = qSection;
    }
    if (qYear && String(qYear) !== String(selectedYear)) setSelectedYear(qYear);
    if (qExam && qExam !== selectedExam) setSelectedExam(qExam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const handleClassChange = (cVal) => {
    setSelectedClass(cVal);
    setSelectedSection('');
    updateUrl({ classroom: cVal, section: '' });
  };

  const handleSectionChange = (sVal) => {
    setSelectedSection(sVal);
    updateUrl({ section: sVal });
  };

  const handleExamChange = (exVal) => {
    setSelectedExam(exVal);
    updateUrl({ exam: exVal });
  };

  const handleYearChange = (yVal) => {
    setSelectedYear(yVal);
    updateUrl({ year: yVal });
  };

  const lastFetched = React.useRef("");
  const fetchController = React.useRef(null);

  useEffect(() => {
    if (!id || !selectedClass) return;

    const fetchKey = `${id}-${selectedClass}-${selectedSection}-${selectedExam}-${selectedYear}`;
    lastFetched.current = fetchKey;
    if (fetchController.current) fetchController.current.abort();
    fetchController.current = new AbortController();

    setLoading(true);
    const currentSchoolId = id;

    (async () => {
        try {
            // 1. Fetch Sections
            const secRes = await scopedGet('/api/academics/sections/', currentSchoolId, { classroom: selectedClass });
            if (!isMounted.current || currentSchoolId !== id) return;
            setSections(Array.isArray(secRes.data) ? secRes.data : (secRes.data?.results || []));

            // 1b. Fetch Subjects for this class/section
            const subRes = await scopedGet('/api/academics/subjects/', currentSchoolId, { classroom: selectedClass, section: selectedSection, page_size: 200 }).catch(() => ({ data: [] }));
            if (!isMounted.current || currentSchoolId !== id) return;
            const assignedList = Array.isArray(subRes.data) ? subRes.data : (subRes.data?.results || []);
            setClassSubjectsList(assignedList);

            // 2. Fetch Students
            const stuRes = await scopedGet('/api/academics/students/', currentSchoolId, { classroom: selectedClass, section: selectedSection, page_size: 500 });
            if (!isMounted.current || currentSchoolId !== id) return;
            const fetchedStudents = Array.isArray(stuRes.data) ? stuRes.data : (stuRes.data?.results || []);
            setStudents(fetchedStudents);

            // Primary classes have students with section = NULL, and may expose no sections at all.
            // A section filter (stale ?section= URL param, or a section that matches no student in
            // this class) would exclude every student and blank the table. Drop such a section so
            // it behaves as "All"; the fetch effect then re-runs without the section filter.
            if (selectedSection) {
                const anyStudentInSection = fetchedStudents.some(s =>
                    String(s.section?.id || s.section || '') === String(selectedSection));
                if (!anyStudentInSection) {
                    setSelectedSection('');
                    updateUrl({ section: '' });
                    return;
                }
            }

            const activeStudents = fetchedStudents.filter(s => {
                const fn = (s.user?.first_name || '').toUpperCase();
                const ln = (s.user?.last_name || '').toUpperCase();
                const fullName = (fn + ' ' + ln).trim();
                const isTC = fullName.includes('TC') || fn.includes('TC') || ln.includes('TC');
                const hasNoInfo = !fn && !ln && !s.roll_number;

                if (selectedSection) {
                    const stuSecId = String(s.section?.id || s.section || s.section_id || '');
                    if (stuSecId !== String(selectedSection)) return false;
                }

                return !isTC && !hasNoInfo;
            });

            if (activeStudents.length === 0) {
                setResultsByStudent(new Map());
                setOverallTotals(new Map());
                setLoading(false);
                return;
            }

            // 3. Fetch Examinations & Results strictly by examination ID with fallback to exam_type
            const examRes = await scopedGet('/api/results/examinations/', currentSchoolId, { ...(selectedClass ? { classroom: selectedClass } : {}), page_size: 100 }).catch(() => ({ data: [] }));
            const examList = Array.isArray(examRes.data) ? examRes.data : (Array.isArray(examRes.data?.results) ? examRes.data.results : []);
            const matchingExams = examList.filter(ex => {
                const clsId = String(typeof ex.classroom === 'object' ? (ex.classroom?.id || ex.classroom?.classroom_id || '') : (ex.classroom || ex.classroom_id || ''));
                return (!selectedClass || clsId === String(selectedClass)) && normalizeExamType(ex.exam_type, ex.name) === normalizeExamType(selectedExam);
            });
            const examIds = matchingExams.map(ex => ex.id);

            let allResults = [];
            const targetExamIds = examIds.length > 0 ? examIds : [null];
            for (const eId of targetExamIds) {
                let page = 1, hasNext = true;
                while (hasNext && page <= 25) {
                    const params = {
                        classroom: selectedClass || undefined,
                        section: selectedSection || undefined,
                        year: selectedYear,
                        page,
                        page_size: 500
                    };
                    if (eId) params.examination = eId;
                    else params.exam_type = selectedExam;

                    const res = await scopedGet('/api/results/results/', currentSchoolId, params).catch(() => ({ data: [] }));
                    if (!isMounted.current || currentSchoolId !== id) return;

                    const data = res.data;
                    const arr = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
                    allResults = allResults.concat(arr);
                    if (data.next) page++; else hasNext = false;
                }
            }

            if (!isMounted.current) return;

            if (!isMounted.current) return;

        const classSubjects = new Set();
        allResults.forEach(r => {
            const sn = String(r.subject?.name || r.subject_name || '').toLowerCase();
            if (!CO_CURRICULAR.some(c => sn.includes(c.toLowerCase()))) classSubjects.add(sn);
        });

        const allResultsSorted = (Array.isArray(allResults) ? [...allResults] : []).sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));

        const cleanedMap = new Map();
        const sumStr = (s) => String(s || '').split('+').reduce((acc, v) => acc + (parseFloat(v) || 0), 0);

        for (const s of activeStudents) {
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

                const hasActualMarks = (r.written_marks !== '' && r.written_marks !== null && r.written_marks !== undefined) ||
                                       (r.mcq_marks !== '' && r.mcq_marks !== null && r.mcq_marks !== undefined) ||
                                       (r.practical_marks !== '' && r.practical_marks !== null && r.practical_marks !== undefined);

                const w = hasActualMarks ? sumStr(r.written_marks) : 0;
                const m = hasActualMarks ? sumStr(r.mcq_marks) : 0;
                const p = hasActualMarks ? sumStr(r.practical_marks) : 0;
                const rTotal = hasActualMarks ? (w + m + p) : 0;
                const hasInput = hasActualMarks && rTotal > 0;

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

        const totals = new Map();
        for (const stu of activeStudents) {
            const sid = String(stu.id);
            const resList = cleanedMap.get(sid) || [];
            const virtualMap = new Map();
            resList.forEach(r => {
                const key = r.standard_key || normalizeSubjKey(r.subject?.name || r.subject_name || '');
                if (!virtualMap.has(key)) virtualMap.set(key, []);
                virtualMap.get(key).push(r);
            });

            const getGroupFromContext = () => {
                const secObj = sections.find(s => String(s.id) === String(stu?.section?.id || stu?.section));
                const text = String(secObj?.name || '').toLowerCase();
                if (text.includes('commerce') || text.includes('business') || text.includes('ব্যবসায়') || text.includes('ব্যবসায়')) return 'commerce';
                if (text.includes('humanities') || text.includes('arts') || text.includes('মানবিক')) return 'humanities';
                if (text.includes('science') || text.includes('বিজ্ঞান')) return 'science';
                return '';
            };

            // Detect class-level group as fallback
            let classLevelGroup = '';
            const groupCounts = { science: 0, commerce: 0, humanities: 0 };
            activeStudents.forEach(s => {
                const g = (s?.student_group || s?.group || '').toLowerCase();
                if (g.includes('science')) groupCounts.science++;
                else if (g.includes('commerce') || g.includes('business')) groupCounts.commerce++;
                else if (g.includes('arts') || g.includes('humanities')) groupCounts.humanities++;
            });
            if (groupCounts.science >= groupCounts.commerce && groupCounts.science >= groupCounts.humanities && groupCounts.science > 0) classLevelGroup = 'science';
            else if (groupCounts.commerce >= groupCounts.humanities && groupCounts.commerce > 0) classLevelGroup = 'commerce';
            else if (groupCounts.humanities > 0) classLevelGroup = 'humanities';

            const classGroupFromAllResults = inferClassGroupFromAllResults(allResults, isClassNineOrTen, contextSubjects);
            const sectionGroup = getGroupFromContext();
            const group = (
                stu?.student_group ||
                stu?.group ||
                sectionGroup ||
                currentGroupFromURL ||
                detectedGroup ||
                inferGroup(resList, isClassNineOrTen, contextSubjects) ||
                classGroupFromAllResults ||
                classLevelGroup
            ).toLowerCase();
            // ধর্ম is part of the curriculum wherever it is ASSIGNED to the class (৩য়–৫ম), even
            // before any marks exist. Exception: শিশু–২য় teach Arabic instead, so a stale religion
            // assignment there must not make ধর্ম mandatory.
            const religionAssigned = assignedList.some(s => isRelSubj(s?.name));
            const arabicAssigned = assignedList.some(s => isArabicSubj(s?.name));
            const religionHasResults = allResults.some(r => isRelSubj(r.subject?.name || r.subject_name || ''));
            const classLabelForReligion = (classrooms.find(c => String(c.id) === String(selectedClass)) || {}).name || '';
            const religionInPlay = religionAssigned &&
                !(arabicAssigned && !religionHasResults && isEarlyPrimaryName(classLabelForReligion));
            const expectedKeys = getExpectedSubjects(group, isClassNineOrTen, classSubjects, religionInPlay, isPrimaryClass);
            const takenRelId = resList.find(r => isRelSubj(r.subject?.name || r.subject_name) && (parseFloat(r.total_obtained) > 0))?.subject?.id || resList.find(r => isRelSubj(r.subject?.name || r.subject_name) && (parseFloat(r.total_obtained) > 0))?.subject;

            let score = 0, fails = 0, hasAnyMarks = false, totalPoints = 0, subjectCount = 0;

            const hmList = resList.filter(r => /higher|উচ্চতর/.test(String(r.subject?.name || r.subject_name).toLowerCase()));
            const agriList = resList.filter(r => /agriculture|home|কৃষি|গার্হস্থ্য/.test(String(r.subject?.name || r.subject_name).toLowerCase()));

            // Optional subject priority logic:
            const assignedOpt = stu?.optional_subject;
            const assignedOptId = String(assignedOpt?.id || assignedOpt || '');
            const assignedOptName = String(assignedOpt?.name || '').toLowerCase();

            let showHM = false, showAgri = false;

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

            const isCommerceOrHumanities = group.includes('commerce') || group.includes('business') || group.includes('ব্যবসায়') || group.includes('arts') || group.includes('humanities') || group.includes('মানবিক');
            if (isCommerceOrHumanities) {
                const isHMAssigned = (assignedOptId && hmList.some(r => String(r.subject?.id || r.subject) === assignedOptId)) || (assignedOptName && assignedOptName.includes('higher'));
                if (!isHMAssigned) showHM = false;
            }

            const studentKeys = new Set();
            resList.forEach(r => {
                const k = r.standard_key || normalizeSubjKey(r.subject?.name || r.subject_name || '');
                if (k) studentKeys.add(k);
            });
            const allKeys = new Set([...expectedKeys, ...studentKeys, 'higher', 'agriculture', 'civics', 'economics', 'geography', 'science', 'bgs', 'science_bgs']);
            let electiveCounted = false;
            const processedResultIds = new Set();
            let studentTotalTutorial = 0;

            allKeys.forEach(key => {
                if (key === 'higher' && !showHM) return;
                if (key === 'agriculture' && !showAgri) return;

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

                // Surgical Fallback for combined subjects (e.g. Science/BGS, Physics/Geography/Accounting)
                if (papers.length === 0) {
                    for (let [, vPapers] of virtualMap.entries()) {
                        if (vPapers.length > 0) {
                            const vName = String(vPapers[0].subject_name || vPapers[0].subject?.name || '').toLowerCase();
                            if (vName.includes('/') && vName.includes(key)) {
                                papers = vPapers;
                                break;
                            }
                        }
                    }
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
                        if (papers.length > 0 && !electiveCounted) {
                            isMandatory = true;
                            electiveCounted = true;
                        } else if (key === 'civics' && virtualMap.has('economics')) {
                            isMandatory = false;
                        } else if (key === 'economics' && virtualMap.has('civics')) {
                            isMandatory = false;
                        } else if (key === 'civics' && !electiveCounted && !virtualMap.has('economics')) {
                            isMandatory = true;
                            electiveCounted = true;
                        } else {
                            isMandatory = false;
                        }
                    }
                }

                if (papers.length === 0) {
                    if (isMandatory) {
                        if (isRel && takenRelId) return;
                        if (isClassNineOrTen) {
                            const hasCombined = virtualMap.size > 0 && Array.from(virtualMap.values()).some(vPapers =>
                                vPapers.some(r => {
                                    const vName = String(r.subject_name || r.subject?.name || '').toLowerCase();
                                    return vName.includes('/') && vName.includes(key);
                                })
                            );
                            if (hasCombined) return;

                            const takesSciGroup = virtualMap.has('physics') || virtualMap.has('chemistry') || virtualMap.has('biology');
                            if (isScienceGroup(group) && takesSciGroup) { if (key === 'science') return; }
                            else {
                                if (['physics', 'chemistry', 'biology'].includes(key)) return;
                                if (key === 'bgs') {
                                    const classHasBgs = (Array.isArray(allResults) ? allResults : []).some(r => normalizeSubjKey(r.subject?.name || r.subject_name) === 'bgs');
                                    if (!classHasBgs) return;
                                }
                            }
                        }
                        fails++; // Mark as fail if mandatory subject is missing/absent
                    }
                    return;
                }

                let totalW = 0, totalM = 0, totalP = 0, totalObtained = 0, totalPossible = 0, cqM = 0, mcqM = 0, prM = 0;
                let isAnyPaperPresentForSub = false;
                let hasUnprocessedPaper = false;

                papers.forEach(r => {
                    const rid = String(r.id || r.subject?.id || r.subject || r.subject_name);
                    if (processedResultIds.has(rid)) return;
                    processedResultIds.add(rid);
                    hasUnprocessedPaper = true;

                    if (r.hasMarks) { hasAnyMarks = true; isAnyPaperPresentForSub = true; }
                    const w = r.sumW, m = r.sumM, pr = r.sumP;
                    const subjName = r.subject?.name || r.subject_name;
                    let spec = getSubjectMaxima(subjName, isClassNineOrTen, group);
                    if (isPrimaryClass) {
                        // PRIMARY: written 100 (50 for drawing) + a separate 30-mark টিউটোরিয়াল that
                        // is stored in mcq_marks. The shared maxima helper describes 6-8 (English
                        // there has mcq 0), which capped 130 down to 100 and silently dropped the
                        // tutorial from মোট - a 586-mark student showed 359 and the wrong merit.
                        spec = { cq: primaryWrittenMax(subjName), mcq: 30, pr: 0 };
                    }
                    const paperMax = (spec.cq + spec.mcq + spec.pr || 100);

                    let obtained = (w + m + pr) > 0 ? (w + m + pr) : (parseFloat(r.total_obtained) || 0);
                    // Surgical Cap: ensure obtained marks do not exceed total possible
                    if (obtained > paperMax) obtained = paperMax;

                    totalW += w; totalM += m; totalP += pr; totalObtained += obtained;
                    totalPossible += paperMax;
                    cqM += spec.cq; mcqM += spec.mcq; prM += spec.pr;
                });

                if (!hasUnprocessedPaper) return;

                if (isMandatory || belongsToGroup) {
                    if (!isRel || (isRel && !takenRelId) || (isRel && papers.length > 0)) {
                         subjectCount++;
                    }
                }
                if (isClassNineOrTen && (key === 'bangla' || key === 'english')) {
                     totalPossible = Math.max(totalPossible, 200);
                     if (totalObtained > 200) totalObtained = 200;
                }

                const cqPass = cqM === 0 || totalW >= Math.round(cqM * 0.33 - 0.5);
                const mcqPass = mcqM === 0 || totalM >= Math.round(mcqM * 0.33 - 0.5);
                const prPass = prM === 0 || totalP >= Math.round(prM * 0.33 - 0.5);
                // PRIMARY: the টিউটোরিয়াল mark must never decide pass/fail or the grade points -
                // the written mark is judged against the written maximum (100, 50 for drawing),
                // exactly like ResultCard.jsx and Result.save(). মোট keeps written + tutorial.
                const gradeBasis = isPrimaryClass ? totalW : totalObtained;
                const gradePossible = isPrimaryClass
                    ? primaryWrittenMax(papers[0]?.subject?.name || papers[0]?.subject_name || '')
                    : totalPossible;
                const totPass = gradeBasis >= Math.round(gradePossible * 0.33 - 0.5);

                const isCoCurric = CO_CURRICULAR.some(c => String(key || '').toLowerCase().includes(c.toLowerCase()));
                let isSubjectPassed = isAnyPaperPresentForSub && (isClassNineOrTen ? (isCoCurric ? totPass : (cqPass && mcqPass && prPass && totPass)) : totPass);

                const gp = (isSubjectPassed && gradePossible > 0) ? computeGpa((gradeBasis / gradePossible) * 100) : 0;
                const isAgricultureSub = (key === 'higher' || key === 'agriculture');

                if ((key === 'higher' && showHM) || (key === 'agriculture' && showAgri)) {
                    const threshold = totalPossible * 0.4;
                    if (totalObtained > threshold) { score += (totalObtained - threshold); }
                    totalPoints += Math.max(0, gp - 2.0);
                    studentTotalTutorial += totalM;
                } else if (isMandatory || belongsToGroup) {
                    if (!isClassNineOrTen && isAgricultureSub) return;
                    if (isRel && takenRelId && !papers.some(r => String(r.subject?.id || r.subject) === String(takenRelId))) return;
                    score += totalObtained; totalPoints += gp;
                    studentTotalTutorial += totalM;
                    if (isMandatory && (!isAnyPaperPresentForSub || !isSubjectPassed)) { if (!(isClassNineOrTen === false && (key.includes('শারীরিক') || key.includes('physical')))) { fails++; } }
                }
            });

            if (!hasAnyMarks) fails = 999;
            const finalCgpa = (subjectCount > 0 && fails === 0) ? Math.min(5.0, totalPoints / subjectCount) : 0;
            totals.set(sid, { total: Math.round(score), totalTutorial: Math.round(studentTotalTutorial), rawScore: score, points: finalCgpa, fails, isAbsent: !hasAnyMarks, roll: parseRoll(stu.roll_number), group });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, selectedClass, selectedSection, selectedExam, selectedYear, studentListFiltered.length, isClassNineOrTen]);

  const displaySubjects = useMemo(() => {
    const set = new Set();
    const g = detectedGroup;

    // Detect active group from detectedGroup, currentGroupFromURL, or section name
    const secObj = sections.find(s => String(s.id) === String(selectedSection));
    const secName = String(secObj?.name || '').toLowerCase();
    let activeGroup = (g || currentGroupFromURL || '').toLowerCase();
    if (!activeGroup && secName) {
        if (secName.includes('science') || secName.includes('বিজ্ঞান')) activeGroup = 'science';
        else if (secName.includes('commerce') || secName.includes('business') || secName.includes('ব্যবসায়') || secName.includes('ব্যবসায়')) activeGroup = 'commerce';
        else if (secName.includes('arts') || secName.includes('humanities') || secName.includes('মানবিক')) activeGroup = 'humanities';
    }

    // Helper: check if ANY student in current resultsByStudent has actual positive marks in key (>0)
    const hasAnyRealMarks = (key) => {
        return Array.from(resultsByStudent.values()).some(list =>
            list.some(r => {
                const k = r.standard_key || normalizeSubjKey(r.subject_name || r.subject?.name || '');
                if (k !== key) return false;
                const w = parseFloat(r.written_marks);
                const m = parseFloat(r.mcq_marks);
                const p = parseFloat(r.practical_marks);
                const tot = parseFloat(r.total_obtained);
                const validPartSum = (!isNaN(w) ? w : 0) + (!isNaN(m) ? m : 0) + (!isNaN(p) ? p : 0);
                const validTot = !isNaN(tot) ? tot : 0;
                return validPartSum > 0 || validTot > 0;
            })
        );
    };

    const subjectsWithMarks = new Map(); // key -> label

    // 1. Populate ALL subjects assigned to this classroom / section
    if (selectedClass) {
        const listToUse = classSubjectsList.length > 0 ? classSubjectsList : contextSubjects;
        if (Array.isArray(listToUse)) {
            listToUse.forEach(sub => {
                const linkedClasses = Array.isArray(sub.classrooms) ? sub.classrooms : [];
                const isLinked = classSubjectsList.length > 0 || linkedClasses.length === 0 || linkedClasses.some(c => String(c.id || c) === String(selectedClass));
                if (isLinked) {
                    const rawName = String(sub.name || '');
                    const key = normalizeSubjKey(rawName);
                    if (!subjectsWithMarks.has(key)) {
                        subjectsWithMarks.set(key, rawName);
                    }
                }
            });
        }
    }

    // 2. Populate from result entries
    resultsByStudent.forEach(list => list.forEach(r => {
        const rawName = String(r.subject_name || r.subject?.name || '');
        const key = r.standard_key || normalizeSubjKey(rawName);
        if (hasAnyRealMarks(key)) {
            if (!subjectsWithMarks.has(key)) {
                subjectsWithMarks.set(key, rawName);
            }
        }
    }));

    const hasCombinedScienceBgs = Array.from(subjectsWithMarks.values()).some(label => {
        const low = String(label).toLowerCase();
        return low.includes('/') && (low.includes('science') || low.includes('বিজ্ঞান') || low.includes('bgs') || low.includes('বিজিএস'));
    });

    // Fallback compulsory subjects only if no subjects exist at all
    if (subjectsWithMarks.size === 0) {
        if (!subjectsWithMarks.has('math')) subjectsWithMarks.set('math', 'গণিত');
        if (!subjectsWithMarks.has('religion')) subjectsWithMarks.set('religion', 'ধর্ম');
    }

    // The ধর্ম column follows the subjects ASSIGNED to this class (the curriculum), not whether
    // marks happen to exist yet — ৩য়/৪র্থ/৫ম do teach ধর্ম even before any marks are entered.
    // Exception: early Primary (শিশু–২য়) teach Arabic instead, so a stale religion assignment
    // there must not create a phantom "ধর্ম" column full of "Absent".
    const religionAssignedToClass = (classSubjectsList || []).some(s => isRelSubj(s?.name));
    const arabicAssignedToClass = (classSubjectsList || []).some(s => isArabicSubj(s?.name));
    const classHasReligionResults = Array.from(resultsByStudent.values()).some(list =>
        list.some(r => isRelSubj(r.subject_name || r.subject?.name || '')));
    const classLabelForReligion = (classrooms.find(c => String(c.id) === String(selectedClass)) || {}).name || '';
    const religionReplacedByArabic = arabicAssignedToClass && !classHasReligionResults && isEarlyPrimaryName(classLabelForReligion);
    const classHasReligion = religionAssignedToClass && !religionReplacedByArabic;

    const allLabels = Array.from(subjectsWithMarks.values());
    subjectsWithMarks.forEach((label, key) => {
        // Navam-dasham bangla & english merged column handling
        if (isClassNineOrTen && (key.startsWith('bangla') || key.startsWith('english'))) return;

        const hasRealMarks = hasAnyRealMarks(key);

        // If combined Science/BGS paper exists, exclude standalone science or bgs ONLY if no real marks exist
        if (hasCombinedScienceBgs && (key === 'science' || key === 'bgs') && !label.includes('/') && !hasRealMarks) return;

        if (isClassNineOrTen) {
            // 1. Group-specific strict exclusion:
            if (activeGroup === 'commerce') {
                if (['physics', 'chemistry', 'biology', 'bgs', 'history', 'geography', 'civics', 'economics'].includes(key)) return;
            } else if (activeGroup === 'science') {
                if (['science', 'accounting', 'finance', 'business', 'history', 'geography', 'civics', 'economics'].includes(key)) return;
            } else if (activeGroup === 'humanities') {
                if (['physics', 'chemistry', 'biology', 'bgs', 'accounting', 'finance', 'business'].includes(key)) return;
            }

            // 2. Strict Universal Rule: If NO student in the current view has actual positive marks (>0) in an optional/elective subject, HIDE IT!
            const isCompulsoryCore = ['math', 'religion', 'ict', 'religion_merged', 'merged-bangla', 'merged-english'].includes(key) ||
                                     (activeGroup === 'science' && key === 'bgs') ||
                                     (activeGroup !== 'science' && key === 'science');
            if (!isCompulsoryCore && !hasRealMarks) {
                return;
            }
        }

        // নবম-দশম শ্রেণিতে বাংলা ও ইংরেজি আলাদা কলামে না দেখিয়ে মার্জ করা কলামে দেখানো হয়
        if (isClassNineOrTen && (key.startsWith('bangla') || key.startsWith('english'))) return;

        // সম্মিলিত সাবজেক্ট থাকলে একক সাবজেক্ট কলাম বাদ দেওয়া (স্কুল আইডি ৬৩-র মতো কেস)
        if (isClassNineOrTen && !label.includes('/') && key !== 'science' && key !== 'bgs' && key !== 'math' && key !== 'religion' && key !== 'ict') {
            const hasCombined = allLabels.some(l => {
                if (!l.includes('/')) return false;
                const lowL = l.toLowerCase();
                // Avoid matching combined optional subjects like 'কৃষি শিক্ষা/গার্হস্থ্য বিজ্ঞান' for 'বিজ্ঞান'
                if (lowL.includes('কৃষি') || lowL.includes('গার্হস্থ্য') || lowL.includes('agri') || lowL.includes('home')) return false;
                return lowL.includes(key) || (label.length > 2 && lowL.includes(label.toLowerCase().trim().split(' ')[0]));
            });
            if (hasCombined) return;
        }

        // ধর্ম সমন্বয়: হিন্দু ধর্ম বা ইসলাম শিক্ষা যাই হোক, সব 'ধর্ম' হিসেবে দেখাবো
        if (isRelSubj(label)) {
            if (classHasReligion) set.add({ label: 'ধর্ম', key: 'religion_merged' });
            return;
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
        if (n.includes('math') || n.includes('গণিত') || n.includes('গনিত')) return (n.includes('উচ্চতর') || n.includes('higher')) ? 1000 : 30;
        if (n.includes('religion') || n.includes('islam') || n.includes('hindu') || n.includes('ধর্ম') || n.includes('ইসলাম') || n.includes('হিন্দু') || n.includes('moral')) return 40;
        if (n.includes('ict') || n.includes('তথ্য')) return 50;
        if (n.includes('physics') || n.includes('পদার্থ')) return 70;
        if (n.includes('chemistry') || n.includes('রসায়ন') || n.includes('রসায়ন')) return 80;
        if (n.includes('biology') || n.includes('জীব')) return 90;
        if (n.includes('science') || n.includes('বিজ্ঞান')) return 100;
        if (n.includes('accounting') || n.includes('হিসাব')) return 120;
        if (n.includes('finance') || n.includes('ফিন্যান্স')) return 130;
        if (n.includes('business') || n.includes('ব্যবসায়') || n.includes('entrepreneurship') || n.includes('উদ্যোগ')) return 140;
        if (n.includes('history') || n.includes('ইতিহাস') || n.includes('সভ্যতা')) return 150;
        if (n.includes('geography') || n.includes('ভূগোল') || n.includes('ভুগোল')) return 160;
        if (n.includes('civics') || n.includes('পৌরনীতি') || n.includes('পৌরণীতি')) return 170;
        if (n.includes('economics') || n.includes('অর্থনীতি')) return 180;
        if (n.includes('agriculture') || n.includes('কৃষি') || n.includes('home') || n.includes('গার্হস্থ্য')) return 190;
        return 500;
    };
    const subjects = [];
    if (isClassNineOrTen) { subjects.push({ label: 'বাংলা (১ম+২য়)', key: 'merged-bangla' }, { label: 'ইংরেজি (১ম+২য়)', key: 'merged-english' }); }
    Array.from(set).forEach(s => {
        subjects.push(s);
    });
    return subjects.sort((a, b) => getWeight(a.key) - getWeight(b.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultsByStudent, isClassNineOrTen, detectedGroup, selectedSection, sections, currentGroupFromURL, selectedClass, contextSubjects, classSubjectsList, classrooms]);

  const currentClassLabel = classrooms.find(c => String(c.id) === String(selectedClass))?.name || '---';
  const currentSectionLabel = sections.find(s => String(s.id) === String(selectedSection))?.name || 'সব শাখা';

  const isPrimaryClass = useMemo(() => {
      const lbl = currentClassLabel.toLowerCase();
      return !(/ষষ্ঠ|six|\b6\b|সপ্তম|seven|\b7\b|অষ্টম|eight|\b8\b|নবম|nine|\b9\b|দশম|ten|\b10\b|ssc|ix|x/i.test(lbl));
  }, [currentClassLabel]);

  const getResultsMap = useCallback((sid, stuGroup = '') => {
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
        const spec = getSubjectMaxima(r.subject_name || r.subject?.name || '', isClassNineOrTen, stuGroup);
        const totalPossible = (spec.cq + spec.mcq + spec.pr || 100);

        // Consistent with ResultCard and MeritList: fallback to total_obtained if sum of parts is 0
        let tot = (w + mcq + pr) > 0 ? (w + mcq + pr) : (parseFloat(r.total_obtained) || 0);
        if (tot > totalPossible) tot = totalPossible;

        const p = [];
        if (spec.cq > 0) p.push(r.written_marks !== '' && r.written_marks !== null ? Math.round(w) : '0');
        if (spec.mcq > 0 && !isPrimaryClass) p.push(r.mcq_marks !== '' && r.mcq_marks !== null ? Math.round(mcq) : '0');
        if (spec.pr > 0) p.push(r.practical_marks !== '' && r.practical_marks !== null ? Math.round(pr) : '0');

        // PRIMARY: pass/fail comes from the written mark against the written maximum (100, or 50
        // for drawing) - the same rule as ResultCard.jsx. The tutorial never flips a subject here.
        const passBasis = isPrimaryClass ? w : tot;
        const passPossible = isPrimaryClass
            ? primaryWrittenMax(r.subject?.name || r.subject_name || '')
            : totalPossible;
        const cqPass = spec.cq === 0 || w >= Math.round(spec.cq * 0.33 - 0.5),
              mcqPass = spec.mcq === 0 || mcq >= Math.round(spec.mcq * 0.33 - 0.5),
              prPass = spec.pr === 0 || pr >= Math.round(spec.pr * 0.33 - 0.5),
              totPass = passBasis >= Math.round(passPossible * 0.33 - 0.5);
        const isPassed = has && (isClassNineOrTen ? (cqPass && mcqPass && prPass && totPass) : totPass);

        // PRIMARY: the subject cell shows the written and the টিউটোরিয়াল part SIDE BY SIDE and
        // never adds them together - e.g. বাংলা "86+28", or "28" when only the tutorial part was
        // entered, or "86" when only the written part was. The separate টিউটোরিয়াল column (its own
        // total) and the মোট column (written + tutorial) are unchanged, and the pass check above
        // stays written-only.
        const wEntered = r.written_marks !== '' && r.written_marks !== null && r.written_marks !== undefined;
        const tEntered = r.mcq_marks !== '' && r.mcq_marks !== null && r.mcq_marks !== undefined;
        const primaryParts = [];
        if (wEntered) primaryParts.push(Math.round(w));
        if (tEntered) primaryParts.push(Math.round(mcq));
        const primaryDisplay = primaryParts.length ? primaryParts.join('+') : '0';

        const displayStr = !has ? 'Absent'
            : isPrimaryClass ? primaryDisplay
            : (tot > 0
                ? (p.length > 1 ? `${Math.round(tot)} = ${p.join('+')}` : String(Math.round(tot)))
                : '0');

        m.set(key, { total: tot, display: displayStr, is_passed: isPassed, hasMarks: has });
    });
    const merge = (arr, key) => {
        if (arr.length === 0) return null;
        const getPN = (nm) => { const low = nm.toLowerCase(); if (low.includes('১ম') || low.includes('1st')) return 1; if (low.includes('২য়') || low.includes('2nd')) return 2; return 1; };
        arr.sort((a, b) => getPN(a.subject?.name || a.subject_name) - getPN(b.subject?.name || b.subject_name));
        const anyM = arr.some(r => r.hasMarks), sum = arr.reduce((s, r) => s + (parseFloat(r.total_obtained)||0), 0);
        let cqM = 0, mcqM = 0, prM = 0, sumW = 0, sumM = 0, sumP = 0;
        arr.forEach(r => { const spec = getSubjectMaxima(r.subject?.name || r.subject_name, isClassNineOrTen, stuGroup); cqM += spec.cq; mcqM += spec.mcq; prM += spec.pr; sumW += (parseFloat(r.written_marks)||0); sumM += (parseFloat(r.mcq_marks)||0); sumP += (parseFloat(r.practical_marks)||0); });
        let disp = 'Absent';
        if (anyM) {
            if (isPrimaryClass) {
                disp = sumW > 0 ? String(Math.round(sumW)) : '0';
            } else {
                const p = arr.map(r => Math.round(parseFloat(r.total_obtained)||0));
                if (sum === 0) disp = 'Absent'; else disp = (p.length > 1 ? `${Math.round(sum)} = ${p.join('+')}` : String(Math.round(sum)));
            }
        }
        if (isClassNineOrTen && (key === 'merged-bangla' || key === 'merged-english')) { if (cqM + mcqM + prM < 200) cqM = 200; }
        const cqP = cqM === 0 || sumW >= Math.round(cqM * 0.33 - 0.5), mcqP = mcqM === 0 || sumM >= Math.round(mcqM * 0.33 - 0.5), prP = prM === 0 || sumP >= Math.round(prM * 0.33 - 0.5), totP = sum >= ((cqM+mcqM+prM)*0.33-0.5);
        return { total: sum, display: disp, is_passed: anyM && (isClassNineOrTen ? (cqP && mcqP && prP && totP) : totP), hasMarks: anyM };
    };
    if (isClassNineOrTen) { if (b.length>0) m.set('merged-bangla', merge(b, 'merged-bangla')); if (e.length>0) m.set('merged-english', merge(e, 'merged-english')); }
    if (rel.length > 0) m.set('religion_merged', merge(rel, 'religion_merged'));
    return m;
  }, [resultsByStudent, isClassNineOrTen, isPrimaryClass]);

  const meritRanks = useMemo(() => {
    const sectionGroups = new Map();
    studentListFiltered.forEach(stu => {
        const sid = String(stu.id);
        const data = overallTotals.get(sid) || {
            total: 0,
            rawScore: 0,
            points: 0,
            fails: 999,
            isAbsent: true,
            roll: parseRoll(stu.roll_number)
        };

        const secId = (selectedSection ? 'single' : (stu.section?.id || stu.section || 'other'));
        if (!sectionGroups.has(secId)) sectionGroups.set(secId, []);
        sectionGroups.get(secId).push({ ...data, sid });
    });

    const ranks = new Map();
    sectionGroups.forEach(scores => {
        scores.sort((a, b) => {
            if (a.isAbsent !== b.isAbsent) return a.isAbsent ? 1 : -1;
            const aPassed = (a.fails === 0);
            const bPassed = (b.fails === 0);
            if (aPassed !== bPassed) return aPassed ? -1 : 1;
            if (a.fails !== b.fails) return a.fails - b.fails;
            if (Math.abs(b.points - a.points) > 0.0001) return b.points - a.points;
            if (Math.abs(b.rawScore - a.rawScore) > 0.01) return b.rawScore - a.rawScore;
            return (Number(a.roll) || 0) - (Number(b.roll) || 0);
        });
        scores.forEach((s, i) => {
            ranks.set(s.sid, i + 1);
        });
    });
    return ranks;
  }, [overallTotals, studentListFiltered, selectedSection]);

  const studentListSortedByRoll = useMemo(() => { return [...studentListFiltered].sort((a, b) => (parseInt(a.roll_number) || 999) - (parseInt(b.roll_number) || 999)); }, [studentListFiltered]);

  const currentExamLabel = useMemo(() => {
    if (selectedExam === 'half_yearly') return 'অর্ধ-বার্ষিক পরীক্ষা';
    if (selectedExam === 'annual') return 'বার্ষিক পরীক্ষা';
    if (selectedExam === 'pre_test') return 'প্রাক-নির্বাচনী পরীক্ষা';
    if (selectedExam === 'test') return 'নির্বাচনী (টেস্ট) পরীক্ষা';
    if (selectedExam === 'model') return 'মডেল টেস্ট পরীক্ষা';
    if (selectedExam === 'first_term') return 'প্রথম সাময়িক পরীক্ষা';
    if (selectedExam === 'terminal') return 'টার্মিনাল পরীক্ষা';
    return 'সকল পরীক্ষা';
  }, [selectedExam]);

  return (
    <Box sx={{ p: 3 }}>
      <Stack className="no-print" direction="row" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h4"><AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} /> Class Results</Typography>
        <Stack direction="row" spacing={1}><Button variant="outlined" onClick={() => navigate(-1)}>Back</Button><Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>Print</Button></Stack>
      </Stack>
      <Paper className="no-print" sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2}>
          <TextField select label="Class" value={selectedClass} onChange={e => handleClassChange(e.target.value)} sx={{ minWidth: 200 }}>
            {classrooms.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
          </TextField>
          <TextField select label="Section" value={selectedSection} onChange={e => handleSectionChange(e.target.value)} sx={{ minWidth: 150 }} disabled={!selectedClass}>
            <MenuItem value="">All</MenuItem>
            {sections.map(s => <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>)}
          </TextField>
          <TextField select label="Exam" value={selectedExam} onChange={e => handleExamChange(e.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="half_yearly">অর্ধ-বার্ষিক</MenuItem>
            <MenuItem value="annual">বার্ষিক</MenuItem>
            <MenuItem value="pre_test">প্রাক-নির্বাচনী</MenuItem>
            <MenuItem value="test">নির্বাচনী / টেস্ট</MenuItem>
            <MenuItem value="model">মডেল টেস্ট</MenuItem>
            <MenuItem value="first_term">প্রথম সাময়িক</MenuItem>
            <MenuItem value="terminal">টার্মিনাল</MenuItem>
          </TextField>
          <TextField type="number" label="Year" value={selectedYear} onChange={e => handleYearChange(e.target.value)} sx={{ width: 100 }} />
        </Stack>
      </Paper>
      <Box className="print-only" sx={{ display: 'none', textAlign: 'center', mb: 3, borderBottom: '2px solid black', pb: 2, "@media print": { display: 'block' } }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mb: 1 }}>{schoolInfo?.logo && <img src={getMediaUrl(schoolInfo.logo)} alt="Logo" style={{ height: '80px' }} />}<Box><Typography variant="h5" sx={{ fontWeight: 800, fontSize: '1.6rem' }}>{schoolInfo?.name}</Typography><Typography variant="body1" sx={{ fontSize: '1rem' }}>{schoolInfo?.address || ''}</Typography></Box></Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mt: 1, fontSize: '1.4rem' }}>শ্রেণি ভিত্তিক ফলাফল (Class Results)</Typography>
          <Typography variant="h6" sx={{ fontSize: '1rem' }}>শ্রেণি: {currentClassLabel} | শাখা: {currentSectionLabel} | পরীক্ষা: {currentExamLabel} | বছর: {selectedYear}</Typography>
      </Box>
      {loading ? <CircularProgress /> : (
        <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
          <Table size="small" sx={{ borderCollapse: 'collapse', '& td, & th': { border: '1.2px solid black !important', fontSize: { xs: '0.8rem', print: '7pt' }, py: 0.5, px: 0.3 } }}>
            <TableHead><TableRow sx={{ bgcolor: '#eee', "@media print": { bgcolor: '#eee !important', WebkitPrintColorAdjust: 'exact' } }}><TableCell align="center">রোল</TableCell><TableCell>Name</TableCell>{displaySubjects.map(s => <TableCell key={s.key} align="center" sx={{ fontWeight: 'bold' }}>{s.label}</TableCell>)}{isPrimaryClass && <TableCell align="center" sx={{ fontWeight: 'bold' }}>টিউটোরিয়াল</TableCell>}<TableCell align="center" sx={{ fontWeight: 'bold' }}>মোট</TableCell><TableCell align="center" sx={{ fontWeight: 'bold' }}>মেধাক্রম</TableCell></TableRow></TableHead>
            <TableBody>{studentListSortedByRoll.map(stu => {
              const stuData = overallTotals.get(String(stu.id));
              const stuGroup = (stuData?.group || stu?.student_group || stu?.group || currentGroupFromURL).toLowerCase();
              const stuResList = resultsByStudent.get(String(stu.id)) || [];
              const isSubMandatory = (subKey) => {
                  if (subKey.includes('merged')) return true;
                  const lowKey = subKey.toLowerCase();
                  if (lowKey === 'math') return true;
                  if (lowKey === 'religion_merged' || lowKey === 'religion') return true;
                  if (lowKey === 'ict') return true;

                  // If student has a combined paper covering this key (e.g. Science/BGS), standalone key is not mandatory
                  const hasCombinedMarks = stuResList.some(r => {
                      const vName = String(r.subject_name || r.subject?.name || '').toLowerCase();
                      return vName.includes('/') && (vName.includes(lowKey) || (lowKey === 'science' && (vName.includes('bgs') || vName.includes('বিজিএস'))) || (lowKey === 'bgs' && (vName.includes('science') || vName.includes('বিজ্ঞান'))));
                  });
                  if (hasCombinedMarks) return false;

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
                      if (stuGroup.includes('science')) {
                          if (['accounting', 'finance', 'business', 'history', 'geography', 'civics'].some(x=>lowKey.includes(x)) || lowKey === 'science') return false;
                          return true;
                      } else if (stuGroup.includes('commerce')) {
                          if (['physics', 'chemistry', 'biology', 'bgs', 'history', 'geography', 'civics', 'economics'].some(x=>lowKey.includes(x))) return false;
                          return true;
                      } else if (stuGroup.includes('humanities')) {
                          if (['physics', 'chemistry', 'biology', 'bgs', 'accounting', 'finance', 'business'].some(x=>lowKey.includes(x))) return false;
                          return true;
                      } else {
                          if (['physics', 'chemistry', 'biology'].some(x=>lowKey.includes(x))) return false;
                          return true;
                      }
                  }
                  return /bangla|english|math|religion|ict|science|bgs|তথ্য|বাংলাদেশ|বিজ্ঞান/i.test(lowKey);
              };
              return (
                <TableRow key={stu.id} sx={{ pageBreakInside: 'avoid' }}>
                  <TableCell align="center">{stu.roll_number}</TableCell><TableCell sx={{ fontWeight: 'bold', minWidth: '100px' }}>{stu.user?.first_name} {stu.user?.last_name}</TableCell>
                  {(() => { const resMap = getResultsMap(stu.id, stuGroup); return displaySubjects.map(sub => {
                      const r = resMap.get(sub.key); const mandatory = isSubMandatory(sub.key); const isOpt = /higher|উচ্চতর|agriculture|home|কৃষি|গার্হস্থ্য/.test(sub.key);
                      const isF = !isOpt && ((r && r.hasMarks && r.is_passed === false) || (!r && mandatory && stuData && !stuData.isAbsent));
                      const display = (r?.display === 'Absent' || (!r && mandatory)) ? <span style={{ color: 'red', fontWeight: 'normal' }}>Absent</span> : (!r && !mandatory ? <span style={{ color: '#aaa' }}>--</span> : (r?.display || ''));
                      return <TableCell key={sub.key} align="center" sx={{ color: isF ? 'red' : 'inherit' }}>{display}</TableCell>;
                  }); })()}
                  {isPrimaryClass && <TableCell align="center" sx={{ fontWeight: 'bold' }}>{stuData?.totalTutorial || 0}</TableCell>}
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
