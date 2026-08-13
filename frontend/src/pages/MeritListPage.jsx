import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, Grid, FormControl, InputLabel, Select, MenuItem, Button, Stack } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { scopedGet } from '../utils/schoolApi';
import { useAcademics } from '../context/AcademicsContext';
import { useSchool } from '../context/SchoolContext';
import PrintIcon from '@mui/icons-material/Print';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { getMediaUrl } from '../utils/media';

const getSubjectMaxima = (name, isClassNineOrTen) => {
  const lower = String(name || '').toLowerCase();

  if (lower.includes('বাংলা') || lower.includes('bangla')) {
    if (isClassNineOrTen && (lower.includes('১ম+২য়') || lower.includes('1st+2nd'))) return { cq: 140, mcq: 60, pr: 0 };
    if (!isClassNineOrTen && (lower.includes('২য়') || lower.includes('২য়') || lower.includes('2nd') || lower.includes('second') || lower.includes('ii'))) return { cq: 35, mcq: 15, pr: 0 };
    return { cq: 70, mcq: 30, pr: 0 };
  }

  if (lower.includes('english') || lower.includes('ইংরেজি') || lower.includes('ইংরেজী') || lower.includes('eng')) {
    if (isClassNineOrTen && (lower.includes('১ম+২য়') || lower.includes('1st+2nd'))) return { cq: 200, mcq: 0, pr: 0 };
    if (isClassNineOrTen) return { cq: 100, mcq: 0, pr: 0 };
    if (!isClassNineOrTen && (lower.includes('২য়') || lower.includes('২য়') || lower.includes('2nd') || lower.includes('second') || lower.includes('ii'))) return { cq: 50, mcq: 0, pr: 0 };
    return { cq: 100, mcq: 0, pr: 0 };
  }

  if (lower.includes('ict') || lower.includes('তথ্য') || lower.includes('information') || lower.includes('যোগাযোগ')) {
    return isClassNineOrTen ? { cq: 0, mcq: 25, pr: 25 } : { cq: 10, mcq: 15, pr: 25 };
  }

  const isPracticalScience = lower.includes('পদার্থ') || lower.includes('physics') || lower.includes('রসায়ন') || lower.includes('রসায়ন') || lower.includes('chemistry') || lower.includes('জীব') || lower.includes('biology') || lower.includes('উচ্চতর') || lower.includes('higher');
  const isAgriHome = lower.includes('কৃষি') || lower.includes('agriculture') || lower.includes('গার্হস্থ্য') || lower.includes('home science') || lower.includes('home economics');
  const isCA = lower.includes('শারীরিক') || lower.includes('physical') || lower.includes('career') || lower.includes('ক্যারিয়ার') || lower.includes('ক্যারিয়ার');

  if (isClassNineOrTen) {
    if (isPracticalScience || isAgriHome) return { cq: 50, mcq: 25, pr: 25 };
    if (isCA) return { cq: 0, mcq: 0, pr: 100 };
  } else {
    if (isPracticalScience) return { cq: 50, mcq: 25, pr: 25 };
    if (isAgriHome) return { cq: 35, mcq: 15, pr: 0 };
    if (isCA) return { cq: 0, mcq: 0, pr: 100 };
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
    if (low.includes('geography') || low.includes('ভূগোল') || low.includes('ভুগোল')) return 'geography';
    if (low.includes('civics') || low.includes('পৌরনীতি') || low.includes('পৌরণীতি')) return 'civics';
    if (low.includes('economics') || low.includes('অর্থনীতি')) return 'economics';
    if ((low.includes('science') || low.includes('বিজ্ঞান')) && !low.includes('social') && !low.includes('সমাজ')) return 'science';
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
        const hasP1 = Array.from(classSubjs).some(s => normalizeSubjKey(s) === base && !s.includes('2nd') && !s.includes('২য়') && !s.includes('২য়') && !s.includes('second'));
        const hasP2 = Array.from(classSubjs).some(s => normalizeSubjKey(s) === base && (s.includes('2nd') || s.includes('২য়') || s.includes('২য়') || s.includes('second')));
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
            // Add geography OR economics depending on which one has marks in classSubjs
            if (classSubjs.has('economics')) subjects.add('economics');
            else if (classSubjs.has('geography')) subjects.add('geography');
            else subjects.add('geography'); // Default
        }
    } else {
        ['science', 'bgs'].forEach(s => subjects.add(s));
    }
    return subjects;
};

const translateSub = (n) => {
    const low = String(n).toLowerCase().trim();
    if (low.includes('bgs') || low.includes('বাংলাদেশ ও বিশ্ব') || low.includes('bangladesh and global') || low.includes('bangladesh & global')) return 'বাংলাদেশ ও বিশ্বপরিচয়';
    if (low === 'bangla' || low === 'bangla (1st+2nd)' || low === 'বাংলা (১ম+২য়)') return 'বাংলা';
    if (low === 'english' || low === 'english (1st+2nd)' || low === 'ইংরেজি (১ম+২য়)') return 'ইংরেজি';
    if (low.includes('math') || low.includes('গণিত')) return (low.includes('higher') || low.includes('উচ্চতর') ? 'উচ্চতর গণিত' : 'গণিত');
    if (low.includes('physics') || low.includes('পদার্থ')) return 'পদার্থ বিজ্ঞান';
    if (low.includes('chemistry') || low.includes('রসায়ন') || low.includes('রসায়ন')) return 'রসায়ন';
    if (low.includes('biology') || low.includes('জীব')) return 'জীববিজ্ঞান';
    if (low.includes('accounting') || low.includes('হিসাব')) return 'হিসাব বিজ্ঞান';
    if (low.includes('finance') || low.includes('ফিন্যান্স')) return 'ফিন্যান্স ও ব্যাংকিং';
    if (low.includes('business') || low.includes('ব্যবসায়') || low.includes('ব্যবসায়')) return (low.includes('entrepreneurship') || low.includes('উদ্যোগ') ? 'ব্যবসায় উদ্যোগ' : 'ব্যবসায় শিক্ষা');
    if (low.includes('history') || low.includes('ইতিহাস')) return 'ইতিহাস';
    if (low.includes('geography') || low.includes('ভূগোল')) return 'ভূগোল';
    if (low.includes('civics') || low.includes('পৌরনীতি') || low.includes('পৌরণীতি')) return 'পৌরনীতি';
    if (low.includes('economics') || low.includes('অর্থনীতি')) return 'অর্থনীতি';
    if (low.includes('religion') || low.includes('ধর্ম')) return 'ধর্ম';
    if (low.includes('ict') || low.includes('তথ্য')) return 'আইসিটি';
    if (low.includes('science') || low.includes('বিজ্ঞান')) return 'বিজ্ঞান';
    if (low.includes('agri') || low.includes('কৃষি')) return 'কৃষি শিক্ষা';
    if (low.includes('home') || low.includes('গার্হস্থ্য')) return 'গার্হস্থ্য বিজ্ঞান';
    return n;
};

const CO_CURRICULAR = [
  'শারীরিক', 'বই পড়া', 'achievement', 'continuous', 'wcat', 'শারিরীক',
  'ক্যারিয়ার', 'ক্যারিয়ার', 'career', 'চারু', 'কারুকলা', 'arts', 'crafts',
  'life and work', 'জীবনমুখী', 'কর্ম', 'word collection', 'ওয়ার্ড কালেকশন'
];
const isRelSubj = (n) => /religion|islam|hindu|buddhist|christian|ধর্ম|ইসলাম|হিন্দু|বৌদ্ধ|খ্রিস্ট/i.test(String(n));

const MeritListPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const schoolId = id;
  const { classrooms, refreshClassrooms } = useAcademics();
  const { school: schoolInfo } = useSchool();
  const [sections, setSections] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [students, setStudents] = useState([]);

  useEffect(() => { if (id) refreshClassrooms(id); }, [id, refreshClassrooms]);

  useEffect(() => {
    if (!schoolId || !selectedClass) return;
    scopedGet('/api/academics/sections/', schoolId, { classroom: selectedClass }).then(res => setSections(Array.isArray(res.data) ? res.data : (res.data?.results || [])));
    scopedGet('/api/academics/students/', id, { classroom: selectedClass, section: selectedSection, page_size: 500 }).then(res => setStudents(res.data.results || res.data || []));
  }, [schoolId, selectedClass, selectedSection, id]);

  const studentListFiltered = useMemo(() => {
    return students.filter(s => {
        const fn = (s.user?.first_name || '').toUpperCase();
        const ln = (s.user?.last_name || '').toUpperCase();
        const fullName = (fn + ' ' + ln).trim();
        const isTC = fullName.includes('TC') || fn.includes('TC') || ln.includes('TC');
        const hasNoInfo = !fn && !ln && !s.roll_number;

        if (selectedSection && String(s.section?.id || s.section) !== String(selectedSection)) {
            return false;
        }

        return !isTC && !hasNoInfo;
    }).sort((a, b) => (parseInt(a.roll_number) || 999) - (parseInt(b.roll_number) || 999));
  }, [students, selectedSection]);


  const handleFetchRankings = () => {
    if (!selectedClass || studentListFiltered.length === 0) return;
    setLoading(true); setRankings([]);
    (async () => {
        try {
            let allResults = [], page = 1, hasNext = true;
            while (hasNext && page <= 25) {
                const res = await scopedGet('/api/results/results/', schoolId, { classroom: selectedClass, section: selectedSection, year: selectedYear, page, page_size: 500 });
                const data = res.data;
                allResults = allResults.concat(Array.isArray(data) ? data : (data.results || []));
                if (data.next) page++; else hasNext = false;
            }

            const clsObj = classrooms.find(c => String(c.id) === String(selectedClass));
            const isNineTen = clsObj ? /নবম|দশম|ssc|\b9\b|\b10\b|\bnine\b|\bten\b|\bix\b|\bx\b|class\s*9|class\s*10|৯ম|১০ম/i.test(clsObj.name.toLowerCase()) : false;

            const classSubjects = new Set();
            allResults.forEach(r => {
                const sn = String(r.subject?.name || r.subject_name || '').toLowerCase();
                if (!CO_CURRICULAR.some(c => sn.includes(c.toLowerCase()))) classSubjects.add(sn);
            });

            const inferGroup = (resList, isNT) => {
                if (!isNT || !resList || resList.length === 0) return '';
                const count = (regex) => resList.filter(r => {
                    const hasMarks = (parseFloat(r.written_marks) > 0 || parseFloat(r.mcq_marks) > 0 || parseFloat(r.practical_marks) > 0 || (parseFloat(r.total_obtained) > 0));
                    return hasMarks && regex.test(String(r.subject?.name || r.subject_name || '').toLowerCase());
                }).length;
                const sciCount = count(/physics|chemistry|biology|higher|পদার্থ|রসায়ন|জীব|উচ্চতর/i);
                const comCount = count(/accounting|finance|entrepreneurship|ব্যবসায়|হিসাব|ফিন্যান্স/i);
                const humCount = count(/history|geography|civics|ইতিহাস|ভূগোল|পৌরনীতি|economics|অর্থনীতি/i);

                // If student has 'General Science', they are definitely NOT Science group
                // UNLESS they have high count of Science electives (Fixes Osman Roll 5)
                const takesGeneralScience = resList.some(r => {
                    const name = (r.subject?.name || r.subject_name || '').toLowerCase();
                    const hasMarks = (parseFloat(r.written_marks) > 0 || parseFloat(r.mcq_marks) > 0 || (parseFloat(r.total_obtained) > 0));
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

            let classLevelGroup = '';
            const gCounts = { science: 0, commerce: 0, humanities: 0 };
            studentListFiltered.forEach(s => {
                const grpStr = (s?.student_group || s?.group || '').toLowerCase();
                if (grpStr.includes('science') || grpStr.includes('বিজ্ঞান')) gCounts.science++;
                else if (grpStr.includes('commerce') || grpStr.includes('business') || grpStr.includes('ব্যবসায়') || grpStr.includes('ব্যবসায়')) gCounts.commerce++;
                else if (grpStr.includes('arts') || grpStr.includes('humanities') || grpStr.includes('মানবিক')) gCounts.humanities++;
            });

            if (gCounts.science === 0 && gCounts.commerce === 0 && gCounts.humanities === 0 && isNineTen) {
                for (const r of allResults) {
                    const name = String(r.subject?.name || r.subject_name || '').toLowerCase();
                    if (/physics|chemistry|biology|higher|পদার্থ|রসায়ন|জীব|উচ্চতর/i.test(name)) gCounts.science++;
                    else if (/accounting|finance|entrepreneurship|ব্যবসায়|হিসাব|ফিন্যান্স/i.test(name)) gCounts.commerce++;
                    else if (/history|geography|civics|ইতিহাস|ভূগোল|পৌরনীতি|economics|অর্থনীতি/i.test(name)) gCounts.humanities++;
                }
            }

            if (gCounts.science >= gCounts.commerce && gCounts.science >= gCounts.humanities && gCounts.science > 0) classLevelGroup = 'science';
            else if (gCounts.commerce >= gCounts.humanities && gCounts.commerce > 0) classLevelGroup = 'commerce';
            else if (gCounts.humanities > 0) classLevelGroup = 'humanities';

            const classNameText = String(clsObj?.name || '').toLowerCase();
            if (classNameText.includes('science') || classNameText.includes('বিজ্ঞান')) classLevelGroup = 'science';
            else if (classNameText.includes('commerce') || classNameText.includes('business') || classNameText.includes('ব্যবসায়')) classLevelGroup = 'commerce';
            else if (classNameText.includes('arts') || classNameText.includes('humanities') || classNameText.includes('মানবিক')) classLevelGroup = 'humanities';

            const allResultsSorted = (Array.isArray(allResults) ? [...allResults] : []).sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));

            const resultsList = [];
            for (const student of studentListFiltered) {
                const stuResults = allResultsSorted.filter(r => String(r.student?.id || r.student) === String(student.id));

                const getGroupFromContext = () => {
                    const secObj = sections.find(s => String(s.id) === String(student?.section?.id || student?.section));
                    const text = (String(clsObj?.name || '') + ' ' + String(secObj?.name || '')).toLowerCase();
                    if (text.includes('science') || text.includes('বিজ্ঞান')) return 'science';
                    if (text.includes('commerce') || text.includes('business') || text.includes('ব্যবসায়')) return 'commerce';
                    if (text.includes('humanities') || text.includes('arts') || text.includes('মানবিক')) return 'humanities';
                    return '';
                };

                const groupRaw = (student?.student_group || student?.group || inferGroup(stuResults, isNineTen) || getGroupFromContext() || classLevelGroup || '').toLowerCase();
                const group = groupRaw.includes('science') ? 'science' :
                              (groupRaw.includes('commerce') || groupRaw.includes('business')) ? 'commerce' :
                              (groupRaw.includes('arts') || groupRaw.includes('humanities')) ? 'humanities' :
                              (classLevelGroup || '');

                const expectedKeys = getExpectedSubjects(group, isNineTen, classSubjects);

                const relResults = stuResults.filter(r => isRelSubj(r.subject?.name || r.subject_name));
                let suppressedIds = new Set();
                if (relResults.length > 1) {
                    const withMarks = relResults.map(r => ({
                        sid: String(r.subject?.id || r.subject || r.subject_name),
                        total: (parseFloat(r.total_obtained) || (parseFloat(r.written_marks)||0) + (parseFloat(r.mcq_marks)||0) + (parseFloat(r.practical_marks)||0))
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
                const sumStr = (s) => String(s || '').split('+').reduce((acc, v) => acc + (parseFloat(v) || 0), 0);

                stuResults.forEach(r => {
                    const sid = String(r.subject?.id || r.subject || r.subject_name);
                    if (suppressedIds.has(sid)) return;

                    const rawName = String(r.subject?.name || r.subject_name).toLowerCase().trim();
                    let normKey = normalizeSubjKey(rawName);

                    const is2 = /(২য়|২য়|2nd|second| ii | ii$| 2)/i.test(rawName);
                    const has1 = /(১ম|1st|first| i | i$| 1)/i.test(rawName);

                    let dedupeKey = normKey;
                    if (normKey === 'bangla' || normKey === 'english') {
                        if (is2 && !has1) dedupeKey = normKey + '_p2';
                        else if (has1 && !is2) dedupeKey = normKey + '_p1';
                        else dedupeKey = normKey + '_combined';
                    }

                    const isCombined = !(is2 || has1);
                    const hasSpecificPapers = stuResults.some(x => {
                        const xName = String(x.subject?.name || x.subject_name || '').toLowerCase();
                        const xIs2 = /(২য়|২য়|2nd|second| ii | ii$| 2)/i.test(xName);
                        const xHas1 = /(১ম|1st|first| i | i$| 1)/i.test(xName);
                        return normalizeSubjKey(xName) === normKey && (xIs2 || xHas1);
                    });
                    if (isNineTen && isCombined && hasSpecificPapers) return;

                    const w = sumStr(r.written_marks), m = sumStr(r.mcq_marks), p = sumStr(r.practical_marks);
                    const hasInput = (r.written_marks !== '' && r.written_marks !== null) || (r.mcq_marks !== '' && r.mcq_marks !== null) || (r.practical_marks !== '' && r.practical_marks !== null) || (parseFloat(r.total_obtained) > 0);

                    const rTotal = hasInput ? ((w + m + p) > 0 ? (w + m + p) : (parseFloat(r.total_obtained) || 0)) : 0;

                    const existing = subjectMap.get(dedupeKey);
                    if (!existing || rTotal > (existing.total_obtained || 0) || (hasInput && !existing.hasMarks)) {
                        subjectMap.set(dedupeKey, { ...r, sumW: w, sumM: m, sumP: p, hasMarks: hasInput, total_obtained: rTotal });
                    }
                });

                const virtualMap = new Map();
                const allSubRecords = Array.from(subjectMap.values());

                allSubRecords.forEach(r => {
                    const nm = String(r.subject?.name || r.subject_name || '').toLowerCase();
                    let norm = normalizeSubjKey(nm);
                    let key = norm;

                    if (isNineTen && (norm === 'bangla' || norm === 'english')) {
                         key = norm;
                    } else if (norm === 'bangla' || norm === 'english') {
                        const is2 = nm.includes('2nd') || nm.includes('২য়') || nm.includes('২য়') || nm.includes('second');
                        if (is2) key = norm + '_p2'; else key = norm + '_p1';
                    }
                    if (!virtualMap.has(key)) virtualMap.set(key, []);
                    virtualMap.get(key).push(r);
                });

                const relRecordWithMarks = Array.from(subjectMap.values()).find(r => isRelSubj(r.subject?.name || r.subject_name) && (parseFloat(r.total_obtained) > 0));
                const takenRelId = relRecordWithMarks?.subject?.id || relRecordWithMarks?.subject;

                let score = 0, fails = 0, failedSubs = [], hasAnyMarks = false, totalPoints = 0, subjectCount = 0;

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
                        showHM = isNineTen && (hmTotal >= agriTotal && hmTotal > 0);
                        showAgri = isNineTen && (agriTotal > hmTotal && agriTotal > 0);
                    }
                } else {
                    const hmTotal = hmList.reduce((s, r) => s + (parseFloat(r.total_obtained)||0), 0);
                    const agriTotal = agriList.reduce((s, r) => s + (parseFloat(r.total_obtained)||0), 0);
                    showHM = isNineTen && (hmTotal >= agriTotal && hmTotal > 0);
                    showAgri = isNineTen && (agriTotal > hmTotal && agriTotal > 0);
                }

                const allKeys = new Set([...expectedKeys, 'higher', 'agriculture', 'civics', 'economics', 'accounting', 'finance', 'business']);
                let electiveCounted = false;

                allKeys.forEach(key => {
                    const papers = virtualMap.get(key) || [];
                    const isRel = isRelSubj(key);
                    let isMandatory = expectedKeys.has(key);

                    const sciPool = ['physics', 'chemistry', 'biology'];
                    const comPool = ['accounting', 'finance', 'business'];
                    const humPool = ['history', 'geography', 'civics', 'economics'];

                    const belongsToGroup = (isScienceGroup(group) && sciPool.includes(key)) ||
                                           (isCommerceGroup(group) && comPool.includes(key)) ||
                                           (isHumanitiesGroup(group) && humPool.includes(key));

                    if (isNineTen && isHumanitiesGroup(group)) {
                        if (key === 'civics' || key === 'economics') {
                            if (papers.length > 0 && !electiveCounted) {
                                isMandatory = true;
                                electiveCounted = true;
                            } else if (key === 'civics' && !electiveCounted && !virtualMap.has('economics')) {
                                isMandatory = true;
                                electiveCounted = true;
                            }
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
                            if (isNineTen) {
                                if (isScienceGroup(group)) {
                                    if (key === 'science') return;
                                } else {
                                    if (key === 'bgs' || key === 'physics' || key === 'chemistry' || key === 'biology') return;
                                }
                            }
                            if (!isNineTen && (key === 'bangla' || key === 'english')) { if (virtualMap.has(key + '_p1') || virtualMap.has(key + '_p2')) return; }
                            fails++; failedSubs.push(translateSub(key));
                        }
                        return;
                    }

                    let totalW = 0, totalM = 0, totalP = 0, totalObtained = 0, totalPossible = 0, cqM = 0, mcqM = 0, prM = 0;
                    let isAnyPaperPresentForSub = false;
                    papers.forEach(r => {
                        if (r.hasMarks) { hasAnyMarks = true; isAnyPaperPresentForSub = true; }
                        const w = r.sumW, m = r.sumM, pr = r.sumP;
                        const spec = getSubjectMaxima(r.subject?.name || r.subject_name, isNineTen);
                        totalW += w; totalM += m; totalP += pr; totalObtained += (parseFloat(r.total_obtained) || 0);
                        totalPossible += (spec.cq + spec.mcq + spec.pr || 100);
                        cqM += spec.cq; mcqM += spec.mcq; prM += spec.pr;
                    });
                    if (isNineTen && (key === 'bangla' || key === 'english')) {
                         totalPossible = Math.max(totalPossible, 200);
                         if (totalObtained > 200) totalObtained = 200;
                    }
                    const cqPass = cqM === 0 || totalW >= Math.round(cqM * 0.33 - 0.5);
                    const mcqPass = mcqM === 0 || totalM >= Math.round(mcqM * 0.33 - 0.5);
                    const prPass = prM === 0 || totalP >= Math.round(prM * 0.33 - 0.5);
                    const totPass = totalObtained >= Math.round(totalPossible * 0.33 - 0.5);

                    const isCoCurric = CO_CURRICULAR.some(c => String(key || '').toLowerCase().includes(c.toLowerCase()));
                    let isSubjectPassed = isAnyPaperPresentForSub && (isNineTen ? (isCoCurric ? totPass : (cqPass && mcqPass && prPass && totPass)) : totPass);

                    const gp = isSubjectPassed ? computeGpa((totalObtained / totalPossible) * 100) : 0;
                    const isAgriculture = (key === 'higher' || key === 'agriculture');

                    if ((key === 'higher' && showHM) || (key === 'agriculture' && showAgri)) {
                        if (totalObtained > (totalPossible * 0.4)) { score += (totalObtained - (totalPossible * 0.4)); }
                        totalPoints += Math.max(0, gp - 2.0);
                    } else if (isMandatory || belongsToGroup) {
                        if (!isNineTen && isAgriculture) return;
                        if (isNineTen && (key === 'bgs' || key === 'science') && !isScienceGroup(group)) { if (!isAnyPaperPresentForSub) return; }
                        if (isRel && takenRelId && !papers.some(r => String(r.subject?.id || r.subject) === String(takenRelId))) return;
                        score += totalObtained; totalPoints += gp;
                        if (isMandatory && (!isAnyPaperPresentForSub || !isSubjectPassed)) { if (!(isNineTen === false && (key.includes('শারীরিক') || key.includes('physical')))) { fails++; failedSubs.push(translateSub(key)); } }
                    }
                });

                if (!hasAnyMarks) fails = 999;
                const finalCgpa = (subjectCount > 0 && fails === 0) ? Math.min(5.0, totalPoints / subjectCount) : 0;
                resultsList.push({ student, total_marks_obtained: Math.round(score), rawScore: score, points: finalCgpa, failed_subjects_count: fails, failed_subjects: Array.from(new Set(failedSubs)), section_id: student?.section?.id || student?.section || 'other', section_name: student?.section?.name || 'Other', original_roll: student?.roll_number ? parseInt(student.roll_number) : 999999, isAbsent: !hasAnyMarks });
            }

            const bySectionGroups = new Map();
            resultsList.forEach(item => {
                const secId = selectedSection ? 'single' : (item.section_id || 'other');
                if (!bySectionGroups.has(secId)) bySectionGroups.set(secId, []);
                bySectionGroups.get(secId).push(item);
            });

            const final = [];
            bySectionGroups.forEach(items => {
                items.sort((a, b) => {
                    if (a.isAbsent !== b.isAbsent) return a.isAbsent ? 1 : -1;

                    // CRITICAL RANKING PRIORITY:
                    // 1. Fewer Fails (Mandatory first priority)
                    if (a.failed_subjects_count !== b.failed_subjects_count) {
                        return a.failed_subjects_count - b.failed_subjects_count;
                    }

                    // 2. Higher CGPA
                    if (b.points !== a.points) {
                        return b.points - a.points;
                    }

                    // 3. Higher Total Marks
                    if (b.rawScore !== a.rawScore) {
                        return b.rawScore - a.rawScore;
                    }

                    // 4. Lower Roll Number
                    return a.original_roll - b.original_roll;
                });
                items.forEach((it, i) => {
                    it._new_roll = i + 1;
                    final.push(it);
                });
            });

            setRankings(final.sort((a, b) => {
                const sComp = (a.section_name || '').localeCompare(b.section_name || '');
                if (sComp !== 0) return sComp;
                return a.original_roll - b.original_roll;
            }));
        } catch (e) { console.error(e); setErrorMessage('ডাটা প্রসেস করতে সমস্যা হয়েছে'); } finally { setLoading(false); }
    })();
  };

  const currentClassLabel = classrooms.find(c => String(c.id) === String(selectedClass))?.name || '---';
  const currentSectionLabel = sections.find(s => String(s.id) === String(selectedSection))?.name || 'সব শাখা';

  return (
    <Box sx={{ p: 3 }} className="merit-list-root">
      <Stack className="no-print" direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>মেধাতালিকা (Merit List)</Typography>
        <Stack direction="row" spacing={1}><Button variant="outlined" onClick={() => navigate(-1)}>Back</Button><Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>প্রিন্ট</Button></Stack>
      </Stack>
      <Paper className="no-print" sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}><FormControl fullWidth><InputLabel>শ্রেণি</InputLabel><Select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>{classrooms.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}</Select></FormControl></Grid>
          <Grid item xs={12} md={2}><FormControl fullWidth><InputLabel>শাখা</InputLabel><Select value={selectedSection} onChange={e => setSelectedSection(e.target.value)}><MenuItem value="">সব শাখা</MenuItem>{sections.map(s => <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>)}</Select></FormControl></Grid>
          <Grid item xs={12} md={2}><FormControl fullWidth><InputLabel>সাল</InputLabel><Select value={String(selectedYear)} onChange={e => setSelectedYear(e.target.value)}>{[2024, 2025, 2026].map(y => <MenuItem key={y} value={String(y)}>{y}</MenuItem>)}</Select></FormControl></Grid>
          <Grid item xs={12} md={2}><Button variant="contained" onClick={handleFetchRankings} fullWidth sx={{ height: '56px' }}>দেখুন</Button></Grid>
        </Grid>
      </Paper>
      <Box className="print-only" sx={{ display: 'none', textAlign: 'center', mb: 3, borderBottom: '2px solid black', pb: 2, "@media print": { display: 'block' } }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mb: 1 }}>
              {schoolInfo?.logo && <img src={getMediaUrl(schoolInfo.logo)} alt="Logo" style={{ height: '80px' }} />}
              <Box>
                  <Typography variant="h5" sx={{ fontWeight: 800, fontSize: '1.6rem' }}>{schoolInfo?.name}</Typography>
                  <Typography variant="body1" sx={{ fontSize: '1.0rem' }}>{schoolInfo?.address || ''}</Typography>
              </Box>
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mt: 1, textDecoration: 'underline' }}>মেধাতালিকা (Merit List)</Typography>
          <Typography variant="h6">শ্রেণি: {currentClassLabel} | শাখা: {currentSectionLabel} | বছর: {selectedYear}</Typography>
      </Box>
      {loading ? <CircularProgress /> : rankings.length > 0 && (
        <TableContainer component={Paper} sx={{ boxShadow: 'none', width: '100%' }}>
          <Table size="small" sx={{ width: '100%', borderCollapse: 'collapse', '& td, & th': { border: '1px solid black', py: 1, px: 1.5 } }}>
            <TableHead><TableRow sx={{ bgcolor: '#eee', "@media print": { bgcolor: '#eee !important', WebkitPrintColorAdjust: 'exact' } }}><TableCell align="center" sx={{ fontWeight: 'bold' }}>রোল</TableCell><TableCell sx={{ fontWeight: 'bold' }}>শিক্ষার্থীর নাম</TableCell><TableCell align="center" sx={{ fontWeight: 'bold' }}>মোট নম্বর</TableCell><TableCell align="center" sx={{ fontWeight: 'bold' }}>GPA</TableCell><TableCell align="center" sx={{ fontWeight: 'bold' }}>মেধাক্রম</TableCell><TableCell sx={{ fontWeight: 'bold' }}>ফেইল করা বিষয়সমূহ</TableCell></TableRow></TableHead>
            <TableBody>{rankings.map(r => (
              <TableRow key={r.student.id} sx={{ pageBreakInside: 'avoid' }}>
                <TableCell align="center">{r.student.roll_number}</TableCell>
                <TableCell sx={{ fontWeight: 'bold', wordBreak: 'break-word' }}>{r.student.user?.first_name} {r.student.user?.last_name}</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>{r.total_marks_obtained}</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>{r.isAbsent ? '--' : r.points.toFixed(2)}</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', color: r.isAbsent ? 'red' : 'inherit' }}>{r._new_roll}</TableCell>
                <TableCell sx={{ color: 'red', wordBreak: 'break-word' }}>{r.isAbsent ? 'অনুপস্থিত (Absent)' : r.failed_subjects.join(', ')}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </TableContainer>
      )}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          @page { size: portrait; margin: 10mm; }
          .merit-list-root { padding: 0 !important; }
          .MuiTableContainer-root { overflow: visible !important; width: 100% !important; border: none !important; }
          table { width: 100% !important; table-layout: auto !important; }
          .print-only { display: block !important; padding-top: 7mm !important; }
        }
      `}</style>
    </Box>
  );
};

export default MeritListPage;
