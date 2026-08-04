import React, { useState, useEffect, useMemo, Fragment } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TextField,
  Box,
  CircularProgress,
  IconButton,
  Typography,
  MenuItem
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import api from '../utils/api';
import { scopedGet } from '../utils/schoolApi';
import { useToast } from './Toast';

const MONTH_LIST = [
  { id: 1, name: 'জানুয়ারী' }, { id: 2, name: 'ফেব্রুয়ারী' },
  { id: 3, name: 'মার্চ' }, { id: 4, name: 'এপ্রিল' },
  { id: 5, name: 'মে' }, { id: 6, name: 'জুন' },
  { id: 7, name: 'জুলাই' }, { id: 8, name: 'আগস্ট' },
  { id: 9, name: 'সেপ্টেম্বর' }, { id: 10, name: 'অক্টোবর' },
  { id: 11, name: 'নভেম্বর' }, { id: 12, name: 'ডিসেম্বর' }
];

export default function AttendanceReportDialog({ open, onClose, classes = [], schoolId }) {
  const toast = useToast();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());

  const visibleMonths = useMemo(() => {
    const currentMonth = new Date().getMonth() + 1;
    return MONTH_LIST.filter(m => m.id <= currentMonth);
  }, []);

  useEffect(() => {
    if (selectedClass && open) {
      scopedGet('/api/academics/sections/', schoolId, { classroom: selectedClass })
        .then(res => {
          const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
          setSections(data);
        })
        .catch(() => setSections([]));
    } else {
      setSections([]);
    }
  }, [selectedClass, open, schoolId]);

  const loadData = async () => {
    if (!selectedClass) {
      toast.warning('শ্রেণি নির্বাচন করুন');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/api/attendance/summaries/get_by_section/', {
        params: { classroom: selectedClass, section: selectedSection, year, school_id: schoolId }
      });
      setStudents(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error('ডাটা লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (studentId, monthId, field, value) => {
    const val = parseInt(value, 10) || 0;
    setStudents(prev => (prev || []).map(s => {
      if (s.student_id === studentId) {
        const currentSummary = s.summary || { monthly_data: {}, total_present: 0, total_absent: 0 };
        const newMonthlyData = { ...(currentSummary.monthly_data || {}) };
        if (!newMonthlyData[monthId]) newMonthlyData[monthId] = { present: 0, absent: 0 };
        newMonthlyData[monthId][field] = val;

        let totalP = 0, totalA = 0;
        Object.values(newMonthlyData).forEach(m => {
          totalP += (m.present || 0);
          totalA += (m.absent || 0);
        });

        return {
          ...s,
          summary: { ...currentSummary, monthly_data: newMonthlyData, total_present: totalP, total_absent: totalA }
        };
      }
      return s;
    }));
  };

  const handleSave = async () => {
    if (!students || !students.length) return;
    setSaving(true);
    try {
      const records = students.map(s => ({
        student_id: s.student_id,
        monthly_data: s.summary?.monthly_data || {},
        total_present: s.summary?.total_present || 0,
        total_absent: s.summary?.total_absent || 0
      }));

      // Definitively include school_id in the payload
      await api.post('/api/attendance/summaries/bulk_save/', {
        records,
        year,
        school_id: schoolId
      });

      toast.success('হাজিরা রিপোর্ট সফলভাবে সংরক্ষিত হয়েছে');
      onClose();
    } catch (err) {
      console.error('Save failed:', err);
      toast.error('সংরক্ষণ করতে সমস্যা হয়েছে');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle sx={{ m: 0, p: 2, bgcolor: 'primary.main', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" component="span">হাজিরা রিপোর্ট ইনপুট</Typography>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            select
            label="শ্রেণি"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            sx={{ minWidth: 150 }}
            size="small"
          >
            {(classes || []).map(c => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="সেকশন"
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            sx={{ minWidth: 150 }}
            size="small"
            disabled={!selectedClass}
          >
            <MenuItem value="">সব শাখা</MenuItem>
            {(sections || []).map(s => (
              <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="বছর"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            sx={{ width: 100 }}
            size="small"
          />

          <Button variant="contained" onClick={loadData} disabled={!selectedClass || loading}>
            {loading ? <CircularProgress size={24} color="inherit" /> : 'শিক্ষার্থী লোড করুন'}
          </Button>
        </Box>

        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 800, border: '1px solid #ddd' }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell sx={{ border: '1px solid #ddd', fontWeight: 'bold' }} rowSpan={2}>রোল</TableCell>
                <TableCell sx={{ border: '1px solid #ddd', fontWeight: 'bold' }} rowSpan={2}>নাম</TableCell>
                {(visibleMonths || []).map(m => (
                  <TableCell key={m.id} align="center" colSpan={2} sx={{ border: '1px solid #ddd', fontWeight: 'bold' }}>
                    {m.name}
                  </TableCell>
                ))}
                <TableCell align="center" colSpan={2} sx={{ border: '1px solid #ddd', fontWeight: 'bold', bgcolor: '#e3f2fd' }}>মোট</TableCell>
              </TableRow>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                {(visibleMonths || []).map(m => (
                  <Fragment key={m.id}>
                    <TableCell align="center" sx={{ border: '1px solid #ddd', fontSize: '0.75rem', p: 0.5 }}>উ:</TableCell>
                    <TableCell align="center" sx={{ border: '1px solid #ddd', fontSize: '0.75rem', p: 0.5 }}>অ:</TableCell>
                  </Fragment>
                ))}
                <TableCell align="center" sx={{ border: '1px solid #ddd', fontWeight: 'bold', bgcolor: '#e3f2fd' }}>উপস্থিত</TableCell>
                <TableCell align="center" sx={{ border: '1px solid #ddd', fontWeight: 'bold', bgcolor: '#e3f2fd' }}>অনুপস্থিত</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(students || []).map(s => (
                <TableRow key={s.student_id}>
                  <TableCell sx={{ border: '1px solid #ddd' }}>{s.roll}</TableCell>
                  <TableCell sx={{ border: '1px solid #ddd', fontWeight: 'bold', minWidth: 150 }}>{s.name}</TableCell>
                  {(visibleMonths || []).map(m => (
                    <Fragment key={m.id}>
                      <TableCell sx={{ border: '1px solid #ddd', p: 0.5 }}>
                        <TextField
                          type="number"
                          size="small"
                          value={s.summary?.monthly_data?.[m.id]?.present ?? ''}
                          onChange={(e) => handleInputChange(s.student_id, m.id, 'present', e.target.value)}
                          inputProps={{ style: { textAlign: 'center', padding: '2px', fontSize: '12px' } }}
                          variant="standard"
                        />
                      </TableCell>
                      <TableCell sx={{ border: '1px solid #ddd', p: 0.5 }}>
                        <TextField
                          type="number"
                          size="small"
                          value={s.summary?.monthly_data?.[m.id]?.absent ?? ''}
                          onChange={(e) => handleInputChange(s.student_id, m.id, 'absent', e.target.value)}
                          inputProps={{ style: { textAlign: 'center', padding: '2px', fontSize: '12px' } }}
                          variant="standard"
                        />
                      </TableCell>
                    </Fragment>
                  ))}
                  <TableCell align="center" sx={{ border: '1px solid #ddd', fontWeight: 'bold', bgcolor: '#f1f8ff' }}>{s.summary?.total_present || 0}</TableCell>
                  <TableCell align="center" sx={{ border: '1px solid #ddd', fontWeight: 'bold', bgcolor: '#fffde7' }}>{s.summary?.total_absent || 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, bgcolor: '#f9f9f9' }}>
        <Button onClick={onClose} color="inherit">বাতিল</Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving || !students?.length}
        >
          সেভ করুন
        </Button>
      </DialogActions>
    </Dialog>
  );
};
