import React, { useMemo, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Paper, Stack, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, CircularProgress, TextField, MenuItem, Grid
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import { useAcademics } from '../context/AcademicsContext';

export default function CredentialsPage() {
  const { id } = useParams();
  const toast = useToast();
  const { classrooms, sections, refreshAll } = useAcademics();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resetApplied, setResetApplied] = useState(false);

  // Filters
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    if (id) refreshAll(id);
  }, [id, refreshAll]);

  const loadList = async (withPasswords = false) => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await api.post(`/api/users/credentials/export/?format=json`, {
        school: id,
        reset: withPasswords ? '1' : '0'
      });
      const data = res.data || {};
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setResetApplied(!!data.reset_applied);
      toast.success(withPasswords ? 'পাসওয়ার্ডসহ আইডি লিস্ট তৈরি হয়েছে' : 'আইডি লিস্ট লোড হয়েছে');
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'লোড করতে ব্যর্থ';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateWithPasswords = async () => {
    if (!id) return;
    const ok = window.confirm('সতর্কতা: এটি সকল ইউজারের পাসওয়ার্ড নতুন করে সেট করবে। আপনি কি নিশ্চিত?');
    if (!ok) return;
    await loadList(true);
  };

  const handleDownloadFile = async (withPasswords = false) => {
    try {
      const res = await api.post(`/api/users/credentials/export/`, {
        school: id,
        reset: withPasswords ? '1' : '0'
      });
      const url = res?.data?.file_url;
      if (url) {
        const absolute = url.startsWith('http') ? url : `${(api?.defaults?.baseURL || '').replace(/\/+$/,'')}${url.startsWith('/') ? '' : '/'}${url}`;
        window.open(absolute, '_blank');
      } else {
        toast.error('ফাইল লিংক পাওয়া যায়নি');
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'ডাউনলোড ব্যর্থ';
      toast.error(msg);
    }
  };

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (roleFilter && String(r.role).toLowerCase() !== roleFilter.toLowerCase()) return false;

      // Class/Section filtering logic for students and parents
      if (classFilter) {
          const cid = String(r.classroom_id || r.child_classroom_id || '');
          if (cid !== String(classFilter)) return false;
      }
      if (sectionFilter) {
          const sid = String(r.section_id || r.child_section_id || '');
          if (sid !== String(sectionFilter)) return false;
      }

      return true;
    });
  }, [rows, roleFilter, classFilter, sectionFilter]);

  const printableRows = filteredRows;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: '100%' }}>
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, background: 'linear-gradient(135deg, #1976d2 0%, #64b5f6 100%)', color: 'white' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
              <LockIcon sx={{ mr: 1 }} /> আইডি লিস্ট (প্রিন্টেবল)
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              সকল ইউজারের নাম, ইউজারনেম, রোল এবং (প্রয়োজনে) নতুন পাসওয়ার্ড
            </Typography>
            {resetApplied && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                <Chip label="পাসওয়ার্ড রিসেট হয়েছে" color="warning" size="small" />
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => loadList(false)} sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.6)' }}>
              তালিকা লোড করুন
            </Button>
            <Button variant="contained" startIcon={<LockIcon />} onClick={handleGenerateWithPasswords} sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
              পাসওয়ার্ডসহ জেনারেট
            </Button>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => handleDownloadFile(resetApplied)} sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.6)' }}>
              ফাইল ডাউনলোড
            </Button>
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()} sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.6)' }}>
              প্রিন্ট
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper elevation={2} sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              label="রোল (Role)"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              size="small"
            >
              <MenuItem value="">সব রোল</MenuItem>
              <MenuItem value="student">শিক্ষার্থী (Student)</MenuItem>
              <MenuItem value="parent">অভিভাবক (Parent)</MenuItem>
              <MenuItem value="teacher">শিক্ষক (Teacher)</MenuItem>
              <MenuItem value="admin">এডমিন (Admin)</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              label="শ্রেণি"
              value={classFilter}
              onChange={(e) => { setClassFilter(e.target.value); setSectionFilter(''); }}
              size="small"
              disabled={roleFilter === 'teacher' || roleFilter === 'admin'}
            >
              <MenuItem value="">সব শ্রেণি</MenuItem>
              {classrooms.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              label="সেকশন"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              size="small"
              disabled={!classFilter || roleFilter === 'teacher' || roleFilter === 'admin'}
            >
              <MenuItem value="">সব সেকশন</MenuItem>
              {sections.filter(s => String(s.classroom?.id || s.classroom) === String(classFilter)).map(s => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table size="small" aria-label="credentials table">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>নাম</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>ইউজারনেম</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>রোল</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>মোবাইল</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>ইমেইল</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>পাসওয়ার্ড</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {printableRows.map((r, idx) => (
                <TableRow key={`${r.username}-${idx}`}>
                  <TableCell>{r.name || ''}</TableCell>
                  <TableCell>{r.username}</TableCell>
                  <TableCell>{r.role}</TableCell>
                  <TableCell>{r.mobile || ''}</TableCell>
                  <TableCell>{r.email || ''}</TableCell>
                  <TableCell>{r.password || ''}</TableCell>
                </TableRow>
              ))}
              {printableRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5, opacity: 0.7 }}>
                    কোনো ডাটা নেই। উপরের বোতাম থেকে লোড/জেনারেট করুন।
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}
