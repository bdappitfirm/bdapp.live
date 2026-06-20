import React from 'react';
import { Box, Typography, Avatar, IconButton, Tooltip } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import { QRCodeCanvas } from 'qrcode.react';
import './IDCard.css';
import api from '../utils/api';

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

// Helper function to process photo URL
const processPhotoUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const base = String((api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : ''))).replace(/\/+$/,'');
  return `${base}${url.startsWith('/') ? url : '/' + url}`;
};

export default function IDCard({ type = 'student', data, school, classrooms = [], sections = [], overridePhone, signatureUrl: propSignatureUrl }) {
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
  const defaultSignatureUrl = '/images/signatures/signature.png';
  const signatureUrl = (() => {
    if (propSignatureUrl) return propSignatureUrl;
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
    return defaultSignatureUrl;
  })();
  
  const handlePrintSingle = () => {
    const printWindow = window.open('', '_blank');
    const cardElement = document.getElementById(`id-card-${data.id}`);
    if (cardElement && printWindow) {
      // Clone the element to preserve all computed styles
      const clonedElement = cardElement.cloneNode(true);
      
      // Copy computed styles for all elements
      const copyComputedStyles = (source, target) => {
        const computedStyle = window.getComputedStyle(source);
        for (let i = 0; i < computedStyle.length; i++) {
          const property = computedStyle[i];
          target.style.setProperty(property, computedStyle.getPropertyValue(property), computedStyle.getPropertyPriority(property));
        }
        
        // Recursively copy styles for child elements
        const sourceChildren = source.children;
        const targetChildren = target.children;
        for (let i = 0; i < sourceChildren.length; i++) {
          if (targetChildren[i]) {
            copyComputedStyles(sourceChildren[i], targetChildren[i]);
          }
        }
      };
      
      copyComputedStyles(cardElement, clonedElement);
      
      printWindow.document.write(`
        <html>
          <head>
            <title>ID Card - ${data?.user?.username || 'User'}</title>
            <style>
              @page { size: A4; margin: 10mm; }
              body { 
                margin: 0; 
                padding: 10mm; 
                font-family: Arial, sans-serif; 
                background: white !important; 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important;
              }
              
              /* Force exact dimensions */
              .id-card-front, .id-card-back { 
                width: 250px !important; 
                min-height: 386px !important;
                max-height: none !important;
                height: auto !important;
                position: relative !important; 
                display: flex !important;
                flex-direction: column !important;
                overflow: visible !important;
                border: 2px solid #0a4b94 !important;
                box-shadow: none !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              
              .id-card-front { 
                margin-bottom: 4mm !important; 
                background: white !important;
              }
              
              .id-card-back { 
                background: white !important;
              }
              
              .id-card-wrapper { 
                position: relative !important; 
                display: block !important;
                margin-bottom: 20px;
              }
              
              /* Preserve all element positioning */
              * { 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important;
                box-sizing: border-box !important;
              }
              
              .MuiBox-root { 
                display: flex !important;
                flex-direction: column !important;
              }
              
              .MuiTypography-root { 
                display: block !important;
              }
              
              .MuiAvatar-root, .MuiAvatar-img { 
                display: block !important; 
                visibility: visible !important; 
                opacity: 1 !important; 
              }
              
              /* Ensure footer is visible */
              .id-card-front > .MuiBox-root:last-child,
              .id-card-back > .MuiBox-root:last-child {
                display: flex !important;
                visibility: visible !important;
                opacity: 1 !important;
                background-color: #0a4b94 !important;
                color: white !important;
              }
              
              /* Ensure footer text is visible */
              .id-card-front > .MuiBox-root:last-child .MuiTypography-root,
              .id-card-back > .MuiBox-root:last-child .MuiTypography-root {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                color: white !important;
                font-weight: bold !important;
                font-size: 0.7rem !important;
              }
              
              @media print {
                body { margin: 0; padding: 10mm; }
                .no-print { display: none !important; }
              }
            </style>
          </head>
          <body>
            ${clonedElement.outerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };
  
  const isStudent = type === 'student';
  const user = data?.user || {};
  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
  const currentYear = new Date().getFullYear();

  // Function to process photo URLs
  const processPhotoUrl = (url) => {
    if (!url) return null;
    if (typeof url !== 'string') return url;
    if (url.startsWith('http')) return url;
    const base = api.defaults?.baseURL || (process.env.REACT_APP_API_URL || window.location.origin);
    const cleanedBase = String(base).replace(/\/+$/,'');
    if (url.startsWith('/media/')) return `${cleanedBase}${url}`;
    if (url.startsWith('media/')) return `${cleanedBase}/${url}`;
    return `${cleanedBase}/media/${url.replace(/^\/+|\/+$/g, '')}`;
  };

  const schoolLogo = processPhotoUrl(school?.logo);
  const userPhoto = processPhotoUrl(user.photo_url || user.photo || data.photo);
  
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
  
  // Generate QR code data - simpler format for easier scanning
  // Using a simpler format than JSON to make QR smaller and more reliable
  const qrData = `STU|${data.id}|${customIdNumber}|${encodeURIComponent(name)}|${school?.ein || school?.id}`;

  const CARD_WIDTH = 250;
  const CARD_HEIGHT = 386;

  return (
    <Box className="id-card-wrapper" sx={{ position: 'relative' }}>
      {/* Print Button */}
      <Tooltip title="Print this card" className="no-print">
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
        {/* Front Side - Portrait - EXACT SIZE */}
        <Box className="id-card id-card-front" sx={{ 
          background: 'white',
          borderRadius: 0,
          color: 'black',
          position: 'relative',
          boxShadow: 'none',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '386px !important',
          width: '250px !important',
          border: '2px solid #0a4b94',
          '&.id-card-front': {
            height: '386px !important',
            width: '250px !important',
            minHeight: '386px !important',
            maxHeight: '386px !important'
          }
        }}>
          {/* Top Header - Blue Section */}
          <Box sx={{ 
            bgcolor: '#0a4b94',
            p: 0.2,
            color: 'white',
            textAlign: 'center',
            position: 'relative'
          }}>
            {/* School Logo */}
            {schoolLogo && (
              <Avatar 
                src={schoolLogo} 
                sx={{ 
                  width: 35, 
                  height: 35, 
                  border: '1px solid white',
                  bgcolor: 'white',
                  mx: 'auto',
                  mb: 0.15
                }} 
              />
            )}
            {/* School Info */}
            <Typography variant="h6" sx={{ 
              fontWeight: 'bold', 
              lineHeight: 1.1, 
              fontSize: '0.8rem !important',
              mb: 0.05,
              whiteSpace: 'normal',
              wordWrap: 'break-word',
              display: 'block',
              letterSpacing: '-0.01em'
            }}>
              {school?.name || 'School Name'}
            </Typography>
            {school?.ein && (
              <Typography variant="body2" sx={{ 
                fontSize: '0.7rem',
                opacity: 0.9
              }}>
                EIIN No.- {school.ein}
              </Typography>
            )}
          </Box>

          {/* Photo Section */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center',
            mt: 0.4,
            mb: 0.15,
            position: 'relative',
            zIndex: 1
          }}>
            <Box sx={{
              width: 110,
              height: 130,
              border: '2px solid #0a4b94',
              bgcolor: 'white',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative'
            }}>
              {/* Badge on top of the photo */}
              <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bgcolor: '#0a4b94',
                color: 'white',
                px: 0.5,
                py: 0.2,
                textAlign: 'center',
                zIndex: 2,
                fontSize: '0.5rem',
                fontWeight: 'bold'
              }}>
                {type === 'student' ? 'Student ID Card' : type === 'teacher' ? 'Teacher ID Card' : 'Committee ID Card'}
              </Box>
              {userPhoto ? (
                <img
                  src={userPhoto}
                  alt={name}
                  style={{
                    width: '100%',
                    height: 'calc(100% - 1.5rem)',
                    marginTop: '1.5rem',
                    objectFit: 'cover',
                    display: 'block'
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <Box sx={{
                display: userPhoto ? 'none' : 'flex',
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
            </Box>
          </Box>

          {/* Student/Teacher Details */}
          <Box sx={{ 
            textAlign: 'center', 
            px: 0.8,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            py: 0.1,
            mt: '5px' /* Move down 5px from photo */
          }}>
            <Typography variant="h5" sx={{ 
              fontWeight: 'bold', 
              lineHeight: 1.1, 
              mb: 0.15,
              color: '#0a4b94',
              fontSize: isStudent ? '1rem !important' : '0.8rem !important', /* Larger for student */
              whiteSpace: 'normal',
              wordWrap: 'break-word',
              display: 'block'
            }}>
              {name}
            </Typography>
            
            {/* ID Card Number */}
            {(isStudent || !isStudent) && (
              <Typography variant="body2" sx={{ 
                fontWeight: 'bold', 
                lineHeight: 1.1, 
                mb: 0.2,
                color: '#0a4b94',
                fontSize: '0.8rem'
              }}>
                ID: {customIdNumber}
              </Typography>
            )}
            
            <Box sx={{ textAlign: 'left', mx: 'auto', minWidth: '130px' }}>
              {type === 'student' ? (
                <>
                  <Box sx={{ display: 'flex', mb: 0.3, whiteSpace: 'nowrap' }}>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem',
                      width: '50px',
                      flexShrink: 0,
                      textAlign: 'right',
                      pr: 0.6, /* More space */
                      color: '#0a4b94'
                    }}>
                      Class :
                    </Typography>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem',
                      color: '#0a4b94'
                    }}>
                      {classroom?.name || data.classroom_name || data.class_name || 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.3, whiteSpace: 'nowrap' }}>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem',
                      width: '50px',
                      flexShrink: 0,
                      textAlign: 'right',
                      pr: 0.6, /* More space */
                      color: '#0a4b94'
                    }}>
                      Roll :
                    </Typography>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem',
                      color: '#0a4b94'
                    }}>
                      {data?.roll_number || 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.3, whiteSpace: 'nowrap' }}>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem',
                      width: '50px',
                      flexShrink: 0,
                      textAlign: 'right',
                      pr: 0.6, /* More space */
                      color: '#0a4b94'
                    }}>
                      Section :
                    </Typography>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem',
                      color: '#0a4b94'
                    }}>
                      {section?.name || 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.3, whiteSpace: 'nowrap' }}>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem',
                      width: '50px',
                      flexShrink: 0,
                      textAlign: 'right',
                      pr: 0.6, /* More space */
                      color: '#0a4b94'
                    }}>
                      Blood :
                    </Typography>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem',
                      color: '#0a4b94'
                    }}>
                      {data?.blood_group || 'N/A'}
                    </Typography>
                  </Box>
                </>
              ) : type === 'teacher' ? (
                <>
                  <Box sx={{ display: 'flex', mb: 0.3, whiteSpace: 'nowrap' }}>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem',
                      width: '70px',
                      flexShrink: 0,
                      textAlign: 'right',
                      pr: 0.6, /* More space */
                      color: '#0a4b94'
                    }}>
                      পদবী :
                    </Typography>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem',
                      color: '#0a4b94'
                    }}>
                      {data?.designation || 'Teacher'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.3, whiteSpace: 'nowrap' }}>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem',
                      width: '70px',
                      flexShrink: 0,
                      textAlign: 'right',
                      pr: 0.6, /* More space */
                      color: '#0a4b94'
                    }}>
                      Subject :
                    </Typography>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem',
                      color: '#0a4b94'
                    }}>
                      {data?.assigned_subject_name || data?.subject || 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.3, whiteSpace: 'nowrap' }}>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem',
                      width: '70px',
                      flexShrink: 0,
                      textAlign: 'right',
                      pr: 0.6, /* More space */
                      color: '#0a4b94'
                    }}>
                      Blood :
                    </Typography>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem',
                      color: '#0a4b94'
                    }}>
                      {data?.blood_group || 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.3, whiteSpace: 'nowrap' }}>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem',
                      width: '70px',
                      flexShrink: 0,
                      textAlign: 'right',
                      pr: 0.6, /* More space */
                      color: '#0a4b94'
                    }}>
                      Join Date :
                    </Typography>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem',
                      color: '#0a4b94'
                    }}>
                      {data?.joining_date || 'N/A'}
                    </Typography>
                  </Box>
                </>
              ) : (
                <>
                  <Box sx={{ display: 'flex', mb: 0.3, whiteSpace: 'nowrap' }}>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem',
                      width: '70px',
                      flexShrink: 0,
                      textAlign: 'right',
                      pr: 0.6, /* More space */
                      color: '#0a4b94'
                    }}>
                      পদবী :
                    </Typography>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem',
                      color: '#0a4b94'
                    }}>
                      {data?.designation || 'Committee Member'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.3, whiteSpace: 'nowrap' }}>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem',
                      width: '70px',
                      flexShrink: 0,
                      textAlign: 'right',
                      pr: 0.6, /* More space */
                      color: '#0a4b94'
                    }}>
                      Blood :
                    </Typography>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '0.8rem',
                      color: '#0a4b94'
                    }}>
                      {data?.blood_group || 'N/A'}
                    </Typography>
                  </Box>
                </>
              )}
            </Box>

            {/* Signature with School Seal Background */}
            <Box sx={{ 
              mt: 0.2,
              textAlign: 'right',
              pr: 0.6,
              pt: 0.05,
              position: 'relative',
              flexShrink: 0
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
                      opacity: 0.1,
                      zIndex: 0,
                      pointerEvents: 'none'
                    }}
                    alt=""
                  />
                )}
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
                    e.target.onerror = null;
                    e.target.src = '/images/signatures/headmaster.png';
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* Bottom Bar */}
          <Box sx={{ 
            bgcolor: '#0a4b94',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 0.8,
            py: 0.2,
            flexShrink: 0,
            mt: 0
          }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.55rem', color: 'white' }}>
              Session: {currentYear}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.55rem', color: 'white' }}>
              Headmaster
            </Typography>
          </Box>
        </Box>

        {/* Back Side - Portrait - EXACT SAME SIZE AS FRONT */}
          <Box className="id-card id-card-back" sx={{ 
            background: 'white',
            borderRadius: 0,
            color: 'black',
            position: 'relative',
            boxShadow: 'none',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            height: '386px !important',
            width: '250px !important',
            mt: 1,
            border: '2px solid #0a4b94',
            '&.id-card-back': {
              height: '386px !important',
              width: '250px !important',
              minHeight: '386px !important',
              maxHeight: '386px !important'
            }
          }}>
            {/* Top Section - White: If found, please return to */}
            <Box sx={{ px: 1, py: 1.5, flexShrink: 0 }}>
              <Typography variant="h6" sx={{ 
                fontWeight: 'bold', 
                fontSize: '0.8rem',
                color: '#0a4b94',
                textAlign: 'center'
              }}>
                If found, please return to
              </Typography>
            </Box>

            {/* QR Code - Optimized for Screen-to-Screen and Print Scanning */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Box sx={{
                position: 'relative',
                p: 2, 
                border: '3px solid #000000', 
                bgcolor: '#ffffff'
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
            </Box>

            {/* School Name */}
            <Box sx={{ textAlign: 'center', mt: 1, mb: 1, px: 1, flexShrink: 0 }}>
              <Typography
                className="id-card-back-school-name"
                variant="h5"
                sx={{ 
                  fontWeight: 'bold', 
                  fontSize: '0.85rem',
                  color: '#0a4b94',
                  whiteSpace: 'normal',
                  lineHeight: 1.2,
                  wordBreak: 'break-word'
                }}
              >
                {school?.name || 'School Name'}
              </Typography>
            </Box>

            {/* School Seal/Logo - Smaller */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {schoolLogo && (
                <Avatar 
                  src={schoolLogo} 
                  sx={{ 
                    width: 40, // Even smaller logo
                    height: 40, 
                    border: '2px solid #0a4b94',
                    bgcolor: 'white'
                  }} 
                />
              )}
            </Box>

            {/* Bottom Section - Blue */}
            <Box sx={{ 
              bgcolor: '#0a4b94',
              color: 'white',
              px: 1,
              pt: 1,
              pb: 1,
              textAlign: 'center',
              flexShrink: 0,
              mt: 'auto'
            }}>
              <Typography variant="body2" sx={{ fontSize: '0.7rem', mb: 0.3, lineHeight: 1.3, whiteSpace: 'normal', wordWrap: 'break-word' }}>
                {school?.address || 'ভাটারা, রায়পুর, নরসিংদী'}
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.7rem', mb: 0.3, lineHeight: 1.3 }}>
                মেইল: {school?.email || 'hsbhatra1906@gmail.com'}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box sx={{ mr: 0.3, fontSize: '0.8rem' }}>📞</Box>
                <Typography variant="body2" sx={{ fontSize: '0.7rem', lineHeight: 1.3 }}>
                  মোবাইল: {overridePhone || school?.phone_number || school?.phone || '01712923054'}
                </Typography>
              </Box>
            </Box>
          </Box>
      </Box>
    </Box>
  );
}
