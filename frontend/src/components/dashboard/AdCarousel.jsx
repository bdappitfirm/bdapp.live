import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Avatar, Stack, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { getMediaUrl } from '../../utils/media';

const AdSlot = ({ items, width, height }) => {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    setIdx(0);
  }, [items?.length]);

  useEffect(() => {
    if (!items || items.length <= 1) return;

    const current = items[Math.min(idx, items.length - 1)];
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

  if (!items || items.length === 0) return null;

  const ad = items[Math.min(idx, items.length - 1)];

  return (
    <Box
      sx={{
        position: 'relative',
        width,
        height,
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'rgba(255,255,255,0.2)',
        cursor: ad.link ? 'pointer' : 'default',
        m: 0,
        p: 0
      }}
      onClick={() => { if (ad.link) window.open(ad.link, '_blank'); }}
    >
      {ad.type === 'video' ? (
        <Box
          component="video"
          src={(typeof ad.src === 'string' && ad.src.startsWith('data:')) ? ad.src : getMediaUrl(ad.src)}
          autoPlay
          muted
          playsInline
          onEnded={() => setIdx((i) => (i + 1) % items.length)}
          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <Box
          component="img"
          src={(typeof ad.src === 'string' && ad.src.startsWith('data:')) ? ad.src : getMediaUrl(ad.src)}
          alt={ad.text || ''}
          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, bgcolor: 'rgba(0,0,0,0.35)', color: '#fff', px: 1, py: 0, fontSize: 10 }}>
        <Typography variant="caption" noWrap sx={{ fontSize: '0.65rem' }}>{ad.text || ''}</Typography>
      </Box>
    </Box>
  );
};

const AdCarousel = ({ ads, schoolLogo, schoolName }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const NUM_SLOTS = isMobile ? 1 : 3;
  const W = { xs: '100%', sm: 200, md: 240 };
  const H = { xs: 120, sm: 100, md: 100 };

  // Filter ads and ensure uniqueness
  const seen = new Set();
  const base = (Array.isArray(ads) ? ads : []).filter(ad => {
    const key = `${ad?.type || ''}:${ad?.src || ''}`;
    if (!ad?.src || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const makeGroup = (slotIndex) => base.filter((_, idx) => (idx % NUM_SLOTS) === slotIndex);

  if (base.length === 0) {
    return schoolLogo ? (
      <Avatar
        src={getMediaUrl(schoolLogo)}
        alt={schoolName}
        sx={{ width: 64, height: 64, border: '2px solid #fff', boxShadow: 2 }}
      />
    ) : null;
  }

  return (
    <Stack direction="row" spacing={2} alignItems="center" sx={{ overflowX: 'auto', py: 1 }}>
      {Array.from({ length: Math.min(NUM_SLOTS, base.length) }, (_, i) => (
        <AdSlot key={i} items={makeGroup(i)} width={W} height={H} />
      ))}
    </Stack>
  );
};

export default AdCarousel;
