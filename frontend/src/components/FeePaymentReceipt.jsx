import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, FormControl,
  InputLabel, Select, MenuItem, Button, Dialog,
  DialogTitle, DialogContent,
  Divider, Stack, Chip
} from '@mui/material';
import { Receipt } from '@mui/icons-material';
import html2canvas from 'html2canvas';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import api from '../utils/api';
import { useSchool } from '../context/SchoolContext';
import { getMediaUrl } from '../utils/media';
import InputGuidance from './InputGuidance';
import { numberToBengaliWords } from '../utils/helpers';

const FEE_LABELS = [
  { key: 'monthly', label: 'মাসিক বেতন' },
  { key: 'exam', label: 'পরীক্ষার ফি' },
  { key: 'admission', label: 'ভর্তি ফি' },
  { key: 'session', label: 'সেশন ফি' },
  { key: 'reg', label: 'রেজিস্ট্রেশন ফি' },
  { key: 'evaluation', label: 'ষান্মাসিক/বাৎসরিক মূল্যায়ন ফি' },
  { key: 'board', label: 'বোর্ড ফি' },
  { key: 'center', label: 'পরীক্ষার কেন্দ্র ফি' },
  { key: 'ict', label: 'আইসিটি ফি' },
  { key: 'sports', label: 'ক্রীড়া ফি' },
  { key: 'dev', label: 'উন্নয়ন ফি' },
  { key: 'welfare', label: 'বিদ্যুৎ/কল্যাণ ফি' },
  { key: 'tc', label: 'টিসি/প্রশংসা পত্র ফি' },
  { key: 'lab', label: 'কম্পিউটার ল্যাব ফি' },
  { key: 'scouts', label: 'স্কাউটস ফি' }
];

const RenderReceiptCopy = ({ label, student, receiptNo, date, schoolData, manualAmounts, previousDue, isEditable = false, handleManualAmountChange, setPreviousDue, calculateTotal }) => {
  const total = calculateTotal();
  return (
    <Box sx={{ p: { xs: 1, sm: 2 }, bgcolor: 'white', border: '1.5px solid #1a237e', borderRadius: '8px', mb: 1, position: 'relative', overflow: 'hidden' }}>
      {schoolData?.logo && (
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.05, zIndex: 0, width: '60%' }}>
          <img src={getMediaUrl(schoolData.logo)} alt="watermark" style={{ width: '100%' }} />
        </Box>
      )}
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="center" mb={0.5}>
          {schoolData?.logo && <Box component="img" src={getMediaUrl(schoolData.logo)} sx={{ width: 40, height: 40, objectFit: 'contain' }} />}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1a237e', lineHeight: 1.1 }}>{schoolData?.bn_name || schoolData?.name}</Typography>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{schoolData?.address}</Typography>
          </Box>
        </Stack>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}><Chip label={label} size="small" sx={{ bgcolor: '#1a237e', color: 'white', fontWeight: 'bold', height: 18, fontSize: '0.65rem' }} /></Box>
        <Divider sx={{ my: 1, borderColor: '#1a237e' }} />
        <Grid container spacing={1} sx={{ mb: 1, fontSize: '0.75rem' }}>
            <Grid size={{ xs: 6 }}><b>রশিদ নং:</b> {receiptNo}</Grid>
            <Grid size={{ xs: 6 }} align="right"><b>তারিখ:</b> {date}</Grid>
            <Grid size={{ xs: 12 }} sx={{ mt: 0.5, p: 0.5, bgcolor: '#f5f5f5', borderRadius: 1 }}>
               <b>নাম:</b> {student?.user?.first_name} {student?.user?.last_name} | <b>রোল:</b> {student?.roll_number} | <b>শ্রেণি:</b> {student?.classroom?.name}
            </Grid>
        </Grid>

        {/* 2-Column Fee Items Grid */}
        <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 0.5, color: '#1a237e', display: 'block' }}>ফি ও পেমেন্টের বিবরণ:</Typography>
        <Grid container spacing={1} sx={{ mb: 1 }}>
          {FEE_LABELS.map(item => (
            <Grid size={{ xs: 12, sm: 6 }} key={item.key}>
              <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #b0bec5', borderRadius: 1, p: '4px 8px', bgcolor: isEditable ? '#fff' : '#fafafa' }}>
                <Typography sx={{ flexGrow: 1, fontSize: '0.75rem', fontWeight: 500, color: '#37474f' }}>{item.label}</Typography>
                {isEditable ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #1a237e', borderRadius: '6px', bgcolor: '#fff', height: '30px', px: '8px', width: '100px' }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={manualAmounts[item.key] || ''}
                      onChange={(e) => handleManualAmountChange(item.key, e.target.value)}
                      style={{ width: '100%', textAlign: 'right', border: 'none', fontSize: '0.85rem', fontWeight: 600, outline: 'none', background: 'transparent', color: '#1a237e', height: '100%', padding: 0 }}
                      placeholder="0.00"
                    />
                  </Box>
                ) : (
                  <Box sx={{ pr: 1, fontSize: '0.85rem', fontWeight: 'bold', textAlign: 'right', minWidth: '70px', color: '#1a237e' }}>
                    {manualAmounts[item.key] ? Number(manualAmounts[item.key]).toFixed(2) : '0.00'}
                  </Box>
                )}
              </Box>
            </Grid>
          ))}
        </Grid>

        {/* Total & Due (2-Column) */}
        <Grid container spacing={1} sx={{ mb: 1 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', border: '1.5px solid #1a237e', borderRadius: 1, p: '6px 8px', bgcolor: '#e8eaf6' }}>
              <Typography sx={{ flexGrow: 1, fontSize: '0.8rem', fontWeight: 'bold', color: '#1a237e' }}>মোট (Total)</Typography>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: '#1a237e', textAlign: 'right', pr: 1 }}>
                ৳{total.toFixed(2)}
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #b0bec5', borderRadius: 1, p: '4px 8px', bgcolor: isEditable ? '#fff' : '#fafafa' }}>
              <Typography sx={{ flexGrow: 1, fontSize: '0.75rem', fontWeight: 500, color: '#37474f' }}>অবশিষ্ট বকেয়া</Typography>
              {isEditable ? (
                <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid #1a237e', borderRadius: '6px', bgcolor: '#fff', height: '30px', px: '8px', width: '100px' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={previousDue}
                    onChange={(e) => setPreviousDue(e.target.value)}
                    style={{ width: '100%', textAlign: 'right', border: 'none', fontSize: '0.85rem', fontWeight: 600, outline: 'none', background: 'transparent', color: '#d32f2f', height: '100%', padding: 0 }}
                    placeholder="0.00"
                  />
                </Box>
              ) : (
                <Box sx={{ pr: 1, fontSize: '0.85rem', fontWeight: 'bold', textAlign: 'right', minWidth: '70px', color: '#d32f2f' }}>
                  {previousDue ? Number(previousDue).toFixed(2) : '0.00'}
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>

        <Typography sx={{ mt: 1, fontSize: '0.75rem', fontWeight: 500 }}><b>কথায়:</b> {total > 0 ? `${numberToBengaliWords(total)} টাকা মাত্র` : '---'}</Typography>
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 2.5 }}>
          <Box sx={{ textAlign: 'center' }}><Box sx={{ borderTop: '1px solid #000', width: 90, mt: 1 }} /><Typography sx={{ fontSize: '0.6rem' }}>আদায়কারীর স্বাক্ষর</Typography></Box>
          <Box sx={{ textAlign: 'center' }}>
            {schoolData?.principal_signature && <Box component="img" src={getMediaUrl(schoolData.principal_signature)} sx={{ height: 20, display: 'block', mx: 'auto' }} />}
            <Box sx={{ borderTop: '1px solid #000', width: 90 }} /><Typography sx={{ fontSize: '0.6rem' }}>প্রধান শিক্ষকের স্বাক্ষর</Typography>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
};

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
  const [receiptDate, setReceiptDate] = useState(dayjs());
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
    if (w) {
      w.document.write(`
        <html>
          <head>
            <style>
              @page { size: A4 landscape; margin: 6mm; }
              body { margin: 0; padding: 0; background: #fff; text-align: center; }
              img { width: 100%; max-height: 195mm; object-fit: contain; }
            </style>
          </head>
          <body>
            <img src="${img}" />
          </body>
        </html>
      `);
      w.document.close();
      setTimeout(() => { w.print(); w.close(); }, 500);
    }
  };

  const handleSaveAndPrint = async () => {
    if (!generatedReceipt?.student) return;
    const total = calculateTotal();
    if (total <= 0) {
      alert('দয়া করে অন্তত একটি ফি এর পরিমাণ লিখুন।');
      return;
    }
    try {
      const payload = {
        student_id: generatedReceipt.student.id,
        amount: total,
        payment_date: receiptDate ? dayjs(receiptDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        payment_method: 'cash',
        reference: generatedReceipt.receiptNumber,
        school: schoolId,
        due_amount: parseFloat(previousDue) || 0,
        sports_fee: parseFloat(manualAmounts['sports']) || 0,
        admission_fee: parseFloat(manualAmounts['admission']) || 0,
        cert_reg_fee: parseFloat(manualAmounts['reg']) || 0,
        tuition_fee: parseFloat(manualAmounts['monthly']) || 0,
        session_fee: parseFloat(manualAmounts['session']) || 0,
        exam_fee: (parseFloat(manualAmounts['exam']) || 0) + (parseFloat(manualAmounts['evaluation']) || 0) + (parseFloat(manualAmounts['center']) || 0),
        misc_fee: (parseFloat(manualAmounts['board']) || 0) + (parseFloat(manualAmounts['ict']) || 0) + (parseFloat(manualAmounts['dev']) || 0) + (parseFloat(manualAmounts['welfare']) || 0) + (parseFloat(manualAmounts['tc']) || 0) + (parseFloat(manualAmounts['lab']) || 0) + (parseFloat(manualAmounts['scouts']) || 0)
      };

      await api.post('/api/fees/payments/', payload);
      alert('রসিদ সফলভাবে পেমেন্ট হিসেবে সেভ হয়েছে এবং দৈনিক আদায় রেজিস্টারে যুক্ত হয়েছে!');
      printReceipt();
    } catch (e) {
      console.error('Save payment error:', e);
      alert('পেমেন্ট সেভ করতে সমস্যা হয়েছে।');
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: { xs: 1, sm: 3 } }}>
        <Typography variant="h5" gutterBottom fontWeight="bold"><Receipt /> ফি রশিদ জেনারেটর</Typography>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 3 }}>
                <DatePicker
                  label="পেমেন্টের তারিখ"
                  value={receiptDate}
                  onChange={(newDate) => setReceiptDate(newDate)}
                  format="DD/MM/YYYY"
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <FormControl id="class-select" fullWidth>
                  <InputLabel>শ্রেণি</InputLabel>
                  <Select value={selectedClass} onChange={(e) => handleClassChange(e.target.value)} label="শ্রেণি">
                    {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <FormControl id="section-select" fullWidth disabled={!selectedClass}>
                  <InputLabel>সেকশন</InputLabel>
                  <Select value={selectedSection} onChange={(e) => handleSectionChange(e.target.value)} label="সেকশন">
                    {sections.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
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

        <Dialog open={receiptOpen} onClose={() => setReceiptOpen(false)} maxWidth="lg" fullWidth PaperProps={{ sx: { maxWidth: '1280px', width: '100%' } }}>
          <DialogTitle sx={{ bgcolor: '#1a237e', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            রশিদ এডিট ও প্রিন্ট
            <Box display="flex" gap={1}>
              <Button onClick={handleSaveAndPrint} variant="contained" color="warning" sx={{ fontWeight: 'bold' }}>সেভ ও প্রিন্ট</Button>
              <Button onClick={printReceipt} variant="contained" color="success">শুধু প্রিন্ট</Button>
            </Box>
          </DialogTitle>
          <DialogContent dividers sx={{ bgcolor: '#f0f2f5', p: 2 }}>
            <Box id="receipt-content" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4, alignItems: 'start', bgcolor: '#fff', p: 2 }}>
              <RenderReceiptCopy label="Office Copy" student={generatedReceipt?.student} receiptNo={generatedReceipt?.receiptNumber} date={generatedReceipt?.date} schoolData={schoolData} manualAmounts={manualAmounts} previousDue={previousDue} isEditable={true} handleManualAmountChange={handleManualAmountChange} setPreviousDue={setPreviousDue} calculateTotal={calculateTotal} />
              <RenderReceiptCopy label="Student Copy" student={generatedReceipt?.student} receiptNo={generatedReceipt?.receiptNumber} date={generatedReceipt?.date} schoolData={schoolData} manualAmounts={manualAmounts} previousDue={previousDue} isEditable={false} handleManualAmountChange={handleManualAmountChange} setPreviousDue={setPreviousDue} calculateTotal={calculateTotal} />
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
