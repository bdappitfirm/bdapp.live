import React, { useState, useEffect, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Search from '@mui/icons-material/Search';
import Print from '@mui/icons-material/Print';
import Download from '@mui/icons-material/Download';
import Person from '@mui/icons-material/Person';
import EmojiEvents from '@mui/icons-material/EmojiEvents';
import Refresh from '@mui/icons-material/Refresh';
import Edit from '@mui/icons-material/Edit';
import CollectionsBookmark from '@mui/icons-material/CollectionsBookmark';
import { QRCodeSVG } from 'qrcode.react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  Grid,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { useAcademics } from '../context/AcademicsContext';
import api from '../utils/api';
import { isAuthenticated } from '../utils/auth';
import InputGuidance from '../components/InputGuidance';

const StudentCard = ({ data, school, bloodGroup, isEditing, onEditProfile, onBloodGroupChange }) => {
  const user = data?.user || {};
  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
  const rollNumber = data?.roll_number || '';
  const classroom = data?.classroom?.name || '';
  const section = data?.section?.name || '';
  const dateOfBirth = user?.date_of_birth || '';
  const gender = user?.gender || '';

  const processPhotoUrl = (url) => {
    if (!url) return null;
    if (typeof url !== 'string') return url;
    if (url.startsWith('http')) return url;
    const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
    if (url.startsWith('/media/')) return `${base}${url}`;
    if (url.startsWith('media/')) return `${base}/${url}`;
    return `${base}/media/${url.replace(/^\/+|\/+$/g, '')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === 'N/A') return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        if (dateStr.includes('-')) {
          const parts = dateStr.split('-');
          if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateStr;
      }
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    } catch (e) { return dateStr; }
  };

  const photoUrl = processPhotoUrl(user?.photo_url);

  return (
    <Box className="student-card-container" sx={{
      position: 'relative', backgroundColor: '#ffffff', width: '350px', minHeight: '200px', p: 2, border: '2px solid #1976d2', borderRadius: 2, boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)',
      backgroundImage: 'linear-gradient(45deg, #f3f4f6 25%, transparent 25%, transparent 75%, #f3f4f6 75%, #f3f4f6), linear-gradient(45deg, #f3f4f6 25%, transparent 25%, transparent 75%, #f3f4f6 75%, #f3f4f6)',
      backgroundSize: '20px 20px', backgroundPosition: '0 0, 10px 10px'
    }}>
      <Box sx={{ textAlign: 'center', mb: 1, position: 'relative', zIndex: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2', fontSize: '0.9rem', mb: 0.5 }}>{school?.name || 'SCHOOL NAME'}</Typography>
        <Typography variant="caption" sx={{ color: '#666', fontSize: '0.7rem' }}>Student ID Card</Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, position: 'relative', zIndex: 1 }}>
        <Box sx={{ flexShrink: 0 }}>
          {photoUrl ? <img src={photoUrl} alt={name} style={{ width: '80px', height: '100px', objectFit: 'cover', border: '1px solid #ddd' }} /> : (
            <Box sx={{ width: '80px', height: '100px', border: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' }}><Person sx={{ fontSize: 40, color: '#999' }} /></Box>
          )}
        </Box>
        <Box sx={{ flex: 1, fontSize: '0.75rem' }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>{name}</Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>Class: {classroom} {section && `(${section})`}</Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>Roll: {rollNumber}</Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>Gender: {gender || 'N/A'}</Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>DOB: {formatDate(dateOfBirth)}</Typography>
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold' }}>Blood Group: {isEditing ? (
            <Select value={bloodGroup} onChange={(e) => onBloodGroupChange(e.target.value)} size="small" sx={{ fontSize: '0.7rem', height: '25px' }}>
              {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => <MenuItem key={bg} value={bg}>{bg}</MenuItem>)}
            </Select>
          ) : bloodGroup || 'Not Set'}</Typography>
        </Box>
      </Box>
      <Button variant="outlined" size="small" startIcon={<Edit />} onClick={onEditProfile} sx={{ position: 'absolute', top: 8, right: 8, fontSize: '0.7rem' }}>{isEditing ? 'Save' : 'Edit'}</Button>
    </Box>
  );
};

const Certificate = ({ data, school, session }) => {
  if (!data) return <Box sx={{ p: 4, textAlign: 'center' }}><Typography variant="h6" color="error">No student data available</Typography></Box>;
  
  const effectiveData = data;
  const user = effectiveData?.user || {};

  const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
  };

  // Prefer English names for certificate
  const rawName = `${user.first_name_en || ''} ${user.last_name_en || ''}`.trim() ||
               effectiveData?.student_name_en ||
               effectiveData?.student_name ||
               `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
               'Student Name';
  const name = toTitleCase(rawName);

  const rollNumber = effectiveData?.roll_number || '';
  const classroom = effectiveData?.classroom?.name || '';
  const section = effectiveData?.section?.name || '';
  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === 'N/A') return 'N/A';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        // If it's already YYYY-MM-DD
        if (parts[0].length === 4) {
          const [y, m, d] = parts;
          const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
        }
        // If it's DD-MM-YYYY
        return dateStr;
      }
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  const dob = formatDate(user.date_of_birth || effectiveData.birth_date);
  const admissionDate = formatDate(effectiveData.admission_date || '01 January 2020');

  const fatherName = toTitleCase(effectiveData.father_name_en || effectiveData.father_name || '');
  const motherName = toTitleCase(effectiveData.mother_name_en || effectiveData.mother_name || '');

  const formatStudentAddress = (addressStr) => {
    if (!addressStr) return '';
    const trimmed = String(addressStr).trim();
    const parts = trimmed.split(/[,，]/).map(p => p.trim()).filter(Boolean);
    if (parts.length === 4) {
      const prefixes = ['Village-', 'P.O-', 'Upazilla-', 'District-'];
      return parts.map((p, i) => `${prefixes[i]}${p}`).join(', ');
    }
    if (parts.length === 3) {
      const prefixes = ['P.O-', 'Upazilla-', 'District-'];
      return parts.map((p, i) => `${prefixes[i]}${p}`).join(', ');
    }
    return trimmed;
  };

  const rawStudentAddress = effectiveData?.address_en || effectiveData?.address || user?.address_en || user?.address || '';
  const schoolAddressDisplay = (school?.address_en || school?.address || '').trim().toUpperCase();
  const studentAddress = formatStudentAddress(rawStudentAddress) || schoolAddressDisplay;

  const guardianName = toTitleCase(effectiveData.guardian_name_en ||
                       effectiveData.guardian_name ||
                       (effectiveData.guardian ?
                         (`${effectiveData.guardian.first_name_en || ''} ${effectiveData.guardian.last_name_en || ''}`.trim() ||
                          `${effectiveData.guardian.first_name || ''} ${effectiveData.guardian.last_name || ''}`.trim())
                         : ''));

  const processPhotoUrl = (url) => {
    if (!url) return null;
    const base = (api?.defaults?.baseURL || window.location.origin).replace(/\/$/, '');
    return url.startsWith('http') ? url : `${base}/media/${url.replace(/^\/+/, '')}`;
  };

  const getClassLevel = (cn) => {
    const name = String(cn || '').toLowerCase();
    if (name.includes('দশম') || name.includes('ten') || name.includes('10') || name.includes('ssc') || name.includes('এসএসসি')) return 10;
    if (name.includes('নবম') || name.includes('nine') || name.includes('9')) return 9;
    if (name.includes('অষ্টম') || name.includes('eight') || name.includes('8')) return 8;
    if (name.includes('সপ্তম') || name.includes('seven') || name.includes('7')) return 7;
    if (name.includes('ষষ্ঠ') || name.includes('six') || name.includes('6')) return 6;
    if (name.includes('পঞ্চম') || name.includes('five') || name.includes('5')) return 5;
    if (name.includes('চতুর্থ') || name.includes('four') || name.includes('4')) return 4;
    if (name.includes('তৃতীয়') || name.includes('three') || name.includes('3')) return 3;
    if (name.includes('দ্বিতীয়') || name.includes('two') || name.includes('2')) return 2;
    if (name.includes('প্রথম') || name.includes('one') || name.includes('1')) return 1;
    return null;
  };

  const translateClassName = (cn) => {
    const low = String(cn || '').toLowerCase();
    if (low.includes('এসএসসি') || low.includes('ssc')) {
      if (low.includes('পরীক্ষার্থী') || low.includes('candidate')) return 'SSC Candidate';
      return 'Class Ten (SSC)';
    }
    const level = getClassLevel(cn);
    const mapping = {
      1: 'Class One', 2: 'Class Two', 3: 'Class Three', 4: 'Class Four', 5: 'Class Five',
      6: 'Class Six', 7: 'Class Seven', 8: 'Class Eight', 9: 'Class Nine', 10: 'Class Ten'
    };
    return mapping[level] || cn;
  };

  const level = getClassLevel(classroom);
  const currentYear = parseInt(session) || new Date().getFullYear();
  let startYear = currentYear;
  if (level) {
    const startLevel = level >= 6 ? 6 : 1;
    startYear = currentYear - (level - startLevel);
  }
  const calculatedAdmissionDate = effectiveData.admission_date || `01 January ${startYear}`;

  const translateSectionName = (sn) => ({ 'বিজ্ঞান': 'Science', 'ব্যবসা': 'Commerce', 'মানবিক': 'Humanities', 'ক': 'A', 'খ': 'B', 'গ': 'C' }[sn] || sn);

  const principalSig = processPhotoUrl(school?.principal_signature);
  const schoolSeal = processPhotoUrl(school?.school_seal);
  const photoUrl = processPhotoUrl(user?.photo_url);

  const qrData = `It is a S.S.C. Certificate of
Name: ${name}
Father: ${fatherName}
Mother: ${motherName}
DOB: ${dob}
Session: ${effectiveData.ssc_session || 'N/A'}
GPA: ${effectiveData.ssc_gpa || 'N/A'}

Verify Online: ${window.location.origin}/verify/${effectiveData.id}`;

  const studentGender = effectiveData.gender || user.gender || 'male';
  const genderWord = studentGender === 'female' ? 'daughter' : 'son';
  const pronoun = studentGender === 'female' ? 'She' : 'He';
  const possessive = studentGender === 'female' ? 'Her' : 'His';
  const objective = studentGender === 'female' ? 'her' : 'him';

  const schoolName = (school?.name_en || school?.name || '');
  const schoolNameWords = schoolName.split(/\s+/).filter(Boolean).length;
  const schoolNameFontSize = schoolNameWords >= 6 ? '1.45rem !important' : schoolNameWords >= 4 ? '1.85rem !important' : '2.6rem !important';
  const schoolNameLetterSpacing = schoolNameWords >= 6 ? '-0.8px' : '0.5px';

  const nameFontSize = name.length > 35 ? '2.2rem' : name.length > 25 ? '2.8rem' : '3.8rem';
  const fatherNameFontSize = fatherName.length > 35 ? '1.8rem' : fatherName.length > 25 ? '2.2rem' : '2.8rem';
  const motherNameFontSize = motherName.length > 35 ? '1.8rem' : motherName.length > 25 ? '2.2rem' : '2.8rem';

  const detectGroup = () => {
    const g1 = effectiveData.student_group || effectiveData.group;
    if (g1) return g1;
    const g2 = effectiveData.user?.group || effectiveData.user?.student_group;
    if (g2) return g2;
    const sec = String(section || '').toLowerCase();
    if (sec.includes('বিজ্ঞান') || sec.includes('science') || sec.includes('sci')) return 'science';
    if (sec.includes('মানবিক') || sec.includes('arts') || sec.includes('humanities')) return 'arts';
    if (sec.includes('ব্যবসা') || sec.includes('commerce') || sec.includes('biz')) return 'commerce';
    const cl = String(classroom || '').toLowerCase();
    if (cl.includes('বিজ্ঞান') || cl.includes('science')) return 'science';
    if (cl.includes('মানবিক') || cl.includes('arts') || cl.includes('humanities')) return 'arts';
    if (cl.includes('ব্যবসা') || cl.includes('commerce')) return 'commerce';
    return '';
  };
  const rawGroup = detectGroup();
  const normalizeGroup = (g) => {
    const lower = String(g || '').toLowerCase().trim();
    if (lower === 'science' || lower === 'বিজ্ঞান') return 'Science';
    if (lower === 'arts' || lower === 'humanities' || lower === 'মানবিক') return 'Humanities';
    if (lower === 'commerce' || lower === 'business' || lower === 'ব্যবসা' || lower === 'ব্যবসায়') return 'Commerce';
    return g || 'N/A';
  };
  const finalGroup = normalizeGroup(rawGroup);

  return (
    <Box className="certificate-container" sx={{
      position: 'relative',
      backgroundColor: '#fdfbf7',
      width: '1122px', // Standard A4 Landscape Width
      height: '793px', // Standard A4 Landscape Height
      p: 0,
      border: '30px solid #8B4513',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      overflow: 'hidden',
      fontFamily: "'Playfair Display', serif",
      mx: 'auto',
      boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
      // Responsive transform for small screens
      transform: { xs: 'scale(0.3)', sm: 'scale(0.5)', md: 'scale(0.8)', lg: 'scale(1)' },
      transformOrigin: 'top center',
      mb: { xs: -50, sm: -35, md: -15, lg: 0 },
      '@media print': {
        width: '1122px !important',
        height: '793px !important',
        margin: '0 !important',
        boxShadow: 'none !important',
        transform: 'none !important',
        border: '30px solid #8B4513 !important',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        position: 'fixed !important',
        top: 0,
        left: 0,
      }
    }}>
      {/* Inner decorative border - using real Box for better print rendering */}
      <Box sx={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        right: '10px',
        bottom: '10px',
        border: '3px solid #d4af37',
        pointerEvents: 'none',
        zIndex: 10
      }} />

      {/* Corner Ornaments */}
      <Box sx={{
        position: 'absolute',
        top: 0, left: 0, width: '45px', height: '45px',
        backgroundImage: 'radial-gradient(circle at 0 0, #d4af37 25px, transparent 26px)',
        zIndex: 11, pointerEvents: 'none'
      }} />
      <Box sx={{
        position: 'absolute',
        top: 0, right: 0, width: '45px', height: '45px',
        backgroundImage: 'radial-gradient(circle at 100% 0, #d4af37 25px, transparent 26px)',
        zIndex: 11, pointerEvents: 'none'
      }} />
      <Box sx={{
        position: 'absolute',
        bottom: 0, left: 0, width: '45px', height: '45px',
        backgroundImage: 'radial-gradient(circle at 0 100%, #d4af37 25px, transparent 26px)',
        zIndex: 11, pointerEvents: 'none'
      }} />
      <Box sx={{
        position: 'absolute',
        bottom: 0, right: 0, width: '45px', height: '45px',
        backgroundImage: 'radial-gradient(circle at 100% 100%, #d4af37 25px, transparent 26px)',
        zIndex: 11, pointerEvents: 'none'
      }} />

      <Box sx={{
        height: '100%',
        width: '100%',
        p: '20px 60px 40px 60px', // Reduced top padding to move header up
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 12
      }}>
        <style>
          {`
            @import url('https://fonts.googleapis.com/css2?family=Alex+Brush&display=swap');
            @import url('https://fonts.googleapis.com/css2?family=Alex+Brush&family=Great+Vibes&family=Pinyon+Script&family=Rochester&family=Meie+Script&family=Playfair+Display:wght@400;700;900&family=Libre+Baskerville:wght@400;700&family=Galada&family=Hind+Siliguri:wght@400;700&display=swap');

            @media print {
              @page {
                size: A4 landscape;
                margin: 0 !important;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                width: 297mm !important;
                height: 210mm !important;
                background: #fff !important;
                overflow: hidden !important;
              }
              body * {
                visibility: hidden;
              }
              .certificate-container, .certificate-container * {
                visibility: visible;
              }
              .certificate-container {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 1122px !important;
                height: 793px !important;
                display: flex !important;
                border: 30px solid #8B4513 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                image-rendering: -webkit-optimize-contrast !important;
              }
            }

            .name-cursive {
              font-family: 'Pinyon Script', cursive !important;
              letter-spacing: 0 !important;
              word-spacing: 0.1em !important;
              font-weight: 400 !important;
              font-style: normal !important;
              text-transform: none !important;
              color: #000 !important;
              white-space: nowrap !important;
              text-rendering: optimizeLegibility !important;
              -webkit-font-smoothing: antialiased !important;
            }
            .body-text {
              font-family: 'Libre Baskerville', serif !important;
            }
            .header-text {
              font-family: 'Playfair Display', serif !important;
            }
            /* Do NOT force fonts on children with name-cursive class */
            .body-text *:not(.name-cursive) {
              font-family: inherit;
            }
          `}
        </style>
        {/* Background/Watermark */}
        <Box sx={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 0, opacity: 0.08, display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
          p: 0
        }}>
          {school?.logo && <img src={processPhotoUrl(school.logo)} alt="watermark" style={{ width: '75%', maxHeight: '75%', objectFit: 'contain' }} />}
        </Box>

        {/* Header Section */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0, position: 'relative', zIndex: 1 }}>
          {/* Left Side: Logo */}
          <Box sx={{
            width: '120px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flexShrink: 0
          }}>
            {school?.logo && (
              <img src={processPhotoUrl(school.logo)} alt="Logo" style={{ height: '110px', width: '110px', objectFit: 'contain' }} />
            )}
          </Box>

          {/* Centered School Info */}
          <Box sx={{ flex: 1, px: 2, textAlign: 'center', minWidth: 0 }}>
            <Typography component="div" sx={{
              fontWeight: '900',
              color: '#5d4037',
              fontSize: schoolNameFontSize,
              fontFamily: "'Playfair Display', 'Georgia', serif",
              textTransform: 'uppercase',
              mb: 0.1,
              textShadow: '1px 1px 1px rgba(0,0,0,0.05)',
              lineHeight: 1.1,
              letterSpacing: schoolNameLetterSpacing,
              whiteSpace: 'nowrap',
              overflow: 'visible',
              width: '100%'
            }}>
              {schoolName}
            </Typography>
            {school?.ein && (
              <Typography sx={{
                color: '#8b4513',
                fontSize: '1.1rem !important',
                fontWeight: 'bold',
                mb: 0.2,
                letterSpacing: '2px',
                fontFamily: "'Playfair Display', serif"
              }}>
                EIIN: {school.ein}
              </Typography>
            )}
            <Typography component="div" sx={{
              color: '#8b4513',
              fontSize: '1.0rem !important',
              fontWeight: '600',
              fontFamily: "'Playfair Display', serif",
              letterSpacing: '0.5px'
            }}>
              {schoolAddressDisplay}
            </Typography>
          </Box>

          {/* Right Side: QR Code */}
          <Box sx={{
            width: '120px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flexShrink: 0,
            p: 0.5,
            bgcolor: 'white',
            borderRadius: 1,
            boxShadow: '0 0 10px rgba(0,0,0,0.05)',
            mr: -2.5 // Shifted 20px right
          }}>
            <QRCodeSVG value={qrData} size={110} level="M" />
          </Box>
        </Box>

        <Box sx={{ textAlign: 'center', position: 'relative', zIndex: 1, mt: -2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 0 }}>
            <Box sx={{
              position: 'relative',
              backgroundColor: '#8b4513',
              px: 10, py: 0.8,
              borderRadius: '50px',
              border: '2px solid #d4af37',
              boxShadow: '0 5px 15px rgba(139, 69, 19, 0.4)',
            }}>
               <Typography variant="h4" className="body-text" sx={{
                fontWeight: '900',
                color: '#ffffff',
                fontSize: '2rem !important',
                textTransform: 'uppercase',
                letterSpacing: '10px',
              }}>
                Testimonial
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Content Body */}
        <Box sx={{
          textAlign: 'left',
          color: '#1a202c',
          zIndex: 1,
          px: 0,
          mt: 2,
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
          mb: 12
        }}>
          <Typography className="body-text" sx={{
            lineHeight: 1.5,
            fontSize: '1.8rem',
            color: '#2c3e50',
            fontFamily: "'Libre Baskerville', serif !important"
          }}>
            This is to certify that <span className="name-cursive" style={{ fontSize: nameFontSize, borderBottom: '2px solid #8b4513', padding: '0 8px', lineHeight: '1', display: 'inline-block', verticalAlign: 'baseline', fontFamily: "'Pinyon Script', cursive" }}>{name}</span> {genderWord} of <span className="name-cursive" style={{ fontSize: fatherNameFontSize, display: 'inline-block', fontFamily: "'Pinyon Script', cursive" }}>{fatherName}</span> and <span className="name-cursive" style={{ fontSize: motherNameFontSize, display: 'inline-block', fontFamily: "'Pinyon Script', cursive" }}>{motherName}</span> of <span className="body-text" style={{ fontWeight: '700', color: '#5d4037', fontFamily: "'Libre Baskerville', serif" }}>{studentAddress}</span> was a student of this institute. {pronoun} duly passed the <span style={{ fontWeight: 'bold', color: '#8b4513' }}>SSC Examination</span> under the <span style={{ fontWeight: 'bold' }}>{effectiveData.ssc_board || 'Board of Intermediate and Secondary Education, Cumilla'}</span> held in <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{parseInt(session) || new Date().getFullYear()}</span> from <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{finalGroup}</span> group bearing Roll No. <span style={{ fontWeight: 'bold' }}>{effectiveData.ssc_roll || 'N/A'}</span> and Registration No. <span style={{ fontWeight: 'bold' }}>{effectiveData.ssc_registration || 'N/A'}</span> in the session <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{effectiveData.ssc_session || 'N/A'}</span> and achieved <span style={{ fontWeight: 'bold', color: '#1b5e20' }}>GPA {effectiveData.ssc_gpa || 'N/A'}</span>. {possessive} date of birth is <span style={{ fontWeight: 'bold' }}>{dob}</span>.
          </Typography>

          <Typography className="body-text" sx={{
            lineHeight: 1.4,
            fontSize: '1.7rem',
            fontStyle: 'italic',
            mt: 1.5,
            fontFamily: "'Libre Baskerville', serif !important"
          }}>
            {pronoun} is a Bangladeshi by birth. To the best of my knowledge {pronoun.toLowerCase()} did not take part in any subversive activity against the discipline of state.
          </Typography>

          <Typography className="body-text" sx={{
            lineHeight: 1.4,
            fontSize: '1.7rem',
            fontWeight: '600',
            mt: 1,
            fontFamily: "'Libre Baskerville', serif !important"
          }}>
            {pronoun} possesses a good moral character. I wish {objective} every success in life.
            <span style={{ fontSize: '10px', opacity: 0.1, position: 'absolute', bottom: 0 }}>V2-AUG25</span>
          </Typography>
        </Box>

        {/* Bottom Section */}
        <Box sx={{
          position: 'absolute',
          bottom: '20px',
          left: '60px',
          right: '25px',
          zIndex: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}>
          {/* Footer Info Section - LEFT */}
          <Box sx={{ textAlign: 'left', mb: 1 }}>
            <Typography sx={{ fontWeight: 'bold', fontSize: '1.5rem !important', color: '#5d4037' }}>
              Date: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Typography>
            <Typography className="sl-no-footer" sx={{ fontWeight: '900', fontSize: '1.5rem !important', color: '#5d4037', whiteSpace: 'nowrap', mt: 1, display: 'block' }}>
              SL No: {effectiveData.student_custom_id || effectiveData.id}
            </Typography>
          </Box>

          {/* Bottom Signatures Section - RIGHT */}
          <Box sx={{ textAlign: 'center', width: '350px', mr: 0 }}>
            <Box sx={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
              {principalSig && String(school?.id) !== '19' && (
                <Box component="img" src={principalSig} sx={{
                  height: 95, position: 'absolute', bottom: 10, zIndex: 1,
                  pointerEvents: 'none'
                }} />
              )}
            </Box>
            <Box sx={{ borderTop: '3.5px solid #5d4037', pt: 1, width: '100%', position: 'relative', zIndex: 2 }}>
              <Typography sx={{ fontWeight: '900', fontSize: '1.7rem !important', textTransform: 'uppercase', color: '#5d4037', lineHeight: 1.1 }}>Head Teacher</Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default function CertificateGenerator() {
  const { id: schoolId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [rollNumber, setRollNumber] = useState('');
  const [studentName, setStudentName] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [session, setSession] = useState('');
  const [guardianSuggestions, setGuardianSuggestions] = useState([]);
  const [guardianSuggestLoading, setGuardianSuggestLoading] = useState(false);
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [student, setStudent] = useState(null);
  const [school, setSchool] = useState(null);
  const [error, setError] = useState('');
  const [certificateGenerated, setCertificateGenerated] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [bulkCertificatesGenerated, setBulkCertificatesGenerated] = useState(false);
  const { classrooms, sections, refreshAll, students } = useAcademics();
  const [bloodGroup, setBloodGroup] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const certificateRef = useRef(null);
  const bulkCertificatesRef = useRef(null);
  const [activeStep, setActiveStep] = useState(0);
  const [fontLoaded, setFontLoaded] = useState(false);

  useEffect(() => {
    const fonts = [
      { family: 'Alex Brush', weight: '400' },
      { family: 'Great Vibes', weight: '400' },
    ];
    const loadFont = (href) => new Promise((resolve) => {
      if (document.querySelector(`link[href="${href}"]`)) { resolve(); return; }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = resolve;
      link.onerror = resolve;
      document.head.appendChild(link);
    });
    Promise.all([
      loadFont('https://fonts.googleapis.com/css2?family=Alex+Brush&family=Great+Vibes&family=Pinyon+Script&family=Rochester&family=Meie+Script&family=Playfair+Display:wght@400;700;900&family=Libre+Baskerville:wght@400;700&family=Galada&family=Hind+Siliguri:wght@400;700&display=swap'),
    ]).then(() => {
      if ('fonts' in document) {
        Promise.all(fonts.map(f => document.fonts.load(`${f.weight} 3rem "${f.family}"`)))
          .catch(() => {})
          .finally(() => { setTimeout(() => setFontLoaded(true), 100); });
      } else {
        setTimeout(() => setFontLoaded(true), 300);
      }
    });
  }, []);

  const guidanceSteps = [
    { selector: '#class-select', text: 'শ্রেণি নির্বাচন করুন', autoNext: false },
    { selector: '#section-select', text: 'সেকশন নির্বাচন করুন', autoNext: false },
    { selector: '#roll-input', text: 'রোল নম্বর দিন', autoNext: false },
    { selector: '#generate-button', text: 'এখানে ক্লিক করুন', autoNext: true }
  ];

  useEffect(() => {
    if (!classFilter) {
      setActiveStep(0);
    } else if (!rollNumber) {
      setActiveStep(2); // Jump to roll if section is optional
    } else if (!certificateGenerated) {
      setActiveStep(3);
    } else {
      setActiveStep(4);
    }
  }, [classFilter, rollNumber, certificateGenerated]);

  const loadSchool = useCallback(() => { api.get(`/api/schools/${schoolId}/`).then(res => setSchool(res.data)).catch(err => console.error(err)); }, [schoolId]);
  
  const filteredSections = classFilter ? sections.filter(sec => String(sec.classroom?.id) === String(classFilter)) : [];

  useEffect(() => { 
    if (schoolId) { 
      loadSchool(); 
      refreshAll(schoolId);
    } 
  }, [schoolId, loadSchool, refreshAll]);
  
  // Update sectionFilter when class changes
  useEffect(() => {
    setSectionFilter('');
  }, [classFilter]);

  const handleEditProfile = () => { if (!isAuthenticated()) { navigate('/login'); return; } setIsEditingProfile(!isEditingProfile); };
  const handleBloodGroupChange = (value) => setBloodGroup(value);

  const handlePrintCertificate = () => {
    const el = certificateRef.current?.querySelector('.certificate-container') || certificateRef.current;
    if (!el) return;
    toast.info('Preparing for high-quality print...');

    // Save scroll and styles
    const scrollPos = window.scrollY;
    const originalTransform = el.style.transform;
    const originalMargin = el.style.margin;

    // Move to top and reset styles for capture
    window.scrollTo(0, 0);
    el.style.transform = 'none';
    el.style.margin = '0';
    el.style.width = '1122px';
    el.style.height = '793px';

    html2canvas(el, {
      scale: 4, // Higher scale for extreme sharpness
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: 1122,
      height: 793,
      windowWidth: 1122,
      windowHeight: 793,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
      letterRendering: true, // Better text sharpness
      allowTaint: true
    }).then(canvas => {
      // Restore scroll and styles
      el.style.transform = originalTransform;
      el.style.margin = originalMargin;
      window.scrollTo(0, scrollPos);

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const win = window.open('', '_blank');
      win.document.write(`
        <html>
          <head>
            <title>Certificate - ${student?.user?.first_name || 'Student'}</title>
            <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&display=swap" rel="stylesheet">
            <style>
              @page {
                size: A4 landscape;
                margin: 0 !important;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                width: 297mm !important;
                height: 210mm !important;
                background: #fff;
                overflow: hidden;
              }
              body {
                display: flex;
                align-items: center;
                justify-content: center;
              }
              img {
                width: 297mm;
                height: 210mm;
                display: block;
                border: none;
                margin: 0;
                padding: 0;
                object-fit: fill;
                image-rendering: -webkit-optimize-contrast;
                filter: contrast(1.01) saturate(1.1);
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            </style>
          </head>
          <body>
            <img src="${imgData}" />
          </body>
        </html>
      `);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
        win.close();
      }, 1000);
    }).catch(err => {
      el.style.transform = originalTransform;
      el.style.margin = originalMargin;
      window.scrollTo(0, scrollPos);
      console.error('Print capture error:', err);
      toast.error('Failed to capture certificate for print');
    });
  };

  const handleDownloadCertificate = async () => {
    const el = certificateRef.current?.querySelector('.certificate-container') || certificateRef.current;
    if (!el) return;
    toast.info('Generating PDF...');

    const originalTransform = el.style.transform;
    const originalMargin = el.style.margin;
    el.style.transform = 'none';
    el.style.margin = '0';
    el.style.width = '1122px';
    el.style.height = '793px';

    try {
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: 1122,
        height: 793,
        windowWidth: 1122,
        windowHeight: 793,
        scrollX: 0,
        scrollY: 0,
      });

      el.style.transform = originalTransform;
      el.style.margin = originalMargin;

      const pdf = new jsPDF('l', 'px', [1122, 793]);
      pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 1122, 793);
      pdf.save(`certificate-${student?.roll_number || student?.id}.pdf`);
      toast.success('Downloaded successfully');
    } catch (err) {
      el.style.transform = originalTransform;
      el.style.margin = originalMargin;
      console.error('PDF generation error:', err);
      toast.error('Failed to generate PDF');
    }
  };

  const handleGenerateCertificate = async () => {
    if (!rollNumber && !studentName) {
      setError('রোল নম্বর অথবা শিক্ষার্থীর নাম লিখুন');
      return;
    }
    setLoading(true);
    setError('');
    setStudent(null);
    setCertificateGenerated(false);

    try {
      // স্মার্ট সার্চ: নির্দিষ্ট রোল বা নামে সরাসরি এপিআই থেকে সার্চ করা
      const params = { school: schoolId, page_size: 100 };
      if (classFilter) params.classroom = classFilter;
      if (sectionFilter) params.section = sectionFilter;

      if (rollNumber) {
        params.roll = rollNumber.trim();
      } else if (studentName) {
        params.search = studentName.trim();
      }

      const res = await api.get(`/api/academics/students/`, { params });
      let matchedResults = Array.isArray(res.data) ? res.data : (res.data.results || []);

      // যদি সরাসরি রোলে না পাওয়া যায়, তবে স্পেস ছাড়া রোল দিয়ে আবার চেষ্টা করা
      if (matchedResults.length === 0 && rollNumber && rollNumber.includes(' ')) {
        const cleanRoll = rollNumber.replace(/\s+/g, '');
        const resClean = await api.get(`/api/academics/students/`, {
          params: { ...params, roll: cleanRoll }
        });
        matchedResults = Array.isArray(resClean.data) ? resClean.data : (resClean.data.results || []);
      }

      // যদি তাও না পাওয়া যায়, তবে আইকন্টেইনস সার্চ (icontains search)
      if (matchedResults.length === 0 && (rollNumber || studentName)) {
        const resSearch = await api.get(`/api/academics/students/`, {
          params: { school: schoolId, search: (rollNumber || studentName).trim() }
        });
        matchedResults = Array.isArray(resSearch.data) ? resSearch.data : (resSearch.data.results || []);
      }

      if (matchedResults.length === 0) {
        setError('এই স্কুলে এই রোল বা নামে কোনো শিক্ষার্থী পাওয়া যায়নি');
        return;
      }

      // প্রাইওরিটি ফিল্টারিং:
      // ১. টপ প্রায়োরিটি: এসএসসি বা ১০ম শ্রেণি
      // ২. সেকেন্ড প্রায়োরিটি: ৯ম শ্রেণি
      // ৩. বাকি সব

      const sscTopRegex = /দশম|ten|10|ssc|এসএসসি|পরীক্ষার্থী/i;
      const sscNineRegex = /নবম|nine|9/i;

      let finalStudent = matchedResults.find(s => sscTopRegex.test(s.classroom?.name || ''));

      if (!finalStudent) {
        finalStudent = matchedResults.find(s => sscNineRegex.test(s.classroom?.name || ''));
      }

      if (!finalStudent) {
        finalStudent = matchedResults[0]; // যদি কোনো এসএসসি রিলেটেড না পাওয়া যায়, তবে প্রথম ম্যাচটি নেওয়া
      }

      setStudent(finalStudent);
      setCertificateGenerated(true);
      toast.success('শিক্ষার্থী পাওয়া গেছে: ' + (finalStudent.user?.first_name || ''));
    } catch (err) {
        console.error('Smart search error:', err);
        setError('তথ্য খুঁজতে সমস্যা হয়েছে, আবার চেষ্টা করুন');
    } finally { setLoading(false); }
  };

  const handleReset = () => { 
    setRollNumber(''); 
    setSession(''); 
    setClassFilter(''); 
    setSectionFilter(''); 
    setStudent(null); 
    setCertificateGenerated(false); 
    setError('');
    setIsBulkMode(false);
    setSelectedStudents(new Set());
    setBulkCertificatesGenerated(false);
  };

  const getFilteredStudentsForBulk = () => {
    let filtered = [...students];
    if (classFilter) {
      filtered = filtered.filter(s => String(s.classroom?.id) === String(classFilter));
    }
    if (sectionFilter) {
      filtered = filtered.filter(s => String(s.section?.id) === String(sectionFilter));
    }
    return filtered;
  };

  const handleToggleAllStudents = () => {
    const filteredStudents = getFilteredStudentsForBulk();
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const handleToggleStudent = (studentId) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const handleGenerateBulkCertificates = () => {
    if (selectedStudents.size === 0) {
      setError('Select at least one student');
      return;
    }
    setBulkCertificatesGenerated(true);
    setError('');
  };

  const handlePrintBulkCertificates = async () => {
    if (!bulkCertificatesRef.current) return;
    toast.info('Preparing all certificates for print...');
    const container = bulkCertificatesRef.current;
    const certificateElements = container.querySelectorAll('.certificate-container');
    const printWindow = window.open('', '_blank');
    let allImagesHTML = '';

    for (let i = 0; i < certificateElements.length; i++) {
      const el = certificateElements[i];
      try {
        const canvas = await html2canvas(el, {
          scale: 3.5,
          useCORS: true,
          backgroundColor: '#ffffff',
          width: 1122,
          height: 793,
          onclone: (clonedDoc) => {
            const clonedEls = clonedDoc.querySelectorAll('.certificate-container');
            const clonedEl = clonedEls[i] || clonedEls[0] || clonedDoc.querySelector('.certificate-container');
            if (clonedEl) {
              clonedEl.style.transform = 'none';
              clonedEl.style.margin = '0 auto';
              clonedEl.style.padding = '0';
              clonedEl.style.boxShadow = 'none';
              clonedEl.style.display = 'flex';
              clonedEl.style.position = 'relative';
              clonedEl.style.border = '30px solid #8B4513';
              clonedEl.style.boxSizing = 'border-box';
              clonedEl.style.width = '1122px';
              clonedEl.style.height = '793px';
              clonedEl.style.overflow = 'hidden';
            }
          }
        });
        const isLast = i === certificateElements.length - 1;
        allImagesHTML += `
          <div style="page-break-after: ${isLast ? 'avoid' : 'always'}; page-break-inside: avoid; width: 297mm; height: 210mm; margin: 0; padding: 0; background: #fff; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center;">
            <img src="${canvas.toDataURL('image/jpeg', 1.0)}" style="width: 297mm; height: 210mm; display: block; border: none; margin: 0; padding: 0; object-fit: fill; image-rendering: -webkit-optimize-contrast; filter: contrast(1.02) saturate(1.15); -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;" />
          </div>
        `;
      } catch (err) {
        console.error(`Failed to capture certificate ${i + 1}:`, err);
      }
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Bulk Certificates</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 0 !important;
            }
            * { box-sizing: border-box; }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: 297mm !important;
              background: #fff !important;
            }
            body > div {
              box-sizing: border-box;
            }
            img {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          </style>
        </head>
        <body>
          ${allImagesHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 2000);
  };

  const handleDownloadBulkCertificates = async () => {
    if (!bulkCertificatesRef.current) return;
    toast.info('Generating Bulk PDF...');
    const container = bulkCertificatesRef.current;
    const certificateElements = container.querySelectorAll('.certificate-container');
    const pdf = new jsPDF('l', 'px', [1122, 793]);
    for (let i = 0; i < certificateElements.length; i++) {
      const el = certificateElements[i];
      try {
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          width: 1122,
          height: 793,
          onclone: (clonedDoc) => {
            const clonedEls = clonedDoc.querySelectorAll('.certificate-container');
            const clonedEl = clonedEls[i] || clonedEls[0] || clonedDoc.querySelector('.certificate-container');
            if (clonedEl) {
              clonedEl.style.transform = 'none';
              clonedEl.style.margin = '0';
              clonedEl.style.padding = '0';
              clonedEl.style.boxShadow = 'none';
              clonedEl.style.display = 'flex';
              clonedEl.style.position = 'relative';
              clonedEl.style.left = 'auto';
              clonedEl.style.top = 'auto';
              clonedEl.style.right = 'auto';
              clonedEl.style.bottom = 'auto';
              clonedEl.style.border = '30px solid #8B4513';
              clonedEl.style.boxSizing = 'border-box';
              clonedEl.style.width = '1122px';
              clonedEl.style.minWidth = '1122px';
              clonedEl.style.height = '793px';
              clonedEl.style.minHeight = '793px';
              clonedEl.style.overflow = 'hidden';
              clonedDoc.body.innerHTML = '';
              clonedDoc.body.appendChild(clonedEl);
            }
            const b = clonedDoc.body;
            const h = clonedDoc.documentElement;
            if (b) {
              b.style.margin = '0';
              b.style.padding = '0';
              b.style.overflow = 'hidden';
              b.style.background = '#fff';
              b.style.width = '1122px';
              b.style.height = '793px';
              b.style.minWidth = '1122px';
              b.style.minHeight = '793px';
              b.style.display = 'block';
            }
            if (h) {
              h.style.margin = '0';
              h.style.padding = '0';
              h.style.overflow = 'hidden';
              h.style.background = '#fff';
              h.style.width = '1122px';
              h.style.height = '793px';
            }
          }
        });
        if (i > 0) pdf.addPage([1122, 793], 'l');
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 1122, 793);
      } catch (err) {
        console.error(`Failed to capture certificate ${i + 1} for PDF:`, err);
      }
    }
    pdf.save('bulk-certificates.pdf');
    toast.success('Bulk download complete');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper elevation={0} sx={{ mb: 3, p: 3, background: 'linear-gradient(135deg, #8B4513 0%, #D4AF37 100%)', color: 'white', borderRadius: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box><Typography variant="h4" sx={{ fontWeight: 'bold' }}><EmojiEvents sx={{ mr: 1 }} /> Certificate Generator</Typography></Box>
          <Button 
            variant={isBulkMode ? "contained" : "outlined"} 
            startIcon={<CollectionsBookmark />}
            onClick={() => setIsBulkMode(!isBulkMode)}
            sx={{ borderColor: 'white', color: isBulkMode ? '#8B4513' : 'white' }}
          >
            {isBulkMode ? 'Single Mode' : 'Bulk Mode'}
          </Button>
        </Stack>
      </Paper>

      {/* Filters Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 3 }}><FormControl fullWidth><InputLabel>Class</InputLabel><Select id="class-select" value={classFilter} label="Class" onChange={(e) => { setClassFilter(e.target.value); setSectionFilter(''); }}>{classrooms.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}</Select></FormControl></Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Section</InputLabel>
              <Select
                id="section-select"
                value={sectionFilter}
                label="Section"
                onChange={(e) => setSectionFilter(e.target.value)}
                disabled={!classFilter}
              >
                <MenuItem value="">All Sections</MenuItem>
                {filteredSections.map(sec => <MenuItem key={sec.id} value={sec.id}>{sec.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          {!isBulkMode && (
            <>
              <Grid size={{ xs: 12, md: 3 }}><TextField id="student-name-search" label="শিক্ষার্থীর নাম" value={studentName} onChange={(e) => setStudentName(e.target.value)} fullWidth placeholder="যেমন: আবির" /></Grid>
              <Grid size={{ xs: 12, md: 3 }}><TextField id="roll-input" label="রোল নম্বর" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} fullWidth placeholder="ক্লাস রোল বা এসএসসি রোল" /></Grid>
              <Grid size={{ xs: 12, md: 3 }}><TextField label="Session" value={session} onChange={(e) => setSession(e.target.value)} fullWidth placeholder="2024" /></Grid>
            </>
          )}
          {isBulkMode && (
            <Grid size={{ xs: 12, md: 6 }}><TextField id="skip-to-button" label="Session" value={session} onChange={(e) => setSession(e.target.value)} fullWidth placeholder="2024" /></Grid>
          )}
        </Grid>
        <Stack direction="row" spacing={2} sx={{ mt: 3 }} flexWrap="wrap">
          {!isBulkMode ? (
            <>
              <Button id="generate-button" variant="contained" startIcon={<Search />} onClick={handleGenerateCertificate} disabled={loading} sx={{ bgcolor: '#2E7D32' }}>Generate</Button>
            </>
          ) : (
            <>
              <Button variant="contained" startIcon={<CollectionsBookmark />} onClick={handleGenerateBulkCertificates} sx={{ bgcolor: '#2E7D32' }}>Generate Selected ({selectedStudents.size})</Button>
            </>
          )}
          <Button variant="outlined" startIcon={<Refresh />} onClick={handleReset}>Reset</Button>
        </Stack>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </Paper>

      {isBulkMode && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
            <Checkbox 
              checked={selectedStudents.size === getFilteredStudentsForBulk().length && getFilteredStudentsForBulk().length > 0} 
              onClick={handleToggleAllStudents}
            />
            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
              Select All ({getFilteredStudentsForBulk().length} students)
            </Typography>
          </Stack>
          <List sx={{ maxHeight: '300px', overflow: 'auto' }}>
            {getFilteredStudentsForBulk().map(student => {
              const user = student?.user || {};
              const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;

              return (
                <ListItem key={student.id} disablePadding>
                  <Button
                    fullWidth
                    onClick={() => handleToggleStudent(student.id)}
                    sx={{ justifyContent: 'flex-start', textAlign: 'left', textTransform: 'none', color: 'text.primary', py: 1 }}
                  >
                    <Checkbox checked={selectedStudents.has(student.id)} sx={{ mr: 2 }} />
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        {`${name} (Roll: ${student.roll_number || 'N/A'})`}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {`Class: ${student.classroom?.name || 'N/A'}, Section: ${student.section?.name || 'N/A'}`}
                      </Typography>
                    </Box>
                  </Button>
                </ListItem>
              )
            })}
          </List>
        </Paper>
      )}

      {loading && <Box align="center" p={4}><CircularProgress /></Box>}

      {/* Single Certificate Render */}
      {!isBulkMode && certificateGenerated && student && (
        <Box>
          <Box display="flex" justifyContent="center" mb={4}><StudentCard data={student} school={school} bloodGroup={bloodGroup} isEditing={isEditingProfile} onEditProfile={handleEditProfile} onBloodGroupChange={handleBloodGroupChange} /></Box>
          <Stack direction="row" spacing={2} justifyContent="center" mb={4}>
            <Button variant="contained" onClick={handlePrintCertificate}>Print</Button>
            <Button variant="contained" onClick={handleDownloadCertificate} sx={{ bgcolor: '#2c3e50' }}>Download</Button>
          </Stack>
          <Box ref={certificateRef}><Certificate data={student} school={school} session={session || String(new Date().getFullYear())} /></Box>
        </Box>
      )}

      {/* Bulk Certificates Render */}
      {isBulkMode && bulkCertificatesGenerated && selectedStudents.size > 0 && (
        <Box>
          <Stack direction="row" spacing={2} justifyContent="center" mb={4}>
            <Button variant="contained" onClick={handlePrintBulkCertificates}>Print All</Button>
            <Button variant="contained" onClick={handleDownloadBulkCertificates} sx={{ bgcolor: '#2c3e50' }}>Download All (PDF)</Button>
          </Stack>
          <Box ref={bulkCertificatesRef}>
            {students.filter(s => selectedStudents.has(s.id)).map(student => (
              <Box key={student.id} sx={{ mb: 6 }}>
                <Certificate 
                  data={student} 
                  school={school} 
                  session={session || String(new Date().getFullYear())} 
                />
              </Box>
            ))}
          </Box>
        </Box>
      )}

      <InputGuidance
        steps={guidanceSteps}
        activeStep={activeStep}
        onStepComplete={() => setActiveStep(prev => prev + 1)}
      />
    </Box>
  );
}
