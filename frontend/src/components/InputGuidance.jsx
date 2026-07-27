import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { styled, keyframes } from '@mui/system';

const zoomOut = keyframes`
  from {
    transform: translateX(-50%) scale(0);
    opacity: 0;
  }
  to {
    transform: translateX(-50%) scale(1);
    opacity: 1;
  }
`;

const GuidanceOverlay = styled(Box)(({ theme }) => ({
  position: 'fixed',
  zIndex: 10000,
  backgroundColor: 'rgba(79, 70, 229, 0.95)',
  color: 'white',
  padding: '10px 20px',
  borderRadius: '24px',
  cursor: 'pointer',
  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
  transform: 'translateX(-50%)',
  animation: `${zoomOut} 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards`,
  pointerEvents: 'auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: '-10px',
    left: '50%',
    transform: 'translateX(-50%)',
    borderWidth: '10px 10px 0',
    borderStyle: 'solid',
    borderColor: 'rgba(79, 70, 229, 0.95) transparent transparent',
  }
}));

const InputGuidance = ({ steps, activeStep, onStepComplete }) => {
  const [coords, setCoords] = useState(null);
  const [isVisible, setIsVisible] = useState(true);
  const currentStep = steps[activeStep];

  useEffect(() => {
    setIsVisible(true);

    const updatePosition = () => {
      if (!currentStep) return;

      let element = document.querySelector(currentStep.selector);
      if (!element) return;

      // Handle MUI wrappers
      if ((element.tagName === 'INPUT' && (element.type === 'hidden' || element.style.display === 'none')) ||
          (element.offsetWidth === 0 && element.offsetHeight === 0)) {
        const wrapper = element.closest('.MuiFormControl-root') ||
                        element.closest('.MuiInputBase-root') ||
                        element.parentElement;
        if (wrapper) element = wrapper;
      }

      const rect = element.getBoundingClientRect();
      if (rect.top === 0 && rect.left === 0) return;

      setCoords({
        top: rect.top - 48,
        left: rect.left + rect.width / 2,
      });
    };

    // Delay slightly to ensure layout is settled
    const timer = setTimeout(updatePosition, 150);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [activeStep, currentStep]);

  if (!currentStep || !coords || !isVisible) return null;

  const isButton = currentStep.selector.toLowerCase().includes('button') ||
                   currentStep.selector.includes('show') ||
                   currentStep.selector.includes('sync') ||
                   currentStep.selector.includes('generate') ||
                   currentStep.text.includes('সার্চ') ||
                   currentStep.text.includes('জেনারেট');

  const text = isButton ? 'এখানে ক্লিক করুন' : currentStep.text;

  return (
    <GuidanceOverlay
      sx={{
        top: coords.top,
        left: coords.left
      }}
      onClick={() => {
        setIsVisible(false);
        if (currentStep.autoNext) {
          onStepComplete(activeStep + 1);
        }
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
        {text}
      </Typography>
    </GuidanceOverlay>
  );
};

export default InputGuidance;
