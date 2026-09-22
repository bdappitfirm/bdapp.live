import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import { useAcademics } from '../context/AcademicsContext';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Backdrop
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CloseIcon from '@mui/icons-material/Close';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import AdmissionCard from '../components/AdmissionCard';
import InputGuidance from '../components/InputGuidance';

export default function AdmissionCardGenerator() {
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [school, setSchool] = useState(null);
  const { classrooms, sections, refreshAll, students: allStudents, fetchStudentsScoped } = useAcademics();
  const [searchResults, setSearchResults] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [openPreview, setOpenPreview] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [examSlots, setExamSlots] = useState([]);
  const [activeStep, setActiveStep] = useState(0);

  const guidanceSteps = [
    { selector: '#class-select', text: 'শ্রেণি নির্বাচন করুন', autoNext: false },
    { selector: '#section-select', text: 'সেকশন নির্বাচন করুন', autoNext: false },
    { selector: '#exam-select', text: 'পরীক্ষা নির্বাচন করুন', autoNext: false },
    { selector: '#search-button', text: 'এখানে ক্লিক করুন', autoNext: true }
  ];

  useEffect(() => {
    if (!classFilter) {
      setActiveStep(0);
    } else if (!selectedExam) {
      setActiveStep(1);
    } else if (searchResults.length === 0) {
      setActiveStep(2);
    } else {
      setActiveStep(3);
    }
  }, [classFilter, selectedExam, searchResults.length]);

  // Filter sections for selected class
  const filteredSections = classFilter ? sections.filter(sec => String(sec.classroom?.id) === String(classFilter)) : [];
  
  // Load school data
  useEffect(() => {
    if (!id) return;
    
    const loadSchool = async () => {
      try {
        const res = await api.get(`/api/schools/${id}/`);
        setSchool(res.data);
      } catch (err) {
          console.error('Failed to load school data:', err);
          showSnackbar('Failed to load school data', 'error');
        }
      };
      loadSchool();
      refreshAll(id);
    }, [id, refreshAll]);

  // Load examinations for the school (and optionally for selected class)
  useEffect(() => {
    if (!id) return;
    const fetchExams = async () => {
      setLoadingExams(true);
      try {
        let url = `/api/results/examinations/?school=${id}&page_size=100`;
        if (classFilter) url += `&classroom=${classFilter}`;
        const res = await api.get(url, { timeout: 15000 });
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        setExams(data);
      } catch (err) {
        console.error('Failed to load examinations:', err);
        setExams([]);
      } finally {
        setLoadingExams(false);
      }
    };
    fetchExams();
  }, [id, classFilter]);

  // Load exam slots for the selected exam
  useEffect(() => {
    if (!id) return;
    const fetchExamSlots = async () => {
      try {
        let url = `/api/results/exam-slots/?school=${id}`;
        if (selectedExam) {
          url += `&examination=${selectedExam}`;
        } else if (classFilter) {
          url += `&classroom=${classFilter}`;
        }
        const res = await api.get(url);
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        setExamSlots(data);
      } catch (err) {
        console.error('Failed to load exam slots:', err);
        setExamSlots([]);
      }
    };
    fetchExamSlots();
  }, [id, classFilter, selectedExam]);


  const searchStudents = async () => {
    if (!selectedExam) {
      showSnackbar('Please select an exam first', 'warning');
      return;
    }
    
    setLoading(true);
    try {
      let foundStudents = [];

      // Always try to fetch from server for the specific filters to ensure fresh/complete data
      if (searchQuery) {
        const normalizedQuery = searchQuery.toLowerCase().trim();
        // First check local list for speed
        foundStudents = allStudents.filter(s =>
          (s.roll_number?.toString().includes(searchQuery)) || 
          (s.user?.first_name?.toLowerCase().includes(normalizedQuery)) || 
          (s.user?.last_name?.toLowerCase().includes(normalizedQuery)) || 
          (s.name?.toLowerCase().includes(normalizedQuery))
        );

        // If nothing found locally or query is a roll number, try server
        if (foundStudents.length === 0 || !isNaN(searchQuery)) {
            const params = isNaN(searchQuery) ? { search: normalizedQuery } : { roll_number: searchQuery };
            if (classFilter) params.classroom = classFilter;
            if (sectionFilter) params.section = sectionFilter;
            foundStudents = await fetchStudentsScoped(id, params);
        }
      } else if (classFilter) {
        // Fetch class/section students from server directly
        const params = { classroom: classFilter };
        if (sectionFilter) params.section = sectionFilter;
        foundStudents = await fetchStudentsScoped(id, params);
      } else {
        showSnackbar('Please enter search criteria or select class', 'warning');
        setLoading(false);
        return;
      }
      
      // Map student data to ensure photo URL is in the correct format
      foundStudents = foundStudents.map(student => ({
        ...student,
        user: {
          ...student.user,
          photo_url: student.photo || student.user?.photo || student.user?.photo_url,
          first_name: student.user?.first_name || student.name?.split(' ')[0] || '',
          last_name: student.user?.last_name || student.name?.split(' ').slice(1).join(' ') || ''
        }
      }));
      
      if (foundStudents.length === 0) {
        setSearchResults([]);
        showSnackbar('No students found with the specified criteria', 'warning');
      } else {
        // Sort by roll number
        const sortedData = [...foundStudents].sort((a, b) => {
          const ar = parseInt(String(a?.roll_number ?? '').replace(/\D/g, ''), 10);
          const br = parseInt(String(b?.roll_number ?? '').replace(/\D/g, ''), 10);
          if (!isNaN(ar) && !isNaN(br)) return ar - br;
          return String(a?.roll_number).localeCompare(String(b?.roll_number));
        });
        
        setSearchResults(sortedData);
        showSnackbar(`Found ${sortedData.length} student(s)`, 'success');
      }
    } catch (err) {
      console.error('Error searching students:', err);
      showSnackbar('Failed to search students', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async (student = null) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showSnackbar('Please allow popups for this website', 'error');
      return;
    }

    const writeLoadingPage = () => {
      try {
        printWindow.document.open();
        printWindow.document.write(`
          <html>
            <head>
              <title>Preparing Print</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 24px; }
                .box { max-width: 520px; margin: 0 auto; padding: 18px; border: 1px solid #e5e7eb; border-radius: 12px; }
                .title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
                .text { color: #374151; line-height: 1.5; }
              </style>
            </head>
            <body>
              <div class="box">
                <div class="title">Preparing your print…</div>
                <div class="text">Please wait. This window will print automatically when ready.</div>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
      } catch (_) {}
    };

    writeLoadingPage();

    const studentsToPrint = student ? [student] : searchResults;
    if (studentsToPrint.length === 0) {
      showSnackbar('No students to print', 'warning');
      try { printWindow.close(); } catch (_) {}
      return;
    }

    setLoading(true);

    try {
      showSnackbar(student ? 'Preparing print…' : `Preparing ${studentsToPrint.length} cards…`, 'info');

      const images = [];
      for (let idx = 0; idx < studentsToPrint.length; idx++) {
        const s = studentsToPrint[idx];
        const element = document.getElementById(`admission-card-${s.id}`);
        if (!element) continue;
        const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                imageTimeout: 0,
                removeContainer: true,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight
              });
        images.push(canvas.toDataURL('image/png'));
        if (!student && (idx + 1) % 6 === 0) {
          showSnackbar(`Preparing ${idx + 1}/${studentsToPrint.length}…`, 'info');
        }
      }

      if (images.length === 0) {
        showSnackbar('No cards found to print', 'warning');
        try { printWindow.close(); } catch (_) {}
        return;
      }

      const cardsPerPage = 2;
      const totalPages = Math.ceil(images.length / cardsPerPage);

      let htmlContent = `
        <html>
          <head>
            <title>Admission Cards</title>
            <style>
              @page { size: landscape; margin: 8mm; }
              body {
                margin: 0;
                padding: 0;
                background: white;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .print-page {
                width: 100%;
                height: auto;
                page-break-after: always;
                box-sizing: border-box;
              }
              .print-container {
                display: flex;
                flex-direction: row;
                flex-wrap: nowrap;
                gap: 5mm;
                width: 100%;
                box-sizing: border-box;
                align-items: stretch;
                justify-content: center;
              }
              .card-slot {
                width: calc(50% - 5mm);
                box-sizing: border-box;
                break-inside: avoid;
                page-break-inside: avoid;
                height: 100%;
              }
              .card-slot img {
                width: 100%;
                height: auto;
                display: block;
                border: 1px solid #e5e7eb;
                border-radius: 10px;
                object-fit: contain;
              }
              @media print {
                .print-page { page-break-after: always; }
              }
            </style>
          </head>
          <body>
      `;

      for (let page = 0; page < totalPages; page++) {
        const startIndex = page * cardsPerPage;
        const endIndex = Math.min(startIndex + cardsPerPage, images.length);

        htmlContent += `<div class="print-page"><div class="print-container">`;
        for (let i = startIndex; i < endIndex; i++) {
          htmlContent += `
            <div class="card-slot">
              <img src="${images[i]}" alt="Admission Card" />
            </div>
          `;
        }
        htmlContent += `</div></div>`;
      }

      htmlContent += `
          </body>
        </html>
      `;

      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      printWindow.onload = async () => {
        try {
          const imgs = Array.from(printWindow.document.images || []);
          await Promise.all(imgs.map(img => (img.complete ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res; }))));
          if (printWindow.document.fonts?.ready) {
            await printWindow.document.fonts.ready.catch(() => {});
          }
        } catch (_) {}
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 300);
      };

    } catch (err) {
      console.error('Print error:', err);
      showSnackbar('Failed to print. Please try again.', 'error');
      try { printWindow.close(); } catch (_) {}
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async (student = null) => {
    const studentsToExport = student ? [student] : searchResults;
    
    if (studentsToExport.length === 0) {
      showSnackbar('No students to export', 'warning');
      return;
    }

    setLoading(true);
    
    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      const a4Width = 297; // A4 width in mm (landscape)
      const a4Height = 210; // A4 height in mm (landscape)
      const margin = 10;
      const gap = 15;
      const cardWidth = (a4Width - (margin * 2) - gap) / 2; // Two cards side-by-side

      const canvasData = [];
      for (let i = 0; i < studentsToExport.length; i++) {
        const s = studentsToExport[i];
        const element = document.getElementById(`admission-card-${s.id}`);
        
        if (!element) continue;

        // Show progress
        if (!student && (i + 1) % 5 === 0) {
          showSnackbar(`Generating PDF... ${i + 1}/${studentsToExport.length}`, 'info');
        }
        
        const canvas = await html2canvas(element, {
                scale: 1.5, // Lower scale for better performance
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                imageTimeout: 0,
                removeContainer: true,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight,
                onclone: (clonedDoc) => {
                  const clonedElement = clonedDoc.getElementById(`admission-card-${s.id}`);
                  if (clonedElement) {
                    clonedElement.style.position = 'absolute';
                    clonedElement.style.left = '-9999px';
                    clonedElement.style.top = '0';
                  }
                }
              });
        canvasData.push({
          imgData: canvas.toDataURL('image/png'),
          width: canvas.width,
          height: canvas.height
        });
      }

      if (canvasData.length === 0) {
        showSnackbar('No cards found to export', 'warning');
        setLoading(false);
        return;
      }

      // Add images to PDF
      for (let i = 0; i < canvasData.length; i++) {
        const { imgData, width, height } = canvasData[i];
        
        const imgHeight = (height * cardWidth) / width;
        const maxCardHeight = a4Height - (margin * 3);
        const finalCardHeight = Math.min(imgHeight, maxCardHeight);
        
        // Check if we need to add a new page
        const isFirstCard = i === 0;
        const isNewPage = i % 2 === 0;
        
        if (!isFirstCard && isNewPage) {
          // Add a new page for every 2nd card
          pdf.addPage();
        }
        
        // Calculate position (X is left or right, Y is top)
        const positionX = margin + ((i % 2) * (cardWidth + gap));
        const positionY = margin;
        
        pdf.addImage(imgData, 'PNG', positionX, positionY, cardWidth, finalCardHeight);
      }

      pdf.save('admission-cards.pdf');
      showSnackbar('PDF downloaded successfully!', 'success');

    } catch (err) {
      console.error('PDF generation error:', err);
      showSnackbar('Failed to generate PDF. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = (student) => {
    setSelectedStudent(student);
    setOpenPreview(true);
  };

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const selectedExamData = useMemo(() =>
    exams.find(exam => String(exam.id) === String(selectedExam)) || {},
    [exams, selectedExam]
  );

  useEffect(() => {
    if (!selectedExam) return;
    if (!Array.isArray(exams) || exams.length === 0) return;
    const ok = exams.some(e => String(e.id) === String(selectedExam));
    if (!ok) setSelectedExam('');
  }, [exams, selectedExam]);

  return (
    <Box sx={{ p: 3 }}>
      <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }} open={loading || loadingExams}>
        <CircularProgress color="inherit" />
      </Backdrop>
      {/* Header */}
      <Paper 
        elevation={0}
        sx={{ 
          mb: 3, 
          p: 3, 
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          color: 'white',
          borderRadius: 3
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
              Exam Admission Card Generator
            </Typography>
            <Typography variant="body1">
              Generate and print admission cards for students
            </Typography>
            {school && (
              <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
                School: {school.name}
              </Typography>
            )}
          </Box>
          
          {searchResults.length > 0 && (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<PrintIcon />}
                onClick={() => handlePrint()}
                disabled={loading}
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.2)', 
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                  backdropFilter: 'blur(10px)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)'
                }}
              >
                {loading ? 'Preparing...' : 'Print All'}
              </Button>
              <Button
                variant="contained"
                startIcon={<PictureAsPdfIcon />}
                onClick={() => handleExportPDF()}
                disabled={loading}
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.2)', 
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                  backdropFilter: 'blur(10px)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)'
                }}
              >
                {loading ? 'Generating...' : 'Export as PDF'}
              </Button>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Search Form */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
          Search Criteria
        </Typography>
        
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              id="class-select"
              select
              fullWidth
              label="শ্রেণি নির্বাচন করুন"
              value={classFilter}
              onChange={(e) => {
                    setClassFilter(e.target.value);
                    setSectionFilter('');
                    setSearchQuery('');
                  }}
              variant="outlined"
              size="small"
              required
            >
              <MenuItem value="">সব শ্রেণি</MenuItem>
              {classrooms.map((cls) => (
                <MenuItem key={cls.id} value={cls.id}>
                  {cls.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              id="section-select"
              select
              fullWidth
              label="সেকশন নির্বাচন করুন"
              value={sectionFilter}
              onChange={(e) => {
                setSectionFilter(e.target.value);
                setSearchQuery('');
              }}
              variant="outlined"
              size="small"
              disabled={!classFilter}
            >
              <MenuItem value="">সব সেকশন</MenuItem>
              {filteredSections.map((sec) => (
                <MenuItem key={sec.id} value={sec.id}>
                  {sec.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              id="exam-select"
              select
              fullWidth
              label="পরীক্ষা নির্বাচন করুন"
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              variant="outlined"
              size="small"
              required
              disabled={loadingExams}
            >
              <MenuItem value="">একটি পরীক্ষা নির্বাচন করুন</MenuItem>
              {exams
                .filter(exam => {
                  const name = (exam.name || '').trim();
                  const type = (exam.exam_type || '').toLowerCase();

                  // Include major exam types
                  const majorTypes = ['half_yearly', 'annual', 'terminal', 'pre_test', 'test', 'model', 'first_term', 'second_term', 'third_term'];
                  if (majorTypes.includes(type)) return true;

                  const parts = name.split('(');
                  const beforeBracket = parts[0].toLowerCase().trim();
                  const keywords = [
                    'অর্ধ', 'বার্ষিক', 'টার্মিনাল', 'নির্বাচনী', 'মডেল', 'টেস্ট', 'পরীক্ষা', 'টার্ম',
                    'half', 'yearly', 'annual', 'terminal', 'pre-test', 'test', 'model', 'exam', 'term'
                  ];

                  return keywords.some(kw => beforeBracket.includes(kw));
                })
                .map((exam) => {
                const yr = (() => {
                  const ay = parseInt(exam.academic_year, 10);
                  if (!Number.isNaN(ay) && ay > 0) return ay;
                  const d = exam.exam_date || exam.start_date;
                  const dt = d ? new Date(d) : null;
                  return dt && !Number.isNaN(dt.getTime()) ? dt.getFullYear() : new Date().getFullYear();
                })();
                return (
                  <MenuItem key={exam.id} value={String(exam.id)}>
                    {exam.name || 'Exam'} ({yr})
                  </MenuItem>
                );
              })}
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, md: 8 }}>
            <TextField
              id="skip-to-button"
              fullWidth
              label="নাম অথবা রোল নম্বর দিয়ে খুঁজুন (ঐচ্ছিক)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              variant="outlined"
              size="small"
              placeholder="Enter student name or roll number"
              onKeyPress={(e) => e.key === 'Enter' && searchStudents()}
            />
          </Grid>
          
          <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', alignItems: 'flex-end' }}>
            <Button
              id="search-button"
              variant="contained"
              color="primary"
              onClick={searchStudents}
              disabled={loading || (!searchQuery && !classFilter)}
              fullWidth
              sx={{ height: '40px' }}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
            >
              {loading ? 'অনুসন্ধান হচ্ছে...' : (searchQuery ? 'খুঁজুন' : 'সব প্রবেশপত্র জেনারেট করুন')}
            </Button>
          </Grid>
        </Grid>
        
        {selectedExam && (
          <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
              Selected Exam: {selectedExamData.name}
            </Typography>
            <Typography variant="body2">
              Date: {selectedExamData.start_date ? new Date(selectedExamData.start_date).toLocaleDateString() : 'TBA'}
              {' | '}
              Time: {selectedExamData.start_time || 'TBA'}
              {' | '}
              Center: {selectedExamData.center || 'TBA'}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Results */}
      {searchResults.length > 0 ? (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Found {searchResults.length} Student(s)
            </Typography>
            <Button 
              variant="outlined" 
              color="primary" 
              startIcon={<PrintIcon />}
              onClick={() => handlePrint()}
              disabled={loading}
            >
              Print All
            </Button>
          </Box>
          
          <Grid container spacing={3}>
            {searchResults.map((student) => (
              <Grid item xs={12} sm={6} md={4} key={student.id}>
                <Box position="relative">
                  <Box id={`admission-card-${student.id}`}>
                    <AdmissionCard 
                      data={student} 
                      school={school} 
                      exam={selectedExamData}
                      examSlots={examSlots}
                    />
                  </Box>
                  <Box 
                    sx={{ 
                      position: 'absolute', 
                      top: 10, 
                      right: 10,
                      display: 'flex',
                      gap: 1,
                      '& .MuiIconButton-root': {
                        bgcolor: 'rgba(0,0,0,0.6)',
                        color: 'white',
                        '&:hover': {
                          bgcolor: 'rgba(0,0,0,0.8)'
                        }
                      }
                    }}
                  >
                    <Tooltip title="Preview">
                      <IconButton size="small" onClick={() => handlePreview(student)}>
                        <SearchIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Print">
                      <IconButton size="small" onClick={() => handlePrint(student)}>
                        <PrintIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>
      ) : (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="textSecondary" gutterBottom>
            No students found
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Use the search form above to find students and generate admission cards.
          </Typography>
        </Paper>
      )}

      {/* Preview Dialog */}
      <Dialog
        open={openPreview}
        onClose={() => setOpenPreview(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <span>Admission Card Preview</span>
            <IconButton onClick={() => setOpenPreview(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedStudent && (
            <Box display="flex" justifyContent="center" p={2}>
              <Box maxWidth="400px" width="100%">
                <AdmissionCard 
                  data={selectedStudent} 
                  school={school} 
                  exam={selectedExamData}
                  examSlots={examSlots}
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
          <Button 
            onClick={() => setOpenPreview(false)}
            variant="outlined"
            sx={{ mr: 1 }}
          >
            Close
          </Button>
          <Button 
            variant="contained" 
            color="primary"
            startIcon={<PrintIcon />}
            onClick={() => {
              handlePrint(selectedStudent);
              setOpenPreview(false);
            }}
          >
            Print
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <InputGuidance
        steps={guidanceSteps}
        activeStep={activeStep}
        onStepComplete={() => setActiveStep(prev => prev + 1)}
      />
    </Box>
  );
}
