import React from 'react';
import Slider from 'react-slick';
import SchoolCard from './SchoolCard';
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

const SchoolCarousel = ({ schools }) => {
  const settings = {
    dots: true,
    infinite: true,
    speed: 600, // Smoother transition
    slidesToShow: 1,
    slidesToScroll: 1,
    arrows: true,
    autoplay: true,
    autoplaySpeed: 3000,
    pauseOnHover: true,
    centerMode: true,
    centerPadding: '50px', // Slightly less padding to allow cards to be larger
    responsive: [
      {
        breakpoint: 600,
        settings: {
          centerPadding: '20px',
        }
      }
    ]
  };

  return (
    <div style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
      <style>{`
        .slick-slide {
          display: flex !important;
          justify-content: center;
          align-items: center;
          transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
          transform: scale(0.8); /* Normal cards are smaller */
          opacity: 0.5;
        }
        .slick-center {
          transform: scale(1.2) !important; /* Active card is much larger */
          opacity: 1 !important;
          z-index: 2;
        }
        .slick-track {
          display: flex !important;
          align-items: center;
          padding: 40px 0; /* More vertical space for the zoom effect */
        }
        /* Spacing between cards */
        .slick-slide > div {
          padding: 0 60px; /* Even more horizontal spacing to prevent sticking */
        }
      `}</style>
      <Slider {...settings}>
        {schools.map(school => (
          <div key={school.id}>
            <SchoolCard school={school} />
          </div>
        ))}
      </Slider>
    </div>
  );
};

export default SchoolCarousel;