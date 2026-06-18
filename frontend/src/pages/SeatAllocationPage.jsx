import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Typography, Paper, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Grid, Alert, Card, CardContent, Divider
} from '@mui/material';

import api from '../utils/api';

const SeatAllocationPage = () => {
  const { id: schoolId } = useParams();
  const [loading, setLoading] = useState(false);
  const [examSlots, setExamSlots] = useState([]);
  const [selectedExamSlot, setSelectedExamSlot] = useState('');
  const [numBuildings, setNumBuildings] = useState(1);
  const [numRoomsPerBuilding, setNumRoomsPerBuilding] = useState(5);
  const [roomCapacity, setRoomCapacity] = useState(40);
  const [seatPlans, setSeatPlans] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');

  // Fetch exam slots when component mounts
  useEffect(() => {
    const fetchExamSlots = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/api/results/exam-slots/?school=${schoolId}`);
        setExamSlots(response.data.results || response.data || []);
      } catch (error) {
        console.error('Error fetching exam slots:', error);
        setMessage('পরীক্ষা স্লট লোড করতে সমস্যা হয়েছে!');
        setMessageType('error');
      } finally {
        setLoading(false);
      }
    };
    fetchExamSlots();
  }, [schoolId]);

  // Generate seat plan
  const handleGenerateSeatPlan = async () => {
    if (!selectedExamSlot) {
      setMessage('দয়া করে একটি পরীক্ষা স্লট নির্বাচন করুন!');
      setMessageType('warning');
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.post('/api/academics/generate-seat-plan/', {
        exam_slot_id: selectedExamSlot,
        school_id: schoolId,
        num_buildings: numBuildings,
        num_rooms_per_building: numRoomsPerBuilding,
        room_capacity: roomCapacity
      });
      setSeatPlans(response.data.seat_plans || []);
      setMessage('সিট প্ল্যান সফলভাবে তৈরি হয়েছে!');
      setMessageType('success');
    } catch (error) {
      console.error('Error generating seat plan:', error);
      setMessage('সিট প্ল্যান তৈরি করতে সমস্যা হয়েছে!');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  // Update student genders
  const handleUpdateGenders = async () => {
    setLoading(true);
    try {
      const response = await api.post('/api/academics/update-genders/', {
        school: schoolId
      });
      setMessage(`${response.data.updated_count} জন ছাত্র-ছাত্রীর লিঙ্গ আপডেট হয়েছে!`);
      setMessageType('success');
    } catch (error) {
      console.error('Error updating genders:', error);
      setMessage('লিঙ্গ আপডেট করতে সমস্যা হয়েছে!');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        সিট বন্টন
      </Typography>

      {message && (
        <Alert severity={messageType} sx={{ mb: 3 }}>
          {message}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Update Genders Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                লিঙ্গ আপডেট করুন
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                ছাত্র-ছাত্রীর নামের উপর ভিত্তি করে স্বয়ংক্রিয়ভাবে লিঙ্গ নির্ধারণ করুন।
              </Typography>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleUpdateGenders}
                disabled={loading}
                fullWidth
              >
                {loading ? <CircularProgress size={24} /> : 'লিঙ্গ আপডেট করুন'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Generate Seat Plan Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                সিট প্ল্যান তৈরি করুন
              </Typography>
              <TextField
                select
                label="পরীক্ষা স্লট নির্বাচন করুন"
                value={selectedExamSlot}
                onChange={(e) => setSelectedExamSlot(e.target.value)}
                fullWidth
                margin="normal"
                SelectProps={{ native: true }}
              >
                <option value="">নির্বাচন করুন</option>
                {examSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.examination?.name || 'Unknown Exam'} - {slot.classroom?.name || 'Unknown Class'}
                  </option>
                ))}
              </TextField>
              
              <TextField
                label="ভবন সংখ্যা"
                type="number"
                value={numBuildings}
                onChange={(e) => setNumBuildings(parseInt(e.target.value))}
                fullWidth
                margin="normal"
                inputProps={{ min: 1 }}
              />
              
              <TextField
                label="প্রতি ভবনে রুম সংখ্যা"
                type="number"
                value={numRoomsPerBuilding}
                onChange={(e) => setNumRoomsPerBuilding(parseInt(e.target.value))}
                fullWidth
                margin="normal"
                inputProps={{ min: 1 }}
              />
              
              <TextField
                label="প্রতি রুমে সিট সংখ্যা"
                type="number"
                value={roomCapacity}
                onChange={(e) => setRoomCapacity(parseInt(e.target.value))}
                fullWidth
                margin="normal"
                inputProps={{ min: 1 }}
              />
              
              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleGenerateSeatPlan}
                disabled={loading || !selectedExamSlot}
                fullWidth
                sx={{ mt: 2 }}
              >
                {loading ? <CircularProgress size={24} /> : 'সিট প্ল্যান তৈরি করুন'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Seat Plan Table */}
      {seatPlans.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="h5" gutterBottom>
            তৈরি করা সিট প্ল্যান
          </Typography>
          <TableContainer component={Paper}>
            <Table aria-label="seat plan table">
              <TableHead>
                <TableRow>
                  <TableCell>রোল নম্বর</TableCell>
                  <TableCell>ছাত্র/ছাত্রীর নাম</TableCell>
                  <TableCell>লিঙ্গ</TableCell>
                  <TableCell>ভবন</TableCell>
                  <TableCell>রুম</TableCell>
                  <TableCell>সিট নম্বর</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {seatPlans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>{plan.student?.roll_number || 'N/A'}</TableCell>
                    <TableCell>
                      {plan.student?.user?.first_name} {plan.student?.user?.last_name}
                    </TableCell>
                    <TableCell>{plan.student?.gender || 'N/A'}</TableCell>
                    <TableCell>{plan.room?.building?.name || 'N/A'}</TableCell>
                    <TableCell>{plan.room?.name || 'N/A'}</TableCell>
                    <TableCell>{plan.seat_number}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );
};

export default SeatAllocationPage;