import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import { getActiveClassrooms } from '../utils/classroomUtils';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Paper,
  Tabs,
  Tab,
  MenuItem,
  Backdrop,
  CircularProgress
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import BadgeIcon from '@mui/icons-material/Badge';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import IDCard from '../components/IDCard';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { CardSkeleton } from '../components/LoadingSkeleton';
import InputGuidance from '../components/InputGuidance';

function IDCardGenerator() {
  const { id } = useParams();
  const toast = useToast();
  
  const [tabValue, setTabValue] = useState(0);
  const [searchType, setSearchType] = useState('single');
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [school, setSchool] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [allSections, setAllSections] = useState([]);
  const [filterSections, setFilterSections] = useState([]);
  const [hmPhone, setHmPhone] = useState('');
  const [cards, setCards] = useState([]);
  const [activeStep, setActiveStep] = useState(0);
  const [lang, setLang] = useState('bn');
  const printStyleRef = useRef(null);

  // Print styles live in <head> as a real stylesheet, not inside the page body.
  // Chrome only honours @page / @media print reliably from a head stylesheet —
  // this is what removes the browser's own header/footer (date, URL, page number)
  // from the printed ID cards.
  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'id-card-print-style';
    el.textContent = `
      @media print {
        @page { size: A4 portrait; margin: 0; }
      }
    `;
    document.head.appendChild(el);
    printStyleRef.current = el;
    return () => {
      printStyleRef.current = null;
      el.remove();
    };
  }, []);

  // Drop the print-only classes once the print dialog is dismissed.
  useEffect(() => {
    const reset = () => {
      const container = document.querySelector('.id-card-container');
      if (!container) return;
      container.classList.remove('printing-single');
      container.querySelectorAll('.id-card-wrapper.print-target').forEach((el) => el.classList.remove('print-target'));
    };
    window.addEventListener('afterprint', reset);
    return () => window.removeEventListener('afterprint', reset);
  }, []);

  const guidanceSteps = [
    { selector: '#class-select', text: 'শ্রেণি নির্বাচন করুন', autoNext: false },
    { selector: '#section-select', text: 'সেকশন নির্বাচন করুন', autoNext: false },
    { selector: '#generate-button', text: 'এখানে ক্লিক করুন', autoNext: true }
  ];

  useEffect(() => {
    if (classFilter && activeStep === 0) setActiveStep(1);
    if (sectionFilter && activeStep === 1) setActiveStep(2);
    if (cards.length > 0 && (activeStep === 1 || activeStep === 2)) setActiveStep(3);
  }, [classFilter, sectionFilter, cards.length, activeStep]);

  const loadAllSections = useCallback(() => {
    api.get(`/api/academics/sections/?school=${id}`)
      .then(res => setAllSections(Array.isArray(res.data) ? res.data : res.data.results || []))
      .catch(err => console.error(err));
  }, [id]);

  const loadSchool = useCallback(() => {
    api.get(`/api/schools/${id}/`).then(res => setSchool(res.data)).catch(err => console.error(err));
    api.get(`/api/users/teachers/?school=${id}`).then(res => {
      const arr = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      const isHM = (d) => { const s = String(d || '').toLowerCase(); return s.includes('প্রধান') || s.includes('head') || s.includes('principal'); };
      let phone = arr.find(p => isHM(p?.designation || p?.user?.designation))?.phone_number || '';
      if (phone) setHmPhone(phone);
    }).catch(() => {});
  }, [id]);

  const loadClassrooms = useCallback(() => {
    api.get(`/api/academics/classrooms/?school=${id}`)
      .then(res => setClassrooms(Array.isArray(res.data) ? res.data : res.data.results || []))
      .catch(err => console.error(err));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    loadSchool();
    loadClassrooms();
    loadAllSections();
  }, [id, loadSchool, loadClassrooms, loadAllSections]);

  const loadSections = useCallback((classroomId) => {
    if (!classroomId) { setFilterSections([]); return; }
    api.get(`/api/academics/sections/?classroom=${classroomId}&school=${id}`)
      .then(res => setFilterSections(Array.isArray(res.data) ? res.data : res.data.results || []))
      .catch(err => console.error(err));
  }, [id]);

  const searchStudents = async () => {
    setLoading(true);
    try {
      let url = `/api/academics/students/?school=${id}`;
      if (searchType === 'single' && searchQuery) url += isNaN(searchQuery) ? `&search=${searchQuery}` : `&roll_number=${searchQuery}`;
      else if (searchType === 'bulk') { if (classFilter) url += `&classroom=${classFilter}`; if (sectionFilter) url += `&section=${sectionFilter}`; }
      const res = await api.get(url);
      let data = Array.isArray(res.data) ? res.data : res.data.results || [];
      data = data.map(s => ({
        ...s,
        blood_group: s.blood_group || s.user?.blood_group || s.profile?.blood_group || '',
        user: { ...s.user, photo_url: s.photo || s.user?.photo_url || s.user?.photo, blood_group: s.blood_group || s.user?.blood_group || '' }
      }));
      setCards(data.sort((a, b) => (parseInt(a.roll_number) || 0) - (parseInt(b.roll_number) || 0)));
      if (data.length) toast.success(`Generated ${data.length} cards`);
      else toast.warning('No students found');
    } catch (err) { toast.error('Failed to load students'); } finally { setLoading(false); }
  };

  const searchTeachers = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/users/teachers/?school=${id}${searchQuery ? `&search=${searchQuery}` : ''}`);
      const data = (Array.isArray(res.data) ? res.data : res.data.results || []).map(t => ({ ...t, user: { ...t.user, photo_url: t.photo || t.user?.photo_url } }));
      setCards(data);
      if (data.length) toast.success(`Generated ${data.length} cards`);
      else toast.warning('No teachers found');
    } catch (err) { toast.error('Failed to load teachers'); } finally { setLoading(false); }
  };

  const handleSearch = () => tabValue === 0 ? searchStudents() : searchTeachers();

  const handlePrint = () => {
    if (!cards.length) return toast.warning('Generate cards first');
    // Keep the print stylesheet as the last rule in <head> so its @page rule
    // wins over any stylesheet another page may have injected.
    const styleEl = printStyleRef.current;
    if (styleEl && styleEl.parentNode) styleEl.parentNode.appendChild(styleEl);
    toast.info('Opening print dialog...');
    window.print();
  };

  const handleDownloadAll = async () => {
    if (!cards.length) return;
    toast.info('Generating PDF...');
    const wrappers = document.querySelectorAll('.id-card-wrapper');
    const pdf = new jsPDF('p', 'mm', 'a4');
    for (let i = 0; i < wrappers.length; i++) {
      const front = await html2canvas(wrappers[i].querySelector('.id-card-front'), { scale: 2, useCORS: true });
      if (i > 0 && i % 9 === 0) pdf.addPage();
      const x = 10 + (i % 3) * 65;
      const y = 10 + (Math.floor((i % 9) / 3)) * 90;
      pdf.addImage(front.toDataURL('image/png'), 'PNG', x, y, 60, 85);
    }
    pdf.save(`id-cards-${id}.pdf`);
    toast.success('Downloaded');
  };

  return (
    <Box className="id-card-generator-root" sx={{ p: 3 }}>
      <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }} open={loading}>
        <CircularProgress color="inherit" />
      </Backdrop>
      <Paper elevation={0} sx={{ mb: 3, p: 3, background: 'linear-gradient(135deg, #00b09b 0%, #96c93d 100%)', color: 'white', borderRadius: 3 }} className="no-print">
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Box><Typography variant="h4" sx={{ fontWeight: 'bold' }}><BadgeIcon sx={{ mr: 1 }} /> আইডি কার্ড জেনারেটর</Typography></Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small"
              variant="contained"
              onClick={() => setLang('bn')}
              sx={{ bgcolor: lang === 'bn' ? '#ffffff' : 'rgba(255,255,255,0.2)', color: lang === 'bn' ? '#00796b' : 'white', fontWeight: 'bold' }}
            >
              বাংলা
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() => setLang('en')}
              sx={{ bgcolor: lang === 'en' ? '#ffffff' : 'rgba(255,255,255,0.2)', color: lang === 'en' ? '#00796b' : 'white', fontWeight: 'bold' }}
            >
              English
            </Button>
            {cards.length > 0 && <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint} sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>প্রিন্ট</Button>}
            {cards.length > 0 && <Button variant="contained" startIcon={<PictureAsPdfIcon />} onClick={handleDownloadAll} sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>ডাউনলোড</Button>}
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }} className="no-print">
        <Tabs value={tabValue} onChange={(e, v) => { setTabValue(v); setCards([]); }} sx={{ mb: 2 }}><Tab label="শিক্ষার্থী" /><Tab label="শিক্ষক" /></Tabs>
        {tabValue === 0 && (
          <Box>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}><Button variant={searchType === 'single' ? 'contained' : 'outlined'} onClick={() => setSearchType('single')}>একক</Button><Button variant={searchType === 'bulk' ? 'contained' : 'outlined'} onClick={() => setSearchType('bulk')}>শ্রেণি অনুযায়ী</Button></Stack>
            {searchType === 'single' ? <TextField label="রোল/নাম" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} fullWidth /> : (
              <Stack direction="row" spacing={2}>
                <TextField id="class-select" select label="শ্রেণি" value={classFilter} onChange={(e) => { setClassFilter(e.target.value); loadSections(e.target.value); }} fullWidth>{getActiveClassrooms(classrooms).map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}</TextField>
                <TextField id="section-select" select label="শাখা" value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} fullWidth disabled={!classFilter}>{filterSections.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}</TextField>
              </Stack>
            )}
          </Box>
        )}
        {tabValue === 1 && <TextField label="শিক্ষকের নাম" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} fullWidth />}
        <Button id="generate-button" variant="contained" startIcon={<SearchIcon />} onClick={handleSearch} disabled={loading} sx={{ mt: 2 }}>{loading ? 'তৈরি হচ্ছে...' : 'জেনারেট করুন'}</Button>
      </Paper>

      {loading ? <CardSkeleton count={4} /> : cards.length > 0 ? (
        <Box className="id-card-container" sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center', p: 2 }}>
          {(() => {
            const pages = [];
            for (let i = 0; i < cards.length; i += 4) {
              pages.push(cards.slice(i, i + 4));
            }
            return pages.map((pageCards, pIdx) => (
              <Box key={`id-page-${pIdx}`} className="id-card-page">
                {pageCards.map((item, idx) => (
                  <IDCard key={item.id || idx} type={tabValue === 0 ? 'student' : 'teacher'} data={item} school={school} classrooms={classrooms} sections={allSections} overridePhone={hmPhone} lang={lang} />
                ))}
              </Box>
            ));
          })()}
        </Box>
      ) : <EmptyState icon={BadgeIcon} title="কোনো কার্ড নেই" message="অনুসন্ধান করুন" />}

      <InputGuidance
        steps={guidanceSteps}
        activeStep={activeStep}
        onStepComplete={() => setActiveStep(prev => prev + 1)}
      />
    </Box>
  );
}

export default IDCardGenerator;
