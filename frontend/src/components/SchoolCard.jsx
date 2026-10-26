import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { getMediaUrl } from '../utils/media';
import LazyImage from './LazyImage';

import { isAuthenticated } from '../utils/auth';

const SchoolCard = ({ school }) => {
  const navigate = useNavigate();

  const handleCardClick = () => {
    if (isAuthenticated()) {
      navigate(`/school/${school.id}`);
    } else {
      navigate(`/login?next=${encodeURIComponent(`/school/${school.id}`)}`);
    }
  };

  // Handle both logo and img properties, with fallback to empty string
  const logoSrc = React.useMemo(() => {
    return getMediaUrl(school?.logo_thumbnail_url || school?.logo_thumbnail || school?.logo || school?.img) || '';
  }, [school?.logo_thumbnail_url, school?.logo_thumbnail, school?.logo, school?.img]);

  return (
    <Card
      onClick={handleCardClick}
      sx={{
        width: 250,
        margin: '0 auto',
        borderRadius: 3,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        transition: 'transform 0.3s, box-shadow 0.3s',
        '&:hover': {
          transform: 'translateY(-10px)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          cursor: 'pointer'
        },
        background: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)',
        color: 'white',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 1 }}>
        {logoSrc &&
          <LazyImage
            src={logoSrc}
            alt={school.name}
            sx={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              border: '2px solid white',
            }}
          />
        }
      </Box>
      <CardContent sx={{ textAlign: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
          {school.name}
        </Typography>
        {school.address && (
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>
            {school.address}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default SchoolCard;
