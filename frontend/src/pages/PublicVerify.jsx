import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Paper, CircularProgress, Avatar, Container } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import api from '../utils/api';

export default function PublicVerify() {
  const { studentId } = useParams();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/academics/students/${studentId}/`)
      .then(res => setStudent(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;
  if (!student) return <Typography align="center" sx={{ mt: 10 }}>Student not found</Typography>;

  const user = student.user || {};
  const photoUrl = user.photo_url || user.photo;
  const name = `${user.first_name_en || user.first_name || ''} ${user.last_name_en || user.last_name || ''}`.trim();

  return (
    <Container maxWidth="sm" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={6} sx={{ p: 4, textAlign: 'center', borderRadius: 4, border: '2px solid #D4AF37', background: 'linear-gradient(to bottom, #ffffff, #fffdf5)' }}>
        <CheckCircleIcon sx={{ fontSize: 60, color: '#2e7d32', mb: 2 }} />
        <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#8b4513', mb: 3, fontFamily: "'Libre Baskerville', serif" }}>
          It is a S.S.C. Certificate of
        </Typography>

        {photoUrl && (
          <Avatar src={photoUrl} sx={{ width: 150, height: 180, mx: 'auto', mb: 3, borderRadius: 2, border: '3px solid #8b4513', boxShadow: 3 }} variant="square" />
        )}

        <Typography variant="h3" sx={{ fontWeight: '900', color: '#1a237e', mb: 1, fontFamily: "'Playfair Display', serif" }}>
          {name.toUpperCase()}
        </Typography>

        <Box sx={{ mt: 4, textAlign: 'left', px: { xs: 0, sm: 4 } }}>
          {[
            { label: "Father's Name", value: student.father_name_en || student.father_name },
            { label: "Mother's Name", value: student.mother_name_en || student.mother_name },
            { label: "Date of Birth", value: student.birth_date },
            { label: "Session", value: student.ssc_session },
            { label: "GPA", value: student.ssc_gpa, color: '#2e7d32' }
          ].map((item, i) => (
            <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5, borderBottom: '1px dashed #ddd', pb: 0.5 }}>
              <Typography sx={{ fontWeight: 'bold', color: '#5d4037' }}>{item.label}:</Typography>
              <Typography sx={{ fontWeight: 'bold', color: item.color || '#000' }}>{item.value || 'N/A'}</Typography>
            </Box>
          ))}
        </Box>

        <Typography sx={{ mt: 5, fontSize: '0.8rem', color: '#999', fontStyle: 'italic' }}>
          This is an electronically generated verification result.
        </Typography>
      </Paper>
    </Container>
  );
}
