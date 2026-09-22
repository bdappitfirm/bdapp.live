import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, Button, Stack, Table, TableBody, TableCell,
  TableContainer, TableRow, TableHead, CircularProgress
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import api from '../utils/api';
import { useToast } from '../components/Toast';

export default function PayslipGenerator() {
  const { id: schoolId, recordId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const printRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState(null);
  const [school, setSchool] = useState(null);

  const monthsBn = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];

  const loadData = useCallback(async () => {
    if (!recordId || !schoolId) return;
    setLoading(true);
    try {
      const [rRes, sRes] = await Promise.all([
        api.get(`/api/users/payroll/records/${recordId}/`),
        api.get(`/api/schools/${schoolId}/`)
      ]);
      setRecord(rRes.data);
      setSchool(sRes.data);
    } catch (err) {
      console.error('Failed to load payslip:', err);
      toast.error('পে স্লিপ লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  }, [recordId, schoolId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    try {
      toast.info('পিডিএফ তৈরি হচ্ছে...');
      const element = printRef.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      pdf.save(`Payslip_${record?.teacher_name}_${record?.month}_${record?.year}.pdf`);
      toast.success('পিডিএফ সেভ হয়েছে');
    } catch (err) {
      console.error(err);
      toast.error('পিডিএফ ডাউনলোড করতে ব্যর্থ হয়েছে');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!record) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="textSecondary">পে স্লিপ ডাটা পাওয়া যায়নি</Typography>
        <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate(-1)}>ফিরে যান</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: '800px', margin: '0 auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }} className="no-print">
        <Button variant="outlined" onClick={() => navigate(-1)}>ফিরে যান</Button>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" color="info" startIcon={<DownloadIcon />} onClick={handleDownloadPDF}>পিডিএফ ডাউনলোড</Button>
          <Button variant="contained" color="primary" startIcon={<PrintIcon />} onClick={() => window.print()}>প্রিন্ট করুন</Button>
        </Stack>
      </Stack>

      <Paper ref={printRef} elevation={3} sx={{ p: 4, borderRadius: 2, border: '2px solid #1976d2', bgcolor: '#fff' }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', borderBottom: '2px solid #1976d2', pb: 2, mb: 3 }}>
          {school?.logo && (
            <Box component="img" src={school.logo} alt="School Logo" sx={{ height: 60, mb: 1 }} />
          )}
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
            {school?.bn_name || school?.name}
          </Typography>
          <Typography variant="body2" color="textSecondary">{school?.address}</Typography>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1, bgcolor: '#1976d2', color: 'white', display: 'inline-block', px: 3, py: 0.5, borderRadius: 1 }}>
            বেতন স্লিপ — {monthsBn[record.month - 1]} {record.year}
          </Typography>
        </Box>

        {/* Employee Info */}
        <TableContainer sx={{ mb: 3 }}>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', width: '20%', border: 'none' }}>শিক্ষকের নাম:</TableCell>
                <TableCell sx={{ width: '30%', border: 'none' }}>{record.teacher_name}</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '20%', border: 'none' }}>পদবী:</TableCell>
                <TableCell sx={{ width: '30%', border: 'none' }}>{record.teacher_designation || 'শিক্ষক'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', border: 'none' }}>পেমেন্ট মাধ্যম:</TableCell>
                <TableCell sx={{ border: 'none' }}>{record.payment_method || 'নগদ'}</TableCell>
                <TableCell sx={{ fontWeight: 'bold', border: 'none' }}>পেমেন্ট তারিখ:</TableCell>
                <TableCell sx={{ border: 'none' }}>{record.payment_date || '-'}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        {/* Salary Details */}
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f5f5f5' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>বিবরণ (Earnings & Deductions)</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>পরিমাণ (টাকা)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>মূল বেতন (Basic Salary)</TableCell>
                <TableCell align="right">৳ {Number(record.basic_salary).toLocaleString()}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>মোট ভাতা (Allowances)</TableCell>
                <TableCell align="right">৳ {Number(record.allowances).toLocaleString()}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>বোনাস / অন্যান্য (Bonus / Additions)</TableCell>
                <TableCell align="right">৳ {Number(record.bonus).toLocaleString()}</TableCell>
              </TableRow>
              <TableRow sx={{ bgcolor: '#f9f9f9' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>মোট গ্রস বেতন (Gross Salary)</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>৳ {Number(record.gross_salary).toLocaleString()}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ color: 'error.main' }}>মোট কর্তন (Deductions)</TableCell>
                <TableCell align="right" sx={{ color: 'error.main' }}>- ৳ {Number(record.deductions).toLocaleString()}</TableCell>
              </TableRow>
              <TableRow sx={{ bgcolor: '#e8f5e9' }}>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#2e7d32' }}>সর্বমোট প্রদেয় (Net Payable)</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#2e7d32' }}>৳ {Number(record.net_salary).toLocaleString()}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        {/* Signatures */}
        <Box sx={{ mt: 8, display: 'flex', justifyContent: 'space-between', pt: 4 }}>
          <Box sx={{ textAlign: 'center', width: '200px', borderTop: '1px solid #000', pt: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>শিক্ষকের স্বাক্ষর</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', width: '200px', borderTop: '1px solid #000', pt: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>প্রধান শিক্ষকের স্বাক্ষর</Typography>
          </Box>
        </Box>
      </Paper>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </Box>
  );
}
