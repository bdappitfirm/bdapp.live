import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Box, Typography, Grid, Card, CardContent, Stack, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Divider } from '@mui/material';
import { useToast } from '../components/Toast';

export default function SchoolsPage(){
  const toast = useToast();
  const navigate = useNavigate();
  const [schools, setSchools] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', ein: '', email: '', phone_number: '', address: '',
    principal_name: '', number_of_buildings: 1,
    num_classes: 0, sections_per_class: 1, students_per_section: 0,
    dress_boy: '', dress_girl: ''
  });
  const [logoFile, setLogoFile] = useState(null);
  const [sigFile, setSigFile] = useState(null);
  const [sealFile, setSealFile] = useState(null);

  const fetchSchools = async () => {
    try {
      const res = await api.get('/api/schools/');
      setSchools(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(()=>{
    fetchSchools();
  }, []);

  const handleSave = async () => {
    try {
      const formData = new FormData();
      Object.keys(form).forEach(key => {
        if (form[key] !== null) formData.append(key, form[key]);
      });
      if (logoFile) formData.append('logo', logoFile);
      if (sigFile) formData.append('principal_signature', sigFile);
      if (sealFile) formData.append('school_seal', sealFile);

      if (editing) {
        await api.patch(`/api/schools/${editing.id}/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('School updated successfully');
      } else {
        await api.post('/api/setup-bulk/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('School and Student Profiles created successfully');
      }
      setOpen(false);
      fetchSchools();
    } catch (error) {
      console.error('Error saving school:', error);
      toast.error(error.response?.data?.error || 'Failed to save school');
    }
  };

  return (
    <Box sx={{ p:3 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb:2 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>স্কুল ম্যানেজমেন্ট</Typography>
        <Button variant="contained" size="large" onClick={()=>{
          setEditing(null);
          setForm({
            name: '', ein: '', email: '', phone_number: '', address: '',
            principal_name: '', number_of_buildings: 1,
            num_classes: 0, sections_per_class: 1, students_per_section: 0,
            dress_boy: '', dress_girl: ''
          });
          setOpen(true);
        }}>নতুন স্কুল যোগ করুন</Button>
      </Stack>

      <Grid container spacing={2}>
        {schools.map(s => (
          <Grid key={s.id} item xs={12} sm={6} md={4}>
            <Card sx={{ height: '100%', borderRadius: 3, boxShadow: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>{s.name}</Typography>
                <Typography variant="body2" color="text.secondary">EIIN: {s.ein || 'N/A'}</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>{s.address || 'ঠিকানা নেই'}</Typography>
                <Stack direction="row" spacing={1} sx={{ mt:2 }}>
                  <Button size="small" variant="contained" onClick={()=>navigate(`/school/${s.id}`)}>ড্যাশবোর্ড</Button>
                  <Button size="small" variant="outlined" onClick={()=>{ setEditing(s); setForm(s); setOpen(true); }}>এডিট</Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open} onClose={()=>setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white' }}>
          {editing ? 'স্কুল তথ্য সংশোধন' : 'নতুন স্কুল ও শিক্ষার্থী সেটআপ'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>প্রাথমিক তথ্য</Typography>
              <TextField label="স্কুলের নাম (School Name)" size="small" fullWidth sx={{ mb:2 }} value={form.name} onChange={e=>setForm({ ...form, name: e.target.value })} />
              <TextField label="EIIN নম্বর" size="small" fullWidth sx={{ mb:2 }} value={form.ein} onChange={e=>setForm({ ...form, ein: e.target.value })} />
              <TextField label="ইমেইল" size="small" fullWidth sx={{ mb:2 }} value={form.email} onChange={e=>setForm({ ...form, email: e.target.value })} />
              <TextField label="ফোন নম্বর" size="small" fullWidth sx={{ mb:2 }} value={form.phone_number} onChange={e=>setForm({ ...form, phone_number: e.target.value })} />
              <TextField label="ঠিকানা" size="small" fullWidth sx={{ mb:2 }} multiline rows={2} value={form.address} onChange={e=>setForm({ ...form, address: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>ব্যবস্থাপনা</Typography>
              <TextField label="প্রধান শিক্ষকের নাম" size="small" fullWidth sx={{ mb:2 }} value={form.principal_name} onChange={e=>setForm({ ...form, principal_name: e.target.value })} />
              <TextField label="ভবন সংখ্যা" size="small" type="number" fullWidth sx={{ mb:2 }} value={form.number_of_buildings} onChange={e=>setForm({ ...form, number_of_buildings: e.target.value })} />

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" display="block">স্কুল লোগো (Logo)</Typography>
                <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files[0])} />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" display="block">প্রধান শিক্ষকের স্বাক্ষর (Signature)</Typography>
                <input type="file" accept="image/*" onChange={e => setSigFile(e.target.files[0])} />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" display="block">স্কুল সিল (School Seal)</Typography>
                <input type="file" accept="image/*" onChange={e => setSealFile(e.target.files[0])} />
              </Box>
            </Grid>

            {!editing && (
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom color="secondary" sx={{ fontWeight: 'bold' }}>অটোমেটিক প্রোফাইল ক্রিয়েশন (এককালীন)</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <TextField label="শ্রেণি সংখ্যা" size="small" type="number" fullWidth value={form.num_classes} onChange={e=>setForm({ ...form, num_classes: e.target.value })} />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField label="সেকশন সংখ্যা (প্রতি ক্লাস)" size="small" type="number" fullWidth value={form.sections_per_class} onChange={e=>setForm({ ...form, sections_per_class: e.target.value })} />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField label="ছাত্র সংখ্যা (প্রতি সেকশন)" size="small" type="number" fullWidth value={form.students_per_section} onChange={e=>setForm({ ...form, students_per_section: e.target.value })} />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField label="ড্রেস কালার (ছেলে)" size="small" placeholder="যেমন: White, Blue" fullWidth value={form.dress_boy} onChange={e=>setForm({ ...form, dress_boy: e.target.value })} />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField label="ড্রেস কালার (মেয়ে)" size="small" placeholder="যেমন: Red, Green" fullWidth value={form.dress_girl} onChange={e=>setForm({ ...form, dress_girl: e.target.value })} />
                  </Grid>
                </Grid>
                <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
                  * পাসওয়ার্ড অটোমেটিক '12345678' সেট হবে এবং ২/৩ অংশ মেয়ে শিক্ষার্থী তৈরি হবে।
                </Typography>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={()=>setOpen(false)} variant="outlined">বাতিল</Button>
          <Button variant="contained" color="success" onClick={handleSave}>
            {editing ? 'তথ্য আপডেট করুন' : 'স্কুল ও শিক্ষার্থী তৈরি করুন'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
