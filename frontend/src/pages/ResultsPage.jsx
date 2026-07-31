import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Stack,
  TextField,
  Menu,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  IconButton,
  Autocomplete,
  Tooltip,
  Checkbox,
  ListItemText
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ClearIcon from '@mui/icons-material/Clear';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EmptyState from '../components/EmptyState';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import ProtectedButton from '../components/ProtectedButton';
import { scopedGet } from '../utils/schoolApi';
import { isAuthenticated } from '../utils/auth';
import { useAuth } from '../context/AuthContext';
import InputGuidance from '../components/InputGuidance';
import { sortClassrooms } from '../utils/classroomUtils';

// Examination types mapping (labels)
const EXAM_TYPES = [
  { value: 'half_yearly', label: 'অর্ধবার্ষিক' },
  { value: 'annual', label: 'বার্ষিক' },
  { value: 'test', label: 'বিশেষ মূল্যায়ন' },
  { value: 'terminal', label: 'টার্মিনাল' },
  { value: 'model', label: 'মডেল টেস্ট' }
];

const getExamTypeLabel = (type) => {
  const t = EXAM_TYPES.find(x => x.value === type);
  return t ? t.label : (type || 'Examination');
};

const UNWANTED_SUBJECTS = [
  'ভৌৌতবিজ্ঞান', 'সামাজিক বিজ্ঞান'
];

const UNWANTED_KEYWORDS = [
  'অর্ধ-বার্ষিক', 'বার্ষিক', 'অর্ধবার্ষিক', 'test', 'model test'
];

const CO_CURRICULAR_SUBJECTS = [
  'শারীরিক শিক্ষা ও স্বাস্থ্য', 'শারীরিক শিক্ষা', 'Physical Education', 'Physical Education and Health',
  'ক্যারিয়ার শিক্ষা', 'ক্যারিয়ার শিক্ষা', 'Career Education', 'ক্যারিয়ার', 'ক্যারিয়ার',
  'Word Collection Achievement Test', 'WCAT',
  'বই পড়া', 'বই পড়া'
];

export default function ResultsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperUser = !!(
     user?.is_superuser || 
     user?.user?.is_superuser || 
     user?.is_staff || 
     user?.user?.is_staff ||
     (user?.username || user?.user?.username || '').toLowerCase().replace(/\u200d/g, '').trim() === 'bdadmin' || 
     (user?.username || user?.user?.username || '').toLowerCase().replace(/\u200d/g, '').trim() === 'shamir' ||
     (user?.username || user?.user?.username || '').toLowerCase().replace(/\u200d/g, '').trim() === 'umor'
   );
  const role = ((user && (user.role || user.profile?.effective_role || user.profile?.role)) || '').toLowerCase();
  const currentUserId = (user && (user.user?.id || user.id)) || null;
  const [assignments, setAssignments] = useState([]);
  const [tabValue, setTabValue] = useState(0);
  const [tourStep, setTourStep] = useState(0);

  // Examinations
  const [examinations, setExaminations] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');

  // Section selection for main view
  const [selectedSectionMain, setSelectedSectionMain] = useState('');
  const [sectionsMain, setSectionsMain] = useState([]);

  // Results
  const [results, setResults] = useState([]);
  const [overallResults, setOverallResults] = useState([]);
  const [downloadAnchor, setDownloadAnchor] = useState(null);

  const handleDownloadClick = (event) => setDownloadAnchor(event.currentTarget);
  const handleDownloadClose = () => setDownloadAnchor(null);

  // Add Results Dialog
  const [addResultsDialogOpen, setAddResultsDialogOpen] = useState(false);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  // Section selection for Add Result dialog
  const [sectionsForAdd, setSectionsForAdd] = useState([]);
  const [selectedSectionAdd, setSelectedSectionAdd] = useState(null);
  const [marks, setMarks] = useState({
    written: '',
    mcq: '',
    practical: ''
  });
  const [multiSubjectMarks, setMultiSubjectMarks] = useState({});
  const [calculatedGrade, setCalculatedGrade] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [savingResult, setSavingResult] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({ classroom: '', section: null, subject: '', exam: '' });
  const [bulkYear, setBulkYear] = useState('');
  const [bulkStudents, setBulkStudents] = useState([]);
  const [bulkMarks, setBulkMarks] = useState({});
  const [bulkSaving, setBulkSaving] = useState(false);
  // Edit/Delete state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingResult, setEditingResult] = useState(null);
  const [editMarks, setEditMarks] = useState({ written: '', mcq: '', practical: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, item: null });
  
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryRows, setSummaryRows] = useState([]);
  const [summaryExamType, setSummaryExamType] = useState('annual');
  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());
  const toast = useToast();

  const guidanceSteps = [
    { selector: '#bulk-marks-input-btn', text: 'মার্কস ইনপুট দিতে এখানে ক্লিক করুন', autoNext: false },
    { selector: '#bulk-class-select', text: 'শ্রেণি সিলেক্ট করুন', autoNext: false },
    { selector: '#bulk-section-select', text: 'সেকশন সিলেক্ট করুন', autoNext: false },
    { selector: '#bulk-subject-select', text: 'বিষয় সিলেক্ট করুন', autoNext: false },
    { selector: '#bulk-save-btn', text: 'সবশেষে ফলাফল সংরক্ষণ করুন', autoNext: false }
  ];

  const updateStep = (selector) => {
    const currentIdx = guidanceSteps.findIndex(s => s.selector === selector);
    if (currentIdx !== -1 && currentIdx < guidanceSteps.length - 1) {
      setTourStep(currentIdx + 2);
    } else if (currentIdx === guidanceSteps.length - 1) {
      setTourStep(guidanceSteps.length);
    }
  };

  const loadClasses = useCallback(() => {
    setLoadingClasses(true);
    scopedGet('/api/academics/classrooms/', id, {}, { timeout: 30000 })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        const sorted = sortClassrooms(data);
        setClasses(sorted);
        if (selectedClass && !sorted.some(c => String(c.id) === String(selectedClass))) {
          setSelectedClass('');
        }
        setLoadingClasses(false);
      })
      .catch(err => {
        console.error('Error loading classes:', err);
        toast.error('Failed to load classes');
        setLoadingClasses(false);
      });
  }, [id, role, assignments, selectedClass, toast]);

  const loadExaminations = useCallback(() => {
    setLoading(true);
    scopedGet('/api/results/examinations/', id, {}, { timeout: 30000 })
      .then(res => {
        console.log('Examinations API response:', res.data);
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        setExaminations(data);
        setLoading(false);
        if (data.length === 0) {
          toast.info('No examinations found for this school');
        }
      })
      .catch(err => {
        console.error('Error loading examinations:', err);
        toast.error('Failed to load examinations');
        setLoading(false);
      });
  }, [id, toast]);

  const loadExaminationsByClass = React.useCallback((classId) => {
    if (!classId) { setExaminations([]); return; }
    setLoading(true);
    scopedGet('/api/results/examinations/', id, { classroom: classId }, { timeout: 30000 })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        setExaminations(data);
        setLoading(false);
        if (data.length === 0) {
          toast.info('এই শ্রেণির জন্য কোনো পরীক্ষা পাওয়া যায়নি');
        }
      })
      .catch(err => {
        console.error('Error loading examinations for class:', err);
        toast.error('পরীক্ষা লোড ব্যর্থ');
        setLoading(false);
      });
  }, [id, toast]);

  const loadResults = useCallback((examId, sectionId = null) => {
    if (!examId || (!sectionId && !selectedSectionMain)) {
      console.log('loadResults deferred: exam or section missing');
      setResults([]);
      setOverallResults([]);
      return;
    }
    const effectiveSection = sectionId || selectedSectionMain;
    console.log('Loading results for examination:', examId, 'Section:', effectiveSection);
    setLoading(true);

    scopedGet('/api/results/results/', id, {
      examination: examId,
      section: effectiveSection === 'UNASSIGNED' ? 'null' : effectiveSection,
      page_size: 500
    }, { timeout: 15000 })
      .then(resultsRes => {
        const resultsData = Array.isArray(resultsRes.data) ? resultsRes.data : (resultsRes.data?.results || []);
        setResults(resultsData);
        return scopedGet('/api/results/overall/', id, {
          examination: examId,
          section: effectiveSection === 'UNASSIGNED' ? 'null' : effectiveSection,
          page_size: 500
        }, { timeout: 15000 });
      })
      .then(overallRes => {
        const overallData = Array.isArray(overallRes.data) ? overallRes.data : (overallRes.data?.results || []);
        setOverallResults(overallData);
        setLoading(false);
        toast.success('Results loaded');
      })
      .catch(async err => {
        console.error('Error loading results:', err);
        const fetchResultsPaginated = async () => {
          let page = 1;
          const maxPages = 10;
          let all = [];
          let hadNext = false;
          for (; page <= maxPages; page++) {
            try {
              const res = await scopedGet('/api/results/results/', id, { examination: examId, classroom: selectedClass || undefined, page, page_size: 500 }, { timeout: 12000 });
              const data = res.data;
              const arr = Array.isArray(data) ? data : (data?.results || []);
              all = all.concat(arr);
              if (data?.next) hadNext = true;
              else break;
              if (!arr.length) break;
            } catch (e) {
              if (e?.code === 'ECONNABORTED' || String(e?.message || '').includes('timeout')) break;
              else throw e;
            }
          }
          return { items: all, partial: hadNext };
        };

        try {
          const { items, partial } = await fetchResultsPaginated();
          setResults(items);
          try {
            const overallRes = await scopedGet('/api/results/overall/', id, { examination: examId, page_size: 500 }, { timeout: 12000 });
            const overallData = Array.isArray(overallRes.data) ? overallRes.data : (overallRes.data?.results || []);
            setOverallResults(overallData);
          } catch (eOver) { console.error('Error loading overall:', eOver); setOverallResults([]); }
          setLoading(false);
          toast[partial ? 'info' : 'success'](partial ? `Loaded ${items.length} results` : 'Results loaded');
        } catch (e2) { console.error('Fallback failed:', e2); setLoading(false); toast.error('Failed to load results'); }
      });
  }, [id, selectedClass, toast]);

  const loadSubjectsByClass = useCallback((classId, sectionId = null) => {
    if (!classId || sectionId === null) return;
    setLoadingSubjects(true);
    const params = { classroom: classId };
    if (sectionId && (Array.isArray(sectionId) ? sectionId.length > 0 : true)) {
      params.section = sectionId;
    }
    scopedGet('/api/academics/subjects/', id, params, { timeout: 30000 })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        // Filter out unwanted subjects
        let filtered = data.filter(s => {
          const name = String(s.name || '').trim().toLowerCase();
          // Filter out if exact match with unwanted list (to avoid generic parent subjects)
          if (UNWANTED_SUBJECTS.some(u => name === u.toLowerCase())) return false;

          // Check if it's a co-curricular subject first; don't filter these out by keywords
          const isCoCurricular = CO_CURRICULAR_SUBJECTS.some(sub => name.includes(sub.toLowerCase()));
          if (isCoCurricular) return true;

          // Filter out if contains unwanted keywords (like exam names accidentally saved as subjects)
          if (UNWANTED_KEYWORDS.some(u => name.includes(u.toLowerCase()))) return false;
          return true;
        });

        setSubjects(filtered);
        if (selectedSubject && !filtered.some(s => String(s.id) === String(selectedSubject))) setSelectedSubject('');
        if (bulkForm.subject && !filtered.some(s => String(s.id) === String(bulkForm.subject))) setBulkForm(p => ({ ...p, subject: '' }));
        const initial = {};
        for (const s of data) initial[s.id] = { written: '', mcq: '', practical: '' };
        setMultiSubjectMarks(initial);
        setLoadingSubjects(false);
      })
      .catch(err => { console.error('Error loading subjects:', err); toast.error('Failed to load subjects'); setLoadingSubjects(false); });
  }, [id, role, assignments, selectedSubject, bulkForm.subject, toast]);

  const loadSectionsByClass = useCallback((classId) => {
    if (!classId) { setSectionsForAdd([]); return; }
    scopedGet('/api/academics/sections/', id, { classroom: classId }, { timeout: 30000 })
      .then(res => { const data = Array.isArray(res.data) ? res.data : (res.data?.results || []); setSectionsForAdd(data); })
      .catch(() => setSectionsForAdd([]));
  }, [id]);

  const loadStudentsByClass = useCallback((classId, sectionId = null) => {
    if (!classId || sectionId === null) {
      setStudents([]);
      return;
    }
    setLoadingStudents(true);
    const params = { classroom: classId, page_size: 1000 };
    if (sectionId && (Array.isArray(sectionId) ? sectionId.length > 0 : true)) {
      if (Array.isArray(sectionId)) {
        params.section = sectionId.join(',');
      } else {
        params.section = sectionId === 'UNASSIGNED' ? 'null' : sectionId;
      }
    }
    scopedGet('/api/academics/students/', id, params, { timeout: 30000 })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        const sorted = [...data].sort((a, b) => {
          const ar = parseInt(String(a?.roll_number ?? '').replace(/\D/g, ''), 10);
          const br = parseInt(String(b?.roll_number ?? '').replace(/\D/g, ''), 10);
          const aNum = Number.isNaN(ar) ? null : ar;
          const bNum = Number.isNaN(br) ? null : br;
          if (aNum !== null && bNum !== null) return aNum - bNum;
          return String(a?.roll_number ?? '').localeCompare(String(b?.roll_number ?? ''), undefined, { numeric: true, sensitivity: 'base' });
        });
        setStudents(sorted);
        setLoadingStudents(false);
      })
      .catch(err => { console.error('Error loading students:', err); toast.error('Failed to load students'); setLoadingStudents(false); });
  }, [id, selectedSectionAdd, toast]);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!id) return;
    // Load classes and all examinations initially
    loadClasses();
    loadExaminations();
  }, [id, navigate, loadClasses, loadExaminations]);

  useEffect(() => {
    // ডিরেকশন সেট করার লজিক - শুধুমাত্র টিচার এবং এডমিনদের জন্য
    const isGuidanceAllowed = role === 'teacher' || role === 'admin' || isSuperUser;
    if (isGuidanceAllowed && tourStep === 0) {
      const timer = setTimeout(() => {
        setTourStep(1);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [role, isSuperUser, tourStep]);

  // Open Edit dialog prefilled with selected result
  const handleOpenEdit = (result) => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    setEditingResult(result);
    setEditMarks({
      written: parseFloat(result.written_marks) || '',
      mcq: parseFloat(result.mcq_marks) || '',
      practical: parseFloat(result.practical_marks) || ''
    });
    setEditDialogOpen(true);
  };

  const handleCloseEdit = () => {
    setEditDialogOpen(false);
    setEditingResult(null);
  };

  // Save edited marks
  const handleSaveEdit = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!editingResult) return;
    try {
      setSavingEdit(true);
      const examId = parseInt(editingResult.examination?.id || editingResult.examination);
      const w = parseFloat(editMarks.written) || 0;
      const m = parseFloat(editMarks.mcq) || 0;
      const p = parseFloat(editMarks.practical) || 0;
      await api.post(`/api/results/examinations/${examId}/bulk_results/?school=${id}`, {
        school_id: id,
        results: [{
          student_id: parseInt(editingResult.student?.id || editingResult.student, 10),
          subject_id: parseInt(editingResult.subject?.id || editingResult.subject, 10),
          written_marks: w,
          mcq_marks: m,
          practical_marks: p,
          remarks: editingResult.remarks || ''
        }]
      });
      toast.success('Result updated successfully (bulk)');
      handleCloseEdit();
      setSelectedExam(examId);
      loadResults(examId);
    } catch (e) {
      console.error('Failed to update result:', e?.response?.data || e);
      const msg = e?.response?.data?.detail || 'Failed to update result';
      toast.error(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete flow
  const handleOpenDelete = (result) => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    setDeleteDialog({ open: true, item: result });
  };
  const handleConfirmDelete = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!deleteDialog.item) return;
    try {
      await api.delete(`/api/results/results/${deleteDialog.item.id}/`);
      toast.success('Result deleted');
      setDeleteDialog({ open: false, item: null });
      loadResults(selectedExam);
    } catch (e) {
      console.error('Delete failed:', e?.response?.data || e);
      toast.error('Failed to delete result');
    }
  };
  
  const getClassroomId = useCallback((cls) => {
    const v = typeof cls === 'object' ? (cls?.id ?? null) : cls;
    const s = typeof v === 'string' ? String(v).replace(/[০-৯]/g, (d) => {
      const m = { '০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9' };
      return m[d] ?? d;
    }) : v;
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? null : n;
  }, []);

  const getExamsForClass = useCallback((classId) => {
    if (!classId) return [];
    const cidStr = typeof classId === 'string' ? String(classId).replace(/[০-৯]/g, (d) => {
      const m = { '০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9' };
      return m[d] ?? d;
    }) : classId;
    const cid = parseInt(cidStr, 10);
    return examinations.filter(ex => getClassroomId(ex.classroom) === cid);
  }, [examinations, getClassroomId]);
  const getExamYear = (exam) => {
    try {
      if (exam?.year) return parseInt(exam.year, 10);
      // Try to parse from name first if year is missing, as name often contains the year
      const name = String(exam?.name || '');
      const m = name.match(/(19|20)\d{2}/);
      if (m) return parseInt(m[0], 10);
      // Fallback to date
      const d = exam?.exam_date ? new Date(exam.exam_date) : null;
      if (d && !Number.isNaN(d.getTime())) return d.getFullYear();
      return null;
    } catch (_) { return null; }
  };
  const normalizeName = (s) => String(s || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
  const findSubjectExam = (subjectName) => {
    try {
      const classId = selectedClass;
      if (!classId || !subjectName) return null;
      const targetType = (getExamById(selectedExam)?.exam_type) || null;
      const targetSection = selectedSectionAdd ? parseInt(String(selectedSectionAdd), 10) : null;
      const exams = getExamsForClass(classId);
      let candidates = exams.filter(ex => normalizeName(ex.name) === normalizeName(subjectName));
      if (targetType) candidates = candidates.filter(ex => String(ex.exam_type) === String(targetType));
      if (targetSection != null && !Number.isNaN(targetSection)) {
        candidates = candidates.filter(ex => parseInt(String(ex.section ?? ex.section_id ?? ex.section), 10) === targetSection);
      } else {
        const sectionLess = candidates.find(ex => ex.section == null);
        if (sectionLess) return sectionLess;
      }
      return candidates[0] || null;
    } catch (_) { return null; }
  };

  // Filter students based on search term (handled by Autocomplete, but kept here if students list changes)
  useEffect(() => {
    // This effect is now mostly redundant due to Autocomplete's built-in filtering,
    // but we'll keep the students state updated.
  }, [studentSearchTerm, students]);

  const isMajorExam = (exam) => {
    if (!exam) return false;
    const name = (exam.name || '').trim().toLowerCase();
    const type = (exam.exam_type || '').toLowerCase();

    // Allowed if type matches standard types
    if (['half_yearly', 'annual', 'terminal', 'test', 'model', 'first_term', 'final'].includes(type)) return true;

    // Keywords for main exams and evaluations
    const keywords = ['অর্ধ', 'বার্ষিক', 'সাময়িক', 'half', 'yearly', 'annual', 'terminal', 'test', 'মডেল', 'মূল্যায়ন', 'পরীক্ষা', 'সাপ্তাহিক'];
    return keywords.some(k => name.includes(k));
  };

  const handleClassChange = (e) => {
    const classId = e.target.value;
    setSelectedClass(classId);
    setSelectedSubject('');
    setSelectedStudent('');
    setSelectedSectionAdd(null);
    setSelectedSectionMain(''); // Reset main section
    setMarks({ written: 0, mcq: 0, practical: 0 });
    setCalculatedGrade('');
    setStudentSearchTerm('');
    // Load exams filtered by class; user will select an exam
    setSelectedExam('');
    loadExaminationsByClass(classId);
    // Only load students after section selection
    loadSubjectsByClass(classId);
    loadSectionsByClass(classId);

    // Load sections for main view
    scopedGet('/api/academics/sections/', id, { classroom: classId })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        setSectionsMain(data);
      })
      .catch(() => setSectionsMain([]));
  };
  


  const setMultiSubjectMark = (sid, field, value) => {
    const examObj = getExamById(selectedExam);
    const subjName = (subjects.find(s => s.id === parseInt(sid)) || {}).name;
    const max = getMaxForField(examObj, field, subjName);
    let v = value === '' ? '' : parseFloat(value);
    if (v !== '') {
      if (!Number.isFinite(v)) v = 0;
      if (v < 0) v = 0;
      if (Number.isFinite(max)) v = Math.min(v, max);
    }
    setMultiSubjectMarks(prev => ({
      ...prev,
      [sid]: { ...(prev[sid] || { written: '', mcq: '', practical: '' }), [field]: v }
    }));
  };

  const loadExistingMarksForStudent = React.useCallback(async (examId, studentId) => {
    if (!examId || !studentId) return;
    try {
      const res = await scopedGet('/api/results/results/', id, { examination: parseInt(examId, 10), student: parseInt(studentId, 10), page_size: 500 }, { timeout: 20000 });
      const arr = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setMultiSubjectMarks(prev => {
        const next = { ...prev };
        for (const r of arr) {
          const sid = r.subject?.id || r.subject;
          if (sid) {
            const w = parseFloat(r.written_marks);
            const m = parseFloat(r.mcq_marks);
            const p = parseFloat(r.practical_marks);
            next[sid] = {
              written: w !== 0 ? w : '',
              mcq: m !== 0 ? m : '',
              practical: p !== 0 ? p : ''
            };
          }
        }
        return next;
      });
    } catch (_) {}
  }, [id]);

  useEffect(() => {
    if (selectedExam && selectedStudent) {
      loadExistingMarksForStudent(selectedExam, selectedStudent);
      (async () => {
        try {
          const res = await scopedGet('/api/results/results/', id, { examination: parseInt(selectedExam, 10), student: parseInt(selectedStudent, 10), page_size: 1 }, { timeout: 12000 });
          const arr = Array.isArray(res.data) ? res.data : (res.data?.results || []);
          if (!arr || arr.length === 0) {
            const allRes = await api.get(`/api/results/results/?student=${parseInt(selectedStudent, 10)}&page_size=2000`);
            const list = Array.isArray(allRes.data) ? allRes.data : (allRes.data?.results || []);
            if (list && list.length) {
              const examIds = list.map(r => r.examination?.id || r.examination).filter(Boolean);
              const unique = Array.from(new Set(examIds));
              const candidates = unique
                .map(eid => examinations.find(ex => ex.id === parseInt(eid, 10)))
                .filter(Boolean)
                .filter(ex => !selectedClass || getClassroomId(ex.classroom) === parseInt(selectedClass, 10));
              const sorted = candidates.sort((a, b) => {
                const da = new Date(a.exam_date || a.created_at || 0).getTime();
                const db = new Date(b.exam_date || b.created_at || 0).getTime();
                return db - da;
              });
              const pick = sorted[0] || candidates[0];
              if (pick?.id && String(pick.id) !== String(selectedExam)) {
                setSelectedExam(pick.id);
                loadResults(pick.id);
              }
            }
          }
        } catch (_) {}
      })();
    }
  }, [selectedExam, selectedStudent, loadExistingMarksForStudent, examinations, selectedClass, loadResults, id, getClassroomId]);

  useEffect(() => {
    if (selectedStudent && selectedSubject && multiSubjectMarks[selectedSubject]) {
      const existing = multiSubjectMarks[selectedSubject];
    setMarks({
      written: existing.written !== undefined && existing.written !== null && parseFloat(existing.written) !== 0 ? existing.written : '',
      mcq: existing.mcq !== undefined && existing.mcq !== null && parseFloat(existing.mcq) !== 0 ? existing.mcq : '',
      practical: existing.practical !== undefined && existing.practical !== null && parseFloat(existing.practical) !== 0 ? existing.practical : ''
    });
    }
  }, [selectedStudent, selectedSubject, multiSubjectMarks]);

  const loadExistingBulkMarks = useCallback(async (examId, subjectId) => {
    if (!examId || !subjectId) return;
    try {
      const res = await scopedGet('/api/results/results/', id, {
        examination: parseInt(examId, 10),
        subject: parseInt(subjectId, 10),
        page_size: 1000
      }, { timeout: 20000 });
      const arr = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      const newBulkMarks = {};
      for (const r of arr) {
        const sid = r.student?.id || r.student;
        if (sid) {
          const w = parseFloat(r.written_marks);
          const m = parseFloat(r.mcq_marks);
          const p = parseFloat(r.practical_marks);
          newBulkMarks[sid] = {
            written: w !== 0 ? w : '',
            mcq: m !== 0 ? m : '',
            practical: p !== 0 ? p : ''
          };
        }
      }
      setBulkMarks(newBulkMarks);
    } catch (e) {
      console.error('Error loading bulk marks:', e);
    }
  }, [id]);

  useEffect(() => {
    const examId = bulkForm.exam || selectedExam;
    const subjectId = bulkForm.subject;
    if (bulkDialogOpen && examId && subjectId) {
      loadExistingBulkMarks(examId, subjectId);
    }
  }, [bulkDialogOpen, bulkForm.exam, selectedExam, bulkForm.subject, loadExistingBulkMarks]);

  // Load sections for selected class in Add Result dialog

  
  const handleOpenAddResultsDialog = () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    // Security checks removed as per request
    setSavingResult(false);
    setAddResultsDialogOpen(true);
    // Preselect first class if none selected to avoid empty state
    try {
      if (!selectedClass && examinations && examinations.length > 0) {
        // no-op for exam; selectedExam already set by loader
      }
      // If classes already loaded in ResultsPage (we keep them in local 'classes')
      if (!selectedClass && classes && classes.length > 0) {
        const firstClassId = classes[0].id;
        setSelectedClass(firstClassId);
        // Ensure an exam for this class is selected
        const classExams = examinations.filter(ex => ex.classroom === parseInt(firstClassId));
        if (classExams.length > 0) setSelectedExam(classExams[0].id);
        // Preload subjects and sections for the class (students load after section selection)
        loadSubjectsByClass(firstClassId);
        loadSectionsByClass(firstClassId);
      }
    } catch (_) {}
  };
  
  const handleCloseAddResultsDialog = () => {
    setAddResultsDialogOpen(false);
    resetAddResultsForm();
  };
  
  const resetAddResultsForm = () => {
    setSelectedClass('');
    setSelectedStudent('');
    setSelectedSubject('');
    setSelectedSectionAdd(null);
    setMarks({
      written: '',
      mcq: '',
      practical: ''
    });
    setCalculatedGrade('');
    setMultiSubjectMarks({});
  };
  
  const getExamById = (eid) => {
    const n = parseInt(eid);
    if (Number.isNaN(n)) return undefined;
    return examinations.find(ex => ex.id === n);
  };
  const getClassGroup = (className) => {
    const x = String(className || '').toLowerCase();
    if (/ষষ্ঠ|six|\b6\b|সপ্তম|seven|\b7\b|অষ্টম|eight|\b8\b/.test(x)) return 'six_to_eight';
    if (/নবম|nine|\b9\b|দশম|ten|\b10\b/.test(x)) return 'nine_ten';
    return null;
  };
  const SUBJECT_MAXIMA = {
    six_to_eight: {
      'bangla first paper': { written: 70, mcq: 30, practical: 0 },
      'বাংলা প্রথম পত্র': { written: 70, mcq: 30, practical: 0 },
      'বাংলা-১ম পত্র': { written: 70, mcq: 30, practical: 0 },
      'বাংলা-১ম': { written: 70, mcq: 30, practical: 0 },
      'bangla second paper': { written: 35, mcq: 15, practical: 0 },
      'বাংলা দ্বিতীয় পত্র': { written: 35, mcq: 15, practical: 0 },
      'বাংলা-২য় পত্র': { written: 35, mcq: 15, practical: 0 },
      'বাংলা-২য়': { written: 35, mcq: 15, practical: 0 },
      'english first paper': { written: 100, mcq: 0, practical: 0 },
      'english': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজি': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজী': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজি-১ম': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজী-১ম': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজি প্রথম পত্র': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজি-১ম পত্র': { written: 100, mcq: 0, practical: 0 },
      'english second paper': { written: 50, mcq: 0, practical: 0 },
      'ইংরেজি-২য়': { written: 50, mcq: 0, practical: 0 },
      'ইংরেজী-২য়': { written: 50, mcq: 0, practical: 0 },
      'ইংরেজি দ্বিতীয় পত্র': { written: 50, mcq: 0, practical: 0 },
      'ইংরেজি-২য় পত্র': { written: 50, mcq: 0, practical: 0 },
      'mathematics': { written: 70, mcq: 30, practical: 0 },
      'গণিত': { written: 70, mcq: 30, practical: 0 },
      'সাধারণ গণিত': { written: 70, mcq: 30, practical: 0 },
      'science': { written: 70, mcq: 30, practical: 0 },
      'বিজ্ঞান': { written: 70, mcq: 30, practical: 0 },
      'bgs': { written: 70, mcq: 30, practical: 0 },
      'বাংলাদেশ ও বিশ্বপরিচয়': { written: 70, mcq: 30, practical: 0 },
      'বাংলাদেশ ও বিশ্বপরিচয়': { written: 70, mcq: 30, practical: 0 },
      'সমাজ': { written: 70, mcq: 30, practical: 0 },
      'ict': { written: 10, mcq: 15, practical: 25 },
      'আইসিটি': { written: 10, mcq: 15, practical: 25 },
      'তথ্য ও যোগাযোগ প্রযুক্তি': { written: 10, mcq: 15, practical: 25 },
      'religion': { written: 70, mcq: 30, practical: 0 },
      'ধর্ম': { written: 70, mcq: 30, practical: 0 },
      'ইসলাম শিক্ষা': { written: 70, mcq: 30, practical: 0 },
      'ইসলাম ও নৈতিক শিক্ষা': { written: 70, mcq: 30, practical: 0 },
      'হিন্দু ধর্ম': { written: 70, mcq: 30, practical: 0 },
      'agriculture': { written: 50, mcq: 25, practical: 25 },
      'কৃষি শিক্ষা': { written: 50, mcq: 25, practical: 25 },
      'কৃষি শিক্ষা/গার্হস্থ্য বিজ্ঞান': { written: 50, mcq: 25, practical: 25 },
      'home economics': { written: 50, mcq: 25, practical: 25 },
      'গার্হস্থ্য বিজ্ঞান': { written: 50, mcq: 25, practical: 25 }
    },
    nine_ten: {
      'bangla first paper': { written: 70, mcq: 30, practical: 0 },
      'বাংলা প্রথম পত্র': { written: 70, mcq: 30, practical: 0 },
      'বাংলা-১ম পত্র': { written: 70, mcq: 30, practical: 0 },
      'বাংলা-১ম': { written: 70, mcq: 30, practical: 0 },
      'bangla second paper': { written: 70, mcq: 30, practical: 0 },
      'বাংলা দ্বিতীয় পত্র': { written: 70, mcq: 30, practical: 0 },
      'বাংলা-২য় পত্র': { written: 70, mcq: 30, practical: 0 },
      'বাংলা-২য়': { written: 70, mcq: 30, practical: 0 },
      'english first paper': { written: 100, mcq: 0, practical: 0 },
      'english': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজি': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজী': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজি-১ম': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজী-১ম': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজি প্রথম পত্র': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজি-১ম পত্র': { written: 100, mcq: 0, practical: 0 },
      'english second paper': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজি-২য়': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজী-২য়': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজি দ্বিতীয় পত্র': { written: 100, mcq: 0, practical: 0 },
      'ইংরেজি-২য় পত্র': { written: 100, mcq: 0, practical: 0 },
      'mathematics': { written: 70, mcq: 30, practical: 0 },
      'গণিত': { written: 70, mcq: 30, practical: 0 },
      'সাধারণ গণিত': { written: 70, mcq: 30, practical: 0 },
      'ict': { written: 0, mcq: 25, practical: 25 },
      'আইসিটি': { written: 0, mcq: 25, practical: 25 },
      'তথ্য ও যোগাযোগ প্রযুক্তি': { written: 0, mcq: 25, practical: 25 },
      'physics': { written: 50, mcq: 25, practical: 25 },
      'পদার্থবিজ্ঞান': { written: 50, mcq: 25, practical: 25 },
      'পদার্থ': { written: 50, mcq: 25, practical: 25 },
      'chemistry': { written: 50, mcq: 25, practical: 25 },
      'রসায়ন': { written: 50, mcq: 25, practical: 25 },
      'রসায়ন': { written: 50, mcq: 25, practical: 25 },
      'biology': { written: 50, mcq: 25, practical: 25 },
      'জীববিজ্ঞান': { written: 50, mcq: 25, practical: 25 },
      'higher math': { written: 50, mcq: 25, practical: 25 },
      'higher mathematics': { written: 50, mcq: 25, practical: 25 },
      'উচ্চতর গণিত': { written: 50, mcq: 25, practical: 25 },
      'religion': { written: 70, mcq: 30, practical: 0 },
      'ধর্ম': { written: 70, mcq: 30, practical: 0 },
      'ইসলাম শিক্ষা': { written: 70, mcq: 30, practical: 0 },
      'ইসলাম ও নৈতিক শিক্ষা': { written: 70, mcq: 30, practical: 0 },
      'হিন্দু ধর্ম': { written: 70, mcq: 30, practical: 0 },
      'history': { written: 70, mcq: 30, practical: 0 },
      'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা': { written: 70, mcq: 30, practical: 0 },
      'geography': { written: 70, mcq: 30, practical: 0 },
      'ভূগোল ও পরিবেশ': { written: 70, mcq: 30, practical: 0 },
      'civics': { written: 70, mcq: 30, practical: 0 },
      'পৌরনীতি ও নাগরিকতা': { written: 70, mcq: 30, practical: 0 },
      'economics': { written: 70, mcq: 30, practical: 0 },
      'অর্থনীতি': { written: 70, mcq: 30, practical: 0 },
      'accounting': { written: 70, mcq: 30, practical: 0 },
      'হিসাববিজ্ঞান': { written: 70, mcq: 30, practical: 0 },
      'finance': { written: 70, mcq: 30, practical: 0 },
      'ফিন্যান্স ও ব্যাংকিং': { written: 70, mcq: 30, practical: 0 },
      'business entrepreneurship': { written: 70, mcq: 30, practical: 0 },
      'ব্যবসায় উদ্যোগ': { written: 70, mcq: 30, practical: 0 },
      'agriculture': { written: 50, mcq: 25, practical: 25 },
      'কৃষি শিক্ষা': { written: 50, mcq: 25, practical: 25 },
      'কৃষি শিক্ষা/গার্হস্থ্য বিজ্ঞান': { written: 50, mcq: 25, practical: 25 },
      'home economics': { written: 50, mcq: 25, practical: 25 },
      'গার্হস্থ্য বিজ্ঞান': { written: 50, mcq: 25, practical: 25 }
    }
  };

  const getSubjectMaximaForClass = (subjectName, overrideClassId = null) => {
    const classId = overrideClassId || selectedClass;
    const clsObj = classes.find(c => c.id === parseInt(classId)) || {};
    const className = String(clsObj.name || '').toLowerCase();

    let group = 'six_to_eight';
    if (/নবম|দশম|nine|ten|10|9/.test(className)) {
        group = 'nine_ten';
    }

    const s = String(subjectName || '').trim().toLowerCase();

    // English detection logic for ALL classes (usually 100 marks, no MCQ)
    if (s.includes('english') || s.includes('ইংরেজি') || s.includes('ইংরেজী')) {
        return { written: 100, mcq: 0, practical: 0 };
    }

    // Robust substring matching for Science subjects in 9-10
    if (group === 'nine_ten') {
        if (s.includes('পদার্থ') || s.includes('physics')) return SUBJECT_MAXIMA.nine_ten['physics'];
        if (s.includes('রসায়ন') || s.includes('রসায়ন') || s.includes('chemistry')) return SUBJECT_MAXIMA.nine_ten['chemistry'];
        if (s.includes('জীব') || s.includes('biology')) return SUBJECT_MAXIMA.nine_ten['biology'];
        if (s.includes('উচ্চতর') || s.includes('higher math')) return SUBJECT_MAXIMA.nine_ten['higher math'];
        if (s.includes('ict') || s.includes('তথ্য')) return SUBJECT_MAXIMA.nine_ten['ict'];
    }

    return SUBJECT_MAXIMA[group][s] || { written: 70, mcq: 30, practical: 0 };
  };

  // Grade and GPA Calculation with 4th Subject logic
  const calculateResultStats = (studentResults, isNineTen = false) => {
    let totalGradePoints = 0;
    let totalSubjects = 0;
    let failed = false;
    let fourthSubjectPoints = 0;

    studentResults.forEach(r => {
      const gpa = parseFloat(r.gpa) || 0;
      const subjName = (r.subject?.name || '').toLowerCase();

      // Skip co-curricular subjects from GPA calculation
      const isCoCurricular = CO_CURRICULAR_SUBJECTS.some(sub => subjName.includes(sub.toLowerCase()));
      if (isCoCurricular) return;

      // Check if it's 4th subject (assuming 'agriculture' or 'কৃষি' for now, can be dynamic)
      const isFourth = subjName.includes('কৃষি') || subjName.includes('agriculture') || subjName.includes('fourth');

      if (isFourth && isNineTen) {
        fourthSubjectPoints = Math.max(0, gpa - 2);
      } else {
        totalGradePoints += gpa;
        totalSubjects++;
        if (gpa === 0) failed = true;
      }
    });

    let finalGpa = totalSubjects > 0 ? (totalGradePoints + fourthSubjectPoints) / totalSubjects : 0;
    if (failed) finalGpa = 0;

    return Math.min(5.00, finalGpa).toFixed(2);
  };
  const getMaxForField = (examObj, field, subjectName, overrideClassId = null) => {
    const subjExam = findSubjectExam(subjectName);
    const e = subjExam || ((examObj && normalizeName(examObj.name) === normalizeName(subjectName)) ? examObj : null);
    if (e) {
      const val = field === 'written' ? parseFloat(e.written_max) : field === 'mcq' ? parseFloat(e.mcq_max) : field === 'practical' ? parseFloat(e.practical_max) : undefined;
      if (Number.isFinite(val)) return val;
    }
    const m = getSubjectMaximaForClass(subjectName, overrideClassId);
    if (!m) return undefined;
    return field === 'written' ? m.written : field === 'mcq' ? m.mcq : m.practical;
  };

  const handleMarksChange = (field, value) => {
    const examObj = getExamById(selectedExam);
    const subjName = (subjects.find(s => s.id === parseInt(selectedSubject)) || {}).name;
    const max = getMaxForField(examObj, field, subjName);
    let v = value === '' ? '' : parseFloat(value);
    if (v !== '') {
      if (!Number.isFinite(v)) v = 0;
      if (v < 0) v = 0;
      if (Number.isFinite(max)) v = Math.min(v, max);
    }
    const newMarks = { ...marks, [field]: v };
    setMarks(newMarks);
    
    // Calculate grade based on total marks
    const totalMarks = (parseFloat(newMarks.written) || 0) + (parseFloat(newMarks.mcq) || 0) + (parseFloat(newMarks.practical) || 0);
    const selectedExamObj = examinations.find(exam => exam.id === selectedExam);
    if (selectedExamObj) {
      const wMax = parseFloat(selectedExamObj.written_max) || 0;
      const mMax = parseFloat(selectedExamObj.mcq_max) || 0;
      const pMax = parseFloat(selectedExamObj.practical_max) || 0;
      const totalMax = (wMax + mMax + pMax) || (parseFloat(selectedExamObj.total_marks) || 0);
      const percentage = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0;
      
      let grade = '';
      if (percentage >= 80) grade = 'A+';
      else if (percentage >= 70) grade = 'A';
      else if (percentage >= 60) grade = 'A-';
      else if (percentage >= 50) grade = 'B';
      else if (percentage >= 40) grade = 'C';
      else if (percentage >= 33) grade = 'D';
      else grade = 'F';
      
      setCalculatedGrade(grade);
    }
  };
  
  const verifyPersistedResult = async (examId, studentId, subjectId) => {
    try {
      const r = await api.get(`/api/results/results/?examination=${examId}&student=${parseInt(studentId, 10)}&school=${id}`);
      const arr = Array.isArray(r.data) ? r.data : (r.data?.results || []);
      // Consider success if any result exists for this exam & student
      return Array.isArray(arr) && arr.length > 0;
    } catch (_) {
      return false;
    }
  };

  const handleSaveResult = () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!selectedExam || !selectedClass || !selectedStudent || !selectedSubject) {
      toast.error('Please select examination, class, student, and subject');
      return;
    }
    // Assignment check for teachers removed as per request

    setSavingResult(true);
    
    // Convert string values to numbers for marks
    const writtenMarks = marks.written !== '' ? parseFloat(marks.written) : 0;
    const mcqMarks = marks.mcq !== '' ? parseFloat(marks.mcq) : 0;
    const practicalMarks = marks.practical !== '' ? parseFloat(marks.practical) : 0;
    
    // Use the bulk_results endpoint instead of trying to create a result directly
    const examId = parseInt(selectedExam);
    const examObjForRedirect = examinations.find(ex => ex.id === examId) || null;
    const clsIdRedirect = String(selectedClass);
    const stuIdRedirect = String(selectedStudent);
    const secIdRedirect = String(selectedSectionAdd || '');
    const examTypeRedirect = String(examObjForRedirect?.exam_type || 'annual');
    const urlRedirect = `/school/${id}/result-card?classroom=${encodeURIComponent(clsIdRedirect)}&student=${encodeURIComponent(stuIdRedirect)}&exam_type=${encodeURIComponent(examTypeRedirect)}${secIdRedirect ? `&section=${encodeURIComponent(secIdRedirect)}` : ''}&exam=${encodeURIComponent(String(examId))}&auto=1`;
    const resultData = {
      examination: examId,
      school_id: id,
      results: [
        {
          examination: examId,
          student_id: parseInt(selectedStudent),
          subject_id: parseInt(selectedSubject),
          written_marks: writtenMarks,
          mcq_marks: mcqMarks,
          practical_marks: practicalMarks
        }
      ]
    };
    
    console.log('Sending result data:', resultData);
    
    // Use the bulk_results endpoint on the examination
    api.post(`/api/results/examinations/${examId}/bulk_results/?school=${id}`, resultData)
      .then(res => {
        console.log('Result saved successfully:', res.data);
        const created = res.data?.created ?? 0;
        const updated = res.data?.updated ?? 0;
        const errorsArr = res.data?.errors || [];
        if ((created + updated) === 0 && Array.isArray(errorsArr) && errorsArr.length > 0) {
          console.warn('Bulk results returned errors on first attempt:', errorsArr);
          const firstErr = (errorsArr[0]?.error || JSON.stringify(errorsArr[0] || ''));
          toast.warning(`Server rejected result format: ${firstErr}. Retrying with alternate fields...`);
          // Retry with alternate keys: student, subject (instead of *_id)
          const altPayload = {
            examination: examId,
            school_id: id,
            results: [
              {
                examination: examId,
                student: parseInt(selectedStudent),
                subject: parseInt(selectedSubject),
                written_marks: writtenMarks,
                mcq_marks: mcqMarks,
                practical_marks: practicalMarks
              }
            ]
          };
          return api.post(`/api/results/examinations/${examId}/bulk_results/?school=${id}`, altPayload).then(async (res2) => {
            console.log('Alternate payload save response:', res2.data);
            let c2 = res2.data?.created ?? 0;
            let u2 = res2.data?.updated ?? 0;
            if ((c2 + u2) === 0) {
              // Try plain array payload with *_id shape
              const plainArray = [
                {
                  examination: examId,
                  student_id: parseInt(selectedStudent),
                  subject_id: parseInt(selectedSubject),
                  written_marks: writtenMarks,
                  mcq_marks: mcqMarks,
                  practical_marks: practicalMarks
                }
              ];
              try {
                const res3 = await api.post(`/api/results/examinations/${examId}/bulk_results/?school=${id}`, { examination: examId, school_id: id, results: plainArray });
                console.log('Plain array payload save response:', res3.data);
                const c3 = res3.data?.created ?? 0;
                const u3 = res3.data?.updated ?? 0;
                if ((c3 + u3) === 0) {
                  // Final attempt: include total_obtained for compatibility
                  const totalObtained = writtenMarks + mcqMarks + practicalMarks;
                  const withTotal = [
                    {
                      examination: examId,
                      student_id: parseInt(selectedStudent),
                      subject_id: parseInt(selectedSubject),
                      written_marks: writtenMarks,
                      mcq_marks: mcqMarks,
                      practical_marks: practicalMarks,
                      total_obtained: totalObtained
                    }
                  ];
                  const res4 = await api.post(`/api/results/examinations/${examId}/bulk_results/?school=${id}`, { examination: examId, school_id: id, results: withTotal });
                  console.log('With total_obtained payload save response:', res4.data);
                  const c4 = res4.data?.created ?? 0;
                  const u4 = res4.data?.updated ?? 0;
                  if ((c4 + u4) === 0) {
                    // Absolute fallback: single-result create API
                    try {
                      const singlePayload = {
                        examination: examId,
                        student_id: parseInt(selectedStudent),
                        subject_id: parseInt(selectedSubject),
                        written_marks: writtenMarks,
                        mcq_marks: mcqMarks,
                        practical_marks: practicalMarks,
                        total_obtained: totalObtained
                      };
                      const singleRes = await api.post(`/api/results/results/`, singlePayload);
                      console.log('Single create response:', singleRes.data);
                      toast.success('Result added successfully');
                      setSavingResult(false);
                      handleCloseAddResultsDialog();
                      loadResults(examId);
                      verifyPersistedResult(examId, selectedStudent, selectedSubject).then(() => {
                        window.location.assign(urlRedirect);
                      });
                      return singleRes;
                    } catch (singleErr) {
                      console.error('Single create error:', singleErr?.response?.data || singleErr);
                      const msg = typeof singleErr?.response?.data === 'string' ? singleErr.response.data : (singleErr?.response?.data?.detail || 'No details');
                      toast.error(`Failed to add result: ${msg}`);
                      setSavingResult(false);
                    }
                  } else {
                    toast.success('Result added successfully');
                    setSavingResult(false);
                    handleCloseAddResultsDialog();
                    loadResults(examId);
                    verifyPersistedResult(examId, selectedStudent, selectedSubject).then(() => {
                      window.location.assign(urlRedirect);
                    });
                  }
                  return res4;
                } else {
                  toast.success('Result added successfully');
                  setSavingResult(false);
                  handleCloseAddResultsDialog();
                  loadResults(examId);
                  verifyPersistedResult(examId, selectedStudent, selectedSubject).then(() => {
                    window.location.assign(urlRedirect);
                  });
                  return res3;
                }
              } catch (e3) {
                console.error('Plain array payload error:', e3?.response?.data || e3);
                throw e3;
              }
            } else {
              toast.success('Result added successfully');
              setSavingResult(false);
              handleCloseAddResultsDialog();
              loadResults(examId);
              verifyPersistedResult(examId, selectedStudent, selectedSubject).then(() => {
                window.location.assign(urlRedirect);
              });
              return res2;
            }
          });
        } else {
          toast.success('Result added successfully');
        }
        handleCloseAddResultsDialog();
        const examObjNow = examinations.find(ex => ex.id === examId) || null;
        const stuObj = students.find(s => s.id === parseInt(selectedStudent)) || { id: parseInt(selectedStudent), user: {} };
        const subjObj = subjects.find(s => s.id === parseInt(selectedSubject)) || { id: parseInt(selectedSubject), name: '' };
        const totalNow = writtenMarks + mcqMarks + practicalMarks;
        const newItem = {
          student: stuObj,
          subject: subjObj,
          written_marks: writtenMarks,
          mcq_marks: mcqMarks,
          practical_marks: practicalMarks,
          total_obtained: totalNow,
          examination: examObjNow || examId
        };
        setResults(prev => {
          const idx = prev.findIndex(r => (r.student?.id === stuObj.id || r.student === stuObj.id) && (r.subject?.id === subjObj.id || r.subject === subjObj.id));
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...newItem };
            return next;
          }
          return [newItem, ...prev];
        });
        loadResults(examId);
        verifyPersistedResult(examId, selectedStudent, selectedSubject).then(ok => {
          if (ok) {
            toast.success('Result added successfully');
          } else {
            toast.error('Result could not be verified on server. Please retry.');
          }
          window.location.assign(urlRedirect);
        });
      })
      .catch(err => {
        console.error('Error saving result:', err);
        if (err.response && err.response.data) {
          console.error('Server response:', err.response.data);
        }
        const serverMsg = typeof err.response?.data === 'string' ? err.response.data : (err.response?.data?.detail || '');
        const serverErrors = err.response?.data?.errors ? JSON.stringify(err.response.data.errors) : '';
        const msg = serverMsg || err.message || 'Failed to save result';
        toast.error(`Failed to save result: ${msg}${serverErrors ? ' | ' + serverErrors : ''}`);
        setSavingResult(false);
      })
      .catch(err => {
        const msg = (err?.response?.data?.detail) || 'অনুমতি নেই বা ইনপুট ব্যর্থ';
        toast.error(msg);
        setSavingResult(false);
      });
  };

  const handleExamChange = (e) => {
    const examId = parseInt(e.target.value, 10);
    if (!Number.isNaN(examId)) {
      setSelectedExam(examId);
      loadResults(examId, selectedSectionMain);
    } else {
      setSelectedExam('');
    }
  };

  const handleExportResults = () => {
    toast.info('Downloading results...');
    const base = api.defaults?.baseURL || (process.env.REACT_APP_API_URL || window.location.origin);
    const url = `${String(base).replace(/\/+$/,'')}/api/results/results/export_csv/?examination=${selectedExam}&school=${id}`;
    window.open(url, '_blank');
  };

  const handleExportOverall = () => {
    toast.info('Downloading overall results...');
    const base = api.defaults?.baseURL || (process.env.REACT_APP_API_URL || window.location.origin);
    const url = `${String(base).replace(/\/+$/,'')}/api/results/overall/export_csv/?examination=${selectedExam}&school=${id}`;
    window.open(url, '_blank');
  };

  const openBulkDialog = () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    // Security checks removed as per request
    if (!classes.length) {
      loadClasses();
    }
    if (tourStep === 1) setTourStep(2);
    setBulkDialogOpen(true);
    // Reset everything to empty for better performance
    setBulkForm({ classroom: '', section: null, subject: '', exam: '' });
    setBulkStudents([]);
    setBulkMarks({});
    setBulkYear('');
  };

  const closeBulkDialog = () => {
    setBulkDialogOpen(false);
    setBulkForm({ classroom: '', section: null, subject: '', exam: '' });
    setBulkStudents([]);
    setBulkMarks({});
    setBulkSaving(false);
  };

  useEffect(() => {
    if (selectedExam && examinations.length && !examinations.some(ex => String(ex.id) === String(selectedExam))) {
      setSelectedExam('');
    }
  }, [examinations, selectedExam]);

  useEffect(() => {
    if (examinations.length === 0 && selectedExam) {
      setSelectedExam('');
    }
  }, [examinations]);

  useEffect(() => {
    if (role === 'teacher' && currentUserId && id) {
      api.get(`/api/academics/assignments/?teacher=${currentUserId}&school=${id}`)
        .then(res => {
          const arr = Array.isArray(res.data) ? res.data : (res.data?.results || []);
          const normalized = arr.map(a => ({
            classroom: a.classroom?.id || a.classroom,
            section: a.section?.id || a.section || null,
            subject: a.subject?.id || a.subject
          })).filter(x => x.classroom && x.subject);
          setAssignments(normalized);
        })
        .catch(() => setAssignments([]));
    } else {
      setAssignments([]);
    }
  }, [role, currentUserId, id]);

  useEffect(() => {
    if (selectedClass && !selectedExam) {
      const list = getExamsForClass(selectedClass);
      if (list.length && selectedSectionMain) {
        setSelectedExam(list[0].id);
        loadResults(list[0].id, selectedSectionMain);
      }
    }
  }, [selectedClass, examinations, getExamsForClass, loadResults, selectedExam, selectedSectionMain]);
  useEffect(() => {
    setBulkStudents(students);
  }, [students]);

  useEffect(() => {
    // Auto-select exam for Single Add Form
    if (addResultsDialogOpen && selectedClass && !selectedExam) {
        const classExams = getExamsForClass(selectedClass);
        if (classExams.length > 0) {
            const major = classExams.find(isMajorExam);
            setSelectedExam(major ? major.id : classExams[0].id);
        }
    }
  }, [addResultsDialogOpen, examinations, selectedClass, selectedExam, getExamsForClass]);

  useEffect(() => {
    // Auto-select exam for Bulk Form
    if (bulkDialogOpen && bulkForm.classroom && !bulkForm.exam) {
      const classExams = getExamsForClass(bulkForm.classroom);
      if (classExams.length > 0) {
        const major = classExams.find(isMajorExam);
        setBulkForm(prev => ({ ...prev, exam: major ? major.id : classExams[0].id }));
      }
    }
  }, [bulkDialogOpen, examinations, bulkForm.classroom, bulkForm.exam, getExamsForClass]);

  useEffect(() => {
    const cls = bulkForm.classroom;
    if (!cls) return;
    const exams = getExamsForClass(cls);
    const years = Array.from(new Set(exams.map(ex => getExamYear(ex)).filter(Boolean))).sort((a, b) => b - a);
    
    // Auto-set year only if not already set
    if (!bulkYear && years.length) {
      setBulkYear(String(years[0]));
    }

    // Filter exams by the current bulkYear
    const filtered = exams.filter(ex => {
      if (!bulkYear) return true;
      const yr = getExamYear(ex);
      return yr != null && String(yr) === String(bulkYear);
    });

    // If the currently selected exam is NOT in the filtered list, pick the first available one from filtered
    if (filtered.length > 0) {
      const isCurrentExamValid = filtered.some(ex => String(ex.id) === String(bulkForm.exam));
      if (!bulkForm.exam || !isCurrentExamValid) {
        // Preference for major exams when auto-selecting
        const major = filtered.find(isMajorExam);
        setBulkForm(prev => ({ ...prev, exam: major ? major.id : filtered[0].id }));
      }
    } else if (!bulkYear && exams.length > 0 && !bulkForm.exam) {
      const major = exams.find(isMajorExam);
      setBulkForm(prev => ({ ...prev, exam: major ? major.id : exams[0].id }));
    }
  }, [bulkForm.classroom, examinations, bulkYear, bulkForm.exam, getExamsForClass]);

  const setBulkMark = (sid, field, value) => {
    const examObj = getExamById(bulkForm.exam || selectedExam);
    const subjectName = (subjects.find(s => s.id === parseInt(bulkForm.subject)) || {}).name;
    const max = getMaxForField(examObj, field, subjectName, bulkForm.classroom);
    let v = value === '' ? '' : parseFloat(value);
    if (v !== '') {
      if (!Number.isFinite(v)) v = 0;
      if (v < 0) v = 0;
      if (Number.isFinite(max)) v = Math.min(v, max);
    }
    setBulkMarks(prev => ({ ...prev, [sid]: { ...(prev[sid] || {}), [field]: v } }));
  };

  const handleKeyDown = (e, studentId, field) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const currentIndex = bulkStudents.findIndex(s => s.id === studentId);
      if (currentIndex < bulkStudents.length - 1) {
        const nextStudentId = bulkStudents[currentIndex + 1].id;
        const nextInput = document.querySelector(`input[data-student-id="${nextStudentId}"][data-field="${field}"]`);
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }
    }
  };

  const saveBulkMarks = async () => {
    const examId = parseInt(bulkForm.exam || selectedExam);
    const subjectId = parseInt(bulkForm.subject);
    const classroomId = parseInt(bulkForm.classroom);
    if (!examId || !subjectId || !classroomId) { toast.error('পরীক্ষা, শ্রেণি ও বিষয় নির্বাচন করুন'); return; }
    const examObj = examinations.find(ex => ex.id === examId);
    if (!examObj || getClassroomId(examObj.classroom) !== classroomId) { toast.error('নির্বাচিত পরীক্ষা ওই শ্রেণির নয়'); return; }
    
    // Assignment check for teachers removed as per request
    if (examObj && examObj.total_marks) {
      toast.info(`এই বাল্ক ইনপুটে হিসাব হবে মোট ${examObj.total_marks} ধরে`);
    }
    const rows = (bulkStudents || []).map(s => ({ sid: s.id, m: bulkMarks[s.id] || {} })).filter(r => ((parseFloat(r.m.written) || 0) + (parseFloat(r.m.mcq) || 0) + (parseFloat(r.m.practical) || 0)) > 0);
    if (rows.length === 0) { toast.info('কোনো নম্বর প্রদান করা হয়নি'); return; }
    setBulkSaving(true);
    const payload = {
      examination: examId,
      school_id: id,
      is_admin: isSuperUser, // Add flag to indicate admin status
      results: rows.map(r => ({
        examination: examId,
        student_id: parseInt(r.sid),
        subject_id: subjectId,
        written_marks: r.m.written || 0,
        mcq_marks: r.m.mcq || 0,
        practical_marks: r.m.practical || 0
      }))
    };
    try {
      await api.post(`/api/results/examinations/${examId}/bulk_results/?school=${id}`, payload);
      toast.success('বাল্ক ফলাফল সংরক্ষণ হয়েছে');
      closeBulkDialog();
      loadResults(examId);
    } catch (e) {
      console.error('Bulk save error:', e?.response?.data || e);
      const msg = (e?.response?.status === 403 && (e?.response?.data?.detail)) ? e.response.data.detail : 'বাল্ক ফল সংরক্ষণ ব্যর্থ';
      toast.error(msg);
    } finally {
      setBulkSaving(false);
    }
  };

  // Distinct hex colors per grade to avoid visual similarity (A vs B)
  const getGradeStyle = (grade) => {
    const map = {
      'A+': { bg: '#2e7d32', fg: '#ffffff' },   // deep green
      'A':  { bg: '#1565c0', fg: '#ffffff' },   // darker blue
      'A-': { bg: '#6a1b9a', fg: '#ffffff' },   // purple
      'B':  { bg: '#795548', fg: '#ffffff' },   // brown
      'C':  { bg: '#f9a825', fg: '#000000' },   // amber
      'D':  { bg: '#757575', fg: '#ffffff' },   // grey
      'F':  { bg: '#d32f2f', fg: '#ffffff' }    // red
    };
    return map[grade] || { bg: '#9e9e9e', fg: '#ffffff' };
  };

  const isClassNineOrTen = () => {
    try {
      const clsObj = classes.find(c => c.id === parseInt(selectedClass));
      const name = String(clsObj?.name || '').toLowerCase();
      return /নবম|দশম|\b9\b|\b10\b/.test(name);
    } catch (_) { return false; }
  };
  const isBanglaFirst = (name) => {
    const n = String(name || '').replace(/\s*\(.*?\)\s*/g, '').trim();
    const lower = n.toLowerCase();
    return !!(lower.includes('বাংলা প্রথম') || lower.includes('bangla first') || lower.includes('বাংলা-১') || lower.includes('1st'));
  };
  const isBanglaSecond = (name) => {
    const n = String(name || '').replace(/\s*\(.*?\)\s*/g, '').trim();
    const lower = n.toLowerCase();
    return !!(lower.includes('বাংলা দ্বিত') || lower.includes('bangla second') || lower.includes('বাংলা-২') || lower.includes('2nd'));
  };
  const isBanglaPaper = (name) => isBanglaFirst(name) || isBanglaSecond(name);
  const banglaCombinedPassForStudent = (studentId) => {
    try {
      const list = (results || []).filter(r => {
        const sid = typeof r.student === 'object' ? r.student?.id : r.student;
        return sid === studentId && isBanglaPaper(r.subject?.name || r.subject_name);
      });
      if (!list.length) return false;
      const examObj = examinations.find(ex => ex.id === selectedExam) || {};
      const passMarks = parseFloat(examObj?.pass_marks) || 33;

      const totalObtained = list.reduce((s, r) => {
        const w = parseFloat(r.written_marks) || 0;
        const m = parseFloat(r.mcq_marks) || 0;
        const p = parseFloat(r.practical_marks) || 0;
        return s + (w + m + p);
      }, 0);

      // Pass if total obtained is at least 33% of 200 (for two papers)
      return totalObtained >= (passMarks * 2);
    } catch (_) { return false; }
  };

  // Pass rule for display across all tabs: any non-'F' grade counts as Passed
  const isPassed = (row) => {
    const g = row?.grade;
    return (g && g !== 'F') || !!row?.is_passed;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4">
          <AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          রেজাল্ট ও পরীক্ষা
        </Typography>

        <Box sx={{ flexGrow: 1, display: { xs: 'none', sm: 'flex' }, justifyContent: 'center' }}>
          <Button
            id="bulk-marks-input-btn"
            variant="contained"
            color="secondary"
            onClick={openBulkDialog}
            sx={{ fontWeight: 'bold', px: 4 }}
          >
            মার্কস ইনপুট করুন
          </Button>
        </Box>

        <Stack direction="row" spacing={1} justifyContent={{ xs: 'center', sm: 'flex-end' }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
          >
            ব্যাক
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleOpenAddResultsDialog}
            sx={{ display: 'inline-flex' }}
          >
            ফলাফল তৈরি করুন
          </Button>
          {/* Mobile view specific for Bulk Button */}
          <Button
            variant="contained"
            color="secondary"
            onClick={openBulkDialog}
            sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
          >
            মার্কস ইনপুট
          </Button>
        </Stack>
      </Stack>

      {/* Exam Selector */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <TextField
              select
              label="শ্রেণি নির্বাচন করুন"
              value={selectedClass}
              onChange={handleClassChange}
              sx={{ minWidth: 200 }}
            >
              {classes.map(classroom => (
                <MenuItem key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="সেকশন নির্বাচন করুন"
              value={selectedSectionMain}
              onChange={(e) => {
                const secId = e.target.value;
                setSelectedSectionMain(secId);
                if (selectedExam) loadResults(selectedExam, secId);
              }}
              sx={{ minWidth: 200 }}
              disabled={!selectedClass}
            >
              <MenuItem value="">নির্বাচন করুন</MenuItem>
              {sectionsMain.map(sec => (
                <MenuItem key={sec.id} value={sec.id}>{sec.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="পরীক্ষা নির্বাচন করুন"
              value={examinations.length ? selectedExam : ''}
              onChange={handleExamChange}
              sx={{ minWidth: 250 }}
              fullWidth
            >
              {(selectedClass ? getExamsForClass(selectedClass) : examinations)
                .filter(isMajorExam)
                .map(exam => (
                  <MenuItem key={exam.id} value={exam.id}>
                    {(exam.name || 'বিষয়')} — {getExamTypeLabel(exam.exam_type)}
                  </MenuItem>
                ))}
            </TextField>
            
            <Button
                variant="contained"
                color="info"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadClick}
                disabled={!selectedExam}
            >
                ডাউনলোড
            </Button>
            <Menu
                anchorEl={downloadAnchor}
                open={Boolean(downloadAnchor)}
                onClose={handleDownloadClose}
            >
                <MenuItem onClick={() => { handleExportResults(); handleDownloadClose(); }}>ফলাফল (CSV)</MenuItem>
                <MenuItem onClick={() => { handleExportOverall(); handleDownloadClose(); }}>গড় ফলাফল (CSV)</MenuItem>
            </Menu>

            <Button
                variant="contained"
                startIcon={<PrintIcon />}
                onClick={() => window.print()}
                disabled={!selectedExam}
            >
                প্রিন্ট
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <style>
        {`
          @media print {
            .no-print { display: none !important; }
          }
        `}
      </style>

      {loading && <TableSkeleton rows={10} columns={10} />}

      {!loading && examinations.length === 0 && (
        <EmptyState
          icon={AssessmentIcon}
          title="No examinations yet"
          message="Examinations and results will appear here once they are created in the system"
        />
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="বিষয় ভিত্তিক পরীক্ষার ফল" />
          <Tab label="সামগ্রিক ফলাফল" />
          <Tab label="পরিসংখ্যান" />
          <Tab label="Result Summary (Pass-Fail)" />
        </Tabs>
      </Box>

      {/* Tab 1: Subject-wise Results */}
      {tabValue === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>রোল</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>শিক্ষার্থীর নাম</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>বিষয়</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">লিখিত</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">এমসিকিউ</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">প্র্যাকটিক্যাল</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">মোট</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">গ্রেড</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">জিপিএ</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">অবস্থা</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">অ্যাকশন</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((result, idx) => {
                const student = result.student;
                const studentName = `${student.user?.first_name || ''} ${student.user?.last_name || ''}`.trim() || student.user?.username;
                return (
                  <TableRow key={idx} hover>
                    <TableCell>{student.roll_number || result.student_roll_number || '-'}</TableCell>
                    <TableCell>{studentName}</TableCell>
                    <TableCell>{result.subject?.name}</TableCell>
                    <TableCell align="center">{parseFloat(result.written_marks) || 0}</TableCell>
                    <TableCell align="center">{parseFloat(result.mcq_marks) || 0}</TableCell>
                    <TableCell align="center">{parseFloat(result.practical_marks) || 0}</TableCell>
                    <TableCell align="center">
                      {(() => {
                        const w = parseFloat(result.written_marks) || 0;
                        const m = parseFloat(result.mcq_marks) || 0;
                        const p = parseFloat(result.practical_marks) || 0;
                        const total = w + m + p;
                        return <strong>{total}</strong>;
                      })()}
                    </TableCell>
                    {(() => {
                      const serverGrade = result.grade;
                      const serverGpa = result.gpa;
                      const serverPassed = result.is_passed;
                      const failed = serverPassed === false;
                      const grade = failed ? 'F' : (serverGrade || 'F');
                      const gpa = failed ? '0.00' : ((serverGpa !== undefined && serverGpa !== null) ? parseFloat(serverGpa) : '0.00');
                      const s = getGradeStyle(grade);
                      let passed = !!serverPassed;
                      try {
                        const subjName = result.subject?.name || '';
                        const stuId = typeof result.student === 'object' ? result.student?.id : result.student;
                        if (isClassNineOrTen() && isBanglaPaper(subjName) && stuId) {
                          if (banglaCombinedPassForStudent(stuId)) passed = true;
                        }
                      } catch (_) {}
                      return (
                        <>
                          <TableCell align="center">
                            <Chip label={grade} size="small" sx={{ bgcolor: s.bg, color: s.fg, fontWeight: 'bold' }} />
                          </TableCell>
                          <TableCell align="center">{gpa}</TableCell>
                          <TableCell align="center">
                            <Chip label={passed ? 'Passed' : 'Failed'} color={passed ? 'success' : 'error'} size="small" />
                          </TableCell>
                        </>
                      );
                    })()}
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <ProtectedButton size="small" color="primary" onClick={() => handleOpenEdit(result)}>
                          <EditIcon fontSize="small" />
                        </ProtectedButton>
                        <ProtectedButton size="small" color="error" onClick={() => handleOpenDelete(result)}>
                          <DeleteIcon fontSize="small" />
                        </ProtectedButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Tab 2: Overall Results */}
      {tabValue === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'secondary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Rank</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Roll</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Student Name</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Total Obtained</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Total Possible</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Percentage</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">CGPA</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Grade</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {overallResults
                .sort((a, b) => {
                  // Sort by rank first (if available), then by CGPA, then by percentage
                  if (a.rank && b.rank) return a.rank - b.rank;
                  if (a.rank && !b.rank) return -1;
                  if (!a.rank && b.rank) return 1;
                  
                  // If no rank, sort by CGPA (descending)
                  const cgpaA = parseFloat(a.cgpa) || 0;
                  const cgpaB = parseFloat(b.cgpa) || 0;
                  if (cgpaB !== cgpaA) return cgpaB - cgpaA;
                  
                  // If CGPA is tied, sort by percentage (descending)
                  const percentageA = parseFloat(a.percentage) || 0;
                  const percentageB = parseFloat(b.percentage) || 0;
                  return percentageB - percentageA;
                })
                .map((result, idx) => {
                  const student = result.student;
                  const studentName = `${student.user?.first_name || ''} ${student.user?.last_name || ''}`.trim() || student.user?.username;
                  return (
                    <TableRow key={idx} hover>
                      <TableCell><strong>{result.rank || idx + 1}</strong></TableCell>
                      <TableCell>{student.roll_number || result.student_roll_number || '-'}</TableCell>
                      <TableCell>{studentName}</TableCell>
                      <TableCell align="center">{result.total_marks_obtained}</TableCell>
                      <TableCell align="center">{result.total_marks_possible}</TableCell>
                      <TableCell align="center">{result.percentage}%</TableCell>
                      <TableCell align="center"><strong>{result.cgpa}</strong></TableCell>
                      <TableCell align="center">
                        {(() => { const s = getGradeStyle(result.grade); return (
                          <Chip label={result.grade} size="small" sx={{ bgcolor: s.bg, color: s.fg, fontWeight: 'bold' }} />
                        ); })()}
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={isPassed(result) ? 'Passed' : 'Failed'} color={isPassed(result) ? 'success' : 'error'} size="small" />
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Tab 3: Statistics */}
      {tabValue === 2 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Pass Rate</Typography>
                <Typography variant="h3" color="primary">
                  {overallResults.length > 0 
                    ? Math.round((overallResults.filter(r => isPassed(r)).length / overallResults.length) * 100)
                    : 0}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {overallResults.filter(r => isPassed(r)).length} / {overallResults.length} students passed
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Average CGPA</Typography>
                <Typography variant="h3" color="secondary">
                  {overallResults.length > 0
                    ? (overallResults.reduce((sum, r) => sum + parseFloat(r.cgpa), 0) / overallResults.length).toFixed(2)
                    : '0.00'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Across all students
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Top Performer</Typography>
                <Typography variant="h3" color="success.main">
                  {overallResults[0]?.cgpa || '0.00'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {overallResults[0] 
                    ? `${overallResults[0].student.user?.first_name || ''} ${overallResults[0].student.user?.last_name || ''}`.trim()
                    : 'N/A'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tab 4: Result Summary */}
      {tabValue === 3 && (
        <Card sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }}>
            <TextField
              select
              label="Exam Type"
              value={summaryExamType}
              onChange={(e) => setSummaryExamType(e.target.value)}
              sx={{ minWidth: 220 }}
            >
              {EXAM_TYPES.map(t => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Year"
              value={summaryYear}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setSummaryYear(Number.isNaN(v) ? '' : v);
              }}
              type="number"
              sx={{ width: 140 }}
            />
            <Button
              variant="contained"
              onClick={async () => {
                setSummaryLoading(true);
                try {
                  const clsRes = await scopedGet('/api/academics/classrooms/', id, {}, { timeout: 20000 });
                  const clsArr = Array.isArray(clsRes.data) ? clsRes.data : (clsRes.data?.results || []);
                  const allRows = [];
                  for (const classroom of clsArr) {
                    const secRes = await scopedGet('/api/academics/sections/', id, { classroom: classroom.id }, { timeout: 20000 });
                    const secArr = Array.isArray(secRes.data) ? secRes.data : (secRes.data?.results || []);
                    const exRes = await scopedGet('/api/results/examinations/', id, { classroom: classroom.id }, { timeout: 20000 });
                    const exArr = Array.isArray(exRes.data) ? exRes.data : (exRes.data?.results || []);
                    const exam = exArr.find(e => (String(e.exam_type || '').toLowerCase() === String(summaryExamType).toLowerCase()) && (parseInt(e.academic_year, 10) === parseInt(summaryYear, 10)));
                    for (const section of secArr) {
                      const stuRes = await scopedGet('/api/academics/students/', id, { classroom: classroom.id, section: section.id }, { timeout: 30000 });
                      const studentsArr = Array.isArray(stuRes.data) ? stuRes.data : (stuRes.data?.results || []);
                      let resultsArr = [];
                      if (exam) {
                        const rRes = await scopedGet('/api/results/results/', id, { examination: exam.id, page_size: 2000 }, { timeout: 30000 });
                        resultsArr = Array.isArray(rRes.data) ? rRes.data : (rRes.data?.results || []);
                      }
                      const byStudent = new Map();
                      for (const r of resultsArr) {
                        const sid = typeof r.student === 'object' ? r.student?.id : r.student;
                        if (!sid) continue;
                        if (!byStudent.has(sid)) byStudent.set(sid, []);
                        byStudent.get(sid).push(r);
                      }
                      const totalStudents = studentsArr.length;
                      let present = 0;
                      let passed = 0;
                      let failed = 0;
                      let absent = 0;
                      for (const stu of studentsArr) {
                        const sid = stu.id;
                        const list = byStudent.get(sid) || [];
                        if (!list.length) {
                          absent += 1;
                          continue;
                        }
                        present += 1;
                        let anyFail = list.some(it => (it?.grade === 'F') || (it?.is_passed === false));
                        try {
                          const clsObj = classes.find(c => c.id === classroom.id);
                          const clsName = String(clsObj?.name || classroom.name || '').toLowerCase();
                          const is910 = /নবম|দশম|\b9\b|\b10\b/.test(clsName);
                          if (is910) {
                            const combinedPass = banglaCombinedPassForStudent(sid);
                            if (combinedPass) {
                              const adjusted = list.filter(it => {
                                const nm = it.subject?.name || it.subject_name || '';
                                const fail = (it?.grade === 'F') || (it?.is_passed === false);
                                if (!fail) return false;
                                return isBanglaPaper(nm);
                              });
                              if (adjusted.length) {
                                anyFail = list.some(it => {
                                  const nm = it.subject?.name || it.subject_name || '';
                                  const fail = (it?.grade === 'F') || (it?.is_passed === false);
                                  if (!fail) return false;
                                  return !isBanglaPaper(nm);
                                });
                              }
                            }
                          }
                        } catch (_) {}
                        if (anyFail) failed += 1; else passed += 1;
                      }
                      allRows.push({
                        classroom: classroom.name,
                        section: section.name,
                        total: totalStudents,
                        present,
                        passed,
                        failed,
                        absent
                      });
                    }
                  }
                  setSummaryRows(allRows);
                } catch (e) {
                  setSummaryRows([]);
                } finally {
                  setSummaryLoading(false);
                }
              }}
              disabled={summaryLoading}
            >
              {summaryLoading ? 'Loading…' : 'Generate Summary'}
            </Button>
          </Stack>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Class</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Section</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Total</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Present</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Passed</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Failed</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Absent</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summaryRows.map((row, idx) => (
                  <TableRow key={`${row.classroom}-${row.section}-${idx}`}>
                    <TableCell>{row.classroom}</TableCell>
                    <TableCell>{row.section}</TableCell>
                    <TableCell align="center">{row.total}</TableCell>
                    <TableCell align="center">{row.present}</TableCell>
                    <TableCell align="center">{row.passed}</TableCell>
                    <TableCell align="center">{row.failed}</TableCell>
                    <TableCell align="center">{row.absent}</TableCell>
                  </TableRow>
                ))}
                {summaryRows.length > 0 && (
                  <TableRow sx={{ bgcolor: 'secondary.light' }}>
                    <TableCell colSpan={2}><strong>Total</strong></TableCell>
                    <TableCell align="center"><strong>{summaryRows.reduce((s, r) => s + r.total, 0)}</strong></TableCell>
                    <TableCell align="center"><strong>{summaryRows.reduce((s, r) => s + r.present, 0)}</strong></TableCell>
                    <TableCell align="center"><strong>{summaryRows.reduce((s, r) => s + r.passed, 0)}</strong></TableCell>
                    <TableCell align="center"><strong>{summaryRows.reduce((s, r) => s + r.failed, 0)}</strong></TableCell>
                    <TableCell align="center"><strong>{summaryRows.reduce((s, r) => s + r.absent, 0)}</strong></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
      {/* Add Results Dialog */}
      <Dialog
        open={addResultsDialogOpen}
        onClose={handleCloseAddResultsDialog}
        maxWidth="md"
        fullWidth
        scroll="paper"
      >
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', py: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">নতুন ফলাফল যোগ করুন</Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                color="success"
                size="small"
                onClick={handleSaveResult}
                disabled={savingResult || !selectedClass || !selectedStudent || !selectedSubject || !selectedExam}
                sx={{ fontWeight: 'bold' }}
              >
                {savingResult ? <CircularProgress size={16} color="inherit" /> : 'সেভ'}
              </Button>
              <Button
                variant="contained"
                color="secondary"
                size="small"
                onClick={async () => {
                  if (!selectedExam || !selectedClass || !selectedStudent) { toast.error('পরীক্ষা, শ্রেণি ও শিক্ষার্থী নির্বাচন করুন'); return; }
                  const examId = parseInt(selectedExam);
                  try {
                    setSavingResult(true);
                    const rows = subjects.map(s => {
                      const m = multiSubjectMarks[s.id] || { written: '', mcq: '', practical: '' };
                      return {
                        examination: examId,
                        student_id: parseInt(selectedStudent),
                        subject_id: s.id,
                        written_marks: parseFloat(m.written) || 0,
                        mcq_marks: parseFloat(m.mcq) || 0,
                        practical_marks: parseFloat(m.practical) || 0
                      };
                    }).filter(r => (r.written_marks || 0) + (r.mcq_marks || 0) + (r.practical_marks || 0) > 0);
                    if (rows.length === 0) { toast.info('কোনো বিষয়ের নম্বর প্রদান করা হয়নি'); setSavingResult(false); return; }
                    const payload = { examination: examId, school_id: id, results: rows };
                    await api.post(`/api/results/examinations/${examId}/bulk_results/?school=${id}`, payload);
                    toast.success('সব বিষয়ের ফলাফল সংরক্ষণ হয়েছে');
                    handleCloseAddResultsDialog();
                    loadResults(examId);
                  } catch (e) {
                    console.error('Save all subjects error:', e?.response?.data || e);
                    toast.error('সব বিষয়ের ফলাফল সংরক্ষণ ব্যর্থ');
                  } finally {
                    setSavingResult(false);
                  }
                }}
                disabled={savingResult || !selectedClass || !selectedStudent || !subjects.length || !selectedExam}
                sx={{ fontWeight: 'bold' }}
              >
                {savingResult ? <CircularProgress size={16} color="inherit" /> : 'সব সেভ'}
              </Button>
            </Stack>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ overflowY: 'auto' }}>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Class Selection */}
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>শ্রেণি নির্বাচন করুন</InputLabel>
                <Select
                  value={selectedClass}
                  onChange={handleClassChange}
                  label="শ্রেণি নির্বাচন করুন"
                  disabled={loadingClasses}
                >
                  {classes.map(classroom => (
                    <MenuItem key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>সেকশন নির্বাচন করুন</InputLabel>
                <Select
                  multiple
                  value={selectedSectionAdd || []}
                  onChange={(e) => {
                    const value = e.target.value;
                    // If "সব সেকশন" (empty string) was clicked, clear selection to show all
                    if (value.includes("")) {
                      setSelectedSectionAdd([]);
                      if (selectedClass) {
                        loadStudentsByClass(selectedClass, []);
                        loadSubjectsByClass(selectedClass, []);
                      }
                      return;
                    }
                    setSelectedSectionAdd(value);
                    if (selectedClass) {
                      loadStudentsByClass(selectedClass, value);
                      loadSubjectsByClass(selectedClass, value);
                    }
                  }}
                  renderValue={(selected) => {
                    if (selected.length === 0) return 'সব সেকশন (All)';
                    return selected.map(id => sectionsForAdd.find(s => String(s.id) === String(id))?.name).filter(Boolean).join(', ');
                  }}
                  label="সেকশন নির্বাচন করুন"
                  disabled={!selectedClass}
                >
                  {sectionsForAdd.map(sec => (
                    <MenuItem key={sec.id} value={sec.id}>
                      <Checkbox checked={(selectedSectionAdd || []).indexOf(sec.id) > -1} />
                      <ListItemText primary={sec.name} />
                    </MenuItem>
                  ))}
                  <MenuItem value="">সব সেকশন (রিসেট)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Examination Selection */
            }
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>পরীক্ষা নির্বাচন করুন</InputLabel>
                <Select
                  value={getExamsForClass(selectedClass).length ? selectedExam : ''}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setSelectedExam(Number.isNaN(v) ? '' : v);
                  }}
                  label="পরীক্ষা নির্বাচন করুন"
                >
                  {getExamsForClass(selectedClass)
                    .map(exam => (
                      <MenuItem key={exam.id} value={exam.id}>
                        {`${exam.name} (${getExamTypeLabel(exam.exam_type)}) — মোট: ${exam.total_marks}`}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Student Selection */}
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <Autocomplete
                  options={students}
                  getOptionLabel={(student) => 
                    `${student.user?.first_name || ''} ${student.user?.last_name || ''} (${student.roll_number || 'No Roll'})`
                  }
                  value={students.find(s => s.id === selectedStudent) || null}
                  onChange={(event, newValue) => {
                    setSelectedStudent(newValue?.id || '');
                  }}
                  inputValue={studentSearchTerm}
                  onInputChange={(event, newInputValue) => {
                    setStudentSearchTerm(newInputValue);
                  }}
                  disabled={!selectedClass || loadingStudents}
                  loading={loadingStudents}
                  noOptionsText="কোন শিক্ষার্থী পাওয়া যায়নি"
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="শিক্ষার্থী নির্বাচন করুন"
                      variant="outlined"
                      placeholder="নাম বা রোল নম্বর লিখুন..."
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {loadingStudents ? <CircularProgress color="inherit" size={20} /> : null}
                            {studentSearchTerm && (
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setStudentSearchTerm('');
                                }}
                              >
                                <ClearIcon fontSize="small" />
                              </IconButton>
                            )}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  filterOptions={(options, { inputValue }) => {
                    if (!inputValue) return options;
                    const searchTerm = inputValue.toLowerCase();
                    return options.filter(option => {
                      const fullName = `${option.user?.first_name || ''} ${option.user?.last_name || ''}`.toLowerCase();
                      const rollNumber = option.roll_number?.toLowerCase() || '';
                      return fullName.includes(searchTerm) || rollNumber.includes(searchTerm);
                    });
                  }}
                  renderOption={(props, student) => (
                    <li {...props}>
                      <div>
                        <div>{student.user?.first_name} {student.user?.last_name}</div>
                        <div style={{ fontSize: '0.8em', color: '#666' }}>
                          রোল: {student.roll_number || 'N/A'}
                        </div>
                      </div>
                    </li>
                  )}
                  fullWidth
                />
              </FormControl>
            </Grid>

            {/* Subject Selection */}
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>বিষয় নির্বাচন করুন *</InputLabel>
                <Select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  label="বিষয় নির্বাচন করুন *"
                  disabled={!selectedClass || loadingSubjects}
                >
                  {subjects.map(subject => {
                    const isOptional = String(subject.id) === String(students.find(s => s.id === selectedStudent)?.optional_subject?.id || students.find(s => s.id === selectedStudent)?.optional_subject);
                    return (
                      <MenuItem key={subject.id} value={subject.id}>
                        {subject.name} {isOptional ? '(৪র্থ বিষয়)' : ''}
                      </MenuItem>
                    );
                  })}
                </Select>
                {loadingSubjects && <CircularProgress size={24} sx={{ ml: 1 }} />}
              </FormControl>
            </Grid>

            {/* Marks Entry */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="h6" gutterBottom>নম্বর প্রদান করুন</Typography>
            </Grid>
            
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="লিখিত নম্বর"
                type="number"
                fullWidth
                value={marks.written}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleMarksChange('written', e.target.value)}
                placeholder={String(getMaxForField(getExamById(selectedExam), 'written', (subjects.find(s => s.id === parseInt(selectedSubject)) || {}).name) ?? '')}
                InputProps={{ inputProps: { min: 0, max: getMaxForField(getExamById(selectedExam), 'written', (subjects.find(s => s.id === parseInt(selectedSubject)) || {}).name) ?? undefined } }}
              />
            </Grid>
            
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="এমসিকিউ নম্বর"
                type="number"
                fullWidth
                value={marks.mcq}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleMarksChange('mcq', e.target.value)}
                placeholder={String(getMaxForField(getExamById(selectedExam), 'mcq', (subjects.find(s => s.id === parseInt(selectedSubject)) || {}).name) ?? '')}
                InputProps={{ inputProps: { min: 0, max: getMaxForField(getExamById(selectedExam), 'mcq', (subjects.find(s => s.id === parseInt(selectedSubject)) || {}).name) ?? undefined } }}
                disabled={(() => {
                  const sname = String((subjects.find(s => s.id === parseInt(selectedSubject)) || {}).name || '').toLowerCase();
                  return sname.includes('english') || sname.includes('ইংরেজি') || sname.includes('ইংরেজী');
                })()}
              />
            </Grid>
            
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="প্র্যাকটিক্যাল নম্বর"
                type="number"
                fullWidth
                value={marks.practical}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleMarksChange('practical', e.target.value)}
                placeholder={String(getMaxForField(getExamById(selectedExam), 'practical', (subjects.find(s => s.id === parseInt(selectedSubject)) || {}).name) ?? '')}
                InputProps={{ inputProps: { min: 0, max: getMaxForField(getExamById(selectedExam), 'practical', (subjects.find(s => s.id === parseInt(selectedSubject)) || {}).name) ?? undefined } }}
              />
            </Grid>

            {/* Calculated Grade */}
            <Grid size={{ xs: 12 }}>
              <Card sx={{ bgcolor: 'background.default', p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body1">মোট নম্বর: <strong>{(parseFloat(marks.written) || 0) + (parseFloat(marks.mcq) || 0) + (parseFloat(marks.practical) || 0)}</strong></Typography>
                  {(() => { const examObj = examinations.find(ex => ex.id === parseInt(selectedExam)); return (
                    <Typography variant="body2" color="text.secondary">বর্তমান পরীক্ষা: মোট {(((parseFloat(examObj?.written_max) || 0) + (parseFloat(examObj?.mcq_max) || 0) + (parseFloat(examObj?.practical_max) || 0)) || examObj?.total_marks) ?? '—'}, পাশ {examObj?.pass_marks ?? '—'}</Typography>
                  ); })()}
                  <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="body1" component="span">হিসাবকৃত গ্রেড:</Typography>
                  {(() => { const s = getGradeStyle(calculatedGrade); return (
                    <Chip label={calculatedGrade || 'N/A'} size="small" sx={{ bgcolor: s.bg, color: s.fg, fontWeight: 'bold' }} />
                  ); })()}
                </Stack>
                </Stack>
              </Card>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Typography variant="h6" gutterBottom>সব বিষয়ের জন্য নম্বর দিন</Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'secondary.main' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>বিষয়</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">লিখিত</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">এমসিকিউ</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">প্র্যাকটিক্যাল</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">মোট</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {subjects.map(subject => {
                      const m = multiSubjectMarks[subject.id] || { written: '', mcq: '', practical: '' };
                      const total = (parseFloat(m.written) || 0) + (parseFloat(m.mcq) || 0) + (parseFloat(m.practical) || 0);
                      return (
                        <TableRow key={subject.id}>
                          <TableCell>{subject.name}</TableCell>
                          <TableCell align="center">
                            <TextField type="number" size="small" value={m.written} onFocus={(e) => e.target.select()} onChange={(e) => setMultiSubjectMark(subject.id, 'written', e.target.value)} placeholder={String(getMaxForField(getExamById(selectedExam), 'written', subject.name) ?? '')} inputProps={{ min: 0, max: getMaxForField(getExamById(selectedExam), 'written', subject.name) ?? undefined }} />
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              type="number" size="small" value={m.mcq}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => setMultiSubjectMark(subject.id, 'mcq', e.target.value)}
                              placeholder={String(getMaxForField(getExamById(selectedExam), 'mcq', subject.name) ?? '')}
                              inputProps={{ min: 0, max: getMaxForField(getExamById(selectedExam), 'mcq', subject.name) ?? undefined }}
                              disabled={(() => {
                                const sname = String(subject.name || '').toLowerCase();
                                return sname.includes('english') || sname.includes('ইংরেজি') || sname.includes('ইংরেজী');
                              })()}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <TextField type="number" size="small" value={m.practical} onFocus={(e) => e.target.select()} onChange={(e) => setMultiSubjectMark(subject.id, 'practical', e.target.value)} placeholder={String(getMaxForField(getExamById(selectedExam), 'practical', subject.name) ?? '')} inputProps={{ min: 0, max: getMaxForField(getExamById(selectedExam), 'practical', subject.name) ?? undefined }} />
                          </TableCell>
                          <TableCell align="center"><strong>{total}</strong></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: 'grey.50', borderTop: '1px solid #e0e0e0', flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={handleCloseAddResultsDialog} variant="outlined">বাতিল</Button>
          <Button 
            onClick={handleSaveResult} 
            variant="contained" 
            color="primary"
            disabled={savingResult || !selectedClass || !selectedStudent || !selectedSubject || !selectedExam}
          >
            {savingResult ? <CircularProgress size={24} color="inherit" /> : 'সংরক্ষণ করুন'}
          </Button>
          <Button
            onClick={async () => {
              if (!selectedExam || !selectedClass || !selectedStudent) { toast.error('পরীক্ষা, শ্রেণি ও শিক্ষার্থী নির্বাচন করুন'); return; }
              const examId = parseInt(selectedExam);
              const examObjForRedirect = examinations.find(ex => ex.id === examId) || null;
              const clsIdRedirect = String(selectedClass);
              const stuIdRedirect = String(selectedStudent);
              const secIdRedirect = String(selectedSectionAdd || '');
              const examTypeRedirect = String(examObjForRedirect?.exam_type || 'annual');
              const urlRedirect = `/school/${id}/result-card?classroom=${encodeURIComponent(clsIdRedirect)}&student=${encodeURIComponent(stuIdRedirect)}&exam_type=${encodeURIComponent(examTypeRedirect)}${secIdRedirect ? `&section=${encodeURIComponent(secIdRedirect)}` : ''}&exam=${encodeURIComponent(String(examId))}&auto=1`;
              try {
                setSavingResult(true);
                const rows = subjects.map(s => {
                  const m = multiSubjectMarks[s.id] || { written: '', mcq: '', practical: '' };
                  return {
                    examination: examId,
                    student_id: parseInt(selectedStudent),
                    subject_id: s.id,
                    written_marks: parseFloat(m.written) || 0,
                    mcq_marks: parseFloat(m.mcq) || 0,
                    practical_marks: parseFloat(m.practical) || 0
                  };
                }).filter(r => (r.written_marks || 0) + (r.mcq_marks || 0) + (r.practical_marks || 0) > 0);
                if (rows.length === 0) { toast.info('কোনো বিষয়ের নম্বর প্রদান করা হয়নি'); setSavingResult(false); return; }
                const payload = { examination: examId, school_id: id, results: rows };
                await api.post(`/api/results/examinations/${examId}/bulk_results/?school=${id}`, payload);
                toast.success('সব বিষয়ের ফলাফল সংরক্ষণ হয়েছে');
                handleCloseAddResultsDialog();
                loadResults(examId);
                window.location.assign(urlRedirect);
              } catch (e) {
                console.error('Save all subjects error:', e?.response?.data || e);
                toast.error('সব বিষয়ের ফলাফল সংরক্ষণ ব্যর্থ');
              } finally {
                setSavingResult(false);
              }
            }}
            variant="contained"
            color="secondary"
            disabled={savingResult || !selectedClass || !selectedStudent || !subjects.length || !selectedExam}
          >
            {savingResult ? <CircularProgress size={24} /> : 'সব বিষয় সংরক্ষণ করুন'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Result Dialog */}
      <Dialog open={editDialogOpen} onClose={handleCloseEdit} maxWidth="sm" fullWidth scroll="paper">
        <DialogTitle sx={{ bgcolor: 'secondary.main', color: 'white', py: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">ফলাফল সম্পাদনা</Typography>
            <Button
              variant="contained"
              color="success"
              size="small"
              onClick={handleSaveEdit}
              disabled={savingEdit}
              sx={{ fontWeight: 'bold' }}
            >
              {savingEdit ? <CircularProgress size={16} color="inherit" /> : 'আপডেট'}
            </Button>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ overflowY: 'auto' }}>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                type="number"
                label="লিখিত"
                value={editMarks.written}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setEditMarks({ ...editMarks, written: e.target.value })}
                fullWidth
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                type="number"
                label="এমসিকিউ"
                value={editMarks.mcq}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setEditMarks({ ...editMarks, mcq: e.target.value })}
                fullWidth
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                type="number"
                label="প্র্যাকটিক্যাল"
                value={editMarks.practical}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setEditMarks({ ...editMarks, practical: e.target.value })}
                fullWidth
                inputProps={{ min: 0 }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEdit}>বাতিল</Button>
          <Button onClick={handleSaveEdit} variant="contained" disabled={savingEdit}>
            {savingEdit ? 'আপডেট হচ্ছে...' : 'আপডেট করুন'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, item: null })}
        onConfirm={handleConfirmDelete}
        title="ফলাফল মুছুন"
        message={`আপনি কি নিশ্চিত আপনি "${deleteDialog.item?.subject?.name || 'Subject'}" (${deleteDialog.item?.student?.user?.first_name || ''} ${deleteDialog.item?.student?.user?.last_name || ''}) ফলাফলটি মুছে ফেলতে চান?`}
      />

      <InputGuidance
        steps={guidanceSteps}
        activeStep={tourStep - 1}
        onStepComplete={(step) => setTourStep(step + 1)}
      />

      <Dialog
        open={bulkDialogOpen}
        onClose={closeBulkDialog}
        maxWidth="lg"
        fullWidth
        scroll="paper"
        PaperProps={{
          sx: {
            minHeight: '80vh',
            maxHeight: '95vh'
          }
        }}
      >
        <DialogTitle sx={{ bgcolor: 'secondary.main', color: 'white', py: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">মার্কস ইনপুট করুন (বাল্ক)</Typography>
            <Button
              variant="contained"
              color="success"
              onClick={saveBulkMarks}
              disabled={bulkSaving || !bulkForm.classroom || !bulkForm.subject || !bulkForm.exam}
              sx={{ fontWeight: 'bold' }}
            >
              {bulkSaving ? <CircularProgress size={20} color="inherit" /> : 'উপরে সেভ করুন'}
            </Button>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          <Grid container spacing={2} sx={{ mt: 0.5, mb: 2 }}>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl id="bulk-class-select" fullWidth size="small">
                <InputLabel>শ্রেণি</InputLabel>
                <Select
                  value={bulkForm.classroom}
                  onFocus={() => updateStep('#bulk-class-select')}
                  onChange={(e) => {
                    const v = e.target.value;
                    setBulkForm(prev => ({ ...prev, classroom: v, section: [], exam: '', subject: '' }));
                    setStudents([]);
                    loadSectionsByClass(v);
                    loadSubjectsByClass(v);
                    loadExaminationsByClass(v);
                    updateStep('#bulk-section-select');
                  }}
                  label="শ্রেণি"
                  disabled={loadingClasses}
                >
                  {classes.map(classroom => (
                    <MenuItem key={classroom.id} value={classroom.id}>{classroom.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <FormControl id="bulk-section-select" fullWidth size="small">
                <InputLabel>সেকশন</InputLabel>
                <Select
                  multiple
                  value={bulkForm.section || []}
                  onFocus={() => updateStep('#bulk-section-select')}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.includes("")) {
                      setBulkForm(prev => ({ ...prev, section: [], subject: '' }));
                      if (bulkForm.classroom) {
                        loadStudentsByClass(bulkForm.classroom, []);
                        loadSubjectsByClass(bulkForm.classroom, []);
                      }
                      return;
                    }
                    setBulkForm(prev => ({ ...prev, section: value, subject: '' }));
                    if (bulkForm.classroom) {
                      loadStudentsByClass(bulkForm.classroom, value);
                      loadSubjectsByClass(bulkForm.classroom, value);
                    }
                    updateStep('#bulk-subject-select');
                  }}
                  renderValue={(selected) => {
                    if (selected.length === 0) return 'সব সেকশন (All)';
                    return selected.map(id => sectionsForAdd.find(s => String(s.id) === String(id))?.name).filter(Boolean).join(', ');
                  }}
                  label="সেকশন"
                  disabled={!bulkForm.classroom}
                >
                  {sectionsForAdd.map(sec => (
                    <MenuItem key={sec.id} value={sec.id}>
                      <Checkbox checked={(bulkForm.section || []).indexOf(sec.id) > -1} />
                      <ListItemText primary={sec.name} />
                    </MenuItem>
                  ))}
                  <MenuItem value="">সব সেকশন (রিসেট)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl id="bulk-exam-select" fullWidth size="small">
                <InputLabel>পরীক্ষা</InputLabel>
                <Select
                  value={bulkForm.exam}
                  onChange={(e) => {
                    setBulkForm(prev => ({ ...prev, exam: e.target.value }));
                  }}
                  label="পরীক্ষা"
                  disabled={!bulkForm.classroom}
                >
                  {getExamsForClass(bulkForm.classroom)
                    .map(exam => (
                      <MenuItem key={exam.id} value={exam.id}>
                        {`${exam.name} — মোট: ${exam.total_marks}`}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField
                id="bulk-year-input"
                fullWidth
                label="সাল"
                type="number"
                size="small"
                value={bulkYear}
                onChange={(e) => setBulkYear(e.target.value)}
                disabled={!bulkForm.classroom}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <FormControl id="bulk-subject-select" fullWidth size="small">
                <InputLabel>বিষয়</InputLabel>
                <Select
                  value={bulkForm.subject}
                  onFocus={() => updateStep('#bulk-subject-select')}
                  onChange={(e) => {
                    setBulkForm(prev => ({ ...prev, subject: e.target.value }));
                    updateStep('#bulk-save-btn');
                  }}
                  label="বিষয়"
                  disabled={!bulkForm.classroom || loadingSubjects}
                >
                  {subjects.map(subject => (
                    <MenuItem key={subject.id} value={subject.id}>{subject.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <TableContainer component={Paper} sx={{ boxShadow: 2, border: '1px solid #e0e0e0' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 'bold', width: '60px' }}>রোল</TableCell>
                  <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 'bold' }}>নাম</TableCell>
                  <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 'bold', textAlign: 'center' }}>লিখিত</TableCell>
                  <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 'bold', textAlign: 'center' }}>এমসিকিউ</TableCell>
                  <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 'bold', textAlign: 'center' }}>প্র্যাকটিক্যাল</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bulkStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      শ্রেণি ও সেকশন সিলেক্ট করলে শিক্ষার্থীর তালিকা এখানে আসবে
                    </TableCell>
                  </TableRow>
                ) : (
                  bulkStudents.map(s => {
                    const name = `${s.user?.first_name || ''} ${s.user?.last_name || ''}`.trim() || s.user?.username;
                    const m = bulkMarks[s.id] || { written: '', mcq: '', practical: '' };
                    const examObj = getExamById(bulkForm.exam || selectedExam);
                    const subjName = (subjects.find(sub => sub.id === parseInt(bulkForm.subject)) || {}).name;
                    const isOptional = String(bulkForm.subject) === String(s.optional_subject?.id || s.optional_subject);

                    return (
                      <TableRow key={s.id} hover sx={{ bgcolor: isOptional ? 'rgba(76, 175, 80, 0.05)' : 'inherit' }}>
                        <TableCell>{s.roll_number || '-'}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: isOptional ? 'bold' : 'normal' }}>
                            {name} {isOptional && <Chip label="৪র্থ" size="small" color="success" sx={{ height: 18, fontSize: '0.6rem', ml: 0.5 }} />}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <TextField
                            type="number" size="small" value={m.written}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setBulkMark(s.id, 'written', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, s.id, 'written')}
                            placeholder={String(getMaxForField(examObj, 'written', subjName, bulkForm.classroom) ?? '')}
                            inputProps={{ 'data-student-id': s.id, 'data-field': 'written', style: { textAlign: 'center', width: '50px' } }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <TextField
                            type="number" size="small" value={m.mcq}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setBulkMark(s.id, 'mcq', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, s.id, 'mcq')}
                            placeholder={String(getMaxForField(examObj, 'mcq', subjName, bulkForm.classroom) ?? '')}
                            inputProps={{ 'data-student-id': s.id, 'data-field': 'mcq', style: { textAlign: 'center', width: '50px' } }}
                            disabled={String(subjName).includes('ইংরেজি') || String(subjName).includes('English')}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <TextField
                            type="number" size="small" value={m.practical}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setBulkMark(s.id, 'practical', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, s.id, 'practical')}
                            placeholder={String(getMaxForField(examObj, 'practical', subjName, bulkForm.classroom) ?? '')}
                            inputProps={{ 'data-student-id': s.id, 'data-field': 'practical', style: { textAlign: 'center', width: '50px' } }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: 'grey.50', borderTop: '1px solid #e0e0e0' }}>
          <Button onClick={closeBulkDialog} variant="outlined" color="inherit">বাতিল</Button>
          <Button
            id="bulk-save-btn"
            onClick={saveBulkMarks}
            variant="contained"
            color="secondary"
            size="large"
            disabled={bulkSaving || !bulkForm.classroom || !bulkForm.subject || !bulkForm.exam}
            sx={{ px: 5, fontWeight: 'bold' }}
          >
            {bulkSaving ? <CircularProgress size={24} color="inherit" /> : 'সবগুলো সংরক্ষণ করুন'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
