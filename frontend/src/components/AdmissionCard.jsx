import React from 'react';
import api from '../utils/api';
import { Box, Typography, Avatar } from '@mui/material';
import QRCode from 'qrcode.react';

export default function AdmissionCard({ data, school, exam, examSlots = [] }) {
  console.log('AdmissionCard: examSlots =', examSlots);
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

  const schoolLogo = processPhotoUrl(school?.logo);
  const userPhoto = processPhotoUrl(user.photo_url || user.photo || data.photo);
  const signatureUrl = (() => {
    if (school?.principal_signature) {
      const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/,'');
      const sig = String(school.principal_signature);
      if (sig.startsWith('http')) return sig;
      return `${base}/media/${sig.replace(/^\/+/, '')}`;
    }
    try {
      if (school?.id && String(school.id) === '19') {
        const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/,'');
        return `${base}/media/BHS/signature.png`;
      }
    } catch (_) {}
    return '/images/signatures/signature.png';
  })();

  const schoolSealUrl = school?.school_seal ? (() => {
    const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/,'');
    const seal = String(school.school_seal);
    if (seal.startsWith('http')) return seal;
    return `${base}/media/${seal.replace(/^\/+/, '')}`;
  })() : null;

  // QR Code data
  const qrData = JSON.stringify({
    type: 'admission_card',
    student_id: data?.id,
    exam_id: exam?.id,
    roll_number: rollNumber,
    name: name,
    class: className,
    section: data?.section?.name || '',
    timestamp: new Date().toISOString()
  });

  const toBnDigits = (v) => {
    const bn = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
    return String(v ?? '').replace(/[0-9]/g, d => bn[d] ?? d);
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

  return (
    <Box 
      key={`admission-card-${rollNumber || 'unknown'}`}
      className="admission-card" 
      sx={{
        background: 'linear-gradient(145deg, #f8f9ff 0%, #f0f4ff 100%)',
        borderRadius: '12px',
        color: '#1a237e',
        width: '100%',
        maxWidth: '420px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(26, 35, 126, 0.1)',
        position: 'relative',
        fontFamily: 'Hind Siliguri, Arial, sans-serif',
        border: '1px solid #e0e8ff',
        p: 3,
        lineHeight: 1.6,
        '&:hover': {
          boxShadow: '0 6px 24px rgba(26, 35, 126, 0.15)',
          transform: 'translateY(-2px)',
          transition: 'all 0.3s ease'
        }
      }}
    >
      {/* Header with Logo and Student Photo */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        mb: 2,
        padding: '12px',
        backgroundColor: '#1a237e',
        borderRadius: '8px',
        color: 'white'
      }}>
        {/* School Logo */}
        <Box 
          className="school-logo-box"
          sx={{ 
          width: '60px',
          height: '60px',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          backgroundColor: '#f5f5f5'
        }}>
          {schoolLogo ? (
            <img 
              src={schoolLogo} 
              alt="School Logo" 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = 'Logo';
              }}
            />
          ) : 'Logo'}
        </Box>
        
        {/* School Info */}
        <Box className="school-info-box" sx={{ textAlign: 'center', flex: 1, px: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ 
            fontWeight: 'bold', 
            fontSize: '1.1rem',
            mb: 0.5,
            lineHeight: 1.2,
            wordBreak: 'break-word'
          }}>
            {school?.bn_name || school?.name || 'স্কুলের নাম'}
          </Typography>
          <Typography variant="h5" sx={{ 
            fontSize: '1.3rem',
            fontWeight: 'bold',
            mb: 0.5,
            lineHeight: 1.2
          }}>
            প্রবেশপত্র
          </Typography>
          <Typography variant="body2" sx={{ 
            fontSize: '0.9rem',
            fontWeight: 500,
            lineHeight: 1.2
          }}>
            {(getExamTypeBn() ? `${getExamTypeBn()} পরিক্ষা-` : 'পরিক্ষা ') + getExamYearBn() + 'খ্রীঃ'}
          </Typography>
        </Box>
        
        {/* Student Photo */}
        <Box 
          className="student-photo-box"
          sx={{ 
          width: '60px',
          height: '75px',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          overflow: 'hidden',
          backgroundColor: '#f5f5f5'
        }}>
          {userPhoto ? (
            <img 
              src={userPhoto} 
              alt="Student" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = 'Photo';
              }}
            />
          ) : 'Photo'}
        </Box>
      </Box>

      {/* Student Info */}
      <Box sx={{ 
        mb: 2,
        padding: '16px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <Typography variant="h6" sx={{ 
          fontWeight: 'bold',
          fontSize: '1.1rem',
          textAlign: 'center',
          mb: 1.5,
          lineHeight: 1.2
        }}>
          {name || 'শিক্ষার্থীর নাম'}
        </Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
          <Typography variant="body2" sx={{ flex: '1 1 45%', minWidth: '120px' }}>
            <strong>Roll:</strong> {rollNumber || 'রোল'}
          </Typography>
          <Typography variant="body2" sx={{ flex: '1 1 45%', minWidth: '120px' }}>
            <strong>Class:</strong> {className && className !== 'N/A' ? `${className} ${section}` : 'শ্রেণি'}
          </Typography>
          <Typography variant="body2" sx={{ flex: '1 1 100%' }}>
            <strong>Exam ID:</strong> {exam?.exam_id || 'N/A'}
          </Typography>
        </Box>
      </Box>

      {/* Exam Details */}
      <Box sx={{ 
        mb: 2, 
        border: '1px solid #d1d9ff', 
        borderRadius: '8px', 
        p: 2,
        backgroundColor: '#f8f9ff',
        boxShadow: '0 2px 8px rgba(26, 35, 126, 0.05)'
      }}>
        <Typography variant="subtitle2" sx={{ 
          fontWeight: 'bold', 
          mb: 1.5, 
          textAlign: 'center',
          borderBottom: '1px solid #e0e0e0',
          pb: 0.5
        }}>
          পরীক্ষার রুটিন (সময়):
        </Typography>
        
        {/* Exam Routine Table - Two Columns */}
        {(() => {
              // Filter slots to match student's classroom and section
              const studentClassroomId = data?.classroom?.id;
              const studentSectionId = data?.section?.id;
              const filteredSlots = examSlots.filter(slot => {
                // Match classroom if set
                const classroomMatch = !slot.classroom || slot.classroom === studentClassroomId;
                // Match section if set, else match any section (including null)
                const sectionMatch = !slot.section || slot.section === studentSectionId;
                return classroomMatch && sectionMatch;
              });
              
              if (filteredSlots.length === 0) {
                return (
                  <Typography variant="body2" sx={{ textAlign: 'center', color: '#757575' }}>
                    রুটিন পাওয়া যায়নি
                  </Typography>
                );
              }
              
              // Helper to format date in Bengali
      const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const [year, month, day] = dateStr.split('-').map(Number);
        const d = new Date(year, month - 1, day);
        const dayBn = toBnDigits(d.getDate());
        const monthBn = toBnDigits(d.getMonth() + 1);
        return `${dayBn}/${monthBn}`;
      };
              
              // Helper to format time
              const formatTime = (timeStr) => {
                if (!timeStr) return '';
                const [h, m] = timeStr.split(':');
                return `${toBnDigits(h)}:${toBnDigits(m)}`;
              };
              
              return (
                <Box sx={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr',
                  gap: 1,
                  border: '1px solid #e0e8ff',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  {/* Header */}
                  <Box sx={{ 
                    backgroundColor: '#1a237e', 
                    color: 'white', 
                    p: 1, 
                    fontWeight: 'bold', 
                    textAlign: 'center'
                  }}>
                    তারিখ
                  </Box>
                  <Box sx={{ 
                    backgroundColor: '#1a237e', 
                    color: 'white', 
                    p: 1, 
                    fontWeight: 'bold', 
                    textAlign: 'center'
                  }}>
                    বিষয়
                  </Box>
                  
                  {/* Rows */}
                  {filteredSlots.map((slot, idx) => (
                    <>
                      <Box key={`date-${slot.id}`} sx={{ 
                        p: 1, 
                        backgroundColor: idx % 2 === 0 ? 'white' : '#f8f9ff',
                        textAlign: 'center'
                      }}>
                        <Typography variant="body2" sx={{ fontWeight: '500' }}>
                          {formatDate(slot.exam_date)} {formatTime(slot.start_time) ? `(${formatTime(slot.start_time)})` : ''}
                        </Typography>
                      </Box>
                      <Box key={`subject-${slot.id}`} sx={{ 
                        p: 1, 
                        backgroundColor: idx % 2 === 0 ? 'white' : '#f8f9ff',
                        textAlign: 'center'
                      }}>
                        <Typography variant="body2" sx={{ fontWeight: '500' }}>
                          {slot.subject_name || 'বিষয়'}
                        </Typography>
                      </Box>
                    </>
                  ))}
                </Box>
              );
            })()}
      </Box>

      {/* Valid For removed per requirement */}

      {/* Footer */}
      <Box sx={{
        mt: 3,
        pt: 3,
        borderTop: '2px dashed #d1d9ff'
      }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center',
          alignItems: 'flex-end',
          gap: 2
        }}>
          {/* Principal's Signature */}
          <Box sx={{ 
            textAlign: 'center', 
            flex: 1,
            maxWidth: '300px',
            pt: 1
          }}>
            <Box sx={{ 
              height: '60px',
              borderBottom: '2px solid #1a237e',
              mb: 0.5,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              pb: 0.5,
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: `url("${schoolSealUrl || '/images/signatures/seal.png'}")`,
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                opacity: 0.2,
                zIndex: 0
              }
            }}>
              {signatureUrl && (
                <img 
                  src={signatureUrl} 
                  alt="Principal's Signature" 
                  style={{ 
                    maxHeight: '50px',
                    maxWidth: '100%',
                    objectFit: 'contain',
                    position: 'relative',
                    zIndex: 2,
                    opacity: 1
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              )}
            </Box>
            <Typography variant="body2" sx={{ 
              fontWeight: 'bold',
              fontSize: '0.85rem'
            }}>
              প্রধান শিক্ষক
            </Typography>
          </Box>

                  </Box>
      </Box>
    </Box>
  );
}
