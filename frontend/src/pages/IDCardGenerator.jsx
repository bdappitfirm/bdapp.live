import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Paper,
  Tabs,
  Tab,
  MenuItem,
  Grid,
  Chip,
  Alert
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import BadgeIcon from '@mui/icons-material/Badge';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import IDCard from '../components/IDCard';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { CardSkeleton } from '../components/LoadingSkeleton';

function IDCardGenerator() {
  const { id } = useParams();
  const toast = useToast();
  
  const [tabValue, setTabValue] = useState(0); // 0 = Student, 1 = Teacher, 2 = Committee
  const [searchType, setSearchType] = useState('single'); // single or bulk
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [school, setSchool] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [allSections, setAllSections] = useState([]);
  const [filterSections, setFilterSections] = useState([]);
  const [hmPhone, setHmPhone] = useState('');
  
  // Generated cards
  const [cards, setCards] = useState([]);

  useEffect(() => {
    if (!id) return;
    loadSchool();
    loadClassrooms();
    loadAllSections();
  }, [id]);

  const loadAllSections = () => {
    api.get(`/api/academics/sections/?school=${id}`)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        console.log('Loaded all sections:', data);
        setAllSections(data);
      })
      .catch(err => console.error(err));
  };

  const loadSchool = () => {
    api.get(`/api/schools/${id}/`)
      .then(res => {
        setSchool(res.data);
      })
      .catch(err => console.error(err));
    api.get(`/api/users/teachers/?school=${id}`)
      .then(res => {
        const arr = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        const pickPhone = (t) => t?.phone_number || t?.mobile_number || t?.user?.phone_number || t?.user?.mobile_number || '';
        const isHM = (d) => {
          const s = String(d || '').toLowerCase();
          return s.includes('প্রধান') || s.includes('head') || s.includes('হেড') || s.includes('principal');
        };
        let phone = '';
        for (const p of arr) {
          const desig = p?.designation || p?.user?.designation || '';
          if (isHM(desig)) {
            phone = pickPhone(p) || pickPhone(p?.user || {});
            if (phone) break;
          }
        }
        if (!phone && arr.length) {
          const any = arr.find(p => isHM(p?.user?.designation));
          if (any) phone = pickPhone(any) || pickPhone(any?.user || {});
        }
        if (phone) setHmPhone(phone);
      })
      .catch(() => {});
  };

  const loadClassrooms = () => {
    api.get(`/api/academics/classrooms/?school=${id}`)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        setClassrooms(data);
      })
      .catch(err => console.error(err));
  };

  const loadSections = (classroomId) => {
    if (!classroomId) {
      setFilterSections([]);
      return;
    }
    api.get(`/api/academics/sections/?classroom=${classroomId}`)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        setFilterSections(data);
      })
      .catch(err => console.error(err));
  };

  const handleSearch = async () => {
    if (tabValue === 0) {
      // Student search
      await searchStudents();
    } else if (tabValue === 1) {
      // Teacher search
      await searchTeachers();
    } else {
      // Committee search
      await searchCommittee();
    }
  };

  const searchStudents = async () => {
    setLoading(true);
    try {
      let url = `/api/academics/students/?school=${id}`;
      
      if (searchType === 'single' && searchQuery) {
        // Support searching by roll number, name, or username
        if (/^\d+$/.test(searchQuery)) {
          url += `&roll_number=${searchQuery}`;
        } else {
          url += `&search=${searchQuery}`;
        }
      } else if (searchType === 'bulk') {
        if (classFilter) url += `&classroom=${classFilter}`;
        if (sectionFilter) url += `&section=${sectionFilter}`;
      }

      const res = await api.get(url);
      let data = Array.isArray(res.data) ? res.data : res.data.results || [];
      
      // Map student data to ensure photo URL is in the correct format
      data = data.map(student => {
        // Get photo URL from possible locations
        const photoUrl = student.photo || 
                        student.user?.photo || 
                        student.user?.photo_url ||
                        (student.user?.photo && `${String((api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : ''))).replace(/\/+$/,'')}${student.user.photo}`);

        return {
          ...student,
          user: {
            ...student.user,
            photo_url: photoUrl,
            photo: photoUrl, // Set both photo and photo_url for backward compatibility
            // Ensure first_name and last_name are available
            first_name: student.user?.first_name || student.name?.split(' ')[0] || '',
            last_name: student.user?.last_name || student.name?.split(' ').slice(1).join(' ') || ''
          }
        };
      });
      
      if (data.length === 0) {
        toast.warning('No students found with the specified criteria');
        setCards([]);
      } else {
        // Sort by roll number if available
        const sortedData = [...data].sort((a, b) => {
          if (a.roll_number && b.roll_number) {
            return parseInt(a.roll_number) - parseInt(b.roll_number);
          }
          return 0;
        });
        
        setCards(sortedData);
        toast.success(`Generated ${sortedData.length} student ID card(s)`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load students');
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  const searchTeachers = async () => {
    setLoading(true);
    try {
      let url = `/api/users/teachers/?school=${id}`;
      
      if (searchQuery) {
        url += `&search=${searchQuery}`;
      }

      const res = await api.get(url);
      let data = Array.isArray(res.data) ? res.data : res.data.results || [];
      
      // Map teacher data to include all necessary fields
      data = data.map(teacher => {
        const photoUrl = teacher.photo || 
                        teacher.user?.photo || 
                        teacher.user?.photo_url ||
                        (teacher.user?.photo && `${String((api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : ''))).replace(/\/+$/,'')}${teacher.user.photo}`);

        return {
          ...teacher,
          // Ensure fields are available at top level
          designation: teacher.designation || '',
          subject: teacher.subject || '',
          blood_group: teacher.blood_group || '',
          id_card_number: teacher.id_card_number || teacher.id || '',
          // Ensure user object has first_name and last_name
          user: {
            ...teacher.user,
            photo_url: photoUrl,
            photo: photoUrl,
            first_name: teacher.user?.first_name || '',
            last_name: teacher.user?.last_name || ''
          }
        };
      });
      
      if (data.length === 0) {
        toast.warning('No teachers found');
        setCards([]);
      } else {
        setCards(data);
        toast.success(`Generated ${data.length} teacher ID card(s)`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load teachers');
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  const searchCommittee = async () => {
    setLoading(true);
    try {
      let url = `/api/users/committees/?school=${id}`;
      
      if (searchQuery) {
        url += `&search=${searchQuery}`;
      }

      const res = await api.get(url);
      let data = Array.isArray(res.data) ? res.data : res.data.results || [];
      
      // Map committee data to include all necessary fields
      data = data.map(member => {
        const photoUrl = member.photo || 
                        member.user?.photo || 
                        member.user?.photo_url ||
                        (member.user?.photo && `${String((api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : ''))).replace(/\/+$/,'')}${member.user.photo}`);

        return {
          ...member,
          // Ensure fields are available at top level
          designation: member.designation || '',
          blood_group: member.blood_group || '',
          id_card_number: member.id_card_number || member.id || '',
          // Ensure user object has first name and last name
          user: {
            ...member.user,
            photo_url: photoUrl,
            photo: photoUrl,
            first_name: member.user?.first_name || '',
            last_name: member.user?.last_name || ''
          }
        };
      });
      
      if (data.length === 0) {
        toast.warning('No committee members found');
        setCards([]);
      } else {
        setCards(data);
        toast.success(`Generated ${data.length} committee ID card(s)`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load committee members');
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (cards.length === 0) {
      toast.warning('Please generate ID cards first');
      return;
    }
    
    // Add print-specific styling
    const style = document.createElement('style');
    style.id = 'print-style';
    style.innerHTML = `
      @media print {
        body {
          visibility: hidden !important;
          background: none !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .id-card-container, 
        .id-card-container * {
          visibility: visible !important;
        }
        .id-card-container {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          display: flex !important;
          flex-wrap: wrap !important;
          justify-content: flex-start !important;
          align-items: flex-start !important;
          gap: 8mm !important;
          padding: 8mm !important;
          margin: 0 !important;
          background: white !important;
        }

        .id-card-wrapper {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          display: block !important;
          margin: 6mm !important;
          width: calc(33.33% - 12mm) !important;
          box-sizing: border-box !important;
          vertical-align: top !important;
        }

        .id-card {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          overflow: hidden !important;
          border: 1px solid #eee !important;
          box-shadow: none !important;
          width: 100% !important;
        }

        /* 66.7mm x 90.5mm size (2.62x3.56 inches) */
        .id-card-front, .id-card-back {
          width: 66.7mm !important;
          min-height: 90.5mm !important;
          max-height: 90.5mm !important;
          height: 90.5mm !important;
          position: relative !important;
          margin: 0 auto !important;
        }

        .id-card-front {
          margin-bottom: 3mm !important; /* Gap between front and back */
        }

        /* Fix for top half missing: Ensure header backgrounds and filters don't break print */
        .id-card-front > div:first-of-type,
        .id-card-header {
          background-color: #075985 !important;
          background-image: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          opacity: 1 !important;
          visibility: visible !important;
          display: block !important;
        }
        
        /* Ensure avatars (logo/photo) are visible */
        .MuiAvatar-root, 
        .MuiAvatar-img {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }

        .no-print {
          display: none !important;
        }
        
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        @page {
          size: A4;
          margin: 5mm;
        }
      }
    `;
    document.head.appendChild(style);
    
    toast.info('Opening print dialog...');
    setTimeout(() => {
      window.print();
      // Remove the style after printing
      document.head.removeChild(style);
    }, 300);
  };

  const handleDownloadAll = async () => {
    if (cards.length === 0) {
      toast.warning('Please generate ID cards first');
      return;
    }
    try {
      toast.info('Generating PDF... Please wait');
      // Hide no-print elements during capture
      const tempStyle = document.createElement('style');
      tempStyle.id = 'hide-no-print';
      tempStyle.innerHTML = `.no-print{display:none !important;}`;
      document.head.appendChild(tempStyle);
      
      const wrappers = document.querySelectorAll('.id-card-wrapper');
      if (!wrappers.length) {
        document.head.removeChild(tempStyle);
        toast.error('No ID cards found to export');
        return;
      }
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const cardWidthMM = 60.96;
      const cardHeightMM = 82.55;
      const marginTopMM = 8;
      const marginLeftMM = 8;
      const gapXMM = 8;
      const gapYMM = 8;
      const cols = 3;
      
      const renderedCards = [];
      for (let i = 0; i < wrappers.length; i++) {
        const wrapper = wrappers[i];
        const frontEl = wrapper.querySelector('.id-card-front');
        const backEl = wrapper.querySelector('.id-card-back');

        if (!frontEl) continue;

        const renderCard = async (el) => {
          if (!el) return null;
          const cnv = await html2canvas(el, { 
            scale: Math.min(3, window.devicePixelRatio || 2),
            useCORS: true, 
            backgroundColor: '#ffffff', 
            logging: false,
            allowTaint: false,
            foreignObjectRendering: false,
            imageTimeout: 15000,
            removeContainer: false
          });
          return cnv.toDataURL('image/png');
        };

        const front = await renderCard(frontEl);
        const back = await renderCard(backEl);
        renderedCards.push({ front, back });
      }
      
      // Separate front and back cards
      const frontCards = renderedCards.map(card => card.front);
      const backCards = renderedCards.map(card => card.back);
      
      // Function to add cards to PDF (3x3 grid = 9 per page)
      const cardsPerPage = 9;
      const addCardsToPDF = (cards) => {
        for (let i = 0; i < cards.length; i++) {
          const indexOnPage = i % cardsPerPage;
          const row = Math.floor(indexOnPage / cols);
          const col = indexOnPage % cols;
          
          if (i > 0 && indexOnPage === 0) {
            pdf.addPage();
          }
          
          const x = marginLeftMM + col * (cardWidthMM + gapXMM);
          const y = marginTopMM + row * (cardHeightMM + gapYMM);
          
          if (cards[i]) {
            pdf.addImage(cards[i], 'PNG', x, y, cardWidthMM, cardHeightMM);
          }
        }
      };
      
      // Add all front cards first
      addCardsToPDF(frontCards);
      
      // Add new page and then back cards
      if (frontCards.length > 0 && backCards.length > 0) {
        pdf.addPage();
      }
      addCardsToPDF(backCards);
      
      const fileName = `id-cards-${id}-${new Date().toISOString().slice(0,10)}.pdf`;
      pdf.save(fileName);
      document.head.removeChild(tempStyle);
      toast.success('PDF downloaded successfully');
    } catch (e) {
      console.error('PDF generation error:', e);
      toast.error('Failed to generate PDF');
    }
  };

  const handleReset = () => {
    setSearchQuery('');
    setClassFilter('');
    setSectionFilter('');
    setCards([]);
    toast.info('Form reset');
  };

  const handlePromoteByFinal = async () => {
    if (!id) return;
    try {
      toast.info('প্রমোশন প্রসেসিং...');
      const formData = new FormData();
      formData.append('school', id);
      const res = await api.post('/api/academics/students/promote/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const d = res.data || {};
      toast.success(`প্রমোশন সম্পন্ন: ${d.promoted || 0} জন। (ফেল: ${d.skipped_failed || 0}, পরীক্ষা নেই: ${d.skipped_no_exam || 0})`);
    } catch (e) {
      console.error('Promotion error', e);
      toast.error('প্রমোশন ব্যর্থ হয়েছে');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper 
        elevation={0}
        sx={{ 
          mb: 3, 
          p: 3, 
          background: 'linear-gradient(135deg, #00b09b 0%, #96c93d 100%)',
          color: 'white',
          borderRadius: 3
        }}
        className="no-print"
      >
        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          alignItems={{ xs: 'stretch', sm: 'center' }} 
          justifyContent="space-between" 
          spacing={2}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center' }}>
              <BadgeIcon sx={{ mr: 1, fontSize: 40 }} />
              আইডি কার্ড জেনারেটর
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              শিক্ষার্থী ও শিক্ষকদের জন্য প্রফেশনাল আইডি কার্ড তৈরি ও প্রিন্ট করুন
            </Typography>
            {cards.length > 0 && (
              <Typography variant="body2" sx={{ opacity: 0.7, mt: 1 }}>
                {cards.length} card(s) generated | School: {school?.name || id}
              </Typography>
            )}
          </Box>
          {cards.length > 0 && (
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              className="no-print"
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                backdropFilter: 'blur(10px)'
              }}
            >
              সব কার্ড প্রিন্ট করুন
            </Button>
          )}
          {cards.length > 0 && (
            <Button
              variant="contained"
              startIcon={<PictureAsPdfIcon />}
              onClick={handleDownloadAll}
              className="no-print"
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                backdropFilter: 'blur(10px)'
              }}
            >
              সব কার্ড ডাউনলোড করুন
            </Button>
          )}
          {String(id) === '16' && (
            <Button
              variant="contained"
              onClick={handlePromoteByFinal}
              className="no-print"
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                backdropFilter: 'blur(10px)'
              }}
            >
              ফাইনাল রেজাল্ট অনুযায়ী প্রমোশন দিন
            </Button>
          )}
        </Stack>
      </Paper>

      {/* Search Form */}
      <Paper sx={{ p: 3, mb: 3 }} className="no-print">
        {/* Tabs */}
        <Tabs value={tabValue} onChange={(e, v) => { setTabValue(v); setCards([]); }} sx={{ mb: 2 }}>
          <Tab label="শিক্ষার্থী আইডি কার্ড" />
          <Tab label="শিক্ষক আইডি কার্ড" />
          <Tab label="কমিটি আইডি কার্ড" />
        </Tabs>

        {/* Student Search */}
        {tabValue === 0 && (
          <Box>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <Button
                variant={searchType === 'single' ? 'contained' : 'outlined'}
                onClick={() => setSearchType('single')}
                size="small"
              >
                একক শিক্ষার্থী
              </Button>
              <Button
                variant={searchType === 'bulk' ? 'contained' : 'outlined'}
                onClick={() => setSearchType('bulk')}
                size="small"
              >
                একাধিক (শ্রেণি অনুযায়ী)
              </Button>
            </Stack>

            {searchType === 'single' ? (
              <TextField
                label="শিক্ষার্থী অনুসন্ধান"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="রোল নম্বর, নাম বা ইউজারনেম লিখুন"
                fullWidth
                sx={{ mb: 2 }}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                helperText="রোল নম্বর, নাম বা ইউজারনেম দিয়ে অনুসন্ধান করুন"
              />
            ) : (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                  select
                  label="শ্রেণি নির্বাচন"
                  value={classFilter}
                  onChange={(e) => {
                    setClassFilter(e.target.value);
                    loadSections(e.target.value);
                    setSectionFilter('');
                  }}
                  fullWidth
                >
                  <MenuItem value="">সব শ্রেণি</MenuItem>
                  {classrooms.map((cls) => (
                    <MenuItem key={cls.id} value={cls.id}>{cls.name}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="সেকশন নির্বাচন"
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  fullWidth
                  disabled={!classFilter}
                >
                  <MenuItem value="">সব সেকশন</MenuItem>
                  {filterSections.map((sec) => (
                    <MenuItem key={sec.id} value={sec.id}>{sec.name}</MenuItem>
                  ))}
                </TextField>
              </Stack>
            )}
          </Box>
        )}

        {/* Teacher Search */}
        {tabValue === 1 && (
          <TextField
            label="Search Teacher"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter teacher name or leave empty for all"
            fullWidth
            sx={{ mb: 2 }}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
        )}

        {/* Committee Search */}
        {tabValue === 2 && (
          <TextField
            label="Search Committee Member"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter committee member name or leave empty for all"
            fullWidth
            sx={{ mb: 2 }}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
        )}

        {/* Action Buttons */}
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? 'তৈরি হচ্ছে...' : 'আইডি কার্ড তৈরি করুন'}
          </Button>
          <Button variant="text" onClick={handleReset}>
            রিসেট
          </Button>
        </Stack>

        {cards.length > 0 && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {cards.length} টি আইডি কার্ড তৈরি হয়েছে। নিচে স্ক্রল করে দেখুন ও প্রিন্ট করুন।
          </Alert>
        )}
      </Paper>

      {/* ID Cards Display */}
      {loading && <CardSkeleton count={4} />}

      {!loading && cards.length === 0 && (
        <EmptyState
          icon={BadgeIcon}
          title="কোনো আইডি কার্ড তৈরি হয়নি"
          message={`${tabValue === 0 ? 'শিক্ষার্থী' : 'শিক্ষক'} নির্বাচন করে "আইডি কার্ড তৈরি করুন" বাটনে ক্লিক করুন`}
        />
      )}

      {!loading && cards.length > 0 && (
        <Box className="id-card-container" sx={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: 3, 
          justifyContent: 'center',
          p: 2,
          bgcolor: 'background.paper',
          borderRadius: 2,
          boxShadow: 1
        }}>
          {cards.map((item, idx) => (
            <IDCard
              key={idx}
              type={tabValue === 0 ? 'student' : tabValue === 1 ? 'teacher' : 'committee'}
              data={item}
              school={school}
              classrooms={classrooms}
              sections={allSections}
              overridePhone={hmPhone || (String(id) === '16' ? '01712923054' : undefined)}
              signatureUrl={String(id) === '16' ? `${window.location.origin}/signature.png` : undefined}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
export default IDCardGenerator;
