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

  // Rule: Optional subjects ALWAYS go to the end (Weight 1000+)
  if (isOptional) return 1000;

  const rawName = String(r.subject?.name || r.subject_name || '').replace(/\s*\(.*?\)\s*/g, '').trim();
  const n = rawName.toLowerCase();
  const clean = n.replace(/\u200d/g, '').replace(/\s+/g, ' ').trim();

  // 1. Bangla
  if (r.id === 'merged-bangla' || clean.includes('বাংলা') || clean.includes('bangla') || clean.includes('bengali')) {
      if (clean.includes('বাংলাদেশ') || clean.includes('bangladesh')) return 61; // BGS
      return 10;
  }

  // 2. English
  if (r.id === 'merged-english' || clean.includes('english') || clean.includes('ইংরেজি') || clean.includes('ইংরেজী')) return 20;

  // 3. Math
  if (clean.includes('গণিত') || clean.includes('গনিত') || clean.includes('math') || clean.includes('mathematics')) return 30;

  // 4. Religion
  if (clean.includes('ইসলাম') || clean.includes('islam') || clean.includes('হিন্দু') || clean.includes('hindu') || clean.includes('ধর্ম') || clean.includes('religion')) return 40;

  // 5. ICT
  if (clean.includes('আইসিটি') || clean.includes('ict') || clean.includes('তথ্য') || clean.includes('information')) return 50;

  // 6. Science / BGS
  if (clean.includes('বিজ্ঞান') || clean.includes('science')) {
      if (clean.includes('পদার্থ') || clean.includes('physics')) return 70;
      if (clean.includes('রসায়ন') || clean.includes('chemistry')) return 80;
      if (clean.includes('জীব') || clean.includes('biology')) return 90;
      return 60;
  }
  if (clean.includes('বাংলাদেশ') || clean.includes('বিশ্বপরিচয়') || clean.includes('bangladesh') || clean.includes('bgs')) return 61;

  // 7. Physics / Accounting / Geography
  if (clean.includes('পদার্থ') || clean.includes('physics')) return 70;
  if (clean.includes('হিসাব') || clean.includes('accounting')) return 71;
  if (clean.includes('ভূগোল') || clean.includes('geography')) return 72;

  // 8. Chemistry / Finance / History
  if (clean.includes('রসায়ন') || clean.includes('রসায়ন') || clean.includes('chemistry')) return 80;
  if (clean.includes('ফিন্যান্স') || clean.includes('finance') || clean.includes('ব্যাংকিং') || clean.includes('banking')) return 81;
  if (clean.includes('ইতিহাস') || clean.includes('history')) return 82;

  // 9. Biology / Business Ent / Civics
  if (clean.includes('জীব') || clean.includes('biology')) return 90;
  if (clean.includes('ব্যবসায়') || clean.includes('business') || clean.includes('উদ্যোগ') || clean.includes('entrepreneurship')) return 91;
  if (clean.includes('পৌরনীতি') || clean.includes('civics') || clean.includes('নাগরিকতা') || clean.includes('citizenship')) return 92;

  // 10. Higher Math / Agriculture (Handled by isOptional Rule above)

  // 11. Others
  return 200 + clean.length;
};

const sortSubjectsByOrder = (arr, allResults) => {
  if (!Array.isArray(arr) || arr.length === 0) return arr;

  // Pre-calculate which subjects are optional to pass to weight function
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

  const studentName = useMemo(() => {
    if (translatedData?.student_name) return translatedData.student_name;
    return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
  }, [user, translatedData]);

  const guardianName = useMemo(() => {
    if (translatedData?.guardian_name) return translatedData.guardian_name;
    return (
      (student.guardian ? `${student.guardian.first_name || ''} ${student.guardian.last_name || ''}`.trim() : '') ||
      student.guardian_name || student.parent_name || student.father_name || student.mother_name ||
      user.guardian_name || user.parent_name || ''
    );
  }, [student, user, translatedData]);

  const schoolName = useMemo(() => {
    if (translatedData?.school_name) return translatedData.school_name;
    return resolvedSchool?.name || "BD School";
  }, [resolvedSchool, translatedData]);

  // --- 0. LANGUAGE LOGIC ---
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

  const labels = {
    bn: {
      reportTitle: "একাডেমিক রেজাল্ট কার্ড",
      studentName: "শিক্ষার্থীর নাম:",
      rollNo: "রোল নং:",
      class: "শ্রেণি:",
      examination: "পরীক্ষা:",
      guardian: "অভিভাবক:",
      subjectName: "বিষয়ের নাম",
      cq: "সৃজনশীল",
      mcq: "নৈর্ব্যক্তিক",
      prac: "ব্যবহারিক",
      total: "মোট",
      grade: "গ্রেড",
      gpa: "জিপিএ",
      overallResult: "মোট নম্বর / ফলাফল",
      continuousAssessment: "ধারাবাহিক মূল্যায়ন",
      finalStatus: "সর্বশেষ অবস্থা",
      overallGpa: "মোট জিপিএ",
      letterGrade: "লেটার গ্রেড",
      passed: "✓ উত্তীর্ণ",
      failed: "✗ অনুত্তীর্ণ",
      classTeacherSig: "শ্রেণি শিক্ষকের স্বাক্ষর",
      guardianSig: "অভিভাবকের স্বাক্ষর",
      headmaster: "প্রধান শিক্ষক / অধ্যক্ষ"
    },
    en: {
      reportTitle: "ACADEMIC RESULT CARD",
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
      headmaster: "Headmaster / Principal"
    }
  };

  const l = isLanguageBengali ? labels.bn : labels.en;
  const n = (v) => isLanguageBengali ? toBn(v) : v;

  // --- 1. CLASSIFICATION LOGIC ---
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

    if (!isClassNineOrTen) {
      if (n.includes('কৃষি') || n.includes('agriculture') || n.includes('গার্হস্থ্য') || n.includes('home economics')) {
        return true;
      }
    }
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
    // 1. Deduplicate results: Keep highest total marks for same subject name
    const deduplicated = [];
    const resultsMap = new Map();
    allRecalculated.forEach(r => {
        const name = (r.subject?.name || r.subject_name || '').toLowerCase().trim();
        const normKey = name.replace(/\s*\(.*?\)\s*/g, '');
        if (!resultsMap.has(normKey) || r.total_obtained > resultsMap.get(normKey).total_obtained) {
            resultsMap.set(normKey, r);
        }
    });
    const cleanResults = Array.from(resultsMap.values());

    // 2. Filter by Group for Class 9-10
    const filteredResults = cleanResults.filter(r => {
        if (isCoCurricular(r.subject?.name || r.subject_name)) return true; // BYPASS for Continuous Assessment
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

    // 3. Merging logic for Bangla/English (Class 9-10)
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
        merged.push({ id: 'merged-bangla', subject: { name: mergedName }, written_marks: papers.bangla.map(r => r.written_marks).join(' + '), mcq_marks: papers.bangla.map(r => r.mcq_marks).join(' + '), practical_marks: '--', total_obtained: sumObtained, total_possible: totalPossible, grade: allPassed ? computeGrade((sumObtained/totalPossible)*100) : 'F', gpa: allPassed ? computeGpa((sumObtained/totalPossible)*100).toFixed(2) : '0.00', is_passed: allPassed });
        papers.bangla.forEach(r => handledSubjectIds.add(r.subject?.id || r.subject));
      }
      if (papers.english.length > 0) {
        const sumObtained = papers.english.reduce((s, r) => s + r.total_obtained, 0);
        const totalPossible = papers.english.reduce((s, r) => s + r.total_possible, 0);
        const allPassed = papers.english.every(r => r.is_passed);
        const firstName = String(papers.english[0]?.subject?.name || papers.english[0]?.subject_name || '').toLowerCase();
        const mergedName = (forceLanguage === 'en' || firstName.includes('english')) ? 'English (1st + 2nd)' : 'ইংরেজি (১ম + ২য়)';
        merged.push({ id: 'merged-english', subject: { name: mergedName }, written_marks: papers.english.map(r => r.total_obtained).join(' + '), mcq_marks: '--', practical_marks: '--', total_obtained: sumObtained, total_possible: totalPossible, grade: allPassed ? computeGrade((sumObtained/totalPossible)*100) : 'F', gpa: allPassed ? computeGpa((sumObtained/totalPossible)*100).toFixed(2) : '0.00', is_passed: allPassed });
        papers.english.forEach(r => handledSubjectIds.add(r.subject?.id || r.subject));
      }
      mainResults.forEach(r => {
        const sid = r.subject?.id || r.subject;
        if (!handledSubjectIds.has(sid)) merged.push(r);
      });

      const finalMain = [...merged, ...optionalResults];
      return { main: sortSubjectsByOrder(finalMain, allRecalculated), coCurricular: coCurricularResults };
    }

    const finalMainNon910 = [...mainResults, ...optionalResults];
    return { main: sortSubjectsByOrder(finalMainNon910, allRecalculated), coCurricular: coCurricularResults };
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

  const formatMark = (val) => {
    const res = (val === null || val === undefined || val === '' || val === 0 || val === '0' || val === '--') ? '--' : val;
    return isLanguageBengali ? toBn(res) : res;
  };
  const getGradeColor = (g) => { const map = { 'A+': '#1b5e20', 'A': '#2e7d32', 'A-': '#4caf50', 'B': '#f9a825', 'C': '#ef6c00', 'D': '#d84315', 'F': '#c62828' }; return map[g] || '#757575'; };

  const studentGroupEn = useMemo(() => {
    const g = String(student.student_group || student.group || '').toLowerCase();
    if (g === 'science') return 'Science';
    if (g === 'arts' || g === 'humanities') return 'Humanities';
    if (g === 'commerce' || g === 'business') return 'Business Studies';
    return '';
  }, [student]);

  const studentGroupBn = useMemo(() => {
    const g = String(student.student_group || student.group || '').toLowerCase();
    if (g === 'science') return 'বিজ্ঞান';
    if (g === 'arts' || g === 'humanities') return 'মানবিক';
    if (g === 'commerce' || g === 'business') return 'ব্যবসায় শিক্ষা';
    return '';
  }, [student]);

  const studentPhotoUrl = getMediaUrl(user?.photo || user?.photo_url);
  const logoUrl = getMediaUrl(resolvedSchool?.logo || fallbackLogo);

  const displayClass = useMemo(() => {
    if (translatedData?.class_name) return translatedData.class_name;
    return `${student.classroom?.name || ''} ${student.section?.name ? `(${student.section.name})` : ''}`;
  }, [student, translatedData]);

  const displayExam = useMemo(() => {
    if (translatedData?.examination_name) return translatedData.examination_name;
    return `${examination?.academic_year || ''} ${examination?.name || ''}`.trim();
  }, [examination, translatedData]);

  return (
    <Box className="result-card-container" sx={{
      width: '100%', maxWidth: '210mm', minHeight: '290mm', mx: 'auto', bgcolor: 'white', p: '10mm', position: 'relative',
      border: '2px solid #1a237e', borderRadius: '2px', outline: '6px double #1a237e', outlineOffset: '-10px',
      boxShadow: 'none !important', boxSizing: 'border-box', overflow: 'hidden', pageBreakAfter: 'always',
      '@media print': { margin: 0, border: 'none', outline: '4px double #1a237e', outlineOffset: '-8px' }
    }}>
      {/* Background Watermark */}
      <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '70%', opacity: 0.12, zIndex: 0, pointerEvents: 'none', display: 'flex', justifyContent: 'center' }}>
        <img src={logoUrl} alt="" style={{ width: '100%', maxWidth: '500px', filter: 'grayscale(100%) brightness(1.2)' }} />
      </Box>

      <Box sx={{ position: 'relative', zIndex: 1 }}>
        {/* Header Section */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          {/* Left: Logo */}
          <Box sx={{ width: '100px', height: '100px', display: 'flex', alignItems: 'center' }}>
            <ImageWithFallback src={logoUrl} alt="Logo" width="100%" height="auto" />
          </Box>

          {/* Center: School Info */}
          <Box sx={{ flexGrow: 1, textAlign: 'center', px: 2 }}>
            <Typography variant="h4" sx={{ fontWeight: 900, color: '#1a237e !important', fontSize: (schoolName?.length > 40) ? '1.4rem' : '2rem', mb: 0.5, letterSpacing: '1px', WebkitPrintColorAdjust: 'exact' }}>
              {schoolName}
            </Typography>
            {resolvedSchool?.ein && (
              <Typography sx={{ fontSize: '14px', color: '#333 !important', fontWeight: 'bold', mb: 0.5, WebkitPrintColorAdjust: 'exact' }}>
                EIIN: {resolvedSchool.ein}
              </Typography>
            )}
            <Typography sx={{ color: '#555 !important', fontSize: '12px', mb: 1, WebkitPrintColorAdjust: 'exact' }}>
              {translatedData?.address || resolvedSchool?.address || "" }
            </Typography>
            <Box sx={{ mt: 1, mx: 'auto', width: 'fit-content', px: 3, py: 0.4, border: '1.5px solid #1a237e', borderRadius: '4px', bgcolor: '#1a237e !important', color: 'white !important', WebkitPrintColorAdjust: 'exact' }}>
              <Typography sx={{ fontWeight: 'bold', fontSize: '14px', letterSpacing: 2 }}>{l.reportTitle.toUpperCase()}</Typography>
            </Box>
          </Box>

          {/* Right: Photo & Grade Scale */}
          <Stack spacing={1} alignItems="flex-end">
            <Box sx={{ width: '90px', height: '105px', border: '2px solid #1a237e', p: '2px', bgcolor: 'white' }}>
              <ImageWithFallback src={studentPhotoUrl} alt="Student" width="100%" height="100%" />
            </Box>
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #1a237e', width: '110px', bgcolor: 'transparent' }}>
              <Table size="small" sx={{ '& td, & th': { fontSize: '8px', p: '1px 2px', border: '0.5px solid #1a237e' } }}>
                <TableBody>
                  {[ ['80-100','A+','5.0'],['70-79','A','4.0'],['60-69','A-','3.5'],['50-59','B','3.0'],['40-49','C','2.0'],['33-39','D','1.0'],['00-32','F','0.0'] ].map((r, i) => (
                    <TableRow key={i}><TableCell align="center">{r[0]}</TableCell><TableCell align="center">{r[1]}</TableCell><TableCell align="center">{r[2]}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </Box>

        {/* Student Info Details */}
        <Box sx={{ border: '1px solid #1a237e', p: 1.5, mb: 2, bgcolor: 'rgba(26, 35, 126, 0.01)' }}>
          <Grid container spacing={1}>
            <Grid item xs={6}><Typography sx={{ fontSize: '14px' }}><strong>{l.studentName}</strong> <span style={{ borderBottom: '1px dotted #1a237e', flexGrow: 1, marginLeft: '8px' }}>{studentName}</span></Typography></Grid>
            <Grid item xs={3}><Typography sx={{ fontSize: '14px' }}><strong>Roll No:</strong> <span style={{ borderBottom: '1px dotted #1a237e' }}>{n(student.roll_number)}</span></Typography></Grid>
            <Grid item xs={3}><Typography sx={{ fontSize: '14px' }}><strong>{l.class}</strong> <span style={{ borderBottom: '1px dotted #1a237e' }}>{displayClass}</span></Typography></Grid>

            <Grid item xs={6}><Typography sx={{ fontSize: '14px' }}><strong>Father's Name:</strong> <span style={{ borderBottom: '1px dotted #1a237e', marginLeft: '8px' }}>{translatedData?.father_name || student.father_name || 'N/A'}</span></Typography></Grid>
            <Grid item xs={6}><Typography sx={{ fontSize: '14px' }}><strong>{l.examination}</strong> <span style={{ borderBottom: '1px dotted #1a237e', marginLeft: '8px' }}>{displayExam}</span></Typography></Grid>

            <Grid item xs={6}><Typography sx={{ fontSize: '14px' }}><strong>Mother's Name:</strong> <span style={{ borderBottom: '1px dotted #1a237e', marginLeft: '8px' }}>{translatedData?.mother_name || student.mother_name || 'N/A'}</span></Typography></Grid>
            <Grid item xs={6}><Typography sx={{ fontSize: '14px' }}><strong>Group:</strong> <span style={{ borderBottom: '1px dotted #1a237e', marginLeft: '8px' }}>{isLanguageBengali ? (studentGroupBn || 'সাধারণ') : (studentGroupEn || 'General')}</span></Typography></Grid>
          </Grid>
        </Box>

        {/* Results Table */}
        <TableContainer component={Paper} elevation={0} sx={{ mb: 1, border: '1px solid #1a237e', borderRadius: 0 }}>
          <Table size="small" sx={{ borderCollapse: 'collapse', '& td, & th': { border: '1px solid #1a237e !important', py: 0.5, px: 1, fontSize: '13px' } }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f5f5 !important', WebkitPrintColorAdjust: 'exact' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>{l.subjectName}</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '50px' }}>CQ</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '50px' }}>MCQ</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '50px' }}>PRAC</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '60px' }}>{l.total.toUpperCase()}</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '60px' }}>{l.grade.toUpperCase()}</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '60px' }}>{l.gpa.toUpperCase()}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayResults.main.map((r, idx) => (
                <TableRow key={r.id || idx}>
                  <TableCell sx={{ fontWeight: r.is_optional_detected ? 400 : 600 }}>{r.is_optional_detected ? `(Opt) ${r.subject?.name || r.subject_name}` : (r.subject?.name || r.subject_name)}</TableCell>
                  <TableCell align="center">{formatMark(r.written_marks)}</TableCell>
                  <TableCell align="center">{formatMark(r.mcq_marks)}</TableCell>
                  <TableCell align="center">{formatMark(r.practical_marks)}</TableCell>
                  <TableCell align="center"><strong>{n(r.total_obtained)}</strong></TableCell>
                  <TableCell align="center"><strong>{r.grade}</strong></TableCell>
                  <TableCell align="center"><strong>{n(r.gpa)}</strong></TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ bgcolor: '#f9f9f9 !important', WebkitPrintColorAdjust: 'exact' }}>
                <TableCell colSpan={4} align="right" sx={{ fontWeight: 'bold' }}>{l.overallResult} =</TableCell>
                <TableCell align="center"><strong>{n(finalSummary.obtained)}/{n(finalSummary.possible)}</strong></TableCell>
                <TableCell align="center"><strong>{finalSummary.isPassed ? finalSummary.grade : 'F'}</strong></TableCell>
                <TableCell align="center"><strong>{n(finalSummary.cgpa)}</strong></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        {/* Continuous Assessment Section */}
        {displayResults.coCurricular.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 900, display: 'block', mb: 0.3, textAlign: 'center' }}>
              --- {l.continuousAssessment.toUpperCase()} ---
            </Typography>
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #1a237e', borderRadius: 0 }}>
              <Table size="small" sx={{ '& td': { border: '1px solid #1a237e', fontSize: '11px', py: 0.3 } }}>
                <TableBody>
                  {displayResults.coCurricular.map((r, idx) => (
                    <TableRow key={r.id || idx}>
                      <TableCell sx={{ fontWeight: 600, width: '40%' }}>{r.subject?.name || r.subject_name}</TableCell>
                      <TableCell align="center">Grade: <strong>{r.grade}</strong></TableCell>
                      <TableCell align="center">GPA: <strong>{n(r.gpa)}</strong></TableCell>
                      <TableCell align="center"><strong>{r.is_passed ? 'PASSED' : 'FAILED'}</strong></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Footer Summary Blocks */}
        <Grid container spacing={1} sx={{ mt: 1.5 }}>
          {[ {l: l.finalStatus, v: finalSummary.isPassed ? l.passed : l.failed, c: finalSummary.isPassed ? '#2e7d32' : '#d32f2f'},
             {l: l.overallGpa, v: n(finalSummary.cgpa), c: '#1a237e'},
             {l: l.letterGrade, v: finalSummary.isPassed ? finalSummary.grade : 'F', c: '#1a237e'}
          ].map((item, i) => (
            <Grid item xs={4} key={i}>
              <Box sx={{ border: '1px solid #1a237e', textAlign: 'center', py: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', fontSize: '10px' }}>{item.l.toUpperCase()}</Typography>
                <Typography variant="h6" sx={{ color: item.c, fontWeight: 900, fontSize: '1.1rem' }}>{item.v}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

        {/* QR & Remarks Placeholder (Optional - based on image 2) */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, alignItems: 'center' }}>
           <Box sx={{ width: '60px', height: '60px', border: '1px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <Typography sx={{ fontSize: '8px', color: '#999' }}>QR CODE</Typography>
           </Box>
           <Box sx={{ flexGrow: 1, ml: 2, border: '1px solid #1a237e', p: 0.5, height: '50px' }}>
             <Typography variant="caption" sx={{ fontSize: '9px', fontWeight: 'bold' }}>COMMENTS:</Typography>
           </Box>
        </Box>

        {/* Signatures */}
        <Box sx={{ mt: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          {[l.guardianSig, l.classTeacherSig, l.headmaster].map((sig, i) => (
            <Box key={i} sx={{ textAlign: 'center', width: '30%' }}>
              {i === 2 && (
                <Box sx={{ height: '40px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 0.5 }}>
                   {resolvedSchool?.school_seal && <img src={getMediaUrl(resolvedSchool.school_seal)} alt="" style={{ position: 'absolute', maxHeight: '45px', opacity: 0.5, mixBlendMode: 'multiply' }} />}
                   {resolvedSchool?.principal_signature && <img src={getMediaUrl(resolvedSchool.principal_signature)} alt="" style={{ position: 'absolute', maxHeight: '35px', zIndex: 2, mixBlendMode: 'multiply' }} />}
                </Box>
              )}
              <Typography variant="body2" sx={{ borderTop: '1px solid #000', pt: 0.5, fontSize: '12px', fontWeight: 'bold' }}>{sig}</Typography>
              {i === 2 && resolvedSchool?.principal_name && <Typography sx={{ fontSize: '10px' }}>{resolvedSchool.principal_name}</Typography>}
            </Box>
          ))}
        </Box>

        {/* Footer Small Print */}
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
           <Typography sx={{ fontSize: '8px', color: '#777' }}>Powered by: BDAPP.LIVE</Typography>
           <Typography sx={{ fontSize: '8px', color: '#777' }}>Print Date: {dayjs().format('DD-MM-YYYY HH:mm')}</Typography>
        </Box>
      </Box>
    </Box>
  );
}
