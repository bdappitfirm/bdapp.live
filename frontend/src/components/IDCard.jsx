import React, { useState } from 'react';
import { Box, Typography, Avatar, IconButton, Tooltip } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import { QRCodeCanvas } from 'qrcode.react';
import './IDCard.css';
import api from '../utils/api';
import { resolveSchoolLogo, resolveStudentPhoto, getMediaUrl } from '../utils/media';
import fallbackLogo from './fallback_logo.png';

// Helper function to convert Bangla class name to numeric class
const getNumericClass = (className) => {
  if (!className) return '';
  const classMap = {
    'প্রথম শ্রেণি': '01',
    '১ম শ্রেণি': '01',
    'দ্বিতীয় শ্রেণি': '02',
    '২য় শ্রেণি': '02',
    'তৃতীয় শ্রেণি': '03',
    '৩য় শ্রেণি': '03',
    'চতুর্থ শ্রেণি': '04',
    '৪র্থ শ্রেণি': '04',
    'পঞ্চম শ্রেণি': '05',
    '৫ম শ্রেণি': '05',
    'ষষ্ঠ শ্রেণি': '06',
    '৬ষ্ঠ শ্রেণি': '06',
    'সপ্তম শ্রেণি': '07',
    '৭ম শ্রেণি': '07',
    'অষ্টম শ্রেণি': '08',
    '৮ম শ্রেণি': '08',
    'নবম শ্রেণি': '09',
    '৯ম শ্রেণি': '09',
    'দশম শ্রেণি': '10',
    '১০ম শ্রেণি': '10',
    'একাদশ শ্রেণি': '11',
    '১১ম শ্রেণি': '11',
    'দ্বাদশ শ্রেণি': '12',
    '১২ম শ্রেণি': '12'
  };
  // First check direct match
  if (classMap[className]) return classMap[className];
  // Try to extract number from string (like Class 8 or 8)
  const numericMatch = className.match(/\d+/);
  if (numericMatch) {
    return String(numericMatch[0]).padStart(2, '0');
  }
  return '';
};

// Helper function to convert section to number
const getNumericSection = (sectionName) => {
  if (!sectionName) return '01';
  const sectionMap = {
    'ক': '01',
    'খ': '02',
    'গ': '03',
    'ঘ': '04',
    'ঙ': '05',
    'চ': '06',
    'ছ': '07',
    'জ': '08',
    'ঝ': '09',
    'ঞ': '10'
  };
  if (sectionMap[sectionName]) return sectionMap[sectionName];
  // Try to extract number
  const numericMatch = sectionName.match(/\d+/);
  if (numericMatch) {
    return String(numericMatch[0]).padStart(2, '0');
  }
  // Default to 01
  return '01';
};

// Bangla section letter -> English section letter (for the English version of the card)
const SECTION_EN_MAP = {
  'ক': 'A', 'খ': 'B', 'গ': 'C', 'ঘ': 'D', 'ঙ': 'E',
  'চ': 'F', 'ছ': 'G', 'জ': 'H', 'ঝ': 'I', 'ঞ': 'J'
};

// Build an English class name ("Class 8", "Nursery", "Play", ...) from a Bangla class name
const getEnglishClassName = (className) => {
  if (!className) return '';
  const numeric = getNumericClass(className);
  if (numeric) return `Class ${parseInt(numeric, 10)}`;
  const s = String(className);
  if (/প্লে|play/i.test(s)) return 'Play';
  if (/শিশু|shishu/i.test(s)) return 'Shishu';
  if (/নার্সার|nursery/i.test(s)) return 'Nursery';
  if (/কেজি|\bkg\b/i.test(s)) return 'KG';
  return s;
};

// All labels used on the card, per language
const LABELS = {
  bn: {
    studentCard: 'শিক্ষার্থী আইডি কার্ড',
    teacherCard: 'শিক্ষক আইডি কার্ড',
    committeeCard: 'পরিচালনা কমিটি আইডি কার্ড',
    id: 'আইডি',
    className: 'শ্রেণি',
    roll: 'রোল',
    section: 'শাখা',
    blood: 'রক্ত',
    designation: 'পদবী',
    subject: 'বিষয়',
    joining: 'যোগদান',
    returnTo: 'প্রাপ্ত হলে ফেরত দিন',
    scanToVerify: 'যাচাই করতে স্ক্যান করুন',
    session: 'শিক্ষাবর্ষ',
    headmaster: 'প্রধান শিক্ষক',
    email: 'মেইল',
    mobile: 'মোবাইল',
  },
  en: {
    studentCard: 'Student ID Card',
    teacherCard: 'Teacher ID Card',
    committeeCard: 'Committee ID Card',
    id: 'ID',
    className: 'Class',
    roll: 'Roll',
    section: 'Section',
    blood: 'Blood',
    designation: 'Designation',
    subject: 'Subject',
    joining: 'Joining',
    returnTo: 'If found, please return to',
    scanToVerify: 'Scan to verify',
    session: 'Session',
    headmaster: 'Headmaster',
    email: 'Email',
    mobile: 'Mobile',
  }
};

// Faint school logo printed behind the card content - Larger size
const CardWatermark = ({ logo }) => (
  logo ? (
    <Box
      component="img"
      src={logo}
      alt=""
      sx={{
        position: 'absolute',
        top: '52%',
        left: '50%',
        width: '88%',
        transform: 'translate(-50%, -50%)',
        opacity: 0.08,
        zIndex: 0,
        pointerEvents: 'none',
        userSelect: 'none'
      }}
    />
  ) : null
);

// A single "label : value" row inside the details block - Optimized font size & wrapping to prevent text cutoff
const InfoRow = ({ label, value, labelWidth = '75px' }) => (
  <Box sx={{ display: 'flex', mb: 0.3, alignItems: 'flex-start' }}>
    <Typography sx={{
      fontWeight: 'bold', fontSize: '0.75rem', width: labelWidth, flexShrink: 0,
      textAlign: 'right', pr: 0.8, color: '#0a4b94', lineHeight: 1.2
    }}>{label}</Typography>
    <Typography sx={{
      fontWeight: 'bold', fontSize: '0.75rem', color: '#0a4b94', lineHeight: 1.2,
      whiteSpace: 'normal', wordBreak: 'break-word', overflow: 'hidden'
    }}>{value}</Typography>
  </Box>
);

export default function IDCard({ type = 'student', data, school, classrooms = [], sections = [], overridePhone, signatureUrl: propSignatureUrl, lang = 'bn' }) {
  const isEn = lang === 'en';
  const t = LABELS[isEn ? 'en' : 'bn'];

  // Resolve classroom object
  const getClassroom = () => {
    if (!data?.classroom) return null;
    if (typeof data.classroom === 'object' && data.classroom !== null) return data.classroom;
    // If classroom is an ID, find it in the classrooms array
    return classrooms.find(c => c.id === data.classroom || String(c.id) === String(data.classroom));
  };
  const classroom = getClassroom();

  // Resolve section object
  const getSection = () => {
    if (!data?.section) return null;
    if (typeof data.section === 'object' && data.section !== null) return data.section;
    // If section is an ID, find it in the sections array
    return sections.find(s => s.id === data.section || String(s.id) === String(data.section));
  };
  const section = getSection();
  const signatureUrl = (() => {
    if (propSignatureUrl) return propSignatureUrl;
    if (school?.principal_signature) {
      const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '');
      const sig = String(school.principal_signature);
      if (sig.startsWith('http')) return sig;
      return `${base}/media/${sig.replace(/^\/+/, '')}`;
    }
    // Hardcoded fallback for specific school 19 only if they requested it, else return null
    try {
      if (school?.id && String(school.id) === '19') {
        const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '');
        return `${base}/media/BHS/signature.png`;
      }
    } catch (_) {}
    return null; // Return null instead of a default signature
  })();

  // Print a single card straight from the visible DOM. The cards are never
  // cloned into another document, so the QR <canvas> keeps its drawn pixels
  // (cloning a canvas copies the element but not the bitmap, which is why the
  // QR code used to come out blank).
  const handlePrintSingle = () => {
    const container = document.querySelector('.id-card-container');
    const cardId = data?.id;
    if (!container || cardId === undefined || cardId === null) {
      window.print();
      return;
    }

    container.classList.add('printing-single');
    container.querySelectorAll('.id-card-wrapper').forEach((el) => {
      el.classList.toggle('print-target', el.getAttribute('data-card-id') === String(cardId));
    });

    let printed = false;
    const trigger = () => {
      if (printed) return;
      printed = true;
      window.print();
    };

    // Give any not-yet-loaded image (logo/photo) a brief moment so the print
    // preview shows the finished card instead of a half-loaded one.
    const target = container.querySelector('.id-card-wrapper.print-target');
    const pending = target
      ? Array.from(target.querySelectorAll('img')).filter((img) => !img.complete || img.naturalHeight === 0)
      : [];

    if (pending.length === 0) {
      trigger();
      return;
    }

    let remaining = pending.length;
    const step = () => {
      remaining -= 1;
      if (remaining <= 0) trigger();
    };
    pending.forEach((img) => {
      img.addEventListener('load', step, { once: true });
      img.addEventListener('error', step, { once: true });
    });
    setTimeout(trigger, 800);
  };

  const isStudent = type === 'student';
  const user = data?.user || {};

  // Names: use the English column when generating the English card, and fall
  // back to the Bangla value if the English one is missing.
  const nameBn = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
  const nameEn = `${user.first_name_en || user.first_name || ''} ${user.last_name_en || user.last_name || ''}`.trim() || user.username;
  const name = (isEn ? nameEn : nameBn) || 'N/A';

  const schoolName = isEn ? (school?.name_en || school?.name) : school?.name;
  const schoolAddress = isEn ? (school?.address_en || school?.address) : school?.address;

  const currentYear = new Date().getFullYear();

  // Function to process photo URLs
  const processPhotoUrl = (url) => {
    if (!url) return null;
    if (typeof url !== 'string') return url;
    const cleanUrl = url.trim();
    const lower = cleanUrl.toLowerCase();
    if (!cleanUrl || cleanUrl === '/' || lower === 'null' || lower === 'undefined' || lower === 'none' || cleanUrl === '/media/') return null;
    return getMediaUrl(cleanUrl);
  };

  const schoolLogo = resolveSchoolLogo(school) || resolveSchoolLogo(data?.school) || resolveSchoolLogo(data?.examination?.school) || processPhotoUrl(school?.logo) || fallbackLogo;
  const userPhoto = resolveStudentPhoto(data) || resolveStudentPhoto({ user }) || resolveStudentPhoto(user) || processPhotoUrl(user.photo_url || user.photo || data.photo);
  const [studentPhotoError, setStudentPhotoError] = useState(false);
  const studentPhotoToDisplay = (!studentPhotoError && userPhoto) ? userPhoto : schoolLogo;

  // Generate custom ID card number
  let customIdNumber = '';
  if (type === 'student') {
    // Get school EIIN
    const schoolEin = school?.ein || school?.id || ''; // Use ein or id if ein not available
    // Get numeric class
    const className = classroom?.name || data?.classroom_name || data?.class_name || '';
    const numericClass = getNumericClass(className);
    // Get numeric section
    const sectionName = section?.name || '';
    const numericSection = getNumericSection(sectionName);
    // Get roll number (pad to 2 digits)
    const rollNumber = data?.roll_number || '';
    const paddedRoll = String(rollNumber).padStart(2, '0');
    // Combine all parts
    customIdNumber = `${schoolEin}${numericClass}${numericSection}${paddedRoll}`;
  } else {
    // For teachers/committee, use index_number if available, else existing id or id_card_number
    customIdNumber = data?.index_number || data?.id_card_number || data?.id || '';
  }

  // Values shown on the card, already localized
  const rawClassName = classroom?.name || data?.classroom_name || data?.class_name || '';
  const classValue = isEn ? (getEnglishClassName(rawClassName) || 'N/A') : (rawClassName || 'N/A');
  const sectionValue = isEn
    ? (SECTION_EN_MAP[String(section?.name || '').trim()] || section?.name || 'N/A')
    : (section?.name || 'N/A');
  const bloodValue = data?.blood_group || data?.user?.blood_group || data?.profile?.blood_group || data?.student_profile?.blood_group || 'N/A';
  const cardTypeLabel = isStudent ? t.studentCard : (type === 'teacher' ? t.teacherCard : t.committeeCard);

  // Generate QR code data - simpler format for easier scanning
  // Using a simpler format than JSON to make QR smaller and more reliable
  const qrData = `STU|${data.id}|${customIdNumber}|${encodeURIComponent(name)}|${school?.ein || school?.id}`;

  return (
    <Box className="id-card-wrapper" data-card-id={data?.id} sx={{ position: 'relative' }}>
      {/* Print Button */}
      <Tooltip title={isEn ? 'Print this card' : 'এই কার্ডটি প্রিন্ট করুন'} className="no-print">
        <IconButton
          onClick={handlePrintSingle}
          sx={{
            position: 'absolute',
            top: -10,
            right: -10,
            bgcolor: 'primary.main',
            color: 'white',
            zIndex: 10,
            '&:hover': { bgcolor: 'primary.dark' },
            boxShadow: 2
          }}
          size="small"
        >
          <PrintIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Box id={`id-card-${data.id}`}>
        {/* Front Side - Portrait */}
        <Box className="id-card id-card-front" sx={{
          background: '#ffffff',
          color: 'black',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '2px solid #0a4b94',
          borderRadius: '10px'
        }}>
          <CardWatermark logo={schoolLogo} />

          {/* Top Header - Blue Section */}
          <Box sx={{
            position: 'relative',
            zIndex: 1,
            background: 'linear-gradient(135deg, #0a4b94 0%, #1e6fd0 100%)',
            color: 'white',
            textAlign: 'center',
            px: 0.8,
            pt: 0.5,
            pb: 0.6,
            borderBottom: '3px solid #f5b301'
          }}>
            {/* School Logo */}
            {schoolLogo && (
              <Avatar
                src={schoolLogo}
                sx={{
                  width: 36,
                  height: 36,
                  border: '2px solid white',
                  bgcolor: 'white',
                  mx: 'auto',
                  mb: 0.2,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.35)'
                }}
              />
            )}
            {/* School Info */}
            <Typography variant="h6" sx={{
              fontWeight: 800,
              lineHeight: 1.15,
              fontSize: '0.78rem !important',
              mb: 0.05,
              whiteSpace: 'normal',
              wordWrap: 'break-word',
              display: 'block',
              letterSpacing: '0.01em'
            }}>
              {schoolName || t.studentCard}
            </Typography>
            {school?.ein && (
              <Typography variant="body2" sx={{
                fontSize: '0.62rem',
                opacity: 0.95,
                letterSpacing: '0.02em'
              }}>
                EIIN No.- {school.ein}
              </Typography>
            )}
          </Box>

          {/* Photo Section */}
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            mt: 0.6,
            mb: 0.2,
            position: 'relative',
            zIndex: 1
          }}>
            <Box sx={{
              width: 108,
              height: 128,
              border: '2px solid #0a4b94',
              borderRadius: '6px',
              bgcolor: 'white',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: '0 2px 6px rgba(10,75,148,0.25)'
            }}>
              {/* Badge on top of the photo */}
              <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(90deg, #0a4b94, #1e6fd0)',
                color: 'white',
                px: 0.5,
                py: 0.25,
                textAlign: 'center',
                zIndex: 2,
                fontSize: '0.48rem',
                fontWeight: 'bold',
                letterSpacing: '0.03em'
              }}>
                {cardTypeLabel}
              </Box>
              {studentPhotoToDisplay ? (
                <img
                  src={studentPhotoToDisplay}
                  alt={name}
                  style={{
                    width: '100%',
                    height: 'calc(100% - 1.5rem)',
                    marginTop: '1.5rem',
                    objectFit: 'cover',
                    display: 'block'
                  }}
                  onError={() => setStudentPhotoError(true)}
                />
              ) : (
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: 'calc(100% - 1.5rem)',
                  marginTop: '1.5rem',
                  backgroundColor: '#f0f4f8',
                  color: '#0a4b94',
                  fontSize: '1.2rem',
                  fontWeight: 'bold'
                }}>
                  {name && name.charAt(0) ? name.charAt(0).toUpperCase() : '?'}
                </Box>
              )}
            </Box>
          </Box>

          {/* Student/Teacher Details */}
          <Box sx={{
            position: 'relative',
            zIndex: 1,
            textAlign: 'center',
            px: 0.8,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            py: 0.1,
            mt: '4px'
          }}>
            <Typography variant="h5" sx={{
              fontWeight: 800,
              lineHeight: 1.15,
              mb: 0.15,
              color: '#0a4b94',
              fontSize: isStudent ? '1rem !important' : '0.85rem !important',
              whiteSpace: 'normal',
              wordWrap: 'break-word',
              display: 'block'
            }}>
              {name}
            </Typography>

            {/* ID Card Number */}
            <Typography variant="body2" sx={{
              fontWeight: 'bold',
              lineHeight: 1.1,
              mb: 0.3,
              color: '#1565c0',
              fontSize: '0.72rem',
              letterSpacing: '0.03em'
            }}>
              {t.id}: {customIdNumber}
            </Typography>

            <Box sx={{ width: '78%', height: '1px', bgcolor: '#e3ecf7', mx: 'auto', mb: 0.4 }} />

            <Box sx={{ textAlign: 'left', mx: 'auto', minWidth: '150px' }}>
              {type === 'student' ? (
                <>
                  <InfoRow label={`${t.className} :`} value={classValue} />
                  <InfoRow label={`${t.roll} :`} value={data?.roll_number || 'N/A'} />
                  <InfoRow label={`${t.section} :`} value={sectionValue} />
                  <InfoRow label={`${t.blood} :`} value={bloodValue} />
                </>
              ) : type === 'teacher' ? (
                <>
                  <InfoRow label={`${t.designation} :`} value={data?.designation || 'Teacher'} labelWidth="80px" />
                  <InfoRow label={`${t.subject} :`} value={data?.assigned_subject_name || data?.subject || 'N/A'} labelWidth="80px" />
                  <InfoRow label={`${t.blood} :`} value={bloodValue} labelWidth="80px" />
                  <InfoRow label={`${t.joining} :`} value={data?.joining_date || 'N/A'} labelWidth="80px" />
                </>
              ) : (
                <>
                  <InfoRow label={`${t.designation} :`} value={data?.designation || 'Committee Member'} labelWidth="80px" />
                  <InfoRow label={`${t.blood} :`} value={bloodValue} labelWidth="80px" />
                </>
              )}
            </Box>

            {/* Signature with School Seal Background */}
            <Box sx={{
              mt: -0.5,
              textAlign: 'right',
              pr: 0.6,
              pt: 0,
              position: 'relative',
              flexShrink: 0,
              minHeight: '45px'
            }}>
              <Box sx={{ display: 'inline-block', textAlign: 'center', position: 'relative', zIndex: 1 }}>
                {/* School Seal as Background */}
                {schoolLogo && (
                  <Box
                    component="img"
                    src={schoolLogo}
                    sx={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '45px',
                      height: '45px',
                      opacity: 0.12,
                      zIndex: 0,
                      pointerEvents: 'none'
                    }}
                    alt=""
                  />
                )}
                {signatureUrl && (
                  <img
                    src={signatureUrl}
                    alt="Authorized Signature"
                    style={{
                      width: '40px',
                      height: 'auto',
                      filter: 'brightness(0)',
                      display: 'block',
                      position: 'relative',
                      zIndex: 1,
                      margin: '0 auto'
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                )}
              </Box>
            </Box>
          </Box>

          {/* Bottom Bar */}
          <Box sx={{
            position: 'relative',
            zIndex: 1,
            background: 'linear-gradient(90deg, #0a4b94, #1e6fd0)',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 1,
            py: 0.3,
            flexShrink: 0,
            mt: 0
          }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.55rem', color: 'white' }}>
              {t.session}: {currentYear}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.55rem', color: 'white' }}>
              {t.headmaster}
            </Typography>
          </Box>
        </Box>

        {/* Back Side - Portrait, same size as front */}
        <Box className="id-card id-card-back" sx={{
          background: '#ffffff',
          color: 'black',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          mt: 1,
          border: '2px solid #0a4b94',
          borderRadius: '10px'
        }}>
          <CardWatermark logo={schoolLogo} />

          {/* Top Section - Blue: If found, please return to */}
          <Box sx={{
            position: 'relative',
            zIndex: 1,
            background: 'linear-gradient(135deg, #0a4b94 0%, #1e6fd0 100%)',
            color: 'white',
            px: 1,
            py: 0.7,
            textAlign: 'center',
            borderBottom: '3px solid #f5b301'
          }}>
            <Typography sx={{ fontWeight: 'bold', fontSize: '0.72rem', lineHeight: 1.2 }}>
              {t.returnTo}
            </Typography>
          </Box>

          {/* QR Code - Optimized for Screen-to-Screen and Print Scanning */}
          <Box sx={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            mt: 1.2,
            flexShrink: 0
          }}>
            <Box sx={{
              p: 1,
              border: '3px solid #0a4b94',
              borderRadius: '8px',
              bgcolor: '#ffffff',
              boxShadow: '0 2px 8px rgba(10,75,148,0.2)'
            }}>
              <QRCodeCanvas
                value={qrData}
                size={150}
                level="H"
                includeMargin={false}
                fgColor="#000000"
                bgColor="#ffffff"
              />
            </Box>
            <Typography sx={{
              mt: 0.4,
              fontSize: '0.55rem',
              color: '#0a4b94',
              fontWeight: 'bold',
              letterSpacing: '0.04em'
            }}>
              {t.scanToVerify}
            </Typography>
          </Box>

          {/* School Name */}
          <Box sx={{
            position: 'relative',
            zIndex: 1,
            textAlign: 'center',
            px: 1,
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Typography
              className="id-card-back-school-name"
              variant="h5"
              sx={{
                fontWeight: 'bold',
                fontSize: '0.8rem',
                color: '#0a4b94',
                whiteSpace: 'normal',
                lineHeight: 1.2,
                wordBreak: 'break-word'
              }}
            >
              {schoolName || t.studentCard}
            </Typography>
          </Box>

          {/* Bottom Section - Blue */}
          <Box sx={{
            position: 'relative',
            zIndex: 1,
            background: 'linear-gradient(135deg, #0a4b94 0%, #1e6fd0 100%)',
            color: 'white',
            px: 1,
            pt: 0.8,
            pb: 0.8,
            textAlign: 'center',
            flexShrink: 0,
            mt: 'auto'
          }}>
            <Typography variant="body2" sx={{ fontSize: '0.65rem', mb: 0.4, lineHeight: 1.3, whiteSpace: 'normal', wordWrap: 'break-word' }}>
              {schoolAddress || 'ভাটারা, রায়পুর, নরসিংদী'}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.62rem', mb: 0.3, lineHeight: 1.3 }}>
              {t.email}: {school?.email || 'hsbhatra1906@gmail.com'}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.62rem', lineHeight: 1.3 }}>
              {t.mobile}: {overridePhone || school?.phone_number || school?.phone || '01712923054'}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
