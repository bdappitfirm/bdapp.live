import React, { useState, useEffect, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Search from '@mui/icons-material/Search';
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
  ListItem
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

const CertificatePage = ({ data, school, session, lang = 'en' }) => {
  if (!data) return <Box sx={{ p: 4, textAlign: 'center' }}><Typography variant="h6" color="error">No student data available</Typography></Box>;
  
  const effectiveData = data;
  const user = effectiveData?.user || {};

  const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
  };

  const isBn = lang === 'bn';

  // Helper for Bengali numbers
  const toBnNum = (n) => String(n).replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[d]);

  // Names logic
  const rawNameEn = `${user.first_name_en || ''} ${user.last_name_en || ''}`.trim() || effectiveData?.student_name_en || effectiveData?.student_name || `${user.first_name || ''} ${user.last_name || ''}`.trim();
  const rawNameBn = effectiveData?.student_name || `${user.first_name || ''} ${user.last_name || ''}`.trim();
  const name = isBn ? rawNameBn : toTitleCase(rawNameEn);

  const rawFatherEn = effectiveData.father_name_en || effectiveData.father_name || '';
  const rawFatherBn = effectiveData.father_name || '';
  const fatherName = isBn ? rawFatherBn : toTitleCase(rawFatherEn);

  const rawMotherEn = effectiveData.mother_name_en || effectiveData.mother_name || '';
  const rawMotherBn = effectiveData.mother_name || '';
  const motherName = isBn ? rawMotherBn : toTitleCase(rawMotherEn);

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === 'N/A') return isBn ? 'N/A' : 'N/A';
    try {
      const parts = dateStr.split('-');
      let d, m, y;
      if (parts.length === 3) {
        if (parts[0].length === 4) { [y, m, d] = parts; }
        else { [d, m, y] = parts; }
      } else {
        const dt = new Date(dateStr);
        if (isNaN(dt.getTime())) return dateStr;
        d = dt.getDate(); m = dt.getMonth() + 1; y = dt.getFullYear();
      }

      if (isBn) {
        const monthsBn = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
        return `${toBnNum(parseInt(d))} ${monthsBn[parseInt(m) - 1]} ${toBnNum(y)}`;
      } else {
        const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return `${parseInt(d)} ${monthsEn[parseInt(m) - 1]} ${y}`;
      }
    } catch (e) { return dateStr; }
  };

  const dob = formatDate(user.date_of_birth || effectiveData.birth_date);

  const formatStudentAddress = (addressStr) => {
    if (!addressStr) return '';
    const trimmed = String(addressStr).trim();
    const parts = trimmed.split(/[,，]/).map(p => p.trim()).filter(Boolean);
    if (isBn) {
        if (parts.length === 4) {
          const prefixes = ['গ্রাম-', 'ডাক-', 'উপজেলা-', 'জেলা-'];
          return parts.map((p, i) => `${prefixes[i]}${p}`).join(', ');
        }
        return trimmed;
    } else {
        if (parts.length === 4) {
          const prefixes = ['Village-', 'P.O-', 'Upazilla-', 'District-'];
          return parts.map((p, i) => `${prefixes[i]}${p}`).join(', ');
        }
        return trimmed;
    }
  };

  const rawStudentAddress = isBn ? (effectiveData?.address || user?.address || '') : (effectiveData?.address_en || effectiveData?.address || user?.address_en || user?.address || '');
  const schoolAddressDisplay = isBn ? (school?.address || '') : (school?.address_en || school?.address || '').trim().toUpperCase();
  const studentAddress = formatStudentAddress(rawStudentAddress) || schoolAddressDisplay;

  const processPhotoUrl = (url) => {
    if (!url) return null;
    const base = (api?.defaults?.baseURL || window.location.origin).replace(/\/$/, '');
    return url.startsWith('http') ? url : `${base}/media/${url.replace(/^\/+/, '')}`;
  };

  const detectGroup = () => {
    const g = effectiveData.student_group || effectiveData.group || effectiveData.user?.group || effectiveData.user?.student_group;
    if (g) return g;
    const sec = String(effectiveData.section?.name || '').toLowerCase();
    if (sec.includes('বিজ্ঞান') || sec.includes('science')) return 'science';
    if (sec.includes('মানবিক') || sec.includes('arts')) return 'arts';
    if (sec.includes('ব্যবসা') || sec.includes('commerce')) return 'commerce';
    return '';
  };
  const rawGroup = detectGroup();
  const normalizeGroup = (g) => {
    const lower = String(g || '').toLowerCase().trim();
    if (isBn) {
        if (lower === 'science' || lower === 'বিজ্ঞান') return 'বিজ্ঞান';
        if (lower === 'arts' || lower === 'humanities' || lower === 'মানবিক') return 'মানবিক';
        if (lower.includes('commerce') || lower.includes('business') || lower.includes('ব্যবসা') || lower.includes('ব্যবসায়') || lower.includes('ব্যবসায়')) return 'ব্যবসায় শিক্ষা';
        return g || 'N/A';
    } else {
        if (lower === 'science' || lower === 'বিজ্ঞান') return 'Science';
        if (lower === 'arts' || lower === 'humanities' || lower === 'মানবিক') return 'Humanities';
        if (lower.includes('commerce') || lower.includes('business') || lower.includes('ব্যবসা') || lower.includes('ব্যবসায়') || lower.includes('ব্যবসায়')) return 'Business Studies';
        return g || 'N/A';
    }
  };
  const finalGroup = normalizeGroup(rawGroup);

  const schoolName = isBn ? (school?.name || '') : (school?.name_en || school?.name || '');
  const schoolNameFontSize = schoolName.length >= 35 ? '1.45rem !important' : schoolName.length >= 25 ? '1.85rem !important' : '2.6rem !important';

  const nameFontSize = name.length > 35 ? '2.2rem' : name.length > 25 ? '2.8rem' : '3.8rem';
  const fatherNameFontSize = fatherName.length > 35 ? '1.8rem' : fatherName.length > 25 ? '2.2rem' : '2.8rem';
  const motherNameFontSize = motherName.length > 35 ? '1.8rem' : motherName.length > 25 ? '2.2rem' : '2.8rem';

  const qrData = `It is a S.S.C. Certificate of\nName: ${rawNameEn}\nFather: ${rawFatherEn}\nMother: ${rawMotherEn}\nDOB: ${dob}\nVerify: ${window.location.origin}/verify/${effectiveData.id}`;

  const studentGender = effectiveData.gender || user.gender || 'male';
  const genderWord = isBn ? (studentGender === 'female' ? 'কন্যা' : 'পুত্র') : (studentGender === 'female' ? 'daughter' : 'son');
  const pronoun = isBn ? (studentGender === 'female' ? 'সে' : 'সে') : (studentGender === 'female' ? 'She' : 'He');
  const possessive = isBn ? (studentGender === 'female' ? 'তার' : 'তার') : (studentGender === 'female' ? 'Her' : 'His');
  const objective = isBn ? (studentGender === 'female' ? 'তাকে' : 'তাকে') : (studentGender === 'female' ? 'her' : 'him');

  return (
    <Box className={`certificate-page certificate-${lang}`} sx={{
      position: 'relative', backgroundColor: '#fdfbf7', width: '1122px', height: '793px', p: 0, border: '30px solid #8B4513', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden',
      fontFamily: isBn ? "'Hind Siliguri', sans-serif" : "'Libre Baskerville', serif", mx: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
      transform: { xs: 'scale(0.3)', sm: 'scale(0.5)', md: 'scale(0.8)', lg: 'scale(1)' }, transformOrigin: 'top center', mb: { xs: -50, sm: -35, md: -15, lg: 0 },
      pageBreakAfter: 'always',
      '@media print': {
        width: '1122px !important', height: '793px !important', margin: '0 !important', boxShadow: 'none !important', transform: 'none !important', border: '30px solid #8B4513 !important',
        WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', position: 'relative !important',
      }
    }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Alex+Brush&family=Great+Vibes&family=Pinyon+Script&family=Galada&family=Hind+Siliguri:wght@400;700&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap');
          .name-cursive {
            font-weight: 400 !important;
            font-style: normal !important;
            text-transform: none !important;
          }
          @media print {
            .certificate-page, .certificate-page * {
              visibility: visible !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}
      </style>
      <Box sx={{ position: 'absolute', top: '10px', left: '10px', right: '10px', bottom: '10px', border: '3px solid #d4af37', pointerEvents: 'none', zIndex: 10 }} />
      {/* Corner Ornaments */}
      <Box sx={{ position: 'absolute', top: 0, left: 0, width: '45px', height: '45px', backgroundImage: 'radial-gradient(circle at 0 0, #d4af37 25px, transparent 26px)', zIndex: 11 }} />
      <Box sx={{ position: 'absolute', top: 0, right: 0, width: '45px', height: '45px', backgroundImage: 'radial-gradient(circle at 100% 0, #d4af37 25px, transparent 26px)', zIndex: 11 }} />
      <Box sx={{ position: 'absolute', bottom: 0, left: 0, width: '45px', height: '45px', backgroundImage: 'radial-gradient(circle at 0 100%, #d4af37 25px, transparent 26px)', zIndex: 11 }} />
      <Box sx={{ position: 'absolute', bottom: 0, right: 0, width: '45px', height: '45px', backgroundImage: 'radial-gradient(circle at 100% 100%, #d4af37 25px, transparent 26px)', zIndex: 11 }} />

      <Box sx={{ height: '100%', width: '100%', p: '20px 60px 40px 60px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 12 }}>
        {/* Background Watermark */}
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, opacity: 0.08, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          {school?.logo && <img src={processPhotoUrl(school.logo)} alt="watermark" style={{ width: '75%', maxHeight: '75%', objectFit: 'contain' }} />}
        </Box>

        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0, position: 'relative', zIndex: 1 }}>
          <Box sx={{ width: '120px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {school?.logo && <img src={processPhotoUrl(school.logo)} alt="Logo" style={{ height: '110px', width: '110px', objectFit: 'contain' }} />}
          </Box>
          <Box sx={{ flex: 1, px: 2, textAlign: 'center', minWidth: 0 }}>
            <Typography component="div" sx={{ fontWeight: '900', color: '#5d4037', fontSize: schoolNameFontSize, textTransform: isBn ? 'none' : 'uppercase', mb: 0.1, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{schoolName}</Typography>
            {school?.ein && <Typography sx={{ color: '#8b4513', fontSize: '1.1rem !important', fontWeight: 'bold', mb: 0.2 }}>{isBn ? 'ইআইআইএন: ' + toBnNum(school.ein) : 'EIIN: ' + school.ein}</Typography>}
            <Typography component="div" sx={{ color: '#8b4513', fontSize: '1.0rem !important', fontWeight: '600' }}>{schoolAddressDisplay}</Typography>
          </Box>
          <Box sx={{ width: '120px', display: 'flex', justifyContent: 'center', flexShrink: 0, p: 0.5, bgcolor: 'white', borderRadius: 1, boxShadow: '0 0 10px rgba(0,0,0,0.05)' }}>
            <QRCodeSVG value={qrData} size={110} level="M" />
          </Box>
        </Box>

        {/* Testimonial Header Box - PURE INLINE STYLES for html2canvas reliability */}
        <div className="testimonial-header-wrap" style={{ textAlign: 'center', marginTop: '0px', marginBottom: '8px', position: 'relative', zIndex: 100 }}>
            <div className="testimonial-header-box" data-testimonial-box="true" style={{
              display: 'inline-block',
              backgroundColor: '#8b4513',
              background: '#8b4513',
              paddingLeft: '90px',
              paddingRight: '90px',
              paddingTop: '10px',
              paddingBottom: '10px',
              borderRadius: '50px',
              border: '2px solid #d4af37',
              color: '#ffffff',
              minWidth: '300px',
              boxShadow: 'none',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            }}>
               <div className="testimonial-header-text" data-testimonial-text="true" style={{
                 fontWeight: 900,
                 fontSize: '2.2rem',
                 textTransform: isBn ? 'none' : 'uppercase',
                 letterSpacing: isBn ? '2px' : '10px',
                 fontFamily: isBn ? "'Galada', cursive" : "'Playfair Display', serif",
                 color: '#ffffff',
                 display: 'block',
                 whiteSpace: 'nowrap',
                 lineHeight: 1.2
               }}>
                 {isBn ? 'প্রশংসাপত্র' : 'Testimonial'}
               </div>
            </div>
        </div>

        {/* Serial Number Section - Left Aligned under Testimonial */}
        <div style={{ textAlign: 'left', marginTop: '5px', marginBottom: '-10px', position: 'relative', zIndex: 10 }}>
            <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#5d4037', fontFamily: isBn ? "'Hind Siliguri', sans-serif" : "'Libre Baskerville', serif" }}>
                {isBn ? 'ক্রমিক নং: ' + toBnNum(effectiveData.student_custom_id || effectiveData.id) : 'SL No: ' + (effectiveData.student_custom_id || effectiveData.id)}
            </span>
        </div>

        {/* Body */}
        <Box sx={{ textAlign: 'left', color: '#1a202c', zIndex: 1, mt: 2, display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', mb: 12 }}>
          {isBn ? (
            <Typography sx={{ lineHeight: 1.8, fontSize: '1.8rem', color: '#2c3e50', fontFamily: "'Hind Siliguri', sans-serif", fontStyle: 'italic' }}>
                এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, <span className="name-cursive" style={{ fontSize: nameFontSize, borderBottom: '2px solid #8b4513', padding: '0 8px', display: 'inline-block', fontFamily: "'Galada', cursive", fontStyle: 'normal' }}>{name}</span>, পিতা: <span className="name-cursive" style={{ fontSize: fatherNameFontSize, display: 'inline-block', fontFamily: "'Galada', cursive", fontStyle: 'normal' }}>{fatherName}</span>, মাতা: <span className="name-cursive" style={{ fontSize: motherNameFontSize, display: 'inline-block', fontFamily: "'Galada', cursive", fontStyle: 'normal' }}>{motherName}</span>, ঠিকানা: <span style={{ fontWeight: '700', fontStyle: 'normal' }}>{studentAddress}</span> এই প্রতিষ্ঠানের একজন নিয়মিত শিক্ষার্থী ছিল। {pronoun} <span style={{ fontWeight: 'bold', fontStyle: 'normal' }}>{effectiveData.ssc_board || 'কুমিল্লা শিক্ষা বোর্ড'}</span>-এর অধীনে <span style={{ fontWeight: 'bold', fontStyle: 'normal' }}>{toBnNum(parseInt(session) || 2024)}</span> সালের এসএসসি পরীক্ষায় <span style={{ fontWeight: 'bold', fontStyle: 'normal' }}>{finalGroup}</span> বিভাগ থেকে রোল নম্বর: <span style={{ fontWeight: 'bold', fontStyle: 'normal' }}>{toBnNum(effectiveData.ssc_roll || '') || 'N/A'}</span> এবং রেজিস্ট্রেশন নম্বর: <span style={{ fontWeight: 'bold', fontStyle: 'normal' }}>{toBnNum(effectiveData.ssc_registration || '') || 'N/A'}</span>, শিক্ষাবর্ষ: <span style={{ fontWeight: 'bold', fontStyle: 'normal' }}>{toBnNum(effectiveData.ssc_session || '') || 'N/A'}</span>-এ অংশগ্রহণ করে <span style={{ fontWeight: 'bold', color: '#1b5e20', fontStyle: 'normal' }}>জিপিএ {toBnNum(effectiveData.ssc_gpa || '') || 'N/A'}</span> পেয়ে উত্তীর্ণ হয়েছে। {possessive} জন্ম তারিখ: <span style={{ fontWeight: 'bold', fontStyle: 'normal' }}>{dob}</span>।
                <br /><br />
                আমার জানামতে {objective} রাষ্ট্রবিরোধী কোনো কাজে লিপ্ত ছিল না। {pronoun} সৎ চরিত্রের অধিকারী। আমি তার সর্বাঙ্গীণ মঙ্গল ও উজ্জ্বল ভবিষ্যৎ কামনা করি।
            </Typography>
          ) : (
            <Typography sx={{ lineHeight: 1.5, fontSize: '1.8rem', color: '#2c3e50', fontFamily: "'Libre Baskerville', serif", fontStyle: 'italic' }}>
                This is to certify that <span className="name-cursive" style={{ fontSize: nameFontSize, borderBottom: '2px solid #8b4513', padding: '0 8px', lineHeight: '1', display: 'inline-block', verticalAlign: 'baseline', fontFamily: "'Pinyon Script', cursive", fontStyle: 'normal' }}>{name}</span> {genderWord} of <span className="name-cursive" style={{ fontSize: fatherNameFontSize, display: 'inline-block', fontFamily: "'Pinyon Script', cursive", fontStyle: 'normal' }}>{fatherName}</span> and <span className="name-cursive" style={{ fontSize: motherNameFontSize, display: 'inline-block', fontFamily: "'Pinyon Script', cursive", fontStyle: 'normal' }}>{motherName}</span> of <span style={{ fontWeight: '700', color: '#5d4037' }}>{studentAddress}</span> was a student of this institute. {pronoun} duly passed the <span style={{ fontWeight: 'bold', color: '#8b4513' }}>SSC Examination</span> under the <span style={{ fontWeight: 'bold' }}>{effectiveData.ssc_board || 'Board of Intermediate and Secondary Education, Cumilla'}</span> held in <span style={{ fontWeight: 'bold' }}>{parseInt(session) || new Date().getFullYear()}</span> from <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{finalGroup}</span> group bearing Roll No. <span style={{ fontWeight: 'bold' }}>{effectiveData.ssc_roll || 'N/A'}</span> and Registration No. <span style={{ fontWeight: 'bold' }}>{effectiveData.ssc_registration || 'N/A'}</span> in the session <span style={{ fontWeight: 'bold' }}>{effectiveData.ssc_session || 'N/A'}</span> and secured <span style={{ fontWeight: 'bold', color: '#1b5e20' }}>GPA {effectiveData.ssc_gpa || 'N/A'} in the scale of 5.00</span>. {possessive} date of birth is <span style={{ fontWeight: 'bold' }}>{dob}</span>.
                <br /><br />
                {pronoun} is a Bangladeshi by birth. To the best of my knowledge {pronoun.toLowerCase()} did not take part in any subversive activity against the discipline of state. {pronoun} possesses a good moral character. I wish {objective} every success in life.
            </Typography>
          )}
        </Box>

        {/* Footer */}
        <Box sx={{ position: 'absolute', bottom: '20px', left: '60px', right: '60px', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Box sx={{ textAlign: 'left' }}>
            <Typography sx={{ fontWeight: 'bold', fontSize: '1.2rem !important', color: '#5d4037' }}>{isBn ? 'তারিখ: ' + toBnNum(new Date().toLocaleDateString('bn-BD')) : 'Date: ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', width: '300px' }}>
            <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center', minHeight: '60px' }}>
              {/* Manual signature space */}
            </Box>
            <Box sx={{ borderTop: '3px solid #5d4037', pt: 1 }}>
              <Typography sx={{ fontWeight: '900', fontSize: '1.4rem !important', textTransform: 'uppercase', color: '#5d4037' }}>{isBn ? 'প্রধান শিক্ষক' : 'Head Teacher'}</Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

const Certificate = ({ data, school, session }) => {
  const isSchool62 = String(school?.id) === '62';

  return (
    <Box className="dual-certificate-container">
      <CertificatePage data={data} school={school} session={session} lang="en" />
      {isSchool62 && (
        <>
          <Box sx={{ height: '40px', '@media print': { display: 'none' } }} /> {/* Gap in UI preview */}
          <CertificatePage data={data} school={school} session={session} lang="bn" />
        </>
      )}
    </Box>
  );
};

export default function CertificateGenerator() {
  const { id: schoolId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [rollNumber, setRollNumber] = useState('');
  const [studentName, setStudentName] = useState('');
  const [session, setSession] = useState('');
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
  const { classrooms, sections, refreshAll, students, loading: academicsLoading, fetchStudentsScoped, setStudents } = useAcademics();
  const [bloodGroup, setBloodGroup] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const certificateRef = useRef(null);
  const bulkCertificatesRef = useRef(null);
  const [activeStep, setActiveStep] = useState(0);
  const [isSearchingBulk, setIsSearchingBulk] = useState(false);

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
          .catch(() => {});
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
  
  const filteredSections = classFilter ? sections.filter(sec => Number(sec.classroom?.id) === Number(classFilter)) : [];

  useEffect(() => { 
    if (schoolId) { 
      loadSchool(); 
      refreshAll(schoolId);
    } 
  }, [schoolId, loadSchool, refreshAll]);
  
  // Update sectionFilter when class changes
  useEffect(() => {
    setSectionFilter('');
    if (isBulkMode) {
      setSelectedStudents(new Set());
      setBulkCertificatesGenerated(false);
    }
  }, [classFilter, isBulkMode]);

  useEffect(() => {
    if (isBulkMode) {
      setSelectedStudents(new Set());
      setBulkCertificatesGenerated(false);
    }
  }, [sectionFilter, isBulkMode]);

  const handleSearchStudentsBulk = async () => {
    if (!classFilter) {
      setError('Please select a class first');
      return;
    }
    setIsSearchingBulk(true);
    setError('');
    try {
      const filters = { classroom: classFilter };
      if (sectionFilter) filters.section = sectionFilter;
      const results = await fetchStudentsScoped(schoolId, filters);
      if (results.length === 0) {
        setError('No students found for the selected criteria');
      } else {
        setStudents(results);
        toast.success(`${results.length} students loaded`);
      }
    } catch (err) {
      console.error('Bulk search error:', err);
      setError('Failed to fetch students. Please check your connection.');
    } finally {
      setIsSearchingBulk(false);
    }
  };

  const handleEditProfile = () => { if (!isAuthenticated()) { navigate('/login'); return; } setIsEditingProfile(!isEditingProfile); };
  const handleBloodGroupChange = (value) => setBloodGroup(value);

  const getHtml2CanvasOptions = (scale = 3.0) => ({
    scale,
    useCORS: true,
    backgroundColor: '#ffffff',
    width: 1122,
    height: 793,
    logging: false,
    allowTaint: true,
    scrollX: 0,
    scrollY: 0,
    windowWidth: 1400,
    windowHeight: 900,
    imageTimeout: 15000,
    onclone: (clonedDoc) => {
      const pages = clonedDoc.querySelectorAll('.certificate-page');
      pages.forEach(p => {
        p.style.setProperty('-webkit-print-color-adjust', 'exact', 'important');
        p.style.setProperty('print-color-adjust', 'exact', 'important');
        p.style.transform = 'none';
        p.style.webkitTransform = 'none';
      });

      const testimonialBoxes = clonedDoc.querySelectorAll('[data-testimonial-box="true"]');
      testimonialBoxes.forEach(box => {
        box.style.setProperty('display', 'inline-block', 'important');
        box.style.setProperty('backgroundColor', '#8b4513', 'important');
        box.style.setProperty('background', '#8b4513', 'important');
        box.style.setProperty('paddingLeft', '90px', 'important');
        box.style.setProperty('paddingRight', '90px', 'important');
        box.style.setProperty('paddingTop', '10px', 'important');
        box.style.setProperty('paddingBottom', '10px', 'important');
        box.style.setProperty('borderRadius', '50px', 'important');
        box.style.setProperty('border', '2px solid #d4af37', 'important');
        box.style.setProperty('color', '#ffffff', 'important');
        box.style.setProperty('minWidth', '300px', 'important');
        box.style.setProperty('zIndex', '9999', 'important');
        box.style.setProperty('position', 'relative', 'important');
        box.style.setProperty('opacity', '1', 'important');
        box.style.setProperty('visibility', 'visible', 'important');
      });

      const testimonialTexts = clonedDoc.querySelectorAll('[data-testimonial-text="true"]');
      testimonialTexts.forEach(txt => {
        txt.style.setProperty('fontWeight', '900', 'important');
        txt.style.setProperty('fontSize', '2.2rem', 'important');
        txt.style.setProperty('letterSpacing', txt.textContent && /[a-zA-Z]/.test(txt.textContent) ? '10px' : '2px', 'important');
        txt.style.setProperty('fontFamily', txt.textContent && /[a-zA-Z]/.test(txt.textContent) ? "'Playfair Display', serif" : "'Galada', cursive", 'important');
        txt.style.setProperty('color', '#ffffff', 'important');
        txt.style.setProperty('display', 'block', 'important');
        txt.style.setProperty('whiteSpace', 'nowrap', 'important');
        txt.style.setProperty('lineHeight', '1.2', 'important');
        txt.style.setProperty('opacity', '1', 'important');
        txt.style.setProperty('visibility', 'visible', 'important');
        txt.style.setProperty('position', 'relative', 'important');
        txt.style.setProperty('zIndex', '10000', 'important');
        txt.style.textTransform = txt.textContent && /[a-zA-Z]/.test(txt.textContent) ? 'uppercase' : 'none';
      });

      const allDivs = clonedDoc.querySelectorAll('*');
      allDivs.forEach(el => {
        const cs = window.getComputedStyle(el);
        const bg = cs.backgroundColor;
        if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
          el.style.setProperty('background-color', bg, 'important');
          el.style.setProperty('background', bg, 'important');
        }
        const color = cs.color;
        if (color) {
          el.style.setProperty('color', color, 'important');
        }
      });
    }
  });

  const waitForFonts = async () => {
    if ('fonts' in document && document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) {}
    }
    await new Promise(r => setTimeout(r, 400));
  };

  const handlePrintCertificate = async () => {
    const container = certificateRef.current;
    if (!container) return;
    toast.info('Preparing high-quality dual-page print...');
    await waitForFonts();

    const pages = container.querySelectorAll('.certificate-page');
    const printWindow = window.open('', '_blank');
    const imageDataUrls = [];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const canvas = await html2canvas(page, getHtml2CanvasOptions(3.5));
      imageDataUrls.push(canvas.toDataURL('image/jpeg', 1.0));
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Certificate - ${student?.user?.first_name || 'Student'}</title>
          <style>
            @page { size: A4 landscape; margin: 0 !important; }
            body { margin: 0 !important; padding: 0 !important; background: #fff; }
            .page-container {
              width: 297mm;
              height: 210mm;
              page-break-after: always;
              overflow: hidden;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .page-container:last-child { page-break-after: avoid; }
            img { width: 297mm; height: 210mm; display: block; object-fit: fill; }
          </style>
        </head>
        <body>
          ${imageDataUrls.map(src => `<div class="page-container"><img src="${src}" /></div>`).join('')}
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 1000);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadCertificate = async () => {
    const container = certificateRef.current;
    if (!container) return;
    toast.info('Generating Dual-Page PDF...');
    await waitForFonts();

    const pages = container.querySelectorAll('.certificate-page');
    const pdf = new jsPDF('l', 'px', [1122, 793]);

    try {
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const canvas = await html2canvas(page, getHtml2CanvasOptions(2.5));

        if (i > 0) pdf.addPage([1122, 793], 'l');
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 1122, 793);
      }
      pdf.save(`certificate-${student?.roll_number || student?.id}.pdf`);
      toast.success('Downloaded successfully');
    } catch (err) {
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

      // যদি তাও না পাওয়া যায়, তবে আইকন্টেইনস সার্চ (icontains search) - Keeping filters
      if (matchedResults.length === 0 && (rollNumber || studentName)) {
        const resSearch = await api.get(`/api/academics/students/`, {
          params: {
            school: schoolId,
            search: (rollNumber || studentName).trim(),
            classroom: classFilter,
            section: sectionFilter
          }
        });
        matchedResults = Array.isArray(resSearch.data) ? resSearch.data : (resSearch.data.results || []);
      }

      if (matchedResults.length === 0) {
        setError('এই স্কুলে এই রোল বা নামে কোনো শিক্ষার্থী পাওয়া যায়নি। অনুগ্রহ করে শ্রেণি ও সেকশন সঠিক আছে কিনা পরীক্ষা করুন।');
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

  const getFilteredStudentsForBulk = useCallback(() => {
    let filtered = [...students];
    if (classFilter) {
      filtered = filtered.filter(s => {
        const cid = s.classroom?.id || s.classroom_id || s.classroom;
        return Number(cid) === Number(classFilter);
      });
    }
    if (sectionFilter) {
      filtered = filtered.filter(s => {
        const sid = s.section?.id || s.section_id || s.section;
        return Number(sid) === Number(sectionFilter);
      });
    }
    return filtered;
  }, [students, classFilter, sectionFilter]);

  const handleToggleAllStudents = () => {
    const filteredStudents = getFilteredStudentsForBulk();
    const filteredIds = filteredStudents.map(s => s.id);

    // Check if ALL currently filtered students are already selected
    const allFilteredSelected = filteredIds.every(id => selectedStudents.has(id));

    setSelectedStudents(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        // Unselect only the currently filtered ones
        filteredIds.forEach(id => next.delete(id));
      } else {
        // Select all currently filtered ones
        filteredIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleToggleStudent = (studentId) => {
    setSelectedStudents(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const handleGenerateBulkCertificates = () => {
    if (selectedStudents.size === 0) {
      setError('Select at least one student');
      return;
    }
    setBulkCertificatesGenerated(true);
    setError('');

    // Auto-scroll to results
    setTimeout(() => {
      if (bulkCertificatesRef.current) {
        bulkCertificatesRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handlePrintBulkCertificates = async () => {
    if (!bulkCertificatesRef.current) return;
    toast.info('Preparing all dual-page certificates for print...');
    await waitForFonts();
    const container = bulkCertificatesRef.current;
    const pages = container.querySelectorAll('.certificate-page');
    const printWindow = window.open('', '_blank');
    const imageDataUrls = [];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      try {
        const canvas = await html2canvas(page, getHtml2CanvasOptions(3.0));
        imageDataUrls.push(canvas.toDataURL('image/jpeg', 0.95));
      } catch (err) {
        console.error(`Failed to capture page ${i + 1}:`, err);
      }
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Bulk Certificates</title>
          <style>
            @page { size: A4 landscape; margin: 0 !important; }
            body { margin: 0 !important; padding: 0 !important; background: #fff; }
            .page-container {
              width: 297mm;
              height: 210mm;
              page-break-after: always;
              overflow: hidden;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .page-container:last-child { page-break-after: avoid; }
            img { width: 297mm; height: 210mm; display: block; object-fit: fill; }
          </style>
        </head>
        <body>
          ${imageDataUrls.map(src => `<div class="page-container"><img src="${src}" /></div>`).join('')}
          <script>
            window.onload = () => {
              setTimeout(() => { window.print(); window.close(); }, 2000);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadBulkCertificates = async () => {
    if (!bulkCertificatesRef.current) return;
    toast.info('Generating Bulk Dual-Page PDF...');
    await waitForFonts();
    const container = bulkCertificatesRef.current;
    const pages = container.querySelectorAll('.certificate-page');
    const pdf = new jsPDF('l', 'px', [1122, 793]);

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      try {
        const canvas = await html2canvas(page, getHtml2CanvasOptions(2.0));
        if (i > 0) pdf.addPage([1122, 793], 'l');
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 1122, 793);
      } catch (err) {
        console.error(`Failed to capture page ${i + 1} for PDF:`, err);
      }
    }
    pdf.save('bulk-certificates-dual.pdf');
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
              <Button
                variant="contained"
                startIcon={<Search />}
                onClick={handleSearchStudentsBulk}
                disabled={isSearchingBulk || academicsLoading}
                sx={{ bgcolor: '#1976d2' }}
              >
                Search Students
              </Button>
              <Button
                variant="contained"
                startIcon={<CollectionsBookmark />}
                onClick={handleGenerateBulkCertificates}
                disabled={selectedStudents.size === 0}
                sx={{ bgcolor: '#2E7D32' }}
              >
                Generate Selected ({selectedStudents.size})
              </Button>
            </>
          )}
          <Button variant="outlined" startIcon={<Refresh />} onClick={handleReset}>Reset</Button>
        </Stack>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </Paper>

      {isBulkMode && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Checkbox
                indeterminate={selectedStudents.size > 0 && !getFilteredStudentsForBulk().every(s => selectedStudents.has(s.id))}
                checked={getFilteredStudentsForBulk().length > 0 && getFilteredStudentsForBulk().every(s => selectedStudents.has(s.id))}
                onClick={handleToggleAllStudents}
              />
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                Select All ({getFilteredStudentsForBulk().length} students)
              </Typography>
            </Stack>
            {selectedStudents.size > 0 && (
              <Button size="small" onClick={() => setSelectedStudents(new Set())}>Clear Selection</Button>
            )}
          </Stack>
          {(isSearchingBulk || academicsLoading) ? (
            <Box align="center" p={3}><CircularProgress size={30} /><Typography variant="body2" sx={{ mt: 1 }}>Loading students...</Typography></Box>
          ) : (
            <List sx={{ maxHeight: '400px', overflow: 'auto', border: '1px solid #eee', borderRadius: 1 }}>
              {getFilteredStudentsForBulk().length === 0 ? (
                <Box p={4} textAlign="center" color="text.secondary">
                  <Typography>No students found. Try changing filters or clicking "Search Students".</Typography>
                </Box>
              ) : getFilteredStudentsForBulk().map(student => {
                const user = student?.user || {};
                const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;

                return (
                  <ListItem key={student.id} disablePadding divider>
                    <Button
                      fullWidth
                      onClick={() => handleToggleStudent(student.id)}
                      sx={{ justifyContent: 'flex-start', textAlign: 'left', textTransform: 'none', color: 'text.primary', py: 1.5 }}
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
          )}
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
