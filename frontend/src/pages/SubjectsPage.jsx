import React, { useEffect, useState, useCallback, useMemo } from 'react';
import DeleteIcon from "@mui/icons-material/Delete";
import { useParams, useNavigate } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import api from '../utils/api';
import {
  Box,
  Typography,
  Grid,
  Button,
  Stack,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Paper,
  InputAdornment,
  Alert,
  Fade,
  Zoom,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Autocomplete,
  Checkbox
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import {
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon
} from '@mui/icons-material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import BookIcon from '@mui/icons-material/Book';
import ClassIcon from '@mui/icons-material/Class';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EmptyState from '../components/EmptyState';
import SubjectCard from '../components/SubjectCard';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/Toast';

const banglaNumberMap = {
  'প্লে': -3,
  'Play': -3,
  'play': -3,
  'নার্সারি': -2,
  'Nursery': -2,
  'nursery': -2,
  'কেজি': -1,
  'KG': -1,
  'kg': -1,
  'কে.জি': -1,
  'কে.জি.': -1,
  '১ম': 1,
  '২য়': 2,
  '৩য়': 3,
  '৪র্থ': 4,
  '৫ম': 5,
  '৬ষ্ঠ': 6,
  '৭ম': 7,
  '৮ম': 8,
  '৯ম': 9,
  '১০ম': 10,
  'প্রথম': 1,
  'দ্বিতীয়': 2,
  'দ্বিতীয়': 2,
  'তৃতীয়': 3,
  'তৃতীয়': 3,
  'চতুর্থ': 4,
  'পঞ্চম': 5,
  'ষষ্ঠ': 6,
  'সপ্তম': 7,
  'অষ্টম': 8,
  'নবম': 9,
  'দশম': 10,
  'একাদশ': 11,
  'দ্বাদশ': 12
};

const subjectOrderMap = {
  'বাংলা-১ম': 1, 'বাংলা ১ম': 1, 'Bangla 1st': 1,
  'বাংলা-২য়': 2, 'বাংলা ২য়': 2, 'বাংলা-দ্বিতীয়': 2, 'Bangla 2nd': 2,
  'ইংরেজী-১ম': 3, 'ইংরেজি-১ম': 3, 'ইংরেজী ১ম': 3, 'ইংরেজি ১ম': 3, 'English 1st': 3, 'English-1st': 3,
  'ইংরেজি-২য়': 4, 'ইংরেজী-২য়': 4, 'ইংরেজি ২য়': 4, 'ইংরেজী ২য়': 4, 'English 2nd': 4, 'English-2nd': 4,
  'গণিত': 5, 'Math': 5, 'Mathematics': 5,
  'বিজ্ঞান': 6, 'Science': 6,
  'বাংলাদেশ ও বিশ্বপরিচয়': 7, 'বাংলাদেশ ও বিশ্ব পরিচয়': 7, 'BGS': 7,
  'ICT': 8, 'আইসিটি': 8, 'তথ্য ও যোগাযোগ প্রযুক্তি': 8,
  'ধর্ম': 9, 'Religion': 9, 'Islam': 9, 'Hindu': 9
};

const getSubjectOrder = (name) => {
  if (subjectOrderMap[name]) return subjectOrderMap[name];
  for (const [key, order] of Object.entries(subjectOrderMap)) {
    if (name.includes(key)) return order;
  }
  return 999;
};

const getClassOrder = (className) => {
  const lowerName = String(className || '').toLowerCase();
  if (lowerName.includes('play') || lowerName.includes('প্লে')) return -3;
  if (lowerName.includes('nursery') || lowerName.includes('নার্সারি') || lowerName.includes('শিশু')) return -2;
  if (lowerName.includes('kg') || lowerName.includes('কেজি') || lowerName.includes('কে.জি')) return -1;
  for (const [bangla, num] of Object.entries(banglaNumberMap)) {
    if (String(className || '').includes(bangla)) return num;
  }
  const match = String(className || '').match(/\d+/);
  if (match) return parseInt(match[0]);
  return 999;
};

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;

export default function SubjectsPage() {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  
  const [subjects, setSubjects] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [classSummary, setClassSummary] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [sections, setSections] = useState([]);
  const [classSections, setClassSections] = useState([]);
  const [classSubjects, setClassSubjects] = useState([]);
  const [classSubjectsLoading, setClassSubjectsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    classrooms: [],
    sections: []
  });
  const [formErrors, setFormErrors] = useState({});

  const loadSubjects = useCallback(async (quiet = true) => {
    setLoading(true);
    try {
      const subjectRes = await api.get(`/api/academics/subjects/?school=${id}`);
      const subjectsData = Array.isArray(subjectRes.data) ? subjectRes.data : subjectRes.data.results || [];
      setSubjects(subjectsData);

      const classRes = await api.get(`/api/academics/classrooms/?school=${id}`);
      let classesData = Array.isArray(classRes.data) ? classRes.data : classRes.data.results || [];
      
      classesData = classesData.sort((a, b) => {
        return getClassOrder(a.name) - getClassOrder(b.name);
      });
      
      setClassrooms(classesData);

      const summary = classesData.map(classroom => {
        const classSubjs = subjectsData.filter(s => {
          const cls = Array.isArray(s.classrooms) ? s.classrooms : [];
          return cls.includes(classroom.id);
        });
        return {
          id: classroom.id,
          name: classroom.name,
          subjectCount: classSubjs.length,
          subjects: classSubjs
        };
      });
      setClassSummary(summary);

      if (!quiet && subjectsData.length > 0) {
        toast.success(`Loaded ${subjectsData.length} subjects`);
      }
    } catch (err) {
      console.error(err);
      if (!quiet) toast.error('Failed to load subjects');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  const loadTeachers = useCallback(async () => {
    try {
      const res = await api.get(`/api/users/teachers/?school=${id}`);
      const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setTeachers(data);
    } catch (err) {
      console.error('Failed to load teachers:', err);
    }
  }, [id]);

  const loadSections = useCallback(async () => {
    try {
      const res = await api.get(`/api/academics/sections/?school=${id}`);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setSections(data);
    } catch (err) {
      console.error('Failed to load sections:', err);
    }
  }, [id]);

  const loadClassSections = useCallback(async (classroomId) => {
    try {
      const res = await api.get(`/api/academics/sections/?classroom=${classroomId}&school=${id}`);
      const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setClassSections(data);
    } catch (err) {
      console.error('Failed to load sections:', err);
      setClassSections([]);
    }
  }, []);

  const loadClassSubjects = useCallback(async (classroomId, sectionId = null) => {
    if (!classroomId) return;
    try {
      setClassSubjectsLoading(true);
      let url = `/api/academics/classrooms/${classroomId}/subjects/?school=${id}`;
      if (sectionId) {
        url += `&section=${sectionId}`;
      }
      const res = await api.get(url);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setClassSubjects(data || []);
    } catch (err) {
      console.error('Failed to load class subjects:', err);
      setClassSubjects([]);
    } finally {
      setClassSubjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubjects(true);
    loadTeachers();
    loadSections();
  }, [loadSubjects, loadTeachers, loadSections]);

  const handleClassSelect = (classroom) => {
    setSelectedClass(classroom);
    setSelectedSection(null);
    if (classroom && classroom.id) {
      loadClassSubjects(classroom.id);
      loadClassSections(classroom.id);
    }
  };

  const handleBackToClasses = () => {
    setSelectedClass(null);
    setSelectedSection(null);
  };

  const handleSectionSelect = (section) => {
    setSelectedSection(section);
    if (selectedClass) {
      loadClassSubjects(selectedClass.id, section?.id);
    }
  };

  const handleAdd = () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    setFormData({
      name: '',
      code: '',
      classrooms: selectedClass ? [selectedClass] : [],
      sections: []
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  // Get sections for selected classrooms
  const availableSections = useMemo(() => {
    const selectedClassroomIds = new Set(formData.classrooms.map(c => c.id));
    return sections.filter(s => selectedClassroomIds.has(s.classroom?.id || s.classroom_id));
  }, [formData.classrooms, sections]);

  const handleDelete = (subject) => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    setSelectedSubject(subject);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code) {
      toast.warning('Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        code: formData.code,
        school_id: parseInt(id),
        classrooms: formData.classrooms.map(c => c.id),
        sections: formData.sections.map(s => s.id)
      };
      
      await api.post(`/api/academics/subjects/?school=${id}`, payload);
      toast.success('Subject added successfully!');
      setDialogOpen(false);
      loadSubjects();
    } catch (err) {
      console.error(err);
      const n = err.normalized || { message: 'Failed to save subject', fieldErrors: {}, suggestions: [] };
      setFormErrors(n.fieldErrors || {});
      toast.error(n.message);
      if (n.suggestions?.length) toast.info('Suggestions: ' + n.suggestions.join(', '));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/api/academics/subjects/${selectedSubject.id}/`);
      toast.success('Subject deleted successfully!');
      setDeleteDialogOpen(false);
      loadSubjects();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete subject. It may be in use.');
    } finally {
      setSaving(false);
    }
  };

  const baseList = (selectedClass && classSubjects.length > 0) ? classSubjects : subjects;
  const isClassScoped = !!(selectedClass && classSubjects.length > 0);
  const filtered = useMemo(() => {
    return baseList
      .filter(s => {
        if (selectedClass) {
          if (!isClassScoped) {
            const cls = Array.isArray(s.classrooms) ? s.classrooms : [];
            if (!cls.includes(selectedClass.id) && !s.teachers) return false;
          }
        }
        const searchLower = searchQuery.toLowerCase();
        return s.name.toLowerCase().includes(searchLower) ||
               s.code.toLowerCase().includes(searchLower);
      })
      .filter(s => {
        if (selectedClass && !isClassScoped) {
          const cls = Array.isArray(s.classrooms) ? s.classrooms : [];
          return cls.includes(selectedClass.id);
        }
        return true;
      })
      .sort((a, b) => {
        const orderA = getSubjectOrder(a.name);
        const orderB = getSubjectOrder(b.name);
        if (orderA !== orderB) return orderA - orderB;
        return a.id - b.id;
      });
  }, [baseList, isClassScoped, searchQuery, selectedClass]);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: '100%', overflow: 'hidden' }}>
      <Fade in timeout={500}>
        <Paper 
          elevation={0}
          sx={{ 
            mb: 3, 
            p: 3, 
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: 'white',
            borderRadius: 3
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center' }}>
                {selectedClass ? (
                  <>
                    <ClassIcon sx={{ mr: 1, fontSize: 40 }} />
                    {selectedClass.name} বিষয়
                  </>
                ) : (
                  <>
                    <BookIcon sx={{ mr: 1, fontSize: 40 }} />
                    বিষয় ব্যবস্থাপনা
                  </>
                )}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {selectedClass 
                  ? `${selectedClass.name} শ্রেণির বিষয়সমূহ পরিচালনা করুন`
                  : 'বিষয় যোগ, সম্পাদনা এবং শিক্ষকদের সংযুক্ত করুন'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {selectedClass && (
                <Button 
                  variant="outlined" 
                  startIcon={<ArrowBackIcon />} 
                  onClick={handleBackToClasses}
                  sx={{ borderColor: 'rgba(255,255,255,0.5)', color: 'white' }}
                >
                  শ্রেণি তালিকা
                </Button>
              )}
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd} sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>বিষয় যোগ করুন</Button>
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => loadSubjects(false)} sx={{ borderColor: 'rgba(255,255,255,0.5)', color: 'white' }}>রিফ্রেশ</Button>
            </Stack>
          </Stack>
        </Paper>
      </Fade>

      {selectedClass && (
        <Zoom in timeout={600}>
          <Paper elevation={2} sx={{ p: 2, mb: 3, borderRadius: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  placeholder="নাম বা কোড দিয়ে বিষয় খুঁজুন..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip label="সব শাখা" onClick={() => handleSectionSelect(null)} color={selectedSection === null ? "primary" : "default"} />
                  {classSections.map((sec) => (
                    <Chip key={sec.id} label={sec.name} onClick={() => handleSectionSelect(sec)} color={selectedSection?.id === sec.id ? "primary" : "default"} />
                  ))}
                </Stack>
              </Grid>
            </Grid>
          </Paper>
        </Zoom>
      )}

      {loading ? (
        <Grid container spacing={2}>{[1,2,3,4].map(i => (<Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={i}><CardSkeleton /></Grid>))}</Grid>
      ) : !selectedClass ? (
        <Grid container spacing={2}>
          {classSummary.map((classroom) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={classroom.id}>
              <Card sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 } }}>
                <CardActionArea onClick={() => handleClassSelect(classroom)} sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h5" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}><ClassIcon sx={{ mr: 1, color: 'primary.main' }} />{classroom.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{classroom.subjectCount} Subjects assigned</Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Grid container spacing={2}>
          {filtered.map((subject) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={subject.id}>
              <SubjectCard
                subject={subject}
                teachers={teachers}
                onUpdate={() => {
                  loadSubjects();
                  if (selectedClass?.id) loadClassSubjects(selectedClass.id, selectedSection?.id);
                }}
                onDelete={() => handleDelete(subject)}
                schoolId={id}
                classroomId={selectedClass?.id}
                sectionId={selectedSection?.id}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Subject</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField label="Subject Name *" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} fullWidth error={!!formErrors.name} helperText={formErrors.name} />
            <TextField label="Subject Code *" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})} fullWidth error={!!formErrors.code} helperText={formErrors.code} />
            <Autocomplete multiple options={classrooms} disableCloseOnSelect getOptionLabel={(o) => o.name} value={formData.classrooms} onChange={(e, v) => setFormData({ ...formData, classrooms: v, sections: [] })} renderOption={(props, option, { selected }) => (<li {...props}><Checkbox icon={icon} checkedIcon={checkedIcon} style={{ marginRight: 8 }} checked={selected} />{option.name}</li>)} renderInput={(p) => (<TextField {...p} label="Assign to Classes (for all sections)" />)} />
            {availableSections.length > 0 && (
              <Autocomplete multiple options={availableSections} disableCloseOnSelect getOptionLabel={(o) => o.name} value={formData.sections} onChange={(e, v) => setFormData({ ...formData, sections: v })} renderOption={(props, option, { selected }) => (<li {...props}><Checkbox icon={icon} checkedIcon={checkedIcon} style={{ marginRight: 8 }} checked={selected} />{option.name}</li>)} renderInput={(p) => (<TextField {...p} label="Assign to Specific Sections (optional)" />)} />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Add Subject'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Subject?</DialogTitle>
        <DialogContent><Typography>Are you sure you want to delete <strong>{selectedSubject?.name}</strong>?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDelete} disabled={saving}>{saving ? 'Deleting...' : 'Delete'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
