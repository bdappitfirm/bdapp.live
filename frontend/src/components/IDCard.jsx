import React from 'react';
import { Box, Typography, Avatar, IconButton, Tooltip } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import { QRCodeSVG } from 'qrcode.react';
import './IDCard.css';
import api from '../utils/api';

export default function IDCard({ type = 'student', data, school, classrooms = [], sections = [], overridePhone, signatureUrl: propSignatureUrl }) {
  console.log('IDCard data:', JSON.stringify(data, null, 2));
  console.log('IDCard classroom:', data?.classroom);
  console.log('IDCard section:', data?.section);
  console.log('Classrooms array:', classrooms);
  console.log('Sections array:', sections);

  // Resolve classroom object
  const getClassroom = () => {
    console.log('getClassroom - data.classroom:', data?.classroom);
    console.log('getClassroom - type of data.classroom:', typeof data?.classroom);
    console.log('getClassroom - classrooms array:', classrooms);
    if (!data?.classroom) return null;
    if (typeof data.classroom === 'object' && data.classroom !== null) return data.classroom;
    // If classroom is an ID, find it in the classrooms array
    const found = classrooms.find(c => {
      console.log('Comparing classroom c.id:', c.id, 'to data.classroom:', data.classroom);
      return c.id === data.classroom || String(c.id) === String(data.classroom);
    });
    console.log('getClassroom - found classroom:', found);
    return found;
  };
  const classroom = getClassroom();

  // Resolve section object
  const getSection = () => {
    console.log('getSection - data.section:', data?.section);
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
                background: linear-gradient(180deg, #0a4b94 0%, #0a4b94 35%, #ffffff 35%, #ffffff 100%) !important;
              }
              
              .id-card-back { 
                background: linear-gradient(180deg, #ffffff 0%, #ffffff 70%, #0a4b94 70%, #0a4b94 100%) !important;
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
  
  // Generate QR code data
  const qrData = JSON.stringify({
    type: type,
    id: data?.id,
    name: name,
    school: school?.name,
    roll: isStudent ? data?.roll_number : null,
    username: user.username,
    timestamp: new Date().toISOString()
  });

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
          background: 'linear-gradient(180deg, #0a4b94 0%, #0a4b94 35%, #ffffff 35%, #ffffff 100%)',
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
            p: 0.4,
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
                  border: '2px solid white',
                  bgcolor: 'white',
                  mx: 'auto',
                  mb: 0.1
                }} 
              />
            )}
            {/* School Info */}
            <Typography variant="h6" sx={{ 
              fontWeight: 'bold', 
              lineHeight: 1.1, 
              fontSize: '0.65rem',
              mb: 0.05,
              whiteSpace: 'normal',
              wordBreak: 'break-word'
            }}>
              {school?.name || 'School Name'}
            </Typography>
            {school?.ein && (
              <Typography variant="body2" sx={{ 
                fontSize: '0.45rem',
                opacity: 0.9,
                mb: 0.1
              }}>
                EIIN No.- {school.ein}
              </Typography>
            )}
            <Box sx={{ 
              bgcolor: 'white', 
              color: '#0a4b94',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              px: 1.4, 
              pt: 0.4,
              pb: '1.2rem',
              borderRadius: 3,
              fontSize: '0.82rem', 
              fontWeight: 'bold',
              lineHeight: 1.2,
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              top: '90px',
              minWidth: 'fit-content',
              whiteSpace: 'nowrap',
              boxShadow: 'none',
              zIndex: 2
            }}>
              Student Identity Card
            </Box>
          </Box>

          {/* Photo Section - Below Student Identity Card */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center',
            mt: '0.1in',
            mb: 0.15,
            pt: 0.2,
            position: 'relative',
            zIndex: 1
          }}>
            <Box sx={{
              width: 70,
              height: 90,
              border: '2px solid #0a4b94',
              bgcolor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              {userPhoto ? (
                <img
                  src={userPhoto}
                  alt={name}
                  style={{
                    width: '100%',
                    height: '100%',
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
                height: '100%',
                backgroundColor: '#f0f4f8',
                color: '#0a4b94',
                fontSize: '1.8rem',
                fontWeight: 'bold'
              }}>
                {name && name.charAt(0) ? name.charAt(0).toUpperCase() : '?'}
              </Box>
            </Box>
          </Box>

          {/* Student Details */}
          <Box sx={{ 
            textAlign: 'center', 
            px: 0.3,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            py: 0.1,
            mt: 0
          }}>
            <Typography variant="h5" sx={{ 
              fontWeight: 'bold', 
              lineHeight: 1, 
              mb: 0.4,
              color: '#0a4b94',
              fontSize: '7px',
              textTransform: 'uppercase'
            }}>
              {name}
            </Typography>
            
            {/* ID Card Number */}
            {isStudent && (
              <Typography variant="body2" sx={{ 
                fontWeight: 'bold', 
                lineHeight: 1, 
                mb: 0.4,
                color: '#0a4b94',
                fontSize: '16px',
                letterSpacing: '0.03em'
              }}>
                ID: {(() => {
                  // Get class name from various possible fields
                  let className = classroom?.name || data.classroom_name || data.class_name || '';
                  
                  // Map Bengali class names to numbers (like SchoolDashboard.jsx)
                  const bnMap = { 
                    'প্রথম': 1, 'দ্বিতীয়': 2, 'তৃতীয়': 3, 'চতুর্থ': 4, 'পঞ্চম': 5, 
                    'ষষ্ঠ': 6, 'সপ্তম': 7, 'অষ্টম': 8, 'নবম': 9, 'দশম': 10, 
                    'এসএসসি': 10, 'এসএসসি পরীক্ষার্থী': 10 
                  };
                  
                  let classNum = 0;
                  // First try Bengali word mapping
                  for (const k in bnMap) { 
                    if (String(className).includes(k)) { 
                      classNum = bnMap[k]; 
                      break; 
                    } 
                  }
                  // If that didn't work, try extracting digits
                  if (!classNum) { 
                    const m = String(className).match(/\d+/); 
                    if (m) classNum = parseInt(m[0], 10); 
                  }
                  
                  const sectionMap = {
                    'ক': 1, 'খ': 2, 'গ': 3, 'ঘ': 4, 'ঙ': 5,
                    'a': 1, 'b': 2, 'c': 3, 'd': 4, 'e': 5,
                    'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5,
                    'বিজ্ঞান': 1, 'বিজ্ঞান বিভাগ': 1, 'কলা': 2, 'কলা বিভাগ': 2, 'ব্যবসায়': 3, 'ব্যবসায় বিভাগ': 3
                  };
                  let sectionNum = parseInt(section?.name?.replace(/\D/g, '')) || sectionMap[section?.name] || 0;
                  const rollNum = parseInt(data?.roll_number?.replace(/\D/g, '')) || 0;
                  
                  console.log('Generating ID - className:', className, 'classNum:', classNum, 'sectionNum:', sectionNum, 'rollNum:', rollNum);
                  
                  return `${currentYear}${String(classNum).padStart(2, '0')}${String(sectionNum).padStart(2, '0')}${String(rollNum).padStart(2, '0')}`;
                })()}
              </Typography>
            )}
            
            <Box sx={{ textAlign: 'left', mx: 'auto', minWidth: '110px' }}>
              {isStudent && (
                <>
                  <Box sx={{ display: 'flex', mb: 0.5, whiteSpace: 'nowrap' }}>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '14px',
                      width: '52px',
                      flexShrink: 0,
                      textAlign: 'right',
                      pr: 0.5
                    }}>
                      Class :
                    </Typography>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '14px'
                    }}>
                      {classroom?.name || data.classroom_name || data.class_name || 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.5, whiteSpace: 'nowrap' }}>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '14px',
                      width: '52px',
                      flexShrink: 0,
                      textAlign: 'right',
                      pr: 0.5
                    }}>
                      Roll :
                    </Typography>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '14px'
                    }}>
                      {data?.roll_number || 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', mb: 0.5, whiteSpace: 'nowrap' }}>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '14px',
                      width: '52px',
                      flexShrink: 0,
                      textAlign: 'left'
                    }}>
                      Section
                    </Typography>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 'bold', 
                      fontSize: '14px'
                    }}>
                      {section?.name || 'N/A'}
                    </Typography>
                  </Box>
                </>
              )}
            </Box>

            {/* Signature with School Seal Background */}
            <Box sx={{ 
              mt: -4.3,
              textAlign: 'right',
              pr: 0.5,
              pt: 0.1,
              position: 'relative'
            }}>
              <Box sx={{ display: 'inline-block', textAlign: 'center', position: 'relative', zIndex: 1 }}>
                {/* School Seal as Background - centered behind signature */}
                {schoolLogo && (
                  <Box 
                    component="img"
                    src={schoolLogo}
                    sx={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '70px',
                      height: '70px',
                      opacity: 0.15,
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
                    width: '45px', 
                    height: 'auto', 
                    filter: 'brightness(0)',
                    display: 'block',
                    position: 'relative',
                    zIndex: 1
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
            py: 0.3,
            flexShrink: 0,
            mt: -3.7
          }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.7rem', color: 'white' }}>
              Session: {currentYear}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.7rem', color: 'white' }}>
              Headmaster
            </Typography>
          </Box>
        </Box>

        {/* Back Side - Portrait - EXACT SAME SIZE AS FRONT */}
        <Box className="id-card id-card-back" sx={{ 
          background: 'linear-gradient(180deg, #ffffff 0%, #ffffff 70%, #0a4b94 70%, #0a4b94 100%)',
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
          {/* Top Section - White */}
          <Box sx={{ px: 0.15, py: 0.15, pb: 0.1, flexShrink: 0 }}>
            <Box sx={{ 
              display: 'inline-block', 
              position: 'relative',
              mb: 0.1
            }}>
              <Typography variant="h6" sx={{ 
                fontWeight: 'bold', 
                fontSize: '0.13rem',
                color: '#333',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.02em'
              }}>
                If found, please return to
              </Typography>
            </Box>
          </Box>

          {/* School Name */}
          <Box sx={{ textAlign: 'center', mb: 0.2, px: 0.05, flexShrink: 0 }}>
            <Typography
              className="id-card-back-school-name"
              variant="h5"
              sx={{ 
                fontWeight: 'bold', 
                fontSize: '0.045rem',
                color: '#0a4b94',
                whiteSpace: 'normal',
                letterSpacing: '-0.01em',
                lineHeight: 1.05,
                wordBreak: 'break-word'
              }}
            >
              {school?.name || 'School Name'}
            </Typography>
          </Box>

          {/* School Seal/Logo + QR Code - moved up */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-around',
            alignItems: 'center',
            px: 0.6,
            pt: 0.2,
            pb: 0.1,
            mt: 0.2,
            flexShrink: 0
          }}>
            {/* School Logo */}
            {schoolLogo && (
              <Avatar 
                src={schoolLogo} 
                sx={{ 
                  width: 42, 
                  height: 42, 
                  border: '2px solid #0a4b94',
                  bgcolor: 'white'
                }} 
              />
            )}
            {/* QR Code */}
            <Box sx={{
              position: 'relative',
              p: 0.1,
              bgcolor: 'white'
            }}>
              <QRCodeSVG 
                value={qrData} 
                size={42}
                level="H"
                fgColor="#000000"
                bgColor="#ffffff"
              />
            </Box>
          </Box>

          {/* Middle Content - Instructions */}
          <Box sx={{ px: 0.4, mt: 0.3, mb: 0.1, flex: '0 0 auto', overflow: 'hidden' }}>
            <Typography variant="subtitle1" sx={{ 
              fontWeight: 'bold', 
              fontSize: '0.72rem',
              mb: 0.15,
              color: '#0a4b94'
            }}>
              গুরুত্বপূর্ণ নির্দেশনা
            </Typography>
            <Box component="ul" sx={{ 
              pl: 2.2, 
              m: 0,
              listStyleType: 'disc'
            }}>
              <Box component="li" sx={{ mb: 0.1 }}>
                <Typography variant="caption" sx={{ fontSize: '0.62rem', lineHeight: 1.25 }}>
                  এই কার্ডটি {school?.name || 'স্কুল'}-এর সম্পত্তি
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0.1 }}>
                <Typography variant="caption" sx={{ fontSize: '0.62rem', lineHeight: 1.25 }}>
                  ক্যাম্পাসে অবস্থানের সময় সর্বদা কার্ডটি সঙ্গে রাখতে হবে
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0.1 }}>
                <Typography variant="caption" sx={{ fontSize: '0.62rem', lineHeight: 1.25 }}>
                  কার্ডটি পাওয়া গেলে অনুগ্রহ করে স্কুল অফিসে জমা দিন
                </Typography>
              </Box>
              <Box component="li">
                <Typography variant="caption" sx={{ fontSize: '0.62rem', lineHeight: 1.25 }}>
                  এই কার্ড হস্তান্তরযোগ্য নয়
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Bottom Section - Blue */}
          <Box sx={{ 
            bgcolor: '#0a4b94',
            color: 'white',
            px: 0.6,
            pt: 0.75,
            pb: 0.75,
            textAlign: 'center',
            flexShrink: 0,
            mt: 'auto'
          }}>
            <Typography variant="body2" sx={{ fontSize: '14px', mb: 0.85, lineHeight: 1.3 }}>
              মেইল: hsbhatra1906@gmail.com
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box sx={{ mr: 0.5, fontSize: '16px' }}>📞</Box>
              <Typography variant="body2" sx={{ fontSize: '14px', lineHeight: 1.3 }}>
                মোবাইল: 01712923054
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
