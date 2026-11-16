import React from 'react';
import api from '../utils/api';
import { Box, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import QRCode from 'qrcode.react';

function AdmissionCard({ data, school, exam, examSlots = [] }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const user = data?.user || {};
  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
  const className = data?.classroom?.name || 'N/A';
  const section = data?.section?.name ? `(${data.section.name})` : '';
  const rollNumber = data?.roll_number || 'N/A';

  // Process photo URL
  const processPhotoUrl = (url) => {
    if (!url) return null;
    if (typeof url !== 'string') return url;
    if (url.startsWith('http')) return url;
    const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
    if (url.startsWith('/media/')) return `${base}${url}`;
    if (url.startsWith('media/')) return `${base}/${url}`;
    return `${base}/media/${url.replace(/^\/+|\/+$/g, '')}`;
  };

  const schoolLogo = (() => {
    const raw = school?.logo || school?.image || school?.logo_url || school?.school_logo || data?.school_logo;
    return processPhotoUrl(raw);
  })();

  const userPhoto = processPhotoUrl(user.photo_url || user.photo || data?.photo);
  const signatureUrl = (() => {
    const processed = processPhotoUrl(school?.principal_signature);
    if (processed) return processed;
    try {
      if (school?.id && String(school.id) === '19') {
        const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/g, '');
        return `${base}/media/BHS/signature.png`;
      }
    } catch (_) {}
    return null;
  })();

  const schoolSealUrl = processPhotoUrl(school?.school_seal) || null;

  // QR Code data for attendance. Only the student id is encoded: the scan
  // handler in AttendancePageNew reads just parts[1], and a short ASCII payload
  // keeps the QR at a low version, so dozens of cards render and print far
  // faster than when the (Bengali) name and school id were included.
  const qrData = `STU|${data?.id}`;

  const toBnDigits = (v) => {
    return String(v ?? '').replace(/[0-9]/g, d => ['০','১','২','৩','৪','৫','৬','৭','৮','৯'][d]);
  };

  const getExamTypeBn = () => {
    const raw = String(exam?.name || exam?.exam_type || '').toLowerCase();
    if (/(প্রাক|pre)/.test(raw)) return 'প্রাক নির্বাচনী';
    if (/(half|mid|অর্ধ)/.test(raw)) return 'অর্ধ-বার্ষিক';
    if (/(annual|final|yearly|বার্ষিক)/.test(raw)) return 'বার্ষিক';
    if (/(terminal|term|টার্মিনাল)/.test(raw)) return 'টার্মিনাল';
    if (/(model|মডেল)/.test(raw)) return 'মডেল টেস্ট';
    if (/(test|টেস্ট|বিশেষ)/.test(raw)) return 'বিশেষ মূল্যায়ন';
    return exam?.name || '';
  };

  const getExamYearBn = () => {
    const yr =
      (exam?.academic_year && parseInt(exam.academic_year, 10)) ||
      (exam?.start_date && (() => { const d = new Date(exam.start_date); return d.getFullYear(); })()) ||
      new Date().getFullYear();
    return toBnDigits(yr);
  };

  const getExamTitleBn = () => {
    let typeStr = (getExamTypeBn() || '').trim();
    // Remove duplicate/trailing "পরীক্ষা"
    typeStr = typeStr.replace(/\s*পরীক্ষা\s*$/i, '');
    if (typeStr) {
      return `${typeStr} পরীক্ষা-${getExamYearBn()}খ্রিঃ`;
    }
    return `পরীক্ষা-${getExamYearBn()}খ্রিঃ`;
  };

  const schoolName = school?.bn_name || school?.name || '';

  const resolveGroupStr = (g) => {
    const s = String(g || '').toLowerCase();
    if (s.includes('science') || s.includes('বিজ্ঞান')) return 'science';
    if (s.includes('commerce') || s.includes('business') || s.includes('ব্যবসায়') || s.includes('ব্যবসায়') || s.includes('ব্যবসা')) return 'commerce';
    if (s.includes('arts') || s.includes('humanities') || s.includes('মানবিক')) return 'humanities';
    return '';
  };

  const SCI_KW = /physics|chemistry|biology|higher math|পদার্থ|রসায়ন|রসায়|জীব|উচ্চতর|বাংলাদেশ\s*ও\s*বিশ্ব|bgs/i;
  const GEN_SCI_KW = /^বিজ্ঞান$|^সাধারণ\s*বিজ্ঞান$|^science$|^general\s*science$/i;
  const COM_KW = /accounting|finance|entrepreneurship|business|ব্যবসায়|ব্যবসায়|ব্যবসা|হিসাব|ফিন্যান্স/i;
  const HUM_KW = /history|geography|civics|economics|ইতিহাস|ভূগোল|ভুগোল|পৌরনীতি|পৌরণীতি|অর্থনীতি/i;
  const AGRI_KW = /কৃষি|agri|গার্হস্থ্য|home/i;

  const classifyPart = (part) => {
    const s = String(part || '').trim();
    if (!s) return null;
    if (AGRI_KW.test(s)) return 'agri';
    if (SCI_KW.test(s)) return 'science';
    if (GEN_SCI_KW.test(s)) return 'general_science';
    if (COM_KW.test(s)) return 'commerce';
    if (HUM_KW.test(s)) return 'humanities';
    return null;
  };

  const isCivicsName = (name) => /civics|পৌরনীতি|পৌরণীতি|নাগরিকতা/i.test(String(name || ''));
  const isEconName = (name) => /economics|অর্থনীতি|অর্থ\s*নীতি/i.test(String(name || ''));
  const isAgriName = (name) => /agri|agriculture|কৃষি/i.test(String(name || ''));
  const isHomeName = (name) => /home\s*science|home\s*economics|গার্হস্থ্য/i.test(String(name || ''));

  const getEffectiveSubjectForGroup = (subjectName, group) => {
    const name = String(subjectName || '').trim();
    if (!name) return '';

    if (isCivicsName(name) && isEconName(name)) {
      return 'পৌরনীতি ও নাগরিকতা/অর্থনীতি';
    }
    if (isAgriName(name) && isHomeName(name)) {
      return 'কৃষি শিক্ষা/গার্হস্থ্য বিজ্ঞান';
    }

    if (!name.includes('/')) return name;
    const parts = name.split(/\s*\/\s*/).filter(Boolean);
    const g = resolveGroupStr(group);

    const hasAgri = parts.some(p => AGRI_KW.test(p));
    const hasHigherMath = parts.some(p => /উচ্চতর|higher/i.test(p));
    if (hasAgri && hasHigherMath) {
      if (!g) return name;
      if (g === 'science') {
        return parts.find(p => /উচ্চতর|higher/i.test(p)) || parts[0];
      } else {
        return parts.find(p => AGRI_KW.test(p)) || parts[0];
      }
    }

    if (!g) return name;
    for (const p of parts) {
      const c = classifyPart(p);
      if (c === g || c === 'agri') return p;
      if (c === 'general_science' && (g === 'commerce' || g === 'humanities')) return p;
    }
    return parts[0] || name;
  };

  const getStudentGroup = (student) => {
    const g = String(student?.student_group || student?.group || '').toLowerCase();
    if (!g) return null;

    if (g.includes('sci') || g.includes('বিজ্ঞান')) return 'science';
    if (g.includes('com') || g.includes('bus') || g.includes('ব্যবসায়') || g.includes('ব্যবসায়')) return 'commerce';
    if (g.includes('art') || g.includes('hum') || g.includes('মানবিক')) return 'humanities';

    return null;
  };

  const isSubjectMatchingStudent = (slot, student) => {
    if (!slot) return false;
    const subjName = (slot.subject_name || slot.subject?.name || '').trim();
    if (!subjName) return false;

    const group = getStudentGroup(student);
    if (!group) return true;

    if (subjName.includes('/')) {
      if (!group) return true;
      const parts = subjName.split(/\s*\/\s*/).filter(Boolean);
      const hasAgri = parts.some(p => AGRI_KW.test(p));
      const hasHigherMath = parts.some(p => /উচ্চতর|higher/i.test(p));
      if (hasAgri && hasHigherMath) return true;
      if (hasAgri && !hasHigherMath && group === 'science') return false;
      return parts.some(p => {
        const c = classifyPart(p);
        if (c === group || c === 'agri') return true;
        if (c === 'general_science' && (group === 'commerce' || group === 'humanities')) return true;
        return false;
      });
    }

    if (!group) return true; // General class without stream/group

    const name = subjName.toLowerCase();
    const optionalName = String(
      student?.optional_subject?.name || student?.optional_subject_name || ''
    ).toLowerCase();

    // Science specific subjects
    const isScienceSubject = /physics|chemistry|biology|পদার্থ|রসায়|রসায়|জীব|উচ্চতর|higher\s*math/i.test(name);

    // Commerce specific subjects
    const isCommerceSubject = /accounting|finance|business|entrepreneurship|হিসাব|হিশাব|ব্যবসায়|ব্যবসায়|ব্যবসা|ফিন্যান্স|ফাইনান্স|কারবার/i.test(name);

    // Humanities/Arts specific subjects
    const isHumanitiesSubject = /history|geography|civics|economics|sociology|logic|ইতিহাস|বিশ্বসভ্যতা|ভ[ূু]গোল|পৌর|নাগরিকতা|অর্থ\s*নীতি|অর্থনীতি|সমাজ|যুক্তিবিদ্যা|দর্শন/i.test(name);

    // General Science (বিজ্ঞান) vs BGS (বাংলাদেশ ও বিশ্বপরিচয়)
    const isGeneralScience = /^বিজ্ঞান$|^science$/i.test(name.trim()) || (/বিজ্ঞান/i.test(name) && !/পদার্থ|রসায়|রসায়|জীব|হিসাব|হিশাব|পৌর|ইতিহাস|ভ[ূু]গোল/i.test(name));
    const isBGS = /bgs|bangladesh\s*&\s*global|বাংলাদেশ\s*ও\s*বিশ্বপরিচয়|বাংলাদেশ\s*ও\s*বিশ্বপরিচয়|বাংলাদেশ\s*ও\s*বিশ্ব/i.test(name);

    if (group === 'commerce') {
      if (isScienceSubject) return false;
      if (isHumanitiesSubject) return false;
      if (isBGS && !isGeneralScience) return false;
      return true;
    }

    if (group === 'science') {
      if (isCommerceSubject) return false;
      if (isHumanitiesSubject) return false;
      if (isGeneralScience) return false;

      const isAgriOrHome = /কৃষি|agri|গার্হস্থ্য|home/i.test(name);
      if (isAgriOrHome) {
        if (!optionalName || (!optionalName.includes('কৃষি') && !optionalName.includes('agri') && !optionalName.includes('গার্হস্থ্য') && !optionalName.includes('home'))) {
          return false;
        }
      }

      return true;
    }

    if (group === 'humanities') {
      if (isScienceSubject) return false;
      if (isCommerceSubject) return false;
      if (isBGS) return false;
      return true;
    }

    return true;
  };

  // Filter slots to match student's classroom, section, stream/group, and examination
  const studentClassroomId = data?.classroom?.id;
  const studentSectionId = data?.section?.id;
  const selectedExamId = exam?.id || (typeof exam === 'object' ? exam?.id : exam);

  const filteredSlots = examSlots.filter(slot => {
    const slotExamId = slot.examination?.id || slot.examination;
    const examMatch = !selectedExamId || !slotExamId || String(slotExamId) === String(selectedExamId);
    const classroomMatch = !slot.classroom || String(slot.classroom?.id || slot.classroom) === String(studentClassroomId);
    const sectionMatch = !slot.section || String(slot.section?.id || slot.section) === String(studentSectionId);
    const groupMatch = isSubjectMatchingStudent(slot, data);
    return examMatch && classroomMatch && sectionMatch && groupMatch;
  });

  const studentGroup = getStudentGroup(data);

  // Group slots by (exam_date, start_time) to combine Civics/Economics or Agri/Home Science
  // occurring on the exact same date and time slot.
  const slotsByDateTime = {};
  for (const slot of filteredSlots) {
    const dateKey = String(slot.exam_date || '').trim();
    const timeKey = String(slot.start_time || '').trim();
    const key = `${dateKey}_${timeKey}`;
    if (!slotsByDateTime[key]) {
      slotsByDateTime[key] = [];
    }
    slotsByDateTime[key].push(slot);
  }

  const processedSlots = [];
  for (const key of Object.keys(slotsByDateTime)) {
    let slotsInGroup = [...slotsByDateTime[key]];

    const isCivicsOnly = (n) => isCivicsName(n) && !isEconName(n);
    const isEconOnly = (n) => isEconName(n) && !isCivicsName(n);
    const isAgriOnly = (n) => isAgriName(n) && !isHomeName(n);
    const isHomeOnly = (n) => isHomeName(n) && !isAgriName(n);

    const getSlotName = (s) => s.subject_name || s.subject?.name;

    // Merge Civics and Economics if both present at same date/time
    const civicsIdx = slotsInGroup.findIndex(s => isCivicsOnly(getSlotName(s)));
    const econIdx = slotsInGroup.findIndex(s => isEconOnly(getSlotName(s)));

    if (civicsIdx !== -1 && econIdx !== -1 && civicsIdx !== econIdx) {
      const baseSlot = slotsInGroup[civicsIdx];
      const mergedSlot = {
        ...baseSlot,
        subject_name: 'পৌরনীতি ও নাগরিকতা/অর্থনীতি',
        subject: {
          ...(baseSlot.subject || {}),
          name: 'পৌরনীতি ও नागरिकতা/অর্থনীতি'
        }
      };
      const firstIdx = Math.min(civicsIdx, econIdx);
      const secondIdx = Math.max(civicsIdx, econIdx);
      slotsInGroup.splice(secondIdx, 1);
      slotsInGroup.splice(firstIdx, 1, mergedSlot);
    }

    // Merge Agriculture and Home Science if both present at same date/time
    const agriIdx = slotsInGroup.findIndex(s => isAgriOnly(getSlotName(s)));
    const homeIdx = slotsInGroup.findIndex(s => isHomeOnly(getSlotName(s)));

    if (agriIdx !== -1 && homeIdx !== -1 && agriIdx !== homeIdx) {
      const baseSlot = slotsInGroup[agriIdx];
      const mergedSlot = {
        ...baseSlot,
        subject_name: 'কৃষি শিক্ষা/গার্হস্থ্য বিজ্ঞান',
        subject: {
          ...(baseSlot.subject || {}),
          name: 'কৃষি শিক্ষা/গার্হস্থ্য বিজ্ঞান'
        }
      };
      const firstIdx = Math.min(agriIdx, homeIdx);
      const secondIdx = Math.max(agriIdx, homeIdx);
      slotsInGroup.splice(secondIdx, 1);
      slotsInGroup.splice(firstIdx, 1, mergedSlot);
    }

    processedSlots.push(...slotsInGroup);
  }

  const seenSubjects = new Set();
  const uniqueFilteredSlots = [];
  for (const slot of processedSlots) {
    const effName = getEffectiveSubjectForGroup(slot.subject_name || slot.subject?.name, studentGroup).trim().toLowerCase();
    const key = `${slot.exam_date || ''}_${effName}`;
    if (!seenSubjects.has(key)) {
      seenSubjects.add(key);
      uniqueFilteredSlots.push(slot);
    }
  }
  const finalSlots = uniqueFilteredSlots;

  // Sort slots chronologically
  finalSlots.sort((a, b) => {
    const dateA = a.exam_date || '';
    const dateB = b.exam_date || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const timeA = a.start_time || '';
    const timeB = b.start_time || '';
    return timeA.localeCompare(timeB);
  });

  const numRows = Math.ceil(finalSlots.length / 2);
  const isCompact = finalSlots.length > 6 || numRows > 3;
  const isUltraCompact = finalSlots.length > 10 || numRows > 5;

  const formatBnDigits = (str) => {
    return String(str ?? '').replace(/[0-9]/g, d => ['০','১','২','৩','৪','৫','৬','৭','৮','৯'][d]);
  };

  const formatSingleTime = (timeStr) => {
    if (!timeStr) return '';
    const parts = String(timeStr).trim().split(':');
    if (parts.length < 2) return timeStr;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return timeStr;

    let period = 'সকাল';
    if (h < 6) period = 'রাত';
    else if (h >= 6 && h < 12) period = 'সকাল';
    else if (h >= 12 && h < 15) period = 'দুপুর';
    else if (h >= 15 && h < 18) period = 'বিকাল';
    else if (h >= 18 && h < 20) period = 'সন্ধ্যা';
    else period = 'রাত';

    const h12 = h % 12 === 0 ? 12 : h % 12;
    const hBn = formatBnDigits(h12);
    const mBn = formatBnDigits(String(m).padStart(2, '0'));

    return `${period} ${hBn}:${mBn} টা`;
  };

  const getExamTimeRangeStr = () => {
    const primarySlot = finalSlots.length > 0 ? finalSlots[0] : null;
    let startTime = primarySlot?.start_time || exam?.start_time;
    let endTime = primarySlot?.end_time || exam?.end_time;

    if (!startTime) {
      if (String(school?.id) === '19') {
        return 'সময়: সকাল ১০ঃ০০ টা থেকে দুপুর ১ঃ০০ টা';
      }
      return null;
    }

    if (!endTime) {
      const parts = String(startTime).trim().split(':');
      if (parts.length >= 2) {
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(h) && !isNaN(m)) {
          const endH = (h + 3) % 24;
          endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
        }
      }
    }

    const startFormatted = formatSingleTime(startTime);
    const endFormatted = endTime ? formatSingleTime(endTime) : '';

    if (startFormatted && endFormatted) {
      return `সময়: ${startFormatted} থেকে ${endFormatted}`;
    } else if (startFormatted) {
      return `সময়: ${startFormatted}`;
    }
    return null;
  };

  return (
    <Box 
      key={`admission-card-${rollNumber || 'unknown'}`}
      className="admission-card" 
      sx={{
        background: 'linear-gradient(145deg, #f8f9ff 0%, #f0f4ff 100%)',
        borderRadius: '10px',
        color: '#1a237e',
        width: '100%',
        maxWidth: { xs: '100%', sm: '680px' }, // Responsive width
        boxShadow: '0 4px 15px rgba(26, 35, 126, 0.1)',
        position: 'relative',
        fontFamily: "'NikoshBAN', 'Times New Roman', Times, serif",
        border: '1.5px solid #1a237e',
        p: { xs: 0.5, sm: isUltraCompact ? 0.5 : isCompact ? 0.8 : 1.0 }, // Dynamic padding
        lineHeight: 1.45,
        display: 'block',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        boxSizing: 'border-box',
        overflow: 'visible', // Avoid clipping content
        '&:hover': {
          boxShadow: '0 6px 20px rgba(26, 35, 126, 0.12)',
        }
      }}
    >
      {/* Header with Logo and Student Photo */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: isUltraCompact ? 0.3 : isCompact ? 0.45 : 0.6,
        padding: { xs: '5px', sm: isUltraCompact ? '5px 7px' : isCompact ? '7px 9px' : '9px 12px' },
        backgroundColor: 'white',
        borderBottom: '2px solid #1a237e',
        borderRadius: '6px',
        color: '#1a237e',
        position: 'relative',
        zIndex: 2,
        gap: { xs: 0.5, sm: 1 }
      }}>
        {/* QR Code */}
        <Box sx={{
          width: { xs: '70px', sm: isUltraCompact ? '74px' : isCompact ? '84px' : '96px' },
          height: { xs: '70px', sm: isUltraCompact ? '74px' : isCompact ? '84px' : '96px' },
          border: '1.5px solid #1a237e',
          borderRadius: '5px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'white',
          p: 0.2
        }}>
          <QRCode
            renderAs="svg"
            value={qrData}
            size={isMobile ? 65 : (isUltraCompact ? 68 : isCompact ? 78 : 88)}
            level="H"
          />
        </Box>
        
        {/* School Info */}
        <Box sx={{ textAlign: 'center', flex: 1, px: { xs: 0.5, sm: 1 }, minWidth: 0 }}>
          <Typography sx={{
            fontWeight: 'bold', 
            fontSize: schoolName.length > 35
              ? { xs: '0.9rem', sm: isUltraCompact ? '1.0rem' : isCompact ? '1.1rem' : '1.2rem' }
              : schoolName.length > 25
              ? { xs: '0.95rem', sm: isUltraCompact ? '1.08rem' : isCompact ? '1.22rem' : '1.36rem' }
              : schoolName.length > 18
              ? { xs: '1.0rem', sm: isUltraCompact ? '1.15rem' : isCompact ? '1.3rem' : '1.48rem' }
              : { xs: '1.05rem', sm: isUltraCompact ? '1.27rem' : isCompact ? '1.4rem' : '1.58rem' },
            lineHeight: 1.35,
            pt: '1px',
            pb: '1px',
            color: '#000',
            mb: 0.1,
            wordBreak: 'break-word',
            whiteSpace: 'normal',
            overflow: 'visible'
          }}>
            {schoolName}
          </Typography>
          <Typography sx={{
            fontSize: { xs: '1.5rem', sm: isUltraCompact ? '1.75rem' : isCompact ? '1.95rem' : '2.2rem' },
            fontWeight: '900',
            color: '#1a237e',
            my: 0.05,
            lineHeight: 1.3,
            letterSpacing: '0.5px'
          }}>
            প্রবেশপত্র
          </Typography>
          <Typography sx={{
            fontSize: { xs: '1.0rem', sm: isUltraCompact ? '1.08rem' : isCompact ? '1.2rem' : '1.32rem' },
            fontWeight: 700,
            lineHeight: 1.35,
            pt: '1px',
            pb: '1px',
            color: '#000',
            whiteSpace: 'nowrap'
          }}>
            {getExamTitleBn()}
          </Typography>
        </Box>
        
        {/* Student Photo */}
        <Box sx={{
          width: { xs: '70px', sm: isUltraCompact ? '74px' : isCompact ? '84px' : '96px' },
          height: { xs: '84px', sm: isUltraCompact ? '88px' : isCompact ? '100px' : '116px' },
          border: '1.5px solid #1a237e',
          borderRadius: '5px',
          overflow: 'hidden',
          backgroundColor: '#f5f5f5',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
        }}>
          {userPhoto ? (
            <img
              src={userPhoto}
              alt="S"
              decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                if (schoolLogo) e.target.src = schoolLogo;
              }}
            />
          ) : (
            schoolLogo ? (
              <img
                src={schoolLogo}
                alt="School Logo"
                decoding="async"
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}
              />
            ) : (
              <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>Photo</Typography>
            )
          )}
        </Box>
      </Box>

      {/* Middle Section Wrapper with Watermark */}
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        {schoolLogo && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '100%', // Increased to full width of the section
              height: '100%',
              opacity: 0.35, // Increased clarity
              zIndex: 0,
              pointerEvents: 'none',
              backgroundImage: `url("${schoolLogo}")`,
              backgroundSize: '85% auto',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact',
              filter: 'grayscale(0%)', // Ensure no filter is making it blurry
              imageRendering: 'auto'
            }}
          />
        )}

        {/* Student Info */}
        <Box sx={{
          mb: isUltraCompact ? 0.35 : isCompact ? 0.5 : 0.7,
          padding: isUltraCompact ? '5px 8px' : isCompact ? '7px 10px' : '10px 12px',
          backgroundColor: 'rgba(255,255,255,0.75)',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          position: 'relative',
          zIndex: 1
        }}>
          <Typography variant="h6" sx={{
              fontWeight: 'bold',
              fontSize: isUltraCompact ? '1.4rem' : isCompact ? '1.58rem' : '1.8rem',
              textAlign: 'center',
              mb: isUltraCompact ? 0.2 : isCompact ? 0.3 : 0.5,
              lineHeight: 1.4,
              pb: 0.1
            }}>
              {name || 'শিক্ষার্থীর নাম'}
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, sm: isUltraCompact ? 1.5 : 2.5 }, justifyContent: 'center' }}>
              <Typography variant="body1" sx={{ fontSize: isUltraCompact ? '1.2rem' : isCompact ? '1.3rem' : '1.45rem', lineHeight: 1.4, pb: 0.1 }}>
                <strong>Roll:</strong> {rollNumber || 'রোল'}
              </Typography>
              <Typography variant="body1" sx={{ fontSize: isUltraCompact ? '1.2rem' : isCompact ? '1.3rem' : '1.45rem', lineHeight: 1.4, pb: 0.1 }}>
                <strong>Class:</strong> {className && className !== 'N/A' ? `${className} ${section}` : 'শ্রেণি'}
              </Typography>
          </Box>
        </Box>

        {/* Exam Details */}
        {(() => {
          const examDetailsP = isUltraCompact ? 0.7 : isCompact ? 1.0 : 1.4;
          const examDetailsMb = isUltraCompact ? 0.4 : isCompact ? 0.7 : 1.0;
          const routineTitleMb = isUltraCompact ? 0.2 : isCompact ? 0.35 : 0.5;
          const routineTitlePb = isUltraCompact ? 0.2 : isCompact ? 0.4 : 0.6;
          const headerPy = isUltraCompact ? 0.45 : isCompact ? 0.65 : 0.9;
          const headerFontSize = isUltraCompact ? '11.6px !important' : isCompact ? '12.6px !important' : '13.8px !important';
          const rowPy = isUltraCompact ? 0.3 : isCompact ? 0.45 : 0.6;
          const rowPtPb = isUltraCompact ? '3.2px' : isCompact ? '4.8px' : '7.0px';
          const rowLineHeight = isUltraCompact ? 1.5 : isCompact ? 1.65 : 1.85;
          const rowFontSize = isUltraCompact ? '11.2px !important' : isCompact ? '12.4px !important' : '13.6px !important';
          const timeFontSize = isUltraCompact ? '1.02rem' : isCompact ? '1.1rem' : '1.22rem';
          const routineTitleFontSize = isUltraCompact ? '1.15rem' : isCompact ? '1.24rem' : '1.36rem';

          return (
            <Box sx={{
              mb: examDetailsMb,
              border: '1.5px solid #d1d9ff',
              borderRadius: '8px',
              p: examDetailsP,
              backgroundColor: 'rgba(248, 249, 255, 0.75)',
              boxShadow: '0 2px 8px rgba(26, 35, 126, 0.05)',
              position: 'relative',
              zIndex: 1
            }}>
              <Typography variant="h6" sx={{
                  fontWeight: 'bold',
                  mb: routineTitleMb,
                  textAlign: 'center',
                  borderBottom: '2px solid #e0e0e0',
                  pb: routineTitlePb,
                  fontSize: routineTitleFontSize,
                  lineHeight: 1.5
                }}>
                  পরীক্ষার রুটিনঃ
                </Typography>

                {(() => {
                  const timeStr = getExamTimeRangeStr();
                  if (!timeStr) return null;
                  return (
                    <Typography sx={{
                      textAlign: 'center',
                      fontSize: timeFontSize,
                      fontWeight: 'bold',
                      color: '#1a237e',
                      mb: isUltraCompact ? 0.2 : isCompact ? 0.35 : 0.6,
                      lineHeight: 1.4
                    }}>
                      {timeStr}
                    </Typography>
                  );
                })()}

              {/* Exam Routine Table - Four Columns */}
              {finalSlots.length === 0 ? (
                <Typography variant="body1" sx={{ textAlign: 'center', color: '#757575', fontSize: '0.95rem' }}>
                  রুটিন পাওয়া যায়নি
                </Typography>
              ) : (
                (() => {
                  // Helper to format date with English digits and full year
                  const formatDate = (dateStr) => {
                    if (!dateStr) return '-';
                    const parts = String(dateStr).split('-');
                    if (parts.length < 3) return dateStr;
                    const year = parseInt(parts[0], 10);
                    const month = parseInt(parts[1], 10);
                    const day = parseInt(parts[2], 10);
                    const dayEn = String(day).padStart(2, '0');
                    const monthEn = String(month).padStart(2, '0');
                    return `${dayEn}/${monthEn}/${year}`;
                  };

                  // Column-first row rendering
                  const numRows = Math.ceil(finalSlots.length / 2);

                  return (
                    <Box sx={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 1.6fr 1.2fr 1.6fr',
                      gridAutoRows: 'auto',
                      gap: 0.2,
                      border: '1px solid #e0e8ff',
                      borderRadius: '4px',
                      overflow: 'visible',
                      fontSize: '12px !important'
                    }}>
                      {/* Header */}
                      <Box sx={{
                        backgroundColor: '#1a237e',
                        color: 'white',
                        py: headerPy,
                        px: 0.2,
                        fontWeight: 'bold',
                        textAlign: 'center',
                        fontSize: headerFontSize,
                        lineHeight: 1.5
                      }}>
                        তারিখ
                      </Box>
                      <Box sx={{
                        backgroundColor: '#1a237e',
                        color: 'white',
                        py: headerPy,
                        px: 0.2,
                        fontWeight: 'bold',
                        textAlign: 'center',
                        fontSize: headerFontSize,
                        lineHeight: 1.5
                      }}>
                        বিষয়
                      </Box>
                      <Box sx={{
                        backgroundColor: '#1a237e',
                        color: 'white',
                        py: headerPy,
                        px: 0.2,
                        fontWeight: 'bold',
                        textAlign: 'center',
                        fontSize: headerFontSize,
                        lineHeight: 1.5
                      }}>
                        তারিখ
                      </Box>
                      <Box sx={{
                        backgroundColor: '#1a237e',
                        color: 'white',
                        py: headerPy,
                        px: 0.2,
                        fontWeight: 'bold',
                        textAlign: 'center',
                        fontSize: headerFontSize,
                        lineHeight: 1.5
                      }}>
                        বিষয়
                      </Box>

                      {/* Column-first Rows */}
                      {(() => {
                        const studentGroup = getStudentGroup(data);
                        const rows = [];
                        for (let r = 0; r < numRows; r++) {
                          const slot1 = finalSlots[r];
                          const slot2 = finalSlots[r + numRows];
                          const subName1 = getEffectiveSubjectForGroup(slot1?.subject_name || slot1?.subject?.name, studentGroup);
                          const subName2 = getEffectiveSubjectForGroup(slot2?.subject_name || slot2?.subject?.name, studentGroup);
                          rows.push(
                            <React.Fragment key={`row-${r}`}>
                              <Box sx={{
                                py: rowPy,
                                px: 0.2,
                                backgroundColor: r % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(248,249,255,0.6)',
                                textAlign: 'center',
                                borderBottom: '0.5px solid #e0e8ff',
                                fontFamily: "'NikoshBAN', 'Times New Roman', Times, serif"
                              }}>
                                <Box sx={{ fontWeight: '600', fontSize: rowFontSize, whiteSpace: 'nowrap', lineHeight: rowLineHeight, pt: rowPtPb, pb: rowPtPb }}>
                                  {slot1 ? formatDate(slot1.exam_date) : ''}
                                </Box>
                              </Box>
                              <Box sx={{
                                py: rowPy,
                                px: 0.2,
                                backgroundColor: r % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(248,249,255,0.6)',
                                textAlign: 'center',
                                borderBottom: '0.5px solid #e0e8ff'
                              }}>
                                <Box sx={{ fontWeight: '600', fontSize: rowFontSize, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: rowLineHeight, pt: rowPtPb, pb: rowPtPb }}>
                                  {subName1}
                                </Box>
                              </Box>
                              <Box sx={{
                                py: rowPy,
                                px: 0.2,
                                backgroundColor: r % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(248,249,255,0.6)',
                                textAlign: 'center',
                                borderBottom: '0.5px solid #e0e8ff',
                                fontFamily: "'NikoshBAN', 'Times New Roman', Times, serif"
                              }}>
                                <Box sx={{ fontWeight: '600', fontSize: rowFontSize, whiteSpace: 'nowrap', lineHeight: rowLineHeight, pt: rowPtPb, pb: rowPtPb }}>
                                  {slot2 ? formatDate(slot2.exam_date) : ''}
                                </Box>
                              </Box>
                              <Box sx={{
                                py: rowPy,
                                px: 0.2,
                                backgroundColor: r % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(248,249,255,0.6)',
                                textAlign: 'center',
                                borderBottom: '0.5px solid #e0e8ff'
                              }}>
                                <Box sx={{ fontWeight: '600', fontSize: rowFontSize, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: rowLineHeight, pt: rowPtPb, pb: rowPtPb }}>
                                  {subName2}
                                </Box>
                              </Box>
                            </React.Fragment>
                          );
                        }
                        return rows;
                      })()}
                    </Box>
                  );
                })()
              )}
            </Box>
          );
        })()}
      </Box>

      {/* Instructions Section */}
      <Box sx={{
        mt: isUltraCompact ? 0.2 : isCompact ? 0.3 : 0.5,
        p: isUltraCompact ? '4px 6px' : isCompact ? '5px 8px' : '7px 10px',
        backgroundColor: 'rgba(240, 244, 255, 0.9)',
        borderRadius: '6px',
        position: 'relative',
        zIndex: 1
      }}>
        <Typography variant="subtitle1" sx={{ 
            fontWeight: 'bold', 
            mb: 0.05,
            color: '#1a237e',
            textAlign: 'center',
            fontSize: isUltraCompact ? '12.6px !important' : isCompact ? '13.8px !important' : '15.4px !important',
            lineHeight: 1.35
          }}>
            নির্দেশনা
          </Typography>
          <Box component="ol" sx={{ 
            px: 0.5,
            m: 0,
            pl: 2,
            fontSize: isUltraCompact ? '11.6px !important' : isCompact ? '12.6px !important' : '14.2px !important',
            lineHeight: 1.5,
            color: '#333',
            textAlign: 'left'
          }}>
            <li>পরীক্ষাকালে কোন প্রকার বই, খাতা, হ্যান্ডনোট, ইলেকট্রনিক ডিভাইস সঙ্গে আনা যাবে না।</li>
            <li>পেন্সিল, ইরেজার, স্কেল, জ্যামিতি বক্স সঙ্গে আনতে হবে।</li>
            <li>পরীক্ষা আরম্ভ হওয়ার ২০ মিনিট পূর্বে আসন গ্রহণ করতে হবে।</li>
            <li>১৭/১১/২০২৬ খ্রি. এর মধ্যে সকল টিউশন ফি/ বকেয়া পরিশোধ করতে হবে।</li>
          </Box>
      </Box>

      {/* Footer */}
      <Box sx={{
        mt: isUltraCompact ? 0.2 : isCompact ? 0.3 : 0.4,
        pt: isUltraCompact ? 0.2 : isCompact ? 0.3 : 0.4,
        borderTop: '1.5px dashed #d1d9ff',
        position: 'relative',
        zIndex: 1
      }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 1
        }}>
          {/* Class Teacher's Signature (Left) */}
          <Box sx={{ 
            textAlign: 'center', 
            flex: 1,
            maxWidth: '180px',
            pt: 0.1
          }}>
            <Box sx={{ 
              height: isUltraCompact ? '24px' : isCompact ? '30px' : '38px',
              borderBottom: '1.5px solid #1a237e',
              mb: 0.1,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              pb: 0.1
            }}>
            </Box>
            <Typography variant="body1" sx={{
              fontWeight: 'bold',
              fontSize: isUltraCompact ? '0.95rem' : isCompact ? '1.02rem' : '1.12rem',
              lineHeight: 1.3
            }}>
              শ্রেণি শিক্ষক
            </Typography>
          </Box>

          {/* Principal's Signature (Right) */}
          <Box sx={{ 
            textAlign: 'center', 
            flex: 1,
            maxWidth: '180px',
            pt: 0.1
          }}>
            <Box sx={{ 
              height: isUltraCompact ? '32px' : isCompact ? '40px' : '48px',
              mb: 0.1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
              position: 'relative',
              ...(schoolSealUrl ? {
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundImage: `url("${schoolSealUrl}")`,
                  backgroundSize: 'contain',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  opacity: 0.5,
                  zIndex: 0
                }
              } : {})
            }}>
              {/* Signature Image */}
              {signatureUrl && (
                <img
                  src={signatureUrl}
                  alt="Signature"
                  style={{
                    maxWidth: '100%',
                    maxHeight: isUltraCompact ? '28px' : isCompact ? '34px' : '42px',
                    objectFit: 'contain',
                    position: 'relative',
                    zIndex: 1
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              )}
            </Box>
            <Box sx={{ 
              height: '1.5px',
              backgroundColor: '#1a237e',
              width: '100%',
              mb: 0.1
            }} />
            {String(school?.id) !== '51' && (
              <Typography variant="body1" sx={{
                fontWeight: 'bold',
                fontSize: isUltraCompact ? '0.95rem' : isCompact ? '1.02rem' : '1.12rem',
                lineHeight: 1.3
              }}>
                প্রধান শিক্ষক
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default React.memo(AdmissionCard);
