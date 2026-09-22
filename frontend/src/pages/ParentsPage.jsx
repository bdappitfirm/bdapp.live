import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import api from '../utils/api';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Stack,
  Button,
  TextField,
  InputAdornment,
  Fade,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EmptyState from '../components/EmptyState';
import ProfileCard from '../components/ProfileCard';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/Toast';
import { useAcademics } from '../context/AcademicsContext';
import ClassCard from '../components/ClassCard';

const classOrderRank = (nameRaw) => {
  const name = String(nameRaw || '').trim().toLowerCase();
  const bn = {'০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9'};
  const digits = name.replace(/[০-৯]/g, (ch) => bn[ch] || ch).match(/\b(10|[1-9])\b/);
  const romanMap = {'i':1,'ii':2,'iii':3,'iv':4,'v':5,'vi':6,'vii':7,'viii':8,'ix':9,'x':10};
  const words = {'one':1,'two':2,'three':3,'four':4,'five':5,
    'প্রথম':1,'দ্বিতীয়':2,'দ্বিতীয়':2,'তৃতীয়':3,'তৃতীয়':3,'চতুর্থ':4,'পঞ্চম':5,'ষষ্ঠ':6,'সপ্তম':7,'অষ্টম':8,'নবম':9,'দশম':10,
    '১ম':1,'২য়':2,'২য়':2,'৩য়':3,'৩য়':3,'৪র্থ':4,'৫ম':5,'৬ষ্ঠ':6,'৭ম':7,'৮ম':8,'৯ম':9,'১০ম':10,
    'six':6,'seven':7,'eight':8,'nine':9,'ten':10
  };
  if (/\bplay|প্লে|playgroup|play group|kg-?1?\b/.test(name)) return 0;
  if (/\bnursery|নার্সারি\b/.test(name)) return 1;
  if (/\bkg|কে?জি\b/.test(name)) return 2;
  const roman = name.replace(/[^ivx]/g, '');
  if (roman && romanMap[roman]) return romanMap[roman] + 2;
  for (const k in words) {
    if (name.includes(k)) return words[k] + 2;
  }
  if (digits) return parseInt(digits[0], 10) + 2;
  return 999;
};

const toBn = (val) => {
  const bn = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
  return String(val).replace(/\d/g, d => bn[d] ?? d);
};

export default function ParentsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassroom, setSelectedClassroom] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [focusParent, setFocusParent] = useState('');
  const toast = useToast();
  const { classrooms, students, sections, refreshAll } = useAcademics();

  const sortedClassrooms = useMemo(() => {
    const arr = Array.isArray(classrooms) ? [...classrooms] : [];
    arr.sort((a, b) => {
      const ra = classOrderRank(a?.name);
      const rb = classOrderRank(b?.name);
      if (ra !== rb) return ra - rb;
      return String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { numeric: true, sensitivity: 'base' });
    });
    return arr;
  }, [classrooms]);

  const requiresSectionForSelectedClass = useMemo(() => {
    try {
      if (!selectedClassroom) return false;
      const clsObj = (classrooms || []).find(c => String(c.id) === String(selectedClassroom));
      const name = String(clsObj?.name || '').toLowerCase();
      return /ষষ্ঠ|six|\b6\b|সপ্তম|seven|\b7\b|অষ্টম|eight|\b8\b|নবম|nine|\b9\b|দশম|ten|\b10\b/.test(name);
    } catch (_) { return false; }
  }, [selectedClassroom, classrooms]);

  const loadParents = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/api/users/parents/?school=${id}`)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        setParents(data);
        if (data.length > 0) toast.success(`Loaded ${data.length} parents`);
      })
      .catch(() => toast.error('Failed to load parents'))
      .finally(() => setLoading(false));
    // We intentionally omit 'toast' from dependencies to avoid infinite loops
    // if the toast provider is not memoized properly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleCardUpdate = useCallback(async () => {
    try {
      if (id) await refreshAll(id);
    } catch (_) {}
    // Load parents directly, don't use the loadParents callback
    setLoading(true);
    api.get(`/api/users/parents/?school=${id}`)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        setParents(data);
        if (data.length > 0) toast.success(`Loaded ${data.length} parents`);
      })
      .catch(() => toast.error('Failed to load parents'))
      .finally(() => setLoading(false));
  }, [id, refreshAll, toast]);

  const getChildProfilesForParent = useCallback((parent) => {
    try {
      const parentUserId = parent?.user?.id ?? null;
      const parentProfileId = parent?.id ?? null;
      const parentUsername = String(parent?.user?.username || '').trim();
      const uidStr = parentUserId != null ? String(parentUserId) : null;
      const pidStr = parentProfileId != null ? String(parentProfileId) : null;

      return (students || [])
        .filter(st => {
          // Check Guardian field
          const g = st.guardian;
          const f = st.father;
          const m = st.mother;

          const idCandidates = [
            st.guardian_id, st.guardian_user, st.guardian_profile, st.parent, st.parent_id,
            (typeof g === 'object' ? g?.id : undefined), (typeof g === 'object' ? g?.user?.id : undefined),
            (typeof f === 'object' ? f?.id : undefined), (typeof f === 'object' ? f?.user?.id : undefined),
            (typeof m === 'object' ? m?.id : undefined), (typeof m === 'object' ? m?.user?.id : undefined),
            (typeof g === 'number' || typeof g === 'string' ? g : undefined)
          ].filter(v => v != null).map(v => String(v));

          const usernameCandidates = [
            st.guardian_username,
            (typeof g === 'object' ? (g?.username || g?.user?.username) : undefined),
            (typeof f === 'object' ? (f?.username || f?.user?.username) : undefined),
            (typeof m === 'object' ? (m?.username || m?.user?.username) : undefined),
            (typeof g === 'string' ? g : undefined)
          ].filter(Boolean).map(v => String(v));

          return idCandidates.some(x => (uidStr && x === uidStr) || (pidStr && x === pidStr)) || usernameCandidates.some(u => u === parentUsername);
        })
        .map(s => {
          const u = s.user || {};
          return { id: s.id, name: (`${u.first_name || ''} ${u.last_name || ''}`).trim() || u.username || `Student #${s.id}`, photo: u.photo_url || u.photo || s.photo_url || s.photo || '', roll_number: s?.roll_number ?? null };
        });
    } catch (_) { return []; }
  }, [students]);

  const getChildNamesForParent = useCallback((parent) => {
    return getChildProfilesForParent(parent).map(cp => cp.roll_number ? `${cp.name}(${cp.roll_number})` : cp.name);
  }, [getChildProfilesForParent]);

  useEffect(() => {
    loadParents();
    if (id) refreshAll(id).catch(() => {});
  }, [id, loadParents, refreshAll]);

  const getGuardianCountForSection = useCallback((sectionId) => {
    try {
      const parentIdSet = new Set((parents || []).map(p => String(p.user?.id || p.id)).filter(Boolean));
      const parentUserSet = new Set((parents || []).map(p => p.user?.username).filter(Boolean));
      const secIdStr = String(sectionId);
      const clsIdStr = String(selectedClassroom);
      const guardians = new Set();
      (students || [])
        .filter(s => String(s.classroom?.id ?? s.classroom) === clsIdStr && String(s.section?.id ?? s.section) === secIdStr)
        .forEach(s => {
          const links = [s.guardian, s.father, s.mother].filter(Boolean);
          links.forEach(g => {
            const gid = g.id || g.user?.id || g;
            const gun = g.username || g.user?.username;
            const gidStr = gid != null ? String(gid) : null;
            if ((gidStr && parentIdSet.has(gidStr)) || (gun && parentUserSet.has(gun))) guardians.add(gidStr || gun);
          });
        });
      return guardians.size;
    } catch (_) { return 0; }
  }, [parents, selectedClassroom, students]);

  const getGuardianCountForClass = useCallback((classId) => {
    try {
      const parentIdSet = new Set((parents || []).map(p => String(p.user?.id || p.id)).filter(Boolean));
      const parentUserSet = new Set((parents || []).map(p => p.user?.username).filter(Boolean));
      const clsIdStr = String(classId);
      const guardians = new Set();
      (students || [])
        .filter(s => String(s.classroom?.id ?? s.classroom) === clsIdStr)
        .forEach(s => {
          const links = [s.guardian, s.father, s.mother].filter(Boolean);
          links.forEach(g => {
            const gid = g.id || g.user?.id || g;
            const gun = g.username || g.user?.username;
            const gidStr = gid != null ? String(gid) : null;
            if ((gidStr && parentIdSet.has(gidStr)) || (gun && parentUserSet.has(gun))) guardians.add(gidStr || gun);
          });
        });
      return guardians.size;
    } catch (_) { return 0; }
  }, [parents, students]);

  const filtered = parents.filter(p => {
    const u = p.user || {};
    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase() || (u.username || '').toLowerCase();
    const matchesSearch = !searchQuery ? true : name.includes(searchQuery.toLowerCase());
    if (focusParent && String(u.id || p.id || '') === String(focusParent)) return true;
    if (showAll) return matchesSearch;
    if (!selectedClassroom) return false;
    if (requiresSectionForSelectedClass && !selectedSection) return false;
    if (searchQuery && !matchesSearch) return false;

    const pid = u.id || p.id;
    const pun = u.username;
    return (students || []).some(st => {
      const links = [st.guardian, st.father, st.mother].filter(Boolean);
      const inCls = String(st.classroom?.id ?? st.classroom) === String(selectedClassroom);
      const inSec = requiresSectionForSelectedClass ? (String(st.section?.id ?? st.section) === String(selectedSection)) : true;

      const linked = links.some(g => {
        const gid = typeof g === 'object' ? (g.id || g.user?.id) : g;
        const gun = typeof g === 'object' ? (g.username || g.user?.username) : (typeof g === 'string' ? g : null);
        return (gid != null && String(gid) === String(pid)) || (pun && gun && String(gun) === String(pun));
      });

      return inCls && inSec && linked;
    });
  });

  const getMinRollForParent = useCallback((parent) => {
    try {
      const pid = parent?.user?.id ?? parent?.id;
      const pun = parent?.user?.username;
      const clsIdStr = selectedClassroom ? String(selectedClassroom) : null;
      const secIdStr = selectedSection ? String(selectedSection) : null;
      const rolls = (students || []).filter(st => {
        const links = [st.guardian, st.father, st.mother].filter(Boolean);
        const linked = links.some(g => {
          const gid = g.id || g.user?.id || g;
          const gun = g.username || g.user?.username;
          return (pid != null && String(gid) === String(pid)) || (pun && gun && String(gun) === String(pun));
        });
        if (!linked) return false;
        const okCls = clsIdStr ? String(st.classroom?.id ?? st.classroom) === clsIdStr : true;
        const okSec = secIdStr ? String(st.section?.id ?? st.section) === secIdStr : true;
        return okCls && okSec;
      }).map(st => st?.roll_number).filter(v => v != null);
      if (rolls.length === 0) return Number.MAX_SAFE_INTEGER;
      return Math.min(...rolls.map(r => { const m = String(r).match(/\d+/); return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER; }));
    } catch (_) { return Number.MAX_SAFE_INTEGER; }
  }, [selectedClassroom, selectedSection, students]);

  const displayedParents = useMemo(() => {
    let base = [...filtered];
    // Always sort by min roll (or name if no roll)
    base.sort((a, b) => getMinRollForParent(a) - getMinRollForParent(b) || ((a.user?.first_name || '') + ' ' + (a.user?.last_name || '')).localeCompare((b.user?.first_name || '') + ' ' + (b.user?.last_name || ''), undefined, { sensitivity: 'base' }));
    if (!focusParent) return base;
    const fp = String(focusParent);
    return [...base].sort((a, b) => (String(a.user?.id || a.id || '') === fp ? -1 : 0) + (String(b.user?.id || b.id || '') === fp ? 1 : 0));
  }, [filtered, focusParent, getMinRollForParent]);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: '100%', overflow: 'hidden' }}>
      <Fade in timeout={500}>
        <Paper elevation={0} sx={{ mb: 3, p: 3, background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white', borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center' }}><FamilyRestroomIcon sx={{ mr: 1, fontSize: 40 }} />অভিভাবক ব্যবস্থাপনা</Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>অভিভাবকের প্রোফাইল ম্যানেজ করুন এবং শিক্ষার্থীদের সাথে লিঙ্ক করুন</Typography>
              <Typography variant="body2" sx={{ opacity: 0.7, mt: 1 }}>{`স্কুল আইডি: ${id} | মোট অভিভাবক: ${toBn(selectedClassroom && !showAll ? (requiresSectionForSelectedClass ? (selectedSection ? getGuardianCountForSection(selectedSection) : getGuardianCountForClass(selectedClassroom)) : getGuardianCountForClass(selectedClassroom)) : parents.length)} | দেখানো হচ্ছে: ${toBn(displayedParents.length)}`}</Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ borderColor: 'rgba(255,255,255,0.5)', color: 'white' }}>ব্যাক</Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => { if (!isAuthenticated()) { navigate('/login'); return; } navigate(`/school/${id}/parent/add`); }} sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>অভিভাবক যোগ করুন</Button>
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadParents} sx={{ borderColor: 'rgba(255,255,255,0.5)', color: 'white' }}>রিফ্রেশ</Button>
            </Stack>
          </Stack>
        </Paper>
      </Fade>

      <Paper elevation={2} sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormControl fullWidth>
            <InputLabel>শ্রেণি অনুযায়ী ফিল্টার</InputLabel>
            <Select value={selectedClassroom} label="শ্রেণি অনুযায়ী ফিল্টার" onChange={(e) => { setSelectedClassroom(e.target.value); setSelectedSection(''); setShowAll(false); setFocusParent(''); }}>
              <MenuItem value="">সব শ্রেণি</MenuItem>
              {sortedClassrooms.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth placeholder="অভিভাবকের নাম বা ইউজারনেম দিয়ে খুঁজুন..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }} />
          <Button variant={showAll ? 'contained' : 'outlined'} color="primary" onClick={() => { setShowAll(true); setSelectedClassroom(''); setSelectedSection(''); setFocusParent(''); }} sx={{ whiteSpace: 'nowrap' }}>সকল অভিভাবক দেখুন</Button>
        </Stack>
      </Paper>

      {loading ? (
        <Grid container spacing={2}>{[1,2,3,4,5,6].map(i => (<Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={i}><CardSkeleton /></Grid>))}</Grid>
      ) : !showAll && !selectedClassroom ? (
        <Grid container spacing={2}>
          {sortedClassrooms.map((c) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={c.id}>
              <Box onClick={() => { setSelectedClassroom(String(c.id)); setSelectedSection(''); setShowAll(false); setFocusParent(''); }} sx={{ cursor: 'pointer' }}>
                <ClassCard classroom={c} />
                <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}><Chip icon={<FamilyRestroomIcon />} label={`মোট ${toBn(getGuardianCountForClass(c.id))} জন অভিভাবক`} color="primary" variant="outlined" size="small" sx={{ fontWeight: 700 }} /></Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      ) : !showAll && selectedClassroom && !selectedSection && requiresSectionForSelectedClass ? (
        <Grid container spacing={2}>
          {((sections || []).filter(s => String(s.classroom?.id ?? s.classroom) === String(selectedClassroom))).length === 0 ? (
            <Grid size={{ xs: 12 }}><EmptyState title="এই শ্রেণিতে কোনো সেকশন পাওয়া যায়নি" message="দয়া করে আগে এই শ্রেণির জন্য সেকশন যুক্ত করুন" /></Grid>
          ) : (
            (sections || []).filter(s => String(s.classroom?.id ?? s.classroom) === String(selectedClassroom))
              .map(sec => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={sec.id}>
                  <Paper elevation={3} onClick={() => { setSelectedSection(String(sec.id)); setShowAll(false); setFocusParent(''); }} sx={{ cursor: 'pointer', p: 3, borderRadius: 3, minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)', transition: 'all 0.25s ease', '&:hover': { boxShadow: 8, transform: 'translateY(-4px)' } }}>
                    <Stack alignItems="center" spacing={1.5}>
                      <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: 'primary.light', color: 'primary.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FamilyRestroomIcon /></Box>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>সেকশন {sec.name}</Typography>
                      <Chip icon={<FamilyRestroomIcon />} label={`মোট ${toBn(getGuardianCountForSection(sec.id))} জন অভিভাবক`} color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
                    </Stack>
                  </Paper>
                </Grid>
              ))
          )}
        </Grid>
      ) : (
        <Fade in timeout={700}>
          <Grid container spacing={2}>
            {displayedParents.map((parent) => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={parent.id}>
                <Box onClick={() => navigate(`/school/${id}/parent/${parent.id}/dashboard`)} sx={{ cursor: 'pointer' }}>
                  <ProfileCard profile={parent} onUpdate={handleCardUpdate} showRole={true} showActions={true} schoolId={id} enableLinkStudents={true} childNames={getChildNamesForParent(parent)} childProfiles={getChildProfilesForParent(parent)} forceLinkStudents={true} filterClassroomId={selectedClassroom || undefined} filterSectionId={selectedSection || undefined} />
                </Box>
              </Grid>
            ))}
          </Grid>
        </Fade>
      )}

      {!loading && displayedParents.length === 0 && (selectedClassroom || showAll) && <EmptyState title="কোন অভিভাবক পাওয়া যায়নি" message="নির্বাচিত শ্রেণি ও সেকশনে কোনো অভিভাবক নেই বা পাওয়া যায়নি" />}
    </Box>
  );
}
