import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Button,
  Stack,
  Menu,
  MenuItem,
  Tooltip
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import SaveIcon from '@mui/icons-material/Save';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import api from '../utils/api';
import { scopedGet, scopedPost } from '../utils/schoolApi';
import { db } from '../utils/offlineDb';
import { useToast } from '../components/Toast';
import { useSchool } from '../context/SchoolContext';
import { getCleanDisplayName } from '../utils/helpers';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import dayjs from 'dayjs';

// --- HELPERS (Moved outside to prevent ReferenceError) ---

const StudentRow = memo(({ voter, handleManualChange }) => {
    return (
        <TableRow key={voter.id} sx={{ '&:nth-of-type(even)': { bgcolor: '#f9f9f9' } }}>
            <TableCell sx={{ p: 0 }}><input className="vl-cell-input" style={{ fontWeight: 'bold' }} value={voter.voterNumber} onFocus={(e) => e.target.select()} onChange={(e) => handleManualChange(voter.id, 'voterNumber', e.target.value)} /></TableCell>
            <TableCell sx={{ p: 0 }} className="voter-name-cell"><input className="vl-cell-input" value={voter.voterName} onFocus={(e) => e.target.select()} onChange={(e) => handleManualChange(voter.id, 'voterName', e.target.value)} /></TableCell>
            <TableCell sx={{ p: 0.2, pl: 1 }}>{voter.studentName}</TableCell>
            <TableCell sx={{ p: 0.2, textAlign: 'center' }}>{voter.classroom}</TableCell>
            <TableCell sx={{ p: 0.2, textAlign: 'center' }}>{voter.section}</TableCell>
            <TableCell sx={{ p: 0.2, textAlign: 'center' }}>{voter.roll}</TableCell>
            <TableCell sx={{ p: 0 }}><input className="vl-cell-input" value={voter.mobile} onFocus={(e) => e.target.select()} onChange={(e) => handleManualChange(voter.id, 'mobile', e.target.value)} /></TableCell>
            <TableCell sx={{ p: 0 }}><input className="vl-cell-input" value={voter.remarks} onFocus={(e) => e.target.select()} onChange={(e) => handleManualChange(voter.id, 'remarks', e.target.value)} /></TableCell>
        </TableRow>
    );
});

const getClassOrder = (className) => {
  const name = String(className || '').toLowerCase();
  if (name.includes('ষষ্ঠ') || name.includes('six')) return 6;
  if (name.includes('সপ্তম') || name.includes('seven')) return 7;
  if (name.includes('অষ্টম') || name.includes('eight')) return 8;
  if (name.includes('নবম') || name.includes('nine')) return 9;
  if (name.includes('দশম') || name.includes('ten')) return 10; // Keep class 10
  if (name.includes('একাদশ') || name.includes('eleven')) return 11;
  if (name.includes('দ্বাদশ') || name.includes('twelve')) return 12;

  const m = name.match(/\d+/);
  return m ? parseInt(m[0], 10) : 999;
};

// Helper to check if student is SSC examinee
const isSSCExaminee = (className) => {
  const name = String(className || '').toLowerCase();
  return name.includes('এসএসসি') || name.includes('ssc');
};

const getSectionOrder = (sectionName) => {
  const name = String(sectionName || '').toLowerCase();
  if (name.includes('ক') || name === 'a') return 1;
  if (name.includes('খ') || name === 'b') return 2;
  if (name.includes('গ') || name === 'c') return 3;
  return 9;
};

export default function VoterListPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { school: schoolInfo } = useSchool();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');
  const [voters, setVoters] = useState([]);
  const [downloadAnchor, setDownloadAnchor] = useState(null);

  const autoSaveTimerRef = useRef(null);
  const votersRef = useRef([]);

  useEffect(() => {
    votersRef.current = voters;
  }, [voters]);

  const handleDownloadClick = (event) => setDownloadAnchor(event.currentTarget);
  const handleDownloadClose = () => setDownloadAnchor(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await scopedGet('/api/academics/students/', id, { page_size: 5000 });
      const allStudents = Array.isArray(res.data) ? res.data : (res.data?.results || []);

      const guardianGroups = new Map();
      allStudents.forEach(s => {
        // Exclude SSC examinees (এসএসসি পরীক্ষার্থী)
        if (isSSCExaminee(s.classroom?.name)) return;
        
        // Grouping Key based strictly on Linked Guardian ID
        // If not linked, treat as independent to avoid wrong grouping of same-name parents
        let groupKey = null;
        if (s.guardian?.id || (typeof s.guardian === 'number' && s.guardian)) {
            groupKey = `gid-${s.guardian?.id || s.guardian}`;
        } else {
            groupKey = `independent-${s.id}`;
        }

        if (!guardianGroups.has(groupKey)) guardianGroups.set(groupKey, []);
        guardianGroups.get(groupKey).push(s);
      });

      const processedVoters = [];
      Array.from(guardianGroups.values()).forEach(group => {
        // Sort students within the group (by class/roll)
        const sortedGroup = [...group].sort((a, b) => {
          const classA = getClassOrder(a.classroom?.name);
          const classB = getClassOrder(b.classroom?.name);
          if (classA !== classB) return classA - classB;

          const rollA = parseInt(String(a.roll_number || '9999').replace(/\D/g, ''), 10);
          const rollB = parseInt(String(b.roll_number || '9999').replace(/\D/g, ''), 10);
          return rollA - rollB;
        });

        const linkedStudent = sortedGroup[0];

        // Voter Name Logic:
        // 1. Father's Name is priority
        // 2. Linked Guardian's Name (if it's an object)
        // 3. Mother's name as last resort
        let voterName = (linkedStudent.father_name || '').trim();
        if (!voterName && linkedStudent.guardian && typeof linkedStudent.guardian === 'object') {
            const g = linkedStudent.guardian;
            voterName = getCleanDisplayName(g.first_name, g.last_name);
        }
        if (!voterName) {
            voterName = (linkedStudent.guardian_name || linkedStudent.mother_name || '').trim();
        }

        // Student name logic: List all students for this voter with basic info and fix duplication
        const studentNames = sortedGroup.map(s =>
          getCleanDisplayName(s.user?.first_name, s.user?.last_name)
        ).join(', ');

        processedVoters.push({
          id: linkedStudent.id,
          voterName: voterName,
          studentName: studentNames,
          classroom: (linkedStudent.classroom?.name || '').replace(/শ্রেণি|শ্রেণী|class/gi, '').trim(),
          section: linkedStudent.section?.name || '',
          roll: linkedStudent.roll_number || '',
          mobile: linkedStudent.guardian?.phone_number || linkedStudent.phone_number || linkedStudent.user?.phone_number || '',
          remarks: linkedStudent.remarks || '',
          dbVoterNumber: linkedStudent.voter_number
        });
      });

      processedVoters.sort((a, b) => {
        const classA = getClassOrder(a.classroom);
        const classB = getClassOrder(b.classroom);
        if (classA !== classB) return classA - classB;

        const secA = getSectionOrder(a.section);
        const secB = getSectionOrder(b.section);
        if (secA !== secB) return secA - secB;

        const rollA = parseInt(String(a.roll || '9999').replace(/\D/g, ''), 10);
        const rollB = parseInt(String(b.roll || '9999').replace(/\D/g, ''), 10);
        return rollA - rollB;
      });

      const votersWithNumbers = processedVoters.map((v, idx) => ({
        ...v,
        voterNumber: v.dbVoterNumber || String(idx + 1).padStart(3, '0')
      }));

      setVoters(votersWithNumbers);
    } catch (err) {
      console.error(err);
      toast.error('ভোটার তালিকা লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    const checkLocal = async () => {
        const cached = await db.students.toArray();
        if (cached.length > 0 && voters.length === 0) {
            loadData();
        }
    };
    if (id) {
        checkLocal();
        loadData();
    }
  }, [id, loadData, voters.length]);

  const performAutoSaveEffect = useCallback(async () => {
    const votersToSave = votersRef.current;
    if (votersToSave.length === 0) return;

    try {
      const updates = votersToSave.map(v => ({
          id: v.id,
          guardian_name: v.voterName,
          phone_number: v.mobile,
          remarks: v.remarks,
          roll_number: v.roll,
          voter_number: v.voterNumber
      }));
      await scopedPost(`/api/academics/students/bulk_update_students/`, id, { updates });
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 3000);
    } catch (err) {
      console.error("Auto-save failed", err);
      setAutoSaveStatus('idle');
    }
  }, []);

  const handleManualChange = useCallback((studentId, field, value) => {
    setVoters(prev => prev.map(v => v.id === studentId ? { ...v, [field]: value } : v));

    // Auto-save Logic (Debounced)
    setAutoSaveStatus('saving');
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
        performAutoSaveEffect();
    }, 2000);
  }, [performAutoSaveEffect]);

  const handleSaveAll = async () => {
    if (voters.length === 0) return;
    setSaving(true);
    try {
      const updates = voters.map(v => ({
          id: v.id,
          guardian_name: v.voterName, // Save to guardian_name instead of father_name
          phone_number: v.mobile,
          remarks: v.remarks,
          roll_number: v.roll,
          voter_number: v.voterNumber
      }));
      await scopedPost(`/api/academics/students/bulk_update_students/`, id, { updates });
      toast.success('সকল তথ্য সংরক্ষিত হয়েছে');
      loadData();
    } catch (err) {
      toast.error('সংরক্ষণ করতে সমস্যা হয়েছে');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadCSV = () => {
    if (voters.length === 0) return;
    const headers = ['ভোটার নাম্বার', 'ভোটারের নাম', 'শিক্ষার্থীর নাম', 'শ্রেণি', 'সেকশন', 'রোল', 'মোবাইল নম্বর', 'মন্তব্য'];
    const rows = voters.map(v => [v.voterNumber, v.voterName, v.studentName, v.classroom, v.section, v.roll, v.mobile, v.remarks]);
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\r\n";
    rows.forEach(row => { csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",") + "\r\n"; });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Voter_List.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPDF = async () => {
    if (voters.length === 0) return;
    const element = document.getElementById('printable-voter-list');
    if (!element) return;

    toast.info('পিডিএফ তৈরি হচ্ছে...');
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const imgWidth = 280;
      const pageHeight = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 10, position + 10, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position + 10, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`Voter_List_${dayjs().format('YYYY-MM-DD')}.pdf`);
      toast.success('পিডিএফ ডাউনলোড সফল হয়েছে');
    } catch (e) {
      console.error(e);
      toast.error('পিডিএফ তৈরি করা যায়নি');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Print-only Header */}
      <Box className="print-only print-header">
        {schoolInfo?.logo && (
          <Box
            component="img"
            src={schoolInfo.logo}
            alt="School Logo Left"
            sx={{ height: '20mm', objectFit: 'contain' }}
          />
        )}
        <Box sx={{ textAlign: 'center', flex: 1 }}>
          <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#1976d2', fontSize: '1.8rem !important' }}>{schoolInfo?.bn_name || schoolInfo?.name}</Typography>
          <Typography variant="h4" sx={{ fontWeight: 'medium', mt: 0.5, fontSize: '1.4rem !important' }}>ভোটার তালিকা</Typography>
        </Box>
        {schoolInfo?.logo && (
          <Box
            component="img"
            src={schoolInfo.logo}
            alt="School Logo Right"
            sx={{ height: '20mm', objectFit: 'contain' }}
          />
        )}
      </Box>

      {/* Print Content Wrapper */}
      <div className="print-content-wrapper">
        {/* UI Elements */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }} className="no-print">
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>ভোটার তালিকা</Typography>
            {autoSaveStatus === 'saving' && <CircularProgress size={20} />}
            {autoSaveStatus === 'saved' && <Tooltip title="স্বয়ংক্রিয়ভাবে সংরক্ষিত হয়েছে"><CloudDoneIcon color="success" /></Tooltip>}
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" color="success" startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />} onClick={handleSaveAll} disabled={voters.length === 0 || saving}>
              {saving ? 'সেভ হচ্ছে...' : 'সব তথ্য সেভ করুন'}
            </Button>
            <Button variant="contained" color="info" startIcon={<DownloadIcon />} onClick={handleDownloadClick} disabled={voters.length === 0}>ডাউনলোড</Button>
            <Menu anchorEl={downloadAnchor} open={Boolean(downloadAnchor)} onClose={handleDownloadClose}>
              <MenuItem onClick={() => { handleDownloadCSV(); handleDownloadClose(); }}>CSV ফাইল (Excel)</MenuItem>
              <MenuItem onClick={() => { handleDownloadPDF(); handleDownloadClose(); }}>PDF ফাইল</MenuItem>
            </Menu>
            <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()} disabled={voters.length === 0}>প্রিন্ট করুন</Button>
          </Stack>
        </Stack>

        {loading && voters.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 10 }}><CircularProgress /></Box>
        ) : (
          <TableContainer component={Paper} sx={{ boxShadow: 0, borderRadius: 0 }}>
            <Table size="small" id="printable-voter-list">
              <TableHead>
                {/* Spacer for repeating fixed header */}
                <TableRow className="print-header-spacer">
                  <TableCell colSpan={8} sx={{ border: 'none !important', p: 0 }} />
                </TableRow>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '80px' }}>ভোটার নং</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '160px' }}>ভোটারের নাম</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', minWidth: '200px' }}>শিক্ষার্থীর নাম</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '70px' }}>শ্রেণি</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '70px' }}>সেকশন</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '60px' }}>রোল</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '110px' }}>মোবাইল</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '140px' }}>মন্তব্য</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {voters.map((v) => (
                  <StudentRow
                    key={v.id}
                    voter={v}
                    handleManualChange={handleManualChange}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </div>

      <style>{`
        .vl-cell-input { width: 100%; height: 40px; border: none; padding: 8px; font-family: inherit; font-size: 0.85rem; background: transparent; outline: none; }
        .vl-cell-input:focus { background: rgba(25, 118, 210, 0.05); }
        .print-only { display: none; }

        @media print {
          .no-print { display: none !important; }
          .print-only { display: flex !important; }

          @page {
            size: landscape; 
            margin: 8mm 10mm !important;
          }
          
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Fixed Header */
          .print-header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 20mm;
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: white;
            border-bottom: 2px solid #1976d2;
            z-index: 9999;
            padding: 0 10mm;
          }

          .print-header img {
            height: 15mm;
          }

          .print-header h3 { font-size: 1.6rem !important; line-height: 1.1 !important; margin: 0 !important; }
          .print-header h4 { font-size: 1.2rem !important; line-height: 1.1 !important; margin: 0 !important; }

          /* Spacer for repeating fixed header on every page - Matching header height */
          .print-header-spacer {
            display: table-row !important;
            height: 20mm !important;
          }

          #printable-voter-list {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 10pt !important;
            margin-top: 0 !important;
          }

          #printable-voter-list thead {
            display: table-header-group;
          }

          .MuiPaper-root { box-shadow: none !important; border: none !important; }
          #printable-voter-list th, #printable-voter-list td {
            border: 1px solid #000 !important;
            color: black !important;
            padding: 2px 4px !important;
            line-height: 1.2 !important;
            font-size: 10pt !important;
            text-align: center !important;
          }
          .vl-cell-input {
            height: 24px !important;
            padding: 0 1px !important;
            font-size: 10pt !important;
            font-family: inherit !important;
            color: black !important;
            text-align: center !important;
          }
          /* Keep Voter Name on one line but allow others to wrap if needed */
          .voter-name-cell .vl-cell-input {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-align: left !important;
          }
          .voter-name-cell {
            text-align: left !important;
          }
          #printable-voter-list thead tr {
            background-color: #e3f2fd !important;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </Box>
  );
}
