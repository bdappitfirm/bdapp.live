import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, Typography, Box, Avatar, Stack, CardActions } from '@mui/material';
import ProtectedButton from './ProtectedButton';
import { isAuthenticated } from '../utils/auth';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../utils/api';
import { useToast } from './Toast';
import PhotoUpload from './PhotoUpload';
import { useAuth } from '../context/AuthContext';
import { canEdit, canDelete, getCleanDisplayName } from '../utils/helpers';
import { getMediaUrl } from '../utils/media';

export default function StudentCard({ student, onUploaded, onEdit, onDelete, onClick }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [photoVersion, setPhotoVersion] = useState(0);

  // Display name logic using global helper
  const displayName = student.displayName || getCleanDisplayName(
    student.user?.first_name,
    student.user?.last_name,
    student.user?.username || student.username || 'unknown'
  );

  const className = student.classroom?.name || '';
  const sectionName = student.section?.name || '';
  const guardianName = useMemo(() => {
    // 1. Primary: Use explicit guardian_name field (string) saved in the profile
    // This ensures we show exactly what was typed during edit
    if (student.guardian_name) return student.guardian_name;

    // 2. Fallback: Try linked guardian object from student profile
    const g = student.guardian;
    if (g) {
      const fn = g.first_name || g.user?.first_name || '';
      const ln = g.last_name || g.user?.last_name || '';
      const fullName = `${fn} ${ln}`.trim();
      if (fullName) return fullName;
      const un = g.username || g.user?.username || '';
      if (un) return un;
    }

    // 3. Additional fallbacks for other possible field names
    return student.parent_name || student.father_name || student.mother_name || '';
  }, [student]);

  const rawPhoto = student.user?.thumbnail_url || student.user?.photo_url || student.user?.photo || student.user?.profile_picture || student.photo_url || student.photo || null;
  const photoUrl = getMediaUrl(rawPhoto);
  const cacheBustedPhoto = useMemo(() => {
    if (!photoUrl) return null;
    const sep = photoUrl.includes('?') ? '&' : '?';
    return `${photoUrl}${sep}v=${photoVersion}`;
  }, [photoUrl, photoVersion]);

  const handlePhotoChange = async (file) => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!file) return; // removal not supported via endpoint
    const formData = new FormData();
    formData.append('photo', file);
    try {
      await api.post(`/api/academics/students/${student.id}/upload_photo/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Photo uploaded');
      // bump version to bust browser cache immediately
      setPhotoVersion((v) => v + 1);
      onUploaded && onUploaded();
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload photo');
    }
  };

  return (
    <Card 
      sx={{ 
        borderRadius: 2,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': onClick ? {
          transform: 'translateY(-4px)',
          boxShadow: 4
        } : {}
      }}
      onClick={() => onClick && onClick(student)}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Editable photo with camera + device options */}
            <PhotoUpload currentPhoto={cacheBustedPhoto} onPhotoChange={handlePhotoChange} userName={displayName || 'User'} />
            {/* Always-visible small avatar next to name */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Avatar
                  sx={{ width: 36, height: 36 }}
                  src={cacheBustedPhoto || undefined}
                  imgProps={{ loading: "lazy" }}
                >
                  {!cacheBustedPhoto ? '🧑' : null}
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ lineHeight: 1.2 }}>{displayName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    ({student.user?.username || student.username || 'unknown'})
                  </Typography>
                </Box>
              </Stack>
              <Typography variant="body2">রোল: {student.roll_number || 'N/A'}</Typography>
              {className && <Typography variant="body2">শ্রেণি: {className}</Typography>}
              {sectionName && <Typography variant="body2">সেকশন: {sectionName}</Typography>}
              {student.group && <Typography variant="body2">গ্রুপ: {student.group === 'science' ? 'বিজ্ঞান' : student.group === 'arts' ? 'মানবিক' : 'ব্যবসায়'}</Typography>}
              {student.gender && <Typography variant="body2">Gender: {student.gender}</Typography>}
              <Typography variant="body2">রক্তের গ্রুপ: {student.blood_group || 'N/A'}</Typography>
              {student.father_name && <Typography variant="body2">পিতার নাম: {student.father_name}</Typography>}
              {student.mother_name && <Typography variant="body2">মাতার নাম: {student.mother_name}</Typography>}
              <Typography variant="body2">ফোন: {student.user?.phone_number || student.phone_number || 'N/A'}</Typography>
            </Box>
          </Box>
        </Box>
      </CardContent>
      <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
        {canEdit(user, student.user?.id, 'student') && (
          <ProtectedButton 
            size="small" 
            color="primary" 
            onClick={(e) => {
              e.stopPropagation();
              onEdit && onEdit(student);
            }}
          >
            <EditIcon fontSize="small" />
          </ProtectedButton>
        )}
        {canDelete(user, student.user?.id, 'student') && (
          <ProtectedButton 
            size="small" 
            color="error" 
            onClick={(e) => {
              e.stopPropagation();
              onDelete && onDelete(student);
            }}
          >
            <DeleteIcon fontSize="small" />
          </ProtectedButton>
        )}
      </CardActions>
    </Card>
  );
}
