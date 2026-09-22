import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
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
  CircularProgress
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import { transliterateBangla } from '../utils/helpers';

export default function SchoolSettings() {
  const { id } = useParams();
  const toast = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [school, setSchool] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    name_en: '',
    ein: '',
    email: '',
    phone_number: '',
    address: '',
    address_en: '',
    principal_name: '',
    principal_name_en: '',
    number_of_buildings: 1
  });

  const [buildingData, setBuildingData] = useState({}); // { 1: { count: 3, rooms: [{room_number: 1, room_name: "101"}, ...] } }

  const [logo, setLogo] = useState(null);
  const [signature, setSignature] = useState(null);
  const [seal, setSeal] = useState(null);
  const [removeSignature, setRemoveSignature] = useState(false);
  const [removeSeal, setRemoveSeal] = useState(false);

  const fetchBuildingData = useCallback(async () => {
    try {
      const res = await api.get(`/api/academics/buildings/?school=${id}`);
      const buildings = res.data || [];
      const newBuildingData = {};

      for (const b of buildings) {
        // Extract number from name "ভবন-1" -> 1
        const match = b.name.match(/\d+/);
        const bNum = match ? parseInt(match[0]) : null;
        if (bNum) {
          // Fetch rooms for this building to get count and details
          const roomsRes = await api.get(`/api/academics/rooms/?building=${b.id}&page_size=1000`);
          const roomsArr = Array.isArray(roomsRes.data)
            ? roomsRes.data
            : (Array.isArray(roomsRes.data?.results) ? roomsRes.data.results : []);

          newBuildingData[bNum] = {
            count: roomsArr.length,
            rooms: roomsArr.map((r, idx) => ({
              room_number: idx + 1,
              room_name: r.name,
              bench_count: Math.ceil(r.capacity / 3) || 10
            }))
          };
        }
      }
      setBuildingData(newBuildingData);
    } catch (_) {}
  }, [id]);

  const fetchSchoolData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/schools/${id}/`);
      setSchool(res.data);
      setFormData({
        name: res.data.name || '',
        name_en: res.data.name_en || '',
        ein: res.data.ein || '',
        email: res.data.email || '',
        phone_number: res.data.phone_number || '',
        address: res.data.address || '',
        address_en: res.data.address_en || '',
        principal_name: res.data.principal_name || '',
        principal_name_en: res.data.principal_name_en || '',
        number_of_buildings: res.data.number_of_buildings || 1
      });
    } catch (err) {
      console.error('Failed to fetch school data:', err);
      toast.error('স্কুলের তথ্য লোড করতে ব্যর্থ হয়েছে');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchSchoolData();
    fetchBuildingData();
  }, [fetchSchoolData, fetchBuildingData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'number_of_buildings') {
      const count = parseInt(value) || 1;
      setFormData({ ...formData, number_of_buildings: count });
    } else {
      let updates = { [name]: value };
      if (name === 'name') {
        updates.name_en = transliterateBangla(value);
      } else if (name === 'address') {
        updates.address_en = transliterateBangla(value);
      } else if (name === 'principal_name') {
        updates.principal_name_en = transliterateBangla(value);
      }
      setFormData(prev => ({ ...prev, ...updates }));
    }
  };

  const handleRoomCountChange = (bNum, count) => {
    setBuildingData(prev => {
      const current = prev[bNum] || { count: 0, rooms: [] };
      const newRooms = [...current.rooms];
      const targetCount = parseInt(count) || 0;
      
      if (targetCount > newRooms.length) {
        // Add new rooms
        for (let i = newRooms.length; i < targetCount; i++) {
          newRooms.push({
            room_number: i + 1,
            room_name: `${bNum * 100 + (i + 1)}`,
            bench_count: 10
          });
        }
      } else if (targetCount < newRooms.length) {
        // Remove extra rooms
        newRooms.splice(targetCount);
      }
      
      return {
        ...prev,
        [bNum]: { count: targetCount, rooms: newRooms }
      };
    });
  };

  const handleRoomNameChange = (bNum, idx, name) => {
    setBuildingData(prev => {
      const current = prev[bNum] || { count: 0, rooms: [] };
      const newRooms = [...current.rooms];
      newRooms[idx] = { ...newRooms[idx], room_name: name };
      return { ...prev, [bNum]: { ...current, rooms: newRooms } };
    });
  };

  const handleBenchCountChange = (bNum, idx, count) => {
    setBuildingData(prev => {
      const current = prev[bNum] || { count: 0, rooms: [] };
      const newRooms = [...current.rooms];
      newRooms[idx] = { ...newRooms[idx], bench_count: parseInt(count) || 10 };
      return { ...prev, [bNum]: { ...current, rooms: newRooms } };
    });
  };

  const handleFileChange = (e, setter, removeSetter) => {
    if (e.target.files && e.target.files[0]) {
      setter(e.target.files[0]);
      if (removeSetter) removeSetter(false);
    }
  };

  const handleRemoveFile = (setter, removeSetter) => {
    setter(null);
    if (removeSetter) removeSetter(true);
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

      if (signature) {
        fd.append('principal_signature', signature);
      } else if (removeSignature) {
        fd.append('principal_signature', '');
      }

      if (seal) {
        fd.append('school_seal', seal);
      } else if (removeSeal) {
        fd.append('school_seal', '');
      }

      await api.patch(`/api/schools/${id}/`, fd, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Prepare building/room data for bulk setup
      const buildingsPayload = [];
      for (let i = 1; i <= formData.number_of_buildings; i++) {
        const bData = buildingData[i] || { count: 0, rooms: [] };
        const numRooms = bData.count || 0;
        const rooms = bData.rooms.length > 0 ? bData.rooms.map(r => ({
          room_number: r.room_number,
          room_name: r.room_name,
          bench_count: r.bench_count
        })) : [];
        
        // If no data, use defaults
        if (rooms.length === 0 && numRooms > 0) {
          for (let j = 1; j <= numRooms; j++) {
            rooms.push({ 
              room_number: j, 
              room_name: `${i * 100 + j}`, 
              bench_count: 10 
            });
          }
        }
        
        buildingsPayload.push({
          building_number: i,
          rooms: rooms
        });
      }

      console.log('Sending bulk setup payload:', JSON.stringify(buildingsPayload, null, 2));
      await api.post('/api/academics/buildings/bulk-setup/', {
        school_id: id,
        buildings: buildingsPayload
      });
      
      toast.success('স্কুলের তথ্য ও ভবন/রুম কনফিগারেশন আপডেট হয়েছে');
      fetchSchoolData();
      fetchBuildingData();
    } catch (err) {
      console.error('Failed to update school:', err);
      console.error('Error response data:', err.response?.data);
      toast.error('আপডেট ব্যর্থ হয়েছে। দয়া করে আবার চেষ্টা করুন।');
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
              <TextField
                label="স্কুলের নাম (ইংরেজিতে)"
                name="name_en"
                value={formData.name_en}
                onChange={handleInputChange}
                fullWidth
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
                label="প্রধান শিক্ষকের নাম (ইংরেজিতে)"
                name="principal_name_en"
                value={formData.principal_name_en}
                onChange={handleInputChange}
                fullWidth
              />
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
                label="ঠিকানা (ইংরেজিতে)"
                name="address_en"
                value={formData.address_en}
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
                    value={buildingData[bNum]?.count || ''}
                    onChange={(e) => handleRoomCountChange(bNum, e.target.value)}
                    fullWidth
                    size="small"
                    placeholder="রুমের সংখ্যা লিখুন (যেমন: ১০)"
                    sx={{ mb: 2 }}
                  />
                  
                  {/* Room name and bench count inputs */}
                  {buildingData[bNum]?.rooms.map((room, idx) => (
                    <Box key={idx} sx={{ mb: 1, display: 'flex', gap: 1 }}>
                      <TextField
                        label={`রুম ${idx + 1} নাম`}
                        value={room.room_name}
                        onChange={(e) => handleRoomNameChange(bNum, idx, e.target.value)}
                        fullWidth
                        size="small"
                      />
                      <TextField
                        label="বেঞ্চ সংখ্যা"
                        type="number"
                        value={room.bench_count}
                        onChange={(e) => handleBenchCountChange(bNum, idx, e.target.value)}
                        size="small"
                        sx={{ width: 120 }}
                      />
                    </Box>
                  ))}
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
                  {(!removeSignature && (signature || school?.principal_signature)) ? (
                    <img 
                      src={signature ? URL.createObjectURL(signature) : school?.principal_signature} 
                      alt="Signature" 
                      style={{ maxHeight: '100%', maxWidth: '100%' }} 
                    />
                  ) : (
                    <Typography variant="caption" color="text.secondary">No Signature Uploaded</Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={1} justifyContent="center">
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<PhotoCamera />}
                    size="small"
                  >
                    Upload
                    <input type="file" hidden accept="image/*" onChange={(e) => handleFileChange(e, setSignature, setRemoveSignature)} />
                  </Button>
                  {(signature || (!removeSignature && school?.principal_signature)) && (
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={() => handleRemoveFile(setSignature, setRemoveSignature)}
                    >
                      Remove
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* School Seal */}
            <Card elevation={3} sx={{ borderRadius: 2 }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>স্কুল সিল (Seal)</Typography>
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
                  {(!removeSeal && (seal || school?.school_seal)) ? (
                    <Avatar
                      src={seal ? URL.createObjectURL(seal) : school?.school_seal}
                      sx={{ width: 80, height: 80, border: '1px solid #ddd' }}
                    />
                  ) : (
                    <Box sx={{ width: 80, height: 80, border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                      <Typography variant="caption" color="text.secondary">No Seal</Typography>
                    </Box>
                  )}
                </Box>
                <Stack direction="row" spacing={1} justifyContent="center">
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<PhotoCamera />}
                    size="small"
                  >
                    Upload
                    <input type="file" hidden accept="image/*" onChange={(e) => handleFileChange(e, setSeal, setRemoveSeal)} />
                  </Button>
                  {(seal || (!removeSeal && school?.school_seal)) && (
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={() => handleRemoveFile(setSeal, setRemoveSeal)}
                    >
                      Remove
                    </Button>
                  )}
                </Stack>
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
