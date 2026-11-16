import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Box, Button, Checkbox, Chip, CircularProgress, Divider, FormControl, InputAdornment,
  InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import SearchIcon from '@mui/icons-material/Search';
import BadgeIcon from '@mui/icons-material/Badge';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import EmployeeIDCard from '../components/EmployeeIDCard';

const EMPLOYMENT_STATUS = [
  { value: 'active', label: 'Active (কর্মরত)' },
  { value: 'inactive', label: 'Inactive (নিষ্ক্রিয়)' },
  { value: 'resigned', label: 'Resigned (পদত্যাগী)' },
];

/** Wait until every <img> inside the container has finished loading. */
const waitForImages = (container) => new Promise((resolve) => {
  if (!container) { resolve(); return; }
  const imgs = Array.from(container.querySelectorAll('img'));
  const pending = imgs.filter((img) => !img.complete || img.naturalHeight === 0);
  if (pending.length === 0) { resolve(); return; }
  let remaining = pending.length;
  const done = () => { remaining -= 1; if (remaining <= 0) resolve(); };
  pending.forEach((img) => {
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  });
  setTimeout(resolve, 2500);
});

/** Inject the @page rule into <head> so browser header/footer are removed. */
const injectPrintPageStyle = () => {
  const id = 'emp-id-card-print-page';
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    el.textContent = '@page { size: A4 portrait; margin: 0; }';
  }
  // Move to the very end of <head> so no other stylesheet overrides @page
  document.head.appendChild(el);
};

const buildQuery = ({ schoolId, search, department, designation, employment_status }) => {
  const params = { school: schoolId };
  if (search.trim()) params.search = search.trim();
  if (department) params.department = department;
  if (designation) params.designation = designation;
  if (employment_status) params.employment_status = employment_status;
  return params;
};

export default function EmployeeIDCardGenerator() {
  const { id: schoolId } = useParams();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const containerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [school, setSchool] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterDesig, setFilterDesig] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/employees/employees/', {
        params: buildQuery({ schoolId, search, department: filterDept, designation: filterDesig, employment_status: filterStatus }),
      });
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setEmployees(list);
      const preselect = searchParams.get('emp');
      if (preselect) {
        setSelectedIds(list.filter((e) => String(e.id) === String(preselect)).map((e) => e.id));
      }
    } catch (err) {
      console.error('Employee load failed', err);
      toast.error('কর্মীর তথ্য লোড করা যায়নি');
    } finally {
      setLoading(false);
    }
  }, [schoolId, search, filterDept, filterDesig, filterStatus, searchParams, toast]);

  useEffect(() => {
    api.get(`/api/schools/${schoolId}/`).then((res) => setSchool(res.data)).catch(() => {});
    Promise.all([
      api.get('/api/employees/departments/', { params: { school: schoolId } }),
      api.get('/api/employees/designations/', { params: { school: schoolId } }),
    ]).then(([dRes, gRes]) => {
      setDepartments(Array.isArray(dRes.data) ? dRes.data : (dRes.data?.results || []));
      setDesignations(Array.isArray(gRes.data) ? gRes.data : (gRes.data?.results || []));
    }).catch(() => {});
  }, [schoolId]);

  useEffect(() => {
    const t = setTimeout(() => loadEmployees(), 300);
    return () => clearTimeout(t);
  }, [loadEmployees]);

  // Keep the @page rule in <head> only while this page is mounted so it can
  // never leak document-wide and mutate another page's print layout.
  useEffect(() => {
    injectPrintPageStyle();
    return () => {
      const el = document.getElementById('emp-id-card-print-page');
      if (el) el.remove();
    };
  }, []);

  const designationsForDept = useMemo(() => {
    if (!filterDept) return designations;
    return designations.filter((d) => String(d.department) === String(filterDept));
  }, [designations, filterDept]);

  const selectedEmployees = useMemo(
    () => employees.filter((e) => selectedIds.includes(e.id)),
    [employees, selectedIds]
  );

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllVisible = () => setSelectedIds(employees.map((e) => e.id));
  const clearAll = () => setSelectedIds([]);

  const handlePrint = async () => {
    if (selectedEmployees.length === 0) {
      toast.error('প্রিন্ট করার জন্য অন্তত একজন কর্মী নির্বাচন করুন');
      return;
    }
    setPrinting(true);
    try {
      injectPrintPageStyle();
      await waitForImages(containerRef.current);
      // window.print() must be synchronous after the awaits above
      window.print();
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Box className="emp-card-generator-root" sx={{ p: { xs: 1, sm: 2 } }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }} className="emp-print-hidden">
        <BadgeIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight="bold">কর্মী আইডি কার্ড</Typography>
          <Typography variant="body2" color="text.secondary">
            নির্বাচিত কর্মীদের ডিজিটাল ID Card (PDF ডাউনলোড/প্রিন্ট)
          </Typography>
        </Box>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }} className="emp-print-hidden">
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
          <TextField
            size="small" placeholder="নাম / আইডি / মোবাইল দিয়ে খুঁজুন" value={search}
            onChange={(e) => setSearch(e.target.value)} sx={{ flex: 1, minWidth: 200 }}
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>বিভাগ</InputLabel>
            <Select label="বিভাগ" value={filterDept} onChange={(e) => { setFilterDept(e.target.value); setFilterDesig(''); }}>
              <MenuItem value="">সকল বিভাগ</MenuItem>
              {departments.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>পদবি</InputLabel>
            <Select label="পদবি" value={filterDesig} onChange={(e) => setFilterDesig(e.target.value)}>
              <MenuItem value="">সকল পদবি</MenuItem>
              {designationsForDept.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>স্ট্যাটাস</InputLabel>
            <Select label="স্ট্যাটাস" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <MenuItem value="">সকল</MenuItem>
              {EMPLOYMENT_STATUS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap alignItems="center">
          <Button size="small" startIcon={<SelectAllIcon />} onClick={selectAllVisible}>সব নির্বাচন</Button>
          <Button size="small" startIcon={<ClearAllIcon />} onClick={clearAll}>নির্বাচন মুছুন</Button>
          <Chip color="primary" label={`নির্বাচিত: ${selectedIds.length}`} />
          <Box sx={{ flex: 1 }} />
          <Button
            variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}
            disabled={printing || selectedEmployees.length === 0}
          >
            প্রিন্ট / PDF
          </Button>
        </Stack>
      </Paper>

      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }} className="emp-print-hidden">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f7fb' }}>
              <TableCell padding="checkbox" />
              <TableCell sx={{ fontWeight: 'bold' }}>Employee ID</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>নাম</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>পদবি</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>বিভাগ</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>মোবাইল</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>
            ) : employees.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                <Typography color="text.secondary">কোনো কর্মী পাওয়া যায়নি।</Typography>
              </TableCell></TableRow>
            ) : employees.map((emp) => (
              <TableRow key={emp.id} hover selected={selectedIds.includes(emp.id)}>
                <TableCell padding="checkbox">
                  <Checkbox checked={selectedIds.includes(emp.id)} onChange={() => toggleSelect(emp.id)} />
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: '#0a4b94' }}>{emp.employee_id}</TableCell>
                <TableCell>{emp.name_en}{emp.name_bn ? ` (${emp.name_bn})` : ''}</TableCell>
                <TableCell>{emp.designation_name || '—'}</TableCell>
                <TableCell>{emp.department_name || '—'}</TableCell>
                <TableCell>{emp.mobile_number || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Divider sx={{ mb: 2 }} className="emp-print-hidden" />
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }} className="emp-print-hidden">
        প্রিভিউ (নির্বাচিত {selectedEmployees.length} টি কার্ড)
      </Typography>

      <Box className="emp-card-container" ref={containerRef}>
        {selectedEmployees.length === 0 ? (
          <Typography color="text.secondary" className="emp-print-hidden">
            কার্ড দেখতে উপরের তালিকা থেকে কর্মী নির্বাচন করুন।
          </Typography>
        ) : (() => {
          const pages = [];
          for (let i = 0; i < selectedEmployees.length; i += 4) {
            pages.push(selectedEmployees.slice(i, i + 4));
          }
          return pages.map((pageEmps, pIdx) => (
            <Box key={`emp-page-${pIdx}`} className="emp-card-page">
              {pageEmps.map((emp) => (
                <EmployeeIDCard key={emp.id} employee={emp} school={school} />
              ))}
            </Box>
          ));
        })()}
      </Box>
    </Box>
  );
}
