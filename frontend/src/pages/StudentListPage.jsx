import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, MenuItem, Button, Stack, Menu
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { scopedGet, scopedPost } from '../utils/schoolApi';
import { useToast } from '../components/Toast';
import { useSchool } from '../context/SchoolContext';
import { getCleanDisplayName, transliterateBangla } from '../utils/helpers';
import dayjs from 'dayjs';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export default function StudentListPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { school: schoolInfo } = useSchool();

  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassroom, setSelectedClassroom] = useState('');
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [students, setStudents] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]);
  const [, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved', 'error'
  const [downloadAnchor, setDownloadAnchor] = useState(null);

  const autoSaveTimerRef = useRef(null);
  const studentsRef = useRef([]);

  useEffect(() => { studentsRef.current = students; }, [students]);

  const handleDownloadClick = (event) => setDownloadAnchor(event.currentTarget);
  const handleDownloadClose = () => setDownloadAnchor(null);

  const updateUrl = useCallback((cls, sec) => {
    const params = new URLSearchParams();
    if (cls) params.set('classroom', cls);
    if (sec) params.set('section', sec);
    navigate(`${location.pathname}?${params.toString()}`);
  }, [location.pathname, navigate]);

  const processStudentNames = useCallback((studentList) => {
    if (!Array.isArray(studentList)) return [];
    return studentList.map(s => {
      let fName = s.father_name || '';
      let mName = s.mother_name || '';
      if (!fName && s.guardian) fName = getCleanDisplayName(s.guardian.first_name, s.guardian.last_name);
      let manualBirthDate = s.birth_date ? dayjs(s.birth_date).format('DD/MM/YYYY') : '';
      let manualAdmissionDate = s.admission_date ? dayjs(s.admission_date).format('DD/MM/YYYY') : '';
      return {
        ...s, father_name: fName, mother_name: mName,
        first_name: s.user?.first_name || '',
        first_name_en: s.user?.first_name_en || s.first_name_en || '',
        address: s.address || '', address_en: s.address_en || '',
        phone_number: s.user?.phone_number || '',
        manual_admission_date: manualAdmissionDate, manual_birth_date: manualBirthDate,
        optional_subject_id: s.optional_subject?.id || s.optional_subject,
        student_group: s.student_group || s.group || ''
      };
    });
  }, []);

  const performAutoSaveEffect = useCallback(async () => {
    const studentsToSave = studentsRef.current;
    if (studentsToSave.length === 0) return;
    setSaveStatus('saving');
    try {
      const updates = studentsToSave.map(s => {
          const parseDate = (dateStr, originalDate) => {
              if (!dateStr || dateStr.trim() === '') return null;

              // Try DD/MM/YYYY
              const dmYRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
              const match = dateStr.match(dmYRegex);
              if (match) {
                  const [, d, m, y] = match;
                  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
              }

              // Try YYYY-MM-DD (already correct format)
              const yMdRegex = /^\d{4}-\d{2}-\d{2}$/;
              if (yMdRegex.test(dateStr)) return dateStr;

              // If junk/invalid, return the original date to avoid validation error
              return originalDate;
          };

          const bDate = parseDate(s.manual_birth_date, s.birth_date);
          const aDate = parseDate(s.manual_admission_date, s.admission_date);

          return {
              id: s.id,
              first_name: s.first_name,
              first_name_en: s.first_name_en,
              father_name: s.father_name,
              mother_name: s.mother_name,
              address: s.address,
              address_en: s.address_en,
              phone_number: s.phone_number,
              birth_date: bDate,
              admission_date: aDate,
              roll_number: s.roll_number,
              student_group: s.student_group,
              optional_subject_id: s.optional_subject_id || s.optional_subject?.id || s.optional_subject
          };
      });
      await scopedPost(`/api/academics/students/bulk_update_students/`, id, { updates });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
      toast.error('তথ্য সেভ করতে সমস্যা হয়েছে');
    }
  }, [id, toast]);

  const handleFieldChange = useCallback((studentId, field, value) => {
    setStudents(prev => prev.map(s => {
        if (s.id !== studentId) return s;
        let updated = { ...s, [field]: value };

        // Auto-transliterate fields
        if (field === 'first_name') {
            updated.first_name_en = transliterateBangla(value);
        } else if (field === 'address') {
            updated.address_en = transliterateBangla(value);
        }

        if (field === 'optional_subject_id') {
            const sub = allSubjects.find(sub => String(sub.id) === String(value));
            updated.optional_subject = sub || null;
        }
        return updated;
    }));
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => { performAutoSaveEffect(); }, 2000);
  }, [performAutoSaveEffect, allSubjects]);

  const loadData = useCallback(async (clsId, secId) => {
    const targetCls = clsId || selectedClassroom;
    const targetSec = secId || selectedSection;
    if (!targetCls) return;
    setLoading(true);
    try {
      const res = await scopedGet('/api/academics/students/', id, { classroom: targetCls, section: targetSec || undefined });
      const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);

      // Sort numerically by roll number
      const sorted = [...data].sort((a, b) => {
        const ar = parseInt(String(a.roll_number || '').replace(/\D/g, ''), 10);
        const br = parseInt(String(b.roll_number || '').replace(/\D/g, ''), 10);
        if (!isNaN(ar) && !isNaN(br) && ar !== br) return ar - br;
        return String(a.roll_number || '').localeCompare(String(b.roll_number || ''), undefined, { numeric: true });
      });

      setStudents(processStudentNames(sorted));
    } catch (error) { toast.error('Error loading data'); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, selectedClassroom, selectedSection, processStudentNames]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cls = params.get('classroom');
    const sec = params.get('section') || '';
    if (cls) { setSelectedClassroom(cls); setSelectedSection(sec); }
  }, [location.search]);

  useEffect(() => { if (selectedClassroom && classrooms.length > 0) loadData(selectedClassroom, selectedSection); }, [selectedClassroom, selectedSection, classrooms.length, loadData]);

  useEffect(() => {
    if (id) {
      scopedGet('/api/academics/classrooms/', id).then(res => setClassrooms(Array.isArray(res.data) ? res.data : (res.data?.results || [])));
      scopedGet('/api/academics/subjects/', id, { page_size: 500 }).then(res => setAllSubjects(Array.isArray(res.data) ? res.data : (res.data?.results || [])));
    }
  }, [id]);

  useEffect(() => {
    if (id && selectedClassroom) {
      scopedGet('/api/academics/sections/', id, { classroom: selectedClassroom }).then(res => setSections(Array.isArray(res.data) ? res.data : (res.data?.results || [])));
    } else { setSections([]); }
  }, [id, selectedClassroom]);

  const isNineTen = useMemo(() => {
    const cls = classrooms.find(c => String(c.id) === String(selectedClassroom));
    return cls ? /নবম|দশম|nine|ten|ix|x|\b9\b|\b10\b/i.test(cls.name) : false;
  }, [selectedClassroom, classrooms]);

  const handleDownloadCSV = useCallback(() => {
    if (students.length === 0) return;
    const headers = ['ক্র.', 'নাম', 'পিতা', 'মাতা', 'জন্ম তারিখ', 'রোল', 'শাখা', 'গ্রুপ', '৪র্থ বিষয়'];
    const groupMap = { 'science': 'বিজ্ঞান', 'arts': 'মানবিক', 'commerce': 'ব্যবসায় শিক্ষা' };
    const rows = students.map((s, idx) => [
      idx + 1, s.first_name, s.father_name, s.mother_name, s.manual_birth_date,
      s.roll_number, s.section?.name, groupMap[s.student_group] || s.student_group || '', s.optional_subject?.name || ''
    ]);
    let csv = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\r\n" + rows.map(r => r.join(",")).join("\r\n");
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csv)); link.setAttribute("download", "Students.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  }, [students]);

  const handleDownloadPDF = async () => {
    const element = document.querySelector('.printable-list');
    if (!element) return;
    toast.info('Generating PDF...');
    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      pdf.addImage(imgData, 'PNG', 10, 10, 280, (canvas.height * 280) / canvas.width);
      pdf.save("Student_List.pdf");
      toast.success('Downloaded');
    } catch (e) { toast.error('Failed'); }
  };

  const chunkedStudents = useMemo(() => {
    const chunks = [];
    const chunkSize = 17;
    for (let i = 0; i < students.length; i += chunkSize) { chunks.push(students.slice(i, i + chunkSize)); }
    return chunks;
  }, [students]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, pt: { print: 0 }, pl: { print: 0 } }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 3 }} className="no-print">
        <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>স্টুডেন্ট তালিকা</Typography>
            {saveStatus === 'saving' && <Typography variant="caption" color="primary">সেভ হচ্ছে...</Typography>}
            {saveStatus === 'saved' && <Typography variant="caption" color="success.main">সেভ হয়েছে</Typography>}
            {saveStatus === 'error' && <Typography variant="caption" color="error">সেভ ব্যর্থ হয়েছে</Typography>}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" color="info" onClick={handleDownloadClick} startIcon={<DownloadIcon />}>ডাউনলোড</Button>
          <Menu anchorEl={downloadAnchor} open={Boolean(downloadAnchor)} onClose={handleDownloadClose}>
            <MenuItem onClick={() => { handleDownloadCSV(); handleDownloadClose(); }}>CSV ফাইল</MenuItem>
            <MenuItem onClick={() => { handleDownloadPDF(); handleDownloadClose(); }}>PDF ফাইল</MenuItem>
          </Menu>
          <Button variant="contained" onClick={() => window.print()}>প্রিন্ট</Button>
        </Stack>
      </Stack>

      <Paper sx={{ p: 2, mb: 3 }} className="no-print">
        <Stack direction="row" spacing={2}>
          <TextField select label="শ্রেণি" value={classrooms.some(c => String(c.id) === String(selectedClassroom)) ? selectedClassroom : ''} onChange={(e) => { setSelectedClassroom(e.target.value); updateUrl(e.target.value, ''); }} fullWidth size="small">
            {classrooms.map((cls) => (<MenuItem key={cls.id} value={String(cls.id)}>{cls.name}</MenuItem>))}</TextField>
          <TextField select label="শাখা" value={sections.some(s => String(s.id) === String(selectedSection)) ? selectedSection : ''} onChange={(e) => { setSelectedSection(e.target.value); updateUrl(selectedClassroom, e.target.value); }} fullWidth size="small" disabled={!selectedClassroom}>
            <MenuItem value="">সব শাখা</MenuItem>
            {sections.map((sec) => (<MenuItem key={sec.id} value={String(sec.id)}>{sec.name}</MenuItem>))}</TextField>
        </Stack>
      </Paper>

      <Box className="printable-list" sx={{ width: '100%' }}>
        {chunkedStudents.map((chunk, cIdx) => (
          <Box key={cIdx} className="print-page-break">
            <Box className="print-only" sx={{ mb: 1, mt: cIdx === 0 ? 0 : 4, display: 'none', alignItems: 'center', borderBottom: '2px solid #1976d2', pb: 1, width: '1000px', pr: 2 }}>
                {schoolInfo?.logo && <Box component="img" src={schoolInfo.logo} sx={{ height: '16mm', mr: 2 }} />}
                <Box sx={{ textAlign: 'center', flex: 1 }}>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>{schoolInfo?.bn_name || schoolInfo?.name}</Typography>
                    <Typography variant="h5">শিক্ষার্থী তালিকা</Typography>
                </Box>
                {schoolInfo?.logo && <Box component="img" src={schoolInfo.logo} sx={{ height: '16mm', ml: 2 }} />}
            </Box>
            <TableContainer component={Paper} sx={{ mb: 2, boxShadow: 'none', p: 0 }}>
              <Table size="small" sx={{ tableLayout: 'fixed', width: isNineTen ? '1350px' : '1150px', borderCollapse: 'collapse' }}>
                <colgroup>
                  <col style={{ width: '30px' }} />
                  <col style={{ width: '180px' }} />
                  <col style={{ width: '115px' }} />
                  <col style={{ width: '115px' }} />
                  <col style={{ width: '115px' }} />
                  <col style={{ width: '75px' }} />
                  <col style={{ width: '75px' }} />
                  <col style={{ width: '60px' }} />
                  <col style={{ width: '80px' }} />
                  {isNineTen && (
                    <>
                      <col style={{ width: '80px' }} />
                      <col style={{ width: '120px' }} />
                    </>
                  )}
                  <col style={{ width: '200px' }} />
                  <col style={{ width: '200px' }} />
                  <col style={{ width: '110px' }} />
                </colgroup>
                <TableHead>
                    <TableRow sx={{ bgcolor: '#1976d2' }}>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>ক্র.</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>নাম (First Name)</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>পিতার নাম</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>মাতার নাম</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>জন্ম তারিখ</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>ভর্তির তারিখ</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>রোল</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>শাখা</TableCell>
                        {isNineTen && (
                          <>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>গ্রুপ</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>৪র্থ বিষয়</TableCell>
                          </>
                        )}
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>ঠিকানা</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>ঠিকানা (ইংরেজিতে)</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>মোবাইল</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {chunk.map((s, idx) => (
                      <TableRow key={s.id} sx={{ '&:nth-of-type(even)': { bgcolor: '#f5f5f5' }, height: '35px' }}>
                        <TableCell sx={{ textAlign: 'center', p: 0, m: 0 }}>{cIdx * 17 + idx + 1}</TableCell>
                        <TableCell sx={{ p: 0, m: 0 }}>
                          <input className="sl-cell-input" value={s.first_name || ''} onFocus={(e) => e.target.select()} onChange={(e) => handleFieldChange(s.id, 'first_name', e.target.value)} style={{ fontWeight: 600 }} />
                        </TableCell>
                        <TableCell sx={{ p: 0, m: 0 }}>
                          <input className="sl-cell-input" value={s.father_name || ''} onFocus={(e) => e.target.select()} onChange={(e) => handleFieldChange(s.id, 'father_name', e.target.value)} />
                        </TableCell>
                        <TableCell sx={{ p: 0, m: 0 }}>
                          <input className="sl-cell-input" value={s.mother_name || ''} onFocus={(e) => e.target.select()} onChange={(e) => handleFieldChange(s.id, 'mother_name', e.target.value)} />
                        </TableCell>
                        <TableCell sx={{ p: 0, m: 0 }}>
                          <input className="sl-cell-input" value={s.manual_birth_date || ''} onFocus={(e) => e.target.select()} onChange={(e) => handleFieldChange(s.id, 'manual_birth_date', e.target.value)} style={{ textAlign: 'center' }} />
                        </TableCell>
                        <TableCell sx={{ p: 0, m: 0 }}>
                          <input className="sl-cell-input" value={s.manual_admission_date || ''} onFocus={(e) => e.target.select()} onChange={(e) => handleFieldChange(s.id, 'manual_admission_date', e.target.value)} style={{ textAlign: 'center' }} />
                        </TableCell>
                        <TableCell sx={{ p: 0, m: 0 }}>
                          <input className="sl-cell-input" value={s.roll_number || ''} onFocus={(e) => e.target.select()} onChange={(e) => handleFieldChange(s.id, 'roll_number', e.target.value)} style={{ textAlign: 'center' }} />
                        </TableCell>
                        <TableCell align="center" sx={{ p: 0, m: 0 }}>{s.section?.name || ''}</TableCell>
                        {isNineTen && (
                          <>
                            <TableCell sx={{ p: 0, m: 0 }}>
                              <select className="sl-cell-select" value={s.student_group || ''} onChange={(e) => handleFieldChange(s.id, 'student_group', e.target.value)}>
                                <option value="">নির্বাচন করুন</option>
                                <option value="science">বিজ্ঞান</option>
                                <option value="arts">মানবিক</option>
                                <option value="commerce">ব্যবসায় শিক্ষা</option>
                              </select>
                            </TableCell>
                            <TableCell sx={{ p: 0, m: 0 }}>
                              <select className="sl-cell-select" value={s.optional_subject_id || s.optional_subject?.id || s.optional_subject || ''} onChange={(e) => handleFieldChange(s.id, 'optional_subject_id', e.target.value)}>
                                <option value="">নির্বাচন করুন</option>
                                {allSubjects.filter(sub => {
                                  const n = String(sub.name || '').toLowerCase();
                                  return n.includes('উচ্চতর') || n.includes('higher') || n.includes('কৃষি') || n.includes('agri');
                                }).map(sub => (
                                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                                ))}
                              </select>
                            </TableCell>
                          </>
                        )}
                        <TableCell sx={{ p: 0, m: 0 }}>
                          <input className="sl-cell-input" value={s.address || ''} onFocus={(e) => e.target.select()} onChange={(e) => handleFieldChange(s.id, 'address', e.target.value)} />
                        </TableCell>
                        <TableCell sx={{ p: 0, m: 0 }}>
                          <input className="sl-cell-input" value={s.address_en || ''} onFocus={(e) => e.target.select()} onChange={(e) => handleFieldChange(s.id, 'address_en', e.target.value)} />
                        </TableCell>
                        <TableCell sx={{ p: 0, m: 0 }}>
                          <input className="sl-cell-input" value={s.phone_number || ''} onFocus={(e) => e.target.select()} onChange={(e) => handleFieldChange(s.id, 'phone_number', e.target.value)} />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ))}
      </Box>

      <style>{`
        .sl-cell-input { width: 100%; border: none; border-bottom: 1px solid transparent; padding: 4px; font-family: inherit; font-size: 0.85rem; background: transparent; outline: none; }
        .sl-cell-input:focus { border-bottom: 1px solid #1976d2; background: rgba(0,0,0,0.02); }
        .sl-cell-select { width: 100%; border: none; background: transparent; font-family: inherit; font-size: 0.85rem; outline: none; cursor: pointer; }
        .sl-cell-select:focus { background: rgba(0,0,0,0.02); }
        .print-only { display: none; }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: flex !important; }
          @page { size: landscape; margin: 10mm; }
          body { margin: 0 !important; padding: 0 !important; }
          .printable-list { margin: 0 !important; padding: 0 !important; }
          .print-page-break { page-break-after: always; break-after: page; margin: 0; padding: 0; }
          table { border-collapse: collapse !important; table-layout: fixed !important; margin: 0 !important; }
          th, td { border: 1px solid #000 !important; font-size: 10pt !important; padding: 1px !important; margin: 0 !important; break-inside: auto !important; }
          .sl-cell-input { font-size: 10pt !important; padding: 0 !important; margin: 0 !important; height: 100%; }
          .MuiPaper-root, .MuiTableContainer-root { border: none !important; box-shadow: none !important; margin: 0 !important; padding: 0 !important; background: transparent !important; }
        }
      `}</style>
    </Box>
  );
}
