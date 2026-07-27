import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import {
  Box, Typography, Paper, TextField, Button, Grid, Table,
  TableHead, TableBody, TableRow, TableCell, Divider, Stack,
  Autocomplete, CircularProgress
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import dayjs from 'dayjs';
import { useToast } from '../../components/Toast';

export default function BillingPage() {
  const { id } = useParams(); // Should be 6 for BDapp IT Firm
  const navigate = useNavigate();
  const toast = useToast();
  const printRef = useRef();

  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [studentCount, setStudentCount] = useState(300);
  const [schoolLink, setSchoolLink] = useState('');
  const [ratePerStudent, setRatePerStudent] = useState(100);
  const [billDate, setBillDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [billNo, setBillDateNo] = useState(`INV-${dayjs().format('YYYY')}-SR-${Math.floor(Math.random() * 900) + 100}`);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user has access to school 6
    if (id !== '6') {
      // toast.error('Only BDapp IT Firm school can generate official bills');
      // navigate(`/school/${id}`);
    }
    fetchSchools();
  }, [id]);

  const fetchSchools = async () => {
    try {
      const res = await api.get('/api/schools/');
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      // Filter out school 6 itself if needed
      setSchools(list.filter(s => String(s.id) !== '6'));
    } catch (err) {
      console.error('Failed to fetch schools', err);
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedSchool) return;
    setLoading(true);
    try {
      const element = printRef.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgWidth = pdfWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      pdf.save(`Bill_${selectedSchool.name}_${billDate}.pdf`);
      toast.success('বিলটি পিডিএফ হিসেবে সেভ হয়েছে');
    } catch (err) {
      toast.error('পিডিএফ তৈরিতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const toBn = (n) => String(n).replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[d]);

  const totalAmount = studentCount * ratePerStudent;

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Paper sx={{ p: 3, mb: 3 }} className="no-print">
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
          বিল জেনারেটর (বিডিএপ আইটি ফার্ম)
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} md={3}>
            <Autocomplete
              options={schools}
              getOptionLabel={(option) => option.name || ''}
              value={selectedSchool}
              onChange={(_, newValue) => {
                setSelectedSchool(newValue);
                if (newValue) {
                  setSchoolLink(`https://bdapp.live/school/${newValue.id}`);
                }
              }}
              renderInput={(params) => <TextField {...params} label="স্কুল নির্বাচন করুন" fullWidth />}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label="স্কুল লিঙ্ক"
              fullWidth
              value={schoolLink}
              onChange={(e) => setSchoolLink(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              label="শিক্ষার্থী সংখ্যা"
              type="number"
              fullWidth
              value={studentCount}
              onChange={(e) => setStudentCount(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              label="ছাত্র প্রতি ফি"
              type="number"
              fullWidth
              value={ratePerStudent}
              onChange={(e) => setRatePerStudent(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              label="তারিখ"
              type="date"
              fullWidth
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                startIcon={<PrintIcon />}
                onClick={() => window.print()}
                fullWidth
              >
                প্রিন্ট
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadPDF}
                disabled={loading || !selectedSchool}
                fullWidth
              >
                পিডিএফ
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Actual Bill Template */}
      <Paper
        ref={printRef}
        elevation={0}
        sx={{
          p: 6,
          width: '210mm',
          minHeight: '297mm',
          mx: 'auto',
          bgcolor: 'white',
          color: 'black',
          fontFamily: 'SolaimanLipi, Arial, sans-serif',
          border: '1px solid #eee'
        }}
      >
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h3" sx={{ fontWeight: '900', color: '#1a237e', mb: 0.5 }}>
            বিডিএপ আইটি ফার্ম
          </Typography>
          <Typography variant="subtitle1" sx={{ fontStyle: 'italic', mb: 1 }}>
            স্মার্ট এডুকেশন সলিউশন পার্টনার
          </Typography>
          <Divider sx={{ borderBottomWidth: 3, borderColor: '#1a237e', width: '80%', mx: 'auto' }} />
        </Box>

        <Stack direction="row" justifyContent="space-between" sx={{ mb: 4 }}>
          <Box>
            <Typography variant="body1"><strong>তারিখ:</strong> {dayjs(billDate).format('DD MMMM, YYYY')}</Typography>
            <Typography variant="body1"><strong>বিল নং:</strong> {billNo}</Typography>
          </Box>
        </Stack>

        <Box sx={{ mb: 4 }}>
          <Typography variant="body1"><strong>প্রতি,</strong></Typography>
          <Typography variant="body1">প্রধান শিক্ষক,</Typography>
          <Typography variant="h5" sx={{ fontWeight: 'bold', my: 0.5 }}>
            {selectedSchool?.name || 'স্কুলের নাম'}
          </Typography>
          <Typography variant="body1">{selectedSchool?.address || 'স্কুলের ঠিকানা'}</Typography>
        </Box>

        <Typography variant="body1" sx={{ mb: 3 }}>
          <strong>বিষয়: ডিজিটাল স্কুল ম্যানেজমেন্ট সফটওয়্যার এবং ডাটাবেস সেটআপ বাবদ বিল।</strong>
        </Typography>

        <Typography variant="body1" sx={{ mb: 3 }}>
          সম্মানিত মহোদয়,<br />
          আপনার প্রতিষ্ঠানের ডিজিটাল রূপান্তরের লক্ষ্যে প্রয়োজনীয় ডাটাবেস তৈরি, সফটওয়্যার কাস্টমাইজেশন এবং ইনস্টলেশন সম্পন্ন করা হয়েছে। উক্ত কাজের বিস্তারিত বিল বিবরণী নিচে পেশ করা হলো:
        </Typography>

        <Table sx={{ border: '1px solid black', mb: 4 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell sx={{ border: '1px solid black', fontWeight: 'bold' }} align="center">ক্রমিক</TableCell>
              <TableCell sx={{ border: '1px solid black', fontWeight: 'bold' }}>কাজের বিবরণ</TableCell>
              <TableCell sx={{ border: '1px solid black', fontWeight: 'bold' }} align="center">হার (এককালীন)</TableCell>
              <TableCell sx={{ border: '1px solid black', fontWeight: 'bold' }} align="center">শিক্ষার্থীর সংখ্যা</TableCell>
              <TableCell sx={{ border: '1px solid black', fontWeight: 'bold' }} align="center">মোট টাকা</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell sx={{ border: '1px solid black' }} align="center">০১</TableCell>
              <TableCell sx={{ border: '1px solid black' }}>
                <strong>পূর্ণাঙ্গ ডাটাবেস ক্রিয়েশন:</strong> প্রতিটি শিক্ষার্থীর বিস্তারিত তথ্য (নাম, রোল, ছবি, অভিভাবক) এন্ট্রি এবং ক্লাউড সার্ভার কনফিগারেশন।
              </TableCell>
              <TableCell sx={{ border: '1px solid black' }} align="center">{ratePerStudent}/-</TableCell>
              <TableCell sx={{ border: '1px solid black' }} align="center">{studentCount} জন</TableCell>
              <TableCell sx={{ border: '1px solid black' }} align="center"><strong>{totalAmount.toLocaleString()}/-</strong></TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ border: '1px solid black' }} align="center">০২</TableCell>
              <TableCell sx={{ border: '1px solid black' }}>
                <strong>সফটওয়্যার কাস্টমাইজেশন:</strong> হাজিরা (QR ও ম্যানুয়াল), রেজাল্ট প্রসেসিং, ডিজিটাল আইডি কার্ড এবং অটো-অ্যাডমিশন কার্ড জেনারেটর মডিউল তৈরি।
              </TableCell>
              <TableCell sx={{ border: '1px solid black' }} align="center">অন্তর্ভুক্ত</TableCell>
              <TableCell sx={{ border: '1px solid black' }} align="center">-</TableCell>
              <TableCell sx={{ border: '1px solid black' }} align="center">-</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ border: '1px solid black' }} align="center">০৩</TableCell>
              <TableCell sx={{ border: '1px solid black' }}>
                <strong>ইনস্টলেশন ও ট্রেনিং:</strong> প্রতিষ্ঠানের পিসি এবং শিক্ষকদের মোবাইলে PWA (App) ইনস্টল, কিউআর স্ক্যানার সেটআপ এবং ব্যবহারের পূর্ণ প্রশিক্ষণ।
              </TableCell>
              <TableCell sx={{ border: '1px solid black' }} align="center">অন্তর্ভুক্ত</TableCell>
              <TableCell sx={{ border: '1px solid black' }} align="center">-</TableCell>
              <TableCell sx={{ border: '1px solid black' }} align="center">-</TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={4} sx={{ border: '1px solid black', fontWeight: 'bold', textAlign: 'right', p: 1.5 }}>
                সর্বমোট (টাকায়) =
              </TableCell>
              <TableCell sx={{ border: '1px solid black', fontWeight: 'bold' }} align="center">
                {totalAmount.toLocaleString()}/-
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <Box sx={{ mb: 6 }}>
          <Typography variant="body1">
            <strong>বিশেষ দ্রষ্টব্য:</strong><br />
            ১. বর্তমান বিলটি {studentCount} জন শিক্ষার্থীর তথ্যের ভিত্তিতে তৈরি করা হয়েছে।<br />
            ২. উভয় পক্ষের ছাত্র সংখ্যা যাচাই ও চূড়ান্ত কনফার্মেশনের পর পরবর্তী বিলে শিক্ষার্থীর সংখ্যা সমন্বয় (Update) করা হবে।<br />
            ৩. সফটওয়্যারের টেকনিক্যাল সাপোর্ট এবং ব্যাকআপ সেবা নিয়মিত প্রদান করা হবে।
          </Typography>
        </Box>

        <Stack direction="row" justifyContent="space-between" sx={{ mt: 10 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Divider sx={{ width: 150, mb: 1, borderColor: 'black' }} />
            <Typography variant="body1">গ্রহীতার স্বাক্ষর</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Divider sx={{ width: 150, mb: 1, borderColor: 'black' }} />
            <Typography variant="body1">কর্তৃপক্ষের স্বাক্ষর<br />বিডিএপ আইটি ফার্ম</Typography>
          </Box>
        </Stack>
      </Paper>

      <style>
        {`
          @media print {
            body { background: white !important; }
            .no-print { display: none !important; }
            .MuiPaper-root { box-shadow: none !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
          }
        `}
      </style>
    </Box>
  );
}
