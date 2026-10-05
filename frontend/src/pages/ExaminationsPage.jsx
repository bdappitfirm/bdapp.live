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
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Assignment as ExamIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  School as SchoolIcon,
  CalendarToday as RoutineIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import api from '../utils/api';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import { isAuthenticated } from '../utils/auth';

const EXAM_TYPES = [
  { value: 'half_yearly', label: 'অর্ধবার্ষিক' },
  { value: 'annual', label: 'বার্ষিক' },
  { value: 'pre_test', label: 'প্রাক-নির্বাচনী' },
  { value: 'test', label: 'নির্বাচনী' },
  { value: 'terminal', label: 'টার্মিনাল' },
  { value: 'model', label: 'মডেল টেস্ট' },
  { value: 'special_test', label: 'বিশেষ মূল্যায়ন' },
  { value: 'Midterm-2', label: 'মিডটার্ম-২' }
];

export default function ExaminationsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [examinations, setExaminations] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, exam: null });
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [selectedExamForSlots, setSelectedExamForSlots] = useState(null);
  const [examSlots, setExamSlots] = useState([]);
  const [newSlotData, setNewSlotData] = useState({
    subject: '',
    exam_date: null,
    start_time: '10:00',
    room: ''
  });
  const [savingSlot, setSavingSlot] = useState(false);

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
    total_marks: 100,
    pass_marks: 33,
    classrooms: [],
    written_max: 0,
    mcq_max: 0,
    practical_max: 0
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [examsRes, classroomsRes, subjectsRes] = await Promise.all([
        api.get(`/api/results/examinations/?school=${id}&page_size=200`),
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

  const handleBulkDialogClose = useCallback(() => {
    setBulkDialogOpen(false);
    setBulkForm({
      subjects: [],
      exam_type: 'half_yearly',
      exam_date: null,
      total_marks: 100,
      pass_marks: 33,
      classrooms: [],
      written_max: 0,
      mcq_max: 0,
      practical_max: 0
    });
  }, []);

  const handleBulkSubmit = useCallback(async () => {
    if (!isAuthenticated()) { navigate('/login'); return; }
    if (bulkForm.subjects.length === 0 || bulkForm.classrooms.length === 0) {
      toast.error('Please select subjects and classrooms');
      return;
    }

    setBulkLoading(true);
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const dateStr = formatDate(bulkForm.exam_date);

    const promises = [];
    for (const classroomId of bulkForm.classrooms) {
      for (const subjectId of bulkForm.subjects) {
        const subObj = subjects.find(s => s.id === subjectId);
        const subName = subObj?.name || '';

        const examData = {
          name: subName,
          exam_type: bulkForm.exam_type,
          classroom: classroomId,
          exam_date: dateStr,
          total_marks: bulkForm.total_marks,
          pass_marks: bulkForm.pass_marks,
          written_max: bulkForm.written_max,
          mcq_max: bulkForm.mcq_max,
          practical_max: bulkForm.practical_max,
          school: parseInt(id)
        };
        promises.push(api.post('/api/results/examinations/', examData));
      }
    }

    const results = await Promise.allSettled(promises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failCount = results.filter(r => r.status === 'rejected').length;

    setBulkLoading(false);

    if (successCount > 0) {
      toast.success(`Successfully created ${successCount} examinations`);
      handleBulkDialogClose();
      loadData();
    }
    if (failCount > 0) {
      toast.error(`Failed to create ${failCount} examinations`);
    }
  }, [id, bulkForm, subjects, handleBulkDialogClose, loadData, navigate, toast]);

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

    const formatDate = (date) => {
        if (!date) return null;
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const examData = { ...formData, school: parseInt(id), exam_date: formatDate(formData.exam_date), section: formData.section ? Number(formData.section) : null };

    try {
      if (editingExam) await api.put(`/api/results/examinations/${editingExam.id}/`, examData);
      else await api.post('/api/results/examinations/', examData);
      toast.success('Saved successfully');
      handleDialogClose();
      loadData();
    } catch (error) {
      console.error('Exam save error:', error.response?.data);
      let errMsg = 'Failed to save';
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errMsg = error.response.data;
        } else {
          errMsg = Object.entries(error.response.data)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join(' | ');
        }
      }
      toast.error(errMsg);
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
    setNewSlotData({
      subject: '',
      exam_date: exam.exam_date ? new Date(exam.exam_date) : null,
      start_time: '10:00',
      room: ''
    });
    try {
      const res = await api.get(`/api/results/exam-slots/`, { params: { school: id, examination: exam.id } });
      setExamSlots(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (error) { toast.error('Failed to load routine'); }
  }, [id, toast]);

  const handleSaveSlot = async () => {
    if (!selectedExamForSlots) return;
    if (!newSlotData.subject || !newSlotData.exam_date) {
      toast.error('Subject and Date are required');
      return;
    }

    setSavingSlot(true);
    try {
      const formatDate = (date) => {
        if (!date) return null;
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };

      const payload = {
        examination: selectedExamForSlots.id,
        subject: newSlotData.subject,
        exam_date: formatDate(newSlotData.exam_date),
        start_time: newSlotData.start_time,
        room: newSlotData.room,
        classroom: selectedExamForSlots.classroom,
        section: selectedExamForSlots.section || null,
        school: parseInt(id)
      };

      await api.post('/api/results/exam-slots/', payload);
      toast.success('Slot added successfully');
      loadExamSlots(selectedExamForSlots);
    } catch (error) {
      toast.error('Failed to add slot');
    } finally {
      setSavingSlot(false);
    }
  };

  const handleDeleteSlot = async (slotId) => {
    try {
      await api.delete(`/api/results/exam-slots/${slotId}/`);
      toast.success('Slot deleted');
      loadExamSlots(selectedExamForSlots);
    } catch (error) {
      toast.error('Failed to delete slot');
    }
  };

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
                    <TableCell align="center"><Stack direction="row" spacing={1} justifyContent="center">
                      <Tooltip title="রুটিন সেট করুন">
                        <IconButton size="small" onClick={() => { loadExamSlots(exam); setSlotDialogOpen(true); }} color="secondary"><RoutineIcon /></IconButton>
                      </Tooltip>
                      <IconButton size="small" onClick={() => handleDialogOpen(exam)} color="primary"><EditIcon /></IconButton>
                      <IconButton size="small" onClick={() => setDeleteDialog({ open: true, exam })} color="error"><DeleteIcon /></IconButton>
                    </Stack></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Dialog open={bulkDialogOpen} onClose={handleBulkDialogClose} fullWidth maxWidth="md">
          <DialogTitle>বাল্ক পরীক্ষা সেট করুন (Bulk Exam Setup)</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  multiple
                  options={classrooms}
                  getOptionLabel={(option) => option.name || ''}
                  value={classrooms.filter(c => bulkForm.classrooms.includes(c.id))}
                  onChange={(e, val) => setBulkForm({ ...bulkForm, classrooms: val.map(v => v.id) })}
                  renderInput={(params) => <TextField {...params} label="শ্রেণি নির্বাচন করুন (Classrooms)" />}
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  multiple
                  options={subjects}
                  getOptionLabel={(option) => option.name || ''}
                  value={subjects.filter(s => bulkForm.subjects.includes(s.id))}
                  onChange={(e, val) => setBulkForm({ ...bulkForm, subjects: val.map(v => v.id) })}
                  renderInput={(params) => <TextField {...params} label="বিষয় নির্বাচন করুন (Subjects)" />}
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField select label="পরীক্ষার ধরন" value={bulkForm.exam_type} onChange={e => setBulkForm({ ...bulkForm, exam_type: e.target.value })} fullWidth>
                  {EXAM_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <DatePicker label="তারিখ" value={bulkForm.exam_date} onChange={d => setBulkForm({ ...bulkForm, exam_date: d })} slotProps={{ textField: { fullWidth: true } }} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField type="number" label="পাশ নম্বর" value={bulkForm.pass_marks} onChange={e => setBulkForm({ ...bulkForm, pass_marks: parseInt(e.target.value) || 0 })} fullWidth />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField type="number" label="লিখিত সর্বোচ্চ" value={bulkForm.written_max} onChange={e => setBulkForm({ ...bulkForm, written_max: parseInt(e.target.value) || 0 })} fullWidth />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField type="number" label="এমসিকিউ সর্বোচ্চ" value={bulkForm.mcq_max} onChange={e => setBulkForm({ ...bulkForm, mcq_max: parseInt(e.target.value) || 0 })} fullWidth />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField type="number" label="প্র্যাকটিক্যাল সর্বোচ্চ" value={bulkForm.practical_max} onChange={e => setBulkForm({ ...bulkForm, practical_max: parseInt(e.target.value) || 0 })} fullWidth />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleBulkDialogClose}>বাতিল</Button>
            <Button variant="contained" onClick={handleBulkSubmit} disabled={bulkLoading}>
              {bulkLoading ? 'তৈরি হচ্ছে...' : 'সবগুলো তৈরি করুন'}
            </Button>
          </DialogActions>
        </Dialog>

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

        <Dialog open={slotDialogOpen} onClose={() => setSlotDialogOpen(false)} fullWidth maxWidth="md">
          <DialogTitle>পরীক্ষার রুটিন সেট করুন: {selectedExamForSlots?.name}</DialogTitle>
          <DialogContent dividers>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>নতুন বিষয় যোগ করুন</Typography>
            <Grid container spacing={2} sx={{ mb: 4, mt: 0.5 }}>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  label="বিষয়"
                  fullWidth
                  size="small"
                  value={newSlotData.subject}
                  onChange={(e) => setNewSlotData({ ...newSlotData, subject: e.target.value })}
                >
                  {subjects.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} md={3}>
                <DatePicker
                  label="তারিখ"
                  value={newSlotData.exam_date}
                  onChange={(d) => setNewSlotData({ ...newSlotData, exam_date: d })}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  label="সময়"
                  type="time"
                  fullWidth
                  size="small"
                  value={newSlotData.start_time}
                  onChange={(e) => setNewSlotData({ ...newSlotData, start_time: e.target.value })}
                  slotProps={{ label: { shrink: true } }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  label="রুম"
                  fullWidth
                  size="small"
                  value={newSlotData.room}
                  onChange={(e) => setNewSlotData({ ...newSlotData, room: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={1}>
                <Button variant="contained" fullWidth onClick={handleSaveSlot} disabled={savingSlot} sx={{ height: '40px' }}>
                  {savingSlot ? '...' : <AddIcon />}
                </Button>
              </Grid>
            </Grid>

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>বিদ্যমান রুটিন</Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>তারিখ</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>বিষয়</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>সময়</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>রুম</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>অ্যাকশন</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {examSlots.length === 0 ? (
                    <TableRow><TableCell colSpan={5} align="center">কোনো বিষয় যোগ করা হয়নি</TableCell></TableRow>
                  ) : (
                    examSlots.map((slot) => (
                      <TableRow key={slot.id}>
                        <TableCell>{slot.exam_date}</TableCell>
                        <TableCell>{slot.subject_name || slot.subject?.name}</TableCell>
                        <TableCell>{slot.start_time}</TableCell>
                        <TableCell>{slot.room || '-'}</TableCell>
                        <TableCell align="center">
                          <IconButton size="small" color="error" onClick={() => handleDeleteSlot(slot.id)}><DeleteIcon fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSlotDialogOpen(false)}>বন্ধ করুন</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}
