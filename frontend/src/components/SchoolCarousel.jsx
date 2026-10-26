import React from 'react';
import Slider from 'react-slick';
import SchoolCard from './SchoolCard';
import { Box } from '@mui/material';

// Import CSS
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

const SchoolCarousel = ({ schools }) => {
  if (!schools || schools.length === 0) return null;

  const settings = {
    dots: true,
    infinite: schools.length > 1,
    speed: 1200, // Slower, more cinematic speed
    slidesToShow: 1,
    slidesToScroll: 1,
    arrows: true,
    autoplay: schools.length > 1,
    autoplaySpeed: 4000,
    centerMode: true,
    centerPadding: '20%', // Shows parts of left/right cards
    cssEase: "cubic-bezier(0.23, 1, 0.32, 1)", // Standard cinematic ease
    responsive: [
      {
        breakpoint: 960,
        settings: {
          centerPadding: '10%',
        }
      },
      {
        breakpoint: 600,
        settings: {
          centerPadding: '0px',
        }
      }
    ]
  };

  return (
    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ width: '100%', maxWidth: '1200px', position: 'relative', py: 5 }}>
        <style>{`
          .slick-list {
            overflow: visible !important;
          }
          .slick-slide {
            transition: all 1.2s cubic-bezier(0.23, 1, 0.32, 1);
            transform: scale(0.8);
            opacity: 0.4;
            filter: blur(2px);
            outline: none;
          }
          .slick-slide > div, .slick-slide > div > div {
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            width: 100% !important;
            padding: 10px 0;
          }
          .slick-center {
            transform: scale(1.15);
            opacity: 1;
            filter: blur(0);
            z-index: 10;
          }
          .slick-prev:before, .slick-next:before {
            color: #1a237e;
            font-size: 40px;
            opacity: 0.8;
          }
          .slick-prev { left: -60px; z-index: 11; }
          .slick-next { right: -60px; z-index: 11; }

          @media (max-width: 1300px) {
            .slick-prev { left: 10px; }
            .slick-next { right: 10px; }
          }
        `}</style>
        <Slider {...settings}>
          {schools.map((school) => (
            <div key={school.id} style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
              <SchoolCard school={school} />
            </div>
          ))}
        </Slider>
      </Box>
    </Box>
  );
};

export default SchoolCarousel;
