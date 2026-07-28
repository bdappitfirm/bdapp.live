import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Button,
  Stack,
  TextField,
  Autocomplete,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  IconButton
} from '@mui/material';
import {
  Assignment as ExamIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  School as SchoolIcon,
  FilterList as FilterIcon,
  Autorenew as RecalcIcon,
  Schedule as ScheduleIcon,
  Event as EventIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import api from '../utils/api';
import EmptyState from '../components/EmptyState';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import ProtectedButton from '../components/ProtectedButton';
import { isAuthenticated } from '../utils/auth';
import { useAuth } from '../context/AuthContext';

const EXAM_TYPES = [
  { value: 'half_yearly', label: 'অর্ধবার্ষিক' },
  { value: 'annual', label: 'বার্ষিক' },
  { value: 'test', label: 'বিশেষ মূল্যায়ন' },
  { value: 'terminal', label: 'টার্মিনাল' },
  { value: 'model', label: 'মডেল টেস্ট' }
];

export default function ExaminationsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = ((user && (user.role || user.profile?.effective_role || user.profile?.role)) || '').toLowerCase();
  const [examinations, setExaminations] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, exam: null });
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [selectedExamForSlots, setSelectedExamForSlots] = useState(null);
  const [examSlots, setExamSlots] = useState([]);
  const [slotFormData, setSlotFormData] = useState({
    subject: null,
    classroom: null,
    section: null,
    exam_date: null,
    start_time: '',
    end_time: '',
    room: ''
  });
  const toast = useToast();

  const [formData, setFormData] = useState({
    name: '',
    exam_type: 'test',
    classroom: '',
    section: '',
    exam_date: null,
    total_marks: 100,
    pass_marks: 33,
    written_max: 0,
    mcq_max: 0,
    practical_max: 0
  });

  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    subjects: [],
    exam_type: 'half_yearly',
    exam_date: null,
    start_time: '',
    end_time: '',
    total_marks: 100,
    pass_marks: 33,
    classrooms: [],
    sections: [],
    written_max: 0,
    mcq_max: 0,
    practical_max: 0
  });
  const [bulkSections, setBulkSections] = useState([]);
  const [bulkSubjects, setBulkSubjects] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [examsRes, classroomsRes, subjectsRes] = await Promise.all([
        api.get(`/api/results/examinations/?school=${id}`),
        api.get(`/api/academics/classrooms/?school=${id}`),
        api.get(`/api/academics/subjects/?school=${id}`)
      ]);
      setExaminations(Array.isArray(examsRes.data) ? examsRes.data : (examsRes.data.results || []));
      const subjectsData = Array.isArray(subjectsRes.data) ? subjectsRes.data : (subjectsRes.data?.results || []);
      setSubjects(subjectsData);
      setClassrooms(Array.isArray(classroomsRes.data) ? classroomsRes.data : (classroomsRes.data.results || []));
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    if (id) loadData();
  }, [id, loadData]);

  const handleDialogOpen = useCallback((exam = null) => {
    if (!isAuthenticated()) { navigate('/login'); return; }
    if (exam) {
      setEditingExam(exam);
      setFormData({
        name: exam.name,
        exam_type: exam.exam_type,
        classroom: exam.classroom,
        section: exam.section || '',
        exam_date: exam.exam_date ? new Date(exam.exam_date) : null,
        total_marks: exam.total_marks,
        pass_marks: exam.pass_marks,
        written_max: exam.written_max || 0,
        mcq_max: exam.mcq_max || 0,
        practical_max: exam.practical_max || 0
      });
    } else {
      setEditingExam(null);
      setFormData({ name: '', exam_type: 'test', classroom: '', section: '', exam_date: null, total_marks: 100, pass_marks: 33, written_max: 0, mcq_max: 0, practical_max: 0 });
    }
    setDialogOpen(true);
  }, [navigate]);

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false);
    setEditingExam(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!isAuthenticated()) { navigate('/login'); return; }
    if (!formData.name || !formData.classroom) { toast.error('Name and Classroom are required'); return; }

    const formatDate = (date) => date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : null;
    const examData = { ...formData, school: parseInt(id), exam_date: formatDate(formData.exam_date), section: formData.section ? Number(formData.section) : null };

    try {
      if (editingExam) await api.put(`/api/results/examinations/${editingExam.id}/`, examData);
      else await api.post('/api/results/examinations/', examData);
      toast.success('Saved successfully');
      handleDialogClose();
      loadData();
    } catch (error) {
      toast.error('Failed to save');
    }
  }, [id, formData, editingExam, handleDialogClose, loadData, navigate, toast]);

  const handleDelete = useCallback(async () => {
    if (!isAuthenticated()) { navigate('/login'); return; }
    if (!deleteDialog.exam) return;
    try {
      await api.delete(`/api/results/examinations/${deleteDialog.exam.id}/`);
      toast.success('Deleted successfully');
      setDeleteDialog({ open: false, exam: null });
      loadData();
    } catch (error) { toast.error('Failed to delete'); }
  }, [deleteDialog.exam, loadData, navigate, toast]);

  const loadExamSlots = useCallback(async (exam) => {
    setSelectedExamForSlots(exam);
    try {
      const res = await api.get(`/api/results/exam-slots/`, { params: { school: id, classroom: exam.classroom, exam_type: exam.exam_type } });
      setExamSlots(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (error) { toast.error('Failed to load routine'); }
  }, [id, toast]);

  const handleSlotSubmit = useCallback(async () => {
    if (!isAuthenticated()) { navigate('/login'); return; }
    if (!slotFormData.subject) { toast.error('Subject is required'); return; }
    const formatDate = (date) => date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : null;
    const slotData = { school: id, examination: selectedExamForSlots?.id, subject: slotFormData.subject.id, exam_date: formatDate(slotFormData.exam_date), start_time: slotFormData.start_time, end_time: slotFormData.end_time, room: slotFormData.room };
    try {
      if (editingSlot) await api.put(`/api/results/exam-slots/${editingSlot.id}/`, slotData);
      else await api.post('/api/results/exam-slots/', slotData);
      toast.success('Slot saved');
      setSlotDialogOpen(false);
      loadExamSlots(selectedExamForSlots);
    } catch (error) { toast.error('Failed to save slot'); }
  }, [id, slotFormData, editingSlot, selectedExamForSlots, loadExamSlots, navigate, toast]);

  const getExamTypeLabel = (type) => EXAM_TYPES.find(t => t.value === type)?.label || type;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
          <Typography variant="h4"><ExamIcon sx={{ mr: 1, verticalAlign: 'middle' }} />পরীক্ষাসমূহ</Typography>
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" onClick={() => { if (!isAuthenticated()) navigate('/login'); setBulkDialogOpen(true); }}>বাল্ক সেট</Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleDialogOpen()}>যোগ করুন</Button>
          </Stack>
        </Stack>

        {!selectedClassroom && (
          <Grid container spacing={2} mb={4}>
            {classrooms.map(c => (
              <Grid item xs={12} sm={6} md={3} key={c.id}>
                <Paper sx={{ p: 3, cursor: 'pointer', textAlign: 'center', '&:hover': { borderColor: 'primary.main', border: '1px solid' } }} onClick={() => setSelectedClassroom(c)}>
                  <SchoolIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                  <Typography variant="h6">{c.name}</Typography>
                  <Chip label={`${examinations.filter(ex => ex.classroom === c.id).length} পরীক্ষা`} size="small" />
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}

        {loading ? <TableSkeleton rows={5} columns={6} /> : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead><TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white' }}>নাম</TableCell>
                <TableCell sx={{ color: 'white' }}>ধরন</TableCell>
                <TableCell sx={{ color: 'white' }}>তারিখ</TableCell>
                <TableCell sx={{ color: 'white' }} align="center">অ্যাকশন</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {(selectedClassroom ? examinations.filter(ex => ex.classroom === selectedClassroom.id) : examinations).map(exam => (
                  <TableRow key={exam.id} hover>
                    <TableCell>{exam.name}</TableCell>
                    <TableCell><Chip label={getExamTypeLabel(exam.exam_type)} size="small" /></TableCell>
                    <TableCell>{exam.exam_date || '-'}</TableCell>
                    <TableCell align="center"><Stack direction="row" spacing={1}>
                      <Button size="small" onClick={() => loadExamSlots(exam)}>রুটিন</Button>
                      <IconButton size="small" onClick={() => handleDialogOpen(exam)} color="primary"><EditIcon /></IconButton>
                      <IconButton size="small" onClick={() => setDeleteDialog({ open: true, exam })} color="error"><DeleteIcon /></IconButton>
                    </Stack></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Dialog open={dialogOpen} onClose={handleDialogClose} fullWidth maxWidth="sm">
          <DialogTitle>{editingExam ? 'সম্পাদনা' : 'নতুন পরীক্ষা'}</DialogTitle>
          <DialogContent dividers><Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="নাম" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} fullWidth />
            <TextField select label="ধরন" value={formData.exam_type} onChange={e => setFormData({ ...formData, exam_type: e.target.value })} fullWidth>
              {EXAM_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
            <DatePicker label="তারিখ" value={formData.exam_date} onChange={d => setFormData({ ...formData, exam_date: d })} slotProps={{ textField: { fullWidth: true } }} />
            <TextField select label="শ্রেণি" value={formData.classroom} onChange={e => setFormData({ ...formData, classroom: e.target.value })} fullWidth>
              {classrooms.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
          </Stack></DialogContent>
          <DialogActions><Button onClick={handleDialogClose}>বাতিল</Button><Button variant="contained" onClick={handleSubmit}>সেভ</Button></DialogActions>
        </Dialog>

        <ConfirmDialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, exam: null })} onConfirm={handleDelete} title="মুছে ফেলুন" message="আপনি কি নিশ্চিত?" />
      </Box>
    </LocalizationProvider>
  );
}
