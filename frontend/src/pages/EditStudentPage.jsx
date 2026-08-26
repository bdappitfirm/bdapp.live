import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import api from '../utils/api';
import { Box, Paper, Typography, TextField, Stack, Button, Alert, MenuItem, Grid, Divider, CircularProgress } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import PhotoUpload from '../components/PhotoUpload';
import { normalizeApiError } from '../utils/errorUtils';
import { useToast } from '../components/Toast';
import { transliterateBangla } from '../utils/helpers';
import InputGuidance from '../components/InputGuidance';

export default function EditStudentPage() {
  const { id, studentId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({
    username: '',
    first_name: '',
    first_name_en: '',
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
    admission_date: '',
    birth_date: '',
    optional_subject_id: '',
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
  const [currentPhoto, setCurrentPhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});

  const [classrooms, setClassrooms] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [tourStep, setTourStep] = useState(0);

  const selectedClassObj = classrooms.find(c => String(c.id) === String(form.classroom_id));
  const isNineTen = selectedClassObj ? /নবম|দশম|এসএসসি|এস[\s.]*?এস[\s.]*?সি|[৯১০]ম|পরীক্ষার্থী|\b(nine|ten|ssc|ix|x|9|10)\b/i.test(selectedClassObj.name) : false;

  const guidanceSteps = [
    { selector: '#student-photo-edit', text: 'আপনি চাইলে শিক্ষার্থীর ছবি পরিবর্তন করতে পারেন', autoNext: false },
    { selector: '#classroom-edit', text: 'শ্রেণি পরিবর্তন করুন (প্রয়োজন হলে)', autoNext: false },
    { selector: '#section-edit', text: 'শাখা পরিবর্তন করুন', autoNext: false },
    { selector: '#roll-edit', text: 'রোল নম্বর সংশোধন করুন', autoNext: false },
    ...(isNineTen ? [
        { selector: '#group-edit', text: 'গ্রুপ সংশোধন করুন', autoNext: false },
        { selector: '#optional-subject-edit', text: '৪র্থ বিষয় (Optional) সংশোধন করুন', autoNext: false }
    ] : []),
    { selector: '#student-name-edit', text: 'নাম সংশোধন করুন', autoNext: false },
    { selector: '#username-edit', text: 'ইউজার আইডি সংশোধন করুন', autoNext: false },
    { selector: '#gender-edit', text: 'লিঙ্গ সংশোধন করুন', autoNext: false },
    { selector: '#blood-group-edit', text: 'রক্তের গ্রুপ সংশোধন করুন', autoNext: false },
    { selector: '#birth-date-edit', text: 'জন্ম তারিখ সংশোধন করুন', autoNext: false },
    { selector: '#guardian-name-edit', text: 'অভিভাবকের নাম সংশোধন করুন', autoNext: false },
    { selector: '#student-update-btn', text: 'সবশেষে আপডেট বাটনে ক্লিক করুন', autoNext: false }
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
    if (!loading) {
        const timer = setTimeout(() => setTourStep(1), 1000);
        return () => clearTimeout(timer);
    }
  }, [loading]);

  useEffect(() => {
    const load = async () => {
      try {
        const [classes, secs, studentRes, subjsRes] = await Promise.all([
          api.get(`/api/academics/classrooms/?school=${id}&page_size=1000`),
          api.get(`/api/academics/sections/?school=${id}&page_size=1000`),
          api.get(`/api/academics/students/${studentId}/`),
          api.get(`/api/academics/subjects/?school=${id}&page_size=1000`)
        ]);

        setClassrooms(Array.isArray(classes.data) ? classes.data : (classes.data?.results || []));
        setSections(Array.isArray(secs.data) ? secs.data : (secs.data?.results || []));
        setSubjects(Array.isArray(subjsRes.data) ? subjsRes.data : (subjsRes.data?.results || []));

        const s = studentRes.data;

        const formatToDisplay = (dateStr) => {
          if (!dateStr) return '';
          if (dateStr.includes('-') && dateStr.split('-')[0].length === 4) {
            const [y, m, d] = dateStr.split('-');
            return `${d}-${m}-${y}`;
          }
          return dateStr;
        };

        setForm({
          username: s.user?.username || s.username || '',
          first_name: s.user?.first_name || s.first_name || '',
          first_name_en: s.user?.first_name_en || s.first_name_en || '',
          last_name: s.user?.last_name || s.last_name || '',
          last_name_en: s.user?.last_name_en || s.last_name_en || '',
          email: s.user?.email || s.email || '',
          phone_number: s.user?.phone_number || s.phone_number || '',
          roll_number: s.roll_number || '',
          classroom_id: s.classroom?.id || s.classroom || '',
          section_id: s.section?.id || s.section || '',
          group: s.student_group || s.group || '',
          blood_group: s.blood_group || '',
          gender: s.gender || '',
          guardian_name: s.guardian_name || '',
          guardian_name_en: s.guardian_name_en || '',
          father_name: s.father_name || '',
          father_name_en: s.father_name_en || '',
          mother_name: s.mother_name || '',
          mother_name_en: s.mother_name_en || '',
          admission_date: formatToDisplay(s.admission_date) || '',
          birth_date: formatToDisplay(s.birth_date) || '',
          optional_subject_id: s.optional_subject?.id || s.optional_subject || '',
          address: s.address || '',
          address_en: s.address_en || '',
          remarks: s.remarks || '',
          voter_number: s.voter_number || '',
          ssc_board: s.ssc_board || 'Board of Intermediate and Secondary Education, Cumilla',
          ssc_roll: s.ssc_roll || '',
          ssc_registration: s.ssc_registration || '',
          ssc_session: s.ssc_session || '',
          ssc_gpa: s.ssc_gpa || ''
        });
        setCurrentPhoto(s.user?.photo_url || s.photo_url || s.photo);
      } catch (e) {
        console.error("Error loading data:", e);
        setError("তথ্য লোড করতে সমস্যা হয়েছে");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, studentId]);

  const [prevGroup, setPrevGroup] = useState('');

  useEffect(() => {
    if (loading || !isNineTen || !form.group || subjects.length === 0) return;

    // Only auto-update if the group has actually changed since the last render
    if (form.group === prevGroup) return;
    setPrevGroup(form.group);

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
      if (found) {
        setForm(prev => ({ ...prev, optional_subject_id: found.id }));
      }
    }
  }, [isNineTen, form.group, subjects, loading, prevGroup]);

  const handleSubmit = async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }

    setSaving(true);
    setError('');
    setFormErrors({});

    try {
      const fd = new FormData();

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
        // Only append if value is not null/undefined
        if (valueToSend !== undefined && valueToSend !== null && valueToSend !== '') {
            fd.append(k, valueToSend);
        } else if (valueToSend === '') {
            fd.append(k, '');
        }
      });
      if (photoFile) fd.append('photo', photoFile);

      const response = await api.patch(`/api/academics/students/${studentId}/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data && response.data.offline) {
        toast.info('আপনার ইন্টারনেট সংযোগ দুর্বল। তথ্যটি পরবর্তীতে সেভ করার জন্য জমা রাখা হয়েছে।');
      } else {
        toast.success('শিক্ষার্থীর তথ্য আপডেট করা হয়েছে');
      }

      // Navigate back to the previous context
      setTimeout(() => {
        navigate(-1);
      }, 1500);
    } catch (e) {
      const n = normalizeApiError(e);
      setError(n.message || 'আপডেট ব্যর্থ হয়েছে');
      setFormErrors(n.fieldErrors || {});
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Typography variant="h4" gutterBottom>শিক্ষার্থী তথ্য সংশোধন (Edit Student)</Typography>
      </Paper>

      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Stack spacing={3}>
          {error && <Alert severity="error">{error}</Alert>}

          <Box id="student-photo-edit" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} onClick={() => updateStep('#classroom-edit')}>
            <PhotoUpload currentPhoto={currentPhoto} onPhotoChange={setPhotoFile} userName={form.first_name || 'Student'} />
          </Box>

          <Divider />

          <Typography variant="h6">একাডেমিক তথ্য</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={3}>
              <TextField id="classroom-edit" select fullWidth label="শ্রেণি" value={form.classroom_id} onFocus={() => updateStep('#classroom-edit')} onChange={e => { setForm({...form, classroom_id: e.target.value, section_id: ''}); updateStep('#section-edit'); }}>
                {classrooms.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField id="section-edit" select fullWidth label="শাখা" value={form.section_id} onFocus={() => updateStep('#section-edit')} onChange={e => { setForm({...form, section_id: e.target.value}); updateStep('#roll-edit'); }} disabled={!form.classroom_id}>
                <MenuItem value="">শাখা নেই</MenuItem>
                {sections.filter(s => String(s.classroom?.id || s.classroom) === String(form.classroom_id)).map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={2}>
              <TextField id="roll-edit" fullWidth label="রোল নম্বর" value={form.roll_number} onFocus={() => updateStep('#roll-edit')} onChange={e => setForm({...form, roll_number: e.target.value})} />
            </Grid>
            {isNineTen && (
              <>
                <Grid item xs={12} sm={3}>
                    <TextField id="group-edit" select fullWidth label="গ্রুপ" value={form.group} onFocus={() => updateStep('#group-edit')} onChange={e => { setForm({...form, group: e.target.value}); updateStep('#optional-subject-edit'); }}>
                        <MenuItem value="">কিছুই না</MenuItem>
                        <MenuItem value="science">বিজ্ঞান (Science)</MenuItem>
                        <MenuItem value="arts">মানবিক (Arts)</MenuItem>
                        <MenuItem value="commerce">ব্যবসায় শিক্ষা (Commerce)</MenuItem>
                    </TextField>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField id="optional-subject-edit" select fullWidth label="৪র্থ বিষয় (Optional)" value={form.optional_subject_id} onFocus={() => updateStep('#optional-subject-edit')} onChange={e => { setForm({...form, optional_subject_id: e.target.value}); updateStep('#student-name-edit'); }}>
                    <MenuItem value="">নির্বাচন করুন</MenuItem>
                    {subjects.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                  </TextField>
                </Grid>
              </>
            )}
            <Grid item xs={12} sm={2}>
                <TextField
                  fullWidth
                  label="ভর্তির তারিখ (DD-MM-YYYY)"
                  value={form.admission_date}
                  onChange={e => {
                    let val = e.target.value.replace(/\D/g, '');
                    if (val.length > 8) val = val.slice(0, 8);
                    let formatted = val;
                    if (val.length > 2) formatted = val.slice(0, 2) + '-' + val.slice(2);
                    if (val.length > 4) formatted = formatted.slice(0, 5) + '-' + formatted.slice(5);
                    setForm({...form, admission_date: formatted});
                  }}
                />
            </Grid>
          </Grid>

          <Divider />

          <Typography variant="h6">ব্যক্তিগত তথ্য</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                id="student-name-edit"
                fullWidth
                label="নাম (First Name)"
                value={form.first_name}
                onFocus={() => updateStep('#student-name-edit')}
                onChange={e => {
                  const val = e.target.value;
                  setForm({...form, first_name: val, first_name_en: transliterateBangla(val)});
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="নাম (ইংরেজিতে)" value={form.first_name_en} onChange={e => setForm({...form, first_name_en: e.target.value})} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField id="username-edit" fullWidth label="ইউজার আইডি (Username)" value={form.username} onFocus={() => updateStep('#username-edit')} onChange={e => setForm({...form, username: e.target.value})} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField id="gender-edit" select fullWidth label="লিঙ্গ" value={form.gender} onFocus={() => updateStep('#gender-edit')} onChange={e => { setForm({...form, gender: e.target.value}); updateStep('#blood-group-edit'); }}>
                <MenuItem value="male">ছাত্র</MenuItem>
                <MenuItem value="female">ছাত্রী</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField id="blood-group-edit" select fullWidth label="রক্তের গ্রুপ" value={form.blood_group} onFocus={() => updateStep('#blood-group-edit')} onChange={e => { setForm({...form, blood_group: e.target.value}); updateStep('#birth-date-edit'); }}>
                <MenuItem value="">নির্বাচন করুন</MenuItem>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <MenuItem key={bg} value={bg}>{bg}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
                <TextField
                  id="birth-date-edit"
                  fullWidth
                  label="জন্ম তারিখ (DD-MM-YYYY)"
                  value={form.birth_date}
                  onFocus={() => updateStep('#birth-date-edit')}
                  onChange={e => {
                    let val = e.target.value.replace(/\D/g, '');
                    if (val.length > 8) val = val.slice(0, 8);
                    let formatted = val;
                    if (val.length > 2) formatted = val.slice(0, 2) + '-' + val.slice(2);
                    if (val.length > 4) formatted = formatted.slice(0, 5) + '-' + formatted.slice(5);
                    setForm({...form, birth_date: formatted});
                  }}
                />
            </Grid>
          </Grid>

          <Divider />

          <Typography variant="h6">অভিভাবকের তথ্য</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                id="guardian-name-edit"
                fullWidth
                label="অভিভাবকের নাম"
                value={form.guardian_name}
                onFocus={() => updateStep('#guardian-name-edit')}
                onChange={e => {
                  const val = e.target.value;
                  setForm({...form, guardian_name: val, guardian_name_en: transliterateBangla(val)});
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="অভিভাবকের নাম (ইংরেজিতে)" value={form.guardian_name_en} onChange={e => setForm({...form, guardian_name_en: e.target.value})} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="মোবাইল নম্বর" value={form.phone_number} onChange={e => setForm({...form, phone_number: e.target.value})} />
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

          <Typography variant="h6">ঠিকানা ও অন্যান্য</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                id="address-edit"
                fullWidth
                multiline
                rows={2}
                label="ঠিকানা"
                value={form.address}
                onChange={e => {
                  const val = e.target.value;
                  setForm({...form, address: val, address_en: transliterateBangla(val)});
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField id="address-en-edit" fullWidth multiline rows={2} label="ঠিকানা (ইংরেজিতে)" value={form.address_en} onChange={e => setForm({...form, address_en: e.target.value})} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="ভোটার আইডি/জন্ম নিবন্ধন নম্বর" value={form.voter_number} onChange={e => setForm({...form, voter_number: e.target.value})} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="মন্তব্য" value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} />
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

          <Divider />

          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button variant="outlined" onClick={() => navigate(-1)}>বাতিল</Button>
            <Button id="student-update-btn" variant="contained" startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />} onClick={handleSubmit} disabled={saving}>আপডেট করুন</Button>
          </Stack>
        </Stack>
      </Paper>
      <InputGuidance steps={guidanceSteps} activeStep={tourStep - 1} onStepComplete={(step) => setTourStep(step + 1)} />
    </Box>
  );
}
