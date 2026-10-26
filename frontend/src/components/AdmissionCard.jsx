import React from 'react';
import api from '../utils/api';
import { Box, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import QRCode from 'qrcode.react';

export default function AdmissionCard({ data, school, exam, examSlots = [] }) {
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

  console.log('AdmissionCard: school =', school);
  console.log('AdmissionCard: signatureUrl =', signatureUrl);
  console.log('AdmissionCard: schoolSealUrl =', schoolSealUrl);
  console.log('AdmissionCard: examSlots =', examSlots);

  // QR Code data for attendance - SIMPLIFIED for faster scanning
  const qrData = `STU|${data?.id}|${name}|${school?.id}`;

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

  const getEffectiveSubjectForGroup = (subjectName, group) => {
    const name = String(subjectName || '').trim();
    if (!name || !name.includes('/')) return name;
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

  // Filter slots to match student's classroom, section, and stream/group
  const studentClassroomId = data?.classroom?.id;
  const studentSectionId = data?.section?.id;

  const filteredSlots = examSlots.filter(slot => {
    const classroomMatch = !slot.classroom || String(slot.classroom) === String(studentClassroomId);
    const sectionMatch = !slot.section || String(slot.section) === String(studentSectionId);
    const groupMatch = isSubjectMatchingStudent(slot, data);
    return classroomMatch && sectionMatch && groupMatch;
  });

  const studentGroup = getStudentGroup(data);
  const seenSubjects = new Set();
  const uniqueFilteredSlots = [];
  for (const slot of filteredSlots) {
    const effName = getEffectiveSubjectForGroup(slot.subject_name || slot.subject?.name, studentGroup).trim().toLowerCase();
    if (!seenSubjects.has(effName)) {
      seenSubjects.add(effName);
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

  const isCompact = finalSlots.length > 12;

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
        maxWidth: { xs: '100%', sm: '640px' }, // Responsive width
        boxShadow: '0 4px 15px rgba(26, 35, 126, 0.1)',
        position: 'relative',
        fontFamily: 'Hind Siliguri, Arial, sans-serif',
        border: '1.5px solid #1a237e',
        p: { xs: 0.5, sm: isCompact ? 0.8 : 1 }, // Dynamic padding
        lineHeight: 1.4, // Increased line height
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
        mb: 0.5,
        padding: { xs: '6px', sm: '10px' },
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
          width: { xs: '75px', sm: '95px' },
          height: { xs: '75px', sm: '95px' },
          border: '1.5px solid #1a237e',
          borderRadius: '5px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'white',
          p: 0.3
        }}>
          <QRCode value={qrData} size={isMobile ? 70 : 88} level="H" />
        </Box>
        
        {/* School Info */}
        <Box sx={{ textAlign: 'center', flex: 1, px: { xs: 0.5, sm: 1.5 }, minWidth: 0 }}>
          <Typography sx={{
            fontWeight: 'bold', 
            fontSize: schoolName.length > 30 ? { xs: '0.75rem', sm: '0.95rem' } : (schoolName.length > 20 ? { xs: '0.85rem', sm: '1.1rem' } : { xs: '1.0rem', sm: '1.3rem' }),
            lineHeight: 1.35,
            pt: '3px',
            pb: '1px',
            color: '#000',
            mb: 0.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {schoolName}
          </Typography>
          <Typography sx={{
            fontSize: { xs: '1.4rem', sm: '1.8rem' },
            fontWeight: '900',
            color: '#1a237e',
            my: 0.1,
            lineHeight: 1.25,
            letterSpacing: '1px'
          }}>
            প্রবেশপত্র
          </Typography>
          <Typography sx={{
            fontSize: { xs: '0.85rem', sm: '1.05rem' },
            fontWeight: 700,
            lineHeight: 1.35,
            pt: '2px',
            pb: '1px',
            color: '#000',
            whiteSpace: 'nowrap'
          }}>
            {getExamTitleBn()}
          </Typography>
        </Box>
        
        {/* Student Photo */}
        <Box sx={{
          width: { xs: '72px', sm: '92px' },
          height: { xs: '90px', sm: '112px' },
          border: '1.5px solid #1a237e',
          borderRadius: '5px',
          overflow: 'hidden',
          backgroundColor: '#f5f5f5',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
        }}>
          {userPhoto ? (
            <img src={userPhoto} alt="S" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>Photo</Typography>}
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
          mb: isCompact ? 0.6 : 0.8,
          padding: isCompact ? '9px 10px' : '12px 10px',
          backgroundColor: 'rgba(255,255,255,0.75)',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          position: 'relative',
          zIndex: 1
        }}>
          <Typography variant="h6" sx={{
              fontWeight: 'bold',
              fontSize: '1.5rem',
              textAlign: 'center',
              mb: 0.8,
              lineHeight: 1.3,
              pb: 0.2
            }}>
              {name || 'শিক্ষার্থীর নাম'}
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, sm: 3 }, justifyContent: 'center' }}>
              <Typography variant="body1" sx={{ fontSize: '1.15rem', lineHeight: 1.4, pb: 0.2 }}>
                <strong>Roll:</strong> {rollNumber || 'রোল'}
              </Typography>
              <Typography variant="body1" sx={{ fontSize: '1.15rem', lineHeight: 1.4, pb: 0.2 }}>
                <strong>Class:</strong> {className && className !== 'N/A' ? `${className} ${section}` : 'শ্রেণি'}
              </Typography>
              <Typography variant="body1" sx={{ fontSize: '1.15rem', lineHeight: 1.4, pb: 0.2 }}>
                <strong>Exam ID:</strong> {exam?.exam_id || 'N/A'}
              </Typography>
          </Box>
        </Box>

        {/* Exam Details */}
        {(() => {
          const examDetailsP = isCompact ? 1.25 : 1.8;
          const examDetailsMb = isCompact ? 0.8 : 1.2;
          const routineTitleMb = isCompact ? 0.35 : 0.5;
          const routineTitlePb = isCompact ? 0.55 : 0.8;
          const headerPy = isCompact ? 0.55 : 0.8;
          const headerFontSize = isCompact ? '9.8px !important' : '10.5px !important';
          const rowPy = isCompact ? 0.4 : 0.6;
          const rowPtPb = isCompact ? '3.5px' : '5px';
          const rowLineHeight = isCompact ? 1.35 : 1.6;
          const rowFontSize = isCompact ? '9.5px !important' : '10px !important';

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
                  fontSize: '1.1rem',
                  lineHeight: 1.4
                }}>
                  পরীক্ষার রুটিনঃ
                </Typography>

                {(() => {
                  const timeStr = getExamTimeRangeStr();
                  if (!timeStr) return null;
                  return (
                    <Typography sx={{
                      textAlign: 'center',
                      fontSize: '0.95rem',
                      fontWeight: 'bold',
                      color: '#1a237e',
                      mb: isCompact ? 0.5 : 1.0,
                      lineHeight: 1.3
                    }}>
                      {timeStr}
                    </Typography>
                  );
                })()}

              {/* Exam Routine Table - Four Columns */}
              {finalSlots.length === 0 ? (
                <Typography variant="body1" sx={{ textAlign: 'center', color: '#757575', fontSize: '0.9rem' }}>
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
                      fontSize: '11px !important'
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
                                fontFamily: '"Roboto", "Arial", "Hind Siliguri", sans-serif'
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
                                <Box sx={{ fontWeight: '600', fontSize: rowFontSize, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: rowLineHeight, pt: rowPtPb, pb: rowPtPb }}>
                                  {subName1}
                                </Box>
                              </Box>
                              <Box sx={{
                                py: rowPy,
                                px: 0.2,
                                backgroundColor: r % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(248,249,255,0.6)',
                                textAlign: 'center',
                                borderBottom: '0.5px solid #e0e8ff',
                                fontFamily: '"Roboto", "Arial", "Hind Siliguri", sans-serif'
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
                                <Box sx={{ fontWeight: '600', fontSize: rowFontSize, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: rowLineHeight, pt: rowPtPb, pb: rowPtPb }}>
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

      {/* Valid For removed per requirement */}

      {/* Instructions Section */}
      <Box sx={{
        mt: 0.5, // Reduced
        p: 0.6, // Reduced
        backgroundColor: 'rgba(240, 244, 255, 0.9)',
        borderRadius: '6px',
        position: 'relative',
        zIndex: 1
      }}>
        <Typography variant="subtitle1" sx={{ 
            fontWeight: 'bold', 
            mb: 0.1,
            color: '#1a237e',
            textAlign: 'center',
            fontSize: '13px !important',
            lineHeight: 1.1
          }}>
            নির্দেশনা
          </Typography>
          <Box component="p" sx={{ 
            px: 0.5,
            m: 0,
            fontSize: '12px !important',
            lineHeight: 1.2,
            color: '#333',
            textAlign: 'center'
          }}>
            প্রবেশপত্র ছাড়া পরীক্ষার হলে প্রবেশ করতে পারবে না। পরীক্ষা শুরু হওয়ার কমপক্ষে ১৫ মিনিট আগে প্রবেশ করা আবশ্যক। নির্ধারিত বিষয় বাছাই করে পরীক্ষা দিতে হবে। প্রতিটি প্রশ্নের উত্তর সঠিকভাবে লিখতে হবে।
          </Box>
      </Box>

      {/* Footer */}
      <Box sx={{
        mt: 0.3, // Further reduced
        pt: 0.3, // Further reduced
        borderTop: '2px dashed #d1d9ff',
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
            maxWidth: '200px', // Reduced
            pt: 0.2
          }}>
            <Box sx={{ 
              height: '35px', // Further reduced
              borderBottom: '2px solid #1a237e',
              mb: 0.2,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              pb: 0.2
            }}>
            </Box>
            <Typography variant="body1" sx={{
              fontWeight: 'bold',
              fontSize: '0.9rem', // Reduced
              lineHeight: 1.2
            }}>
              শ্রেণি শিক্ষক
            </Typography>
          </Box>

          {/* Principal's Signature (Right) */}
          <Box sx={{ 
            textAlign: 'center', 
            flex: 1,
            maxWidth: '200px', // Reduced
            pt: 0.2
          }}>
            <Box sx={{ 
              height: '45px', // Further reduced
              mb: 0.2,
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
                    maxHeight: '40px', // Further reduced
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
              height: '2px',
              backgroundColor: '#1a237e',
              width: '100%',
              mb: 0.2
            }} />
            {String(school?.id) !== '51' && (
              <Typography variant="body1" sx={{
                fontWeight: 'bold',
                fontSize: '0.9rem',
                lineHeight: 1.2
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
