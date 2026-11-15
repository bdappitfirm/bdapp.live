import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Typography, Paper, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Grid, Alert, Card, CardContent, FormControl, InputLabel, Select, MenuItem,
  Checkbox, ListItemText, OutlinedInput, Stack, Avatar
} from '@mui/material';

import api from '../utils/api';
import { normalizeNumberInput } from '../utils/helpers';
import { getMediaUrl } from '../utils/media';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode.react';
import { getActiveClassrooms } from '../utils/classroomUtils';

const BenchSticker = React.memo(({ plan, examName, schoolId }) => {
  const s = plan.student || {};
  const u = s.user || {};
  const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
  const photo = getMediaUrl(u.photo_url || u.photo || s.photo);
  const benchNum = Math.floor((parseInt(plan.seat_number) - 1) / 3) + 1;
  const qrData = `STU|${s.id}|${name}|${schoolId}`;

  return (
    <Box sx={{
      width: '65mm',
      height: '46mm',
      border: '1px solid #000',
      borderRadius: '3px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'white',
      position: 'relative',
      breakInside: 'avoid',
      pageBreakInside: 'avoid',
      overflow: 'hidden',
      p: '3px'
    }}>
      {/* Header - Very Compact */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.2, borderBottom: '0.5px solid #ccc', pb: 0.1 }}>
        <Box sx={{ border: '0.5px solid #000', p: 0.1, bgcolor: '#fff' }}>
           <QRCode value={qrData} size={20} level="L" renderAs="svg" />
        </Box>
        <Typography sx={{ fontSize: '8px', fontWeight: 'bold', color: '#000', textAlign: 'center', flex: 1, px: 0.1, lineHeight: 1 }}>{examName}</Typography>
        <Avatar
          src={photo}
          variant="rounded"
          sx={{ width: 26, height: 30, border: '1px solid #ccc' }}
          imgProps={{ onError: (e) => { e.target.style.display = 'none'; } }}
        />
      </Box>

      {/* Student Info */}
      <Box sx={{ textAlign: 'center', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Typography sx={{ fontSize: '10.5px', fontWeight: 'bold', color: '#000', lineHeight: 1.1 }}>{name}</Typography>
        <Typography sx={{ fontSize: '8.5px', color: '#333', lineHeight: 1.1 }}>শ্রেণি: {s.classroom?.name || '—'}</Typography>
        <Typography sx={{ fontSize: '8.5px', color: '#333', lineHeight: 1.1 }}>রোল:{normalizeNumberInput(s.roll_number)} | শাখা:{s.section?.name || 'N/A'}</Typography>
      </Box>

      {/* Footer - FORCED SINGLE LINE */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        px: '5px',
        bgcolor: '#000',
        color: '#fff',
        borderRadius: '2px',
        py: '2px',
        mt: 0.1,
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <Typography sx={{ fontSize: '8px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          {plan.session === 'morning' ? 'সকাল' : 'বিকাল'}
        </Typography>
        <Typography sx={{ fontSize: '9px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          রুম:{plan.room?.name}
        </Typography>
        <Typography sx={{ fontSize: '11px', fontWeight: '900', whiteSpace: 'nowrap' }}>
          বেঞ্চ:{benchNum}
        </Typography>
      </Box>
    </Box>
  );
});

const getPlansForSession = (plans, sessionLabel) => {
  const target = String(sessionLabel || '').toLowerCase();
  return plans.filter(p => {
    const s = String(p.session || '').toLowerCase();
    if (!s) {
      return target === 'morning';
    }
    return s === target;
  });
};

const StickerGrid = React.memo(({ seatPlans, session, examName, schoolId, isPrinting }) => {
  const [currentPage, setCurrentPage] = useState(0);

  const plans = getPlansForSession(seatPlans, session);
  if (plans.length === 0) return null;

  const pageSize = 15;
  const pages = [];
  for (let i = 0; i < plans.length; i += pageSize) {
    pages.push(plans.slice(i, i + pageSize));
  }

  const renderedPages = isPrinting ? pages : [pages[currentPage]];

  return (
    <Box className="stickers-container">
      {!isPrinting && pages.length > 1 && (
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="center" sx={{ mb: 2 }} className="no-print">
          <Button
            variant="outlined"
            size="small"
            disabled={currentPage === 0}
            onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
          >
            পূর্ববর্তী পেজ (Prev)
          </Button>
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            পেজ {currentPage + 1} / {pages.length} ({session === 'morning' ? 'সকাল' : 'বিকাল'} সেশন)
          </Typography>
          <Button
            variant="outlined"
            size="small"
            disabled={currentPage === pages.length - 1}
            onClick={() => setCurrentPage(prev => Math.min(pages.length - 1, prev + 1))}
          >
            পরবর্তী পেজ (Next)
          </Button>
        </Stack>
      )}

      {renderedPages.map((pagePlans, idx) => {
        const pageIdx = isPrinting ? idx : currentPage;
        return (
          <Box
            key={pageIdx}
            className="sticker-page-wrapper"
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 65mm)',
              gridAutoRows: '46mm',
              columnGap: '4mm',
              rowGap: '6.5mm',
              justifyContent: 'center',
              mb: 3,
              pageBreakAfter: pageIdx < pages.length - 1 ? 'always' : 'auto',
              bgcolor: 'white',
              p: isPrinting ? 0 : 1.5,
              borderRadius: 2,
              border: isPrinting ? 'none' : '1px solid #e0e0e0',
              '@media print': {
                display: 'grid !important',
                p: 0,
                border: 'none',
                mb: 0,
                boxShadow: 'none'
              }
            }}
          >
            {pagePlans.map(plan => (
              <BenchSticker key={plan.id} plan={plan} examName={examName} schoolId={schoolId} />
            ))}
          </Box>
        );
      })}
    </Box>
  );
});

const SeatAllocationPage = () => {
  const { id: schoolId } = useParams();
  const [loading, setLoading] = useState(false);
  const [exams, setExams] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassrooms, setSelectedClassrooms] = useState([]);
  const [school, setSchool] = useState(null);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedBuildings, setSelectedBuildings] = useState([]);
  const [buildingRooms, setBuildingRooms] = useState({});
  const [roomBenches, setRoomBenches] = useState({});
  const [buildingRoomDetails, setBuildingRoomDetails] = useState({}); // { 1: [{room_number: 1, room_name: "101", bench_count: 15}, ...] }
  const [seatPlans, setSeatPlans] = useState([]);
  const [viewMode, setViewMode] = useState('door'); // 'door' or 'bench'
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [, setExamSlots] = useState([]);

  // চলতি সালের শ্রেণি (যেমন ২০২৭-এর ক্লাস বাদ) — আসন বিন্যাসে শুধু সক্রিয় শ্রেণি দেখানো হবে
  const activeClassrooms = useMemo(() => getActiveClassrooms(classrooms), [classrooms]);

  const toBnDigits = (num) => {
    const bn = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
    return String(num).replace(/\d/g, d => bn[d]);
  };

  const formatBnDate = (dateStr) => {
    if (!dateStr) return '---';
    const [y, m, d] = dateStr.split('-');
    return `${toBnDigits(d)}/${toBnDigits(m)}/${toBnDigits(y)}`;
  };

  const benchOptions = Array.from({ length: 50 }, (_, i) => i + 1);
  const roomCountOptions = Array.from({ length: 30 }, (_, i) => i + 1);
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

        // Fetch Classrooms
        try {
          const clsRes = await api.get(`/api/academics/classrooms/?school=${schoolId}`);
          const clsData = clsRes.data.results || clsRes.data || [];
          setClassrooms(clsData);
        } catch (_) {}

        try {
          const buildingsRes = await api.get(`/api/academics/buildings/?school=${schoolId}`);
          const buildingsData = buildingsRes.data || [];
          if (buildingsData.length > 0) {
            const bNums = []; const bRooms = {}; const rBenches = {}; const bRoomDetails = {};
            for (const b of buildingsData) {
              const match = b.name.match(/\d+/);
              const bNum = match ? parseInt(match[0]) : null;
              if (bNum) {
                bNums.push(bNum);
                const roomsRes = await api.get(`/api/academics/rooms/?building=${b.id}`);
                const roomsData = roomsRes.data || [];
                bRooms[bNum] = roomsData.length;
                const roomDetails = [];
                roomsData.forEach((room, idx) => {
                  // Always default to 15 benches for any room
                  rBenches[`${bNum}-${idx + 1}`] = 15;
                  roomDetails.push({
                    room_number: idx + 1,
                    room_name: room.name,
                    bench_count: 15
                  });
                });
                bRoomDetails[bNum] = roomDetails;
              }
            }
            setSelectedBuildings(bNums);
            setBuildingRooms(bRooms);
            setRoomBenches(rBenches);
            setBuildingRoomDetails(bRoomDetails);
          }
        } catch (_) {}

        // Fetch ALL examinations across all pages
        let allExams = [];
        let page = 1;
        let hasNext = true;

        while (hasNext && page <= 20) {
          try {
            const response = await api.get(`/api/results/examinations/?school=${schoolId}&page=${page}&page_size=500`);
            const data = response.data;
            const arr = Array.isArray(data) ? data : (data?.results || []);
            allExams = [...allExams, ...arr];
            hasNext = Boolean(data?.next);
            page++;
            if (!arr.length) break;
          } catch (err) {
            console.error('Error fetching exams page:', page, err);
            break;
          }
        }

        setExams(allExams);
        if (allExams.length > 0) setSelectedExam(allExams[0].id);

        // Fetch all slots to get dates
        const slotsRes = await api.get(`/api/results/exam-slots/?school=${schoolId}`);
        setExamSlots(slotsRes.data.results || slotsRes.data || []);
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

  const handleClassroomChange = (event) => {
    const { target: { value } } = event;
    setSelectedClassrooms(typeof value === 'string' ? value.split(',') : value);
  };

  const handleRoomCountChange = (buildingNum, count) => {
    const num = parseInt(count) || 1;
    setBuildingRooms(prev => ({ ...prev, [buildingNum]: num }));

    // Automatically set default 15 benches for all rooms in this building
    const newBenches = { ...roomBenches };
    for (let i = 1; i <= num; i++) {
      if (!newBenches[`${buildingNum}-${i}`]) {
        newBenches[`${buildingNum}-${i}`] = 15;
      }
    }
    setRoomBenches(newBenches);
  };

  const handleBenchCountChange = (buildingNum, roomNum, count) => {
    setRoomBenches(prev => ({ ...prev, [`${buildingNum}-${roomNum}`]: parseInt(count) }));
  };

  const prepareBuildingData = () => {
    const buildings = [];
    selectedBuildings.forEach(bNum => {
      const numRooms = buildingRooms[bNum] || 1;
      const rooms = [];
      const savedRooms = buildingRoomDetails[bNum] || [];
      for (let rNum = 1; rNum <= numRooms; rNum++) {
        const savedRoom = savedRooms[rNum - 1];
        const roomName = savedRoom?.room_name || `${bNum * 100 + rNum}`;
        const benchCount = savedRoom?.bench_count || roomBenches[`${bNum}-${rNum}`] || DEFAULT_BENCH_COUNT;
        rooms.push({ 
          room_number: rNum, 
          room_name: roomName, 
          bench_count: benchCount 
        });
      }
      buildings.push({ building_number: bNum, rooms });
    });
    return buildings;
  };

  const filteredExams = useMemo(() => {
    if (!selectedClassrooms || selectedClassrooms.length === 0) {
      return exams;
    }
    return exams.filter(exam => {
      if (!exam.classroom) return true;
      const cid = typeof exam.classroom === 'object' ? exam.classroom.id : exam.classroom;
      return selectedClassrooms.some(sc => String(sc) === String(cid));
    });
  }, [exams, selectedClassrooms]);

  const handleGenerateSeatPlan = async () => {
    if (!selectedExam || selectedBuildings.length === 0) {
      setMessage('পরীক্ষা এবং ভবন নির্বাচন করুন!');
      setMessageType('warning');
      return;
    }
    setLoading(true);
    setSeatPlans([]); // Clear old data
    try {
      const response = await api.post('/api/academics/generate-seat-plan/', {
        examination_id: selectedExam,
        school_id: schoolId,
        buildings: prepareBuildingData(),
        classroom_ids: selectedClassrooms
      });

      const plans = response.data.seat_plans || response.data || [];
      setSeatPlans(plans);

      if (plans.length > 0) {
        setMessage(`সিট প্ল্যান সফলভাবে তৈরি হয়েছে! (${plans.length} জন শিক্ষার্থী)`);
        setMessageType('success');
      } else {
        setMessage('নির্বাচিত পরীক্ষা বা ভবনের জন্য কোনো শিক্ষার্থী পাওয়া যায়নি।');
        setMessageType('warning');
      }
    } catch (error) {
      console.error("Seat plan error:", error);
      setMessage(error.response?.data?.detail || 'সিট প্ল্যান তৈরি করতে সমস্যা হয়েছে!');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
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

  const examName = exams.find(e => String(e.id) === String(selectedExam))?.name || 'সিট প্ল্যান';
  const principalSig = getMediaUrl(school?.principal_signature);
  const schoolSeal = getMediaUrl(school?.school_seal);

  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const handleBeforePrint = () => setIsPrinting(true);
    const handleAfterPrint = () => {
      setIsPrinting(false);
      document.body.classList.remove('printing-stickers');
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const handlePrintBenchStickers = () => {
    if (!seatPlans.length) return;
    setIsPrinting(true);
    document.body.classList.add('printing-stickers');
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setIsPrinting(false);
        document.body.classList.remove('printing-stickers');
      }, 500);
    }, 250);
  };

  const SeatPlanTable = ({ session }) => {
    const plans = getPlansForSession(seatPlans, session);
    if (plans.length === 0) return null;

    const selectedExamData = exams.find(exam => String(exam.id) === String(selectedExam)) || {};
    const routineDate = selectedExamData?.exam_date || selectedExamData?.start_date || '';

    // QR Code for school/verification
    const schoolQR = `SCHOOL|${schoolId}|${school?.name}`;

    return (
      <Box sx={{ mb: 6, pageBreakAfter: 'always' }} className="door-list-section">
        {/* Header inside table area for print consistency */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, mb: 2, borderBottom: '2px solid #1a237e', pb: 1 }}>
          <Box sx={{ border: '1px solid #1a237e', p: 0.5, bgcolor: '#fff' }}>
             <QRCode value={schoolQR} size={80} level="M" />
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1a237e', fontSize: '1.8rem' }}>{school?.bn_name || school?.name}</Typography>
            <Typography variant="body2" sx={{ fontSize: '1.1rem' }}>{school?.address}</Typography>
            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', bgcolor: '#1a237e', color: 'white', px: 3, py: 0.5, borderRadius: 5, minWidth: 500 }}>
              <Typography sx={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{session === 'morning' ? 'সকাল' : 'বিকাল'} - সিট প্ল্যান ({examName})</Typography>
              <Typography sx={{ fontWeight: 'bold', fontSize: '1.2rem' }}>তারিখঃ {formatBnDate(routineDate)}</Typography>
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

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mt: 4 }}>
          <Typography sx={{ fontWeight: 'bold', fontSize: '15px', color: '#000' }}>
            {session === 'morning' ? 'যাদের সকাল তাদের সকাল' : 'যাদের বিকাল তাদের বিকাল'}
          </Typography>

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
        @media screen {
          .sticker-page-wrapper.screen-hidden {
            display: none !important;
          }
          .sticker-page-wrapper.screen-visible {
            display: grid !important;
          }
        }
        @media print {
          @page {
            margin: 5mm 5mm;
            size: A4 portrait;
          }
          html, body, #root {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #printable-area {
            position: static !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            overflow: visible !important;
          }
          .no-print { display: none !important; }

          /* Show/Hide based on which mode is being printed */
          body.printing-stickers .door-list-only { display: none !important; }
          body.printing-stickers .stickers-preview { display: block !important; }
          body:not(.printing-stickers) .stickers-preview { display: none !important; }
          body:not(.printing-stickers) .door-list-only { display: block !important; }

          .stickers-container {
            display: block !important;
            width: 100% !important;
            overflow: visible !important;
          }
          .sticker-page-wrapper {
            display: grid !important;
            padding: 0 !important;
            border: none !important;
            margin-bottom: 0 !important;
            box-shadow: none !important;
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

              <FormControl fullWidth margin="normal">
                <InputLabel id="exam-select-label">পরীক্ষা নির্বাচন করুন *</InputLabel>
                <Select
                  labelId="exam-select-label"
                  value={selectedExam}
                  label="পরীক্ষা নির্বাচন করুন *"
                  onChange={(e) => {
                    const examId = e.target.value;
                    setSelectedExam(examId);
                    const examObj = exams.find(ex => String(ex.id) === String(examId));
                    if (examObj && examObj.classroom && selectedClassrooms.length === 0) {
                      const cid = typeof examObj.classroom === 'object' ? examObj.classroom.id : examObj.classroom;
                      if (cid) setSelectedClassrooms([cid]);
                    }
                  }}
                >
                  <MenuItem value="">-- পরীক্ষা নির্বাচন করুন ({filteredExams.length}টি পরীক্ষা) --</MenuItem>
                  {filteredExams.map((exam) => {
                    const clsName = typeof exam.classroom === 'object' ? exam.classroom?.name : (classrooms.find(c => String(c.id) === String(exam.classroom))?.name || '');
                    return (
                      <MenuItem key={exam.id} value={exam.id}>
                        {exam.name} {clsName ? `(${clsName})` : ''} {exam.year ? `[${exam.year}]` : ''}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>

              <FormControl fullWidth margin="normal">
                <InputLabel id="classroom-select-label">শ্রেণি নির্বাচন করুন (এক বা একাধিক)</InputLabel>
                <Select
                  labelId="classroom-select-label"
                  multiple
                  value={selectedClassrooms}
                  onChange={handleClassroomChange}
                  input={<OutlinedInput label="শ্রেণি নির্বাচন করুন (এক বা একাধিক)" />}
                  renderValue={(selected) => {
                    if (selected.length === 0) return 'সকল শ্রেণি (All Classes)';
                    return selected.map(cid => {
                      const cls = activeClassrooms.find(c => String(c.id) === String(cid));
                      return cls ? cls.name : cid;
                    }).join(', ');
                  }}
                >
                  <MenuItem
                    value="ALL"
                    onClick={() => {
                      if (selectedClassrooms.length === activeClassrooms.length) {
                        setSelectedClassrooms([]);
                      } else {
                        setSelectedClassrooms(activeClassrooms.map(c => c.id));
                      }
                    }}
                  >
                    <Checkbox checked={activeClassrooms.length > 0 && selectedClassrooms.length === activeClassrooms.length} />
                    <ListItemText primary="সকল শ্রেণি (Select All)" />
                  </MenuItem>
                  {activeClassrooms.map((cls) => (
                    <MenuItem key={cls.id} value={cls.id}>
                      <Checkbox checked={selectedClassrooms.indexOf(cls.id) > -1} />
                      <ListItemText primary={cls.name} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

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
                    {roomCountOptions.map(n => <option key={n} value={n}>{n}</option>)}
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
          <Paper sx={{ p: 2, mb: 3, bgcolor: '#fafafa', borderRadius: 2 }} className="no-print">
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
              <Stack direction="row" spacing={1.5}>
                <Button
                  variant={viewMode === 'door' ? 'contained' : 'outlined'}
                  color="primary"
                  onClick={() => setViewMode('door')}
                  sx={{ fontWeight: 'bold' }}
                >
                  হল রুম ভিত্তিক তালিকা ({seatPlans.length} জন)
                </Button>

                <Button
                  variant={viewMode === 'bench' ? 'contained' : 'outlined'}
                  color="success"
                  onClick={() => setViewMode('bench')}
                  sx={{ fontWeight: 'bold' }}
                >
                  বেঞ্চ ভিত্তিক তালিকা / স্টিকার ({seatPlans.length} জন)
                </Button>
              </Stack>

              <Stack direction="row" spacing={1.5}>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<PrintIcon />}
                  onClick={() => {
                    if (viewMode === 'bench') {
                      handlePrintBenchStickers();
                    } else {
                      window.print();
                    }
                  }}
                  sx={{ fontWeight: 'bold' }}
                >
                  {viewMode === 'bench' ? 'প্রিন্ট বেঞ্চ স্টিকার' : 'প্রিন্ট হল রুম তালিকা'}
                </Button>

                <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleDownloadPDF}>
                  ডাউনলোড PDF
                </Button>
              </Stack>
            </Stack>
          </Paper>

          <Box id="printable-area">
            {viewMode === 'door' ? (
              <Box className="door-list-only">
                <SeatPlanTable session="morning" />
                <SeatPlanTable session="afternoon" />
              </Box>
            ) : (
              <Box className="stickers-preview">
                <StickerGrid session="morning" seatPlans={seatPlans} examName={examName} schoolId={schoolId} isPrinting={isPrinting} />
                <StickerGrid session="afternoon" seatPlans={seatPlans} examName={examName} schoolId={schoolId} isPrinting={isPrinting} />
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default SeatAllocationPage;
