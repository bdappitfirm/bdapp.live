import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControl, Grid, IconButton, InputAdornment,
  InputLabel, MenuItem, Paper, Select, Stack, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow, Tabs, TextField, Tooltip, Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import BadgeIcon from '@mui/icons-material/Badge';
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import PhotoUpload from '../components/PhotoUpload';
import { getMediaUrl } from '../utils/media';

const EMPLOYMENT_TYPES = [
  { value: 'permanent', label: 'স্থায়ী (Permanent)' },
  { value: 'contractual', label: 'চুক্তিভিত্তিক (Contractual)' },
  { value: 'part_time', label: 'খণ্ডকালীন (Part Time)' },
  { value: 'probation', label: 'প্রবেশন (Probation)' },
  { value: 'intern', label: 'ইন্টার্ন (Intern)' },
];

const EMPLOYMENT_STATUS = [
  { value: 'active', label: 'Active (কর্মরত)' },
  { value: 'inactive', label: 'Inactive (নিষ্ক্রিয়)' },
  { value: 'resigned', label: 'Resigned (পদত্যাগী)' },
];

const GENDERS = [
  { value: 'male', label: 'পুরুষ (Male)' },
  { value: 'female', label: 'মহিলা (Female)' },
  { value: 'other', label: 'অন্যান্য (Other)' },
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const statusColor = (s) => (s === 'active' ? 'success' : s === 'inactive' ? 'warning' : 'default');

const emptyForm = {
  name_en: '', name_bn: '', father_name: '', mother_name: '', date_of_birth: '',
  gender: '', blood_group: '', nid_number: '',
  mobile_number: '', alt_mobile_number: '', email: '', present_address: '',
  permanent_address: '', emergency_contact_name: '', emergency_contact_mobile: '',
  department: '', designation: '', joining_date: '', employment_type: '',
  reporting_manager: '', work_location: '', employment_status: 'active',
  official_email: '', official_mobile: '', id_card_number: '',
  id_card_issue_date: '', id_card_expiry_date: '', notes: '',
};

const TEXT_FIELDS = [
  'name_en', 'name_bn', 'father_name', 'mother_name', 'nid_number', 'mobile_number',
  'alt_mobile_number', 'email', 'present_address', 'permanent_address',
  'emergency_contact_name', 'emergency_contact_mobile', 'employment_type',
  'work_location', 'employment_status', 'official_email', 'official_mobile',
  'id_card_number', 'notes', 'gender', 'blood_group',
];
const DATE_FIELDS = ['date_of_birth', 'joining_date', 'id_card_issue_date', 'id_card_expiry_date'];
const FK_FIELDS = ['department', 'designation', 'reporting_manager'];

export default function EmployeePage() {
  const { id: schoolId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);

  // filters
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterDesig, setFilterDesig] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // employee dialog
  const [empOpen, setEmpOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  // profile dialog
  const [profileEmp, setProfileEmp] = useState(null);

  // login dialog
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginTarget, setLoginTarget] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '', role: 'teacher' });

  // delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);

  // department dialog
  const [deptOpen, setDeptOpen] = useState(false);
  const [deptEditing, setDeptEditing] = useState(null);
  const [deptForm, setDeptForm] = useState({ name: '', name_bn: '', code: '', description: '', is_active: true });

  // designation dialog
  const [desigOpen, setDesigOpen] = useState(false);
  const [desigEditing, setDesigEditing] = useState(null);
  const [desigForm, setDesigForm] = useState({ department: '', name: '', name_bn: '', is_active: true });

  const loadLookups = useCallback(async () => {
    try {
      const [dRes, gRes] = await Promise.all([
        api.get('/api/employees/departments/', { params: { school: schoolId } }),
        api.get('/api/employees/designations/', { params: { school: schoolId } }),
      ]);
      setDepartments(Array.isArray(dRes.data) ? dRes.data : (dRes.data?.results || []));
      setDesignations(Array.isArray(gRes.data) ? gRes.data : (gRes.data?.results || []));
    } catch (err) {
      console.error('Lookup load failed', err);
    }
  }, [schoolId]);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = { school: schoolId };
      if (search.trim()) params.search = search.trim();
      if (filterDept) params.department = filterDept;
      if (filterDesig) params.designation = filterDesig;
      if (filterStatus) params.employment_status = filterStatus;
      const res = await api.get('/api/employees/employees/', { params });
      setEmployees(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (err) {
      console.error('Employee load failed', err);
      toast.error('কর্মীর তথ্য লোড করা যায়নি');
    } finally {
      setLoading(false);
    }
  }, [schoolId, search, filterDept, filterDesig, filterStatus, toast]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    const t = setTimeout(() => { loadEmployees(); }, 300);
    return () => clearTimeout(t);
  }, [loadEmployees]);

  useEffect(() => { setPage(0); }, [search, filterDept, filterDesig, filterStatus]);

  const designationsForDept = useMemo(() => {
    if (!filterDept) return designations;
    return designations.filter((d) => String(d.department) === String(filterDept));
  }, [designations, filterDept]);

  // ------------------------- Employee CRUD -------------------------
  const openAddEmployee = () => {
    setEditing(null);
    setForm(emptyForm);
    setPhotoFile(null);
    setPhotoPreview(null);
    setEmpOpen(true);
  };

  const openEditEmployee = (emp) => {
    setEditing(emp);
    setForm({
      ...emptyForm,
      ...Object.keys(emptyForm).reduce((acc, key) => {
        const val = emp[key];
        acc[key] = val === null || val === undefined ? '' : val;
        return acc;
      }, {}),
    });
    setPhotoFile(null);
    setPhotoPreview(emp.photo_url || getMediaUrl(emp.photo) || null);
    setEmpOpen(true);
  };

  const handleFormChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const buildFormData = () => {
    const fd = new FormData();
    fd.append('school', schoolId);
    TEXT_FIELDS.forEach((k) => fd.append(k, form[k] ?? ''));
    DATE_FIELDS.forEach((k) => { if (form[k]) fd.append(k, form[k]); });
    FK_FIELDS.forEach((k) => { if (form[k]) fd.append(k, form[k]); });
    if (photoFile) fd.append('photo', photoFile);
    return fd;
  };

  const saveEmployee = async () => {
    if (!form.name_en.trim()) {
      toast.error('কর্মীর নাম (ইংরেজি) দিতে হবে');
      return;
    }
    setSaving(true);
    try {
      const fd = buildFormData();
      const opts = { headers: { 'Content-Type': 'multipart/form-data' } };
      if (editing) {
        await api.patch(`/api/employees/employees/${editing.id}/`, fd, opts);
        toast.success('কর্মীর তথ্য হালনাগাদ হয়েছে');
      } else {
        await api.post('/api/employees/employees/', fd, opts);
        toast.success('নতুন কর্মী যুক্ত হয়েছে');
      }
      setEmpOpen(false);
      await loadEmployees();
    } catch (err) {
      console.error('Save employee failed', err);
      const msg = err?.response?.data ? JSON.stringify(err.response.data) : 'সংরক্ষণ করা যায়নি';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const deleteEmployee = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/employees/employees/${deleteTarget.id}/`);
      toast.success('কর্মী মুছে ফেলা হয়েছে');
      setDeleteTarget(null);
      await loadEmployees();
    } catch (err) {
      console.error('Delete failed', err);
      toast.error('মুছে ফেলা যায়নি');
    }
  };

  const changeStatus = async (emp, status) => {
    try {
      const fd = new FormData();
      fd.append('employment_status', status);
      await api.patch(`/api/employees/employees/${emp.id}/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await loadEmployees();
    } catch (err) {
      toast.error('স্ট্যাটাস পরিবর্তন করা যায়নি');
    }
  };

  const openLoginDialog = (emp) => {
    setLoginTarget(emp);
    setLoginForm({
      username: `emp${String(emp.employee_id || '').replace('BD-EMP-', '').trim()}`,
      password: '',
      role: 'teacher',
    });
    setLoginOpen(true);
  };

  const createLogin = async () => {
    if (!loginTarget) return;
    try {
      const res = await api.post(`/api/employees/employees/${loginTarget.id}/create-login/`, loginForm);
      toast.success(`লগইন তৈরি হয়েছে — ইউজার: ${res.data.username} | পাসওয়ার্ড: ${res.data.password}`);
      setLoginOpen(false);
      await loadEmployees();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'লগইন অ্যাকাউন্ট তৈরি করা যায়নি');
    }
  };

  // ------------------------- Department CRUD -------------------------
  const seedDefaults = async () => {
    try {
      const res = await api.post('/api/employees/departments/seed-defaults/', { school: schoolId });
      toast.success(`ডিফল্ট বিভাগ তৈরি হয়েছে (${res.data.departments_created})`);
      await loadLookups();
    } catch (err) {
      toast.error('ডিফল্ট বিভাগ তৈরি করা যায়নি');
    }
  };

  const saveDepartment = async () => {
    if (!deptForm.name.trim()) { toast.error('বিভাগের নাম দিন'); return; }
    try {
      const payload = { ...deptForm, school: schoolId };
      if (deptEditing) {
        await api.put(`/api/employees/departments/${deptEditing.id}/`, payload);
      } else {
        await api.post('/api/employees/departments/', payload);
      }
      toast.success('বিভাগ সংরক্ষণ হয়েছে');
      setDeptOpen(false);
      setDeptEditing(null);
      setDeptForm({ name: '', name_bn: '', code: '', description: '', is_active: true });
      await loadLookups();
    } catch (err) {
      toast.error('বিভাগ সংরক্ষণ করা যায়নি');
    }
  };

  const deleteDepartment = async (dept) => {
    try {
      await api.delete(`/api/employees/departments/${dept.id}/`);
      toast.success('বিভাগ মুছে ফেলা হয়েছে');
      await loadLookups();
    } catch (err) {
      toast.error('মুছে ফেলা যায়নি');
    }
  };

  // ------------------------- Designation CRUD -------------------------
  const saveDesignation = async () => {
    if (!desigForm.name.trim()) { toast.error('পদবির নাম দিন'); return; }
    try {
      const payload = {
        school: schoolId,
        name: desigForm.name,
        name_bn: desigForm.name_bn,
        is_active: desigForm.is_active,
        department: desigForm.department || null,
      };
      if (desigEditing) {
        await api.put(`/api/employees/designations/${desigEditing.id}/`, payload);
      } else {
        await api.post('/api/employees/designations/', payload);
      }
      toast.success('পদবি সংরক্ষণ হয়েছে');
      setDesigOpen(false);
      setDesigEditing(null);
      setDesigForm({ department: '', name: '', name_bn: '', is_active: true });
      await loadLookups();
    } catch (err) {
      toast.error('পদবি সংরক্ষণ করা যায়নি');
    }
  };

  const deleteDesignation = async (desig) => {
    try {
      await api.delete(`/api/employees/designations/${desig.id}/`);
      toast.success('পদবি মুছে ফেলা হয়েছে');
      await loadLookups();
    } catch (err) {
      toast.error('মুছে ফেলা যায়নি');
    }
  };

  const pagedEmployees = useMemo(
    () => employees.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [employees, page, rowsPerPage]
  );

  const formDesignations = useMemo(() => {
    if (!form.department) return designations;
    return designations.filter((d) => String(d.department) === String(form.department));
  }, [designations, form.department]);

  // ------------------------------------------------------------------
  const renderEmployeeTab = () => (
    <Box>
      <Paper sx={{ p: 2, mb: 2 }} variant="outlined">
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
          <TextField
            size="small" placeholder="নাম / আইডি / মোবাইল দিয়ে খুঁজুন" value={search}
            onChange={(e) => setSearch(e.target.value)} sx={{ flex: 1, minWidth: 200 }}
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }}
          />
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>বিভাগ</InputLabel>
            <Select label="বিভাগ" value={filterDept} onChange={(e) => { setFilterDept(e.target.value); setFilterDesig(''); }}>
              <MenuItem value="">সকল বিভাগ</MenuItem>
              {departments.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 170 }}>
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
          <Button variant="contained" startIcon={<PersonAddIcon />} onClick={openAddEmployee} sx={{ whiteSpace: 'nowrap' }}>
            নতুন কর্মী
          </Button>
        </Stack>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f7fb' }}>
              <TableCell sx={{ fontWeight: 'bold' }}>Employee ID</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>ছবি</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>নাম</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>পদবি</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>বিভাগ</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>মোবাইল</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>স্ট্যাটাস</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>অ্যাকশন</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>
            ) : pagedEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                  <Typography color="text.secondary">কোনো কর্মী পাওয়া যায়নি।</Typography>
                  <Button variant="outlined" startIcon={<AddIcon />} sx={{ mt: 1.5 }} onClick={openAddEmployee}>
                    প্রথম কর্মী যুক্ত করুন
                  </Button>
                </TableCell>
              </TableRow>
            ) : pagedEmployees.map((emp) => (
              <TableRow key={emp.id} hover>
                <TableCell sx={{ fontWeight: 'bold', color: '#0a4b94' }}>{emp.employee_id}</TableCell>
                <TableCell>
                  <Avatar src={emp.photo_url || getMediaUrl(emp.photo) || undefined} sx={{ width: 38, height: 38 }}>
                    {(emp.name_en || '?').charAt(0).toUpperCase()}
                  </Avatar>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight="bold">{emp.name_en}</Typography>
                  {emp.name_bn ? <Typography variant="caption" color="text.secondary">{emp.name_bn}</Typography> : null}
                </TableCell>
                <TableCell>{emp.designation_name || '—'}</TableCell>
                <TableCell>{emp.department_name || '—'}</TableCell>
                <TableCell>{emp.mobile_number || '—'}</TableCell>
                <TableCell>
                  <Select
                    size="small" variant="standard" disableUnderline value={emp.employment_status}
                    onChange={(e) => changeStatus(emp, e.target.value)}
                    renderValue={(v) => (
                      <Chip
                        size="small"
                        label={(EMPLOYMENT_STATUS.find((s) => s.value === v) || {}).label || v}
                        color={statusColor(v)}
                        variant={v === 'active' ? 'filled' : 'outlined'}
                      />
                    )}
                    sx={{ minWidth: 130 }}
                  >
                    {EMPLOYMENT_STATUS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                  </Select>
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Tooltip title="প্রোফাইল"><IconButton size="small" onClick={() => setProfileEmp(emp)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="সম্পাদনা"><IconButton size="small" onClick={() => openEditEmployee(emp)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="আইডি কার্ড"><IconButton size="small" color="primary" onClick={() => navigate(`/school/${schoolId}/employee/id-card?emp=${emp.id}`)}><BadgeIcon fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="মুছুন"><IconButton size="small" color="error" onClick={() => setDeleteTarget(emp)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div" count={employees.length} page={page} rowsPerPage={rowsPerPage}
          onPageChange={(e, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50, 100]}
        />
      </TableContainer>
    </Box>
  );

  const renderDepartmentTab = () => (
    <Box>
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setDeptEditing(null); setDeptForm({ name: '', name_bn: '', code: '', description: '', is_active: true }); setDeptOpen(true); }}>
          নতুন বিভাগ
        </Button>
        <Button variant="outlined" onClick={seedDefaults}>প্রাথমিক ৭টি বিভাগ তৈরি করুন</Button>
      </Stack>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f7fb' }}>
              <TableCell sx={{ fontWeight: 'bold' }}>বিভাগ (English)</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>বিভাগ (বাংলা)</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>কোড</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>পদবি</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>কর্মী</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>অ্যাকশন</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {departments.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                <Typography color="text.secondary">কোনো বিভাগ নেই। উপরের বাটন দিয়ে প্রাথমিক বিভাগ তৈরি করুন।</Typography>
              </TableCell></TableRow>
            ) : departments.map((d) => (
              <TableRow key={d.id} hover>
                <TableCell sx={{ fontWeight: 'bold' }}>{d.name}</TableCell>
                <TableCell>{d.name_bn || '—'}</TableCell>
                <TableCell>{d.code || '—'}</TableCell>
                <TableCell>{d.designation_count}</TableCell>
                <TableCell>{d.employee_count}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => {
                    setDeptEditing(d);
                    setDeptForm({ name: d.name, name_bn: d.name_bn || '', code: d.code || '', description: d.description || '', is_active: d.is_active });
                    setDeptOpen(true);
                  }}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => deleteDepartment(d)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderDesignationTab = () => (
    <Box>
      <Stack direction="row" sx={{ mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setDesigEditing(null); setDesigForm({ department: '', name: '', name_bn: '', is_active: true }); setDesigOpen(true); }}>
          নতুন পদবি
        </Button>
      </Stack>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f7fb' }}>
              <TableCell sx={{ fontWeight: 'bold' }}>বিভাগ</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>পদবি (English)</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>পদবি (বাংলা)</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>অ্যাকশন</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {designations.length === 0 ? (
              <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                <Typography color="text.secondary">কোনো পদবি নেই।</Typography>
              </TableCell></TableRow>
            ) : designations.map((d) => (
              <TableRow key={d.id} hover>
                <TableCell>{d.department_name || '—'}</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>{d.name}</TableCell>
                <TableCell>{d.name_bn || '—'}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => {
                    setDesigEditing(d);
                    setDesigForm({ department: d.department || '', name: d.name, name_bn: d.name_bn || '', is_active: d.is_active });
                    setDesigOpen(true);
                  }}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => deleteDesignation(d)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  return (
    <Box className="emp-page-root" sx={{ p: { xs: 1, sm: 2 } }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <BadgeIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight="bold">কর্মী ব্যবস্থাপনা (Employee Management)</Typography>
          <Typography variant="body2" color="text.secondary">
            BDapp IT Firm – Employee Profile, Department, Designation ও ID Card
          </Typography>
        </Box>
      </Stack>

      <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="scrollable" sx={{ mb: 2, borderBottom: '1px solid #e0e0e0' }}>
        <Tab label="কর্মী তালিকা" />
        <Tab label="বিভাগ ব্যবস্থাপনা" />
        <Tab label="পদবি ব্যবস্থাপনা" />
      </Tabs>

      {tab === 0 && renderEmployeeTab()}
      {tab === 1 && renderDepartmentTab()}
      {tab === 2 && renderDesignationTab()}

      {/* ------------------- Employee Add/Edit Dialog ------------------- */}
      <Dialog open={empOpen} onClose={() => setEmpOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          {editing ? `কর্মীর তথ্য সম্পাদনা — ${editing.employee_id}` : 'নতুন কর্মী যোগ করুন'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="flex-start">
              <Box>
                <PhotoUpload
                  currentPhoto={photoPreview}
                  userName={form.name_en || 'Employee'}
                  onPhotoChange={(file) => {
                    setPhotoFile(file);
                    setPhotoPreview(file ? URL.createObjectURL(file) : null);
                  }}
                />
                {editing && (
                  <Typography variant="caption" display="block" sx={{ textAlign: 'center', mt: 1, color: 'text.secondary' }}>
                    Employee ID: <b>{editing.employee_id}</b>
                  </Typography>
                )}
              </Box>
              <Box sx={{ flex: 1, width: '100%' }}>
                <Typography variant="subtitle2" color="primary" fontWeight="bold" sx={{ mb: 1 }}>ক. ব্যক্তিগত তথ্য</Typography>
                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="নাম (English) *" value={form.name_en} onChange={handleFormChange('name_en')} /></Grid>
                  <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="নাম (বাংলা)" value={form.name_bn} onChange={handleFormChange('name_bn')} /></Grid>
                  <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="পিতার নাম" value={form.father_name} onChange={handleFormChange('father_name')} /></Grid>
                  <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="মাতার নাম" value={form.mother_name} onChange={handleFormChange('mother_name')} /></Grid>
                  <Grid item xs={12} sm={6}><TextField fullWidth size="small" type="date" label="জন্মতারিখ" InputLabelProps={{ shrink: true }} value={form.date_of_birth || ''} onChange={handleFormChange('date_of_birth')} /></Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small"><InputLabel>লিঙ্গ</InputLabel>
                      <Select label="লিঙ্গ" value={form.gender || ''} onChange={handleFormChange('gender')}>
                        <MenuItem value="">— নির্বাচন করুন —</MenuItem>
                        {GENDERS.map((g) => <MenuItem key={g.value} value={g.value}>{g.label}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small"><InputLabel>রক্তের গ্রুপ</InputLabel>
                      <Select label="রক্তের গ্রুপ" value={form.blood_group || ''} onChange={handleFormChange('blood_group')}>
                        <MenuItem value="">— নির্বাচন করুন —</MenuItem>
                        {BLOOD_GROUPS.map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="জাতীয় পরিচয়পত্র নম্বর (NID)" value={form.nid_number} onChange={handleFormChange('nid_number')} /></Grid>
                </Grid>

                <Typography variant="subtitle2" color="primary" fontWeight="bold" sx={{ mt: 2.5, mb: 1 }}>খ. যোগাযোগের তথ্য</Typography>
                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="মোবাইল নম্বর" value={form.mobile_number} onChange={handleFormChange('mobile_number')} /></Grid>
                  <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="বিকল্প মোবাইল নম্বর" value={form.alt_mobile_number} onChange={handleFormChange('alt_mobile_number')} /></Grid>
                  <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="ইমেইল" value={form.email} onChange={handleFormChange('email')} /></Grid>
                  <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="বর্তমান ঠিকানা" value={form.present_address} onChange={handleFormChange('present_address')} /></Grid>
                  <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="স্থায়ী ঠিকানা" value={form.permanent_address} onChange={handleFormChange('permanent_address')} /></Grid>
                  <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="জরুরি যোগাযোগের ব্যক্তির নাম" value={form.emergency_contact_name} onChange={handleFormChange('emergency_contact_name')} /></Grid>
                  <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="জরুরি যোগাযোগের মোবাইল" value={form.emergency_contact_mobile} onChange={handleFormChange('emergency_contact_mobile')} /></Grid>
                </Grid>
              </Box>
            </Stack>

            <Divider />

            <Typography variant="subtitle2" color="primary" fontWeight="bold">গ. চাকরিসংক্রান্ত তথ্য</Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small"><InputLabel>বিভাগ (Department)</InputLabel>
                  <Select label="বিভাগ (Department)" value={form.department || ''} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value, designation: '' }))}>
                    <MenuItem value="">— নির্বাচন করুন —</MenuItem>
                    {departments.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small"><InputLabel>পদবি (Designation)</InputLabel>
                  <Select label="পদবি (Designation)" value={form.designation || ''} onChange={handleFormChange('designation')}>
                    <MenuItem value="">— নির্বাচন করুন —</MenuItem>
                    {formDesignations.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth size="small" type="date" label="যোগদানের তারিখ" InputLabelProps={{ shrink: true }} value={form.joining_date || ''} onChange={handleFormChange('joining_date')} /></Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small"><InputLabel>চাকরির ধরন</InputLabel>
                  <Select label="চাকরির ধরন" value={form.employment_type || ''} onChange={handleFormChange('employment_type')}>
                    <MenuItem value="">— নির্বাচন করুন —</MenuItem>
                    {EMPLOYMENT_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small"><InputLabel>দায়িত্বপ্রাপ্ত কর্মকর্তা</InputLabel>
                  <Select label="দায়িত্বপ্রাপ্ত কর্মকর্তা" value={form.reporting_manager || ''} onChange={handleFormChange('reporting_manager')}>
                    <MenuItem value="">— নির্বাচন করুন —</MenuItem>
                    {employees.filter((e) => !editing || e.id !== editing.id).map((e) => (
                      <MenuItem key={e.id} value={e.id}>{e.name_en} ({e.employee_id})</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="কর্মস্থল (Work Location)" value={form.work_location} onChange={handleFormChange('work_location')} /></Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small"><InputLabel>Employment Status</InputLabel>
                  <Select label="Employment Status" value={form.employment_status} onChange={handleFormChange('employment_status')}>
                    {EMPLOYMENT_STATUS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Divider />

            <Typography variant="subtitle2" color="primary" fontWeight="bold">ঘ. অফিসিয়াল তথ্য</Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Official Email" value={form.official_email} onChange={handleFormChange('official_email')} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Official Mobile" value={form.official_mobile} onChange={handleFormChange('official_mobile')} /></Grid>
              <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="ID Card Number" value={form.id_card_number} onChange={handleFormChange('id_card_number')} helperText="খালি রাখলে Employee ID ব্যবহৃত হবে" /></Grid>
              <Grid item xs={12} sm={4}><TextField fullWidth size="small" type="date" label="ID Card Issue Date" InputLabelProps={{ shrink: true }} value={form.id_card_issue_date || ''} onChange={handleFormChange('id_card_issue_date')} /></Grid>
              <Grid item xs={12} sm={4}><TextField fullWidth size="small" type="date" label="ID Card Expiry Date" InputLabelProps={{ shrink: true }} value={form.id_card_expiry_date || ''} onChange={handleFormChange('id_card_expiry_date')} /></Grid>
              <Grid item xs={12}><TextField fullWidth size="small" multiline rows={2} label="নোট / মন্তব্য" value={form.notes} onChange={handleFormChange('notes')} /></Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmpOpen(false)}>বাতিল</Button>
          <Button variant="contained" onClick={saveEmployee} disabled={saving}>
            {saving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ------------------- Profile Dialog ------------------- */}
      <Dialog open={Boolean(profileEmp)} onClose={() => setProfileEmp(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>কর্মীর প্রোফাইল</DialogTitle>
        <DialogContent dividers>
          {profileEmp && (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar src={profileEmp.photo_url || getMediaUrl(profileEmp.photo) || undefined} sx={{ width: 72, height: 72 }}>
                  {(profileEmp.name_en || '?').charAt(0)}
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight="bold">{profileEmp.name_en}</Typography>
                  {profileEmp.name_bn ? <Typography variant="body2">{profileEmp.name_bn}</Typography> : null}
                  <Chip size="small" label={profileEmp.employee_id} color="primary" sx={{ mt: 0.5 }} />
                  <Chip size="small" label={(EMPLOYMENT_STATUS.find((s) => s.value === profileEmp.employment_status) || {}).label || profileEmp.employment_status} color={statusColor(profileEmp.employment_status)} sx={{ mt: 0.5, ml: 1 }} />
                </Box>
              </Stack>
              <Divider />
              <Grid container spacing={1}>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">পদবি</Typography><Typography variant="body2" fontWeight="bold">{profileEmp.designation_name || '—'}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">বিভাগ</Typography><Typography variant="body2" fontWeight="bold">{profileEmp.department_name || '—'}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">পিতার নাম</Typography><Typography variant="body2">{profileEmp.father_name || '—'}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">মাতার নাম</Typography><Typography variant="body2">{profileEmp.mother_name || '—'}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">জন্মতারিখ</Typography><Typography variant="body2">{profileEmp.date_of_birth || '—'}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">লিঙ্গ</Typography><Typography variant="body2">{profileEmp.gender_display || '—'}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">রক্তের গ্রুপ</Typography><Typography variant="body2">{profileEmp.blood_group || '—'}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">NID</Typography><Typography variant="body2">{profileEmp.nid_number || '—'}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">মোবাইল</Typography><Typography variant="body2">{profileEmp.mobile_number || '—'}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">বিকল্প মোবাইল</Typography><Typography variant="body2">{profileEmp.alt_mobile_number || '—'}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">ইমেইল</Typography><Typography variant="body2">{profileEmp.email || '—'}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">জরুরি যোগাযোগ</Typography><Typography variant="body2">{profileEmp.emergency_contact_name || '—'} {profileEmp.emergency_contact_mobile ? `(${profileEmp.emergency_contact_mobile})` : ''}</Typography></Grid>
                <Grid item xs={12}><Typography variant="caption" color="text.secondary">বর্তমান ঠিকানা</Typography><Typography variant="body2">{profileEmp.present_address || '—'}</Typography></Grid>
                <Grid item xs={12}><Typography variant="caption" color="text.secondary">স্থায়ী ঠিকানা</Typography><Typography variant="body2">{profileEmp.permanent_address || '—'}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">যোগদানের তারিখ</Typography><Typography variant="body2">{profileEmp.joining_date || '—'}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">চাকরির ধরন</Typography><Typography variant="body2">{profileEmp.employment_type_display || '—'}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">দায়িত্বপ্রাপ্ত কর্মকর্তা</Typography><Typography variant="body2">{profileEmp.reporting_manager_name || '—'}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">কর্মস্থল</Typography><Typography variant="body2">{profileEmp.work_location || '—'}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Official Email</Typography><Typography variant="body2">{profileEmp.official_email || '—'}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">Official Mobile</Typography><Typography variant="body2">{profileEmp.official_mobile || '—'}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">ID Card No.</Typography><Typography variant="body2">{profileEmp.id_card_number || '—'}</Typography></Grid>
                <Grid item xs={6}><Typography variant="caption" color="text.secondary">লগইন অ্যাকাউন্ট</Typography><Typography variant="body2">{profileEmp.has_login ? `✅ ${profileEmp.login_username}` : '❌ সংযুক্ত নেই'}</Typography></Grid>
              </Grid>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={() => setProfileEmp(null)}>বন্ধ করুন</Button>
          {profileEmp && !profileEmp.has_login && (
            <Button startIcon={<VpnKeyIcon />} onClick={() => { openLoginDialog(profileEmp); setProfileEmp(null); }}>
              লগইন অ্যাকাউন্ট তৈরি
            </Button>
          )}
          <Button startIcon={<PrintIcon />} variant="outlined" onClick={() => navigate(`/school/${schoolId}/employee/id-card?emp=${profileEmp.id}`)}>
            আইডি কার্ড
          </Button>
          <Button startIcon={<EditIcon />} variant="contained" onClick={() => { const e = profileEmp; setProfileEmp(null); openEditEmployee(e); }}>
            সম্পাদনা
          </Button>
        </DialogActions>
      </Dialog>

      {/* ------------------- Login Dialog ------------------- */}
      <Dialog open={loginOpen} onClose={() => setLoginOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>BDapp লগইন অ্যাকাউন্ট তৈরি</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              কর্মীর সঙ্গে একটি BDapp লগইন অ্যাকাউন্ট সংযুক্ত করা হবে। পাসওয়ার্ড শুধু একবার দেখানো হবে।
            </Alert>
            <TextField size="small" fullWidth label="ইউজারনেম" value={loginForm.username} onChange={(e) => setLoginForm((p) => ({ ...p, username: e.target.value }))} />
            <TextField size="small" fullWidth label="পাসওয়ার্ড" value={loginForm.password} onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))} placeholder="খালি রাখলে: bdapp@1234" />
            <FormControl size="small" fullWidth>
              <InputLabel>রোল</InputLabel>
              <Select label="রোল" value={loginForm.role} onChange={(e) => setLoginForm((p) => ({ ...p, role: e.target.value }))}>
                <MenuItem value="teacher">Teacher / Staff</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="committee">Committee</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoginOpen(false)}>বাতিল</Button>
          <Button variant="contained" onClick={createLogin}>তৈরি করুন</Button>
        </DialogActions>
      </Dialog>

      {/* ------------------- Department Dialog ------------------- */}
      <Dialog open={deptOpen} onClose={() => setDeptOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>{deptEditing ? 'বিভাগ সম্পাদনা' : 'নতুন বিভাগ'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField size="small" fullWidth label="বিভাগের নাম (English) *" value={deptForm.name} onChange={(e) => setDeptForm((p) => ({ ...p, name: e.target.value }))} />
            <TextField size="small" fullWidth label="বিভাগের নাম (বাংলা)" value={deptForm.name_bn} onChange={(e) => setDeptForm((p) => ({ ...p, name_bn: e.target.value }))} />
            <TextField size="small" fullWidth label="কোড" value={deptForm.code} onChange={(e) => setDeptForm((p) => ({ ...p, code: e.target.value }))} />
            <TextField size="small" fullWidth multiline rows={2} label="বিবরণ" value={deptForm.description} onChange={(e) => setDeptForm((p) => ({ ...p, description: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeptOpen(false)}>বাতিল</Button>
          <Button variant="contained" onClick={saveDepartment}>সংরক্ষণ</Button>
        </DialogActions>
      </Dialog>

      {/* ------------------- Designation Dialog ------------------- */}
      <Dialog open={desigOpen} onClose={() => setDesigOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>{desigEditing ? 'পদবি সম্পাদনা' : 'নতুন পদবি'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>বিভাগ</InputLabel>
              <Select label="বিভাগ" value={desigForm.department || ''} onChange={(e) => setDesigForm((p) => ({ ...p, department: e.target.value }))}>
                <MenuItem value="">— নির্বাচন করুন —</MenuItem>
                {departments.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" fullWidth label="পদবি (English) *" value={desigForm.name} onChange={(e) => setDesigForm((p) => ({ ...p, name: e.target.value }))} />
            <TextField size="small" fullWidth label="পদবি (বাংলা)" value={desigForm.name_bn} onChange={(e) => setDesigForm((p) => ({ ...p, name_bn: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDesigOpen(false)}>বাতিল</Button>
          <Button variant="contained" onClick={saveDesignation}>সংরক্ষণ</Button>
        </DialogActions>
      </Dialog>

      {/* ------------------- Delete Confirm ------------------- */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>কর্মী মুছে ফেলবেন?</DialogTitle>
        <DialogContent dividers>
          <Typography>
            <b>{deleteTarget?.name_en}</b> ({deleteTarget?.employee_id}) এর প্রোফাইল স্থায়ীভাবে মুছে ফেলা হবে।
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>বাতিল</Button>
          <Button color="error" variant="contained" onClick={deleteEmployee}>মুছে ফেলুন</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
