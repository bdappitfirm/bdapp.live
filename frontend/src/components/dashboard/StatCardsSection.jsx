import React from 'react';
import { Grid } from '@mui/material';
import PersonIcon from "@mui/icons-material/Person";
import SchoolIcon from "@mui/icons-material/School";
import PeopleIcon from "@mui/icons-material/People";
import ClassIcon from "@mui/icons-material/Class";
import BookIcon from "@mui/icons-material/Book";
import EventSeatIcon from "@mui/icons-material/EventSeat";
import StatCard from './StatCard';
import { useNavigate, useParams } from 'react-router-dom';

const StatCardsSection = ({ stats, isTeacher, isSuperUser, role }) => {
  const navigate = useNavigate();
  const { id } = useParams();

  const cards = [
    { title: "ছাত্র-ছাত্রী", value: stats?.students_count || 0, icon: <PersonIcon fontSize="large" />, color: "#9c27b0", path: "student" },
    { title: "শিক্ষক", value: stats?.teachers_count || 0, icon: <SchoolIcon fontSize="large" />, color: "#2e7d32", path: "teacher" },
    { title: "অভিভাবক", value: stats?.parents_count || 0, icon: <PeopleIcon fontSize="large" />, color: "#6a1b9a", path: "parent" },
    { title: "শ্রেণি", value: stats?.classes_count || 0, icon: <ClassIcon fontSize="large" />, color: "#ed6c02", path: "classes" },
    { title: "বিষয়/সাবজেক্ট", value: stats?.subjects_count || 0, icon: <BookIcon fontSize="large" />, color: "#0288d1", path: "subjects" },
  ];

  if (isTeacher || isSuperUser || role?.includes('admin')) {
    cards.push({ title: "সিট বন্টন", value: "Exam", icon: <EventSeatIcon fontSize="large" />, color: "#607d8b", path: "seat-allocation" });
  }

  return (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      {cards.map((card, idx) => (
        <Grid size={{ xs: 12, sm: 6, md: card.title === "সিট বন্টন" ? 3 : 2.4 }} key={idx}>
          <StatCard
            title={card.title}
            value={card.value}
            icon={card.icon}
            color={card.color}
            onClick={() => navigate(`/school/${id}/${card.path}`)}
            sx={{ height: 110 }}
          />
        </Grid>
      ))}
    </Grid>
  );
};

export default StatCardsSection;
