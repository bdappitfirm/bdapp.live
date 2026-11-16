import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Paper,
  Grid,
  MenuItem,
  Backdrop,
  CircularProgress,
  Divider,
  FormControlLabel,
  Switch
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import BadgeIcon from '@mui/icons-material/Badge';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useToast } from '../components/Toast';
import { resolveSchoolLogo } from '../utils/media';
import fallbackLogo from '../components/fallback_logo.png';

// A4 ল্যান্ডস্কেপ শীটের মাপ (মিমি) — ফিতা সব সময় এই শীটেই সাজানো হবে
const PAGE_W_MM = 297;
const PAGE_H_MM = 209; // ২১০ নয় — শেষে ফাঁকা পেজ ঠেকাতে ১ মিমি কম
const PAGE_PAD_MM = 6;
const GAP_MM = 2;
const STRIP_W_MM = PAGE_W_MM - PAGE_PAD_MM * 2; // কাটার উপযোগী ফিতার দৈর্ঘ্য
const UNIT_W_MM = 95; // ফিতার উপরে একবার লোগো+নাম যতটুকু জায়গা নেবে

// প্রফেশনাল কালার থিম
const THEMES = [
  { key: 'navy', label: 'নেভি ব্লু', bg: 'linear-gradient(90deg,#0a4b94 0%,#1e6fd0 100%)', accent: '#f5b301', text: '#ffffff' },
  { key: 'teal', label: 'সবুজ', bg: 'linear-gradient(90deg,#00695c 0%,#26a69a 100%)', accent: '#ffca28', text: '#ffffff' },
  { key: 'maroon', label: 'মেরুন', bg: 'linear-gradient(90deg,#7b1f2b 0%,#b03a48 100%)', accent: '#f2d16b', text: '#ffffff' },
  { key: 'purple', label: 'পার্পল', bg: 'linear-gradient(90deg,#4a148c 0%,#7b1fa2 100%)', accent: '#ffd54f', text: '#ffffff' },
  { key: 'black', label: 'কালো-সোনালি', bg: 'linear-gradient(90deg,#1b1b1b 0%,#3d3d3d 100%)', accent: '#d4af37', text: '#ffffff' },
  { key: 'sky', label: 'আকাশি', bg: 'linear-gradient(90deg,#01579b 0%,#4fc3f7 100%)', accent: '#ffffff', text: '#ffffff' }
];

// ফিতার একেকটি অংশ — লোগো, বাংলা নাম, ইংরেজি নাম ও নিচের তথ্য
const RibbonStrip = ({ theme, logo, repeatCount, heightMm, sizes, show, fields }) => {
  const metaParts = [];
  if (show.eiin && fields.eiin) metaParts.push(`EIIN: ${fields.eiin}`);
  if (show.address && fields.address) metaParts.push(fields.address);
  if (show.phone && fields.phone) metaParts.push(`মোবাইল: ${fields.phone}`);
  if (show.session && fields.session) metaParts.push(`শিক্ষাবর্ষ: ${fields.session}`);
  const meta = metaParts.join('  •  ');

  return (
    <Box
      className="ribbon-strip"
      sx={{
        position: 'relative',
        width: '100%',
        height: `${heightMm}mm`,
        boxSizing: 'border-box',
        background: theme.bg,
        color: theme.text,
        borderRadius: '1mm',
        border: `0.4mm solid ${theme.accent}`,
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden'
      }}
    >
      {/* উপরে-নিচে সেলাই/স্টিচ লাইন — প্রফেশনাল ফিনিশিং */}
      <Box sx={{ position: 'absolute', top: '1mm', left: 0, right: 0, height: '0.25mm', background: theme.accent, opacity: 0.5 }} />
      <Box sx={{ position: 'absolute', bottom: '1mm', left: 0, right: 0, height: '0.25mm', background: theme.accent, opacity: 0.5 }} />

      {Array.from({ length: repeatCount }).map((_, i) => (
        <Stack
          key={i}
          direction="row"
          alignItems="center"
          sx={{ flex: '1 1 0', minWidth: 0, px: '2mm', gap: '1.6mm', justifyContent: 'center', position: 'relative', zIndex: 1 }}
        >
          {show.logo && (
            <Box
              sx={{
                width: `${sizes.logo}mm`,
                height: `${sizes.logo}mm`,
                flexShrink: 0,
                borderRadius: '50%',
                bgcolor: '#ffffff',
                border: `0.4mm solid ${theme.accent}`,
                p: '0.5mm',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Box component="img" src={logo} alt="" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </Box>
          )}
          <Box sx={{ minWidth: 0, overflow: 'hidden', textAlign: 'left' }}>
            {/* প্রথম লাইন: বাংলা ও ইংরেজি নাম পাশাপাশি */}
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '1.6mm', minWidth: 0, overflow: 'hidden', lineHeight: 1.1 }}>
              <Typography sx={{ fontSize: `${sizes.nameBn}mm`, fontWeight: 800, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', letterSpacing: '0.02mm' }}>
                {fields.nameBn}
              </Typography>
              {fields.nameEn && (
                <Typography sx={{ fontSize: `${sizes.nameEn}mm`, fontWeight: 600, color: theme.text, opacity: 0.95, whiteSpace: 'nowrap', overflow: 'hidden', letterSpacing: '0.05mm' }}>
                  {fields.nameEn}
                </Typography>
              )}
            </Box>
            {/* দ্বিতীয় লাইন: স্লোগান + EIIN/ঠিকানা/মোবাইল/শিক্ষাবর্ষ */}
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '1.6mm', minWidth: 0, overflow: 'hidden', lineHeight: 1.15 }}>
              {show.slogan && fields.slogan && (
                <Typography sx={{ fontSize: `${sizes.meta}mm`, fontStyle: 'italic', opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {fields.slogan}
                </Typography>
              )}
              {meta && (
                <Typography sx={{ fontSize: `${sizes.meta}mm`, opacity: 0.92, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {meta}
                </Typography>
              )}
            </Box>
          </Box>
        </Stack>
      ))}
    </Box>
  );
};

export default function IDCardRibbonGenerator() {
  const { id } = useParams();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [school, setSchool] = useState(null);

  const [copies, setCopies] = useState(1);
  const [lanyardLength, setLanyardLength] = useState(900);
  const [stripHeight, setStripHeight] = useState(20);
  const [themeKey, setThemeKey] = useState('navy');

  const [nameBn, setNameBn] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [eiin, setEiin] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [session, setSession] = useState(String(new Date().getFullYear()));
  const [slogan, setSlogan] = useState('');

  const [showLogo, setShowLogo] = useState(true);
  const [showEiin, setShowEiin] = useState(true);
  const [showAddress, setShowAddress] = useState(true);
  const [showPhone, setShowPhone] = useState(true);
  const [showSession, setShowSession] = useState(true);
  const [showSlogan, setShowSlogan] = useState(false);

  // প্রিন্ট স্টাইল মাউন্টের সময় ইনজেক্ট ও আনমাউন্টের সময় রিমুভ করা হয় —
  // যেন অন্য কোনো পেজের প্রিন্ট লেআউট এই পেজের @page রুলে নষ্ট না হয়।
  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'id-card-ribbon-print-style';
    el.textContent = `
      @media screen {
        .id-card-ribbon-root .ribbon-page-viewport {
          width: calc(297mm * 0.6);
          height: calc(209mm * 0.6);
          overflow: hidden;
          margin: 0 auto 10px;
        }
        .id-card-ribbon-root .ribbon-print-page { transform: scale(0.6); transform-origin: top left; }
        /* PDF এক্সপোর্টের সময় স্কেল বন্ধ করে আসল মাপে রেন্ডার করা হয় */
        .id-card-ribbon-root.ribbon-exporting .ribbon-page-viewport {
          width: auto !important; height: auto !important; overflow: visible !important; margin: 0 !important;
        }
        .id-card-ribbon-root.ribbon-exporting .ribbon-print-page { transform: none !important; }
      }
      @media print {
        @page { size: A4 landscape; margin: 0; }
        body { background: #ffffff !important; margin: 0 !important; }
        .no-print, header, footer, nav, aside,
        .MuiAppBar-root, .MuiDrawer-root, .MuiToolbar-root,
        .MuiBackdrop-root, .MuiSnackbar-root { display: none !important; }
        .id-card-ribbon-root { padding: 0 !important; margin: 0 !important; display: block !important; gap: 0 !important; }
        .id-card-ribbon-root .ribbon-page-viewport {
          width: auto !important; height: auto !important; overflow: visible !important; margin: 0 !important;
        }
        .id-card-ribbon-root .ribbon-print-page {
          transform: none !important;
          width: 297mm !important;
          height: 209mm !important;
          max-height: 209mm !important;
          padding: 6mm !important;
          margin: 0 !important;
          box-sizing: border-box !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 2mm !important;
          overflow: hidden !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          page-break-after: always !important;
          break-after: page !important;
        }
        .id-card-ribbon-root .ribbon-print-page:last-child {
          page-break-after: auto !important;
          break-after: auto !important;
        }
        .id-card-ribbon-root .ribbon-print-page,
        .id-card-ribbon-root .ribbon-print-page * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  const loadSchool = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/api/schools/${id}/`)
      .then(res => {
        const s = res.data || {};
        setSchool(s);
        setNameBn(s.name || '');
        setNameEn(s.name_en || '');
        setEiin(s.ein || '');
        setAddress(s.address || s.address_en || '');
        setPhone(s.phone_number || s.phone || '');
      })
      .catch(() => toast.error('স্কুলের তথ্য লোড করা যায়নি'))
      .finally(() => setLoading(false));
  }, [id, toast]);

  useEffect(() => { loadSchool(); }, [loadSchool]);

  const theme = useMemo(() => THEMES.find(t => t.key === themeKey) || THEMES[0], [themeKey]);
  const logo = useMemo(() => resolveSchoolLogo(school) || fallbackLogo, [school]);

  // প্রতি পেজে কতটি ফিতা-স্ট্রিপ বসবে
  const stripsPerPage = useMemo(
    () => Math.max(1, Math.floor((PAGE_H_MM - PAGE_PAD_MM * 2 + GAP_MM) / (stripHeight + GAP_MM))),
    [stripHeight]
  );

  // নির্দিষ্ট সংখ্যক ও দৈর্ঘ্যের ফিতা বানাতে মোট কত স্ট্রিপ লাগবে
  const totalStrips = useMemo(() => {
    const count = Number(copies) || 0;
    const len = Number(lanyardLength) || 0;
    if (count <= 0 || len <= 0) return 0;
    return Math.min(400, Math.ceil((count * len) / STRIP_W_MM));
  }, [copies, lanyardLength]);

  const pages = useMemo(() => {
    const out = [];
    for (let i = 0; i < totalStrips; i += stripsPerPage) {
      out.push(Math.min(stripsPerPage, totalStrips - i));
    }
    return out;
  }, [totalStrips, stripsPerPage]);

  const repeatCount = useMemo(() => Math.max(2, Math.floor(STRIP_W_MM / UNIT_W_MM)), []);

  const sizes = useMemo(() => ({
    logo: (stripHeight * 0.6).toFixed(2),
    nameBn: (stripHeight * 0.26).toFixed(2),
    nameEn: (stripHeight * 0.18).toFixed(2),
    meta: (stripHeight * 0.098).toFixed(2)
  }), [stripHeight]);

  const show = useMemo(() => ({
    logo: showLogo, eiin: showEiin, address: showAddress,
    phone: showPhone, session: showSession, slogan: showSlogan
  }), [showLogo, showEiin, showAddress, showPhone, showSession, showSlogan]);

  const fields = useMemo(() => ({ nameBn, nameEn, eiin, address, phone, session, slogan }),
    [nameBn, nameEn, eiin, address, phone, session, slogan]);

  // প্রিন্টের আগে লোগো লোড নিশ্চিত করা — নাহলে প্রিন্টে অসম্পূর্ণ ছবি আসে
  const waitForImages = async () => {
    const container = document.querySelector('.id-card-ribbon-root');
    if (!container) return;
    const pending = Array.from(container.querySelectorAll('img')).filter(img => !img.complete || img.naturalHeight === 0);
    if (!pending.length) return;
    await Promise.race([
      Promise.all(pending.map(img => new Promise(res => {
        img.onload = res; img.onerror = res; setTimeout(res, 250);
      }))),
      new Promise(res => setTimeout(res, 500))
    ]);
  };

  const handlePrint = async () => {
    if (!totalStrips) return toast.warning('প্রথমে ফিতার সংখ্যা ঠিক করুন');
    toast.info('প্রিন্ট উইন্ডো খোলা হচ্ছে...');
    await waitForImages();
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!totalStrips) return toast.warning('কোনো ফিতা নেই');
    const rootEl = document.querySelector('.id-card-ribbon-root');
    toast.info('PDF তৈরি হচ্ছে...');
    try {
      rootEl?.classList.add('ribbon-exporting');
      await waitForImages();
      const pageEls = document.querySelectorAll('.ribbon-print-page');
      const pdf = new jsPDF('l', 'mm', 'a4');
      for (let i = 0; i < pageEls.length; i++) {
        if (i > 0) pdf.addPage();
        const canvas = await html2canvas(pageEls[i], { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, PAGE_W_MM, PAGE_H_MM);
      }
      pdf.save(`id-card-ribbon-${id}.pdf`);
      toast.success('PDF ডাউনলোড সফল হয়েছে');
    } catch (err) {
      console.error(err);
      toast.error('PDF ডাউনলোড ব্যর্থ হয়েছে');
    } finally {
      rootEl?.classList.remove('ribbon-exporting');
    }
  };

  return (
    <Box className="id-card-ribbon-root" sx={{ p: 3 }}>
      <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }} open={loading}>
        <CircularProgress color="inherit" />
      </Backdrop>

      {/* শিরোনাম ও অ্যাকশন */}
      <Paper elevation={0} sx={{ mb: 3, p: 3, background: 'linear-gradient(135deg, #0a4b94 0%, #1e6fd0 100%)', color: 'white', borderRadius: 3 }} className="no-print">
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <BadgeIcon sx={{ fontSize: 32 }} />
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>আইডি কার্ডের ফিতা</Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" color="success" startIcon={<PrintIcon />} onClick={handlePrint} disabled={!totalStrips}>
              প্রিন্ট করুন
            </Button>
            <Button variant="contained" color="secondary" startIcon={<PictureAsPdfIcon />} onClick={handleDownloadPDF} disabled={!totalStrips}>
              PDF ডাউনলোড
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* সেটিংস */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }} className="no-print">
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>ফিতার তথ্য ও ডিজাইন</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField
              fullWidth select size="small" label="কালার থিম"
              value={themeKey} onChange={(e) => setThemeKey(e.target.value)}
            >
              {THEMES.map(t => <MenuItem key={t.key} value={t.key}>{t.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField
              fullWidth size="small" type="number" label="কতটি ফিতা"
              value={copies} onChange={(e) => setCopies(e.target.value)}
              inputProps={{ min: 1, max: 200 }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField
              fullWidth size="small" type="number" label="প্রতি ফিতার দৈর্ঘ্য (মিমি)"
              value={lanyardLength} onChange={(e) => setLanyardLength(e.target.value)}
              inputProps={{ min: 300, max: 2000, step: 50 }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField
              fullWidth select size="small" label="ফিতার প্রস্থ"
              value={stripHeight} onChange={(e) => setStripHeight(Number(e.target.value))}
            >
              <MenuItem value={18}>১৮ মিমি</MenuItem>
              <MenuItem value={20}>২০ মিমি (স্ট্যান্ডার্ড)</MenuItem>
              <MenuItem value={25}>২৫ মিমি</MenuItem>
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField fullWidth size="small" label="স্কুলের নাম (বাংলা)" value={nameBn} onChange={(e) => setNameBn(e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField fullWidth size="small" label="School Name (English)" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField fullWidth size="small" label="EIIN" value={eiin} onChange={(e) => setEiin(e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField fullWidth size="small" label="শিক্ষাবর্ষ" value={session} onChange={(e) => setSession(e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField fullWidth size="small" label="ফোন / মোবাইল" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 9 }}>
            <TextField fullWidth size="small" label="ঠিকানা" value={address} onChange={(e) => setAddress(e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth size="small" label="স্লোগান / ট্যাগলাইন (ঐচ্ছিক)" value={slogan} onChange={(e) => setSlogan(e.target.value)} />
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />
        <Stack direction="row" flexWrap="wrap" columnGap={2} rowGap={0.5}>
          <FormControlLabel control={<Switch size="small" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} />} label="লোগো" />
          <FormControlLabel control={<Switch size="small" checked={showEiin} onChange={(e) => setShowEiin(e.target.checked)} />} label="EIIN" />
          <FormControlLabel control={<Switch size="small" checked={showAddress} onChange={(e) => setShowAddress(e.target.checked)} />} label="ঠিকানা" />
          <FormControlLabel control={<Switch size="small" checked={showPhone} onChange={(e) => setShowPhone(e.target.checked)} />} label="ফোন" />
          <FormControlLabel control={<Switch size="small" checked={showSession} onChange={(e) => setShowSession(e.target.checked)} />} label="শিক্ষাবর্ষ" />
          <FormControlLabel control={<Switch size="small" checked={showSlogan} onChange={(e) => setShowSlogan(e.target.checked)} />} label="স্লোগান" />
        </Stack>
      </Paper>

      {/* অ্যাসেম্বলি নির্দেশনা */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: '#f1f8e9', borderRadius: 2 }} className="no-print">
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <ContentCutIcon sx={{ color: '#558b2f', mt: 0.2 }} />
          <Typography variant="body2" sx={{ color: '#33691e', lineHeight: 1.6 }}>
            প্রিন্ট ডায়ালগে <b>Background graphics</b> চালু রাখুন। মোট <b>{totalStrips}</b> স্ট্রিপ ({pages.length} পেজ) প্রিন্ট হবে — প্রতিটি স্ট্রিপ {STRIP_W_MM} মিমি।
            ড্যাশ লাইন ধরে কেটে, প্রয়োজন অনুযায়ী স্ট্রিপগুলো জোড়া লাগিয়ে {Number(lanyardLength) || 0} মিমি দৈর্ঘ্যের ফিতা (নেক স্ট্র্যাপ) তৈরি করুন এবং প্রান্তে ক্লিপ/রিং লাগান।
          </Typography>
        </Stack>
      </Paper>

      {/* প্রিভিউ */}
      {totalStrips === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 3 }} className="no-print">
          <Typography variant="body1" color="text.secondary">
            ফিতার সংখ্যা ও দৈর্ঘ্য লিখুন, তারপর প্রিভিউ দেখা যাবে।
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, overflowX: 'auto' }}>
          {pages.map((count, pIdx) => (
            <Box key={pIdx} className="ribbon-page-viewport">
              <Box
                className="ribbon-print-page"
                sx={{
                  width: `${PAGE_W_MM}mm`,
                  height: `${PAGE_H_MM}mm`,
                  padding: `${PAGE_PAD_MM}mm`,
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: `${GAP_MM}mm`,
                  background: '#ffffff',
                  boxShadow: 3,
                  borderRadius: 1,
                  overflow: 'hidden'
                }}
              >
                {Array.from({ length: count }).map((_, i) => (
                  <RibbonStrip
                    key={i}
                    theme={theme}
                    logo={logo}
                    repeatCount={repeatCount}
                    heightMm={stripHeight}
                    sizes={sizes}
                    show={show}
                    fields={fields}
                  />
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
