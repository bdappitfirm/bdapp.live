import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, FormControl,
  InputLabel, Select, MenuItem, Button, Dialog,
  DialogTitle, DialogContent, Table, TableBody,
  TableCell, TableHead, TableRow,
  Divider, Stack, Chip
} from '@mui/material';
import { Receipt } from '@mui/icons-material';
import html2canvas from 'html2canvas';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import api from '../utils/api';
import { useSchool } from '../context/SchoolContext';
import { getMediaUrl } from '../utils/media';
import InputGuidance from './InputGuidance';

const FEE_LABELS = [
  { key: 'reg', label: 'রেজিস্ট্রেশন ফি' },
  { key: 'session', label: 'সেশন ফি' },
  { key: 'evaluation', label: 'ষান্মাসিক/বাৎসরিক মূল্যায়ন ফি' },
  { key: 'board', label: 'বোর্ড ফি' },
  { key: 'center', label: 'পরীক্ষার কেন্দ্র ফি' },
  { key: 'ict', label: 'আইসিটি ফি' },
  { key: 'sports', label: 'ক্রীড়া ফি' },
  { key: 'dev', label: 'উন্নয়ন ফি' },
  { key: 'welfare', label: 'বিদ্যুৎ/কল্যাণ ফি' },
  { key: 'tc', label: 'টিসি/প্রশংসা পত্র ফি' },
  { key: 'lab', label: 'কম্পিউটার ল্যাব ফি' },
  { key: 'scouts', label: 'স্কাউটস ফি' },
  { key: 'admission', label: 'ভর্তি ফি' },
  { key: 'monthly', label: 'মাসিক বেতন' },
  { key: 'exam', label: 'পরীক্ষার ফি' }
];

const FeePaymentReceipt = () => {
  const { schoolId } = useSchool();
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [outstandingFees, setOutstandingFees] = useState([]);
  const [selectedFees] = useState({});
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [generatedReceipt, setGeneratedReceipt] = useState(null);
  const [schoolData, setSchoolData] = useState(null);
  const [manualAmounts, setManualAmounts] = useState({});
  const [previousDue, setPreviousDue] = useState('');
  const [activeStep, setActiveStep] = useState(0);

  const guidanceSteps = [
    { selector: '#class-select', text: 'শ্রেণি নির্বাচন করুন', autoNext: false },
    { selector: '#section-select', text: 'সেকশন নির্বাচন করুন', autoNext: false },
    { selector: '#student-select', text: 'শিক্ষার্থী নির্বাচন করুন', autoNext: false },
    { selector: '#generate-receipt-button', text: 'এখানে ক্লিক করুন', autoNext: true }
  ];

  useEffect(() => {
    if (!selectedClass) {
      setActiveStep(0);
    } else if (!selectedSection) {
      setActiveStep(1);
    } else if (!selectedStudent) {
      setActiveStep(2);
    } else if (!receiptOpen) {
      setActiveStep(3);
    } else {
      setActiveStep(4);
    }
  }, [selectedClass, selectedSection, selectedStudent, receiptOpen]);

  const fetchSchoolData = useCallback(async () => {
    if (!schoolId) return;
    try {
      const response = await api.get(`/api/schools/${schoolId}/`);
      setSchoolData(response.data);
    } catch (e) { console.error(e); }
  }, [schoolId]);

  const fetchClasses = useCallback(async () => {
    if (!schoolId) return;
    try {
      const response = await api.get(`/api/academics/classrooms/?school=${schoolId}`);
      setClasses(response.data.results || response.data || []);
    } catch (e) { console.error(e); }
  }, [schoolId]);

  const fetchSections = useCallback(async () => {
    if (!schoolId || !selectedClass) return;
    try {
      const response = await api.get(`/api/academics/sections/?school=${schoolId}&classroom=${selectedClass}`);
      setSections(response.data.results || response.data || []);
    } catch (error) { console.error(error); }
  }, [schoolId, selectedClass]);

  const fetchStudents = useCallback(async () => {
    if (!schoolId) return;
    try {
      let url = `/api/academics/students/?school=${schoolId}`;
      if (selectedClass) url += `&classroom=${selectedClass}`;
      if (selectedSection) url += `&section=${selectedSection}`;
      const response = await api.get(url);
      setStudents(response.data.results || response.data || []);
    } catch (error) { console.error(error); }
  }, [schoolId, selectedClass, selectedSection]);

  const fetchOutstandingFees = useCallback(async () => {
    if (!selectedStudent || !schoolId) return;
    try {
      const assignRes = await api.get(`/api/fees/assignments/?student_id=${selectedStudent}&school=${schoolId}`);
      const assignments = assignRes.data.results || assignRes.data || [];
      const feesWithDetails = await Promise.all(assignments.map(async (a) => {
        try {
          const payRes = await api.get(`/api/fees/payments/?student_id=${selectedStudent}&assignment_id=${a.id}`);
          const pays = payRes.data.results || payRes.data || [];
          const paid = pays.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
          const due = parseFloat(a.payable_amount || a.amount || 0) - paid;
          return { ...a, totalPaid: paid, due };
        } catch { return { ...a, totalPaid: 0, due: parseFloat(a.payable_amount || a.amount || 0) }; }
      }));
      setOutstandingFees(feesWithDetails.filter(f => f.due > 0));
    } catch (error) { console.error(error); }
  }, [selectedStudent, schoolId]);

  useEffect(() => { if (schoolId) { fetchStudents(); fetchSchoolData(); fetchClasses(); } }, [schoolId, fetchStudents, fetchSchoolData, fetchClasses]);
  useEffect(() => { if (selectedClass) fetchSections(); else { setSections([]); setSelectedSection(''); } }, [selectedClass, fetchSections]);
  useEffect(() => { if (selectedStudent) fetchOutstandingFees(); }, [selectedStudent, fetchOutstandingFees]);

  const handleClassChange = (id) => { setSelectedClass(id); setSelectedSection(''); setSelectedStudent(''); };
  const handleSectionChange = (id) => { setSelectedSection(id); setSelectedStudent(''); };

  const handleManualAmountChange = (key, value) => {
    setManualAmounts(prev => ({ ...prev, [key]: value }));
  };

  const calculateTotal = () => Object.values(manualAmounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);

  const generateReceipt = () => {
    const studentObj = students.find(s => s.id === parseInt(selectedStudent));
    const initialManual = {};
    FEE_LABELS.forEach(l => { initialManual[l.key] = ''; });

    outstandingFees.filter(f => selectedFees[f.id] > 0).forEach(f => {
       const label = (f.fee_structure?.name || f.name).toLowerCase();
       const match = FEE_LABELS.find(l => label.includes(l.label.toLowerCase()) || l.label.toLowerCase().includes(label));
       if (match) initialManual[match.key] = f.due.toString();
    });

    setManualAmounts(initialManual);
    setPreviousDue('');
    setGeneratedReceipt({
      student: studentObj,
      receiptNumber: `RCP-${dayjs().format('YYYYMMDD')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      date: dayjs().format('DD/MM/YYYY')
    });
    setReceiptOpen(true);
  };

  const printReceipt = async () => {
    const el = document.getElementById('receipt-content');
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const img = canvas.toDataURL('image/jpeg', 0.95);
    const w = window.open('', '_blank');
    if (w) { w.document.write(`<html><body style="margin:0"><img src="${img}" style="width:100%"/></body></html>`); w.document.close(); setTimeout(() => { w.print(); w.close(); }, 500); }
  };

  const RenderReceiptCopy = ({ label, student, receiptNo, date }) => (
    <Box sx={{ p: 2, bgcolor: 'white', border: '2px solid #1a237e', borderRadius: '10px', mb: 2, position: 'relative', overflow: 'hidden', minHeight: '600px' }}>
      {schoolData?.logo && (
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.05, zIndex: 0, width: '70%' }}>
          <img src={getMediaUrl(schoolData.logo)} alt="watermark" style={{ width: '100%' }} />
        </Box>
      )}
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="center" mb={1}>
          {schoolData?.logo && <Box component="img" src={getMediaUrl(schoolData.logo)} sx={{ width: 50, height: 50, objectFit: 'contain' }} />}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1a237e', lineHeight: 1.2 }}>{schoolData?.bn_name || schoolData?.name}</Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{schoolData?.address}</Typography>
          </Box>
        </Stack>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}><Chip label={label} size="small" sx={{ bgcolor: '#1a237e', color: 'white', fontWeight: 'bold', height: 20, fontSize: '0.65rem' }} /></Box>
        <Divider sx={{ my: 1, borderColor: '#1a237e' }} />
        <Grid container sx={{ mb: 1, fontSize: '0.75rem' }}>
            <Grid item xs={6}><b>রশিদ নং:</b> {receiptNo}</Grid>
            <Grid item xs={6} align="right"><b>তারিখ:</b> {date}</Grid>
            <Grid item xs={12} sx={{ mt: 0.5, p: 0.5, bgcolor: '#f5f5f5', borderRadius: 1 }}>
               <b>নাম:</b> {student?.user?.first_name} {student?.user?.last_name} | <b>রোল:</b> {student?.roll_number} | <b>শ্রেণি:</b> {student?.classroom?.name}
            </Grid>
        </Grid>
        <Table size="small" sx={{ border: '1px solid #1a237e', '& td, & th': { border: '1px solid #eee', p: '1px 8px', fontSize: '0.75rem' } }}>
          <TableHead sx={{ bgcolor: '#f0f2f5' }}><TableRow><TableCell>বিবরণ</TableCell><TableCell align="right">পরিমাণ</TableCell></TableRow></TableHead>
          <TableBody>
            {FEE_LABELS.map(item => (
              <TableRow key={item.key}>
                <TableCell sx={{ py: 0.1 }}>{item.label}</TableCell>
                <TableCell align="right" sx={{ py: 0, px: 0 }}>
                  <input
                    type="number"
                    value={manualAmounts[item.key] || ''}
                    onChange={(e) => handleManualAmountChange(item.key, e.target.value)}
                    style={{ width: '100%', textAlign: 'right', border: 'none', fontSize: '0.75rem', padding: '2px 8px', outline: 'none', background: 'transparent' }}
                    placeholder="0.00"
                  />
                </TableCell>
              </TableRow>
            ))}
            <TableRow sx={{ bgcolor: '#f9f9f9' }}><TableCell><b>মোট</b></TableCell><TableCell align="right"><b>{calculateTotal().toFixed(2)}</b></TableCell></TableRow>
            <TableRow>
              <TableCell sx={{ py: 0.1 }}>অবশিষ্ট বকেয়া</TableCell>
              <TableCell align="right" sx={{ py: 0, px: 0 }}>
                <input
                  type="number"
                  value={previousDue}
                  onChange={(e) => setPreviousDue(e.target.value)}
                  style={{ width: '100%', textAlign: 'right', border: 'none', fontSize: '0.75rem', padding: '2px 8px', outline: 'none', background: 'transparent' }}
                  placeholder="0.00"
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Typography sx={{ mt: 1, fontSize: '0.7rem' }}><b>কথায়:</b> {calculateTotal() > 0 ? "________________ টাকা মাত্র" : '---'}</Typography>
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 3 }}>
          <Box sx={{ textAlign: 'center' }}><Box sx={{ borderTop: '1px solid #000', width: 80, mt: 1 }} /><Typography sx={{ fontSize: '0.6rem' }}>আদায়কারীর স্বাক্ষর</Typography></Box>
          <Box sx={{ textAlign: 'center' }}>
            {schoolData?.principal_signature && <Box component="img" src={getMediaUrl(schoolData.principal_signature)} sx={{ height: 20, display: 'block', mx: 'auto' }} />}
            <Box sx={{ borderTop: '1px solid #000', width: 80 }} /><Typography sx={{ fontSize: '0.6rem' }}>প্রধান শিক্ষকের স্বাক্ষর</Typography>
          </Box>
        </Stack>
      </Box>
    </Box>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: { xs: 1, sm: 3 } }}>
        <Typography variant="h5" gutterBottom fontWeight="bold"><Receipt /> ফি রশিদ জেনারেটর</Typography>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl id="class-select" fullWidth>
                  <InputLabel>শ্রেণি</InputLabel>
                  <Select value={selectedClass} onChange={(e) => handleClassChange(e.target.value)} label="শ্রেণি">
                    {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl id="section-select" fullWidth disabled={!selectedClass}>
                  <InputLabel>সেকশন</InputLabel>
                  <Select value={selectedSection} onChange={(e) => handleSectionChange(e.target.value)} label="সেকশন">
                    {sections.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl id="student-select" fullWidth disabled={!selectedClass}>
                  <InputLabel>শিক্ষার্থী</InputLabel>
                  <Select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} label="শিক্ষার্থী">
                    {students.map(s => <MenuItem key={s.id} value={s.id}>{s.user?.first_name} ({s.roll_number})</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Button id="generate-receipt-button" variant="contained" onClick={generateReceipt} disabled={!selectedStudent} sx={{ mt: 2 }}>রশিদ তৈরি করুন</Button>
          </CardContent>
        </Card>

        <Dialog open={receiptOpen} onClose={() => setReceiptOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ bgcolor: '#1a237e', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            রশিদ এডিট ও প্রিন্ট <Button onClick={printReceipt} variant="contained" color="success">প্রিন্ট করুন</Button>
          </DialogTitle>
          <DialogContent dividers sx={{ bgcolor: '#f0f2f5', p: 2 }}>
            <Box id="receipt-content" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <RenderReceiptCopy label="Office Copy" student={generatedReceipt?.student} receiptNo={generatedReceipt?.receiptNumber} date={generatedReceipt?.date} />
              <RenderReceiptCopy label="Student Copy" student={generatedReceipt?.student} receiptNo={generatedReceipt?.receiptNumber} date={generatedReceipt?.date} />
            </Box>
          </DialogContent>
        </Dialog>

        <InputGuidance
          steps={guidanceSteps}
          activeStep={activeStep}
          onStepComplete={(step) => setActiveStep(step)}
        />
      </Box>
    </LocalizationProvider>
  );
};

export default FeePaymentReceipt;
