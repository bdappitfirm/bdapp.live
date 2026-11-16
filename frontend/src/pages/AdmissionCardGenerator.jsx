import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import { useAcademics } from '../context/AcademicsContext';
import { getActiveClassrooms } from '../utils/classroomUtils';
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
  Tooltip
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CloseIcon from '@mui/icons-material/Close';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import AdmissionCard from '../components/AdmissionCard';
import InputGuidance from '../components/InputGuidance';

// Which cards the print stylesheet keeps is toggled straight on the DOM rather
// than through React state, so the whole print flow stays inside one click
// handler and window.print() runs synchronously. If print() runs after a React
// re-render or a timeout, Chrome drops the click's user-activation and then
// ignores `@page { size: A4 landscape }`, printing portrait and cropping the
// cards left and right.
function applyPrintTargets(student) {
  const container = document.querySelector('.screen-admission-cards');
  if (!container) return;
  container.classList.toggle('printing-single', Boolean(student));
  container.querySelectorAll('.print-grid-item').forEach((el) => {
    const isTarget = Boolean(student) && el.getAttribute('data-student-id') === String(student.id);
    el.classList.toggle('print-target', isTarget);
  });
  // In single-card mode only the sheet that holds the requested card survives;
  // every other sheet is dropped so it does not print as a blank page.
  container.querySelectorAll('.print-page').forEach((page) => {
    page.classList.toggle('print-page-active', !student || Boolean(page.querySelector('.print-target')));
  });
}

export default function AdmissionCardGenerator() {
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [school, setSchool] = useState(null);
  const { classrooms, sections, refreshAll, students: allStudents, fetchStudentsScoped, examinations: contextExams } = useAcademics();
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

  // Combine context exams with fetched exams for instant 0ms availability, filtered by school id
  const effectiveExams = useMemo(() => {
    const list = (Array.isArray(contextExams) && contextExams.length > 0) ? contextExams : exams;
    if (!id) return list;
    return list.filter(e => {
      const sId = e.school?.id || e.school || e.school_id;
      return !sId || String(sId) === String(id);
    });
  }, [contextExams, exams, id]);

  // Instant memory filtering for exams when classFilter changes (0ms delay)
  const filteredExams = useMemo(() => {
    if (!Array.isArray(effectiveExams)) return [];
    if (!classFilter) return effectiveExams;
    return effectiveExams.filter(e => {
      const cId = e.classroom?.id || e.classroom;
      return !cId || String(cId) === String(classFilter);
    });
  }, [effectiveExams, classFilter]);
  const [examSlots, setExamSlots] = useState([]);
  const [activeStep, setActiveStep] = useState(0);
  const printStyleRef = useRef(null);

  // Print styles live in <head> as a real stylesheet, not as a <style> rendered
  // inside the page body. Chrome only honours @page / @media print reliably from
  // a head stylesheet — this is what removes the browser's own header/footer
  // (date, page title, URL, page number) that otherwise print on every page.
  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'admission-card-print-style';
    el.textContent = `
      @media print {
        /* The sheet itself carries the margin (via .print-page padding), so the
           page box stays exactly A4-landscape and one .print-page maps 1:1 to
           one printed sheet with no rounding drift onto a blank page. */
        @page { size: A4 landscape; margin: 0; }
        html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
        main { min-height: 0 !important; overflow: visible !important; }
        .no-print, .MuiSnackbar-root, .MuiDialog-root, header, footer, nav, aside, .MuiAppBar-root { display: none !important; }
        .print-card-actions { display: none !important; }

        /* The page wrapper's own padding offsets the cards and would also make a
           full-height page overflow onto a blank second sheet. */
        .admission-generator-root { padding: 0 !important; }

        .screen-admission-cards { display: block !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
        /* The grid itself generates no box in print; each .print-page becomes a
           real block so page breaks happen predictably between sheets. */
        .screen-admission-cards .print-grid { display: contents !important; }

        /* Each .print-page is exactly one A4-landscape sheet. A fixed height
           (instead of min-height) keeps the page-break predictable on every
           page, not just the first: the block fills the whole page box, so the
           browser never puts it at the top of a fragment. Its own padding
           stands in for the page margin, keeping the cards off the paper edge.
           align-items:center centres the (natural-height) card vertically on
           the sheet, mirroring the on-screen preview. */
        .screen-admission-cards .print-page {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          column-gap: 5mm !important;
          width: 100% !important;
          height: 206mm !important;
          max-height: 206mm !important;
          padding: 2mm 4mm !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
          break-after: page !important;
          page-break-after: always !important;
        }
        .screen-admission-cards .print-page:last-child {
          break-after: auto !important;
          page-break-after: auto !important;
        }

        /* The card keeps its natural (content) height, exactly like the screen
           preview; the page wrapper centres it vertically on the sheet. */
        .screen-admission-cards .print-grid-item {
          display: flex !important;
          flex: 0 0 auto !important;
          width: 140mm !important;
          max-width: 140mm !important;
          min-width: 140mm !important;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        /* Wrappers must NOT grow/shrink, so the card below keeps its natural
           height (matching the on-screen preview) instead of being stretched to
           the sheet. */
        .screen-admission-cards .print-card-shell,
        .screen-admission-cards .print-card-shell > div {
          display: flex !important;
          flex: 0 0 auto !important;
          flex-direction: column !important;
          min-height: 0 !important;
          width: 140mm !important;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          overflow: visible !important;
        }
        .screen-admission-cards .admission-card {
          flex: 0 0 auto !important;
          width: 140mm !important;
          max-width: 140mm !important;
          min-width: 140mm !important;
          max-height: none !important;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          overflow: visible !important;
          box-shadow: none !important;
          filter: none !important;
          background: #ffffff !important;
        }

        /* Single-card print: keep only the sheet holding the requested card,
           and only that card on it. */
        .screen-admission-cards.printing-single .print-page { display: none !important; }
        .screen-admission-cards.printing-single .print-page.print-page-active {
          display: flex !important;
          break-after: auto !important;
          page-break-after: auto !important;
        }
        .screen-admission-cards.printing-single .print-grid-item { display: none !important; }
        .screen-admission-cards.printing-single .print-grid-item.print-target {
          display: block !important;
          margin: 0 !important;
        }
      }
    `;
    document.head.appendChild(el);
    printStyleRef.current = el;
    return () => {
      printStyleRef.current = null;
      el.remove();
    };
  }, []);

  // Drop the print-only classes once the print dialog is dismissed.
  useEffect(() => {
    const reset = () => applyPrintTargets(null);
    window.addEventListener('afterprint', reset);
    return () => window.removeEventListener('afterprint', reset);
  }, []);

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

  // Active classrooms memoized for instant (0ms) dropdown rendering
  const activeClassroomsList = useMemo(() => {
    return getActiveClassrooms(Array.isArray(classrooms) ? classrooms : []);
  }, [classrooms]);

  // Filter sections for selected class instantly in memory (0ms)
  const filteredSections = useMemo(() => {
    if (!classFilter || !Array.isArray(sections)) return [];
    return sections.filter(sec => {
      const cId = sec.classroom?.id || sec.classroom;
      return String(cId) === String(classFilter);
    });
  }, [sections, classFilter]);
  
  // Load school data and refresh academics when school id changes
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

  // Load examinations for the school once on mount (cached in memory)
  useEffect(() => {
    if (!id) return;
    const fetchExams = async () => {
      setLoadingExams(true);
      try {
        const res = await api.get(`/api/results/examinations/?school=${id}&page_size=300`, { timeout: 15000 });
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
  }, [id]);

  // Load exam slots for the school/exam
  useEffect(() => {
    if (!id) return;
    const fetchExamSlots = async () => {
      try {
        const url = selectedExam
          ? `/api/results/exam-slots/?school=${id}&examination=${selectedExam}&page_size=500`
          : `/api/results/exam-slots/?school=${id}&page_size=500`;
        const res = await api.get(url);
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        setExamSlots(data);
      } catch (err) {
        console.error('Failed to load exam slots:', err);
        setExamSlots([]);
      }
    };
    fetchExamSlots();
  }, [id, selectedExam]);


  // Filter students from memory instantly for 0ms response time
  const getLocalStudents = useCallback((clsId, secId, query = '') => {
    if (!clsId || !Array.isArray(allStudents)) return [];
    const normQuery = String(query || '').toLowerCase().trim();
    const filtered = allStudents.filter(s => {
      const cId = s.classroom?.id || s.classroom;
      if (String(cId) !== String(clsId)) return false;
      if (secId) {
        const sId = s.section?.id || s.section;
        if (String(sId) !== String(secId)) return false;
      }
      if (normQuery) {
        const roll = String(s.roll_number || '');
        const fn = String(s.user?.first_name || s.first_name || '').toLowerCase();
        const ln = String(s.user?.last_name || s.last_name || '').toLowerCase();
        const full = String(s.name || `${fn} ${ln}`).toLowerCase();
        return roll.includes(normQuery) || fn.includes(normQuery) || ln.includes(normQuery) || full.includes(normQuery);
      }
      return true;
    });

    return filtered.map(student => ({
      ...student,
      user: {
        ...student.user,
        photo_url: student.photo || student.user?.photo || student.user?.photo_url,
        first_name: student.user?.first_name || student.name?.split(' ')[0] || '',
        last_name: student.user?.last_name || student.name?.split(' ').slice(1).join(' ') || ''
      }
    })).sort((a, b) => {
      const ar = parseInt(String(a?.roll_number ?? '').replace(/\D/g, ''), 10);
      const br = parseInt(String(b?.roll_number ?? '').replace(/\D/g, ''), 10);
      if (!isNaN(ar) && !isNaN(br)) return ar - br;
      return String(a?.roll_number).localeCompare(String(b?.roll_number));
    });
  }, [allStudents]);

  // Auto-generate cards instantly (0ms) whenever class/section/exam is selected
  useEffect(() => {
    if (!classFilter || !selectedExam) return;
    const localMatches = getLocalStudents(classFilter, sectionFilter, searchQuery);
    if (localMatches.length > 0) {
      setSearchResults(localMatches);
    }
  }, [classFilter, sectionFilter, selectedExam, searchQuery, getLocalStudents]);

  const searchStudents = async () => {
    if (!selectedExam) {
      showSnackbar('Please select an exam first', 'warning');
      return;
    }
    
    // Check instant local memory first (0ms)
    const localMatches = getLocalStudents(classFilter, sectionFilter, searchQuery);
    if (localMatches.length > 0) {
      setSearchResults(localMatches);
      showSnackbar(`Found ${localMatches.length} student(s)`, 'success');
      return;
    }

    setLoading(true);
    try {
      let foundStudents = [];
      const params = {};
      if (classFilter) params.classroom = classFilter;
      if (sectionFilter) params.section = sectionFilter;
      if (searchQuery) {
        if (!isNaN(searchQuery)) params.roll_number = searchQuery;
        else params.search = searchQuery.toLowerCase().trim();
      }

      foundStudents = await fetchStudentsScoped(id, params);
      foundStudents = (foundStudents || []).map(student => ({
        ...student,
        user: {
          ...student.user,
          photo_url: student.photo || student.user?.photo || student.user?.photo_url,
          first_name: student.user?.first_name || student.name?.split(' ')[0] || '',
          last_name: student.user?.last_name || student.name?.split(' ').slice(1).join(' ') || ''
        }
      })).sort((a, b) => {
        const ar = parseInt(String(a?.roll_number ?? '').replace(/\D/g, ''), 10);
        const br = parseInt(String(b?.roll_number ?? '').replace(/\D/g, ''), 10);
        if (!isNaN(ar) && !isNaN(br)) return ar - br;
        return String(a?.roll_number).localeCompare(String(b?.roll_number));
      });
      
      setSearchResults(foundStudents);
      if (foundStudents.length > 0) {
        showSnackbar(`Found ${foundStudents.length} student(s)`, 'success');
      } else {
        showSnackbar('No students found with specified criteria', 'warning');
      }
    } catch (err) {
      console.error('Error searching students:', err);
      showSnackbar('Failed to search students', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async (student = null) => {
    const count = student ? 1 : searchResults.length;
    if (count === 0) {
      showSnackbar('No students to print', 'warning');
      return;
    }

    setLoading(true);

    applyPrintTargets(student);
    setOpenPreview(false);

    const styleEl = printStyleRef.current;
    if (styleEl && styleEl.parentNode) {
      styleEl.parentNode.appendChild(styleEl);
    }

    // Fast image check: wait at most 400ms total for pending images so print dialog opens instantly
    const container = document.querySelector('.screen-admission-cards');
    if (container) {
      const images = Array.from(container.querySelectorAll('img'));
      const pendingImages = images.filter(img => !img.complete || img.naturalHeight === 0);

      if (pendingImages.length > 0) {
        const imagePromises = pendingImages.map(img => {
          return new Promise((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            setTimeout(resolve, 200); // 200ms per image fallback
          });
        });
        const maxWait = new Promise(resolve => setTimeout(resolve, 400));
        await Promise.race([Promise.all(imagePromises), maxWait]);
      }
    }

    setLoading(false);
    window.print();
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

  // Two cards per printed A4 sheet: group the results into page-sized chunks so
  // the print stylesheet can centre each sheet on its own. On screen the wrapper
  // is `display: contents`, so the visible grid layout is untouched.
  const cardPages = useMemo(() => {
    const pages = [];
    for (let i = 0; i < searchResults.length; i += 2) {
      pages.push(searchResults.slice(i, i + 2));
    }
    return pages;
  }, [searchResults]);

  return (
    <Box className="admission-generator-root" sx={{ p: 3 }}>
      {/* Non-blocking loading indicator */}
      {/* Header */}
      <Paper 
        elevation={0}
        className="no-print"
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
      <Paper className="no-print" sx={{ p: 3, mb: 3 }}>
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
              {activeClassroomsList.map((cls) => (
                <MenuItem key={cls.id} value={String(cls.id)}>
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
              disabled={loadingExams && (!Array.isArray(effectiveExams) || effectiveExams.length === 0)}
            >
              <MenuItem value="">একটি পরীক্ষা নির্বাচন করুন</MenuItem>
              {filteredExams
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
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} className="no-print">
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
          
          {/* Screen Grid — the on-screen cards are also the print cards: the
              print stylesheet re-lays this same grid out as two cards per A4
              landscape page. Nothing is duplicated, and because these images
              have already painted, nothing prints half-loaded. */}
          <Box className="screen-admission-cards">
            <Box className="print-grid" sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center' }}>
              {cardPages.map((pageStudents, pageIndex) => (
                <Box
                  key={`print-page-${pageIndex}`}
                  className="print-page"
                  sx={{ display: 'contents' }}
                >
                  {pageStudents.map((student) => (
                    <Box
                      key={student.id}
                      className="print-grid-item"
                      data-student-id={student.id}
                      sx={{ width: { xs: '100%', sm: 'calc(50% - 24px)', md: 'calc(33.333% - 24px)' }, maxWidth: '640px' }}
                    >
                      <Box
                        position="relative"
                        className="print-card-shell"
                        sx={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
                      >
                        <Box id={`admission-card-${student.id}`}>
                          <AdmissionCard
                            data={student}
                            school={school}
                            exam={selectedExamData}
                            examSlots={examSlots}
                          />
                        </Box>
                        <Box
                          className="print-card-actions"
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
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          </Box>
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
            <Box display="flex" justifyContent={{ xs: 'flex-start', md: 'center' }} p={2} sx={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <Box sx={{ minWidth: '380px', width: '100%', maxWidth: '640px' }}>
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
            onClick={() => handlePrint(selectedStudent)}
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
