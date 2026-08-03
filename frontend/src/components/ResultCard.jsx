import React, { useMemo, memo } from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Grid } from '@mui/material';
import './ResultCard.css';
import ImageWithFallback from './ImageWithFallback';
import fallbackLogo from './fallback_logo.png';
import { getMediaUrl } from '../utils/media';

const toBn = (v) => String(v ?? '').replace(/[0-9]/g, d => ['০','১','২','৩','৪','৫','৬','৭','৮','৯'][d]);

const CLASS_9_10_REGEX = /নবম|দশম|ssc|\b9\b|\b10\b|\bnine\b|\bten\b|\bix\b|\bx\b|class\s*9|class\s*10|৯ম|১০ম/i;

const getSubjectOrderWeight = (r, isOptional, group = '') => {
  if (!r) return 9999;
  if (isOptional) return 1000;
  const rawName = String(r.subject?.name || r.subject_name || '').replace(/\s*\(.*?\)\s*/g, '').trim();
  const n = rawName.toLowerCase();
  const clean = n.replace(/\u200d/g, '').replace(/\s+/g, ' ').trim();
  const g = group.toLowerCase();

  // Basic Common Subjects
  if (r.id === 'merged-bangla' || clean.includes('বাংলা') || clean.includes('bangla')) return 10;
  if (r.id === 'merged-english' || clean.includes('english') || clean.includes('ইংরেজি')) return 20;
  if (clean.includes('গণিত') || clean.includes('math')) {
      if (clean.includes('উচ্চতর') || clean.includes('higher')) return 1000;
      return 30;
  }
  if (clean.includes('ইসলাম') || clean.includes('islam') || clean.includes('ধর্ম') || clean.includes('religion')) return 40;
  if (clean.includes('আইসিটি') || clean.includes('ict') || clean.includes('তথ্য')) return 50;

  // Group Specific Logic
  if (g.includes('science') || g.includes('বিজ্ঞান')) {
      if (clean.includes('বাংলাদেশ') || clean.includes('বিশ্বপরিচয়') || clean.includes('bgs')) return 60;
      if (clean.includes('পদার্থ') || clean.includes('physics')) return 70;
      if (clean.includes('রসায়ন') || clean.includes('chemistry')) return 80;
      if (clean.includes('জীব') || clean.includes('biology')) return 90;
  } else if (g.includes('commerce') || g.includes('business') || g.includes('ব্যবসায়')) {
      if (clean.includes('বিজ্ঞান') || clean.includes('science')) return 60;
      if (clean.includes('হিসাব') || clean.includes('accounting')) return 70;
      if (clean.includes('ফিন্যান্স') || clean.includes('finance')) return 80;
      if (clean.includes('ব্যবসায়') || clean.includes('business')) return 90;
  } else if (g.includes('arts') || g.includes('humanities') || g.includes('মানবিক')) {
      if (clean.includes('বিজ্ঞান') || clean.includes('science')) return 60;
      if (clean.includes('ইতিহাস') || clean.includes('history')) return 70;
      if (clean.includes('পৌরনীতি') || clean.includes('civics')) return 80;
      if (clean.includes('ভূগোল') || clean.includes('geography')) return 90;
  }

  if (clean.includes('কৃষি') || clean.includes('agriculture') || clean.includes('গার্হস্থ্য') || clean.includes('home science')) return 1000;

  return 200 + clean.length;
};

const sortSubjectsByOrder = (arr, allResults, group = '') => {
  if (!Array.isArray(arr) || arr.length === 0) return arr;

  const weightedArr = arr.map(item => {
    const isOpt = item.is_optional_detected || allResults.some(r => (r.id === item.id || r.subject?.id === item.subject?.id) && r.is_optional_detected);
    return {
      item,
      weight: getSubjectOrderWeight(item, isOpt, group)
    };
  });

  return weightedArr.sort((a, b) => {
    if (a.weight !== b.weight) return a.weight - b.weight;
    const na = String(a.item?.subject?.name || a.item?.subject_name || '').toLowerCase();
    const nb = String(b.item?.subject?.name || b.item?.subject_name || '').toLowerCase();
    return na.localeCompare(nb, 'bn', { sensitivity: 'base' });
  }).map(x => x.item);
};

const SUB_MAP = {
  'গণিত': 'Mathematics',
  'উচ্চতর গণিত': 'Higher Mathematics',
  'বিজ্ঞান': 'Science',
  'বাংলাদেশ ও বিশ্বপরিচয়': 'BGS',
  'ইসলাম ও নৈতিক শিক্ষা': 'Religion (Islam)',
  'হিন্দুধর্ম ও নৈতিক শিক্ষা': 'Religion (Hindu)',
  'খ্রিস্টধর্ম ও নৈতিক শিক্ষা': 'Religion (Christian)',
  'বৌদ্ধধর্ম ও নৈতিক শিক্ষা': 'Religion (Buddhist)',
  'তথ্য ও যোগাযোগ প্রযুক্তি': 'ICT',
  'বাংলা ১ম পত্র': 'Bangla 1st Paper',
  'বাংলা ২য় পত্র': 'Bangla 2nd Paper',
  'ইংরেজি ১ম পত্র': 'English 1st Paper',
  'ইংরেজি ২য় পত্র': 'English 2nd Paper',
  'শারীরিক শিক্ষা ও স্বাস্থ্য': 'Physical Education',
  'চারু ও কারুকলা': 'Arts & Crafts',
  'কর্ম ও জীবনমুখী শিক্ষা': 'Work & Life Education',
  'কৃষি শিক্ষা': 'Agriculture',
  'গার্হস্থ্য বিজ্ঞান': 'Home Science',
  'বাংলা-১ম পত্র': 'Bangla 1st Paper',
  'বাংলা-২য় পত্র': 'Bangla 2nd Paper',
  'ইংরেজি-১ম পত্র': 'English 1st Paper',
  'ইংরেজি-২য় পত্র': 'English 2nd Paper',
  'বাংলা-১ম': 'Bangla 1st Paper',
  'বাংলা-২য়': 'Bangla 2nd Paper',
  'ইংরেজি-১ম': 'English 1st Paper',
  'ইংরেজি-২য়': 'English 2nd Paper',
  'ইসলাম শিক্ষা': 'Religion (Islam)',
  'হিন্দুধর্ম শিক্ষা': 'Religion (Hindu)',
  'হিন্দু ধর্ম শিক্ষা': 'Religion (Hindu)',
  'হিন্দু ধর্ম': 'Religion (Hindu)',
  'হিন্দুধর্ম': 'Religion (Hindu)',
  'বৌদ্ধধর্ম শিক্ষা': 'Religion (Buddhist)',
  'খ্রিস্টধর্ম শিক্ষা': 'Religion (Christian)',
  'বাংলা (১ম+২য়)': 'Bangla (1st+2nd)',
  'English (1st+2nd)': 'English (1st+2nd)',
  'পদার্থ বিজ্ঞান': 'Physics',
  'রসায়ন': 'Chemistry',
  'জীব বিজ্ঞান': 'Biology',
  'ব্যবসায় উদ্যোগ': 'Business Entrepreneurship',
  'হিসাব বিজ্ঞান': 'Accounting',
  'ফিন্যান্স ও ব্যাংকিং': 'Finance & Banking',
  'পৌরনীতি ও নাগরিকতা': 'Civics & Citizenship',
  'ভূগোল ও পরিবেশ': 'Geography & Environment',
  'উচ্চতর গণিত': 'Higher Mathematics',
  'উচ্চতর গনিত': 'Higher Mathematics',
  'রসায়ন': 'Chemistry',
  'জীববিজ্ঞান': 'Biology'
};

const BN_TO_EN_PAPER_REGEX_1 = /[১1]ম\s*(পত্র|paper)/gi;
const BN_TO_EN_PAPER_REGEX_2 = /[২2][য়য়]\s*(পত্র|paper)/gi;

const OPT_SUB_MAP = {
  'উচ্চতর গণিত': 'Higher Mathematics',
  'উচ্চতর গনিত': 'Higher Mathematics',
  'কৃষি শিক্ষা': 'Agriculture',
  'গার্হস্থ্য বিজ্ঞান': 'Home Science',
  'ইসলাম শিক্ষা': 'Religion (Islam)',
  'পদার্থ বিজ্ঞান': 'Physics',
  'রসায়ন': 'Chemistry',
  'জীব বিজ্ঞান': 'Biology',
  'ব্যবসায় উদ্যোগ': 'Business Entrepreneurship',
  'হিসাব বিজ্ঞান': 'Accounting',
  'ফিন্যান্স ও ব্যাংকিং': 'Finance & Banking',
  'পৌরনীতি ও নাগরিকতা': 'Civics & Citizenship',
  'ভূগোল ও পরিবেশ': 'Geography & Environment'
};

const BN_TO_EN_CLASS_MAP = { 'প্রথম': 'One', 'দ্বিতীয়': 'Two', 'তৃতীয়': 'Three', 'চতুর্থ': 'Four', 'পঞ্চম': 'Five', 'ষষ্ঠ': 'Six', 'সপ্তম': 'Seven', 'অষ্টম': 'Eight', 'নবম': 'Nine', 'দশম': 'Ten', 'শ্রেণী': '', 'শ্রেণি': '', 'Class': '' };
const ORD_MAP = { 'Sixth': 'Six', 'Seventh': 'Seven', 'Eighth': 'Eight', 'Ninth': 'Nine', 'Tenth': 'Ten' };

const SEC_MAP = { 'মানবিক': 'Humanities', 'বিজ্ঞান': 'Science', 'ব্যবসায় শিক্ষা': 'Commerce', 'ব্যবসা': 'Commerce', 'ক': 'A', 'খ': 'B', 'গ': 'C', 'ঘ': 'D', 'এ': 'A', 'বি': 'B', 'সি': 'C', 'ডি': 'D' };

const SVG_BORDER = `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23000' stroke-width='1'%3E%3Cpath d='M0 50 Q 25 0 50 50 T 100 50'/%3E%3Cpath d='M0 50 Q 25 100 50 50 T 100 50'/%3E%3Cpath d='M50 0 Q 0 25 50 50 T 50 100'/%3E%3Cpath d='M50 0 Q 100 25 50 50 T 50 100'/%3E%3C/g%3E%3C/svg%3E") 25 repeat`;

const isCoCurricular = (name, isClassNineOrTen) => {
  const n = String(name || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
  const baseList = ['শারীরিক শিক্ষা ও স্বাস্থ্য', 'শারীরিক শিক্ষা', 'Physical Education', 'Physical Education and Health', 'ক্যারিয়ার শিক্ষা', 'ক্যারিয়ার শিক্ষা', 'Career Education', 'ক্যারিয়ার', 'ক্যারিয়ার', 'Word Collection Achievement Test', 'WCAT', 'বই পড়া', 'বই পড়া', 'চারু ও কারুকলা', 'Arts and Crafts'];
  if (!isClassNineOrTen && (n.includes('কৃষি') || n.includes('agriculture') || n.includes('গার্হস্থ্য') || n.includes('home economics'))) return true;
  return baseList.some(sub => n.includes(sub.toLowerCase()));
};

const isOptionalSubject = (r, student, isClassNineOrTen) => {
  if (!r) return false;
  const sname = String(r.subject?.name || r.subject_name || '').toLowerCase();
  const optId = student?.optional_subject?.id || student?.optional_subject;
  if (optId && String(optId) === String(r.subject?.id || r.subject)) return true;
  const optSubName = String(student?.optional_subject?.name || '').toLowerCase();
  if (optSubName && sname.includes(optSubName)) return true;
  const isNineTenAgri = isClassNineOrTen && (sname.includes('কৃষি') || sname.includes('গার্হস্থ্য'));
  return sname.includes('optional') || sname.includes('ঐচ্ছিক') || sname.includes('fourth') || sname.includes('৪র্থ') || sname.includes('উচ্চতর') || isNineTenAgri;
};

const getSubjectMaxima = (name, isClassNineOrTen) => {
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

const ResultCard = memo(({ studentData, results: rawResults, overallResult, examination, school, forceLanguage, translatedData }) => {
  const student = useMemo(() => studentData?.student || {}, [studentData]);
  const user = useMemo(() => student?.user || {}, [student]);
  const resolvedSchool = useMemo(() => school || {}, [school]);

  const shouldSkip = useMemo(() => {
    const fn = (user?.first_name || '').trim();
    const ln = (user?.last_name || '').trim();
    const fullName = `${fn} ${ln}`.trim().toUpperCase();
    const username = (user?.username || '').toUpperCase();
    return (!fn && !ln) || fullName === 'TC' || fn.toUpperCase() === 'TC' || ln.toUpperCase() === 'TC' || username === 'TC';
  }, [user]);

  const labels = useMemo(() => ({
    en: {
      reportTitle: "ACADEMIC TRANSCRIPT",
      studentName: "Name of Student",
      fatherName: "Father's Name",
      motherName: "Mother's Name",
      rollNo: "Roll",
      class: "Class",
      section: "Section",
      group: "Group",
      meritPosition: "Merit Position",
      examination: "Examination",
      subjectName: "Name of Subjects",
      letterGrade: "Letter Grade",
      gradePoint: "Grade Point",
      gpa: "GPA",
      total: "TOTAL",
      mainSubjectsTitle: "Name of Subjects",
      optionalSubjectsTitle: "Optional Subject",
      coCurricularTitle: "Continuous Assessment Subjects",
      passed: "✓ PASSED",
      failed: "✗ FAILED",
      classTeacherSig: "Class Teacher",
      guardianSig: "Guardian",
      headmaster: "Head Master",
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
    let fnEn = (user?.first_name_en || '').trim();
    let lnEn = (user?.last_name_en || '').trim();

    // If English names exist, clean and de-duplicate
    if (fnEn || lnEn) {
      const words = `${fnEn} ${lnEn}`.split(/\s+/).filter(Boolean);
      const uniqueWords = [];
      const seen = new Set();
      for (const w of words) {
        const lower = w.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          uniqueWords.push(w);
        }
      }
      return uniqueWords.join(' ') || "N/A";
    }

    // Fallback to Bangla de-duplication
    let fn = (user?.first_name || '').trim();
    let ln = (user?.last_name || '').trim();
    const words = `${fn} ${ln}`.split(/\s+/).filter(Boolean);
    const uniqueWords = [];
    const seen = new Set();
    for (const w of words) {
      if (!seen.has(w)) {
        seen.add(w);
        uniqueWords.push(w);
      }
    }
    return uniqueWords.join(' ') || user?.username || "N/A";
  }, [user]);

  const schoolName = useMemo(() => {
    let name = resolvedSchool?.name_en || resolvedSchool?.name || "BD School";
    // Always translate to English for Result Card
    const bnToEn = {
      'শ্রীরামপুর': 'SRIRAMPUR', 'ভাটরা': 'BHATRA',
      'উচ্চ বিদ্যালয়': 'HIGH SCHOOL', 'উচ্চ বিদ্যালয়': 'HIGH SCHOOL',
      'মাধ্যমিক বিদ্যালয়': 'SECONDARY SCHOOL', 'মাধ্যমিক বিদ্যালয়': 'SECONDARY SCHOOL',
      'সরকারি': 'GOVT.', 'সরকারী': 'GOVT.',
      'বালিকা': 'GIRLS', 'বালক': 'BOYS',
      'মাদ্রাসা': 'MADRASAH', 'প্রাথমিক': 'PRIMARY',
      'হামান কর্দ্দি': 'HAMANKARDI', 'হামা নকর্দ্দি': 'HAMANKARDI', 'পল্লী মঙ্গল': 'POLLI MONGOL'
    };
    Object.entries(bnToEn).forEach(([bn, en]) => {
      name = name.replace(new RegExp(bn, 'g'), en);
    });
    return name.toUpperCase();
  }, [resolvedSchool]);

  const l = labels.en;
  const n = (v) => v;

  const isClassNineOrTen = useMemo(() => {
    try {
      const sources = [student?.classroom?.name, examination?.classroom?.name, examination?.name, student?.classroom?.display_name].filter(Boolean).map(s => String(s).toLowerCase());
      const text = sources.join(' ');
      return CLASS_9_10_REGEX.test(text);
    } catch (_) { return false; }
  }, [student, examination]);

  const allRecalculated = useMemo(() => {
    if (!Array.isArray(rawResults)) return [];
    return rawResults.map(r => {
      const w = parseFloat(r.written_marks) || 0;
      const m = parseFloat(r.mcq_marks) || 0;
      const p = parseFloat(r.practical_marks) || 0;
      const spec = getSubjectMaxima(r.subject?.name || r.subject_name, isClassNineOrTen);
      const totalPossible = spec.cq + spec.mcq + spec.pr || 100;
      const obtained = w + m + p;
      const percentage = (obtained / totalPossible) * 100;
      const passThreshold = Math.round(totalPossible * 0.33);
      let isPassed = obtained >= passThreshold;
      if (isClassNineOrTen && !isCoCurricular(r.subject?.name || r.subject_name, isClassNineOrTen) && !isOptionalSubject(r, student, isClassNineOrTen)) {
        if (spec.cq > 0 && w < Math.round(spec.cq * 0.33)) isPassed = false;
        if (spec.mcq > 0 && m < Math.round(spec.mcq * 0.33)) isPassed = false;
        if (spec.pr > 0 && p < Math.round(spec.pr * 0.33)) isPassed = false;
      }
      return { ...r, total_obtained: obtained, total_possible: totalPossible, grade: isPassed ? computeGrade(percentage) : 'F', gpa: isPassed ? computeGpa(percentage).toFixed(2) : '0.00', is_passed: isPassed, is_optional_detected: isOptionalSubject(r, student, isClassNineOrTen), spec };
    });
  }, [rawResults, isClassNineOrTen, student]);

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
        if (!resultsMap.has(normKey)) resultsMap.set(normKey, r);
        else {
            const existing = resultsMap.get(normKey);
            const existingDate = new Date(existing.created_at || existing.updated_at || 0).getTime();
            const currentDate = new Date(r.created_at || r.updated_at || 0).getTime();
            if (currentDate >= existingDate) resultsMap.set(normKey, r);
        }
    });
    const cleanResults = Array.from(resultsMap.values());
    const studentGroup = student?.student_group || student?.group || '';
    const filteredResults = cleanResults.filter(r => {
        if (isCoCurricular(r.subject?.name || r.subject_name, isClassNineOrTen)) return true;
        if (!isClassNineOrTen) return true;
        const group = String(studentGroup).toLowerCase();
        const name = (r.subject?.name || r.subject_name || '').toLowerCase();

        const scienceOnly = ['physics', 'chemistry', 'biology', 'higher math', 'পদার্থ', 'রসায়ন', 'জীব', 'উচ্চতর', 'bgs', 'বাংলাদেশ ও বিশ্ব'];
        const commerceOnly = ['accounting', 'finance', 'business', 'হিসাব', 'ফিন্যান্স', 'ব্যবসায়'];
        const artsOnly = ['history', 'geography', 'civics', 'economics', 'ইতিহাস', 'ভূগোল', 'পৌরনীতি', 'অর্থনীতি'];

        // Exact match for general science to avoid filtering out 'পদার্থ বিজ্ঞান'
        const isGeneralScience = (name === 'science' || name === 'বিজ্ঞান' || name === 'general science' || name === 'সাধারণ বিজ্ঞান');

        if (group.includes('science') || group.includes('বিজ্ঞান')) {
            if (listMatch(name, commerceOnly.concat(artsOnly)) || isGeneralScience) return false;
        } else if (group.includes('commerce') || group.includes('business') || group.includes('ব্যবসায়')) {
            if (listMatch(name, scienceOnly.concat(artsOnly))) return false;
        } else if (group.includes('arts') || group.includes('humanities') || group.includes('মানবিক')) {
            if (listMatch(name, scienceOnly.concat(commerceOnly))) return false;
        }
        return true;
    });
    function listMatch(text, list) { return list.some(kw => text.includes(kw)); }
    let mainResults = filteredResults.filter(r => !isCoCurricular(r.subject?.name || r.subject_name, isClassNineOrTen) && !isOptionalSubject(r, student, isClassNineOrTen));
    let optionalResults = filteredResults.filter(r => isOptionalSubject(r, student, isClassNineOrTen));
    let coCurricularResults = filteredResults.filter(r => isCoCurricular(r.subject?.name || r.subject_name, isClassNineOrTen));
    if (isClassNineOrTen) {
      const merged = [];
      const handledSubjectIds = new Set();

      const getPaperNum = (nm) => {
        const low = String(nm || '').toLowerCase();
        if (low.includes('১ম') || low.includes('1st') || low.includes('first')) return 1;
        if (low.includes('২য়') || low.includes('২য়') || low.includes('2nd') || low.includes('second')) return 2;
        return 1;
      };

      const papers = {
        bangla: mainResults.filter(r => { const n = String(r.subject?.name || r.subject_name || '').toLowerCase(); return (n.includes('বাংলা') || n.includes('bangla')) && !n.includes('বাংলাদেশ'); }).sort((a, b) => getPaperNum(a.subject?.name || a.subject_name) - getPaperNum(b.subject?.name || b.subject_name)),
        english: mainResults.filter(r => { const n = String(r.subject?.name || r.subject_name || '').toLowerCase(); return n.includes('english') || n.includes('ইংরেজি') || n.includes('ইংরেজী'); }).sort((a, b) => getPaperNum(a.subject?.name || a.subject_name) - getPaperNum(b.subject?.name || b.subject_name))
      };
      if (papers.bangla.length > 0) {
        const sumObtained = papers.bangla.reduce((s, r) => s + r.total_obtained, 0);
        const totalPossible = papers.bangla.reduce((s, r) => s + r.total_possible, 0);
        const allPassed = papers.bangla.every(r => r.is_passed);
        merged.push({ id: 'merged-bangla', subject: { name: 'Bangla (1st + 2nd)' }, written_marks: papers.bangla.map(r => r.written_marks || '0').join('+'), mcq_marks: papers.bangla.map(r => r.mcq_marks || '0').join('+'), practical_marks: '--', total_obtained: sumObtained, display_total: Math.round(sumObtained), total_possible: totalPossible, grade: allPassed ? computeGrade((sumObtained/totalPossible)*100) : 'F', gpa: allPassed ? computeGpa((sumObtained/totalPossible)*100).toFixed(2) : '0.00', is_passed: allPassed, spec: { cq: 1, mcq: 1, pr: 0 } });
        papers.bangla.forEach(r => handledSubjectIds.add(r.subject?.id || r.subject));
      }
      if (papers.english.length > 0) {
        const sumObtained = papers.english.reduce((s, r) => s + r.total_obtained, 0);
        const totalPossible = papers.english.reduce((s, r) => s + r.total_possible, 0);
        const allPassed = papers.english.every(r => r.is_passed);
        merged.push({ id: 'merged-english', subject: { name: 'English (1st + 2nd)' }, written_marks: papers.english.map(r => r.written_marks || '0').join('+'), mcq_marks: papers.english.map(r => r.mcq_marks || '0').join('+'), practical_marks: '--', total_obtained: sumObtained, display_total: Math.round(sumObtained), total_possible: totalPossible, grade: allPassed ? computeGrade((sumObtained/totalPossible)*100) : 'F', gpa: allPassed ? computeGpa((sumObtained/totalPossible)*100).toFixed(2) : '0.00', is_passed: allPassed, spec: { cq: 1, mcq: 0, pr: 0 } });
        papers.english.forEach(r => handledSubjectIds.add(r.subject?.id || r.subject));
      }
      mainResults.forEach(r => { if (!handledSubjectIds.has(r.subject?.id || r.subject)) merged.push(r); });
      return { main: sortSubjectsByOrder(merged, allRecalculated, studentGroup), optional: sortSubjectsByOrder(optionalResults, allRecalculated, studentGroup), coCurricular: coCurricularResults };
    }
    return { main: sortSubjectsByOrder(mainResults, allRecalculated, studentGroup), optional: sortSubjectsByOrder(optionalResults, allRecalculated, studentGroup), coCurricular: coCurricularResults };
  }, [allRecalculated, isClassNineOrTen, student]);

  const finalSummary = useMemo(() => {
    let totalObtained = 0, totalPossible = 0, sumGpa = 0, count = 0, hasFail = false;
    displayResults.main.forEach(r => {
      totalObtained += r.total_obtained; totalPossible += r.total_possible;
      const gpa = parseFloat(r.gpa);
      if (gpa === 0) hasFail = true;
      sumGpa += gpa; count++;
    });
    const opt = allRecalculated.find(r => isOptionalSubject(r, student, isClassNineOrTen));
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
  }, [displayResults.main, allRecalculated, student, isClassNineOrTen]);

  const cleanClassName = useMemo(() => {
    let name = (student?.classroom?.name || '');
    Object.keys(BN_TO_EN_CLASS_MAP).forEach(key => { name = name.replace(new RegExp(key, 'gi'), BN_TO_EN_CLASS_MAP[key]); });
    name = name.replace(/\s*\(.*?\)\s*/g, ' ').trim();
    Object.keys(ORD_MAP).forEach(key => { name = name.replace(new RegExp(key, 'gi'), ORD_MAP[key]); });
    return name || 'N/A';
  }, [student]);

  const displaySection = useMemo(() => {
    let sec = student?.section?.name || '';
    return SEC_MAP[sec] || sec;
  }, [student]);

  const formatMark = (val) => (val === null || val === undefined || val === '' || val === '--' || val === 0 || val === '0') ? 'Absent' : val;
  const studentGroupEn = useMemo(() => { const g = String(student?.student_group || student?.group || '').toLowerCase(); if (g === 'science') return 'Science'; if (g === 'arts' || g === 'humanities') return 'Humanities'; if (g === 'commerce' || g === 'business') return 'Business Studies'; return ''; }, [student]);
  const studentPhotoUrl = getMediaUrl(user?.photo || user?.photo_url);
  const logoUrl = getMediaUrl(resolvedSchool?.logo || fallbackLogo);

  const displayExam = useMemo(() => {
    const year = String(examination?.academic_year || examination?.year || new Date().getFullYear());
    let name = examination?.name || '';
    const isTen = /ten|দশম|\b10\b/i.test(String(student?.classroom?.name || ''));
    if (isTen && (name.includes('Half Yearly') || name.includes('অর্ধ-বার্ষিক') || examination?.exam_type === 'half_yearly')) name = 'Pre-Test';
    const typeLabel = labels.en.examinationTypes?.[examination?.exam_type];
    if (typeLabel) { if (!(isTen && name === 'Pre-Test')) name = typeLabel; }
    else { const nameMap = { 'প্রাক-নির্বাচনী': 'Pre-Test', 'নির্বাচনী': 'Test', 'অর্ধ-বার্ষিক': 'Half Yearly', 'বার্ষিক': 'Annual' }; name = nameMap[name] || name; }
    if (name && year && !name.includes(year)) return `${name}-${year}`;
    return name || year;
  }, [examination, student, labels.en.examinationTypes]);

  const safeSchoolName = schoolName;
  const safeStudentName = (studentName || "N/A").toUpperCase();
  const safeFatherName = (student?.father_name_en || student?.father_name || "N/A").toUpperCase();
  const safeMotherName = (student?.mother_name_en || student?.mother_name || "N/A").toUpperCase();

  if (shouldSkip) return null;

  return (
    <Box className="result-card-container" sx={{
      width: '215mm', height: '277mm', mx: 'auto', bgcolor: '#fff4e5', position: 'relative',
      boxSizing: 'border-box', overflow: 'hidden', pageBreakAfter: 'always',
      boxShadow: 'none !important', filter: 'none !important', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
      border: '15px solid transparent',
      borderImage: SVG_BORDER,
      borderStyle: 'solid',
      '&::before': { content: '""', position: 'absolute', top: '-15px', left: '-15px', right: '-15px', bottom: '-15px', border: '1px solid #000', pointerEvents: 'none', zIndex: 15 },
      '&::after': { content: '""', position: 'absolute', top: '0px', left: '0px', right: '0px', bottom: '0px', border: '1px solid #000', pointerEvents: 'none', zIndex: 15 },
      '@media print': {
        margin: '0 !important',
        bgcolor: '#fff4e5 !important',
        height: '277mm !important',
        width: '215mm !important',
        boxShadow: 'none !important',
        filter: 'none !important',
        position: 'relative !important',
        overflow: 'hidden !important',
        left: '0 !important',
        top: '0 !important',
        transform: 'none !important',
        pageBreakInside: 'avoid !important',
        breakInside: 'avoid-page !important',
        borderImage: `${SVG_BORDER} !important`,
        border: '15px solid transparent !important'
      }
    }}>
      <Box sx={{ p: '5mm', height: '100%', width: '100%', boxSizing: 'border-box', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', opacity: 0.1, zIndex: 0, pointerEvents: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', pt: '200px', '@media print': { opacity: 0.15, filter: 'none !important', WebkitPrintColorAdjust: 'exact' } }}>
          <img src={logoUrl} alt="" style={{ width: '100%', maxWidth: '700px', height: 'auto' }} />
        </Box>

        <Box className="result-card-main-content" sx={{
          position: 'relative',
          zIndex: 2,
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          pt: '0mm',
          pb: '5mm',
          '@media print': {
            pb: '0mm'
          }
        }}>
          <Box sx={{ textAlign: 'center', mb: 0, mt: -2 }}>
            <Typography variant="h4" sx={{
              fontWeight: 900,
              color: '#000 !important',
              fontSize: safeSchoolName.length > 40 ? '0.55rem' : (safeSchoolName.length > 30 ? '0.65rem' : (safeSchoolName.length > 25 ? '0.85rem' : (safeSchoolName.length > 20 ? '1.0rem' : '1.2rem'))),
              mb: 0.2,
              letterSpacing: safeSchoolName.length > 30 ? '-1.2px' : (safeSchoolName.length > 20 ? '-0.5px' : '0.5px'),
              whiteSpace: 'nowrap',
              overflow: 'visible', // Changed to visible to see if it helps, but ideally font size should handle it
              width: '100%',
              display: 'block'
            }}>{safeSchoolName}</Typography>
            {resolvedSchool?.ein && (<Typography sx={{ fontSize: '12px', color: '#000 !important', fontWeight: 'bold', mb: 0.2 }}>EIIN: {resolvedSchool.ein}</Typography>)}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.2, mt: 0.5 }}>
            <Box sx={{ width: '110px', height: '135px', border: '1.5px solid #000', p: '2px', bgcolor: '#fff' }}>
              <ImageWithFallback src={studentPhotoUrl} alt="Student" width="100%" height="100%" />
            </Box>
            <Box sx={{ width: '100px', display: 'flex', justifyContent: 'center' }}>
                <ImageWithFallback src={logoUrl} alt="Logo" width="90px" height="auto" />
            </Box>
            <Box sx={{ width: '135px' }}>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #000', bgcolor: 'transparent', boxShadow: 'none' }}>
                <Table size="small" sx={{ '& td, & th': { fontSize: '9.5px', py: '4px', px: '2px', border: '0.5px solid #000', fontWeight: 'bold', lineHeight: 1.1 } }}>
                  <TableHead><TableRow sx={{ bgcolor: '#fff4e5' }}><TableCell align="center">Range</TableCell><TableCell align="center">G</TableCell><TableCell align="center">GP</TableCell></TableRow></TableHead>
                  <TableBody>{[ ['80-100','A+','5.0'],['70-79','A','4.0'],['60-69','A-','3.5'],['50-59','B','3.0'],['40-49','C','2.0'],['33-39','D','1.0'],['00-32','F','0.0'] ].map((r, i) => (
                      <TableRow key={i}><TableCell align="center">{r[0]}</TableCell><TableCell align="center">{r[1]}</TableCell><TableCell align="center">{r[2]}</TableCell></TableRow>
                    ))}</TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Box>

          <Box sx={{ textAlign: 'center', mb: '20px', mt: '-35px' }}>
            <Typography sx={{ fontWeight: 900, fontSize: '16px', letterSpacing: 0.5, color: '#000', textDecoration: 'underline' }}>{l.reportTitle}</Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#000 !important', fontSize: '0.95rem', mt: 0.2 }}>{displayExam}</Typography>
          </Box>

          <Box sx={{ mb: 0.8, ml: 1, pr: 4 }}>
              <Grid container spacing={2} justifyContent="space-between">
                  <Grid size={7}>
                      <Box sx={{ display: 'flex', mb: 0.8, alignItems: 'flex-start' }}><Typography sx={{ fontSize: '15px', minWidth: '140px', fontWeight: 'bold' }}>{l.studentName}</Typography><Typography sx={{ fontSize: '15px', fontWeight: 'bold', fontStyle: 'italic' }}>: {safeStudentName}</Typography></Box>
                      <Box sx={{ display: 'flex', mb: 0.8, alignItems: 'flex-start' }}><Typography sx={{ fontSize: '15px', minWidth: '140px', fontWeight: 'bold' }}>{l.fatherName}</Typography><Typography sx={{ fontSize: '15px', fontWeight: 'bold', fontStyle: 'italic' }}>: {safeFatherName}</Typography></Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start' }}><Typography sx={{ fontSize: '15px', minWidth: '140px', fontWeight: 'bold' }}>{l.motherName}</Typography><Typography sx={{ fontSize: '15px', fontWeight: 'bold', fontStyle: 'italic' }}>: {safeMotherName}</Typography></Box>
                  </Grid>
                  <Grid size={4}>
                      <Box sx={{ display: 'flex', mb: 0.8, alignItems: 'center', justifyContent: 'flex-start' }}><Typography sx={{ fontSize: '15px', minWidth: '80px', fontWeight: 'bold' }}>{l.class}</Typography><Typography sx={{ fontSize: '15px', fontWeight: 'bold', fontStyle: 'italic' }}>: {cleanClassName}</Typography></Box>
                      <Box sx={{ display: 'flex', mb: 0.8, alignItems: 'center', justifyContent: 'flex-start' }}><Typography sx={{ fontSize: '15px', minWidth: '80px', fontWeight: 'bold' }}>{isClassNineOrTen ? l.group : l.section}</Typography><Typography sx={{ fontSize: '15px', fontWeight: 'bold', fontStyle: 'italic' }}>: {isClassNineOrTen ? (studentGroupEn || 'General') : displaySection}</Typography></Box>
                      <Box sx={{ display: 'flex', mb: 0.8, alignItems: 'center', justifyContent: 'flex-start' }}><Typography sx={{ fontSize: '15px', minWidth: '80px', fontWeight: 'bold' }}>{l.rollNo}</Typography><Typography sx={{ fontSize: '15px', fontWeight: 'bold', fontStyle: 'italic' }}>: {parseInt(student.roll_number, 10) || student.roll_number}</Typography></Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}><Typography sx={{ fontSize: '15px', minWidth: '80px', fontWeight: 'bold' }}>{l.meritPosition}</Typography><Typography sx={{ fontSize: '15px', fontWeight: 'bold', fontStyle: 'italic' }}>: {overallResult?.rank_in_section || overallResult?.rank || '--'}</Typography></Box>
                  </Grid>
              </Grid>
          </Box>

          <Typography sx={{ fontWeight: 'bold', fontSize: '15px', mb: 0.5 }}>{l.mainSubjectsTitle}</Typography>
          <TableContainer component={Paper} elevation={0} sx={{ mb: 0.5, border: '1.5px solid #000', borderRadius: 0, bgcolor: 'transparent', boxShadow: 'none' }}>
            <Table size="small" sx={{ borderCollapse: 'collapse', bgcolor: 'transparent', '& td, & th': { border: '1px solid #000 !important', py: 0.4, px: 0.8, fontSize: '12px' } }}>
              <TableHead><TableRow sx={{ bgcolor: '#fff4e5' }}>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '40px' }}>Sl</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>{l.subjectName}</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '40px' }}>CQ</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '40px' }}>MCQ</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '40px' }}>PR</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '50px' }}>Total</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '50px' }}>Grade</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '50px' }}>GP</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '60px' }}>GPA</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {displayResults.main.map((r, idx) => {
                  let sName = r.subject?.name || r.subject_name;
                  sName = SUB_MAP[sName] || sName;
                  if (typeof sName === 'string') {
                    sName = sName.replace(BN_TO_EN_PAPER_REGEX_1, '1st Paper').replace(BN_TO_EN_PAPER_REGEX_2, '2nd Paper');
                    sName = sName.replace(/বাংলা/g, 'Bangla').replace(/ইংরেজি/g, 'English').replace(/ইংরেজী/g, 'English');
                  }
                  return (
                    <TableRow key={r.id || idx}>
                      <TableCell align="center">{idx + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{sName}</TableCell>
                      <TableCell align="center">{r.spec?.cq > 0 ? formatMark(r.written_marks) : '--'}</TableCell>
                      <TableCell align="center">{r.spec?.mcq > 0 ? formatMark(r.mcq_marks) : '--'}</TableCell>
                      <TableCell align="center">{r.spec?.pr > 0 ? formatMark(r.practical_marks) : '--'}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>{formatMark(r.display_total || Math.round(r.total_obtained))}</TableCell>
                      <TableCell align="center" sx={{ color: r.grade === 'F' ? 'red' : 'inherit', fontWeight: 'bold' }}>{r.grade}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>{n(r.gpa)}</TableCell>
                      {idx === 0 && (
                        <TableCell align="center" rowSpan={displayResults.main.length} sx={{ fontWeight: 900, borderLeft: '1.5px solid #000 !important', verticalAlign: 'middle', color: '#000' }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Typography sx={{ fontWeight: 900, fontSize: '1.2rem', color: 'inherit' }}>{n(finalSummary.cgpa)}</Typography>
                            <Typography sx={{ fontWeight: 900, fontSize: '1.2rem', color: 'inherit' }}>{finalSummary.grade}</Typography>
                            <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: 'inherit' }}>Total: {finalSummary.obtained}</Typography>
                            <Typography sx={{ fontWeight: 900, fontSize: '1.0rem', color: 'inherit' }}>Merit: {overallResult?.rank_in_section || overallResult?.rank || '--'}</Typography>
                          </Box>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography sx={{ fontWeight: 'bold', fontSize: '15px', mb: 0.5 }}>{l.optionalSubjectsTitle}</Typography>
          <TableContainer component={Paper} elevation={0} sx={{ mb: 0.5, border: '1.5px solid #000', borderRadius: 0, bgcolor: 'transparent', boxShadow: 'none' }}>
            <Table size="small" sx={{ '& td, & th': { border: '1px solid #000 !important', py: 0.5, px: 1, fontSize: '12px' } }}>
              <TableBody>
                {displayResults.optional.length > 0 ? displayResults.optional.map((r, idx) => {
                  let optName = r.subject?.name || r.subject_name;
                  optName = OPT_SUB_MAP[optName] || optName;
                  return (
                    <TableRow key={r.id || idx}>
                      <TableCell align="center" sx={{ width: '40px' }}>{displayResults.main.length + idx + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{optName}</TableCell>
                      <TableCell align="center" sx={{ width: '100px', fontWeight: 'bold' }}>{r.grade}</TableCell>
                      <TableCell align="center" sx={{ width: '100px', fontWeight: 'bold' }}>{n(r.gpa)}</TableCell>
                      <TableCell align="center" sx={{ width: '110px', fontWeight: 'bold', fontSize: '10px' }}>{parseFloat(r.gpa) > 2.0 ? `GP Above 2: ${n((parseFloat(r.gpa) - 2).toFixed(2))}` : '--'}</TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow><TableCell colSpan={5} align="center">No Optional Subject</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {displayResults.coCurricular.length > 0 && (
            <>
              <Typography sx={{ fontWeight: 'bold', fontSize: '15px', mb: 0.5 }}>{l.coCurricularTitle}</Typography>
              <TableContainer component={Paper} elevation={0} sx={{ mb: 1, border: '1.5px solid #000', borderRadius: 0, bgcolor: 'transparent', boxShadow: 'none' }}>
                <Table size="small" sx={{ '& td, & th': { border: '1px solid #000 !important', py: 0.5, px: 1, fontSize: '12px' } }}>
                  <TableBody>{displayResults.coCurricular.map((r, idx) => (
                    <TableRow key={r.id || idx}>
                      <TableCell align="center" sx={{ width: '40px' }}>{displayResults.main.length + displayResults.optional.length + idx + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{r.subject?.name || r.subject_name}</TableCell>
                      <TableCell align="center" sx={{ width: '100px', fontWeight: 'bold' }}>{r.grade}</TableCell>
                      <TableCell align="center" sx={{ width: '100px', fontWeight: 'bold' }}>{n(r.gpa)}</TableCell>
                      <TableCell align="center" sx={{ width: '110px', fontWeight: 'bold' }}>{r.is_passed ? 'PASSED' : 'FAILED'}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </TableContainer>
            </>
          )}

          <Box className="result-card-signatures" sx={{
            position: 'relative',
            mt: 'auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            px: 2,
            pb: 0,
            mb: '100px',
            zIndex: 20,
            '@media print': {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: '30mm',
              mt: 0,
              mb: 0,
              pageBreakInside: 'avoid',
              breakInside: 'avoid-page'
            }
          }}>
             <Box sx={{ textAlign: 'center', width: '150px' }}><Box sx={{ height: '30px' }} /><Typography sx={{ borderTop: '1px solid #000', fontSize: '11px', fontWeight: 'bold' }}>{l.guardianSig}</Typography></Box>
             <Box sx={{ textAlign: 'center', width: '150px' }}><Box sx={{ height: '30px' }} /><Typography sx={{ borderTop: '1px solid #000', fontSize: '11px', fontWeight: 'bold' }}>{l.classTeacherSig}</Typography></Box>
             <Box sx={{ textAlign: 'center', width: '200px' }}><Box sx={{ height: '30px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>{resolvedSchool?.principal_signature && <img src={getMediaUrl(resolvedSchool.principal_signature)} alt="" style={{ maxHeight: '40px', mixBlendMode: 'multiply' }} />}</Box><Typography sx={{ borderTop: '1px solid #000', fontSize: '11px', fontWeight: 'bold' }}>{l.headmaster}</Typography></Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
});

export default ResultCard;
