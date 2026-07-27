import React, { useState, useEffect, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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
import {
  Search as SearchIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Person as PersonIcon,
  EmojiEvents as AwardIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  CollectionsBookmark as BulkIcon
} from '@mui/icons-material';
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
            <Box sx={{ width: '80px', height: '100px', border: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' }}><PersonIcon sx={{ fontSize: 40, color: '#999' }} /></Box>
          )}
        </Box>
        <Box sx={{ flex: 1, fontSize: '0.75rem' }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>{name}</Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>Class: {classroom} {section && `(${section})`}</Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>Roll: {rollNumber}</Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>Gender: {gender || 'N/A'}</Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>DOB: {dateOfBirth || 'N/A'}</Typography>
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold' }}>Blood Group: {isEditing ? (
            <Select value={bloodGroup} onChange={(e) => onBloodGroupChange(e.target.value)} size="small" sx={{ fontSize: '0.7rem', height: '25px' }}>
              {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => <MenuItem key={bg} value={bg}>{bg}</MenuItem>)}
            </Select>
          ) : bloodGroup || 'Not Set'}</Typography>
        </Box>
      </Box>
      <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={onEditProfile} sx={{ position: 'absolute', top: 8, right: 8, fontSize: '0.7rem' }}>{isEditing ? 'Save' : 'Edit'}</Button>
    </Box>
  );
};

const Certificate = ({ data, school, session }) => {
  if (!data) return <Box sx={{ p: 4, textAlign: 'center' }}><Typography variant="h6" color="error">No student data available</Typography></Box>;
  
  const effectiveData = data;
  const user = effectiveData?.user || {};
  const name = effectiveData?.student_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Student Name';
  const rollNumber = effectiveData?.roll_number || '';
  const classroom = effectiveData?.classroom?.name || '';
  const section = effectiveData?.section?.name || '';
  const dob = user.date_of_birth || effectiveData.birth_date || 'N/A';
  const admissionDate = effectiveData.admission_date || '01 January 2020';
  const fatherName = effectiveData.father_name || '';
  const motherName = effectiveData.mother_name || '';
  const guardianName = effectiveData.guardian_name || (effectiveData.guardian ? `${effectiveData.guardian.first_name || ''} ${effectiveData.guardian.last_name || ''}`.trim() : '');

  const processPhotoUrl = (url) => {
    if (!url) return null;
    const base = (api?.defaults?.baseURL || window.location.origin).replace(/\/$/, '');
    return url.startsWith('http') ? url : `${base}/media/${url.replace(/^\/+/, '')}`;
  };

  const getClassLevel = (cn) => {
    const name = String(cn || '').toLowerCase();
    if (name.includes('দশম') || name.includes('ten') || name.includes('10')) return 10;
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

  const translateSectionName = (sn) => ({ 'বিজ্ঞান': 'Science', 'ব্যবসা': 'Commerce', 'মানবিক': 'Arts', 'ক': 'A', 'খ': 'B', 'গ': 'C' }[sn] || sn);

  const principalSig = processPhotoUrl(school?.principal_signature);
  const schoolSeal = processPhotoUrl(school?.school_seal);

  return (
    <Box className="certificate-container" sx={{
      position: 'relative',
      backgroundColor: '#fdfbf7',
      width: '100%',
      height: '100vh', // Forces container to fill full height of the landscape page
      aspectRatio: '297/210',
      maxWidth: '100%',
      p: '15px 35px',
      border: '12px double #8B4513',
      outline: '1px solid #d4af37',
      outlineOffset: '-18px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      boxSizing: 'border-box',
      overflow: 'hidden',
      fontFamily: "'Playfair Display', serif",
      mx: 0,
      boxShadow: 'inset 0 0 40px rgba(139, 69, 19, 0.04)',
      '@media print': {
        height: '100vh',
        width: '100vw',
        p: '10px 30px',
        border: '12px double #8B4513',
      }
    }}>
      {/* Background/Watermark */}
      <Box sx={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 0, opacity: 0.07, display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
        p: 6 // Keep away from edges
      }}>
        {school?.logo && <img src={processPhotoUrl(school.logo)} alt="watermark" style={{ width: '90%', maxHeight: '55%', objectFit: 'contain' }} />}
      </Box>

      {/* Header Section */}
      <Box sx={{ textAlign: 'center', position: 'relative', zIndex: 1, mt: 1 }}>
        <Typography variant="h2" sx={{
          fontWeight: '900',
          color: '#5d4037',
          fontSize: '4.2rem',
          fontFamily: "'Playfair Display', serif",
          textTransform: 'uppercase',
          mb: 0.5,
          textShadow: '1px 1px 2px rgba(0,0,0,0.1)'
        }}>
          {school?.name || 'SCHOOL NAME'}
        </Typography>
        <Typography variant="h5" sx={{
          color: '#8b4513',
          fontSize: '1.6rem',
          fontWeight: '600',
          mb: 1.5,
          fontFamily: "'Hind Siliguri', sans-serif"
        }}>
          {school?.address || 'SCHOOL ADDRESS'}
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5, borderBottom: '2.5px solid #8b4513', pb: 0.5, px: 4 }}>
          <Typography sx={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#5d4037' }}>No: SLC-{session}-{rollNumber || '000'}</Typography>
          <Typography sx={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#5d4037' }}>Date: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1.5 }}>
          <Typography variant="h4" sx={{
            fontWeight: '900',
            color: '#ffffff',
            backgroundColor: '#8b4513',
            px: 12, py: 1.5,
            borderRadius: '5px',
            fontSize: '1.8rem',
            textTransform: 'uppercase',
            letterSpacing: '6px',
            boxShadow: '0 3px 6px rgba(0,0,0,0.15)'
          }}>
            Testimonial
          </Typography>
        </Box>
      </Box>

      {/* Content Body */}
      <Box sx={{
        textAlign: 'justify',
        color: '#2c3e50',
        zIndex: 1,
        px: 6,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        pb: 35 // Extra padding for absolute signatures
      }}>
        <Typography sx={{ lineHeight: 1.8, fontSize: '1.45rem', mb: 2.5 }}>
          This is to certify that <span style={{ fontWeight: '900', fontSize: '1.7rem', color: '#1a202c', borderBottom: '2px solid #8b4513', padding: '0 5px' }}>{name}</span>,
          son/daughter of <span style={{ fontWeight: 'bold', color: '#1a202c' }}>{fatherName || guardianName}</span> and <span style={{ fontWeight: 'bold', color: '#1a202c' }}>{motherName}</span>,
          was a bona fide student of <span style={{ fontWeight: 'bold' }}>{school?.name}</span> from <span style={{ fontWeight: 'bold' }}>{calculatedAdmissionDate}</span> to <span style={{ fontWeight: 'bold' }}>{session || new Date().getFullYear()}</span>.
        </Typography>

        <Typography sx={{ lineHeight: 1.8, fontSize: '1.45rem', mb: 2.5 }}>
          He/She successfully studied up to <span style={{ fontWeight: 'bold', fontSize: '1.5rem' }}>{translateClassName(classroom)}</span> and appeared in the final examination under this institution in Session <span style={{ fontWeight: 'bold' }}>{session}</span>.
          According to the school records, his/her <span style={{ fontWeight: 'bold' }}>Date of Birth</span> is <span style={{ fontWeight: 'bold', borderBottom: '2px solid #d4af37' }}>{dob}</span>.
        </Typography>

        <Typography sx={{ lineHeight: 1.8, fontSize: '1.45rem', mb: 3 }}>
          He/She is leaving this institution on his/her own request for higher education. During his/her stay in the school, his/her attendance and conduct were found to be satisfactory.
          To the best of our knowledge, he/she bears a good moral character.
        </Typography>

        <Box sx={{ display: 'flex', gap: 6, mt: 15, p: 2, border: '2px dashed #8b4513', borderRadius: 4, bgcolor: 'transparent', justifyContent: 'center' }}>
           <Typography sx={{ fontSize: '1.15rem', color: '#5d4037' }}><strong>Character:</strong> Good</Typography>
           <Typography sx={{ fontSize: '1.15rem', color: '#5d4037' }}><strong>Conduct:</strong> Satisfactory</Typography>
           <Typography sx={{ fontSize: '1.15rem', color: '#5d4037' }}><strong>Reason:</strong> Higher Education</Typography>
        </Box>
      </Box>

      {/* Absolute Bottom Signatures Section */}
      <Box sx={{
        position: 'absolute',
        bottom: '15px',
        left: '80px',
        right: '80px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        zIndex: 1
      }}>
        <Box sx={{ textAlign: 'center', minWidth: '220px' }}>
          <Box sx={{ borderTop: '2.5px solid #5d4037', pt: 1 }}>
            <Typography sx={{ fontWeight: '900', fontSize: '1.2rem', textTransform: 'uppercase', color: '#5d4037' }}>Class Teacher</Typography>
          </Box>
        </Box>

        <Box sx={{ textAlign: 'center', position: 'relative', minWidth: '320px' }}>
          {schoolSeal && (
            <Box component="img" src={schoolSeal} sx={{
              position: 'absolute',
              top: -140, left: '50%',
              transform: 'translateX(-50%)',
              width: 170, opacity: 0.7, zIndex: 0
            }} />
          )}
          {principalSig && (
            <Box component="img" src={principalSig} sx={{
              height: 100, position: 'absolute', bottom: 65, left: '50%',
              transform: 'translateX(-50%)', zIndex: 1
            }} />
          )}
          <Box sx={{ borderTop: '2.5px solid #5d4037', pt: 1, position: 'relative', zIndex: 2 }}>
            <Typography sx={{ fontWeight: '900', fontSize: '1.4rem', textTransform: 'uppercase', color: '#5d4037' }}>Principal / Head Master</Typography>
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#5d4037' }}>(Official Seal)</Typography>
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
    const el = certificateRef.current;
    if (!el) return;
    html2canvas(el, {
      scale: 4,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    }).then(canvas => {
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const win = window.open('', '_blank');
      win.document.write(`
        <html>
          <head>
            <title>Certificate Print</title>
            <style>
              @page {
                size: A4 landscape;
                margin: 0 !important;
              }
              body {
                margin: 0;
                padding: 0;
                overflow: hidden;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              img {
                width: 100vw;
                height: 100vh;
                object-fit: fill;
                display: block;
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
      setTimeout(() => { win.print(); win.close(); }, 500);
    });
  };

  const handleDownloadCertificate = async () => {
    const el = certificateRef.current;
    if (!el) return;
    toast.info('Generating PDF...');
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#fff8dc' });
    const pdf = new jsPDF('l', 'mm', 'a4');
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 10, 10, 277, 190);
    pdf.save(`certificate-${student?.id}.pdf`);
    toast.success('Downloaded successfully');
  };

  const handleGenerateCertificate = async () => {
    if (!rollNumber && !(studentName && guardianName)) { setError('Enter Roll or both Student and Guardian names'); return; }
    setLoading(true); setError(''); setStudent(null); setCertificateGenerated(false);
    try {
      let foundStudents = [...students];

      if (rollNumber) {
        foundStudents = foundStudents.filter(s => String(s.roll_number) === String(rollNumber));
      }
      if (studentName) {
        const normalizedQuery = studentName.toLowerCase().trim();
        foundStudents = foundStudents.filter(s => 
          (s.user?.first_name?.toLowerCase().includes(normalizedQuery)) || 
          (s.user?.last_name?.toLowerCase().includes(normalizedQuery)) || 
          (s.name?.toLowerCase().includes(normalizedQuery))
        );
      }
      if (classFilter) {
        foundStudents = foundStudents.filter(s => String(s.classroom?.id) === String(classFilter));
        if (sectionFilter) {
          foundStudents = foundStudents.filter(s => String(s.section?.id) === String(sectionFilter));
        }
      }

      if (foundStudents.length === 0) { setError('No student found'); return; }
      setStudent(foundStudents[0]); setCertificateGenerated(true);
    } catch (err) { setError('Failed to generate'); } finally { setLoading(false); }
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
    toast.info('Preparing to print all certificates...');
    const container = bulkCertificatesRef.current;
    const certificateElements = container.querySelectorAll('.certificate-container');
    const printWindow = window.open('', '_blank');
    let allImagesHTML = '';

    for (let i = 0; i < certificateElements.length; i++) {
      const canvas = await html2canvas(certificateElements[i], {
        scale: 4, // Matching single print scale
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const isLast = i === certificateElements.length - 1;
      allImagesHTML += `
        <div style="page-break-after: ${isLast ? 'avoid' : 'always'}; width: 100vw; height: 100vh;">
          <img src="${canvas.toDataURL('image/jpeg', 1.0)}" style="width: 100%; height: 100%; object-fit: fill; display: block;" />
        </div>
      `;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>All Certificates</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 0 !important;
            }
            body {
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            div {
              width: 100vw;
              height: 100vh;
              overflow: hidden;
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
    }, 500);
  };

  const handleDownloadBulkCertificates = async () => {
    if (!bulkCertificatesRef.current) return;
    toast.info('Generating PDF with all certificates...');
    const container = bulkCertificatesRef.current;
    const certificateElements = container.querySelectorAll('.certificate-container');
    const pdf = new jsPDF('l', 'mm', 'a4');
    for (let i = 0; i < certificateElements.length; i++) {
      const canvas = await html2canvas(certificateElements[i], {
        scale: 2,
        useCORS: true,
        backgroundColor: '#fff8dc'
      });
      if (i > 0) {
        pdf.addPage();
      }
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 10, 10, 277, 190);
    }
    pdf.save('all-certificates.pdf');
    toast.success('Downloaded all certificates successfully');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper elevation={0} sx={{ mb: 3, p: 3, background: 'linear-gradient(135deg, #8B4513 0%, #D4AF37 100%)', color: 'white', borderRadius: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box><Typography variant="h4" sx={{ fontWeight: 'bold' }}><AwardIcon sx={{ mr: 1 }} /> Certificate Generator</Typography></Box>
          <Button 
            variant={isBulkMode ? "contained" : "outlined"} 
            startIcon={<BulkIcon />} 
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
              <Grid size={{ xs: 12, md: 3 }}><TextField id="roll-input" label="Roll Number" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} fullWidth /></Grid>
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
              <Button id="generate-button" variant="contained" startIcon={<SearchIcon />} onClick={handleGenerateCertificate} disabled={loading} sx={{ bgcolor: '#2E7D32' }}>Generate</Button>
            </>
          ) : (
            <>
              <Button variant="contained" startIcon={<BulkIcon />} onClick={handleGenerateBulkCertificates} sx={{ bgcolor: '#2E7D32' }}>Generate Selected ({selectedStudents.size})</Button>
            </>
          )}
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={handleReset}>Reset</Button>
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
                  <ListItemButton 
                    dense
                    onClick={() => handleToggleStudent(student.id)}
                    selected={selectedStudents.has(student.id)}
                  >
                    <ListItemIcon>
                      <Checkbox checked={selectedStudents.has(student.id)} />
                    </ListItemIcon>
                    <ListItemText 
                      primary={`${name} (Roll: ${student.roll_number || 'N/A'})`}
                      secondary={`Class: ${student.classroom?.name || 'N/A'}, Section: ${student.section?.name || 'N/A'}`}
                    />
                  </ListItemButton>
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
