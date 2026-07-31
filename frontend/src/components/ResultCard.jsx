import React, { useMemo } from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Grid, Stack } from '@mui/material';
import dayjs from 'dayjs';
import './ResultCard.css';
import ImageWithFallback from './ImageWithFallback';
import api from '../utils/api';
import fallbackLogo from './fallback_logo.png';
import { getMediaUrl } from '../utils/media';

const toBn = (v) => String(v ?? '').replace(/[0-9]/g, d => ['০','১','২','৩','৪','৫','৬','৭','৮','৯'][d]);

const getSubjectOrderWeight = (r, isOptional) => {
  if (!r) return 9999;
  if (isOptional) return 1000;
  const rawName = String(r.subject?.name || r.subject_name || '').replace(/\s*\(.*?\)\s*/g, '').trim();
  const n = rawName.toLowerCase();
  const clean = n.replace(/\u200d/g, '').replace(/\s+/g, ' ').trim();
  if (r.id === 'merged-bangla' || clean.includes('বাংলা') || clean.includes('bangla') || clean.includes('bengali')) {
      if (clean.includes('বাংলাদেশ') || clean.includes('bangladesh')) return 61;
      return 10;
  }
  if (r.id === 'merged-english' || clean.includes('english') || clean.includes('ইংরেজি') || clean.includes('ইংরেজী')) return 20;
  if (clean.includes('গণিত') || clean.includes('গনিত') || clean.includes('math') || clean.includes('mathematics')) return 30;
  if (clean.includes('ইসলাম') || clean.includes('islam') || clean.includes('হিন্দু') || clean.includes('hindu') || clean.includes('ধর্ম') || clean.includes('religion')) return 40;
  if (clean.includes('আইসিটি') || clean.includes('ict') || clean.includes('তথ্য') || clean.includes('information')) return 50;
  if (clean.includes('বিজ্ঞান') || clean.includes('science')) {
      if (clean.includes('পদার্থ') || clean.includes('physics')) return 70;
      if (clean.includes('রসায়ন') || clean.includes('chemistry')) return 80;
      if (clean.includes('জীব') || clean.includes('biology')) return 90;
      return 60;
  }
  if (clean.includes('বাংলাদেশ') || clean.includes('বিশ্বপরিচয়') || clean.includes('bangladesh') || clean.includes('bgs')) return 61;
  if (clean.includes('পদার্থ') || clean.includes('physics')) return 70;
  if (clean.includes('হিসাব') || clean.includes('accounting')) return 71;
  if (clean.includes('ভূগোল') || clean.includes('geography')) return 72;
  if (clean.includes('রসায়ন') || clean.includes('রসায়ন') || clean.includes('chemistry')) return 80;
  if (clean.includes('ফিন্যান্স') || clean.includes('finance') || clean.includes('ব্যাংকিং') || clean.includes('banking')) return 81;
  if (clean.includes('ইতিহাস') || clean.includes('history')) return 82;
  if (clean.includes('জীব') || clean.includes('biology')) return 90;
  if (clean.includes('ব্যবসায়') || clean.includes('business') || clean.includes('উদ্যোগ') || clean.includes('entrepreneurship')) return 91;
  if (clean.includes('পৌরনীতি') || clean.includes('civics') || clean.includes('নাগরিকতা') || clean.includes('citizenship')) return 92;
  return 200 + clean.length;
};

const sortSubjectsByOrder = (arr, allResults) => {
  if (!Array.isArray(arr) || arr.length === 0) return arr;
  return [...arr].sort((a, b) => {
    const isOptA = allResults.some(r => (r.id === a.id || r.subject?.id === a.subject?.id) && r.is_optional_detected);
    const isOptB = allResults.some(r => (r.id === b.id || r.subject?.id === b.subject?.id) && r.is_optional_detected);
    const wa = getSubjectOrderWeight(a, isOptA);
    const wb = getSubjectOrderWeight(b, isOptB);
    if (wa !== wb) return wa - wb;
    const na = String(a?.subject?.name || a?.subject_name || '').toLowerCase();
    const nb = String(b?.subject?.name || b?.subject_name || '').toLowerCase();
    return na.localeCompare(nb, 'bn', { sensitivity: 'base' });
  });
};

export default function ResultCard({ studentData, results: rawResults, overallResult, examination, school, schoolId, forceLanguage, translatedData }) {
  const student = studentData?.student || {};
  const user = student.user || {};
  const [resolvedSchool, setResolvedSchool] = React.useState(school || null);
  React.useEffect(() => { if (school && !resolvedSchool) setResolvedSchool(school); }, [school, resolvedSchool]);

  const labels = useMemo(() => ({
    bn: { reportTitle: "একাডেমিক ট্রান্সক্রিপ্ট", studentName: "শিক্ষার্থীর নাম:", rollNo: "রোল নং:", class: "শ্রেণি:", examination: "পরীক্ষা:", guardian: "অভিভাবক:", subjectName: "বিষয়ের নাম", cq: "সৃজনশীল", mcq: "নৈর্ব্যক্তিক", prac: "ব্যবহারিক", total: "মোট", grade: "গ্রেড", gpa: "জিপিএ", overallResult: "মোট নম্বর / ফলাফল", continuousAssessment: "ধারাবাহিক মূল্যায়ন", finalStatus: "সর্বশেষ অবস্থা", overallGpa: "মোট জিপিএ", letterGrade: "লেটার গ্রেড", passed: "✓ উত্তীর্ণ", failed: "✗ অনুত্তীর্ণ", classTeacherSig: "শ্রেণি শিক্ষকের স্বাক্ষর", guardianSig: "অভিভাবকের স্বাক্ষর", headmaster: "প্রধান শিক্ষক" },
    en: {
      reportTitle: "ACADEMIC TRANSCRIPT",
      studentName: "Student Name:",
      rollNo: "Roll No:",
      class: "Class:",
      examination: "Examination:",
      guardian: "Guardian:",
      subjectName: "SUBJECT NAME",
      cq: "CQ",
      mcq: "MCQ",
      prac: "PRAC",
      total: "TOTAL",
      grade: "GRADE",
      gpa: "GPA",
      overallResult: "TOTAL MARKS / OVERALL RESULT",
      continuousAssessment: "CONTINUOUS ASSESSMENT",
      finalStatus: "Final Status",
      overallGpa: "Overall GPA",
      letterGrade: "Letter Grade",
      passed: "✓ PASSED",
      failed: "✗ FAILED",
      classTeacherSig: "Class Teacher's Signature",
      guardianSig: "Guardian's Signature",
      headmaster: "Headmaster",
      examinationTypes: {
        'half_yearly': 'Half Yearly Examination',
        'annual': 'Annual Examination',
        'test': 'Class Test',
        'terminal': 'Terminal Examination',
        'model': 'Model Test',
        'pre_test': 'Pre-Test Examination'
      }
    }
  }), []);

  const studentName = useMemo(() => {
    if (forceLanguage === 'en' && (user.first_name_en || user.last_name_en)) {
      return `${user.first_name_en || ''} ${user.last_name_en || ''}`.trim();
    }
    if (translatedData?.student_name) return translatedData.student_name;
    return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
  }, [user, translatedData, forceLanguage]);

  const guardianName = useMemo(() => {
    if (forceLanguage === 'en' && student.guardian_name_en) return student.guardian_name_en;
    if (translatedData?.guardian_name) return translatedData.guardian_name;
    return (student.guardian ? `${student.guardian.first_name || ''} ${student.guardian.last_name || ''}`.trim() : '') || student.guardian_name || student.parent_name || student.father_name || student.mother_name || user.guardian_name || user.parent_name || '';
  }, [student, user, translatedData, forceLanguage]);

  const schoolName = useMemo(() => {
    if (forceLanguage === 'en' && resolvedSchool?.name_en) return resolvedSchool.name_en;
    if (translatedData?.school_name) return translatedData.school_name;
    return resolvedSchool?.name || "BD School";
  }, [resolvedSchool, translatedData, forceLanguage]);

  const isLanguageBengali = useMemo(() => {
    if (forceLanguage === 'en') return false;
    if (forceLanguage === 'bn') return true;
    const isBn = (t) => /[\u0980-\u09FF]/.test(String(t || ''));
    if (isBn(studentName)) return true;
    if (isBn(school?.name)) return true;
    if (rawResults && rawResults.length > 0) {
      for (let i = 0; i < Math.min(3, rawResults.length); i++) {
        if (isBn(rawResults[i].subject?.name || rawResults[i].subject_name)) return true;
      }
    }
    return false;
  }, [studentName, rawResults, school, forceLanguage]);

  const l = isLanguageBengali ? labels.bn : labels.en;
  const n = (v) => isLanguageBengali ? toBn(v) : v;

  const isClassNineOrTen = useMemo(() => {
    try {
      const sources = [student?.classroom?.name, examination?.classroom?.name, examination?.name, student?.classroom?.display_name].filter(Boolean).map(s => String(s).toLowerCase());
      const text = sources.join(' ');
      return /নবম|দশম|ssc|\b9\b|\b10\b|\bnine\b|\bten\b|\bix\b|\bx\b|class\s*9|class\s*10/.test(text);
    } catch (_) { return false; }
  }, [student, examination]);

  const isCoCurricular = (name) => {
    const n = String(name || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
    const baseList = ['শারীরিক শিক্ষা ও স্বাস্থ্য', 'শারীরিক শিক্ষা', 'Physical Education', 'Physical Education and Health', 'ক্যারিয়ার শিক্ষা', 'ক্যারিয়ার শিক্ষা', 'Career Education', 'ক্যারিয়ার', 'ক্যারিয়ার', 'Word Collection Achievement Test', 'WCAT', 'বই পড়া', 'বই পড়া', 'চারু ও কারুকলা', 'Arts and Crafts'];
    if (!isClassNineOrTen && (n.includes('কৃষি') || n.includes('agriculture') || n.includes('গার্হস্থ্য') || n.includes('home economics'))) return true;
    return baseList.some(sub => n.includes(sub.toLowerCase()));
  };

  const isOptionalSubject = (r) => {
    if (!r) return false;
    const sname = String(r.subject?.name || r.subject_name || '').toLowerCase();
    const optId = student.optional_subject?.id || student.optional_subject;
    if (optId && String(optId) === String(r.subject?.id || r.subject)) return true;
    const optSubName = String(student.optional_subject?.name || '').toLowerCase();
    if (optSubName && sname.includes(optSubName)) return true;
    const isNineTenAgri = isClassNineOrTen && (sname.includes('কৃষি') || sname.includes('গার্হস্থ্য'));
    return sname.includes('optional') || sname.includes('ঐচ্ছিক') || sname.includes('fourth') || sname.includes('৪র্থ') || sname.includes('উচ্চতর') || isNineTenAgri;
  };

  const getSubjectMaxima = (name) => {
    const lower = String(name || '').toLowerCase();
    if (lower.includes('ict') || lower.includes('তথ্য')) return isClassNineOrTen ? { cq: 0, mcq: 25, pr: 25 } : { cq: 10, mcq: 15, pr: 25 };
    if (isClassNineOrTen) {
      if (lower.includes('পদার্থ') || lower.includes('physics') || lower.includes('রসায়ন') || lower.includes('রসায়ন') || lower.includes('chemistry') || lower.includes('জীব') || lower.includes('biology') || lower.includes('উচ্চতর')) return { cq: 50, mcq: 25, pr: 25 };
      if (lower.includes('কৃষি') || lower.includes('agriculture') || lower.includes('গার্হস্থ্য') || lower.includes('home economics')) return { cq: 50, mcq: 25, pr: 25 };
      if (lower.includes('বাংলা') || lower.includes('bangla')) return { cq: 70, mcq: 30, pr: 0 };
      if (lower.includes('english') || lower.includes('ইংরেজি') || lower.includes('ইংরেজী')) return { cq: 100, mcq: 0, pr: 0 };
    } else {
      if (lower.includes('কৃষি') || lower.includes('agriculture') || lower.includes('গার্হস্থ্য') || lower.includes('home economics')) return { cq: 35, mcq: 15, pr: 0 };
      if ((lower.includes('বাংলা') || lower.includes('bangla')) && (lower.includes('২য়') || lower.includes('২য়') || lower.includes('2nd') || lower.includes('second'))) return { cq: 35, mcq: 15, pr: 0 };
      if ((lower.includes('english') || lower.includes('ইংরেজি') || lower.includes('ইংরেজী')) && (lower.includes('২য়') || lower.includes('২য়') || lower.includes('2nd') || lower.includes('second'))) return { cq: 50, mcq: 0, pr: 0 };
      if (lower.includes('ধর্ম') || lower.includes('religion') || lower.includes('ইসলাম') || lower.includes('হিন্দ')) return { cq: 70, mcq: 30, pr: 0 };
    }
    return { cq: 70, mcq: 30, pr: 0 };
  };

  const computeGrade = (pct) => {
    if (pct >= 80) return 'A+'; if (pct >= 70) return 'A'; if (pct >= 60) return 'A-';
    if (pct >= 50) return 'B'; if (pct >= 40) return 'C'; if (pct >= 33) return 'D';
    return 'F';
  };

  const computeGpa = (pct) => {
    if (pct >= 80) return 5.0; if (pct >= 70) return 4.0; if (pct >= 60) return 3.5;
    if (pct >= 50) return 3.0; if (pct >= 40) return 2.0; if (pct >= 33) return 1.0;
    return 0.0;
  };

  const getGradeFromCgpa = (v) => {
    const val = parseFloat(v);
    if (val >= 5.0) return 'A+'; if (val >= 4.0) return 'A'; if (val >= 3.5) return 'A-';
    if (val >= 3.0) return 'B'; if (val >= 2.0) return 'C'; if (val >= 1.0) return 'D';
    return 'F';
  };

  const allRecalculated = useMemo(() => {
    if (!Array.isArray(rawResults)) return [];
    return rawResults.map(r => {
      const w = parseFloat(r.written_marks) || 0;
      const m = parseFloat(r.mcq_marks) || 0;
      const p = parseFloat(r.practical_marks) || 0;
      const spec = getSubjectMaxima(r.subject?.name || r.subject_name);
      const totalPossible = spec.cq + spec.mcq + spec.pr || 100;
      const obtained = w + m + p;
      const percentage = (obtained / totalPossible) * 100;
      const passThreshold = Math.round(totalPossible * 0.33);
      let isPassed = obtained >= passThreshold;
      if (isClassNineOrTen && !isCoCurricular(r.subject?.name || r.subject_name) && !isOptionalSubject(r)) {
        if (spec.cq > 0 && w < Math.round(spec.cq * 0.33)) isPassed = false;
        if (spec.mcq > 0 && m < Math.round(spec.mcq * 0.33)) isPassed = false;
        if (spec.pr > 0 && p < Math.round(spec.pr * 0.33)) isPassed = false;
      }
      return { ...r, total_obtained: obtained, total_possible: totalPossible, grade: isPassed ? computeGrade(percentage) : 'F', gpa: isPassed ? computeGpa(percentage).toFixed(2) : '0.00', is_passed: isPassed, is_optional_detected: isOptionalSubject(r) };
    });
  }, [rawResults, isClassNineOrTen]);

  const displayResults = useMemo(() => {
    const resultsMap = new Map();

    const getPaperKey = (nm) => {
      const low = nm.toLowerCase();
      const p = (low.includes('১ম') || low.includes('1st') || low.includes('first') || low.includes(' i ') || low.endsWith(' i')) ? '1' :
                (low.includes('২য়') || low.includes('২য়') || low.includes('2nd') || low.includes('second') || low.includes(' ii ') || low.endsWith(' ii')) ? '2' : '';
      const b = low.replace(/(১ম|২য়|২য়|1st|2nd|first|second|paper|পত্র|i|ii)/gi, '').replace(/\s*\(.*?\)\s*/g, '').trim();
      return b + (p ? `_p${p}` : '');
    };

    allRecalculated.forEach(r => {
        const name = (r.subject?.name || r.subject_name || '').toLowerCase().trim();
        const normKey = isClassNineOrTen ? getPaperKey(name) : name.replace(/\s*\(.*?\)\s*/g, '');

        // Priority: Latest created/updated result should win
        if (!resultsMap.has(normKey)) {
            resultsMap.set(normKey, r);
        } else {
            const existing = resultsMap.get(normKey);
            const existingDate = new Date(existing.created_at || existing.updated_at || 0).getTime();
            const currentDate = new Date(r.created_at || r.updated_at || 0).getTime();
            if (currentDate >= existingDate) resultsMap.set(normKey, r);
        }
    });
    const cleanResults = Array.from(resultsMap.values());
    const filteredResults = cleanResults.filter(r => {
        if (isCoCurricular(r.subject?.name || r.subject_name)) return true;
        if (!isClassNineOrTen) return true;
        const group = String(student.student_group || student.group || '').toLowerCase();
        const name = (r.subject?.name || r.subject_name || '').toLowerCase();
        const SCIENCE_SUBJS = ['physics', 'chemistry', 'biology', 'higher math', 'পদার্থ', 'রসায়ন', 'জীব', 'উচ্চতর'];
        const COMMERCE_SUBJS = ['accounting', 'finance', 'business', 'হিসাব', 'ফিন্যান্স', 'ব্যবসায়'];
        const ARTS_SUBJS = ['history', 'geography', 'civics', 'economics', 'ইতিহাস', 'ভূগোল', 'পৌরনীতি', 'অর্থনীতি'];
        if (group === 'science' && anyMatch(name, COMMERCE_SUBJS.concat(ARTS_SUBJS))) return false;
        if (group === 'commerce' && anyMatch(name, SCIENCE_SUBJS.concat(ARTS_SUBJS))) return false;
        if (group === 'arts' && anyMatch(name, SCIENCE_SUBJS.concat(COMMERCE_SUBJS))) return false;
        return true;
    });
    function anyMatch(text, list) { return list.some(kw => text.includes(kw)); }
    let mainResults = filteredResults.filter(r => !isCoCurricular(r.subject?.name || r.subject_name) && !isOptionalSubject(r));
    let optionalResults = filteredResults.filter(isOptionalSubject);
    let coCurricularResults = filteredResults.filter(r => isCoCurricular(r.subject?.name || r.subject_name));
    if (isClassNineOrTen) {
      const merged = [];
      const handledSubjectIds = new Set();
      const papers = {
        bangla: mainResults.filter(r => { const n = String(r.subject?.name || r.subject_name || '').toLowerCase(); return (n.includes('বাংলা') || n.includes('bangla')) && !n.includes('বাংলাদেশ'); }),
        english: mainResults.filter(r => { const n = String(r.subject?.name || r.subject_name || '').toLowerCase(); return n.includes('english') || n.includes('ইংরেজি') || n.includes('ইংরেজী'); })
      };
      if (papers.bangla.length > 0) {
        const sumObtained = papers.bangla.reduce((s, r) => s + r.total_obtained, 0);
        const totalPossible = papers.bangla.reduce((s, r) => s + r.total_possible, 0);
        const allPassed = papers.bangla.every(r => r.is_passed);
        const firstName = String(papers.bangla[0]?.subject?.name || papers.bangla[0]?.subject_name || '').toLowerCase();
        const mergedName = (forceLanguage === 'en' || firstName.includes('bangla') || firstName.includes('bengali')) ? 'Bangla (1st + 2nd)' : 'বাংলা (১ম + ২য়)';
        merged.push({ id: 'merged-bangla', subject: { name: mergedName }, written_marks: papers.bangla.map(r => r.written_marks || '0').join(' + '), mcq_marks: papers.bangla.map(r => r.mcq_marks || '0').join(' + '), practical_marks: '--', total_obtained: sumObtained, total_possible: totalPossible, grade: allPassed ? computeGrade((sumObtained/totalPossible)*100) : 'F', gpa: allPassed ? computeGpa((sumObtained/totalPossible)*100).toFixed(2) : '0.00', is_passed: allPassed });
        papers.bangla.forEach(r => handledSubjectIds.add(r.subject?.id || r.subject));
      }
      if (papers.english.length > 0) {
        const sumObtained = papers.english.reduce((s, r) => s + r.total_obtained, 0);
        const totalPossible = papers.english.reduce((s, r) => s + r.total_possible, 0);
        const allPassed = papers.english.every(r => r.is_passed);
        const firstName = String(papers.english[0]?.subject?.name || papers.english[0]?.subject_name || '').toLowerCase();
        const mergedName = (forceLanguage === 'en' || firstName.includes('english')) ? 'English (1st + 2nd)' : 'ইংরেজি (১ম + ২য়)';
        merged.push({ id: 'merged-english', subject: { name: mergedName }, written_marks: papers.english.map(r => r.written_marks || '0').join(' + '), mcq_marks: papers.english.map(r => r.mcq_marks || '0').join(' + '), practical_marks: '--', total_obtained: sumObtained, total_possible: totalPossible, grade: allPassed ? computeGrade((sumObtained/totalPossible)*100) : 'F', gpa: allPassed ? computeGpa((sumObtained/totalPossible)*100).toFixed(2) : '0.00', is_passed: allPassed });
        papers.english.forEach(r => handledSubjectIds.add(r.subject?.id || r.subject));
      }
      mainResults.forEach(r => { if (!handledSubjectIds.has(r.subject?.id || r.subject)) merged.push(r); });
      return { main: sortSubjectsByOrder([...merged, ...optionalResults], allRecalculated), coCurricular: coCurricularResults };
    }
    return { main: sortSubjectsByOrder([...mainResults, ...optionalResults], allRecalculated), coCurricular: coCurricularResults };
  }, [allRecalculated, isClassNineOrTen, student]);

  const finalSummary = useMemo(() => {
    let totalObtained = 0, totalPossible = 0, sumGpa = 0, count = 0, hasFail = false;
    displayResults.main.forEach(r => {
      if (isOptionalSubject(r)) return;
      totalObtained += r.total_obtained; totalPossible += r.total_possible;
      const gpa = parseFloat(r.gpa);
      if (gpa === 0) hasFail = true;
      sumGpa += gpa; count++;
    });
    const opt = allRecalculated.find(isOptionalSubject);
    let bonus = 0;
    if (opt) {
      const optGpa = parseFloat(opt.gpa);
      bonus = Math.max(0, optGpa - 2.0);
      const optObtained = opt.total_obtained;
      const optThreshold = opt.total_possible * 0.4;
      if (optObtained > optThreshold) totalObtained += (optObtained - optThreshold);
    }
    const cgpa = (count > 0 && !hasFail) ? Math.min(5.0, (sumGpa + bonus) / count) : 0;
    const finalCgpaStr = cgpa.toFixed(2);
    return { obtained: Math.round(totalObtained), possible: Math.round(totalPossible), cgpa: finalCgpaStr, isPassed: !hasFail && count > 0, grade: getGradeFromCgpa(finalCgpaStr) };
  }, [displayResults.main, allRecalculated]);

  const isClassSixToEight = useMemo(() => {
    try {
      const text = String(student.classroom?.name || examination?.classroom?.name || '').toLowerCase();
      return /six|seven|eight|ষষ্ঠ|সপ্তম|অষ্টম|6|7|8/.test(text);
    } catch (_) { return false; }
  }, [student, examination]);

  const cleanClassName = useMemo(() => {
    let name = (translatedData?.class_name || student.classroom?.name || '');
    // Remove brackets like (Humanities), (Science), or (A)
    name = name.replace(/\s*\(.*?\)\s*/g, ' ').trim();
    if (forceLanguage === 'en') {
       name = name.replace(/Class/gi, '').replace(/শ্রেণি/gi, '').trim();
       // Convert Ordinal to Cardinal (Seventh -> Seven, etc.)
       const ordMap = {
         'Sixth': 'Six',
         'Seventh': 'Seven',
         'Eighth': 'Eight',
         'Ninth': 'Nine',
         'Tenth': 'Ten'
       };
       Object.keys(ordMap).forEach(key => {
         const reg = new RegExp(key, 'gi');
         name = name.replace(reg, ordMap[key]);
       });
    }
    return name;
  }, [student, forceLanguage, translatedData]);

  const displaySection = useMemo(() => {
    let sec = student.section?.name || '';
    if (forceLanguage === 'en') {
      const secMap = {
        'মানবিক': 'Humanities',
        'বিজ্ঞান': 'Science',
        'ব্যবসায় শিক্ষা': 'Commerce',
        'ব্যবসা': 'Commerce',
        'ক': 'A',
        'খ': 'B',
        'গ': 'C',
        'ঘ': 'D',
        'এ': 'A',
        'বি': 'B',
        'সি': 'C',
        'ডি': 'D'
      };
      return secMap[sec] || sec;
    }
    return sec;
  }, [student, forceLanguage]);

  const formatMark = (val) => {
    const res = (val === null || val === undefined || val === '' || val === 0 || val === '0' || val === '--') ? '--' : val;
    return isLanguageBengali ? toBn(res) : res;
  };
  const getGradeColor = (g) => { const map = { 'A+': '#1b5e20', 'A': '#2e7d32', 'A-': '#4caf50', 'B': '#f9a825', 'C': '#ef6c00', 'D': '#d84315', 'F': '#c62828' }; return map[g] || '#757575'; };
  const studentGroupEn = useMemo(() => { const g = String(student.student_group || student.group || '').toLowerCase(); if (g === 'science') return 'Science'; if (g === 'arts' || g === 'humanities') return 'Humanities'; if (g === 'commerce' || g === 'business') return 'Business Studies'; return ''; }, [student]);
  const studentGroupBn = useMemo(() => { const g = String(student.student_group || student.group || '').toLowerCase(); if (g === 'science') return 'বিজ্ঞান'; if (g === 'arts' || g === 'humanities') return 'মানবিক'; if (g === 'commerce' || g === 'business') return 'ব্যবসায় শিক্ষা'; return ''; }, [student]);
  const studentPhotoUrl = getMediaUrl(user?.photo || user?.photo_url);
  const logoUrl = getMediaUrl(resolvedSchool?.logo || fallbackLogo);
  const displayClass = useMemo(() => { if (translatedData?.class_name) return translatedData.class_name; return `${student.classroom?.name || ''} ${student.section?.name ? `(${student.section.name})` : ''}`; }, [student, translatedData]);
  const displayAddress = useMemo(() => {
    if (forceLanguage === 'en') {
      const addr = student.address_en || resolvedSchool?.address_en;
      if (addr) return addr.replace(/মাইজপাড়া?,?/g, '').trim();
    }
    if (translatedData?.address) return translatedData.address.replace(/মাইজপাড়া?,?/g, '').trim();
    return (student.address || resolvedSchool?.address || "").replace(/মাইজপাড়া?,?/g, '').trim();
  }, [student, resolvedSchool, forceLanguage, translatedData]);

  const displayExam = useMemo(() => {
    if (translatedData?.examination_name) return translatedData.examination_name;
    const year = String(examination?.academic_year || examination?.year || new Date().getFullYear());
    let name = examination?.name || '';

    if (forceLanguage === 'en') {
      const typeLabel = labels.en.examinationTypes?.[examination?.exam_type];
      if (typeLabel) name = typeLabel;
      else {
        // Fallback common translations if name is in Bangla
        const nameMap = { 'প্রাক-নির্বাচনী': 'Pre-Test', 'নির্বাচনী': 'Test', 'অর্ধ-বার্ষিক': 'Half Yearly', 'বার্ষিক': 'Annual' };
        name = nameMap[name] || name;
      }
    }

    // Ensure year is appended with a hyphen if not already present in the name
    if (name && year && !name.includes(year)) {
      return `${name}-${year}`;
    }
    return name || year;
  }, [examination, translatedData, forceLanguage, labels.en.examinationTypes]);

  return (
    <Box className="result-card-container" sx={{
      width: '210mm', height: '296mm', mx: 'auto', bgcolor: 'white', position: 'relative',
      boxSizing: 'border-box', overflow: 'hidden', pageBreakAfter: 'always',
      boxShadow: 'none !important', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
      border: '6px solid #1a237e', // Outer Navy
      '&::before': {
        content: '""', position: 'absolute', top: '6px', left: '6px', right: '6px', bottom: '6px',
        border: '4px solid #ffd700', pointerEvents: 'none', zIndex: 10
      },
      '&::after': {
        content: '""', position: 'absolute', top: '10px', left: '10px', right: '10px', bottom: '10px',
        border: '2px solid #1a237e', pointerEvents: 'none', zIndex: 10
      },
      '@media print': { margin: '0 !important', border: '6px solid #1a237e !important', height: '296mm', width: '210mm' }
    }}>
      <Box sx={{ p: '15mm', height: '100%', width: '100%', boxSizing: 'border-box', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {/* Background Watermark */}
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '95%', opacity: 0.08, zIndex: 0, pointerEvents: 'none', display: 'flex', justifyContent: 'center' }}>
          <img src={logoUrl} alt="" style={{ width: '100%', maxWidth: '700px', filter: 'grayscale(10%)' }} />
        </Box>

        <Box sx={{ position: 'relative', zIndex: 2, flexGrow: 1 }}>
          {/* Header Section */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, gap: 1 }}>
            <Box sx={{ width: '105px', minWidth: '105px', display: 'flex', alignItems: 'center' }}><ImageWithFallback src={logoUrl} alt="Logo" width="100px" height="auto" /></Box>
            <Box sx={{ flexGrow: 1, textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 900, color: '#1a237e !important', fontSize: '1.4rem', mb: 0.3, letterSpacing: '0.1px', whiteSpace: 'nowrap' }}>{schoolName}</Typography>
              {resolvedSchool?.ein && (<Typography sx={{ fontSize: '12px', color: '#333 !important', fontWeight: 'bold' }}>EIIN: {resolvedSchool.ein}</Typography>)}
              <Typography sx={{ color: '#555 !important', fontSize: '10px' }}>{displayAddress}</Typography>
              <Box sx={{ mx: 'auto', width: 'fit-content', px: 3, py: 0.5, border: '1.5px solid #1a237e', borderRadius: '4px', bgcolor: '#1a237e !important', color: 'white !important', mt: 1, textAlign: 'center' }}>
                <Typography sx={{ fontWeight: 900, fontSize: '14px', letterSpacing: 1.5, lineHeight: 1.2 }}>{l.reportTitle.toUpperCase()}</Typography>
                <Typography sx={{ fontWeight: 'bold', fontSize: '11px', mt: 0.2 }}>{displayExam}</Typography>
              </Box>
            </Box>
            <Box sx={{ width: '125px' }}>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #1a237e', bgcolor: 'transparent', boxShadow: 'none' }}>
                <Table size="small" sx={{ '& td, & th': { fontSize: '9px', py: '3.5px', px: '2px', border: '0.5px solid #1a237e', fontWeight: 'bold', lineHeight: 1.2 } }}>
                  <TableHead><TableRow sx={{ bgcolor: '#f0f0f0' }}><TableCell align="center">Range</TableCell><TableCell align="center">G</TableCell><TableCell align="center">GP</TableCell></TableRow></TableHead>
                  <TableBody>
                    {[ ['80-100','A+','5.0'],['70-79','A','4.0'],['60-69','A-','3.5'],['50-59','B','3.0'],['40-49','C','2.0'],['33-39','D','1.0'],['00-32','F','0.0'] ].map((r, i) => (
                      <TableRow key={i}><TableCell align="center">{r[0]}</TableCell><TableCell align="center">{r[1]}</TableCell><TableCell align="center">{r[2]}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Box>

          {/* Student Info Box with Photo */}
          <Box sx={{ border: '1.5px solid #1a237e', p: 1.5, mb: 1.5, position: 'relative', minHeight: '120px' }}>
            <Box sx={{ position: 'absolute', right: '10px', top: '10px', width: '85px', height: '105px', border: '1.5px solid #1a237e', p: '2px', bgcolor: 'white', zIndex: 2 }}><ImageWithFallback src={studentPhotoUrl} alt="Student" width="100%" height="100%" /></Box>
            <Grid container spacing={1} sx={{ pr: '105px' }}>
              <Grid item xs={12}><Typography sx={{ fontSize: '13px' }}><strong>{l.studentName}</strong> <span style={{ borderBottom: '1px dotted #1a237e', paddingBottom: '1px', display: 'inline-block', minWidth: '220px' }}>{studentName}</span></Typography></Grid>
              <Grid item xs={6}><Typography sx={{ fontSize: '13px' }}><strong>Father:</strong> <span style={{ borderBottom: '1px dotted #1a237e' }}>{forceLanguage === 'en' ? (student.father_name_en || student.father_name || '') : (student.father_name || '')}</span></Typography></Grid>
              <Grid item xs={6}><Typography sx={{ fontSize: '13px' }}><strong>Mother:</strong> <span style={{ borderBottom: '1px dotted #1a237e' }}>{forceLanguage === 'en' ? (student.mother_name_en || student.mother_name || '') : (student.mother_name || '')}</span></Typography></Grid>

              <Grid item xs={4}><Typography sx={{ fontSize: '13px' }}><strong>Roll No:</strong> <span style={{ borderBottom: '1px dotted #1a237e' }}>{n(student.roll_number)}</span></Typography></Grid>
              <Grid item xs={4}><Typography sx={{ fontSize: '13px' }}><strong>{l.class}</strong> <span style={{ borderBottom: '1px dotted #1a237e' }}>{cleanClassName}</span></Typography></Grid>

              {isClassSixToEight ? (
                <Grid item xs={4}><Typography sx={{ fontSize: '13px' }}><strong>Section:</strong> <span style={{ borderBottom: '1px dotted #1a237e' }}>{displaySection}</span></Typography></Grid>
              ) : isClassNineOrTen ? (
                (isLanguageBengali ? studentGroupBn : studentGroupEn) ? (
                  <Grid item xs={4}><Typography sx={{ fontSize: '13px' }}><strong>Group:</strong> <span style={{ borderBottom: '1px dotted #1a237e' }}>{isLanguageBengali ? (studentGroupBn || 'সাধারণ') : (studentGroupEn || 'General')}</span></Typography></Grid>
                ) : (
                  <Grid item xs={4}><Typography sx={{ fontSize: '13px' }}><strong>Section:</strong> <span style={{ borderBottom: '1px dotted #1a237e' }}>{displaySection}</span></Typography></Grid>
                )
              ) : (
                <Grid item xs={4}><Typography sx={{ fontSize: '13px' }}><strong>Section:</strong> <span style={{ borderBottom: '1px dotted #1a237e' }}>{displaySection}</span></Typography></Grid>
              )}
            </Grid>
          </Box>

          {/* Results Table */}
          <TableContainer component={Paper} elevation={0} sx={{ mb: 1, border: '1.5px solid #1a237e', borderRadius: 0, bgcolor: 'transparent', boxShadow: 'none' }}>
            <Table size="small" sx={{ borderCollapse: 'collapse', bgcolor: 'transparent', '& td, & th': { border: '1px solid #1a237e !important', py: 0.5, px: 1, fontSize: '12px' } }}>
              <TableHead><TableRow sx={{ bgcolor: 'rgba(245, 245, 245, 0.4) !important' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>{l.subjectName}</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '45px' }}>CQ</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '45px' }}>MCQ</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '45px' }}>PRAC</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '55px' }}>{l.total.toUpperCase()}</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '55px' }}>{l.grade.toUpperCase()}</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '55px' }}>{l.gpa.toUpperCase()}</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {displayResults.main.map((r, idx) => {
                  let sName = r.subject?.name || r.subject_name;
                  if (forceLanguage === 'en') {
                    // Manual override for common subjects if they are still in Bangla
                    const subMap = {
                      'গণিত': 'Mathematics',
                      'উচ্চতর গণিত': 'Higher Mathematics',
                      'বিজ্ঞান': 'Science',
                      'বাংলাদেশ ও বিশ্বপরিচয়': 'BGS',
                      'ইসলাম ও নৈতিক শিক্ষা': 'Religion (Islam)',
                      'তথ্য ও যোগাযোগ প্রযুক্তি': 'ICT',
                      'বাংলা-১ম Paper': 'Bangla 1st Paper',
                      'বাংলা-২য় Paper': 'Bangla 2nd Paper',
                      'ইংরেজি-১ম Paper': 'English 1st Paper',
                      'ইংরেজি-২য় Paper': 'English 2nd Paper',
                      'বাংলা ১ম পত্র': 'Bangla 1st Paper',
                      'বাংলা ২য় পত্র': 'Bangla 2nd Paper',
                      'ইংরেজি ১ম পত্র': 'English 1st Paper',
                      'ইংরেজি ২য় পত্র': 'English 2nd Paper'
                    };
                    sName = subMap[sName] || sName;
                  }
                  return (
                    <TableRow key={r.id || idx}>
                      <TableCell sx={{ fontWeight: r.is_optional_detected ? 400 : 700 }}>{r.is_optional_detected ? `${sName} (Opt)` : sName}</TableCell>
                      <TableCell align="center">{formatMark(r.written_marks)}</TableCell>
                      <TableCell align="center">{formatMark(r.mcq_marks)}</TableCell>
                      <TableCell align="center">{formatMark(r.practical_marks)}</TableCell>
                      <TableCell align="center"><strong>{n(r.total_obtained)}</strong></TableCell>
                      <TableCell align="center" className={r.grade === 'F' ? 'grade-f' : ''} sx={{ color: r.grade === 'F' ? 'red !important' : 'inherit' }}><strong>{r.grade}</strong></TableCell>
                      <TableCell align="center"><strong>{n(r.gpa)}</strong></TableCell>
                    </TableRow>
                  );
                })}
                <TableRow sx={{ bgcolor: 'rgba(232, 234, 246, 0.3) !important' }}>
                  <TableCell colSpan={4} align="right" sx={{ fontWeight: '900', color: '#1a237e' }}>{l.overallResult.toUpperCase()} =</TableCell>
                  <TableCell align="center"><strong>{n(finalSummary.obtained)}</strong></TableCell>
                  <TableCell align="center"><strong>{finalSummary.isPassed ? finalSummary.grade : 'F'}</strong></TableCell>
                  <TableCell align="center"><strong>{n(finalSummary.cgpa)}</strong></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          {/* Continuous Assessment */}
          {displayResults.coCurricular.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 900, display: 'block', mb: 0.2, textAlign: 'center', color: '#1a237e', fontSize: '10px' }}>--- {l.continuousAssessment.toUpperCase()} ---</Typography>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1.5px solid #1a237e', borderRadius: 0, bgcolor: 'transparent', boxShadow: 'none' }}>
                <Table size="small" sx={{ '& td': { border: '1px solid #1a237e', fontSize: '10px', py: 0.3 } }}>
                  <TableBody>{displayResults.coCurricular.map((r, idx) => (
                    <TableRow key={r.id || idx}>
                      <TableCell sx={{ fontWeight: 600, width: '40%' }}>{r.subject?.name || r.subject_name}</TableCell>
                      <TableCell align="center">Grade: <strong>{r.grade}</strong></TableCell>
                      <TableCell align="center">GPA: <strong>{n(r.gpa)}</strong></TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', color: r.is_passed ? 'success.main' : 'error.main' }}>{r.is_passed ? 'PASSED' : 'FAILED'}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Summary Blocks */}
          <Grid container spacing={2} sx={{ mt: 1.5, px: 2 }}>
            {[ {l: l.finalStatus, v: finalSummary.isPassed ? l.passed : l.failed, c: finalSummary.isPassed ? '#2e7d32' : '#d32f2f'},
               {l: l.overallGpa, v: n(finalSummary.cgpa), c: '#1a237e'},
               {l: l.letterGrade, v: finalSummary.isPassed ? finalSummary.grade : 'F', c: '#1a237e'}
            ].map((item, i) => (
              <Grid item xs={4} key={i}>
                <Box sx={{ border: '1.5px solid #1a237e', textAlign: 'center', py: 1.2, px: 1, bgcolor: 'white' }}>
                  <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', fontSize: '10px', color: '#555', mb: 0.5 }}>{item.l.toUpperCase()}</Typography>
                  <Typography variant="h6" sx={{ color: item.c, fontWeight: 900, fontSize: '1.1rem' }}>{item.v}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          {/* Signatures */}
          <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', px: 6, pb: 1, position: 'absolute', bottom: '25px', left: '12mm', right: '12mm' }}>
            {[l.guardianSig, l.classTeacherSig, l.headmaster].map((sig, i) => (
              <Box key={i} sx={{ textAlign: 'center', width: '22%' }}>
                {i === 2 && (
                  <Box sx={{ height: '40px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 0.5 }}>
                     {resolvedSchool?.school_seal && <img src={getMediaUrl(resolvedSchool.school_seal)} alt="" style={{ position: 'absolute', maxHeight: '45px', opacity: 0.5, mixBlendMode: 'multiply' }} />}
                     {resolvedSchool?.principal_signature && <img src={getMediaUrl(resolvedSchool.principal_signature)} alt="" style={{ position: 'absolute', maxHeight: '35px', zIndex: 2, mixBlendMode: 'multiply' }} />}
                  </Box>
                )}
                <Typography variant="body2" sx={{ borderTop: '1.2px solid #000', pt: 0.5, fontSize: '11px', fontWeight: 'bold' }}>{sig}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
