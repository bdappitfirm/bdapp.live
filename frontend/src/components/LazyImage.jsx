import React from 'react';
import { Box, CircularProgress } from '@mui/material';

const LazyImage = ({ src, alt, sx = {}, ...props }) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  return (
    <Box sx={{ position: 'relative', overflow: 'hidden', ...sx }}>
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'grey.100'
          }}
        >
          <CircularProgress size={20} />
        </Box>
      )}
      <Box
        component="img"
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: error ? 'none' : 'block',
          opacity: loading ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out',
          ...sx
        }}
        {...props}
      />
      {error && (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'grey.200',
            color: 'grey.500',
            fontSize: '0.8rem'
          }}
        >
          Image Not Found
        </Box>
      )}
    </Box>
  );
};

export default LazyImage;
