import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Stack,
  Divider,
  Avatar,
  Card,
  CardContent,
  Alert,
  CircularProgress
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import api from '../utils/api';
import { useToast } from '../components/Toast';

export default function SchoolSettings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [school, setSchool] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    ein: '',
    email: '',
    phone_number: '',
    address: '',
    principal_name: '',
    number_of_buildings: 1
  });

  const [buildingRooms, setBuildingRooms] = useState({}); // { 1: 5, 2: 10 }

  const [logo, setLogo] = useState(null);
  const [signature, setSignature] = useState(null);
  const [seal, setSeal] = useState(null);

  useEffect(() => {
    fetchSchoolData();
    fetchBuildingData();
  }, [id]);

  const fetchBuildingData = async () => {
    try {
      const res = await api.get(`/api/academics/buildings/?school=${id}`);
      const buildings = res.data || [];
      const roomCounts = {};

      for (const b of buildings) {
        // Extract number from name "ভবন-1" -> 1
        const match = b.name.match(/\d+/);
        const bNum = match ? parseInt(match[0]) : null;
        if (bNum) {
          // Fetch rooms for this building to get count
          const roomsRes = await api.get(`/api/academics/rooms/?building=${b.id}`);
          roomCounts[bNum] = roomsRes.data.length || 0;
        }
      }
      setBuildingRooms(roomCounts);
    } catch (_) {}
  };

  const fetchSchoolData = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/schools/${id}/`);
      setSchool(res.data);
      setFormData({
        name: res.data.name || '',
        ein: res.data.ein || '',
        email: res.data.email || '',
        phone_number: res.data.phone_number || '',
        address: res.data.address || '',
        principal_name: res.data.principal_name || '',
        number_of_buildings: res.data.number_of_buildings || 1
      });
    } catch (err) {
      console.error('Failed to fetch school data:', err);
      toast.error('স্কুলের তথ্য লোড করতে ব্যর্থ হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'number_of_buildings') {
      const count = parseInt(value) || 1;
      setFormData({ ...formData, number_of_buildings: count });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleRoomCountChange = (bNum, count) => {
    setBuildingRooms({ ...buildingRooms, [bNum]: parseInt(count) || 0 });
  };

  const handleFileChange = (e, setter) => {
    if (e.target.files && e.target.files[0]) {
      setter(e.target.files[0]);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const fd = new FormData();
      
      // Append text fields
      Object.keys(formData).forEach(key => {
        fd.append(key, formData[key]);
      });
      
      // Append files if selected
      if (logo) fd.append('logo', logo);
      if (signature) fd.append('principal_signature', signature);
      if (seal) fd.append('school_seal', seal);

      await api.patch(`/api/schools/${id}/`, fd, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Prepare building/room data for bulk setup
      const buildingsPayload = [];
      for (let i = 1; i <= formData.number_of_buildings; i++) {
        const numRooms = buildingRooms[i] || 0;
        const rooms = [];
        for (let j = 1; j <= numRooms; j++) {
          rooms.push({ room_number: j, bench_count: 10 }); // Default 10 benches
        }
        buildingsPayload.push({
          building_number: i,
          rooms: rooms
        });
      }

      await api.post('/api/academics/buildings/bulk-setup/', {
        school_id: id,
        buildings: buildingsPayload
      });
      
      toast.success('স্কুলের তথ্য ও ভবন/রুম কনফিগারেশন আপডেট হয়েছে');
      fetchSchoolData();
      fetchBuildingData();
    } catch (err) {
      console.error('Failed to update school:', err);
      toast.error('আপডেট ব্যর্থ হয়েছে। দয়া করে আবার চেষ্টা করুন।');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
        School Settings (স্কুল এডিট)
      </Typography>

      <Grid container spacing={3}>
        {/* Basic Information */}
        <Grid item xs={12} md={8}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>সাধারণ তথ্য</Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Stack spacing={3}>
              <TextField
                label="স্কুলের নাম"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                fullWidth
                required
              />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="EIIN (ইন নাম্বার)"
                    name="ein"
                    value={formData.ein}
                    onChange={handleInputChange}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="ইমেইল"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    fullWidth
                  />
                </Grid>
              </Grid>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="মোবাইল নম্বর"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleInputChange}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="প্রধান শিক্ষকের নাম"
                    name="principal_name"
                    value={formData.principal_name}
                    onChange={handleInputChange}
                    fullWidth
                  />
                </Grid>
              </Grid>
              <TextField
                label="ঠিকানা"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                fullWidth
                multiline
                rows={2}
              />
              <TextField
                label="ভবন সংখ্যা (Number of Buildings)"
                name="number_of_buildings"
                type="number"
                value={formData.number_of_buildings}
                onChange={handleInputChange}
                fullWidth
                inputProps={{ min: 1, max: 10 }}
              />

              {/* Dynamic Building-Room Inputs */}
              {Array.from({ length: formData.number_of_buildings }, (_, i) => i + 1).map(bNum => (
                <Box key={bNum} sx={{ p: 2, border: '1px solid #eee', borderRadius: 1, bgcolor: '#fcfcfc' }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: 'primary.main' }}>
                    ভবন - {bNum} কনফিগারেশন
                  </Typography>
                  <TextField
                    label={`ভবন - ${bNum} এ রুমের সংখ্যা`}
                    type="number"
                    value={buildingRooms[bNum] || ''}
                    onChange={(e) => handleRoomCountChange(bNum, e.target.value)}
                    fullWidth
                    size="small"
                    placeholder="রুমের সংখ্যা লিখুন (যেমন: ১০)"
                  />
                </Box>
              ))}
            </Stack>
          </Paper>
        </Grid>

        {/* Media / Images */}
        <Grid item xs={12} md={4}>
          <Stack spacing={3}>
            {/* Logo */}
            <Card elevation={3} sx={{ borderRadius: 2 }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>স্কুল লোগো</Typography>
                <Avatar
                  src={logo ? URL.createObjectURL(logo) : school?.logo}
                  sx={{ width: 100, height: 100, mx: 'auto', mb: 2, border: '1px solid #ddd' }}
                  variant="rounded"
                />
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoCamera />}
                  size="small"
                >
                  Upload Logo
                  <input type="file" hidden accept="image/*" onChange={(e) => handleFileChange(e, setLogo)} />
                </Button>
              </CardContent>
            </Card>

            {/* Principal Signature */}
            <Card elevation={3} sx={{ borderRadius: 2 }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>প্রধান শিক্ষকের স্বাক্ষর</Typography>
                <Box sx={{ 
                  height: 60, 
                  width: '100%', 
                  border: '1px dashed #ccc', 
                  mb: 2, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  bgcolor: '#fafafa'
                }}>
                  {(signature || school?.principal_signature) ? (
                    <img 
                      src={signature ? URL.createObjectURL(signature) : school?.principal_signature} 
                      alt="Signature" 
                      style={{ maxHeight: '100%', maxWidth: '100%' }} 
                    />
                  ) : (
                    <Typography variant="caption" color="text.secondary">No Signature Uploaded</Typography>
                  )}
                </Box>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoCamera />}
                  size="small"
                >
                  Upload Signature
                  <input type="file" hidden accept="image/*" onChange={(e) => handleFileChange(e, setSignature)} />
                </Button>
              </CardContent>
            </Card>

            {/* School Seal */}
            <Card elevation={3} sx={{ borderRadius: 2 }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>স্কুল সিল (Seal)</Typography>
                <Avatar
                  src={seal ? URL.createObjectURL(seal) : school?.school_seal}
                  sx={{ width: 80, height: 80, mx: 'auto', mb: 2, border: '1px solid #ddd' }}
                />
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoCamera />}
                  size="small"
                >
                  Upload Seal
                  <input type="file" hidden accept="image/*" onChange={(e) => handleFileChange(e, setSeal)} />
                </Button>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* Action Button */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', bgcolor: 'transparent' }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving}
              sx={{ px: 5, borderRadius: 2 }}
            >
              {saving ? 'Saving...' : 'তথ্য সেভ করুন'}
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
