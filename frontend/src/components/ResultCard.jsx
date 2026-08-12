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
  const g = String(group || '').toLowerCase();

  // 1. Core Common Subjects
  if (r.id === 'merged-bangla' || (clean.includes('বাংলা') && !clean.includes('বাংলাদেশ') && !clean.includes('দেশ')) || (clean.includes('bangla') && !clean.includes('bangladesh'))) return 10;
  if (r.id === 'merged-english' || clean.includes('english') || clean.includes('ইংরেজি') || clean.includes('ইংরেজী')) return 20;
  if (clean.includes('গণিত') || clean.includes('math')) {
      if (clean.includes('উচ্চতর') || clean.includes('higher')) return 1000;
      return 30;
  }
  if (clean.includes('ইসলাম') || clean.includes('islam') || clean.includes('ধর্ম') || clean.includes('religion')) return 40;
  if (clean.includes('আইসিটি') || clean.includes('ict') || clean.includes('তথ্য')) return 50;

  // 2. Bangladesh and Global Studies (BGS) - Priority detection
  if (clean.includes('বাংলাদেশ') || clean.includes('বিশ্বপরিচয়') || clean.includes('bgs') || clean.includes('global studies') || clean.includes('bangladesh') || clean.includes('সামাজিক')) return 100;

  // 3. Group Specific Logic
  if (g.includes('science') || g.includes('বিজ্ঞান')) {
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
  'হিসাব বিজ্ঞান': 'Accounting',
  'হিসাববিজ্ঞান': 'Accounting',
  'হিসাব': 'Accounting',
  'Accounting': 'Accounting',
  'ব্যবসায় উদ্যোগ': 'Business Entrepreneurship',
  'ব্যবসায় শিক্ষা': 'Business Studies',
  'গণিত': 'Mathematics',
  'উচ্চতর গণিত': 'Higher Mathematics',
  'বিজ্ঞান': 'Science',
  'সাধারণ বিজ্ঞান': 'Science',
  'বাংলাদেশ ও বিশ্বপরিচয়': 'BGS',
  'বাংলাদেশ ও বিশ্বপরিচয়': 'BGS',
  'বাংলাদেশ ও বিশ্ব পরিচয়': 'BGS',
  'বাংলাদেশ ও বিশ্বসভ্যতা': 'History of Bangladesh & World Civilization',
  'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা': 'History of Bangladesh & World Civilization',
  'বাংলাদেশ ও বিশ্ব সভ্যতা': 'History of Bangladesh & World Civilization',
  'পৌরনীতি ও নাগরিকতা': 'Civics & Citizenship',
  'পৌরণীতি ও নাগরিকতা': 'Civics & Citizenship',
  'পৌরনীতি': 'Civics',
  'পৌরণীতি': 'Civics',
  'কৃষি শিক্ষা': 'Agriculture / Home Science',
  'কৃষি': 'Agriculture / Home Science',
  'গার্হস্থ্য বিজ্ঞান': 'Agriculture / Home Science',
  'গার্হস্থ্য': 'Agriculture / Home Science',
  'Home Science': 'Agriculture / Home Science',
  'ইসলাম ও নৈতিক শিক্ষা': 'Religion',
  'ইসলাম শিক্ষা': 'Religion',
  'Islam': 'Religion',
  'Hinduism': 'Religion',
  'Hindu': 'Religion',
  'Islam and Moral Education': 'Religion',
  'Islam & Moral Education': 'Religion',
  'Islam Moral Education': 'Religion',
  'Religion (Islam)': 'Religion',
  'Religion (Hindu)': 'Religion',
  'Islam': 'Religion',
  'Hinduism': 'Religion',
  'Hindu': 'Religion',
  'ইসলাম ও নৈতিক শিক্ষা': 'Religion',
  'ইসলাম শিক্ষা': 'Religion',
  'হিন্দুধর্ম ও নৈতিক শিক্ষা': 'Religion',
  'হিন্দু ধর্ম শিক্ষা': 'Religion',
  'Hinduism and Moral Education': 'Religion',
  'Hinduism & Moral Education': 'Religion',
  'Hindu Moral Education': 'Religion',
  'খ্রিস্টধর্ম ও নৈতিক শিক্ষা': 'Religion',
  'বৌদ্ধধর্ম ও নৈতিক শিক্ষা': 'Religion',
  'Religion': 'Religion',
  'ধর্ম': 'Religion',
  'তথ্য ও যোগাযোগ প্রযুক্তি': 'ICT',
  'আইসিটি': 'ICT',
  'ict': 'ICT',
  'বাংলা ১ম পত্র': 'Bangla 1st Paper',
  'বাংলা ২য় পত্র': 'Bangla 2nd Paper',
  'ইংরেজি ১ম পত্র': 'English 1st Paper',
  'ইংরেজি ২য় পত্র': 'English 2nd Paper',
  'শারীরিক শিক্ষা ও স্বাস্থ্য': 'Physical Education',
  'শারীরিক শিক্ষা': 'Physical Education',
  'চারু ও কারুকলা': 'Arts & Crafts',
  'কর্ম ও জীবনমুখী শিক্ষা': 'Work & Life Education',
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
  'ইংরেজি (১ম+২য়)': 'English (1st+2nd)',
  'English (1st+2nd)': 'English (1st+2nd)',
  'Bangla (1st+2nd)': 'Bangla (1st+2nd)',
  'Bangladesh and Global Studies': 'BGS',
  'Bangladesh & Global Studies': 'BGS',
  'B.G.S': 'BGS',
  'Science': 'Science',
  'Mathematics': 'Mathematics',
  'General Mathematics': 'Mathematics',
  'Religion & Moral Education': 'Religion',
  'Religion and Moral Education': 'Religion',
  'Islam and Moral Education': 'Religion (Islam)',
  'Hinduism and Moral Education': 'Religion (Hindu)',
  'Information and Communication Technology': 'ICT',
  'Physical Education and Health': 'Physical Education',
  'Arts and Crafts': 'Arts & Crafts',
  'Work and Life Education': 'Work & Life Education',
  'Career Education': 'Career Education',
  'Agriculture Studies': 'Agriculture / Home Science',
  'Agriculture': 'Agriculture / Home Science',
  'Home Science': 'Agriculture / Home Science',
  'Physics': 'Physics',
  'Chemistry': 'Chemistry',
  'Biology': 'Biology',
  'Business Entrepreneurship': 'Business Entrepreneurship',
  'হিসাব বিজ্ঞান': 'Accounting',
  'হিসাববিজ্ঞান': 'Accounting',
  'ব্যবসায় উদ্যোগ': 'Business Entrepreneurship',
  'ব্যবসায় শিক্ষা': 'Business Studies',
  'ফিন্যান্স ও ব্যাংকিং': 'Finance & Banking',
  'পৌরনীতি ও নাগরিকতা': 'Civics & Citizenship',
  'ভূগোল ও পরিবেশ': 'Geography & Environment',
  'ভূগোল': 'Geography',
  'উচ্চতর গণিত': 'Higher Mathematics',
  'উচ্চতর গনিত': 'Higher Mathematics',
  'উচ্চতর গণিত ': 'Higher Mathematics',
  'Higher Mathematics': 'Higher Mathematics',
  'Higher Math': 'Higher Mathematics',
  'বিজ্ঞান': 'Science',
  'সাধারণ বিজ্ঞান': 'Science',
  'General Science': 'Science',
  'বাংলাদেশ ও বিশ্বপরিচয়': 'BGS',
  'বাংলাদেশ ও বিশ্বপরিচয়': 'BGS',
  'বাংলাদেশ ও বিশ্ব পরিচয়': 'BGS',
  'Bangladesh and Global Studies': 'BGS',
  'Bangladesh & Global Studies': 'BGS',
  'B.G.S': 'BGS',
  'রসায়ন': 'Chemistry',
  'রসায়ন': 'Chemistry',
  'জীববিজ্ঞান': 'Biology',
  'জীব বিজ্ঞান': 'Biology',
  'বই পড়া': 'Book Reading',
  'বই পড়া': 'Book Reading',
  'ক্যারিয়ার শিক্ষা': 'Career Education',
  'ক্যারিয়ার শিক্ষা': 'Career Education',
  'Word Collection Achievement Test': 'Word Achievement',
  'Word Achievement': 'Word Achievement',
  'Continuous Assessment': 'Continuous Assessment',
  'ধারাবাহিক মূল্যায়ন': 'Continuous Assessment',
  'Life and Work': 'Life and Work',
  'অর্থনীতি': 'Economics',
  'Economics': 'Economics',
  'ইতিহাস': 'History',
  'History': 'History'
};

const BN_TO_EN_PAPER_REGEX_1 = /[১1]ম\s*(পত্র|paper)/gi;
const BN_TO_EN_PAPER_REGEX_2 = /[২2][য়য়]\s*(পত্র|paper)/gi;

const OPT_SUB_MAP = {
  'উচ্চতর গণিত': 'Higher Mathematics',
  'উচ্চতর গনিত': 'Higher Mathematics',
  'কৃষি শিক্ষা': 'Agriculture / Home Science',
  'গার্হস্থ্য বিজ্ঞান': 'Agriculture / Home Science',
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

const BN_TO_EN_CLASS_MAP = { 'প্রথম': 'One', 'দ্বিতীয়': 'Two', 'তৃতীয়': 'Three', 'তৃতীয়': 'Three', 'চতুর্থ': 'Four', 'পঞ্চম': 'Five', 'ষষ্ঠ': 'Six', 'সপ্তম': 'Seven', 'অষ্টম': 'Eight', 'নবম': 'Nine', 'দশম': 'Ten', 'শ্রেণী': '', 'শ্রেণি': '', 'শেণি': '', 'Class': '' };
const ORD_MAP = { 'Sixth': 'Six', 'Seventh': 'Seven', 'Eighth': 'Eight', 'Ninth': 'Nine', 'Tenth': 'Ten' };

const SEC_MAP = { 'মানবিক': 'Humanities', 'বিজ্ঞান': 'Science', 'ব্যবসায় শিক্ষা': 'Commerce', 'ব্যবসা': 'Commerce', 'ব্যবসায়': 'Commerce', 'ব্যবসায়': 'Commerce', 'ক': 'A', 'খ': 'B', 'গ': 'C', 'ঘ': 'D', 'এ': 'A', 'বি': 'B', 'সি': 'C', 'ডি': 'D' };

const SVG_BORDER = `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23000' stroke-width='1.5'%3E%3Cpath d='M0 50 Q 25 0 50 50 T 100 50'/%3E%3Cpath d='M0 50 Q 25 100 50 50 T 100 50'/%3E%3Cpath d='M50 0 Q 0 25 50 50 T 50 100'/%3E%3Cpath d='M50 0 Q 100 25 50 50 T 50 100'/%3E%3Cg transform='rotate(45,50,50)'%3E%3Cpath d='M20 50 Q 35 20 50 50 T 80 50'/%3E%3Cpath d='M20 50 Q 35 80 50 50 T 80 50'/%3E%3Cpath d='M50 20 Q 20 35 50 50 T 50 80'/%3E%3Cpath d='M50 20 Q 80 35 50 50 T 50 80'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`;

const isCoCurricular = (name, isClassNineOrTen) => {
  const n = String(name || '').replace(/\u200d/g, '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
  const baseList = [
    'শারীরিক শিক্ষা ও স্বাস্থ্য', 'শারীরিক শিক্ষা', 'Physical Education', 'Physical Education and Health',
    'ক্যারিয়ার শিক্ষা', 'ক্যারিয়ার শিক্ষা', 'Career Education', 'ক্যারিয়ার', 'ক্যারিয়ার',
    'Word Collection Achievement Test', 'WCAT', 'Word Achievement', 'বই পড়া', 'বই পড়া',
    'চারু ও কারুকলা', 'Arts and Crafts', 'Continuous Assessment', 'ধারাবাহিক মূল্যায়ন', 'Life and Work',
    'Work and Life', 'Work and Life Education', 'কর্ম ও জীবনমুখী শিক্ষা', 'কর্ম ও জীবনমুখী'
  ];
  if (!isClassNineOrTen && (n.includes('কৃষি') || n.includes('agriculture') || n.includes('গার্হস্থ্য') || n.includes('home economics'))) return true;
  return baseList.some(sub => n.includes(sub.toLowerCase()));
};

const isOptionalSubject = (r, student, isClassNineOrTen, group = '') => {
  if (!r) return false;
  const sname = String(r.subject?.name || r.subject_name || '').toLowerCase();
  const sid = String(r.subject?.id || r.subject || '');

  // For Class 9-10, Higher Math and Agriculture/Home Science are ALWAYS optional candidates
  if (isClassNineOrTen) {
    const isHM = sname.includes('উচ্চতর') || sname.includes('higher');
    const isAgri = sname.includes('কৃষি') || sname.includes('agriculture') || sname.includes('গার্হস্থ্য') || sname.includes('home science') || sname.includes('home economics');
    if (isHM || isAgri) return true;
  }

  // 1. Primary Check: Explicitly assigned optional subject ID from student profile
  const assignedOpt = student?.optional_subject;
  const assignedOptId = String(assignedOpt?.id || assignedOpt || '');
  if (assignedOptId && sid === assignedOptId) return true;

  // 2. Secondary Check: Name match with assigned optional subject
  const assignedOptName = String(assignedOpt?.name || '').toLowerCase();
  if (assignedOptName && (sname === assignedOptName || sname.includes(assignedOptName))) return true;

  return sname.includes('optional') || sname.includes('ঐচ্ছিক') || sname.includes('fourth') || sname.includes('৪র্থ');
};

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

  if (isClassNineOrTen) {
    if (isPracticalScience || isAgriHome) return { cq: 50, mcq: 25, pr: 25 };
  } else {
    if (isPracticalScience) return { cq: 50, mcq: 25, pr: 25 };
    if (isAgriHome) return { cq: 35, mcq: 15, pr: 0 };
    if (lower.includes('ধর্ম') || lower.includes('religion') || lower.includes('islam') || lower.includes('hindu') || lower.includes('ইসলাম') || lower.includes('হিন্দ')) return { cq: 70, mcq: 30, pr: 0 };
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

const transliterateBnToEn = (text) => {
  if (!text) return "";
  const bnToEnMap = {
    'অ': 'O', 'আ': 'A', 'ই': 'I', 'ঈ': 'I', 'উ': 'U', 'ঊ': 'U', 'ঋ': 'Ri', 'এ': 'E', 'ঐ': 'Oi', 'ও': 'O', 'ঔ': 'Ou',
    'ক': 'K', 'খ': 'Kh', 'গ': 'G', 'ঘ': 'Gh', 'ঙ': 'Ng',
    'চ': 'Ch', 'ছ': 'Chh', 'জ': 'J', 'ঝ': 'Jh', 'ঞ': 'N',
    'ট': 'T', 'ঠ': 'Th', 'ড': 'D', 'ঢ': 'Dh', 'ণ': 'N',
    'ত': 'T', 'থ': 'Th', 'দ': 'D', 'ধ': 'Dh', 'ন': 'N',
    'প': 'P', 'ফ': 'F', 'ব': 'B', 'ভ': 'Bh', 'ম': 'M',
    'য': 'Z', 'র': 'R', 'ল': 'L', 'শ': 'Sh', 'ষ': 'Sh', 'স': 'S', 'হ': 'H',
    'ড়': 'R', 'ঢ়': 'Rh', 'য়': 'Y', 'ৎ': 'T', 'ং': 'Ng', 'ঃ': 'H', 'ঁ': '',
    'া': 'A', 'ি': 'I', 'ী': 'I', 'ু': 'U', 'ূ': 'U', 'ৃ': 'Ri', 'ে': 'E', 'ৈ': 'Oi', 'ো': 'O', 'ৌ': 'Ou', '্': ''
  };

  // Special cases for common name parts
  const specialNames = {
    'মোস্তফা': 'Mostofa', 'মরিয়ম': 'Mariyam', 'ওমর': 'Omor', 'ফারুক': 'Faruk',
    'আক্তার': 'Aktar', 'খাতুন': 'Khatun', 'বেগম': 'Begum', 'ইসলাম': 'Islam', 'রহমান': 'Rahman'
  };

  let words = text.split(/\s+/);
  let translatedWords = words.map(word => {
    if (specialNames[word]) return specialNames[word];

    let result = "";
    for (let i = 0; i < word.length; i++) {
      let char = word[i];
      let nextChar = word[i+1];
      let translated = bnToEnMap[char] || char;

      result += translated;

      // Logic for implicit 'o/a' vowels between consonants
      if (bnToEnMap[char] && !isVowel(char) && nextChar && bnToEnMap[nextChar] && !isVowel(nextChar) && char !== '্') {
        // If current and next are consonants, add an implicit vowel based on common names
        if (word.length > 3 && i === 0) result += "a"; // e.g., Mariyam
        else if (word === 'ওমর' || char === 'ম') result += "o";
        else result += "a";
      }
    }
    return result;
  });

  return translatedWords.join(' ');
};

function isVowel(char) {
  return 'অআইঈউঊঋএঐওঔািীুূৃেৈোৌ'.includes(char);
}

const isRelSubj = (n) => /religion|islam|hindu|buddhist|christian|ধর্ম|ইসলাম|হিন্দু|বৌদ্ধ|খ্রিস্ট/i.test(String(n));

const ResultCard = memo(({ studentData, results: rawResults, overallResult, examination, school, forceLanguage, translatedData }) => {
  const student = useMemo(() => studentData?.student || {}, [studentData]);
  const user = useMemo(() => student?.user || {}, [student]);
  const resolvedSchool = useMemo(() => school || {}, [school]);

  const sumStr = (s) => String(s || '').split('+').reduce((acc, v) => acc + (parseFloat(v) || 0), 0);

  const filteredRawResults = useMemo(() => {
    if (!Array.isArray(rawResults)) return [];

    // 1. Sort by ID to ensure consistent picking if everything else is equal
    const sorted = [...rawResults].sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));

    // 2. Religion suppression
    const relResults = sorted.filter(r => isRelSubj(r.subject?.name || r.subject_name));
    let suppressedIds = new Set();
    if (relResults.length > 1) {
      const withMarks = relResults.map(r => ({
        sid: String(r.subject?.id || r.subject || r.subject_name),
        total: (parseFloat(r.total_obtained) || (sumStr(r.written_marks)||0) + (sumStr(r.mcq_marks)||0) + (sumStr(r.practical_marks)||0))
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

    return sorted.filter(r => !suppressedIds.has(String(r.subject?.id || r.subject || r.subject_name)));
  }, [rawResults]);

  const shouldSkip = useMemo(() => {
    const fn = (user?.first_name || '').trim();
    const ln = (user?.last_name || '').trim();
    const username = (user?.username || '').trim();
    const fullName = `${fn} ${ln}`.trim().toUpperCase();

    // Only skip if there's absolutely no identifying info or explicitly marked as TC
    const isTC = fullName === 'TC' || fn.toUpperCase() === 'TC' || ln.toUpperCase() === 'TC' || username.toUpperCase() === 'TC';
    return (!fn && !ln && !username) || isTC;
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
      },
      merit: "Merit",
      totalObtainedMarks: "Total Obtained Marks",
      noOptionalSubject: "No Optional Subject",
      absent: "Absent"
    },
    bn: {
      reportTitle: "একাডেমিক ট্রান্সক্রিপ্ট",
      studentName: "শিক্ষার্থীর নাম",
      fatherName: "পিতার নাম",
      motherName: "মাতার নাম",
      rollNo: "রোল",
      class: "শ্রেণি",
      section: "শাখা",
      group: "বিভাগ",
      meritPosition: "মেধাক্রম",
      examination: "পরীক্ষা",
      subjectName: "বিষয়ের নাম",
      letterGrade: "লেটার গ্রেড",
      gradePoint: "গ্রেড পয়েন্ট",
      gpa: "জিপিএ",
      total: "মোট",
      mainSubjectsTitle: "বিষয়ের নাম",
      optionalSubjectsTitle: "ঐচ্ছিক বিষয়",
      coCurricularTitle: "ধারাবাহিক মূল্যায়ন বিষয়সমূহ",
      passed: "✓ উত্তীর্ণ",
      failed: "✗ অনুত্তীর্ণ",
      classTeacherSig: "শ্রেণি শিক্ষক",
      guardianSig: "অভিভাবক",
      headmaster: "প্রধান শিক্ষক",
      examinationTypes: {
        'half_yearly': 'অর্ধ-বার্ষিক পরীক্ষা',
        'annual': 'বার্ষিক পরীক্ষা',
        'test': 'ক্লাস টেস্ট',
        'terminal': 'টার্মিনাল পরীক্ষা',
        'model': 'মডেল টেস্ট',
        'pre_test': 'প্রাক-নির্বাচনী পরীক্ষা'
      },
      merit: "মেধাস্থান",
      totalObtainedMarks: "মোট প্রাপ্ত নম্বর",
      noOptionalSubject: "কোনো ঐচ্ছিক বিষয় নেই",
      absent: "অনুপস্থিত"
    }
  }), []);

  const studentName = useMemo(() => {
    if (forceLanguage === 'en') {
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
    }

    // Fallback: If English names don't exist, try to transliterate Bangla name
    let fn = (user?.first_name || '').trim();
    let ln = (user?.last_name || '').trim();
    const fullNameBn = `${fn} ${ln}`.trim();

    if (forceLanguage === 'en') {
        return transliterateBnToEn(fullNameBn) || user?.username || "N/A";
    }

    const words = fullNameBn.split(/\s+/).filter(Boolean);
    const uniqueWords = [];
    const seen = new Set();
    for (const w of words) {
      if (!seen.has(w)) {
        seen.add(w);
        uniqueWords.push(w);
      }
    }
    return uniqueWords.join(' ') || user?.username || "N/A";
  }, [user, forceLanguage]);

  const schoolName = useMemo(() => {
    if (forceLanguage === 'bn') {
      return (resolvedSchool?.bn_name || resolvedSchool?.name || "BD School");
    }

    let name = resolvedSchool?.name_en || resolvedSchool?.name || "BD School";
    // Always translate to English for Result Card
    const bnToEn = {
      'শ্রীরামপুর': 'SRIRAMPUR', 'ভাটরা': 'BHATRA',
      'উচ্চ বিদ্যালয়': 'HIGH SCHOOL', 'উচ্চ বিদ্যালয়': 'HIGH SCHOOL', 'উচ্চ বিদ্যা লয়': 'HIGH SCHOOL', 'উচ্চ বিদ্যা লয়': 'HIGH SCHOOL',
      'মাধ্যমিক বিদ্যালয়': 'SECONDARY SCHOOL', 'মাধ্যমিক বিদ্যালয়': 'SECONDARY SCHOOL',
      'সরকারি': 'GOVT.', 'সরকারী': 'GOVT.',
      'বালিকা': 'GIRLS', 'বালক': 'BOYS',
      'মাদ্রাসা': 'MADRASAH', 'প্রাথমিক': 'PRIMARY',
      'হামানকর্দ্দি': 'HAMANKARDI', 'হামান কর্দ্দি': 'HAMANKARDI', 'হামা নকর্দ্দি': 'HAMANKARDI', 'পল্লী মঙ্গল': 'POLLI MONGOL',
      'দ্বারকানাথ': 'DWARKANATH', 'হাই স্কুল': 'HIGH SCHOOL', 'হাইস্কুল': 'HIGH SCHOOL', 'ডি.এন.': 'D.N.',
      'বহরিয়া': 'BAHORIA', 'বহরিয়া': 'BAHORIA'
    };
    Object.entries(bnToEn).forEach(([bn, en]) => {
      // Escape dots for regex
      const safeBn = bn.replace(/\./g, '\\.');
      name = name.replace(new RegExp(safeBn, 'g'), en);
    });
    return name.toUpperCase();
  }, [resolvedSchool, forceLanguage]);

  const schoolFontSize = useMemo(() => {
    if (!schoolName || schoolName === "N/A") return '48px !important';
    const words = schoolName.split(/\s+/).filter(Boolean).length;
    if (words <= 3) return '48px !important';
    if (words === 4) return '36px !important';
    return '28px !important';
  }, [schoolName]);

  const l = labels[forceLanguage] || labels.en;
  const n = (v) => forceLanguage === 'bn' ? toBn(v) : v;

  const isClassNineOrTen = useMemo(() => {
    try {
      const sources = [student?.classroom?.name, examination?.classroom?.name, examination?.name, student?.classroom?.display_name].filter(Boolean).map(s => String(s).toLowerCase());
      const text = sources.join(' ');
      return CLASS_9_10_REGEX.test(text);
    } catch (_) { return false; }
  }, [student, examination]);

  const inferredGroup = useMemo(() => {
    const results = Array.isArray(rawResults) ? rawResults : (studentData?.results || []);
    if (!isClassNineOrTen || results.length === 0) return student?.student_group || student?.group || '';

    const countGroup = (regex) => results.filter(r => {
        const hasPositiveMarks = (parseFloat(r.written_marks) > 0 || parseFloat(r.mcq_marks) > 0 || parseFloat(r.practical_marks) > 0);
        return hasPositiveMarks && (r.subject?.name || r.subject_name || '').match(regex);
    }).length;

    const scienceCount = countGroup(/physics|chemistry|biology|higher|পদার্থ|রসায়ন|জীব|উচ্চতর/i);
    const commerceCount = countGroup(/accounting|finance|entrepreneurship|ব্যবসায়|হিসাব|ফিন্যান্স/i);
    const humanitiesCount = countGroup(/history|geography|civics|ইতিহাস|ভূগোল|পৌরনীতি|economics|অর্থনীতি/i);

    // If student takes 'General Science', they are definitely NOT Science group
    const takesGeneralScience = results.some(r => {
        const name = (r.subject?.name || r.subject_name || '').toLowerCase();
        const hasMarks = (parseFloat(r.written_marks) > 0 || parseFloat(r.mcq_marks) > 0);
        return hasMarks && (name === 'science' || name === 'বিজ্ঞান' || name === 'general science' || name === 'সাধারণ বিজ্ঞান');
    });

    if (takesGeneralScience) {
        if (commerceCount > humanitiesCount) return 'Commerce';
        return 'Humanities';
    }

    if (scienceCount > 0 && scienceCount >= commerceCount && scienceCount >= humanitiesCount) return 'Science';
    if (commerceCount > 0 && commerceCount >= humanitiesCount) return 'Commerce';
    if (humanitiesCount > 0) return 'Humanities';

    return student?.student_group || student?.group || '';
  }, [rawResults, studentData, isClassNineOrTen, student]);

  const allRecalculated = useMemo(() => {
    const actualResults = filteredRawResults.length > 0 ? filteredRawResults :
                          (Array.isArray(studentData?.results) ? studentData.results :
                          (Array.isArray(student?.results) ? student.results :
                          (Array.isArray(overallResult?.results) ? overallResult.results : [])));

    if (actualResults.length === 0) return [];

    return actualResults.map(r => {
      const hasW = r.written_marks !== null && r.written_marks !== undefined && r.written_marks !== '';
      const hasM = r.mcq_marks !== null && r.mcq_marks !== undefined && r.mcq_marks !== '';
      const hasP = r.practical_marks !== null && r.practical_marks !== undefined && r.practical_marks !== '';

      const w = sumStr(r.written_marks);
      const m = sumStr(r.mcq_marks);
      const p = sumStr(r.practical_marks);

      const spec = getSubjectMaxima(r.subject?.name || r.subject_name, isClassNineOrTen);
      const totalPossible = spec.cq + spec.mcq + spec.pr || 100;
      const obtained = (w + m + p) > 0 ? (w + m + p) : (parseFloat(r.total_obtained) || 0);
      const isActuallyAbsent = (r.written_marks === null || r.written_marks === undefined || String(r.written_marks).trim() === '') &&
                               (r.mcq_marks === null || r.mcq_marks === undefined || String(r.mcq_marks).trim() === '') &&
                               (r.practical_marks === null || r.practical_marks === undefined || String(r.practical_marks).trim() === '') &&
                               !(parseFloat(r.total_obtained) > 0);

      const percentage = (obtained / totalPossible) * 100;

      // Part-wise pass check (Strict only for 9-10)
      const cqPass = spec.cq === 0 || w >= Math.round(spec.cq * 0.33 - 0.5);
      const mcqPass = spec.mcq === 0 || m >= Math.round(spec.mcq * 0.33 - 0.5);
      const prPass = spec.pr === 0 || p >= Math.round(spec.pr * 0.33 - 0.5);
      const totPass = obtained >= Math.round(totalPossible * 0.33 - 0.5);

      let isPassed = !isActuallyAbsent && (isClassNineOrTen ? (cqPass && mcqPass && prPass && totPass) : totPass);

      return { ...r, total_obtained: obtained, isActuallyAbsent, total_possible: totalPossible, grade: isPassed ? computeGrade(percentage) : 'F', gpa: isPassed ? computeGpa(percentage).toFixed(2) : '0.00', is_passed: isPassed, is_optional_detected: isOptionalSubject(r, student, isClassNineOrTen, inferredGroup), spec };
    });
  }, [rawResults, isClassNineOrTen, student, inferredGroup]);

  const displayResults = useMemo(() => {
    const resultsMap = new Map();
    const getPaperKey = (nm) => {
      const low = nm.toLowerCase();
      const p = (low.includes('১ম') || low.includes('1st') || low.includes('first') || low.includes(' i ') || low.endsWith(' i') || low.includes(' 1')) ? '1' :
                (low.includes('২য়') || low.includes('২য়') || low.includes('2nd') || low.includes('second') || low.includes(' ii ') || low.endsWith(' ii') || low.includes(' 2')) ? '2' : '';
      const b = low.replace(/(১ম|২য়|২য়|1st|2nd|first|second|paper|পত্র|\bi\b|\bii\b| 1| 2)/gi, '').replace(/\s*\(.*?\)\s*/g, '').trim();
      return b + (p ? `_p${p}` : '');
    };
    allRecalculated.forEach(r => {
        const name = (r.subject?.name || r.subject_name || '').toLowerCase().trim();

        // Safe normalization logic
        const getNormKey = (nm) => {
            let low = nm.toLowerCase().trim();

            // Force Merge all religion names into one key
            if (low.includes('religion') || low.includes('ধর্ম') || low.includes('islam') || low.includes('hindu') || low.includes('ইসলাম') || low.includes('হিন্দু') || low.includes('buddhist') || low.includes('christian')) {
                return 'religion';
            }

            const partsToRemove = [/continuous assessment/g, /achievement test/g, /ব্যবহারিক/g, /প্রাকটিক্যাল/g, /practical/g, /ধারাবাহিক মূল্যায়ন/g];
            partsToRemove.forEach(p => { low = low.replace(p, ''); });
            low = low.trim().replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

            for (const [bn, en] of Object.entries(SUB_MAP)) {
                if (low === bn.toLowerCase().trim() || low === en.toLowerCase().trim()) {
                    const base = en.toLowerCase();
                    return isClassNineOrTen ? getPaperKey(base) : base;
                }
            }
            return isClassNineOrTen ? getPaperKey(low) : low;
        };

        const normKey = getNormKey(name);
        if (!normKey) return;

        // Skip redundant combined records if specific papers exist (Matches Merit List logic)
        const isCombined = !name.match(/(1st|2nd|১ম|২য়|২য়)/);
        const hasSpecificPapers = allRecalculated.some(x => {
            const xName = (x.subject?.name || x.subject_name || '').toLowerCase();
            return getNormKey(xName).startsWith(normKey.split('_')[0]) && xName.match(/(1st|2nd|১ম|২য়|২য়)/);
        });
        if (isClassNineOrTen && isCombined && hasSpecificPapers) return;

        if (!resultsMap.has(normKey)) {
            let baseRecord = { ...r };
            // Ensure merged religion is always named "Religion"
            if (normKey === 'religion') {
                baseRecord.subject = { name: 'Religion' };
                baseRecord.subject_name = 'Religion';
            }
            resultsMap.set(normKey, { ...baseRecord,
                sumW: parseFloat(r.written_marks) || 0,
                sumM: parseFloat(r.mcq_marks) || 0,
                sumP: parseFloat(r.practical_marks) || 0,
                anyMarks: !r.isActuallyAbsent
            });
        } else {
            const existing = resultsMap.get(normKey);

            const w2 = parseFloat(r.written_marks) || 0;
            const m2 = parseFloat(r.mcq_marks) || 0;
            const p2 = parseFloat(r.practical_marks) || 0;

            // CRITICAL: Prefer record with marks instead of summing for same-subject duplicates
            // Except for Religion which we already suppressed above, and Bangla/English which handle themselves in isClassNineOrTen block later.
            // But if we are here, it means getNormKey returned the same key.

            const hasInputCurrent = !r.isActuallyAbsent;
            const hasInputExisting = existing.anyMarks;

            if (hasInputCurrent && !hasInputExisting) {
                // Replace with current as it has marks
                resultsMap.set(normKey, { ...r,
                    sumW: w2, sumM: m2, sumP: p2,
                    anyMarks: true,
                    total_obtained: parseFloat(r.total_obtained) || 0
                });
            } else if (!hasInputCurrent && hasInputExisting) {
                // Keep existing
            } else {
                // Both have marks or both are absent, pick the one with more marks or just keep existing (since it was sorted by ID)
                const currentTotal = parseFloat(r.total_obtained) || (w2 + m2 + p2);
                const existingTotal = parseFloat(existing.total_obtained) || (existing.sumW + existing.sumM + existing.sumP);

                if (currentTotal > existingTotal) {
                     resultsMap.set(normKey, { ...r,
                        sumW: w2, sumM: m2, sumP: p2,
                        anyMarks: true,
                        total_obtained: currentTotal
                    });
                }
            }
        }
    });
    const cleanResults = Array.from(resultsMap.values());
    const studentGroup = inferredGroup;

    function listMatch(text, list) { return list.some(kw => text.includes(kw)); }

    const filteredResults = cleanResults.filter(r => {
        const name = (r.subject?.name || r.subject_name || '').toLowerCase();
        // ১. সহ-পাঠ্যক্রম বাদে সাধারণ বিষয়ের ক্ষেত্রে: সহ-পাঠ্যক্রমগুলো সব সময় দেখানো হয়
        if (isCoCurricular(r.subject?.name || r.subject_name, isClassNineOrTen)) return true;

        // ২. গ্রুপ ভিত্তিক সহাবস্থান লজিক: নিজ গ্রুপের বাইরের বিষয়গুলো হাইড করা
        if (isClassNineOrTen) {
            const group = String(studentGroup).toLowerCase();
            const isScienceSub = /physics|chemistry|biology|higher|পদার্থ|রসায়ন|জীব|উচ্চতর/i.test(name);
            const isCommerceSub = /accounting|finance|entrepreneurship|ব্যবসায়|হিসাব|ফিন্যান্স/i.test(name);
            const isHumanitiesSub = /history|geography|civics|ইতিহাস|ভূগোল|পৌরনীতি|economics|অর্থনীতি/i.test(name);
            const isBGS = /bgs|bangladesh|global studies|বাংলাদেশ ও বিশ্ব|বিশ্বপরিচয়/i.test(name);
            const isGeneralScience = /^(science|বিজ্ঞান|general science|সাধারণ বিজ্ঞান)$/i.test(name.trim()) || (name.includes('science') && !isScienceSub && !isCommerceSub && !isBGS);

            if (group.includes('science') || group.includes('বিজ্ঞান')) {
                if (isCommerceSub || isHumanitiesSub || isGeneralScience) return false;
            } else if (group.includes('commerce') || group.includes('business') || group.includes('ব্যবসায়')) {
                if (isScienceSub || isHumanitiesSub || isBGS) return false;
            } else if (group.includes('arts') || group.includes('humanities') || group.includes('মানবিক')) {
                if (isScienceSub || isCommerceSub || isBGS) return false;
            }
        }

        return true;
    });


    let mainResults = filteredResults.filter(r => !isCoCurricular(r.subject?.name || r.subject_name, isClassNineOrTen) && !r.is_optional_detected);
    let optionalResults = filteredResults.filter(r => r.is_optional_detected);

    // For Class 9-10, limit to exactly one optional subject if multiple exist
    if (isClassNineOrTen && optionalResults.length > 1) {
      // 1. Priority: Check student profile assigned optional subject
      const assignedOpt = student?.optional_subject;
      const assignedOptId = String(assignedOpt?.id || assignedOpt || '');
      const assignedOptName = String(assignedOpt?.name || '').toLowerCase();

      let primary = optionalResults.find(r =>
        (assignedOptId && String(r.subject?.id || r.subject) === assignedOptId) ||
        (assignedOptName && (r.subject?.name || r.subject_name || '').toLowerCase().includes(assignedOptName))
      );

      // 2. Fallback: If no assignment matches, pick the one with highest marks
      if (!primary) {
        const withMarks = optionalResults.filter(r => !r.isActuallyAbsent && (parseFloat(r.total_obtained) || 0) > 0);
        if (withMarks.length > 0) {
          primary = withMarks.sort((a, b) => (parseFloat(b.total_obtained) || 0) - (parseFloat(a.total_obtained) || 0))[0];
        }
      }

      if (primary) {
        optionalResults = [primary];
      } else {
        optionalResults = [optionalResults[0]];
      }
    }

    let coCurricularResults = filteredResults.filter(r => isCoCurricular(r.subject?.name || r.subject_name, isClassNineOrTen));
    if (isClassNineOrTen) {
      const merged = [];
      const handledSubjectIds = new Set();

      const getPaperNum = (nm) => {
        const low = String(nm || '').toLowerCase();
        if (low.includes('১ম') || low.includes('1st') || low.includes('first') || low.includes(' i ') || low.endsWith(' i') || low.includes(' 1')) return 1;
        if (low.includes('২য়') || low.includes('২য়') || low.includes('2nd') || low.includes('second') || low.includes(' ii ') || low.endsWith(' ii') || low.includes(' 2')) return 2;
        return 1;
      };

      const papers = {
        bangla: (() => {
            const list = mainResults.filter(r => {
                const n = String(r.subject?.name || r.subject_name || '').toLowerCase();
                return (n.includes('বাংলা') || n.includes('bangla')) && !n.includes('বাংলাদেশ') && !n.includes('দেশ') && !n.includes('bgs');
            });
            list.forEach(r => {
                const sid = r.subject?.id || r.subject;
                if (sid) handledSubjectIds.add(String(sid));
                const sname = (r.subject?.name || r.subject_name || '').toLowerCase().trim();
                if (sname) handledSubjectIds.add(sname);
            });
            const paperMap = new Map();
            list.forEach(r => {
                const pNum = getPaperNum(r.subject?.name || r.subject_name);
                const existing = paperMap.get(pNum);
                if (!existing || (parseFloat(r.total_obtained) || 0) > (parseFloat(existing.total_obtained) || 0)) {
                    paperMap.set(pNum, r);
                }
            });
            return Array.from(paperMap.values()).sort((a, b) => getPaperNum(a.subject?.name || a.subject_name) - getPaperNum(b.subject?.name || b.subject_name)).slice(0, 2);
        })(),
        english: (() => {
            const list = mainResults.filter(r => {
                const n = String(r.subject?.name || r.subject_name || '').toLowerCase();
                return n.includes('english') || n.includes('ইংরেজি') || n.includes('ইংরেজী');
            });
            list.forEach(r => {
                const sid = r.subject?.id || r.subject;
                if (sid) handledSubjectIds.add(String(sid));
                const sname = (r.subject?.name || r.subject_name || '').toLowerCase().trim();
                if (sname) handledSubjectIds.add(sname);
            });
            const paperMap = new Map();
            list.forEach(r => {
                const pNum = getPaperNum(r.subject?.name || r.subject_name);
                const existing = paperMap.get(pNum);
                if (!existing || (parseFloat(r.total_obtained) || 0) > (parseFloat(existing.total_obtained) || 0)) {
                    paperMap.set(pNum, r);
                }
            });
            return Array.from(paperMap.values()).sort((a, b) => getPaperNum(a.subject?.name || a.subject_name) - getPaperNum(b.subject?.name || b.subject_name)).slice(0, 2);
        })()
      };

      const getMergedPassStatus = (paperList, totPossible) => {
        const anyMarks = paperList.some(r => !r.isActuallyAbsent);
        if (!anyMarks) return false;

        const sumObtained = paperList.reduce((s, r) => s + (parseFloat(r.total_obtained) || 0), 0);
        // Special case: if one record already has double possible marks (combined), use its spec
        const totalCQMax = paperList.reduce((s, r) => s + (r.spec?.cq || 0), 0);
        const totalMCQMax = paperList.reduce((s, r) => s + (r.spec?.mcq || 0), 0);
        const totalPRMax = paperList.reduce((s, r) => s + (r.spec?.pr || 0), 0);

        const sumW = paperList.reduce((s, r) => {
            const val = String(r.written_marks || '').split('+').reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
            return s + val;
        }, 0);
        const sumM = paperList.reduce((s, r) => {
            const val = String(r.mcq_marks || '').split('+').reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
            return s + val;
        }, 0);
        const sumP = paperList.reduce((s, r) => {
            const val = String(r.practical_marks || '').split('+').reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
            return s + val;
        }, 0);

        // Board rules: 33% pass marks.
        const cqPass = totalCQMax === 0 || sumW >= Math.round(totalCQMax * 0.33 - 0.5);
        const mcqPass = totalMCQMax === 0 || sumM >= Math.round(totalMCQMax * 0.33 - 0.5);
        const prPass = totalPRMax === 0 || sumP >= Math.round(totalPRMax * 0.33 - 0.5);
        const totPass = sumObtained >= Math.round(totPossible * 0.33 - 0.5);

        return cqPass && mcqPass && prPass && totPass;
      };

      if (papers.bangla.length > 0) {
        const sumObtained = papers.bangla.reduce((s, r) => s + r.total_obtained, 0);
        const totalPossible = Math.max(200, papers.bangla.reduce((s, r) => s + r.total_possible, 0));
        const anyMarks = papers.bangla.some(r => !r.isActuallyAbsent);
        const allPassed = getMergedPassStatus(papers.bangla, totalPossible);
        merged.push({ id: 'merged-bangla', subject: { name: 'Bangla (1st+2nd)' }, written_marks: anyMarks ? papers.bangla.map(r => (r.written_marks !== null && r.written_marks !== '') ? r.written_marks : '0').join('+') : null, mcq_marks: anyMarks ? papers.bangla.map(r => (r.mcq_marks !== null && r.mcq_marks !== '') ? r.mcq_marks : '0').join('+') : null, practical_marks: '--', total_obtained: sumObtained, display_total: anyMarks ? Math.round(sumObtained) : null, total_possible: totalPossible, grade: allPassed ? computeGrade((sumObtained/totalPossible)*100) : 'F', gpa: allPassed ? computeGpa((sumObtained/totalPossible)*100).toFixed(2) : '0.00', is_passed: allPassed, spec: { cq: 1, mcq: 1, pr: 0 }, isActuallyAbsent: !anyMarks });
      }
      if (papers.english.length > 0) {
        const sumObtained = papers.english.reduce((s, r) => s + r.total_obtained, 0);
        const totalPossible = Math.max(200, papers.english.reduce((s, r) => s + r.total_possible, 0));
        const anyMarks = papers.english.some(r => !r.isActuallyAbsent);
        const allPassed = getMergedPassStatus(papers.english, totalPossible);
        merged.push({ id: 'merged-english', subject: { name: 'English (1st+2nd)' }, written_marks: anyMarks ? papers.english.map(r => (r.written_marks !== null && r.written_marks !== '') ? r.written_marks : '0').join('+') : null, mcq_marks: anyMarks ? papers.english.map(r => (r.mcq_marks !== null && r.mcq_marks !== '') ? r.mcq_marks : '0').join('+') : null, practical_marks: '--', total_obtained: sumObtained, display_total: anyMarks ? Math.round(sumObtained) : null, total_possible: totalPossible, grade: allPassed ? computeGrade((sumObtained/totalPossible)*100) : 'F', gpa: allPassed ? computeGpa((sumObtained/totalPossible)*100).toFixed(2) : '0.00', is_passed: allPassed, spec: { cq: 1, mcq: 0, pr: 0 }, isActuallyAbsent: !anyMarks });
      }
      mainResults.forEach(r => {
          const sid = r.subject?.id || r.subject;
          const sname = (r.subject?.name || r.subject_name || '').toLowerCase().trim();
          if (!handledSubjectIds.has(String(sid)) && !handledSubjectIds.has(sname)) merged.push(r);
      });
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
    const opt = displayResults.optional[0];
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
  }, [displayResults.main, displayResults.optional, allRecalculated, student, isClassNineOrTen]);

  const cleanClassName = useMemo(() => {
    let name = (student?.classroom?.name || '');
    if (forceLanguage === 'en') {
        Object.keys(BN_TO_EN_CLASS_MAP).forEach(key => { name = name.replace(new RegExp(key, 'gi'), BN_TO_EN_CLASS_MAP[key]); });
        name = name.replace(/\s*\(.*?\)\s*/g, ' ').trim();
        Object.keys(ORD_MAP).forEach(key => { name = name.replace(new RegExp(key, 'gi'), ORD_MAP[key]); });
    } else {
        // For Bangla, try to keep it Bangla
        const EN_TO_BN_CLASS_MAP = Object.fromEntries(Object.entries(BN_TO_EN_CLASS_MAP).map(([k, v]) => [v.toLowerCase(), k]).filter(([k,v]) => k));
        const lower = name.toLowerCase();
        name = EN_TO_BN_CLASS_MAP[lower] || name;
    }
    return name || 'N/A';
  }, [student, forceLanguage]);

  const displaySection = useMemo(() => {
    let sec = String(student?.section?.name || '').trim();
    if (forceLanguage === 'en') {
        return SEC_MAP[sec] || sec;
    } else {
        const REVERSE_SEC_MAP = Object.fromEntries(Object.entries(SEC_MAP).map(([k, v]) => [v.toLowerCase(), k]));
        return REVERSE_SEC_MAP[sec.toLowerCase()] || sec;
    }
  }, [student, forceLanguage]);

  const formatMark = (val) => {
    if (val === null || val === undefined || val === '' || val === '--') {
      return <span style={{ color: 'red', fontWeight: 'normal' }}>{l.absent}</span>;
    }
    const clean = (v) => {
      const nV = parseFloat(v);
      if (isNaN(nV)) return v;
      return nV % 1 === 0 ? String(Math.round(nV)) : nV.toFixed(2);
    };
    const sVal = String(val);
    if (sVal.includes('+')) {
      return n(sVal.split('+').map(clean).join('+'));
    }
    return n(clean(sVal));
  };
  const displayGroup = useMemo(() => {
    const g = String(inferredGroup).toLowerCase();
    if (forceLanguage === 'en') {
        if (g.includes('science') || g.includes('বিজ্ঞান')) return 'Science';
        if (g.includes('arts') || g.includes('humanities') || g.includes('মানবিক')) return 'Humanities';
        if (g.includes('commerce') || g.includes('business') || g.includes('ব্যবসায়') || g.includes('ব্যবসা') || g.includes('ব্যবসায়')) return 'Business Studies';
        return displaySection;
    } else {
        if (g.includes('science') || g.includes('বিজ্ঞান')) return 'বিজ্ঞান';
        if (g.includes('arts') || g.includes('humanities') || g.includes('মানবিক')) return 'মানবিক';
        if (g.includes('commerce') || g.includes('business') || g.includes('ব্যবসায়') || g.includes('ব্যবসা') || g.includes('ব্যবসায়')) return 'ব্যবসায় শিক্ষা';
        return displaySection;
    }
  }, [inferredGroup, forceLanguage, displaySection]);

  const studentPhotoUrl = getMediaUrl(user?.photo || user?.photo_url);
  const logoUrl = getMediaUrl(resolvedSchool?.logo || fallbackLogo);

  const displayExam = useMemo(() => {
    const rawYear = examination?.academic_year || examination?.year || new Date().getFullYear();
    const year = n(String(rawYear));
    let name = examination?.name || '';
    const isTen = /ten|দশম|\b10\b/i.test(String(student?.classroom?.name || ''));

    if (isTen && (name.includes('Half Yearly') || name.includes('অর্ধ-বার্ষিক') || examination?.exam_type === 'half_yearly')) {
        name = forceLanguage === 'bn' ? 'প্রাক-নির্বাচনী' : 'Pre-Test';
    }

    const typeLabel = l.examinationTypes?.[examination?.exam_type];
    if (typeLabel) {
        if (!(isTen && (name === 'Pre-Test' || name === 'প্রাক-নির্বাচনী'))) name = typeLabel;
    } else {
        const nameMapEn = { 'প্রাক-নির্বাচনী': 'Pre-Test', 'নির্বাচনী': 'Test', 'অর্ধ-বার্ষিক': 'Half Yearly', 'বার্ষিক': 'Annual' };
        const nameMapBn = { 'Pre-Test': 'প্রাক-নির্বাচনী', 'Test': 'নির্বাচনী', 'Half Yearly': 'অর্ধ-বার্ষিক', 'Annual': 'বার্ষিক' };
        if (forceLanguage === 'bn') {
            name = nameMapBn[name] || name;
        } else {
            name = nameMapEn[name] || name;
        }
    }

    if (name && year && !name.includes(year)) return `${name}-${year}`;
    return name || year;
  }, [examination, student, l.examinationTypes, forceLanguage]);

  if (shouldSkip) return null;

  const safeSchoolName = schoolName;
  const safeStudentName = (studentName || "N/A").toUpperCase();
  const safeFatherName = (forceLanguage === 'en' ? (student?.father_name_en || student?.father_name || "N/A") : (student?.father_name || student?.father_name_en || "N/A")).toUpperCase();
  const safeMotherName = (forceLanguage === 'en' ? (student?.mother_name_en || student?.mother_name || "N/A") : (student?.mother_name || student?.mother_name_en || "N/A")).toUpperCase();

  const translateSubject = (name) => {
    if (!name) return "";
    const nameStr = String(name);
    if (nameStr === 'Bangla (1st+2nd)') return forceLanguage === 'bn' ? 'বাংলা (১ম+২য়)' : 'Bangla (1st+2nd)';
    if (nameStr === 'English (1st+2nd)') return forceLanguage === 'bn' ? 'ইংরেজি (১ম+২য়)' : 'English (1st+2nd)';
    if (nameStr === 'Religion') return forceLanguage === 'bn' ? 'ধর্ম' : 'Religion';

    if (forceLanguage === 'en') {
      // 1. Normalize and Deep Clean
      const clean = nameStr
        .replace(/[\u200b-\u200d\ufeff\u00a0]/g, '') // Remove invisible characters
        .replace(/\s*\(.*?\)\s*/g, ' ')             // Remove parentheses and content
        .replace(/\s+/g, ' ')                        // Normalize spaces
        .trim();

      // 2. Exact Map Check (High Priority)
      if (SUB_MAP[clean]) return SUB_MAP[clean];

      // 3. Special Compound Subject Protection (Accounting, Home Science, etc.)
      const low = clean.toLowerCase();
      // Accounting check: if it has "হিসাব" AND ("বিজ্ঞান" OR "science" OR "studies")
      if ((low.includes('হিসাব') || low.includes('account')) &&
          (low.includes('বিজ্ঞান') || low.includes('science') || low.includes('studies'))) {
        return 'Accounting';
      }

      // Home Science / Agriculture check
      if ((low.includes('গার্হস্থ্য') || low.includes('home') || low.includes('কৃষি') || low.includes('agri')) &&
          (low.includes('বিজ্ঞান') || low.includes('science') || low.includes('education') || low.includes('study') || low.includes('শিক্ষা'))) {
        return 'Agriculture / Home Science';
      }

      if (low.includes('agriculture') || low.includes('home science')) return 'Agriculture / Home Science';

      // Business Entrepreneurship/Studies
      if ((low.includes('ব্যবসায়') || low.includes('ব্যবসায়') || low.includes('business')) &&
          (low.includes('উদ্যোগ') || low.includes('entrepreneurship'))) {
        return 'Business Entrepreneurship';
      }
      if ((low.includes('ব্যবসায়') || low.includes('ব্যবসায়') || low.includes('business')) &&
          (low.includes('শিক্ষা') || low.includes('studies'))) {
        return 'Business Studies';
      }

      if (low.includes('ফিন্যান্স') || low.includes('finance')) return 'Finance & Banking';
      if (low.includes('পৌরনীতি') || low.includes('civics')) return 'Civics & Citizenship';
      if (low.includes('ভূগোল') || low.includes('geography')) return 'Geography & Environment';
      if (low.includes('অর্থনীতি') || low.includes('economics')) return 'Economics';
      if (low.includes('ইতিহাস') || low.includes('history')) return 'History';

      let sName = clean;

      // 4. Paper/Part Translation
      sName = sName.replace(BN_TO_EN_PAPER_REGEX_1, '1st Paper').replace(BN_TO_EN_PAPER_REGEX_2, '2nd Paper');

      // 5. Basic Word Translation
      sName = sName.replace(/বাংলা(?!দেশ)/g, 'Bangla')
                   .replace(/বাংলাদেশ/g, 'Bangladesh')
                   .replace(/ইংরেজি/g, 'English')
                   .replace(/ইংরেজী/g, 'English')
                   .replace(/পদার্থ/g, 'Physics')
                   .replace(/রসায়ন|রসায়ন/g, 'Chemistry')
                   .replace(/জীববিজ্ঞান|জীব বিজ্ঞান/g, 'Biology')
                   .replace(/গণিত/g, 'Mathematics')
                   .replace(/ধর্ম/g, 'Religion')
                   .replace(/বিজ্ঞান/g, 'Science');

      // Standalone "বিজ্ঞান" replacement (safely)
      if (sName === 'বিজ্ঞান' || sName === 'সাধারণ বিজ্ঞান') return 'Science';

      // Fallback: If it still contains "বিজ্ঞান" but wasn't caught by compound rules
      if (sName.includes('বিজ্ঞান')) sName = sName.replace(/বিজ্ঞান/g, 'Science');

      return sName;
    }
    else if (forceLanguage === 'bn') {
      let sName = name;
      const lowName = String(sName).toLowerCase();
      if (lowName.includes('agriculture') || lowName.includes('home science') || lowName.includes('কৃষি') || lowName.includes('গার্হস্থ্য')) {
        return 'কৃষি / গার্হস্থ্য বিজ্ঞান';
      }

      const entries = Object.entries(SUB_MAP);
      for (const [bn, en] of entries) {
        if (String(sName).toLowerCase() === String(en).toLowerCase() || String(sName).toLowerCase() === String(bn).toLowerCase()) {
          sName = bn;
          break;
        }
        if (String(sName).toLowerCase().includes(en.toLowerCase()) && en.length > 5) {
          sName = bn;
          break;
        }
      }
      if (typeof sName === 'string') {
        sName = sName.replace(/1st Paper/gi, '১ম পত্র').replace(/2nd Paper/gi, '২য় পত্র');
        sName = sName.replace(/1st/gi, '১ম').replace(/2nd/gi, '২য়');
        sName = sName.replace(/Bangla/gi, 'বাংলা').replace(/English/gi, 'ইংরেজি');
      }
      return sName;
    }
    return name;
  };

  return (
    <Box className="result-card-container" sx={{
      width: 'calc(200mm + 55px)', height: 'calc(280mm - 5px)', mx: 'auto', bgcolor: '#fff4e5', position: 'relative',
      boxSizing: 'border-box', overflow: 'visible',
      boxShadow: 'none !important', filter: 'none !important', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
      borderWidth: '25px',
      borderStyle: 'solid',
      borderColor: 'transparent',
      borderImage: `${SVG_BORDER} 25 25 25 25 round`,
      transition: 'none !important',
      '& *': { transition: 'none !important' },
      '&::before': {
        content: '""', position: 'absolute',
        top: '-25px', left: '-50px', right: '-50px', bottom: '-25px',
        border: '1.5px solid #000',
        backgroundImage: `${SVG_BORDER.replace('%3Cg ', '%3Cg transform=\'scale(-1, 1) translate(-100, 0)\' ')}, ${SVG_BORDER.replace('%3Cg ', '%3Cg transform=\'scale(-1, 1) translate(-100, 0)\' ')}, linear-gradient(#000, #000), linear-gradient(#000, #000)`,
        backgroundSize: '25px 25px, 25px 25px, 1.5px 100%, 1.5px 100%',
        backgroundRepeat: 'repeat-y, repeat-y, no-repeat, no-repeat',
        backgroundPosition: 'left 0 top 0, right 0 top 0, left 25px top 0, right 25px top 0',
        pointerEvents: 'none', zIndex: 15
      },
      '&::after': { content: '""', position: 'absolute', top: '0px', left: '0px', right: '0px', bottom: '0px', border: '1.5px solid #000', pointerEvents: 'none', zIndex: 15 },
      '@media print': {
        margin: 'auto !important',
        paddingTop: '0mm !important',
        bgcolor: '#fff4e5 !important',
        height: 'calc(280mm - 5px) !important',
        width: 'calc(200mm + 55px) !important',
        boxShadow: 'none !important',
        filter: 'none !important',
        position: 'absolute !important',
        left: '0 !important',
        right: '0 !important',
        top: '0 !important',
        bottom: '0 !important',
        transform: 'none !important',
        pageBreakInside: 'avoid !important',
        breakInside: 'avoid-page !important',
        pageBreakAfter: 'always !important',
        borderImage: `${SVG_BORDER} 25 25 25 25 round !important`,
        borderWidth: '25px !important',
        borderStyle: 'solid !important',
        borderColor: 'transparent !important',
        overflow: 'visible !important'
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
          <Box sx={{ textAlign: 'center', mb: 0.5, mt: 1, height: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'visible' }}>
            <Typography className="school-name-header" sx={{
              fontSize: schoolFontSize,
              letterSpacing: schoolName.length > 30 ? '-1.0px' : 'normal',
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'visible',
              padding: '10px 0',
              '@media print': {
                fontSize: schoolFontSize,
                lineHeight: 1.3,
              }
            }}>{schoolName.toUpperCase()}</Typography>
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
                  <TableHead><TableRow sx={{ bgcolor: '#fff4e5' }}><TableCell align="center">{forceLanguage === 'bn' ? 'নম্বর' : 'Range'}</TableCell><TableCell align="center">{forceLanguage === 'bn' ? 'গ্রেড' : 'G'}</TableCell><TableCell align="center">{forceLanguage === 'bn' ? 'পয়েন্ট' : 'GP'}</TableCell></TableRow></TableHead>
                  <TableBody>{[ ['80-100','A+','5.0'],['70-79','A','4.0'],['60-69','A-','3.5'],['50-59','B','3.0'],['40-49','C','2.0'],['33-39','D','1.0'],['00-32','F','0.0'] ].map((r, i) => (
                      <TableRow key={i}><TableCell align="center">{n(r[0])}</TableCell><TableCell align="center">{r[1]}</TableCell><TableCell align="center">{n(r[2])}</TableCell></TableRow>
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
                      <Box sx={{ display: 'flex', mb: 0.8, alignItems: 'center', justifyContent: 'flex-start' }}><Typography sx={{ fontSize: '15px', minWidth: '80px', fontWeight: 'bold' }}>{isClassNineOrTen ? l.group : l.section}</Typography><Typography sx={{ fontSize: '15px', fontWeight: 'bold', fontStyle: 'italic' }}>: {isClassNineOrTen ? displayGroup : displaySection}</Typography></Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}><Typography sx={{ fontSize: '15px', minWidth: '80px', fontWeight: 'bold' }}>{l.rollNo}</Typography><Typography sx={{ fontSize: '15px', fontWeight: 'bold', fontStyle: 'italic' }}>: {n(parseInt(student.roll_number, 10) || student.roll_number)}</Typography></Box>
                  </Grid>
              </Grid>
          </Box>

          <TableContainer component={Paper} elevation={0} sx={{
            mb: 0.2,
            border: '1.5px solid #000',
            borderRadius: 0,
            bgcolor: 'transparent',
            boxShadow: 'none',
            overflow: 'hidden',
            '& table': { tableLayout: 'fixed', width: '100%' }
          }}>
            <Table size="small" sx={{
              borderCollapse: 'collapse',
              bgcolor: 'transparent',
              '& td, & th': {
                border: '1px solid #000 !important',
                py: displayResults.main.length > 12 ? 0.2 : 0.4,
                px: 0.5,
                fontSize: displayResults.main.length > 12 ? '10.5px' : '12px',
                lineHeight: 1.1
              }
            }}>
              <TableHead><TableRow sx={{ bgcolor: '#fff4e5' }}>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '30px' }}>Sl</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '135px' }}>{l.subjectName}</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '95px' }}>CQ</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '80px' }}>MCQ</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '35px' }}>PR</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '55px' }}>Total</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '40px' }}>Grade</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '40px' }}>GP</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', width: '90px' }}>GPA</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {displayResults.main.map((r, idx) => {
                  const sName = translateSubject(r.subject?.name || r.subject_name);
                  const isFail = r.grade === 'F';
                  return (
                    <TableRow key={r.id || idx}>
                      <TableCell align="center">{idx + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{sName}</TableCell>
                      <TableCell align="center" sx={{ color: isFail && r.spec?.cq > 0 ? 'red' : 'inherit' }}>{r.spec?.cq > 0 ? formatMark(r.written_marks) : '--'}</TableCell>
                      <TableCell align="center" sx={{ color: isFail && r.spec?.mcq > 0 ? 'red' : 'inherit' }}>{r.spec?.mcq > 0 ? formatMark(r.mcq_marks) : '--'}</TableCell>
                      <TableCell align="center" sx={{ color: isFail && r.spec?.pr > 0 ? 'red' : 'inherit' }}>{r.spec?.pr > 0 ? formatMark(r.practical_marks) : '--'}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', color: isFail ? 'red' : 'inherit' }}>{r.isActuallyAbsent ? formatMark(null) : formatMark(r.display_total ?? Math.round(r.total_obtained))}</TableCell>
                      <TableCell align="center" sx={{ color: isFail ? 'red' : 'inherit', fontWeight: 'bold' }}>{r.grade}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', color: isFail ? 'red' : 'inherit' }}>{n(r.gpa)}</TableCell>
                      {idx === 0 && (
                        <TableCell align="center" rowSpan={Math.max(1, displayResults.main.length + 1)} sx={{ fontWeight: 900, borderLeft: '1.5px solid #000 !important', verticalAlign: 'middle', color: '#000' }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: 'inherit' }}>{n(finalSummary.cgpa)}</Typography>
                            <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: 'inherit' }}>{finalSummary.grade}</Typography>
                            <Typography sx={{ fontWeight: 900, fontSize: '0.85rem', color: 'inherit', lineHeight: 1.1 }}>
                              {finalSummary.isPassed
                                ? `${l.merit}: ${n(overallResult?.rank_in_section ?? overallResult?.rank ?? '--')}`
                                : (forceLanguage === 'bn' ? 'ফলাফল: অনুত্তীর্ণ' : 'Result: Failed')}
                            </Typography>
                          </Box>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {displayResults.main.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4, fontStyle: 'italic', color: '#666' }}>No results available for the main subjects.</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 900, borderLeft: '1.5px solid #000 !important', verticalAlign: 'middle' }}>
                       <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                         <Typography sx={{ fontWeight: 900, fontSize: '1.2rem' }}>{n("0.00")}</Typography>
                         <Typography sx={{ fontWeight: 900, fontSize: '1.2rem' }}>F</Typography>
                         <Typography sx={{ fontWeight: 900, fontSize: '1.0rem' }}>{l.merit}: --</Typography>
                       </Box>
                    </TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell colSpan={5} align="right" sx={{ fontWeight: 'bold', fontSize: '13px' }}>{l.totalObtainedMarks}:</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: '13px' }}>{n(finalSummary.obtained)}</TableCell>
                  <TableCell colSpan={2}></TableCell>
                  {displayResults.main.length === 0 && <TableCell sx={{ borderLeft: '1.5px solid #000 !important' }}></TableCell>}
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          {isClassNineOrTen && (
            <>
              <Typography sx={{ fontWeight: 'bold', fontSize: '15px', mb: 0.5 }}>{l.optionalSubjectsTitle}</Typography>
              <TableContainer component={Paper} elevation={0} sx={{ mb: 0.5, border: '1.5px solid #000', borderRadius: 0, bgcolor: 'transparent', boxShadow: 'none' }}>
                <Table size="small" sx={{ '& td, & th': { border: '1px solid #000 !important', py: 0.5, px: 1, fontSize: '12px' } }}>
                  <TableBody>
                    {displayResults.optional.length > 0 ? displayResults.optional.map((r, idx) => {
                      const optName = translateSubject(r.subject?.name || r.subject_name);
                      const isFail = r.grade === 'F';
                      return (
                        <TableRow key={r.id || idx}>
                          <TableCell align="center" sx={{ width: '40px' }}>{n(displayResults.main.length + idx + 1)}</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>{optName}</TableCell>
                          <TableCell align="center" sx={{ width: '80px', fontWeight: 'bold', color: isFail ? 'red' : 'inherit' }}>{n(Math.round(r.total_obtained))}</TableCell>
                          <TableCell align="center" sx={{ width: '80px', fontWeight: 'bold', color: isFail ? 'red' : 'inherit' }}>{r.grade}</TableCell>
                          <TableCell align="center" sx={{ width: '80px', fontWeight: 'bold', color: isFail ? 'red' : 'inherit' }}>{n(r.gpa)}</TableCell>
                          <TableCell align="center" sx={{ width: '110px', fontWeight: 'bold', fontSize: '10px' }}>{parseFloat(r.gpa) > 2.0 ? `GP Above 2: ${n((parseFloat(r.gpa) - 2).toFixed(2))}` : '--'}</TableCell>
                        </TableRow>
                      );
                    }) : (
                      <TableRow><TableCell colSpan={6} align="center">{l.noOptionalSubject}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}

          {displayResults.coCurricular.length > 0 && (
            <>
              <Typography sx={{ fontWeight: 'bold', fontSize: '15px', mb: 0.5 }}>{l.coCurricularTitle}</Typography>
              <TableContainer component={Paper} elevation={0} sx={{ mb: 1, border: '1.5px solid #000', borderRadius: 0, bgcolor: 'transparent', boxShadow: 'none' }}>
                <Table size="small" sx={{ '& td, & th': { border: '1px solid #000 !important', py: 0.5, px: 1, fontSize: '12px' } }}>
                  <TableBody>{displayResults.coCurricular.map((r, idx) => {
                    const coName = translateSubject(r.subject?.name || r.subject_name);
                    const isFail = r.grade === 'F';
                    return (
                    <TableRow key={r.id || idx}>
                      <TableCell align="center" sx={{ width: '40px' }}>{n(displayResults.main.length + displayResults.optional.length + idx + 1)}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{coName}</TableCell>
                      <TableCell align="center" sx={{ width: '80px', fontWeight: 'bold', color: isFail ? 'red' : 'inherit' }}>{n(Math.round(r.total_obtained))}</TableCell>
                      <TableCell align="center" sx={{ width: '80px', fontWeight: 'bold', color: isFail ? 'red' : 'inherit' }}>{r.grade}</TableCell>
                      <TableCell align="center" sx={{ width: '80px', fontWeight: 'bold', color: isFail ? 'red' : 'inherit' }}>{n(r.gpa)}</TableCell>
                      <TableCell align="center" sx={{ width: '110px', fontWeight: 'bold', color: isFail ? 'red' : 'inherit' }}>{r.is_passed ? l.passed : l.failed}</TableCell>
                    </TableRow>
                  );})}</TableBody>
                </Table>
              </TableContainer>
            </>
          )}

          {/* Attendance Summary */}
          {studentData?.attendance_summary && (
            <Box sx={{ mt: 1, mb: 1, border: '1.5px solid #000', p: 1, borderRadius: 0, bgcolor: '#fdfaea' }}>
              <Typography sx={{ fontWeight: 'bold', fontSize: '14px', mb: 0.5, textDecoration: 'underline', color: '#000', display: 'block' }}>
                {forceLanguage === 'bn' ? 'হাজিরা সংক্রান্ত তথ্য:' : 'Attendance Information:'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 4 }}>
                <Typography sx={{ fontSize: '13px', color: '#000' }}>
                  {forceLanguage === 'bn' ? 'মোট উপস্থিতি:' : 'Total Presence:'} <b>{n(studentData.attendance_summary.total_present ?? 0)}</b>
                </Typography>
                <Typography sx={{ fontSize: '13px', color: '#000' }}>
                  {forceLanguage === 'bn' ? 'মোট অনুপস্থিতি:' : 'Total Absence:'} <b>{n(studentData.attendance_summary.total_absent ?? 0)}</b>
                </Typography>
              </Box>
            </Box>
          )}

          <Box className="result-card-signatures" sx={{
            position: 'relative',
            mt: 'auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            px: 2,
            pb: 0,
            mb: '160px',
            zIndex: 20,
            '@media print': {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: '45mm',
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
