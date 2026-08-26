import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import api from '../utils/api';
import { Box, Paper, Typography, TextField, Stack, Button, Alert, Chip, MenuItem, Grid, Divider, Autocomplete, CircularProgress } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import PhotoUpload from '../components/PhotoUpload';
import { normalizeApiError } from '../utils/errorUtils';
import { useToast } from '../components/Toast';
import { transliterateBangla } from '../utils/helpers';
import InputGuidance from '../components/InputGuidance';

export default function AddStudentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const shownSuggestionsRef = React.useRef(new Set());

  const [form, setForm] = useState({
    username: '',
    password: '',
    first_name: '',
    first_name_en: '',
    last_name: '',
    last_name_en: '',
    email: '',
    phone_number: '',
    roll_number: '',
    classroom_id: '',
    section_id: '',
    group: '',
    blood_group: '',
    gender: '',
    guardian_name: '',
    guardian_name_en: '',
    father_name: '',
    father_name_en: '',
    mother_name: '',
    mother_name_en: '',
    birth_date: '',
    optional_subject_id: '',
    admission_date: (() => {
      const d = new Date();
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    })(),
    address: '',
    address_en: '',
    remarks: '',
    voter_number: '',
    ssc_board: 'Board of Intermediate and Secondary Education, Cumilla',
    ssc_roll: '',
    ssc_registration: '',
    ssc_session: '',
    ssc_gpa: ''
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});

  const [classrooms, setClassrooms] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [usernameCheck, setUsernameCheck] = useState({ loading: false, available: null, suggestions: [], msg: '' });
  const [tourStep, setTourStep] = useState(0);

  const selectedClassObj = classrooms.find(c => String(c.id) === String(form.classroom_id));
  const isNineTen = selectedClassObj ? /নবম|দশম|এসএসসি|এস[\s.]*?এস[\s.]*?সি|[৯১০]ম|পরীক্ষার্থী|\b(nine|ten|ssc|ix|x|9|10)\b/i.test(selectedClassObj.name) : false;

  const guidanceSteps = [
    { selector: '#student-photo-box', text: 'প্রথমে শিক্ষার্থীর ছবি আপলোড করুন', autoNext: false },
    { selector: '#classroom-select', text: 'শিক্ষার্থীর শ্রেণি নির্বাচন করুন', autoNext: false },
    { selector: '#section-select', text: 'শাখা নির্বাচন করুন', autoNext: false },
    { selector: '#roll-number-input', text: 'রোল নম্বর লিখুন', autoNext: false },
    { selector: '#student-name-input', text: 'শিক্ষার্থীর নাম লিখুন', autoNext: false },
    { selector: '#username-input', text: 'ইউজার আইডি লিখুন (ঐচ্ছিক)', autoNext: false },
    { selector: '#password-input', text: 'পাসওয়ার্ড সেট করুন', autoNext: false },
    { selector: '#gender-select', text: 'লিঙ্গ নির্বাচন করুন', autoNext: false },
    { selector: '#blood-group-select', text: 'রক্তের গ্রুপ নির্বাচন করুন', autoNext: false },
    { selector: '#birth-date-input', text: 'জন্ম তারিখ দিন', autoNext: false },
    ...(isNineTen ? [
      { selector: '#group-select', text: 'গ্রুপ (৯ম-১০ম) নির্বাচন করুন', autoNext: false },
      { selector: '#optional-subject-select', text: '৪র্থ বিষয় (Optional) নির্বাচন করুন', autoNext: false }
    ] : []),
    { selector: '#guardian-name-input', text: 'অভিভাবকের নাম লিখুন', autoNext: false },
    { selector: '#student-save-btn', text: 'সবশেষে সেভ বাটনে ক্লিক করুন', autoNext: false }
  ];

  const updateStep = (selector) => {
    const currentIdx = guidanceSteps.findIndex(s => s.selector === selector);
    if (currentIdx !== -1 && currentIdx < guidanceSteps.length - 1) {
      setTourStep(currentIdx + 2);
    } else if (currentIdx === guidanceSteps.length - 1) {
      setTourStep(guidanceSteps.length);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setTourStep(1), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [classes, secs, subjs] = await Promise.all([
          api.get(`/api/academics/classrooms/?school=${id}&page_size=1000`),
          api.get(`/api/academics/sections/?school=${id}&page_size=1000`),
          api.get(`/api/academics/subjects/?school=${id}&page_size=1000`)
        ]);
        setClassrooms(Array.isArray(classes.data) ? classes.data : (classes.data?.results || []));
        setSections(Array.isArray(secs.data) ? secs.data : (secs.data?.results || []));
        setSubjects(Array.isArray(subjs.data) ? subjs.data : (subjs.data?.results || []));
      } catch (e) {
        console.error("Error loading dropdown data:", e);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    const uname = (form.username || '').trim();
    if (!uname) {
      setUsernameCheck({ loading: false, available: null, suggestions: [], msg: '' });
      return;
    }
    let cancelled = false;
    setUsernameCheck(prev => ({ ...prev, loading: true, msg: '' }));
    const h = setTimeout(async () => {
      try {
        const res = await api.get('/api/users/username-availability/', { params: { q: uname } });
        if (cancelled) return;

        setUsernameCheck({ loading: false, available: res.data.available, suggestions: [], msg: '' });
      } catch (e) {
        if (cancelled) return;
        setUsernameCheck({ loading: false, available: null, suggestions: [], msg: 'Check failed' });
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(h); };
  }, [form.username]);

  useEffect(() => {
    if (!isNineTen || !form.group || subjects.length === 0) return;

    let targetName = '';
    if (form.group === 'science') {
      targetName = 'উচ্চতর গণিত';
    } else if (form.group === 'arts' || form.group === 'commerce') {
      targetName = 'কৃষি';
    }

    if (targetName) {
      const found = subjects.find(s =>
        s.name.includes(targetName) ||
        (targetName === 'উচ্চতর গণিত' && s.name.toLowerCase().includes('higher math')) ||
        (targetName === 'কৃষি' && s.name.toLowerCase().includes('agriculture'))
      );
      if (found && !form.optional_subject_id) {
        setForm(prev => ({ ...prev, optional_subject_id: found.id }));
      }
    }
  }, [isNineTen, form.group, subjects, form.optional_subject_id]);

  const handleSubmit = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }

    if (!form.first_name) {
        setError('শিক্ষার্থীর নাম আবশ্যক');
        setFormErrors({ first_name: 'নাম লিখুন' });
        return;
    }

    setSaving(true);
    setError('');
    setFormErrors({});

    try {
      const fd = new FormData();

      // Helper to convert DD-MM-YYYY to YYYY-MM-DD
      const formatToISO = (dateStr) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3 && parts[2].length === 4) {
          return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateStr;
      };

      Object.entries(form).forEach(([k, v]) => {
        let valueToSend = v;
        if ((k === 'birth_date' || k === 'admission_date') && typeof v === 'string' && v.includes('-')) {
            valueToSend = formatToISO(v);
        }
        if (valueToSend !== undefined && valueToSend !== null && valueToSend !== '') fd.append(k, valueToSend);
      });
      fd.append('school_id', id);
      if (photoFile) fd.append('photo', photoFile);

      const response = await api.post('/api/academics/students/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data && response.data.offline) {
        toast.info('আপনার ইন্টারনেট সংযোগ দুর্বল। শিক্ষার্থী ভর্তির আবেদনটি পরবর্তীতে সেভ করার জন্য জমা রাখা হয়েছে।');
      } else {
        toast.success('শিক্ষার্থী সফলভাবে ভর্তি করা হয়েছে');
      }

      // Navigate back to the previous context (likely the student list)
      setTimeout(() => {
        navigate(-1);
      }, 1500);
    } catch (e) {
      const n = normalizeApiError(e);
      setError(n.message || 'ভর্তি প্রক্রিয়া ব্যর্থ হয়েছে');
      setFormErrors(n.fieldErrors || {});
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Typography variant="h4" gutterBottom>নতুন ছাত্র ভর্তি (New Student Admission)</Typography>
        <Typography variant="body2" color="text.secondary">স্কুল আইডি: {id}</Typography>
      </Paper>

      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Stack spacing={3}>
          {error && <Alert severity="error">{error}</Alert>}

          <Box id="student-photo-box" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} onClick={() => updateStep('#classroom-select')}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>শিক্ষার্থীর ছবি</Typography>
            <PhotoUpload currentPhoto={null} onPhotoChange={setPhotoFile} userName={form.first_name || 'Student'} />
          </Box>

          <Divider />

          <Typography variant="h6">একাডেমিক তথ্য</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField id="classroom-select" select fullWidth label="শ্রেণি *" value={form.classroom_id} onFocus={() => updateStep('#classroom-select')} onChange={e => { setForm({...form, classroom_id: e.target.value, section_id: ''}); updateStep('#section-select'); }} required>
                {classrooms.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField id="section-select" select fullWidth label="শাখা" value={form.section_id} onFocus={() => updateStep('#section-select')} onChange={e => { setForm({...form, section_id: e.target.value}); updateStep('#roll-number-input'); }} disabled={!form.classroom_id}>
                <MenuItem value="">শাখা নেই</MenuItem>
                {sections.filter(s => String(s.classroom?.id || s.classroom) === String(form.classroom_id)).map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField id="roll-number-input" fullWidth label="রোল নম্বর" value={form.roll_number} onFocus={() => updateStep('#roll-number-input')} onChange={e => setForm({...form, roll_number: e.target.value})} />
            </Grid>
          </Grid>

          <Divider />

          <Typography variant="h6">ব্যক্তিগত তথ্য</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                id="student-name-input"
                fullWidth
                label="শিক্ষার্থীর নাম (First Name) *"
                value={form.first_name}
                onFocus={() => updateStep('#student-name-input')}
                onChange={e => {
                  const val = e.target.value;
                  setForm({...form, first_name: val, first_name_en: transliterateBangla(val)});
                }}
                error={!!formErrors.first_name}
                helperText={formErrors.first_name}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="নাম (ইংরেজিতে)" value={form.first_name_en} onChange={e => setForm({...form, first_name_en: e.target.value})} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField id="username-input" fullWidth label="ইউজার আইডি (Username)" value={form.username} onFocus={() => updateStep('#username-input')} onChange={e => setForm({...form, username: e.target.value})} helperText="খালি রাখলে স্বয়ংক্রিয়ভাবে তৈরি হবে" error={usernameCheck.available === false} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField id="password-input" fullWidth label="পাসওয়ার্ড" type="password" value={form.password} onFocus={() => updateStep('#password-input')} onChange={e => setForm({...form, password: e.target.value})} placeholder="ডিফল্ট: 12345678" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField id="gender-select" select fullWidth label="লিঙ্গ" value={form.gender} onFocus={() => updateStep('#gender-select')} onChange={e => { setForm({...form, gender: e.target.value}); updateStep('#blood-group-select'); }}>
                <MenuItem value="male">ছাত্র (Male)</MenuItem>
                <MenuItem value="female">ছাত্রী (Female)</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField id="blood-group-select" select fullWidth label="রক্তের গ্রুপ" value={form.blood_group} onFocus={() => updateStep('#blood-group-select')} onChange={e => { setForm({...form, blood_group: e.target.value}); updateStep('#birth-date-input'); }}>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <MenuItem key={bg} value={bg}>{bg}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                id="birth-date-input"
                fullWidth
                label="জন্ম তারিখ (দিন-মাস-বছর)"
                placeholder="DD-MM-YYYY"
                value={form.birth_date}
                onFocus={() => updateStep('#birth-date-input')}
                onChange={e => {
                    let val = e.target.value.replace(/\D/g, '');
                    if (val.length > 8) val = val.slice(0, 8);
                    let formatted = val;
                    if (val.length > 2) formatted = val.slice(0, 2) + '-' + val.slice(2);
                    if (val.length > 4) formatted = formatted.slice(0, 5) + '-' + formatted.slice(5);
                    setForm({...form, birth_date: formatted});
                }}
                helperText="উদাহরণ: 15-08-2005"
                error={!!formErrors.birth_date}
              />
            </Grid>
            {isNineTen && (
              <>
                <Grid item xs={12} sm={4}>
                    <TextField id="group-select" select fullWidth label="গ্রুপ (৯ম-১০ম)" value={form.group} onFocus={() => updateStep('#group-select')} onChange={e => { setForm({...form, group: e.target.value}); updateStep('#optional-subject-select'); }}>
                        <MenuItem value="">প্রযোজ্য নয়</MenuItem>
                        <MenuItem value="science">বিজ্ঞান</MenuItem>
                        <MenuItem value="arts">মানবিক</MenuItem>
                        <MenuItem value="commerce">ব্যবসায় শিক্ষা</MenuItem>
                    </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField id="optional-subject-select" select fullWidth label="৪র্থ বিষয় (Optional)" value={form.optional_subject_id} onFocus={() => updateStep('#optional-subject-select')} onChange={e => { setForm({...form, optional_subject_id: e.target.value}); updateStep('#guardian-name-input'); }}>
                    <MenuItem value="">নির্বাচন করুন</MenuItem>
                    {subjects.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                  </TextField>
                </Grid>
              </>
            )}
          </Grid>

          <Divider />

          <Typography variant="h6">অভিভাবকের তথ্য</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                id="guardian-name-input"
                fullWidth
                label="অভিভাবকের নাম *"
                value={form.guardian_name}
                onFocus={() => updateStep('#guardian-name-input')}
                onChange={e => {
                  const val = e.target.value;
                  setForm({...form, guardian_name: val, guardian_name_en: transliterateBangla(val)});
                }}
                helperText="এটি দিয়ে স্বয়ংক্রিয়ভাবে অভিভাবক প্রোফাইল তৈরি হবে"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="অভিভাবকের নাম (ইংরেজিতে)" value={form.guardian_name_en} onChange={e => setForm({...form, guardian_name_en: e.target.value})} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="মোবাইল নম্বর" value={form.phone_number} onChange={e => setForm({...form, phone_number: e.target.value})} placeholder="017XXXXXXXX" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="পিতার নাম"
                value={form.father_name}
                onChange={e => {
                  const val = e.target.value;
                  setForm({...form, father_name: val, father_name_en: transliterateBangla(val)});
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="পিতার নাম (ইংরেজিতে)" value={form.father_name_en} onChange={e => setForm({...form, father_name_en: e.target.value})} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="মাতার নাম"
                value={form.mother_name}
                onChange={e => {
                  const val = e.target.value;
                  setForm({...form, mother_name: val, mother_name_en: transliterateBangla(val)});
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="মাতার নাম (ইংরেজিতে)" value={form.mother_name_en} onChange={e => setForm({...form, mother_name_en: e.target.value})} />
            </Grid>
          </Grid>

          <Divider />

          <Typography variant="h6">অন্যান্য তথ্য</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="ভর্তির তারিখ (দিন-মাস-বছর)"
                placeholder="DD-MM-YYYY"
                value={form.admission_date}
                onChange={e => {
                    let val = e.target.value.replace(/\D/g, '');
                    if (val.length > 8) val = val.slice(0, 8);
                    let formatted = val;
                    if (val.length > 2) formatted = val.slice(0, 2) + '-' + val.slice(2);
                    if (val.length > 4) formatted = formatted.slice(0, 5) + '-' + formatted.slice(5);
                    setForm({...form, admission_date: formatted});
                }}
                helperText="উদাহরণ: 01-01-2024"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                id="address-input"
                fullWidth
                label="ঠিকানা"
                multiline
                rows={2}
                value={form.address}
                onChange={e => {
                  const val = e.target.value;
                  setForm({...form, address: val, address_en: transliterateBangla(val)});
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField id="address-en-input" fullWidth label="ঠিকানা (ইংরেজিতে)" multiline rows={2} value={form.address_en} onChange={e => setForm({...form, address_en: e.target.value})} />
            </Grid>
          </Grid>

          {isNineTen && (
            <>
              <Divider />
              <Typography variant="h6">এস.এস.সি. তথ্য (SSC Information)</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Board Name" value={form.ssc_board} onChange={e => setForm({...form, ssc_board: e.target.value})} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Roll No." value={form.ssc_roll} onChange={e => setForm({...form, ssc_roll: e.target.value})} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Registration No." value={form.ssc_registration} onChange={e => setForm({...form, ssc_registration: e.target.value})} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Session" value={form.ssc_session} onChange={e => setForm({...form, ssc_session: e.target.value})} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="GPA" value={form.ssc_gpa} onChange={e => setForm({...form, ssc_gpa: e.target.value})} />
                </Grid>
              </Grid>
            </>
          )}

          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button variant="outlined" onClick={() => navigate(-1)}>বাতিল</Button>
            <Button id="student-save-btn" variant="contained" startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />} onClick={handleSubmit} disabled={saving}>সংরক্ষণ করুন</Button>
          </Stack>
        </Stack>
      </Paper>
      <InputGuidance steps={guidanceSteps} activeStep={tourStep - 1} onStepComplete={(step) => setTourStep(step + 1)} />
    </Box>
  );
}
