import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';
import { useAcademics } from '../context/AcademicsContext';
import {
  Box, Typography, Grid, TextField, Button,
  Stack, IconButton, Paper, Chip, Fade
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import GroupIcon from '@mui/icons-material/Group';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StudentCard from '../components/StudentCard';
import ImportDialog from '../components/ImportDialog';
import EmptyState from '../components/EmptyState';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/Toast';
import InputGuidance from '../components/InputGuidance';

export default function StudentsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { 
    students: contextStudents, 
    classrooms: contextClassrooms,
    sections: contextSections,
    refreshAll,
    fetchStudentsScoped
  } = useAcademics();
  
  const [q, setQ] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [classSummary, setClassSummary] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [sliceStudents, setSliceStudents] = useState(null);
  const [sliceLoading, setSliceLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const searchDebounceRef = useRef(null);

  const guidanceSteps = useMemo(() => [
    { selector: '#class-select-card-0', text: 'শ্রেণি নির্বাচন করুন', autoNext: false },
    { selector: '#section-select-card-0', text: 'শাখা নির্বাচন করুন', autoNext: false },
    { selector: '#student-search-input', text: 'শিক্ষার্থী খুঁজুন', autoNext: false },
    { selector: '#add-student-btn', text: 'নতুন শিক্ষার্থী ভর্তি করুন', autoNext: false }
  ], []);

  useEffect(() => {
    if (!selectedClass) {
      setActiveStep(0);
    } else if (!selectedSection) {
      setActiveStep(1);
    } else if (!q) {
      setActiveStep(2);
    } else {
      setActiveStep(3);
    }
  }, [selectedClass, selectedSection, q]);

  const handleDeleteStudent = async (student) => {
    if (!window.confirm('আপনি কি নিশ্চিত? এটি ফিরিয়ে আনা যাবে না!')) return;
    try {
      await api.delete(`/api/academics/students/${student.id}/`);
      toast.success('শিক্ষার্থী ডিলিট করা হয়েছে');
      loadStudents();
    } catch (err) {
      console.error(err);
      toast.error('ডিলিট করতে সমস্যা হয়েছে');
    }
  };

  // URL Sync Logic
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cls = params.get('classroom');
    const sec = params.get('section');
    const searchQ = params.get('q') || '';

    setSelectedClass(cls ? Number(cls) : null);
    setSelectedSection(sec === 'UNASSIGNED' || sec === 'ALL' ? sec : (sec ? Number(sec) : null));

    // Only update local search state if it differs from URL AND we're not currently debouncing a type-in
    if (!searchDebounceRef.current) {
        setQ(searchQ);
    }
  }, [location.search]);

  const updateUrl = useCallback((cls, sec, searchQ) => {
    const params = new URLSearchParams();
    if (cls) params.set('classroom', cls);
    if (sec) params.set('section', sec);
    if (searchQ) params.set('q', searchQ);

    const newSearch = params.toString();
    if (newSearch !== location.search.replace(/^\?/, '')) {
      navigate(`${location.pathname}?${newSearch}`, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  const handleClassSelect = (classId) => updateUrl(classId, null, '');
  const handleSectionSelect = (sectionId) => updateUrl(selectedClass, sectionId, q);
  const handleBackToClasses = () => updateUrl(null, null, '');
  const handleBackToSections = () => updateUrl(selectedClass, null, '');

  const loadStudents = useCallback(async (showToast = true) => {
    if (!id) return;
    try {
      await refreshAll(id);
      if (showToast) toast.success('তথ্য রিফ্রেশ হয়েছে');
    } catch (err) {
      console.error(err);
    }
    // We intentionally omit 'toast' from dependencies to avoid infinite loops
    // if the toast provider is not memoized properly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, refreshAll]);

  useEffect(() => {
    if (id) {
      loadStudents(false);
    }
  }, [id, loadStudents]);

  // Summary & Ordering
  useEffect(() => {
    if (Array.isArray(contextClassrooms)) {
      // Create summary using student_count from API if available,
      // otherwise fallback to calculating from contextStudents (if provided)
      const classIdToCount = Array.isArray(contextStudents) ? contextStudents.reduce((acc, s) => {
        const cid = Number(s.classroom?.id ?? s.classroom);
        if (cid) acc[cid] = (acc[cid] || 0) + 1;
        return acc;
      }, {}) : {};

      const summary = [...contextClassrooms]
        .sort((a, b) => (a.id - b.id))
        .map(c => ({
          id: c.id,
          name: c.name,
          count: c.student_count ?? classIdToCount[c.id] ?? 0
        }));
      setClassSummary(summary);
    }
  }, [contextStudents, contextClassrooms]);

  // Section Results Logic
  useEffect(() => {
    if (selectedClass && selectedSection) {
      setSliceLoading(true);
      let filters = {};
      if (selectedSection === 'ALL') {
        filters = { classroom: selectedClass };
      } else if (selectedSection === 'UNASSIGNED') {
        filters = { classroom: selectedClass, section: 'null' };
      } else {
        filters = { classroom: selectedClass, section: selectedSection };
      }

      // Rely on api.js interceptor for offline fallback
      fetchStudentsScoped(id, filters)
        .then(list => {
          setSliceStudents(list);
          setSliceLoading(false);
        })
        .catch(() => {
          setSliceLoading(false);
        });
    } else {
        setSliceStudents(null);
    }
  }, [selectedClass, selectedSection, fetchStudentsScoped, id]);

  const filtered = useMemo(() => {
    const base = sliceStudents || [];
    if (!selectedSection) return [];

    // 1. Filter by search query
    let result = base.filter(s => {
        if (!q) return true;
        const term = q.toLowerCase();
        const name = `${s.user?.first_name || ''} ${s.user?.last_name || ''}`.toLowerCase();
        return name.includes(term) || String(s.roll_number).includes(term);
    });

    // 2. Strong Numeric Sorting by Roll Number
    return [...result].sort((a, b) => {
        const ar = parseInt(String(a.roll_number || '').replace(/\D/g, ''), 10);
        const br = parseInt(String(b.roll_number || '').replace(/\D/g, ''), 10);
        if (!isNaN(ar) && !isNaN(br)) {
            if (ar !== br) return ar - br;
        }
        return String(a.roll_number || '').localeCompare(String(b.roll_number || ''), undefined, { numeric: true });
    });
  }, [sliceStudents, selectedSection, q]);

  const currentClassSections = useMemo(() => {
    if (!selectedClass) return [];
    return (contextSections || []).filter(s => Number(s.classroom?.id ?? s.classroom) === selectedClass);
  }, [selectedClass, contextSections]);

  return (
    <Box sx={{ p: { xs: 1, sm: 3 } }}>
      <Paper elevation={0} sx={{ mb: 3, p: 3, background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', color: 'white', borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
              {selectedClass ? (
                <Stack direction="row" alignItems="center">
                    <IconButton onClick={handleBackToClasses} sx={{ color: 'white', mr: 1 }}><ArrowBackIcon /></IconButton>
                    {contextClassrooms.find(c => c.id === selectedClass)?.name}
                    {selectedSection && (
                        <>
                            <Typography variant="h4" sx={{ mx: 1 }}>/</Typography>
                            <Typography variant="h5" component="span" sx={{ opacity: 0.9 }}>
                                {selectedSection === 'ALL' ? 'সব শাখা একসাথে' : (selectedSection === 'UNASSIGNED' ? 'শাখা ছাড়া' : `শাখা: ${currentClassSections.find(s => s.id === selectedSection)?.name || ''}`)}
                            </Typography>
                        </>
                    )}
                </Stack>
              ) : 'শিক্ষার্থী ব্যবস্থাপনা'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button id="add-student-btn" variant="contained" startIcon={<AddIcon />} onClick={() => navigate(`/school/${id}/student/add`)} sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>ছাত্র ভর্তি</Button>
            <IconButton onClick={() => loadStudents()} sx={{ color: 'white' }}><RefreshIcon /></IconButton>
          </Stack>
        </Stack>
      </Paper>

      {/* 1. Class Selection View */}
      {!selectedClass && (
        <Fade in timeout={500}>
            <Grid container spacing={2}>
            {classSummary.map((c, idx) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={c.id}>
                <Paper
                    id={`class-select-card-${idx}`}
                    sx={{ p: 3, textAlign: 'center', cursor: 'pointer', borderRadius: 3, transition: '0.3s', '&:hover': { boxShadow: 6, transform: 'translateY(-5px)', bgcolor: 'primary.50' } }}
                    onClick={() => handleClassSelect(c.id)}
                >
                    <SchoolIcon sx={{ fontSize: 50, color: 'primary.main', mb: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{c.name}</Typography>
                    <Chip label={`${c.count} জন শিক্ষার্থী`} color="primary" variant="outlined" size="small" />
                </Paper>
                </Grid>
            ))}
            </Grid>
        </Fade>
      )}

      {/* 2. Section Selection View */}
      {selectedClass && !selectedSection && (
        <Fade in timeout={500}>
            <Box>
                <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                    <GroupIcon sx={{ mr: 1 }} /> শাখা নির্বাচন করুন
                </Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={4}>
                        <Paper
                            sx={{ p: 4, textAlign: 'center', cursor: 'pointer', borderRadius: 3, transition: '0.2s', border: '2px solid #1976d2', bgcolor: 'primary.50', '&:hover': { boxShadow: 6, bgcolor: 'primary.100' } }}
                            onClick={() => handleSectionSelect('ALL')}
                        >
                            <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>সব শাখা একসাথে</Typography>
                            <Chip label={`${classSummary.find(c => c.id === selectedClass)?.count || 0} জন শিক্ষার্থী`} color="primary" size="small" sx={{ my: 1 }} />
                            <Typography variant="body2" color="text.secondary">সকল শাখার শিক্ষার্থী একসাথে দেখুন</Typography>
                        </Paper>
                    </Grid>
                    {currentClassSections.map((s, idx) => (
                        <Grid item xs={12} sm={6} md={4} key={s.id}>
                            <Paper
                                id={`section-select-card-${idx}`}
                                sx={{ p: 4, textAlign: 'center', cursor: 'pointer', borderRadius: 3, transition: '0.2s', '&:hover': { boxShadow: 6, bgcolor: 'secondary.50' } }}
                                onClick={() => handleSectionSelect(s.id)}
                            >
                                <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'secondary.main' }}>শাখা: {s.name}</Typography>
                                <Chip label={`${s.student_count ?? 0} জন শিক্ষার্থী`} color="secondary" variant="outlined" size="small" sx={{ my: 1 }} />
                                <Typography variant="body2" color="text.secondary">শিক্ষার্থী দেখতে ক্লিক করুন</Typography>
                            </Paper>
                        </Grid>
                    ))}
                    <Grid item xs={12} sm={6} md={4}>
                        <Paper
                            sx={{ p: 4, textAlign: 'center', cursor: 'pointer', borderRadius: 3, transition: '0.2s', border: '1px dashed #ccc', '&:hover': { bgcolor: 'grey.100' } }}
                            onClick={() => handleSectionSelect('UNASSIGNED')}
                        >
                            <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>শাখা ছাড়া</Typography>
                            {(() => {
                                const classObj = contextClassrooms.find(c => c.id === selectedClass);
                                const totalClassStudents = classObj?.student_count ?? 0;
                                const totalInSectionStudents = currentClassSections.reduce((acc, sec) => acc + (sec.student_count ?? 0), 0);
                                const unassignedCount = Math.max(0, totalClassStudents - totalInSectionStudents);
                                return unassignedCount > 0 ? (
                                    <Chip label={`${unassignedCount} জন শিক্ষার্থী`} variant="outlined" size="small" sx={{ my: 1 }} />
                                ) : null;
                            })()}
                            <Typography variant="body2" color="text.secondary">অন্যান্য শিক্ষার্থী</Typography>
                        </Paper>
                    </Grid>
                </Grid>
            </Box>
        </Fade>
      )}

      {/* 3. Student List View */}
      {selectedClass && selectedSection && (
        <Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
            <Stack direction="row" spacing={1} alignItems="center">
                <Button startIcon={<ArrowBackIcon />} onClick={handleBackToSections} variant="outlined" size="small">শাখা পরিবর্তন</Button>
                {!sliceLoading && (
                    <Chip label={`মোট: ${filtered.length} জন`} color="primary" size="small" />
                )}
            </Stack>
            <TextField
                id="student-search-input"
                placeholder="নাম বা রোল দিয়ে খুঁজুন..."
                size="small" value={q}
                onChange={(e) => {
                    const val = e.target.value;
                    setQ(val);
                    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                    searchDebounceRef.current = setTimeout(() => {
                        updateUrl(selectedClass, selectedSection, val);
                        // We keep the ref for a bit longer to ensure the URL sync effect
                        // doesn't catch an old URL value during the transition.
                        setTimeout(() => { searchDebounceRef.current = null; }, 200);
                    }, 300);
                }}
                sx={{ width: { xs: '100%', sm: 300 }, bgcolor: 'white' }}
            />
          </Stack>

          {sliceLoading ? <CardSkeleton count={6} /> : (
            <>
              {filtered.length === 0 ? (
                <EmptyState title="কোনো শিক্ষার্থী পাওয়া যায়নি" message="এই শাখায় কোনো শিক্ষার্থী নেই অথবা সার্চের সাথে মিলছে না।" />
              ) : (
                <Grid container spacing={2}>
                    {filtered.map(s => (
                        <Grid item xs={12} sm={6} md={4} key={s.id}>
                        <StudentCard
                            student={s}
                            onEdit={() => navigate(`/school/${id}/student/${s.id}/edit`)}
                            onDelete={() => handleDeleteStudent(s)}
                            onClick={() => navigate(`/school/${id}/student/${s.id}/dashboard`)}
                        />
                        </Grid>
                    ))}
                </Grid>
              )}
            </>
          )}
        </Box>
      )}

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} schoolId={id} onComplete={loadStudents} />

      <InputGuidance
        steps={guidanceSteps}
        activeStep={activeStep}
        onStepComplete={(step) => setActiveStep(step)}
      />
    </Box>
  );
}
