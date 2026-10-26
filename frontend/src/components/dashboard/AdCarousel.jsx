import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Stack, Button, Chip } from '@mui/material';
import { getMediaUrl } from '../../utils/media';

const SLOTS_CONFIG = [
  { key: 'slot1', title: 'প্রকাশনা' },
  { key: 'slot2', title: 'কর্পোরেট পার্টনার' },
  { key: 'slot3', title: 'ব্র্যান্ড ও সেবা' },
];

const SingleAdSlot = ({ slotTitle, items, width, height, onAddClick }) => {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    setIdx(0);
  }, [items?.length]);

  useEffect(() => {
    if (!items || items.length <= 1) return;

    const current = items[idx % items.length];
    if (current?.type === 'video') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % items.length);
    }, 5000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [items, idx]);

  if (!items || items.length === 0) {
    return (
      <Box
        onClick={onAddClick}
        sx={{
          position: 'relative',
          width,
          height,
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: 'rgba(255,255,255,0.15)',
          border: '1px dashed rgba(255,255,255,0.4)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: onAddClick ? 'pointer' : 'default',
          p: 1,
          flexShrink: 0
        }}
      >
        <Chip
          label={slotTitle}
          size="small"
          sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '0.65rem', height: 20, mb: 0.5 }}
        />
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.65rem' }}>
          {onAddClick ? '+ বিজ্ঞাপন দিন' : 'বিজ্ঞাপন খালি'}
        </Typography>
      </Box>
    );
  }

  const activeIndex = idx % items.length;
  const ad = items[activeIndex];
  const mediaSrc = (typeof ad.src === 'string' && ad.src.startsWith('data:')) ? ad.src : getMediaUrl(ad.src || ad.media_url || ad.media);

  return (
    <Box
      sx={{
        position: 'relative',
        width,
        height,
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: '#000',
        cursor: ad.link ? 'pointer' : 'default',
        boxShadow: 3,
        flexShrink: 0
      }}
      onClick={() => { if (ad.link) window.open(ad.link, '_blank'); }}
    >
      {ad.type === 'video' ? (
        <Box
          component="video"
          src={mediaSrc}
          autoPlay
          muted
          playsInline
          preload="metadata"
          onEnded={() => setIdx((i) => (i + 1) % items.length)}
          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <Box
          component="img"
          src={mediaSrc}
          alt={ad.text || slotTitle}
          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}

      {/* Header Slot Label Badge */}
      <Box sx={{ position: 'absolute', top: 4, left: 4, zIndex: 2 }}>
        <Chip
          label={`${slotTitle} ${items.length > 1 ? `(${activeIndex + 1}/${items.length})` : ''}`}
          size="small"
          sx={{
            bgcolor: 'rgba(0, 0, 0, 0.7)',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '0.65rem',
            height: 20,
            backdropFilter: 'blur(4px)'
          }}
        />
      </Box>

      {/* Footer Text Overlay */}
      {ad.text && (
        <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, bgcolor: 'rgba(0,0,0,0.65)', color: '#fff', px: 1, py: 0.5 }}>
          <Typography variant="caption" noWrap display="block" sx={{ fontSize: '0.65rem' }}>
            {ad.text}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

const AdCarousel = ({ ads, schoolLogo, schoolName, onAddAdClick }) => {
  const W = { xs: '100%', sm: 190, md: 220 };
  const H = { xs: 110, sm: 95, md: 95 };

  const allAds = Array.isArray(ads) ? ads : [];

  // Group ads by slot (slot1, slot2, slot3)
  const adsBySlot = {
    slot1: allAds.filter(a => (a.slot === 'slot1' || (!a.slot && allAds.indexOf(a) % 3 === 0))),
    slot2: allAds.filter(a => (a.slot === 'slot2' || (!a.slot && allAds.indexOf(a) % 3 === 1))),
    slot3: allAds.filter(a => (a.slot === 'slot3' || (!a.slot && allAds.indexOf(a) % 3 === 2))),
  };

  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ overflowX: 'auto', py: 1, maxWidth: '100%' }}>
      {SLOTS_CONFIG.map((cfg) => (
        <SingleAdSlot
          key={cfg.key}
          slotTitle={cfg.title}
          items={adsBySlot[cfg.key] || []}
          width={W}
          height={H}
          onAddClick={onAddAdClick}
        />
      ))}
      {onAddAdClick && (
        <Button
          variant="outlined"
          color="inherit"
          size="small"
          onClick={onAddAdClick}
          sx={{ borderRadius: 4, fontWeight: 'bold', fontSize: '0.75rem', whiteSpace: 'nowrap', borderColor: 'rgba(255,255,255,0.7)', height: 32 }}
        >
          + বিজ্ঞাপন
        </Button>
      )}
    </Stack>
  );
};

export default AdCarousel;
