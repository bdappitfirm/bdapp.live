import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Paper,
  MenuItem,
  Backdrop,
  CircularProgress,
  Grid
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import EventSeatIcon from '@mui/icons-material/EventSeat';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { QRCodeCanvas } from 'qrcode.react';
import { useToast } from '../components/Toast';
import { resolveSchoolLogo, resolveStudentPhoto } from '../utils/media';

export default function BenchStickerGenerator() {
  const { id } = useParams();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [school, setSchool] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [allSections, setAllSections] = useState([]);
  const [filterSections, setFilterSections] = useState([]);

  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('bulk'); // 'bulk' or 'single'
  const [cards, setCards] = useState([]);

  // Print stylesheet in head
  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'bench-sticker-print-style';
    el.textContent = `
      @media print {
        @page { size: A4 portrait; margin: 0; }
        body { background: white !important; margin: 0 !important; }
        .no-print, header, footer, nav, aside, .MuiAppBar-root { display: none !important; }
        .bench-sticker-generator-root { padding: 0 !important; margin: 0 !important; }
        .print-page {
          width: 210mm !important;
          /* A4 উচ্চতা ২৯৭ মিমি নয় — কয়েক মিমি কম রাখা হয় যেন রাউন্ডিং/আনপ্রিন্টেবল
             মার্জিনের কারণে শেষে একটা ফাঁকা পেজ না আসে। */
          height: 296mm !important;
          max-height: 296mm !important;
          padding: 8mm !important;
          margin: 0 !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
          box-shadow: none !important;
          page-break-after: always !important;
          break-after: page !important;
        }
        .print-page:last-child {
          page-break-after: auto !important;
          break-after: auto !important;
        }
        /* কাটার লাইন ও ছবি/ব্যাকগ্রাউন্ড প্রিন্টে ঠিকভাবে আসতে হবে —
           নাহলে স্ক্রিনে যেই ফাঁকা দেখা যায় প্রিন্টে তা মিলিয়ে যায়। */
        .print-page, .print-page * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `;
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [schoolRes, classRes, secRes] = await Promise.all([
        api.get(`/api/schools/${id}/`),
        api.get(`/api/academics/classrooms/?school=${id}`),
        api.get(`/api/academics/sections/?school=${id}`)
      ]);
      setSchool(schoolRes.data);
      setClassrooms(Array.isArray(classRes.data) ? classRes.data : classRes.data.results || []);
      setAllSections(Array.isArray(secRes.data) ? secRes.data : secRes.data.results || []);
    } catch (err) {
      console.error(err);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClassChange = (classroomId) => {
    setClassFilter(classroomId);
    setSectionFilter('');
    if (!classroomId) {
      setFilterSections([]);
    } else {
      setFilterSections(allSections.filter(s => String(s.classroom?.id || s.classroom) === String(classroomId)));
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      // page_size বাড়ানো হচ্ছে যেন "সকল শ্রেণি" নির্বাচনে ১০০-র বেশি শিক্ষার্থীও কেটে না যায়
      let url = `/api/academics/students/?school=${id}&page_size=3000`;
      if (searchType === 'single' && searchQuery) {
        // ব্যাকএন্ডের `search` প্যারামিটারই নাম ও রোল দুটোই হ্যান্ডেল করে
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      } else {
        if (classFilter) url += `&classroom=${classFilter}`;
        if (sectionFilter) url += `&section=${sectionFilter}`;
      }
      const res = await api.get(url);
      let data = Array.isArray(res.data) ? res.data : res.data.results || [];
      // Sort by roll number numerically
      data.sort((a, b) => (parseInt(a.roll_number) || 0) - (parseInt(b.roll_number) || 0));
      setCards(data);
      if (data.length) {
        toast.success(`${data.length} টি বেঞ্চ স্টিকার তৈরি হয়েছে`);
      } else {
        toast.warning('কোনো শিক্ষার্থী পাওয়া যায়নি');
      }
    } catch (err) {
      console.error(err);
      toast.error('শিক্ষার্থী লোড করতে ব্যর্থ হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!cards.length) return toast.warning('প্রথমে স্টিকার জেনারেট করুন');
    toast.info('প্রিন্ট উইন্ডো খোলা হচ্ছে...');

    // ছবি/লোগো লোড হওয়া নিশ্চিত করা — সর্বোচ্চ ৪০০ms অপেক্ষা, যাতে প্রিন্ট ডায়ালগ দ্রুত খোলে
    const container = document.querySelector('.bench-sticker-generator-root');
    if (container) {
      const pendingImages = Array.from(container.querySelectorAll('img'))
        .filter(img => !img.complete || img.naturalHeight === 0);
      if (pendingImages.length > 0) {
        const imagePromises = pendingImages.map(img => new Promise((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          setTimeout(resolve, 200);
        }));
        const maxWait = new Promise(resolve => setTimeout(resolve, 400));
        await Promise.race([Promise.all(imagePromises), maxWait]);
      }
    }

    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!cards.length) return toast.warning('কোনো স্টিকার নেই');
    toast.info('PDF তৈরি হচ্ছে...');
    try {
      const pages = document.querySelectorAll('.print-page');
      const pdf = new jsPDF('p', 'mm', 'a4');
      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage();
        const canvas = await html2canvas(pages[i], { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, 210, 296);
      }
      pdf.save(`bench-stickers-${id}.pdf`);
      toast.success('PDF ডাউনলোড সফল হয়েছে');
    } catch (err) {
      console.error(err);
      toast.error('PDF ডাউনলোড ব্যর্থ হয়েছে');
    }
  };

  // Chunk cards into 20 per page (4 columns x 5 rows)
  const chunkedCards = React.useMemo(() => {
    const chunks = [];
    for (let i = 0; i < cards.length; i += 20) {
      chunks.push(cards.slice(i, i + 20));
    }
    return chunks;
  }, [cards]);

  // ছবি না থাকলে শিক্ষার্থীর জায়গায় সংশ্লিষ্ট স্কুলের লোগো বসবে
  const getStickerPhoto = (student) => resolveStudentPhoto(student) || resolveSchoolLogo(school) || '/logo192.png';

  // QR ডাটা: হাজিরা পেজের স্ক্যানার শুধু `parts[1]` (studentId) পড়ে।
  // বাংলা নাম percent-encoded করলে পেলোড ২০০+ অক্ষরের হয়ে QR অনেক ডেন্স
  // হয়ে যায়, আর প্রিন্টে মডিউল সাইজ ~০.৩ মিমিতে নেমে আসে — ফলে স্ক্যান হয় না।
  // তাই শুধু আইডি এনকোড করা হয় (AdmissionCard-এর মতো), যাতে QR ছোট ও স্ক্যানযোগ্য থাকে।
  const getStickerQrData = (student) => {
    if (!student) return '';
    return `STU|${student.id}`;
  };

  return (
    <Box className="bench-sticker-generator-root" sx={{ p: 3 }}>
      <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }} open={loading}>
        <CircularProgress color="inherit" />
      </Backdrop>

      {/* Top Filter Panel */}
      <Paper elevation={0} sx={{ mb: 3, p: 3, background: 'linear-gradient(135deg, #1a237e 0%, #3949ab 100%)', color: 'white', borderRadius: 3 }} className="no-print">
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2} sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <EventSeatIcon sx={{ fontSize: 32 }} />
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>বেঞ্চ স্টিকার জেনারেটর</Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" color="success" startIcon={<PrintIcon />} onClick={handlePrint} disabled={!cards.length}>
              প্রিন্ট করুন
            </Button>
            <Button variant="contained" color="secondary" startIcon={<PictureAsPdfIcon />} onClick={handleDownloadPDF} disabled={!cards.length}>
              PDF ডাউনলোড
            </Button>
          </Stack>
        </Stack>

        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              select
              fullWidth
              label="অনুসন্ধান পদ্ধতি"
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              size="small"
              sx={{ bgcolor: 'white', borderRadius: 1 }}
            >
              <MenuItem value="bulk">শ্রেণি ও সেকশন অনুযায়ী</MenuItem>
              <MenuItem value="single">নাম বা রোল দিয়ে</MenuItem>
            </TextField>
          </Grid>

          {searchType === 'bulk' ? (
            <>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                  id="class-select"
                  select
                  fullWidth
                  label="শ্রেণি নির্বাচন করুন"
                  value={classFilter}
                  onChange={(e) => handleClassChange(e.target.value)}
                  size="small"
                  sx={{ bgcolor: 'white', borderRadius: 1 }}
                >
                  <MenuItem value="">সকল শ্রেণি</MenuItem>
                  {classrooms.map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                  id="section-select"
                  select
                  fullWidth
                  label="সেকশন / বিভাগ"
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  size="small"
                  sx={{ bgcolor: 'white', borderRadius: 1 }}
                >
                  <MenuItem value="">সকল সেকশন</MenuItem>
                  {filterSections.map((s) => (
                    <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            </>
          ) : (
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="নাম বা রোল নম্বর লিখুন"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="small"
                sx={{ bgcolor: 'white', borderRadius: 1 }}
              />
            </Grid>
          )}

          <Grid size={{ xs: 12, sm: 3 }}>
            <Button
              id="generate-button"
              fullWidth
              variant="contained"
              color="warning"
              startIcon={<SearchIcon />}
              onClick={handleSearch}
              sx={{ py: 1, fontWeight: 'bold' }}
            >
              স্টিকার জেনারেট করুন
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Stickers Grid / Pages */}
      {cards.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 3 }} className="no-print">
          <Typography variant="body1" color="text.secondary">
            কোনো স্টিকার জেনারেট করা হয়নি। উপরে শ্রেণি বা তথ্য দিয়ে "স্টিকার জেনারেট করুন" বাটনে ক্লিক করুন।
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          {chunkedCards.map((pageCards, pageIndex) => (
            <Box
              key={pageIndex}
              className="print-page"
              sx={{
                width: '210mm',
                height: '296mm',
                padding: '8mm',
                boxSizing: 'border-box',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gridTemplateRows: 'repeat(5, 1fr)',
                // স্টিকারগুলোর মাঝে বাড়তি ফাঁকা — কাঁচি/কাটারের সুবিধার জন্য
                gap: '8mm',
                background: 'white',
                boxShadow: 3,
                borderRadius: 2,
                overflow: 'hidden'
              }}
            >
              {pageCards.map((student, idx) => (
                <Paper
                  key={student.id || idx}
                  elevation={1}
                  sx={{
                    px: 0.75,
                    py: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: '1.5px dashed #9e9e9e',
                    borderRadius: 1.5,
                    background: '#fff',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    height: '100%'
                  }}
                >
                  {/* Top: QR Code (Left) & Student Photo / School Logo (Right) */}
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box
                      sx={{
                        p: '3px',
                        bgcolor: '#fff',
                        border: '1px solid #1a237e',
                        borderRadius: '4px',
                        lineHeight: 0,
                        flexShrink: 0
                      }}
                    >
                      <QRCodeCanvas
                        value={getStickerQrData(student)}
                        size={80}
                        level="M"
                        includeMargin={false}
                        fgColor="#000000"
                        bgColor="#ffffff"
                      />
                    </Box>
                    <Box
                      component="img"
                      src={getStickerPhoto(student)}
                      alt="Student"
                      sx={{
                        width: 54,
                        height: 74,
                        borderRadius: '4px',
                        objectFit: 'cover',
                        border: '2px solid #1a237e',
                        flexShrink: 0
                      }}
                      onError={(e) => { e.target.src = resolveSchoolLogo(school) || '/logo192.png'; }}
                    />
                  </Stack>

                  {/* Bottom: Class, Section, Roll — শ্রেণি ও সেকশন পৃথক লাইনে */}
                  <Box sx={{ textAlign: 'center', pt: 0.5, borderTop: '1px solid #eee' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.95rem', fontWeight: 600, color: '#333', lineHeight: 1.3 }}>
                      {student.classroom_name || student.classroom?.name || '-'}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.95rem', fontWeight: 600, color: '#333', lineHeight: 1.3 }}>
                      সেকশন: {student.section_name || student.section?.name || '-'}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#1a237e', lineHeight: 1.3 }}>
                      রোল: {student.roll_number || '-'}
                    </Typography>
                  </Box>
                </Paper>
              ))}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
