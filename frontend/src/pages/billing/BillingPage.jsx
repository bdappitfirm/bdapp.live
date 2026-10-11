import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/api';
import { getMediaUrl } from '../../utils/media';
import {
  Box, Typography, Paper, TextField, Button, Grid, Table,
  TableHead, TableBody, TableRow, TableCell, Divider, Stack,
  Autocomplete, FormControlLabel, Checkbox
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import dayjs from 'dayjs';
import { useToast } from '../../components/Toast';

export default function BillingPage() {
  const { id } = useParams(); // Should be 6 for BDapp IT Firm
  const toast = useToast();
  const printRef = useRef();

  const [schools, setSchools] = useState([]);
  const [firmSchool, setFirmSchool] = useState(null);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [studentCount, setStudentCount] = useState(0);
  const [schoolLink, setSchoolLink] = useState('');
  const [ratePerStudent, setRatePerStudent] = useState(100);
  const [monthlyFee, setMonthlyFee] = useState(0);
  const [monthCount, setMonthCount] = useState(0);
  const [isMonthlyPerStudent, setIsMonthlyPerStudent] = useState(true);
  const [commission, setCommission] = useState(0);
  const [previouslyPaid, setPreviouslyPaid] = useState(0);
  const [billDate, setBillDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [billNo] = useState(`INV-${dayjs().format('YYYY')}-SR-${Math.floor(Math.random() * 900) + 100}`);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSchools();
  }, [id]);

  const fetchSchools = async () => {
    try {
      const res = await api.get('/api/schools/');
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);

      const firm = list.find(s => String(s.id) === '6');
      if (firm) {
        setFirmSchool(firm);
      } else {
        try {
          const firmRes = await api.get('/api/schools/6/');
          setFirmSchool(firmRes.data);
        } catch (e) {
          console.error('Failed to fetch school 6', e);
        }
      }

      setSchools(list.filter(s => String(s.id) !== '6'));
    } catch (err) {
      console.error('Failed to fetch schools', err);
    }
  };

  const handleSavePayment = async () => {
    if (!selectedSchool) return;
    try {
      setLoading(true);
      await api.post(`/api/schools/${selectedSchool.id}/update_billing/`, {
        total_paid: previouslyPaid
      });
      toast.success('পরিশোধিত টাকা আপডেট হয়েছে');
    } catch (err) {
      toast.error('আপডেট করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
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

  const numStudents = Number(studentCount) || 0;
  const ratePerStud = Number(ratePerStudent) || 0;
  const mFee = Number(monthlyFee) || 0;
  const mCount = Number(monthCount) || 0;
  const comm = Number(commission) || 0;
  const prevPaid = Number(previouslyPaid) || 0;

  const oneTimeTotal = numStudents * ratePerStud;
  const monthlyTotal = mFee * mCount * (isMonthlyPerStudent && numStudents > 0 ? numStudents : 1);
  const totalAmount = oneTimeTotal + monthlyTotal;
  const commissionAmount = (totalAmount * comm) / 100;
  const afterCommission = totalAmount - commissionAmount;
  const netPayable = afterCommission - prevPaid;
  const firmSignatureUrl = getMediaUrl(firmSchool?.principal_signature);

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
                  setStudentCount(newValue.student_count || 0);
                  setPreviouslyPaid(newValue.billing?.total_paid || 0);
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
              label="এককালীন ফি (প্রতি ছাত্র)"
              type="number"
              fullWidth
              value={ratePerStudent}
              onChange={(e) => setRatePerStudent(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              label="কমিশন (%)"
              type="number"
              fullWidth
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              helperText="শতকরা হার (যেমন: ১০)"
            />
          </Grid>

          {/* Row 2: Monthly fee, Month count, Per student option, Previously paid, Date */}
          <Grid item xs={12} md={2}>
            <TextField
              label="মাসিক ফি"
              type="number"
              fullWidth
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(e.target.value)}
              helperText="মাসিক ফি পরিমাণ"
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              label="মাসের সংখ্যা"
              type="number"
              fullWidth
              value={monthCount}
              onChange={(e) => setMonthCount(e.target.value)}
              helperText="কত মাসের জন্য (যেমন: ৬, ১২)"
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Box sx={{ border: '1px solid #ccc', borderRadius: 1, px: 1, py: 0.5, height: '100%', display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isMonthlyPerStudent}
                    onChange={(e) => setIsMonthlyPerStudent(e.target.checked)}
                    color="primary"
                    size="small"
                  />
                }
                label={<Typography variant="body2" sx={{ fontSize: '0.8rem' }}>মাসিক ফি ছাত্র প্রতি</Typography>}
              />
            </Box>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              label="পরিশোধিত টাকা"
              type="number"
              fullWidth
              value={previouslyPaid}
              onChange={(e) => setPreviouslyPaid(e.target.value)}
              helperText="পূর্বে যত টাকা জমা দিয়েছে"
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

          <Grid item xs={12}>
            <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 1 }}>
              <Button
                variant="contained"
                startIcon={<PrintIcon />}
                onClick={() => window.print()}
              >
                প্রিন্ট
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={handleSavePayment}
                disabled={loading || !selectedSchool}
              >
                টাকা সেভ করুন
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadPDF}
                disabled={loading || !selectedSchool}
              >
                পিডিএফ
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      <Paper
        ref={printRef}
        elevation={0}
        sx={{
          p: 4,
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
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: '900', color: '#1a237e', mb: 0.5 }}>
            বিডিএপ আইটি ফার্ম
          </Typography>
          <Typography variant="subtitle2" sx={{ fontStyle: 'italic', mb: 1 }}>
            স্মার্ট এডুকেশন সলিউশন পার্টনার
          </Typography>
          <Divider sx={{ borderBottomWidth: 3, borderColor: '#1a237e', width: '80%', mx: 'auto' }} />
        </Box>

        <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="body2"><strong>তারিখ:</strong> {dayjs(billDate).format('DD MMMM, YYYY')}</Typography>
            <Typography variant="body2"><strong>বিল নং:</strong> {billNo}</Typography>
          </Box>
        </Stack>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2"><strong>প্রতি,</strong></Typography>
          <Typography variant="body2">প্রধান শিক্ষক,</Typography>
          <Typography variant="h6" sx={{ fontWeight: 'bold', my: 0.5 }}>
            {selectedSchool?.name || 'স্কুলের নাম'}
          </Typography>
          <Typography variant="body2">{selectedSchool?.address || 'স্কুলের ঠিকানা'}</Typography>
        </Box>

        <Typography variant="body2" sx={{ mb: 2 }}>
          <strong>বিষয়: ডিজিটাল স্কুল ম্যানেজমেন্ট সফটওয়্যার এবং ডাটাবেস সেটআপ বাবদ বিল।</strong>
        </Typography>

        <Typography variant="body2" sx={{ mb: 2 }}>
          সম্মানিত মহোদয়,<br />
          আপনার প্রতিষ্ঠানের ডিজিটাল রূপান্তরের লক্ষ্যে প্রয়োজনীয় ডাটাবেস তৈরি, সফটওয়্যার কাস্টমাইজেশন এবং ইনস্টলেশন সম্পন্ন করা হয়েছে। উক্ত কাজের বিস্তারিত বিল বিবরণী নিচে পেশ করা হলো:
        </Typography>

        <Table size="small" sx={{ border: '1px solid black', mb: 2 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell sx={{ border: '1px solid black', fontWeight: 'bold', fontSize: '0.85rem', py: 0.5 }} align="center">ক্রমিক</TableCell>
              <TableCell sx={{ border: '1px solid black', fontWeight: 'bold', fontSize: '0.85rem', py: 0.5 }}>কাজের বিবরণ</TableCell>
              <TableCell sx={{ border: '1px solid black', fontWeight: 'bold', fontSize: '0.85rem', py: 0.5 }} align="center">হার</TableCell>
              <TableCell sx={{ border: '1px solid black', fontWeight: 'bold', fontSize: '0.85rem', py: 0.5 }} align="center">পরিমাণ / শিক্ষার্থী</TableCell>
              <TableCell sx={{ border: '1px solid black', fontWeight: 'bold', fontSize: '0.85rem', py: 0.5 }} align="center">মোট টাকা</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell sx={{ border: '1px solid black', fontSize: '0.8rem', py: 0.5 }} align="center">০১</TableCell>
              <TableCell sx={{ border: '1px solid black', fontSize: '0.8rem', py: 0.5 }}>
                <strong>পূর্ণাঙ্গ ডাটাবেস ক্রিয়েশন:</strong> প্রতিটি শিক্ষার্থীর বিস্তারিত তথ্য (নাম, রোল, ছবি, অভিভাবক) এন্ট্রি এবং ক্লাউড সার্ভার কনফিগারেশন।
              </TableCell>
              <TableCell sx={{ border: '1px solid black', fontSize: '0.8rem', py: 0.5 }} align="center">{ratePerStud}/- (এককালীন)</TableCell>
              <TableCell sx={{ border: '1px solid black', fontSize: '0.8rem', py: 0.5 }} align="center">{numStudents} জন</TableCell>
              <TableCell sx={{ border: '1px solid black', fontSize: '0.8rem', py: 0.5 }} align="center"><strong>{oneTimeTotal.toLocaleString()}/-</strong></TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ border: '1px solid black', fontSize: '0.8rem', py: 0.5 }} align="center">০২</TableCell>
              <TableCell sx={{ border: '1px solid black', fontSize: '0.8rem', py: 0.5 }}>
                <strong>সফটওয়্যার কাস্টমাইজেশন:</strong> হাজিরা (QR ও ম্যানুয়াল), রেজাল্ট প্রসেসিং, ডিজিটাল আইডি কার্ড এবং অটো-অ্যাডমিশন কার্ড জেনারেটর মডিউল তৈরি।
              </TableCell>
              <TableCell sx={{ border: '1px solid black', fontSize: '0.8rem', py: 0.5 }} align="center">অন্তর্ভুক্ত</TableCell>
              <TableCell sx={{ border: '1px solid black', fontSize: '0.8rem', py: 0.5 }} align="center">-</TableCell>
              <TableCell sx={{ border: '1px solid black', fontSize: '0.8rem', py: 0.5 }} align="center">-</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ border: '1px solid black', fontSize: '0.8rem', py: 0.5 }} align="center">০৩</TableCell>
              <TableCell sx={{ border: '1px solid black', fontSize: '0.8rem', py: 0.5 }}>
                <strong>ইনস্টলেশন ও ট্রেনিং:</strong> প্রতিষ্ঠানের পিসি এবং শিক্ষকদের মোবাইলে PWA (App) ইনস্টল, কিউআর স্ক্যানার সেটআপ এবং ব্যবহারের পূর্ণ প্রশিক্ষণ।
              </TableCell>
              <TableCell sx={{ border: '1px solid black', fontSize: '0.8rem', py: 0.5 }} align="center">অন্তর্ভুক্ত</TableCell>
              <TableCell sx={{ border: '1px solid black', fontSize: '0.8rem', py: 0.5 }} align="center">-</TableCell>
              <TableCell sx={{ border: '1px solid black', fontSize: '0.8rem', py: 0.5 }} align="center">-</TableCell>
            </TableRow>
            {monthlyTotal > 0 && (
              <TableRow>
                <TableCell sx={{ border: '1px solid black', fontSize: '0.8rem', py: 0.5 }} align="center">০৪</TableCell>
                <TableCell sx={{ border: '1px solid black', fontSize: '0.8rem', py: 0.5 }}>
                  <strong>সফটওয়্যার মাসিক সার্ভিস চার্জ ({mCount} মাস):</strong> ক্লাউড সার্ভার ব্যাকআপ, নিয়মিত সিস্টেম আপডেট এবং কারিগরি সহায়তা সেবা।
                </TableCell>
                <TableCell sx={{ border: '1px solid black', fontSize: '0.8rem', py: 0.5 }} align="center">{mFee}/- (মাসিক)</TableCell>
                <TableCell sx={{ border: '1px solid black', fontSize: '0.8rem', py: 0.5 }} align="center">
                  {isMonthlyPerStudent && numStudents > 0 ? `${numStudents} জন × ${mCount} মাস` : `${mCount} মাস`}
                </TableCell>
                <TableCell sx={{ border: '1px solid black', fontSize: '0.8rem', py: 0.5 }} align="center"><strong>{monthlyTotal.toLocaleString()}/-</strong></TableCell>
              </TableRow>
            )}
            <TableRow>
              <TableCell colSpan={4} sx={{ border: '1px solid black', fontWeight: 'bold', textAlign: 'right', py: 0.5, px: 1.5, fontSize: '0.85rem' }}>
                মোট (Total) =
              </TableCell>
              <TableCell sx={{ border: '1px solid black', fontWeight: 'bold', fontSize: '0.85rem', py: 0.5 }} align="center">
                {totalAmount.toLocaleString()}/-
              </TableCell>
            </TableRow>
            {comm > 0 && (
              <TableRow>
                <TableCell colSpan={4} sx={{ border: '1px solid black', textAlign: 'right', py: 0.5, px: 1.5, fontSize: '0.8rem' }}>
                  (-) কমিশন ({comm}%) =
                </TableCell>
                <TableCell sx={{ border: '1px solid black', fontSize: '0.8rem', py: 0.5 }} align="center">
                  {commissionAmount.toLocaleString()}/-
                </TableCell>
              </TableRow>
            )}
            {comm > 0 && (
              <TableRow>
                <TableCell colSpan={4} sx={{ border: '1px solid black', fontWeight: 'bold', textAlign: 'right', py: 0.5, px: 1.5, fontSize: '0.85rem' }}>
                  কমিশন পরবর্তী মোট =
                </TableCell>
                <TableCell sx={{ border: '1px solid black', fontWeight: 'bold', fontSize: '0.85rem', py: 0.5 }} align="center">
                  {afterCommission.toLocaleString()}/-
                </TableCell>
              </TableRow>
            )}
            {prevPaid > 0 && (
              <TableRow>
                <TableCell colSpan={4} sx={{ border: '1px solid black', textAlign: 'right', py: 0.5, px: 1.5, fontSize: '0.8rem' }}>
                  (-) পূর্বের পরিশোধিত টাকা =
                </TableCell>
                <TableCell sx={{ border: '1px solid black', fontSize: '0.8rem', py: 0.5 }} align="center">
                  {prevPaid.toLocaleString()}/-
                </TableCell>
              </TableRow>
            )}
            <TableRow sx={{ bgcolor: '#e3f2fd' }}>
              <TableCell colSpan={4} sx={{ border: '1px solid black', fontWeight: 'bold', textAlign: 'right', py: 0.5, px: 1.5, fontSize: '0.9rem' }}>
                নিট বকেয়া (Net Payable) =
              </TableCell>
              <TableCell sx={{ border: '1px solid black', fontWeight: 'bold', fontSize: '1rem' }} align="center">
                {netPayable.toLocaleString()}/-
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <Box sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>বিশেষ দ্রষ্টব্য:</strong><br />
            ১. বর্তমান বিলটি {numStudents} জন শিক্ষার্থীর তথ্যের ভিত্তিতে তৈরি করা হয়েছে।<br />
            {mCount > 0 && (
              <>
                ২. বিলে মোট {mCount} মাসের সফটওয়্যার সার্ভিস ও মেইনটেন্যান্স ফি অন্তর্ভুক্ত করা হয়েছে।<br />
              </>
            )}
            {mCount > 0 ? '৩' : '২'}. উভয় পক্ষের ছাত্র সংখ্যা যাচাই ও চূড়ান্ত কনফার্মেশনের পর পরবর্তী বিলে শিক্ষার্থীর সংখ্যা সমন্বয় (Update) করা হবে।<br />
            {mCount > 0 ? '৪' : '৩'}. সফটওয়্যারের টেকনিক্যাল সাপোর্ট এবং ব্যাকআপ সেবা নিয়মিত প্রদান করা হবে।
          </Typography>
        </Box>

        <Stack direction="row" justifyContent="space-between" sx={{ mt: 5 }}>
          <Box sx={{ textAlign: 'center', width: 150 }}>
            <Box sx={{ height: 45, mb: 0.5 }} />
            <Divider sx={{ width: 130, mx: 'auto', mb: 0.5, borderColor: 'black' }} />
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>গ্রহীতার স্বাক্ষর</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', width: 150, position: 'relative' }}>
            <Box sx={{ height: 45, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', mb: 0.5 }}>
              {firmSignatureUrl && (
                <Box
                  component="img"
                  src={firmSignatureUrl}
                  alt="Authority Signature"
                  sx={{ maxHeight: 45, maxWidth: 140, objectFit: 'contain' }}
                />
              )}
            </Box>
            <Divider sx={{ width: 130, mx: 'auto', mb: 0.5, borderColor: 'black' }} />
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>কর্তৃপক্ষের স্বাক্ষর</Typography>
            <Typography variant="caption" display="block">বিডিএপ আইটি ফার্ম</Typography>
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
