import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Typography, Paper, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Grid, Alert, Card, CardContent, Divider, FormControl, InputLabel, Select, MenuItem,
  Checkbox, ListItemText, OutlinedInput, Chip, FormControlLabel, Stack, Avatar
} from '@mui/material';

import api from '../utils/api';
import { normalizeNumberInput } from '../utils/helpers';
import { getMediaUrl, resolveSchoolLogo } from '../utils/media';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const SeatAllocationPage = () => {
  const { id: schoolId } = useParams();
  const [loading, setLoading] = useState(false);
  const [exams, setExams] = useState([]);
  const [school, setSchool] = useState(null);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedBuildings, setSelectedBuildings] = useState([]);
  const [buildingRooms, setBuildingRooms] = useState({});
  const [roomBenches, setRoomBenches] = useState({});
  const [seatPlans, setSeatPlans] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');

  const benchOptions = [5, 10, 15, 20, 25, 30, 35, 40, 50];
  const DEFAULT_BENCH_COUNT = 15;

  const availableBuildings = school?.number_of_buildings 
    ? Array.from({ length: school.number_of_buildings }, (_, i) => i + 1) 
    : [1, 2, 3, 4, 5];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const schoolResponse = await api.get(`/api/schools/${schoolId}/`);
        setSchool(schoolResponse.data);
        
        try {
          const buildingsRes = await api.get(`/api/academics/buildings/?school=${schoolId}`);
          const buildingsData = buildingsRes.data || [];
          if (buildingsData.length > 0) {
            const bNums = []; const bRooms = {}; const rBenches = {};
            for (const b of buildingsData) {
              const match = b.name.match(/\d+/);
              const bNum = match ? parseInt(match[0]) : null;
              if (bNum) {
                bNums.push(bNum);
                const roomsRes = await api.get(`/api/academics/rooms/?building=${b.id}`);
                const roomsData = roomsRes.data || [];
                bRooms[bNum] = roomsData.length;
                roomsData.forEach((room, idx) => {
                  rBenches[`${bNum}-${idx + 1}`] = Math.ceil(room.capacity / 3) || DEFAULT_BENCH_COUNT;
                });
              }
            }
            setSelectedBuildings(bNums);
            setBuildingRooms(bRooms);
            setRoomBenches(rBenches);
          }
        } catch (_) {}

        const response = await api.get(`/api/results/examinations/?school=${schoolId}`);
        const allExams = response.data.results || response.data || [];
        const targetExams = allExams.filter(exam => {
          const name = (exam.name || '').toLowerCase();
          return name.includes('অর্ধ') || name.includes('বার্ষিক') || name.includes('half') || name.includes('yearly');
        });
        setExams(targetExams);
        if (targetExams.length > 0) setSelectedExam(targetExams[0].id);
      } catch (error) {
        setMessage('তথ্য লোড করতে সমস্যা হয়েছে!');
        setMessageType('error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [schoolId]);

  const handleBuildingChange = (event) => {
    const { target: { value } } = event;
    setSelectedBuildings(typeof value === 'string' ? value.split(',').map(Number) : value);
  };

  const handleRoomCountChange = (buildingNum, count) => {
    setBuildingRooms(prev => ({ ...prev, [buildingNum]: parseInt(count) || 1 }));
  };

  const handleBenchCountChange = (buildingNum, roomNum, count) => {
    setRoomBenches(prev => ({ ...prev, [`${buildingNum}-${roomNum}`]: parseInt(count) }));
  };

  const prepareBuildingData = () => {
    const buildings = [];
    selectedBuildings.forEach(bNum => {
      const numRooms = buildingRooms[bNum] || 1;
      const rooms = [];
      for (let rNum = 1; rNum <= numRooms; rNum++) {
        rooms.push({ room_number: rNum, bench_count: roomBenches[`${bNum}-${rNum}`] || DEFAULT_BENCH_COUNT });
      }
      buildings.push({ building_number: bNum, rooms });
    });
    return buildings;
  };

  const handleGenerateSeatPlan = async () => {
    if (!selectedExam || selectedBuildings.length === 0) {
      setMessage('পরীক্ষা এবং ভবন নির্বাচন করুন!');
      setMessageType('warning');
      return;
    }
    setLoading(true);
    try {
      const response = await api.post('/api/academics/generate-seat-plan/', {
        examination_id: selectedExam,
        school_id: schoolId,
        buildings: prepareBuildingData()
      });
      setSeatPlans(response.data.seat_plans || []);
      setMessage('সিট প্ল্যান সফলভাবে তৈরি হয়েছে!');
      setMessageType('success');
    } catch (error) {
      setMessage('সিট প্ল্যান তৈরি করতে সমস্যা হয়েছে!');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    document.body.classList.remove('printing-stickers');
    window.print();
  };

  const handlePrintStickers = () => {
    document.body.classList.add('printing-stickers');
    window.print();
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('printable-area');
    if (!element) return;
    setLoading(true);
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`SeatPlan-${school?.name || 'School'}.pdf`);
    } catch (error) {
      console.error(error);
      setMessage('PDF তৈরি ব্যর্থ হয়েছে!');
    } finally {
      setLoading(false);
    }
  };

  const BenchSticker = ({ plan }) => {
    const s = plan.student || {};
    const u = s.user || {};
    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
    const photo = getMediaUrl(u.photo_url || u.photo || s.photo);

    return (
      <Box sx={{
        width: '65mm',
        height: '64mm',
        border: '1.5px solid #1a237e',
        borderRadius: '8px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'white',
        position: 'relative',
        breakInside: 'avoid',
        overflow: 'hidden'
      }}>
        {/* Header - No School Name */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, borderBottom: '1px solid #eee', pb: 0.5 }}>
          <img src={schoolLogo} alt="L" style={{ width: 35, height: 35, objectFit: 'contain' }} />
          <Box sx={{ textAlign: 'center', flex: 1 }}>
             <Typography sx={{ fontSize: '10px', fontWeight: 'bold', color: '#000' }}>{examName}</Typography>
          </Box>
          <Avatar src={photo} variant="rounded" sx={{ width: 38, height: 45, border: '1px solid #ddd' }} />
        </Box>

        {/* Student Info */}
        <Box sx={{ textAlign: 'center', py: 0.3 }}>
          <Typography sx={{ fontSize: '13px', fontWeight: 'bold', color: '#000', lineHeight: 1.1 }}>{name}</Typography>
          <Typography sx={{ fontSize: '11px', color: '#000' }}>শ্রেণি: {s.classroom?.name}</Typography>
          <Typography sx={{ fontSize: '11px', color: '#000' }}>রোল: {normalizeNumberInput(s.roll_number)} | সেকশন: {s.section?.name || 'N/A'}</Typography>
        </Box>

        {/* Location Info - Full Width & Black Text */}
        <Box sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          textAlign: 'center',
          bgcolor: '#f5f5f5',
          color: '#000',
          border: '1.5px solid #000',
          borderRadius: '4px',
          mt: 0.5,
          p: 1
        }}>
          <Typography sx={{ fontSize: '15px', fontWeight: 'bold' }}>
            রুম: {plan.room?.name}
          </Typography>
          <Typography sx={{ fontSize: '18px', fontWeight: '900' }}>
            বেঞ্চ: {Math.floor((parseInt(plan.seat_number) - 1) / 3) + 1}
          </Typography>
        </Box>
      </Box>
    );
  };

  const examName = exams.find(e => String(e.id) === String(selectedExam))?.name || 'সিট প্ল্যান';
  const schoolLogo = resolveSchoolLogo(school);
  const principalSig = getMediaUrl(school?.principal_signature);
  const schoolSeal = getMediaUrl(school?.school_seal);

  const SeatPlanTable = ({ session }) => {
    const plans = seatPlans.filter(p => p.session === session);
    if (plans.length === 0) return null;

    return (
      <Box sx={{ mb: 6, pageBreakAfter: 'always' }} className="door-list-section">
        {/* Header inside table area for print consistency */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, mb: 2, borderBottom: '2px solid #1a237e', pb: 1 }}>
          {schoolLogo && <img src={schoolLogo} alt="Logo" style={{ width: 80, height: 80, objectFit: 'contain' }} />}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1a237e' }}>{school?.bn_name || school?.name}</Typography>
            <Typography variant="body2">{school?.address}</Typography>
            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', bgcolor: '#1a237e', color: 'white', px: 3, py: 0.5, borderRadius: 5, minWidth: 500 }}>
              <Typography sx={{ fontWeight: 'bold' }}>{session === 'morning' ? 'সকাল' : 'বিকাল'} - সিট প্ল্যান ({examName})</Typography>
              <Typography sx={{ fontWeight: 'bold' }}>তারিখঃ ২৮/০৬/২০২৬</Typography>
            </Box>
          </Box>
        </Box>

        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #000' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f2f2f2' }}>
                <TableCell sx={{ border: '1px solid #000', fontWeight: 'bold' }}>নাম</TableCell>
                <TableCell sx={{ border: '1px solid #000', fontWeight: 'bold' }}>ক্লাস</TableCell>
                <TableCell sx={{ border: '1px solid #000', fontWeight: 'bold' }}>রোল</TableCell>
                <TableCell sx={{ border: '1px solid #000', fontWeight: 'bold' }}>Gender</TableCell>
                <TableCell sx={{ border: '1px solid #000', fontWeight: 'bold' }}>অবস্থান</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {plans.map(p => {
                const bMatch = (p.room?.building?.name || '').match(/\d+/);
                const bNum = bMatch ? bMatch[0] : '1';
                const benchNum = Math.floor((parseInt(p.seat_number) - 1) / 3) + 1;
                return (
                  <TableRow key={p.id}>
                    <TableCell sx={{ border: '1px solid #ddd' }}>{p.student?.user?.first_name} {p.student?.user?.last_name}</TableCell>
                    <TableCell sx={{ border: '1px solid #ddd' }}>{p.student?.classroom?.name}</TableCell>
                    <TableCell sx={{ border: '1px solid #ddd' }}>{normalizeNumberInput(p.student?.roll_number)}</TableCell>
                    <TableCell sx={{ border: '1px solid #ddd' }}>{p.student?.gender || 'N/A'}</TableCell>
                    <TableCell sx={{ border: '1px solid #ddd' }}>ভবন = {bNum}, রুম = {p.room?.name}, বেঞ্চ-{benchNum}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
          <Box sx={{ textAlign: 'center', position: 'relative', minWidth: 200 }}>
            {schoolSeal && <img src={schoolSeal} alt="Seal" style={{ position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)', width: 80, opacity: 0.5 }} />}
            {principalSig && <img src={principalSig} alt="Sig" style={{ height: 50, position: 'relative', zIndex: 1 }} />}
            <Typography sx={{ borderTop: '1px solid #000', pt: 0.5, fontWeight: 'bold', fontSize: '14px' }}>প্রধান শিক্ষকের স্বাক্ষর</Typography>
          </Box>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <style>{`
        @media print {
          @page {
            margin: 0;
            size: A4;
          }
          body * { visibility: hidden; }
          #printable-area, #printable-area * { visibility: visible; }
          #printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 10mm 5mm;
            box-sizing: border-box;
          }
          .no-print { display: none !important; }

          /* Show/Hide based on which button was clicked */
          body.printing-stickers .door-list-only { display: none !important; }
          body:not(.printing-stickers) .stickers-only { display: none !important; }
          body.printing-stickers .stickers-only {
            display: grid !important;
            grid-template-columns: 65mm 65mm 65mm !important;
            column-gap: 2mm !important;
            row-gap: 2mm !important;
            width: 100% !important;
            justify-content: center !important;
          }
        }
      `}</style>

      <Typography variant="h4" className="no-print" gutterBottom sx={{ fontWeight: 'bold' }}>সিট বন্টন</Typography>

      {message && <Alert severity={messageType} className="no-print" sx={{ mb: 3 }}>{message}</Alert>}

      <Grid container spacing={3} className="no-print">
        <Grid item xs={12} md={6}>
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h6" gutterBottom>সিট প্ল্যান তৈরি করুন</Typography>
              <TextField select label="পরীক্ষা নির্বাচন করুন" value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)} fullWidth margin="normal" SelectProps={{ native: true }}>
                <option value="">নির্বাচন করুন</option>
                {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}
              </TextField>

              <FormControl fullWidth margin="normal">
                <InputLabel>ভবন নির্বাচন করুন</InputLabel>
                <Select multiple value={selectedBuildings} onChange={handleBuildingChange} input={<OutlinedInput label="ভবন নির্বাচন করুন" />} renderValue={(s) => s.map(b => `ভবন-${b}`).join(', ')}>
                  {availableBuildings.map((b) => (
                    <MenuItem key={b} value={b}>
                      <Checkbox checked={selectedBuildings.indexOf(b) > -1} />
                      <ListItemText primary={`ভবন-${b}`} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selectedBuildings.map(bNum => (
                <Box key={bNum} sx={{ mt: 2, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography variant="subtitle2" color="primary">ভবন-{bNum} রুম ও বেঞ্চ সংখ্যা</Typography>
                  <TextField size="small" select label="রুম সংখ্যা" value={buildingRooms[bNum] || 1} onChange={(e) => handleRoomCountChange(bNum, e.target.value)} fullWidth sx={{ my: 1 }} SelectProps={{ native: true }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 25, 30].map(n => <option key={n} value={n}>{n}</option>)}
                  </TextField>
                  <Grid container spacing={1}>
                    {Array.from({ length: buildingRooms[bNum] || 1 }, (_, i) => i + 1).map(rNum => (
                      <Grid item xs={6} key={rNum}>
                        <TextField size="small" select label={`বেঞ্চ সংখ্যা (রুম ${rNum})`} value={roomBenches[`${bNum}-${rNum}`] || DEFAULT_BENCH_COUNT} onChange={(e) => handleBenchCountChange(bNum, rNum, e.target.value)} fullWidth SelectProps={{ native: true }}>
                          {benchOptions.map(n => <option key={n} value={n}>{n}</option>)}
                        </TextField>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              ))}

              <Button variant="contained" onClick={handleGenerateSeatPlan} disabled={loading || !selectedExam} fullWidth sx={{ mt: 3, height: 50 }}>
                {loading ? <CircularProgress size={24} /> : 'সিট প্ল্যান তৈরি করুন'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {seatPlans.length > 0 && (
        <Box sx={{ mt: 5 }}>
          <Stack direction="row" spacing={2} sx={{ mb: 3 }} className="no-print">
            <Button variant="contained" color="secondary" startIcon={<PrintIcon />} onClick={handlePrint}>হল রুম ভিত্তিক শিক্ষার্থী তালিকা</Button>
            <Button variant="contained" color="success" startIcon={<PrintIcon />} onClick={handlePrintStickers}>বেঞ্চ ভিত্তিক স্টুডেন্ট তালিকা</Button>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleDownloadPDF}>ডাউনলোড PDF</Button>
          </Stack>

          <Box id="printable-area">
            <Box className="door-list-only">
              <SeatPlanTable session="morning" />
              <SeatPlanTable session="afternoon" />
            </Box>

            <Box className="stickers-only" sx={{ display: 'none', '@media print': { display: 'flex' }, flexWrap: 'wrap', gap: '2%', bgcolor: 'white' }}>
              {seatPlans.map(plan => (
                <BenchSticker key={plan.id} plan={plan} />
              ))}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default SeatAllocationPage;
