import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import api from '../utils/api';
import { Box, Paper, Typography, TextField, Stack, Button, Alert, Chip, MenuItem, IconButton, Divider, Autocomplete } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PhotoUpload from '../components/PhotoUpload';
import { normalizeApiError } from '../utils/errorUtils';
import { transliterateBangla } from '../utils/helpers';

export default function AddTeacherPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: '',
    password: '',
    first_name: '',
    first_name_en: '',
    last_name: '',
    last_name_en: '',
    email: '',
    phone_number: '',
    educational_qualification: '',
    designation: '',
    designation_en: '',
    blood_group: '',
    index_number: '',
    joining_date: '',
    assigned_subject: '',
    class_teacher_classroom: '',
    class_teacher_section: ''
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  
  // New assignment structure: Array of { subjectId, classAssignments: [{ classroomId, sectionId }] }
  const [assignments, setAssignments] = useState([
    { subjectId: '', classAssignments: [{ classroomId: '', sectionId: '' }] }
  ]);

  const [subjects, setSubjects] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [sections, setSections] = useState([]);

  const [usernameCheck, setUsernameCheck] = useState({ loading: false, available: null, suggestions: [], msg: '' });
  const username = form.username.trim();

  const loadData = useCallback(async () => {
    try {
      const [subj, classes, secs] = await Promise.all([
        api.get(`/api/academics/subjects/?school=${id}`),
        api.get(`/api/academics/classrooms/?school=${id}`),
        api.get(`/api/academics/sections/?school=${id}`)
      ]);
      const subjectsData = Array.isArray(subj.data) ? subj.data : (subj.data?.results || []);
      const classroomsData = Array.isArray(classes.data) ? classes.data : (classes.data?.results || []);
      const sectionsData = Array.isArray(secs.data) ? secs.data : (secs.data?.results || []);

      setSubjects(subjectsData || []);
      setClassrooms(classroomsData || []);
      setSections(sectionsData || []);
    } catch (e) {
      console.error("Error loading dropdown data:", e);
      setError("Failed to load subjects, classes, or sections. Please refresh the page.");
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!username) {
      setUsernameCheck({ loading: false, available: null, suggestions: [], msg: '' });
      return;
    }
    let cancelled = false;
    setUsernameCheck(prev => ({ ...prev, loading: true, msg: '' }));
    const h = setTimeout(async () => {
      try {
        const res = await api.get(`/api/users/username-availability/`, { params: { q: username } });
        if (cancelled) return;

        setUsernameCheck({ loading: false, available: res.data.available, suggestions: [], msg: '' });
      } catch (e) {
        if (cancelled) return;
        setUsernameCheck({ loading: false, available: null, suggestions: [], msg: e?.response?.data?.error || 'Check failed' });
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(h); };
  }, [username]);

  const addAssignmentRow = () => {
    setAssignments([...assignments, { subjectId: '', classAssignments: [{ classroomId: '', sectionId: '' }] }]);
  };

  const removeAssignmentRow = (index) => {
    setAssignments(assignments.filter((_, i) => i !== index));
  };

  const addClassToAssignment = (assignIndex) => {
    const newAssignments = [...assignments];
    newAssignments[assignIndex].classAssignments.push({ classroomId: '', sectionId: '' });
    setAssignments(newAssignments);
  };

  const removeClassFromAssignment = (assignIndex, classIndex) => {
    const newAssignments = [...assignments];
    newAssignments[assignIndex].classAssignments = newAssignments[assignIndex].classAssignments.filter((_, i) => i !== classIndex);
    setAssignments(newAssignments);
  };

  const updateAssignment = (assignIndex, field, value) => {
    const newAssignments = [...assignments];
    newAssignments[assignIndex][field] = value;
    setAssignments(newAssignments);
  };

  const updateClassAssignment = (assignIndex, classIndex, field, value) => {
    const newAssignments = [...assignments];
    newAssignments[assignIndex].classAssignments[classIndex][field] = value;
    setAssignments(newAssignments);
  };

  const handleSubmit = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    setError('');
    if (!form.username && !form.first_name) {
      setError('Provide either a username or a first name.');
      return;
    }
    if (form.username && usernameCheck.available === false) {
      setError('This username is already taken. Please choose another.');
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      let uname = form.username;
      if (typeof uname === 'string' && uname) {
        uname = uname.normalize('NFKC').trim();
      }
      // Backend expects school_id for teacher role creation
      fd.append('school_id', id);
      if (uname) fd.append('username', uname);
      fd.append('password', form.password || '12345678');
      fd.append('first_name', form.first_name || '');
      fd.append('first_name_en', form.first_name_en || '');
      fd.append('last_name', form.last_name || '');
      fd.append('last_name_en', form.last_name_en || '');
      fd.append('email', form.email || '');
      fd.append('phone_number', form.phone_number || '');
      fd.append('educational_qualification', form.educational_qualification || '');
      fd.append('designation', form.designation || '');
      fd.append('designation_en', form.designation_en || '');
      fd.append('blood_group', form.blood_group || '');
      fd.append('index_number', form.index_number || '');
      fd.append('joining_date', form.joining_date || '');
      fd.append('assigned_subject', form.assigned_subject || '');
      
      // Class teacher info
      if (form.class_teacher_classroom) fd.append('class_teacher_classroom', form.class_teacher_classroom);
      if (form.class_teacher_section) fd.append('class_teacher_section', form.class_teacher_section);
      
      if (photoFile) fd.append('photo', photoFile);

      const resp = await api.post('/api/users/teachers/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const teacherId = resp.data?.id || resp.data?.teacher?.id || resp.data?.user?.id;
      
      // Create assignments
      for (const assign of assignments) {
        if (!assign.subjectId) continue;
        for (const classAssign of assign.classAssignments) {
          if (!classAssign.classroomId) continue;
          try {
            await api.post('/api/academics/assignments/', {
              teacher_id: teacherId,
              subject_id: assign.subjectId,
              classroom_id: classAssign.classroomId,
              section_id: classAssign.sectionId || null,
            });
          } catch (e) {
            console.warn('Assignment create failed:', e?.response?.data || e?.message);
          }
        }
      }
      navigate(`/school/${id}/teacher`);
    } catch (e) {
      const n = normalizeApiError(e);
      setError(n.message || 'Failed to add teacher');
      setFormErrors(n.fieldErrors || {});
      if (n.suggestions?.length) {
        setUsernameCheck(prev => ({ ...prev, available: false, suggestions: n.suggestions }));
      }
    } finally {
      setSaving(false);
    }
  };

  const applySuggestion = (sug) => setForm(prev => ({ ...prev, username: sug }));

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Add Teacher
        </Typography>
        <Typography variant="body2" color="text.secondary">
          School ID: {id}
        </Typography>
      </Paper>

      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}

          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Profile Photo (Optional)</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <PhotoUpload 
              currentPhoto={null} 
              onPhotoChange={(file) => {
                setPhotoFile(file);
                if (file) {
                  const previewUrl = URL.createObjectURL(file);
                  return () => URL.revokeObjectURL(previewUrl);
                }
              }} 
              userName={form.first_name || form.username || 'User'} 
            />
          </Box>

          <TextField
            label="Username"
            value={form.username}
            onChange={e => setForm({ ...form, username: e.target.value })}
            helperText={formErrors.username || (usernameCheck.loading ? 'Checking availability…' : usernameCheck.available === false ? 'Username not available' : 'Optional — auto-generated if left blank')}
            error={!!formErrors.username || usernameCheck.available === false}
          />

          {/* Removed username suggestions chip stack */}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} helperText={formErrors.password || 'Optional — generated if blank'} error={!!formErrors.password} fullWidth />
            <TextField label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} fullWidth error={!!formErrors.email} helperText={formErrors.email || ''} />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="First Name"
              value={form.first_name}
              onChange={e => {
                const val = e.target.value;
                setForm({ ...form, first_name: val, first_name_en: transliterateBangla(val) });
              }}
              helperText={formErrors.first_name || 'Provide either a username or first name'}
              error={!!formErrors.first_name}
              fullWidth
            />
            <TextField label="First Name (English)" value={form.first_name_en} onChange={e => setForm({ ...form, first_name_en: e.target.value })} fullWidth />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Last Name"
              value={form.last_name}
              onChange={e => {
                const val = e.target.value;
                setForm({ ...form, last_name: val, last_name_en: transliterateBangla(val) });
              }}
              fullWidth
              error={!!formErrors.last_name}
              helperText={formErrors.last_name || ''}
            />
            <TextField label="Last Name (English)" value={form.last_name_en} onChange={e => setForm({ ...form, last_name_en: e.target.value })} fullWidth />
          </Stack>

          <TextField label="Phone Number" value={form.phone_number} onChange={e => setForm({ ...form, phone_number: e.target.value })} placeholder="+8801712345678" error={!!formErrors.phone_number} helperText={formErrors.phone_number || ''} />

          <TextField 
            label="শিক্ষাগত যোগ্যতা (Educational Qualification)" 
            value={form.educational_qualification} 
            onChange={e => setForm({ ...form, educational_qualification: e.target.value })} 
            placeholder="e.g., B.A., M.A., B.Ed., এম.এ., বি.এড."
            error={!!formErrors.educational_qualification} 
            helperText={formErrors.educational_qualification || 'Optional - শিক্ষাগত যোগ্যতা লিখুন'} 
          />
          
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="পদবী (Designation)"
              value={form.designation}
              onChange={e => {
                const val = e.target.value;
                setForm({ ...form, designation: val, designation_en: transliterateBangla(val) });
              }}
              placeholder="e.g., Assistant Teacher, Lecturer, Demonstrator"
              error={!!formErrors.designation}
              helperText={formErrors.designation || 'Optional - শিক্ষকের পদবী'}
              fullWidth
            />
            <TextField
              label="পদবী (ইংরেজিতে)"
              value={form.designation_en}
              onChange={e => setForm({ ...form, designation_en: e.target.value })}
              fullWidth
            />
          </Stack>
          
          <TextField 
            select
            label="রক্তের গ্রুপ (Blood Group)" 
            value={form.blood_group} 
            onChange={e => setForm({ ...form, blood_group: e.target.value })} 
            fullWidth
          >
            <MenuItem value="">নির্বাচন করুন</MenuItem>
            <MenuItem value="A+">A+</MenuItem>
            <MenuItem value="A-">A-</MenuItem>
            <MenuItem value="B+">B+</MenuItem>
            <MenuItem value="B-">B-</MenuItem>
            <MenuItem value="AB+">AB+</MenuItem>
            <MenuItem value="AB-">AB-</MenuItem>
            <MenuItem value="O+">O+</MenuItem>
            <MenuItem value="O-">O-</MenuItem>
          </TextField>

          <TextField 
            label="ইনডেক্স নাম্বার (Index Number)" 
            value={form.index_number} 
            onChange={e => setForm({ ...form, index_number: e.target.value })} 
            fullWidth
          />

          <TextField 
            label="যোগদানের তারিখ (Joining Date)" 
            type="date"
            value={form.joining_date} 
            onChange={e => setForm({ ...form, joining_date: e.target.value })} 
            fullWidth
            InputLabelProps={{ shrink: true }}
          />

          <Autocomplete
            fullWidth
            options={subjects || []}
            getOptionLabel={(s) => s?.name || ''}
            value={subjects.find(s => String(s.id) === String(form.assigned_subject)) || null}
            onChange={(e, val) => setForm({ ...form, assigned_subject: val ? val.id : '' })}
            renderInput={(params) => (
              <TextField {...params} label="নিযুক্ত বিষয় (Assigned Subject)" placeholder="বিষয় নির্বাচন করুন" />
            )}
          />

          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 2 }}>👨‍🏫 শ্রেণি শিক্ষক তথ্য (Class Teacher Info)</Typography>
          <Stack direction="row" spacing={2}>
            <Autocomplete
              fullWidth
              options={classrooms || []}
              getOptionLabel={(c) => c?.name || ''}
              value={classrooms.find(c => String(c.id) === String(form.class_teacher_classroom)) || null}
              onChange={(e, val) => {
                setForm({...form, class_teacher_classroom: val ? val.id : '', class_teacher_section: ''});
              }}
              renderInput={(params) => (
                <TextField {...params} label="শ্রেণি (Class)" placeholder="শ্রেণি নির্বাচন করুন" />
              )}
            />
            <Autocomplete
              fullWidth
              options={sections.filter(s => String(s.classroom?.id || s.classroom) === String(form.class_teacher_classroom)) || []}
              getOptionLabel={(s) => s?.name || ''}
              value={sections.find(s => String(s.id) === String(form.class_teacher_section)) || null}
              onChange={(e, val) => setForm({...form, class_teacher_section: val ? val.id : ''})}
              renderInput={(params) => (
                <TextField {...params} label="সেকশন (Section)" placeholder="সেকশন নির্বাচন করুন" />
              )}
              disabled={!form.class_teacher_classroom}
            />
          </Stack>

          <Divider sx={{ my: 2 }} />
          
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
            📚 বিষয় এবং ক্লাস অ্যাসাইনমেন্ট (Assignments)
          </Typography>
          
          {assignments.map((assign, aIdx) => (
            <Paper key={aIdx} variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#f8f9fa' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>অ্যাসাইনমেন্ট #{aIdx + 1}</Typography>
                {assignments.length > 1 && (
                  <IconButton color="error" onClick={() => removeAssignmentRow(aIdx)}>
                    <DeleteIcon />
                  </IconButton>
                )}
              </Stack>
              
              <Autocomplete
                fullWidth
                sx={{ mb: 2 }}
                options={subjects || []}
                getOptionLabel={(s) => s?.name || ''}
                value={subjects.find(s => String(s.id) === String(assign.subjectId)) || null}
                onChange={(e, val) => updateAssignment(aIdx, 'subjectId', val ? val.id : '')}
                renderInput={(params) => (
                  <TextField {...params} label="বিষয় (Subject)" placeholder="বিষয় নির্বাচন করুন" />
                )}
              />
              
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>ক্লাস এবং সেকশনসমূহ:</Typography>
              
              {assign.classAssignments.map((ca, cIdx) => (
                <Stack key={cIdx} direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
                  <Autocomplete
                    fullWidth
                    options={classrooms || []}
                    getOptionLabel={(c) => c?.name || ''}
                    value={classrooms.find(c => String(c.id) === String(ca.classroomId)) || null}
                    onChange={(e, val) => updateClassAssignment(aIdx, cIdx, 'classroomId', val ? val.id : '')}
                    renderInput={(params) => (
                      <TextField {...params} label="শ্রেণি (Class)" size="small" />
                    )}
                  />
                  <Autocomplete
                    fullWidth
                    options={sections.filter(s => String(s.classroom?.id || s.classroom) === String(ca.classroomId)) || []}
                    getOptionLabel={(s) => s?.name || ''}
                    value={sections.find(s => String(s.id) === String(ca.sectionId)) || null}
                    onChange={(e, val) => updateClassAssignment(aIdx, cIdx, 'sectionId', val ? val.id : '')}
                    renderInput={(params) => (
                      <TextField {...params} label="সেকশন (Section)" size="small" />
                    )}
                    disabled={!ca.classroomId}
                  />
                  {assign.classAssignments.length > 1 && (
                    <IconButton size="small" color="error" onClick={() => removeClassFromAssignment(aIdx, cIdx)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              ))}
              
              <Button 
                startIcon={<AddIcon />} 
                size="small" 
                onClick={() => addClassToAssignment(aIdx)}
                sx={{ mt: 1 }}
              >
                আরো ক্লাস যোগ করুন
              </Button>
            </Paper>
          ))}
          
          <Button 
            variant="outlined" 
            startIcon={<AddIcon />} 
            onClick={addAssignmentRow}
            sx={{ alignSelf: 'flex-start' }}
          >
            নতুন বিষয় যোগ করুন
          </Button>

          <Divider sx={{ my: 2 }} />

          <Stack direction="row" spacing={2}>
            <Button variant="outlined" onClick={() => navigate(-1)}>Cancel</Button>
            <Button variant="contained" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving…' : 'Add Teacher Account'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
