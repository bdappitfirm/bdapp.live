import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Typography, Paper, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Grid, Alert, Card, CardContent, Divider, FormControl, InputLabel, Select, MenuItem,
  Checkbox, ListItemText, OutlinedInput, Chip, FormControlLabel
} from '@mui/material';

import api from '../utils/api';
import { normalizeNumberInput } from '../utils/helpers';

const SeatAllocationPage = () => {
  const { id: schoolId } = useParams();
  const [loading, setLoading] = useState(false);
  const [exams, setExams] = useState([]);
  const [school, setSchool] = useState(null);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedBuildings, setSelectedBuildings] = useState([]);
  const [buildingRooms, setBuildingRooms] = useState({}); // { 1: 5, 2: 3, ... }
  const [roomBenches, setRoomBenches] = useState({}); // { "1-1": 10, "1-2": 15, ... }
  const [seatPlans, setSeatPlans] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');

  // Available buildings (dynamically generated from school settings)
  const availableBuildings = school?.number_of_buildings 
    ? Array.from({ length: school.number_of_buildings }, (_, i) => i + 1) 
    : [1, 2, 3, 4, 5];
  // Bench options
  const benchOptions = [5, 10, 15, 20, 25, 30, 35, 40, 50];

  // Fetch exams and school data when component mounts
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch school data
        const schoolResponse = await api.get(`/api/schools/${schoolId}/`);
        setSchool(schoolResponse.data);
        
        // Fetch exams
        const response = await api.get(`/api/results/examinations/?school=${schoolId}`);
        const allExams = response.data.results || response.data || [];
        
        // Filter for half-yearly (অর্ধ-বার্ষিক) and yearly (বার্ষিক) exams
        const targetExams = allExams.filter(exam => {
          const name = (exam.name || '').toLowerCase();
          return name.includes('অর্ধ') || name.includes('বার্ষিক') || name.includes('half') || name.includes('yearly') || name.includes('annual');
        });
        
        // Sort by most recent first
        targetExams.sort((a, b) => {
          const dateA = a.start_date ? new Date(a.start_date) : new Date(0);
          const dateB = b.start_date ? new Date(b.start_date) : new Date(0);
          return dateB - dateA;
        });
        
        setExams(targetExams);
        
        // Auto-select first (most recent) exam
        if (targetExams.length > 0) {
          setSelectedExam(targetExams[0].id);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setMessage('তথ্য লোড করতে সমস্যা হয়েছে!');
        setMessageType('error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [schoolId]);

  // Handle building selection change
  const handleBuildingChange = (event) => {
    const { target: { value } } = event;
    setSelectedBuildings(typeof value === 'string' ? value.split(',').map(Number) : value);
  };

  // Handle per-building room count
  const handleRoomCountChange = (buildingNum, count) => {
    setBuildingRooms(prev => ({ ...prev, [buildingNum]: parseInt(count) }));
  };

  // Handle per-room bench count
  const handleBenchCountChange = (buildingNum, roomNum, count) => {
    const key = `${buildingNum}-${roomNum}`;
    setRoomBenches(prev => ({ ...prev, [key]: parseInt(count) }));
  };

  // Format buildings data for API
  const prepareBuildingData = () => {
    const buildings = [];
    selectedBuildings.forEach(buildingNum => {
      const numRooms = buildingRooms[buildingNum] || 1;
      const rooms = [];
      for (let roomNum = 1; roomNum <= numRooms; roomNum++) {
        const key = `${buildingNum}-${roomNum}`;
        rooms.push({
          room_number: roomNum,
          bench_count: roomBenches[key] || 10
        });
      }
      buildings.push({
        building_number: buildingNum,
        rooms: rooms
      });
    });
    return buildings;
  };

  // Generate seat plan
  const handleGenerateSeatPlan = async () => {
    if (!selectedExam) {
      setMessage('দয়া করে একটি পরীক্ষা নির্বাচন করুন!');
      setMessageType('warning');
      return;
    }

    if (selectedBuildings.length === 0) {
      setMessage('দয়া করে কমপক্ষে একটি ভবন নির্বাচন করুন!');
      setMessageType('warning');
      return;
    }

    setLoading(true);
    try {
      const buildingData = prepareBuildingData();
      const response = await api.post('/api/academics/generate-seat-plan/', {
        examination_id: selectedExam,
        school_id: schoolId,
        buildings: buildingData
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

        {/* Generate Seat Plan Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                সিট প্ল্যান তৈরি করুন
              </Typography>
              
              <TextField
                select
                label="পরীক্ষা নির্বাচন করুন"
                value={selectedExam}
                onChange={(e) => setSelectedExam(e.target.value)}
                fullWidth
                margin="normal"
                SelectProps={{ native: true }}
              >
                <option value="">নির্বাচন করুন</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name}
                  </option>
                ))}
              </TextField>

              <FormControl fullWidth margin="normal">
                <InputLabel>ভবন নির্বাচন করুন</InputLabel>
                <Select
                  multiple
                  value={selectedBuildings}
                  onChange={handleBuildingChange}
                  input={<OutlinedInput label="ভবন নির্বাচন করুন" />}
                  renderValue={(selected) => selected.map(b => `ভবন-${b}`).join(', ')}
                >
                  {availableBuildings.map((b) => (
                    <MenuItem key={b} value={b}>
                      <Checkbox checked={selectedBuildings.indexOf(b) > -1} />
                      <ListItemText primary={`ভবন-${b}`} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Per-building room count */}
              {selectedBuildings.map(buildingNum => (
                <Box key={buildingNum} sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    ভবন-{buildingNum} এর রুম সংখ্যা
                  </Typography>
                  <TextField
                    select
                    fullWidth
                    value={buildingRooms[buildingNum] || 1}
                    onChange={(e) => handleRoomCountChange(buildingNum, e.target.value)}
                    SelectProps={{ native: true }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </TextField>

                  {/* Per-room bench count */}
                  {Array.from({ length: buildingRooms[buildingNum] || 1}, (_, i) => i + 1).map(roomNum => (
                    <Box key={`bench-${buildingNum}-${roomNum}`} sx={{ mt: 1, ml: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      ভবন-{buildingNum} - রুম {roomNum} এর বেঞ্চ সংখ্যা
                    </Typography>
                    <TextField
                      select
                      fullWidth
                      value={roomBenches[`${buildingNum}-${roomNum}`] || 10}
                      onChange={(e) => handleBenchCountChange(buildingNum, roomNum, e.target.value)}
                      SelectProps={{ native: true }}
                    >
                      {benchOptions.map(num => (
                        <option key={num} value={num}>{num}</option>
                      ))}
                    </TextField>
                  </Box>
                  ))}
                </Box>
              ))}

              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleGenerateSeatPlan}
                disabled={loading || !selectedExam || selectedBuildings.length === 0}
                fullWidth
                sx={{ mt: 3 }}
              >
                {loading ? <CircularProgress size={24} /> : 'সিট প্ল্যান তৈরি করুন'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Seat Plan Display */}
      {seatPlans.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="h5" gutterBottom>
            তৈরি করা সিট প্ল্যান
          </Typography>
          <Grid container spacing={2}>
            {/* Morning Column */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', pb: 1 }}>
                  সকাল
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>নাম</TableCell>
                        <TableCell>ক্লাস</TableCell>
                        <TableCell>রোল</TableCell>
                        <TableCell>Gender</TableCell>
                        <TableCell>বেঞ্চ/সিট</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {seatPlans.filter(p => p.session === 'morning').map(plan => (
                        <TableRow key={plan.id}>
                          <TableCell>{plan.student?.user?.first_name} {plan.student?.user?.last_name}</TableCell>
                          <TableCell>{plan.student?.classroom?.name}</TableCell>
                          <TableCell>{normalizeNumberInput(plan.student?.roll_number)}</TableCell>
                          <TableCell>{plan.student?.gender || 'N/A'}</TableCell>
                          <TableCell>{plan.room?.name} / {plan.seat_number}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
            {/* Afternoon Column */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', pb: 1 }}>
                  বিকাল
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>নাম</TableCell>
                        <TableCell>ক্লাস</TableCell>
                        <TableCell>রোল</TableCell>
                        <TableCell>Gender</TableCell>
                        <TableCell>বেঞ্চ/সিট</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {seatPlans.filter(p => p.session === 'afternoon').map(plan => (
                        <TableRow key={plan.id}>
                          <TableCell>{plan.student?.user?.first_name} {plan.student?.user?.last_name}</TableCell>
                          <TableCell>{plan.student?.classroom?.name}</TableCell>
                          <TableCell>{normalizeNumberInput(plan.student?.roll_number)}</TableCell>
                          <TableCell>{plan.student?.gender || 'N/A'}</TableCell>
                          <TableCell>{plan.room?.name} / {plan.seat_number}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>
          
          {/* Principal Signature */}
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
            <Paper sx={{ p: 3, minWidth: 200 }}>
              <Divider sx={{ mb: 1 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                প্রধান শিক্ষকের সিল ও স্বাক্ষর
              </Typography>
            </Paper>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default SeatAllocationPage;
