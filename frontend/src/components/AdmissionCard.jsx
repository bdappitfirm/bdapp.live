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
        p: { xs: 0.5, sm: 1 }, // Increased padding
        lineHeight: 1.4, // Increased line height
        display: 'block',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        boxSizing: 'border-box',
        overflow: 'hidden', // Avoid scroll inside card
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
          width: { xs: '85px', sm: '115px' },
          height: { xs: '85px', sm: '115px' },
          border: '1.5px solid #1a237e',
          borderRadius: '5px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'white',
          p: 0.3
        }}>
          <QRCode value={qrData} size={isMobile ? 80 : 105} level="H" />
        </Box>
        
        {/* School Info */}
        <Box sx={{ textAlign: 'center', flex: 1, px: { xs: 0.5, sm: 1.5 } }}>
          <Typography sx={{
            fontWeight: 'bold', 
            fontSize: { xs: '1.0rem', sm: '1.35rem' },
            lineHeight: 1.1,
            color: '#000',
            mb: 0.5
          }}>
            {school?.bn_name || school?.name}
          </Typography>
          <Typography sx={{
            fontSize: { xs: '1.4rem', sm: '1.8rem' },
            fontWeight: '900',
            color: '#1a237e',
            my: 0.2,
            letterSpacing: '1px'
          }}>
            প্রবেশপত্র
          </Typography>
          <Typography sx={{
            fontSize: { xs: '0.9rem', sm: '1.1rem' },
            fontWeight: 700,
            color: '#000'
          }}>
            {(getExamTypeBn() ? `${getExamTypeBn()} পরীক্ষা-` : 'পরীক্ষা ') + getExamYearBn() + 'খ্রিঃ'}
          </Typography>
        </Box>
        
        {/* Student Photo */}
        <Box sx={{
          width: { xs: '85px', sm: '110px' },
          height: { xs: '105px', sm: '135px' },
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
          mb: 0.8,
          padding: '12px 10px',
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
        <Box sx={{
          mb: 0.8,
          border: '1.5px solid #d1d9ff',
          borderRadius: '8px',
          p: 1.2,
          backgroundColor: 'rgba(248, 249, 255, 0.75)',
          boxShadow: '0 2px 8px rgba(26, 35, 126, 0.05)',
          position: 'relative',
          zIndex: 1
        }}>
          <Typography variant="h6" sx={{
              fontWeight: 'bold',
              mb: 0.8,
              textAlign: 'center',
              borderBottom: '2px solid #e0e0e0',
              pb: 0.5,
              fontSize: '1.1rem',
              lineHeight: 1.3
            }}>
              পরীক্ষার রুটিনঃ
            </Typography>

          {/* Exam Routine Table - Four Columns */}
          {(() => {
                // Filter slots to match student's classroom and section
                const studentClassroomId = data?.classroom?.id;
                const studentSectionId = data?.section?.id;
                const filteredSlots = examSlots.filter(slot => {
                  // Match classroom if set
                  const classroomMatch = !slot.classroom || String(slot.classroom) === String(studentClassroomId);
                  // Match section if set, else match any section (including null)
                  const sectionMatch = !slot.section || String(slot.section) === String(studentSectionId);
                  return classroomMatch && sectionMatch;
                });

                if (filteredSlots.length === 0) {
                  return (
                    <Typography variant="body1" sx={{ textAlign: 'center', color: '#757575', fontSize: '0.9rem' }}>
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
                  const [hStr, mStr] = timeStr.split(':');
                  const h = parseInt(hStr, 10) || 0;
                  const m = mStr ? mStr.padStart(2, '0') : '00';
                  const ampm = h >= 12 ? 'PM' : 'AM';
                  let h12 = h % 12;
                  if (h12 === 0) h12 = 12;
                  const period = h < 12 ? 'সকাল' : (h < 15 ? 'দুপুর' : 'বিকাল');
                  const minPart = m !== '00' ? `:${m}` : '';
                  return `${period} ${h12}${minPart} ${ampm}`;
                };

                return (
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: '0.8fr 1.7fr 0.8fr 1.7fr',
                    gridAutoRows: 'auto',
                    gap: 0.2,
                    border: '1px solid #e0e8ff',
                    borderRadius: '4px',
                    overflow: 'visible',
                    fontSize: '11.5px !important'
                  }}>
                    {/* Header */}
                    <Box sx={{
                      backgroundColor: '#1a237e',
                      color: 'white',
                      py: 0.3,
                      px: 0.1,
                      fontWeight: 'bold',
                      textAlign: 'center',
                      fontSize: '11px !important',
                      lineHeight: 1.1
                    }}>
                      তারিখ
                    </Box>
                    <Box sx={{
                      backgroundColor: '#1a237e',
                      color: 'white',
                      py: 0.3,
                      px: 0.1,
                      fontWeight: 'bold',
                      textAlign: 'center',
                      fontSize: '11px !important',
                      lineHeight: 1.1
                    }}>
                      বিষয়
                    </Box>
                    <Box sx={{
                      backgroundColor: '#1a237e',
                      color: 'white',
                      py: 0.3,
                      px: 0.1,
                      fontWeight: 'bold',
                      textAlign: 'center',
                      fontSize: '11px !important',
                      lineHeight: 1.1
                    }}>
                      তারিখ
                    </Box>
                    <Box sx={{
                      backgroundColor: '#1a237e',
                      color: 'white',
                      py: 0.3,
                      px: 0.1,
                      fontWeight: 'bold',
                      textAlign: 'center',
                      fontSize: '11px !important',
                      lineHeight: 1.1
                    }}>
                      বিষয়
                    </Box>

                    {/* Rows */}
                    {(() => {
                      const rows = [];
                      for (let i = 0; i < filteredSlots.length; i += 2) {
                        const slot1 = filteredSlots[i];
                        const slot2 = filteredSlots[i + 1];
                        rows.push(
                          <React.Fragment key={`row-${i}`}>
                            <Box sx={{
                              py: 0.3,
                              px: 0.1,
                              backgroundColor: (i/2) % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(248,249,255,0.6)',
                              textAlign: 'center',
                              borderBottom: '0.5px solid #e0e8ff'
                            }}>
                              <Box sx={{ fontWeight: '600', fontSize: '11px !important', whiteSpace: 'nowrap', lineHeight: 1.1 }}>
                                {slot1 ? formatDate(slot1.exam_date) + (formatTime(slot1.start_time) ? ` (${formatTime(slot1.start_time)})` : '') : ''}
                              </Box>
                            </Box>
                            <Box sx={{
                              py: 0.3,
                              px: 0.1,
                              backgroundColor: (i/2) % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(248,249,255,0.6)',
                              textAlign: 'center',
                              borderBottom: '0.5px solid #e0e8ff'
                            }}>
                              <Box sx={{ fontWeight: '600', fontSize: '11px !important', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.1 }}>
                                {slot1?.subject_name || ''}
                              </Box>
                            </Box>
                            <Box sx={{
                              py: 0.3,
                              px: 0.1,
                              backgroundColor: (i/2) % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(248,249,255,0.6)',
                              textAlign: 'center',
                              borderBottom: '0.5px solid #e0e8ff'
                            }}>
                              <Box sx={{ fontWeight: '600', fontSize: '11px !important', whiteSpace: 'nowrap', lineHeight: 1.1 }}>
                                {slot2 ? formatDate(slot2.exam_date) + (formatTime(slot2.start_time) ? ` (${formatTime(slot2.start_time)})` : '') : ''}
                              </Box>
                            </Box>
                            <Box sx={{
                              py: 0.3,
                              px: 0.1,
                              backgroundColor: (i/2) % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(248,249,255,0.6)',
                              textAlign: 'center',
                              borderBottom: '0.5px solid #e0e8ff'
                            }}>
                              <Box sx={{ fontWeight: '600', fontSize: '11px !important', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.1 }}>
                                {slot2?.subject_name || ''}
                              </Box>
                            </Box>
                          </React.Fragment>
                        );
                      }
                      return rows;
                    })()}
                  </Box>
                );
              })()}
        </Box>
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
            <Typography variant="body1" sx={{
              fontSize: '0.75rem', // Reduced
              lineHeight: 1.2
            }}>
              তাং
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
                opacity: 0.5,
                zIndex: 0
              }
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
              <>
                <Typography variant="body1" sx={{
                  fontWeight: 'bold',
                  fontSize: '0.9rem', // Reduced
                  lineHeight: 1.2
                }}>
                  প্রধান শিক্ষক
                </Typography>
                <Typography variant="body1" sx={{
                  fontSize: '0.75rem', // Reduced
                  lineHeight: 1.2,
                  mt: 0.2
                }}>
                  {school?.bn_name || school?.name || 'স্কুলের নাম'}
                </Typography>
              </>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
