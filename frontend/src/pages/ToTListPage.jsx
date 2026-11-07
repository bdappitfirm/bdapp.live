import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  MenuItem,
  CircularProgress,
  Button,
  Stack
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import { scopedGet, scopedPost } from '../utils/schoolApi';
import { useToast } from '../components/Toast';
import { useSchool } from '../context/SchoolContext';
import { sortStudentsByRoll } from '../utils/helpers';

// Simple Row Component without memo to avoid potential HMR issues
const StudentRow = ({ student, index, handleManualChange }) => {
  return (
    <TableRow sx={{
      '&:nth-of-type(even)': { bgcolor: '#f9f9f9' },
      height: { xs: '50px', print: '12.5mm' }
    }}>
      <TableCell sx={{ p: 0.2, textAlign: 'center', fontSize: '10pt', border: '1pt solid black', color: 'black' }}>{index + 1}</TableCell>
      <TableCell sx={{
        fontWeight: 400,
        p: 0.5,
        fontSize: '10pt',
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        border: '1pt solid black',
        color: 'black'
      }}>
        {student.first_name} {student.last_name}
      </TableCell>
      <TableCell sx={{ p: 0, border: '1pt solid black' }}>
        <input
          className="tot-cell-input no-print"
          value={student.father_name || ''}
          onFocus={(e) => e.target.select()}
          onChange={(e) => handleManualChange(student.id, 'father_name', e.target.value)}
          style={{ fontSize: '10pt', padding: '4px', width: '100%', border: 'none', background: 'transparent', outline: 'none' }}
        />
        <Box className="print-only" sx={{ p: '2px', fontSize: '10pt', color: 'black', minHeight: '10mm', display: 'flex', alignItems: 'center' }}>{student.father_name}</Box>
      </TableCell>
      <TableCell sx={{ p: 0, border: '1pt solid black' }}>
        <input
          className="tot-cell-input no-print"
          value={student.mother_name || ''}
          onFocus={(e) => e.target.select()}
          onChange={(e) => handleManualChange(student.id, 'mother_name', e.target.value)}
          style={{ fontSize: '10pt', padding: '4px', width: '100%', border: 'none', background: 'transparent', outline: 'none' }}
        />
        <Box className="print-only" sx={{ p: '2px', fontSize: '10pt', color: 'black', minHeight: '10mm', display: 'flex', alignItems: 'center' }}>{student.mother_name}</Box>
      </TableCell>
      <TableCell sx={{ p: 0, border: '1pt solid black' }}>
        <input
          className="tot-cell-input no-print"
          value={student.manual_admission_date || ''}
          onFocus={(e) => e.target.select()}
          onChange={(e) => handleManualChange(student.id, 'manual_admission_date', e.target.value)}
          placeholder="DD/MM/YY"
          style={{ fontSize: '10pt', padding: '4px', width: '100%', border: 'none', textAlign: 'center', background: 'transparent', outline: 'none' }}
        />
        <Box className="print-only" sx={{ p: '2px', fontSize: '10pt', textAlign: 'center', color: 'black', minHeight: '10mm', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}>{student.manual_admission_date}</Box>
      </TableCell>
      <TableCell align="center" sx={{ p: 0.2, fontSize: '10pt', border: '1pt solid black', color: 'black' }}>{student.roll_number || ''}</TableCell>
      <TableCell align="center" sx={{ p: 0.2, fontSize: '10pt', border: '1pt solid black', color: 'black' }}>{student.section?.name || ''}</TableCell>
      <TableCell sx={{ p: 0, border: '1pt solid black' }}>
        <input
          className="tot-cell-input no-print"
          value={student.manual_subjects || ''}
          onFocus={(e) => e.target.select()}
          onChange={(e) => handleManualChange(student.id, 'manual_subjects', e.target.value)}
          style={{ fontSize: '9pt', padding: '4px', width: '100%', border: 'none', background: 'transparent', outline: 'none' }}
          placeholder="পঠিত বিষয়সমূহ..."
        />
        <Box className="print-only" sx={{
          p: '2px 4px',
          fontSize: '9pt',
          lineHeight: 1.2,
          color: 'black',
          whiteSpace: 'normal',
          wordBreak: 'normal',
          overflowWrap: 'break-word',
          display: 'block',
          width: '100%'
        }}>
          {student.manual_subjects?.split(',').map(s => s.trim()).join(', ')}
        </Box>
      </TableCell>
    </TableRow>
  );
};

export default function ToTListPage() {
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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [, setAutoSaveStatus] = useState('idle');

  const autoSaveTimerRef = useRef(null);
  const studentsRef = useRef([]);

  useEffect(() => {
    studentsRef.current = students;
  }, [students]);

  const classroomNameDisplay = useMemo(() => {
    const cls = classrooms.find(c => String(c.id) === String(selectedClassroom));
    return cls ? cls.name : '';
  }, [classrooms, selectedClassroom]);

  const sectionNameDisplay = useMemo(() => {
    const sec = sections.find(s => String(s.id) === String(selectedSection));
    return sec ? sec.name : 'All';
  }, [sections, selectedSection]);

  const updateUrl = useCallback((cls, sec) => {
    const params = new URLSearchParams();
    if (cls) params.set('classroom', cls);
    if (sec) params.set('section', sec);
    navigate(`${location.pathname}?${params.toString()}`);
  }, [location.pathname, navigate]);

  const processStudentNames = (studentList, currentSubjects = []) => {
    if (!Array.isArray(studentList)) return [];
    const defaultSubjectList = currentSubjects.map(s => s.name).join(', ');
    return studentList.map(s => {
      let fName = s.father_name || '';
      let mName = s.mother_name || '';
      let gName = s.guardian_name || s.parent_name || '';
      if (!gName && s.guardian) {
        if (s.guardian.user) {
          gName = `${s.guardian.user.first_name || ''} ${s.guardian.user.last_name || ''}`.trim();
        } else if (s.guardian.first_name) {
          gName = `${s.guardian.first_name} ${s.guardian.last_name || ''}`.trim();
        } else if (s.guardian.name) {
          gName = s.guardian.name;
        }
      }
      const gGender = String(s.guardian_gender || s.guardian?.gender || s.guardian?.user?.gender || '').toLowerCase();
      if (!fName && gName) {
        if (!gGender || gGender === 'male' || gGender === 'man' || gGender === 'পুরুষ') fName = gName;
      }
      if (!mName && gName && (gGender === 'female' || gGender === 'woman' || gGender === 'মহিলা' || gGender === 'নারী')) mName = gName;

      let sFirstName = s.user?.first_name || '';
      let sLastName = s.user?.last_name || '';
      if (sLastName.trim() && sFirstName.trim().includes(sLastName.trim())) sLastName = '';

      return {
        ...s,
        father_name: fName,
        mother_name: mName,
        first_name: sFirstName,
        last_name: sLastName,
        manual_admission_date: s.admission_date || '',
        manual_subjects: (s.subjects_list !== null && s.subjects_list !== undefined) ? s.subjects_list : defaultSubjectList
      };
    });
  };

  const performAutoSaveEffect = useCallback(async () => {
    const studentsToSave = studentsRef.current;
    if (studentsToSave.length === 0) return;
    try {
      const parseDate = (dateStr) => {
        if (!dateStr) return null;
        const parts = String(dateStr).split('/');
        if (parts.length === 3) {
          let [d, m, y] = parts;
          if (y.length === 2) y = '20' + y;
          return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        return dateStr;
      };
      const updates = studentsToSave.map(s => ({
          id: s.id,
          father_name: s.father_name,
          mother_name: s.mother_name,
          admission_date: parseDate(s.manual_admission_date),
          section_id: s.section_id || s.section?.id || s.section,
          subjects_list: s.manual_subjects
      }));
      await scopedPost(`/api/academics/students/bulk_update_students/`, id, { updates });
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 3000);
    } catch (err) {
      setAutoSaveStatus('idle');
    }
  }, [id]);

  const handleManualChange = useCallback((studentId, field, value) => {
    setStudents(prev => {
        const next = [...prev];
        const idx = next.findIndex(s => String(s.id) === String(studentId));
        if (idx > -1) next[idx] = { ...next[idx], [field]: value };
        return next;
    });
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => { performAutoSaveEffect(); }, 2000);
  }, [performAutoSaveEffect]);

  const loadData = useCallback(async (clsId, secId) => {
    const targetCls = clsId || selectedClassroom;
    const targetSec = secId || selectedSection;
    if (!targetCls) return;
    setLoading(true);
    try {
      const subjRes = await scopedGet('/api/academics/subjects/', id, { classroom: targetCls });
      const subjData = Array.isArray(subjRes.data) ? subjRes.data : (subjRes.data?.results || []);
      const params = { classroom: targetCls };
      if (targetSec && targetSec !== "") params.section = targetSec;
      const res = await scopedGet('/api/academics/students/', id, params);
      const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      const sorted = sortStudentsByRoll(data);
      setStudents(processStudentNames(sorted, subjData));
    } catch (error) {
      toast.error('শিক্ষার্থী তালিকা লোড করতে ব্যর্থ হয়েছে');
    } finally {
      setLoading(false);
    }
  }, [id, selectedClassroom, selectedSection, toast]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cls = params.get('classroom');
    const sec = params.get('section');
    if (cls && cls !== selectedClassroom) setSelectedClassroom(cls);
    if (sec && sec !== selectedSection) setSelectedSection(sec);
    if (cls) loadData(cls, sec);
  }, [location.search, selectedClassroom, selectedSection, loadData]);

  useEffect(() => {
    if (id) {
      scopedGet('/api/academics/classrooms/', id)
        .then(res => setClassrooms(Array.isArray(res.data) ? res.data : (res.data?.results || [])))
        .catch(() => toast.error('শ্রেণি লোড করতে ব্যর্থ হয়েছে'));
    }
  }, [id, toast]);

  useEffect(() => {
    if (id && selectedClassroom) {
      scopedGet('/api/academics/sections/', id, { classroom: selectedClassroom })
        .then(res => setSections(Array.isArray(res.data) ? res.data : (res.data?.results || [])))
        .catch(() => setSections([]));
    } else {
      setSections([]);
    }
  }, [id, selectedClassroom]);

  const handleSaveAll = async () => {
    if (students.length === 0) return;
    setSaving(true);
    try {
      const parseDate = (dateStr) => {
        if (!dateStr) return null;
        const parts = String(dateStr).split('/');
        if (parts.length === 3) {
          let [d, m, y] = parts;
          if (y.length === 2) y = '20' + y;
          return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        return dateStr;
      };
      const updates = students.map(s => ({
          id: s.id,
          father_name: s.father_name,
          mother_name: s.mother_name,
          admission_date: parseDate(s.manual_admission_date),
          section_id: s.section_id || s.section?.id || s.section,
          subjects_list: s.manual_subjects
      }));
      await scopedPost(`/api/academics/students/bulk_update_students/`, id, { updates });
      toast.success('তথ্য সংরক্ষিত হয়েছে');
      loadData();
    } catch (err) {
      toast.error('সংরক্ষণ করতে সমস্যা হয়েছে');
    } finally {
      setSaving(false);
    }
  };

  const chunkedStudents = useMemo(() => {
    const chunks = [];
    const chunkSize = 12;
    for (let i = 0; i < students.length; i += chunkSize) {
      chunks.push(students.slice(i, i + chunkSize));
    }
    return chunks;
  }, [students]);

  return (
    <Box sx={{ p: 3 }}>
      <div className="print-content-wrapper">
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }} className="no-print">
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>শিক্ষার্থী তালিকা</Typography>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" color="success" onClick={handleSaveAll} disabled={students.length === 0 || saving}>
              {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
            </Button>
            <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()} disabled={students.length === 0}>প্রিন্ট</Button>
          </Stack>
        </Stack>

        <Paper sx={{ p: 2, mb: 3 }} className="no-print">
          <Stack direction="row" spacing={2}>
            <TextField select label="শ্রেণি" value={selectedClassroom} onChange={(e) => { setSelectedClassroom(e.target.value); updateUrl(e.target.value, ''); }} fullWidth size="small">
              {classrooms.map((cls) => (<MenuItem key={cls.id} value={cls.id}>{cls.name}</MenuItem>))}
            </TextField>
            <TextField select label="শাখা" value={selectedSection} onChange={(e) => { setSelectedSection(e.target.value); updateUrl(selectedClassroom, e.target.value); }} fullWidth size="small">
              <MenuItem value="">সব</MenuItem>
              {sections.map((sec) => (<MenuItem key={sec.id} value={sec.id}>{sec.name}</MenuItem>))}
            </TextField>
            <Button variant="contained" color="success" onClick={() => loadData()}>দেখুন</Button>
          </Stack>
        </Paper>

        <Box sx={{ width: '100%', position: 'relative' }}>
          {loading && <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4 }} />}
          {students.length > 0 && (
            <Box className="printable-area">
              {chunkedStudents.map((chunk, cIdx) => (
                <Box key={cIdx} className="print-page-break" sx={{ width: '100%', mb: 4 }}>
                  <Box className="print-only page-header-box" sx={{ display: 'flex', alignItems: 'center', mb: 1, borderBottom: '1.5pt solid #2e7d32', pb: 0.5, width: '100%' }}>
                    {schoolInfo?.logo && <Box component="img" src={schoolInfo.logo} sx={{ height: '15mm', width: '15mm', objectFit: 'contain' }} />}
                    <Box sx={{ flex: 1, textAlign: 'center', px: 2 }}>
                      <Typography sx={{ fontWeight: 'bold', fontSize: '15pt', lineHeight: 1.1 }}>{schoolInfo?.bn_name || schoolInfo?.name}</Typography>
                      <Typography sx={{ fontSize: '11pt', fontWeight: 600, mt: 0.2 }}>শিক্ষার্থী তালিকা</Typography>
                      <Typography sx={{ fontSize: '9.5pt', mt: 0.2 }}>শ্রেণি: {classroomNameDisplay} | শাখা: {sectionNameDisplay}</Typography>
                    </Box>
                    {schoolInfo?.logo && <Box component="img" src={schoolInfo.logo} sx={{ height: '15mm', width: '15mm', objectFit: 'contain' }} />}
                  </Box>
                  <Box sx={{ width: '100%', m: 0, p: 0 }}>
                    <Table sx={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', border: '1pt solid black' }} size="small">
                      <colgroup>
                        <col style={{ width: '3%' }} />
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '5%' }} />
                        <col style={{ width: '6%' }} />
                        <col style={{ width: 'auto' }} />
                      </colgroup>
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#eee' }}>
                          {['ক্র.', 'শিক্ষার্থীর নাম', 'পিতার নাম', 'মাতার নাম', 'ভর্তির তারিখ', 'রোল', 'শাখা', 'পঠিত বিষয়'].map((h, i) => (
                            <TableCell key={i} sx={{ fontWeight: 'bold', border: '1pt solid black', p: 0.5, textAlign: 'center', fontSize: '9.5pt', color: 'black' }}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {chunk.map((student, sIdx) => (
                          <StudentRow key={student.id} student={student} index={cIdx * 12 + sIdx} handleManualChange={handleManualChange} />
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: flex !important; }
          .print-page-break {
            page-break-after: always;
            margin: 0 !important;
            padding: 8mm 0 0 0 !important;
            width: 100% !important;
            min-height: auto !important;
            overflow: visible !important;
            box-sizing: border-box !important;
          }
          @page {
            size: A4 landscape;
            margin: 0 !important;
          }
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            -webkit-print-color-adjust: exact;
          }
          .printable-area {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 5mm !important;
          }
          .print-content-wrapper {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          td, th {
            border: 1pt solid black !important;
            padding: 2px !important;
            box-sizing: border-box !important;
          }
        }
        .tot-cell-input:focus { background: rgba(46, 125, 50, 0.05); }
        .print-only { display: none; }
      `}</style>
    </Box>
  );
}
