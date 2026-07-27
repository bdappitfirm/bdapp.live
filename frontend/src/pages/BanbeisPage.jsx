import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, TextField, Button, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Switch, FormControlLabel, CircularProgress, Divider, Stack
} from '@mui/material';
import {
  Print as PrintIcon,
  Save as SaveIcon,
  Download as DownloadIcon,
  School as SchoolIcon,
  People as PeopleIcon,
  Business as BusinessIcon,
  AttachMoney as MoneyIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';
import api from '../utils/api';
import { useToast } from '../components/Toast';

const BANBEIS_TABS = [
  { label: 'প্রতিষ্ঠান পরিচিতি', icon: <SchoolIcon /> },
  { label: 'শিক্ষার্থী পরিসংখ্যান', icon: <PeopleIcon /> },
  { label: 'শিক্ষক-কর্মচারী', icon: <PeopleIcon /> },
  { label: 'অবকাঠামো', icon: <BusinessIcon /> },
  { label: 'অর্থ ও সুবিধা', icon: <MoneyIcon /> },
  { label: 'অবস্থান', icon: <LocationIcon /> }
];

export default function BanbeisPage() {
  const { id } = useParams();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [data, setData] = useState(null);
  const [schoolInfo, setSchoolInfo] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [banbeisRes, schoolRes] = await Promise.all([
        api.get(`/api/banbeis/${id}/`),
        api.get(`/api/schools/${id}/`)
      ]);
      setData(banbeisRes.data);
      setSchoolInfo(schoolRes.data);
    } catch (err) {
      console.error("Banbeis Load Error:", err);
      // Don't show toast if it's a 400 we handle
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAutoFetch = async () => {
    if (!schoolInfo?.ein) {
        toast.error("EIIN নাম্বার পাওয়া যায়নি। স্কুল সেটিংস থেকে এটি ঠিক করুন।");
        return;
    }
    try {
        setFetching(true);
        const res = await api.post(`/api/banbeis/${id}/fetch_external/`);
        setData(prev => ({ ...prev, ...res.data }));
        toast.success("ব্যানবেইস থেকে নতুন তথ্য যুক্ত হয়েছে।");
    } catch (err) {
        toast.error("ব্যানবেইস থেকে অটোমেটিক তথ্য পাওয়া যায়নি।");
    } finally {
        setFetching(false);
    }
  };

  const handleChange = (field, value) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      // Exclude calculated auto_stats when saving to avoid backend issues
      const { auto_stats, ...saveData } = data;
      const res = await api.patch(`/api/banbeis/${id}/`, saveData);
      setData(prev => ({ ...prev, ...res.data }));
      toast.success("তথ্য সংরক্ষিত হয়েছে");
    } catch (err) {
      toast.error("সেভ করতে সমস্যা হয়েছে");
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;

  // Guard against null data from 400 errors or failed loads
  if (!data || !data.auto_stats) {
      return (
          <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" color="error" gutterBottom>ব্যানবেইস তথ্য পাওয়া যায়নি</Typography>
              <Button variant="contained" onClick={handleAutoFetch} disabled={fetching}>
                  {fetching ? 'খোঁজা হচ্ছে...' : 'ব্যানবেইস থেকে তথ্য আনুন'}
              </Button>
          </Box>
      );
  }

  return (
    <Box sx={{ p: { xs: 1, md: 3 }, maxWidth: '1200px', mx: 'auto' }}>
      <Paper sx={{ p: 3, mb: 2, borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>ব্যানবেইস (BANBEIS)</Typography>
          <Typography variant="subtitle1">{schoolInfo?.name} | EIIN: {schoolInfo?.ein}</Typography>
        </Box>
        <Stack direction="row" spacing={1} className="no-print">
          <Button variant="contained" color="warning" startIcon={<DownloadIcon />} onClick={handleAutoFetch} disabled={fetching}>তথ্য আনুন</Button>
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()}>প্রিন্ট</Button>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}>সেভ</Button>
        </Stack>
      </Paper>

      <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2, bgcolor: 'background.paper', borderRadius: 1 }} className="no-print">
        {BANBEIS_TABS.map((t, i) => <Tab key={i} label={t.label} icon={t.icon} iconPosition="start" />)}
      </Tabs>

      <Box sx={{ mt: 2 }}>
        {activeTab === 0 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>প্রতিষ্ঠানের পরিচিতি</Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}><TextField label="স্থাপনের বছর" fullWidth value={data.establishment_year || ''} onChange={e => handleChange('establishment_year', e.target.value)} /></Grid>
              <Grid item xs={12} md={6}>
                <TextField select SelectProps={{ native: true }} label="ধরণ" fullWidth value={data.school_type} onChange={e => handleChange('school_type', e.target.value)}>
                  <option value="pvt">বেসরকারি</option>
                  <option value="gov">সরকারি</option>
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField select SelectProps={{ native: true }} label="লিঙ্গ ভিত্তিক ধরণ" fullWidth value={data.gender_mix} onChange={e => handleChange('gender_mix', e.target.value)}>
                  <option value="co-ed">সহশিক্ষা</option>
                  <option value="boys">বালক</option>
                  <option value="girls">বালিকা</option>
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}><TextField label="শিফট" fullWidth value={data.shifts || ''} onChange={e => handleChange('shifts', e.target.value)} /></Grid>
              <Grid item xs={12} md={6}><TextField label="ব্যবস্থাপনা" fullWidth value={data.management_type || ''} onChange={e => handleChange('management_type', e.target.value)} /></Grid>
            </Grid>
          </Paper>
        )}

        {activeTab === 1 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>শিক্ষার্থী পরিসংখ্যান (স্বয়ংক্রিয়)</Typography>
            <Divider sx={{ mb: 2 }} />
            <TableContainer>
              <Table border={1}>
                <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                  <TableRow>
                    <TableCell>শ্রেণি</TableCell>
                    <TableCell align="center">ছাত্র</TableCell>
                    <TableCell align="center">ছাত্রী</TableCell>
                    <TableCell align="center">মোট</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data.auto_stats.class_distribution || []).map((c, i) => (
                    <TableRow key={i}>
                      <TableCell>{c.classroom__name}</TableCell>
                      <TableCell align="center">{c.boys}</TableCell>
                      <TableCell align="center">{c.girls}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>{c.total}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: '#fafafa' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>সর্বমোট</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>{data.auto_stats.students?.male || 0}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>{data.auto_stats.students?.female || 0}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>{data.auto_stats.students?.total || 0}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {activeTab === 2 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>শিক্ষক-কর্মচারী (স্বয়ংক্রিয়)</Typography>
            <Divider sx={{ mb: 3 }} />
            <Grid container spacing={4} textAlign="center">
              <Grid item xs={4}><Typography variant="h3">{data.auto_stats.teachers?.total || 0}</Typography><Typography color="textSecondary">মোট শিক্ষক</Typography></Grid>
              <Grid item xs={4}><Typography variant="h3" color="primary">{data.auto_stats.teachers?.male || 0}</Typography><Typography color="textSecondary">পুরুষ</Typography></Grid>
              <Grid item xs={4}><Typography variant="h3" color="secondary">{data.auto_stats.teachers?.female || 0}</Typography><Typography color="textSecondary">নারী</Typography></Grid>
            </Grid>
          </Paper>
        )}

        {activeTab === 3 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>অবকাঠামো</Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}><TextField type="number" label="মোট জমি (শতাংশ)" fullWidth value={data.total_land_area || 0} onChange={e => handleChange('total_land_area', e.target.value)} /></Grid>
              <Grid item xs={12} md={4}><TextField type="number" label="শ্রেণিকক্ষ সংখ্যা" fullWidth value={data.total_classrooms || 0} onChange={e => handleChange('total_classrooms', e.target.value)} /></Grid>
              <Grid item xs={12} md={4}><TextField type="number" label="টয়লেট সংখ্যা" fullWidth value={data.toilets_count || 0} onChange={e => handleChange('toilets_count', e.target.value)} /></Grid>
              {[
                { key: 'has_safe_water', label: 'নিরাপদ পানি' },
                { key: 'has_electricity', label: 'বিদ্যুৎ' },
                { key: 'has_internet', label: 'ইন্টারনেট' },
                { key: 'has_library', label: 'লাইব্রেরি' },
                { key: 'has_playground', label: 'খেলার মাঠ' },
                { key: 'has_multimedia_classroom', label: 'মাল্টিমিডিয়া' },
              ].map(item => (
                <Grid item xs={6} md={4} key={item.key}>
                  <FormControlLabel control={<Switch checked={!!data[item.key]} onChange={e => handleChange(item.key, e.target.checked)} />} label={item.label} />
                </Grid>
              ))}
            </Grid>
          </Paper>
        )}

        {activeTab === 4 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>অর্থ ও সুবিধা</Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={3}>
              {[
                { key: 'mid_day_meal', label: 'মিড-ডে মিল' },
                { key: 'has_ramp_for_disabled', label: 'প্রতিবন্ধী র‍্যাম্প' },
                { key: 'has_boundary_wall', label: 'সীমানা প্রাচীর' },
              ].map(item => (
                <Grid item xs={12} md={4} key={item.key}>
                  <FormControlLabel
                    control={<Switch checked={!!data[item.key]} onChange={e => handleChange(item.key, e.target.checked)} />}
                    label={item.label}
                  />
                </Grid>
              ))}
              <Grid item xs={12} md={6}>
                <TextField
                  label="ভবনের অবস্থা"
                  fullWidth
                  value={data.building_condition || ''}
                  onChange={e => handleChange('building_condition', e.target.value)}
                />
              </Grid>
            </Grid>
          </Paper>
        )}

        {activeTab === 5 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>ভৌগোলিক অবস্থান</Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}><TextField label="অক্ষাংশ (Latitude)" fullWidth value={data.latitude || ''} onChange={e => handleChange('latitude', e.target.value)} /></Grid>
              <Grid item xs={12} md={6}><TextField label="দ্রাঘিমাংশ (Longitude)" fullWidth value={data.longitude || ''} onChange={e => handleChange('longitude', e.target.value)} /></Grid>
              {data.latitude && data.longitude && (
                <Grid item xs={12}>
                  <Box sx={{ width: '100%', height: '400px', borderRadius: 2, overflow: 'hidden', border: '1px solid #ddd' }}>
                    <iframe title="Map" width="100%" height="100%" frameBorder="0" src={`https://maps.google.com/maps?q=${data.latitude},${data.longitude}&z=15&output=embed`}></iframe>
                  </Box>
                </Grid>
              )}
            </Grid>
          </Paper>
        )}
      </Box>

      <style>
        {`
          @media print {
            .no-print, header, footer, nav, aside, .MuiAppBar-root, .MuiDrawer-root, .MuiTabs-root {
                display: none !important;
            }
            body { background: white !important; }
            .MuiPaper-root { box-shadow: none !important; border: 1px solid #eee; }
          }
        `}
      </style>
    </Box>
  );
}
