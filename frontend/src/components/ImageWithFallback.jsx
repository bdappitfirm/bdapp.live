import React, { useState } from 'react';
import { Box } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';

const ImageWithFallback = ({
  src,
  srcCandidates = null,
  fallbackSrc = null,
  alt = 'Image',
  width = '100%',
  height = '100%',
  fallback = null,
  ...props
}) => {
  const [imgError, setImgError] = useState(false);
  const [index, setIndex] = useState(0);

  const list = Array.isArray(srcCandidates) && srcCandidates.length ? srcCandidates : (src ? [src] : []);
  const currentSrc = list.length ? list[Math.max(0, Math.min(index, list.length - 1))] : null;

  React.useEffect(() => {
    setImgError(false);
    setIndex(0);
  }, [src, srcCandidates]);

  if (imgError || !currentSrc) {
    if (fallbackSrc) {
      return (
        <img
          src={fallbackSrc}
          alt={alt}
          style={{ width: width || '100%', height: height || '100%', objectFit: 'cover' }}
          {...props}
        />
      );
    }
    return fallback || (
      <Box
        width={width}
        height={height}
        display="flex"
        alignItems="center"
        justifyContent="center"
        bgcolor="action.hover"
        {...props}
      >
        <PersonIcon />
      </Box>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      onError={() => {
        if (Array.isArray(list) && index < list.length - 1) {
          setIndex(index + 1);
          setImgError(false);
        } else {
          setImgError(true);
        }
      }}
      style={{
        width,
        height,
        objectFit: 'cover',
      }}
      {...props}
    />
  );
};

export default ImageWithFallback;
