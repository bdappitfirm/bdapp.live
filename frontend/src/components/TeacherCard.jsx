import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import { 
  Card, 
  CardContent, 
  CardActions,
  Button,
  Typography, 
  Box, 
  Stack,
  Chip
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import SchoolIcon from '@mui/icons-material/School';
import PhotoUpload from './PhotoUpload';
import api from '../utils/api';
import { useToast } from './Toast';
import { getMediaUrl } from '../utils/media';
import { useAuth } from '../context/AuthContext';
import { canEdit, canDelete } from '../utils/helpers';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

const getPhotoUrlHelper = (teacherObj) => {
  if (!teacherObj) return null;
  const rawPhoto = teacherObj.photo_url || teacherObj.user?.photo_url || teacherObj.teacher?.photo_url || teacherObj.photo || teacherObj.user?.photo || teacherObj.teacher?.photo || teacherObj.profile_picture || teacherObj.user?.profile_picture || null;
  return getMediaUrl(rawPhoto);
};

const getSubjectsHelper = (teacherObj) => {
  if (teacherObj.assignments && Array.isArray(teacherObj.assignments)) {
    const subjectsMap = new Map();
    teacherObj.assignments.forEach(a => { if (a.subject && a.subject.id) subjectsMap.set(a.subject.id, a.subject); });
    if (subjectsMap.size > 0) return Array.from(subjectsMap.values());
  }
  if (teacherObj.subjects && Array.isArray(teacherObj.subjects)) return teacherObj.subjects;

  // Check profile-level assigned subject
  const profileSub = teacherObj.profile?.assigned_subject_name ||
                     teacherObj.profile?.assigned_subject?.name ||
                     teacherObj.assigned_subject_name;
  if (profileSub) return [{ name: profileSub }];

  if (teacherObj.subject) return [teacherObj.subject];
  return [];
};

const getGroupedAssignmentsHelper = (teacherObj) => {
  if (!teacherObj.assignments || !Array.isArray(teacherObj.assignments)) return [];
  const grouped = {};
  teacherObj.assignments.forEach(a => {
    if (!a.subject || !a.classroom) return;
    const sName = a.subject.name;
    if (!grouped[sName]) grouped[sName] = new Set();
    let clsName = a.classroom.name;
    if (a.section && a.section.name) clsName += `(${a.section.name})`;
    grouped[sName].add(clsName);
  });
  return Object.entries(grouped).map(([subject, classes]) => ({ subject, classes: Array.from(classes).sort().join(', ') }));
};

export default function TeacherCard({ teacher, onPhotoUploaded, onEdit, onDelete }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  
  const fullName = useMemo(() => `${teacher.first_name || ''}${teacher.last_name ? ' ' + teacher.last_name : ''}`.trim() || (teacher.user ? `${teacher.user.first_name || ''}${teacher.user.last_name ? ' ' + teacher.user.last_name : ''}`.trim() : '') || teacher.username || (teacher.user ? teacher.user.username : '') || 'Unknown', [teacher]);
  
  const handlePhotoChange = useCallback(async (file) => {
    if (!isAuthenticated()) { navigate('/login'); return; }
    if (!file) return;
    const formData = new FormData();
    formData.append('photo', file);
    try {
      const teacherId = teacher.id || teacher.user?.id;
      if (!teacherId) { toast.error('Teacher ID not found'); return; }
      await api.patch(`/api/users/teachers/${teacherId}/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Photo uploaded successfully');
      if (onPhotoUploaded) onPhotoUploaded();
    } catch (err) { toast.error('Failed to upload photo'); }
  }, [teacher, onPhotoUploaded, navigate, toast]);

  const photoUrl = useMemo(() => getPhotoUrlHelper(teacher), [teacher]);
  const subjects = useMemo(() => getSubjectsHelper(teacher), [teacher]);
  const subjectList = useMemo(() => subjects.length > 0 ? subjects.map(s => s.name).join(', ') : 'No subjects', [subjects]);
  const groupedAssignments = useMemo(() => getGroupedAssignmentsHelper(teacher), [teacher]);
  const mobileNumber = teacher.mobile_number || teacher.phone_number || (teacher.user ? teacher.user.phone_number || teacher.user.mobile_number : null) || 'Not available';
  const email = teacher.email || (teacher.user ? teacher.user.email : null) || '';
  const qualification = teacher.educational_qualification || (teacher.user ? teacher.user.educational_qualification : null) || '';
  const designation = teacher.designation || teacher.profile?.designation || '';

  const classTeacherInfo = useMemo(() => {
    const profile = teacher.profile || teacher;
    const classroomName = profile.class_teacher_classroom_name ||
                        (profile.class_teacher_classroom?.name) ||
                        (profile.class_teacher_classroom ? `Class ${profile.class_teacher_classroom}` : null);
    const sectionName = profile.class_teacher_section_name ||
                      (profile.class_teacher_section?.name) ||
                      (profile.class_teacher_section ? `Section ${profile.class_teacher_section}` : null);

    if (!classroomName) return null;
    return `Class Teacher: ${classroomName}${sectionName ? ` (${sectionName})` : ''}`;
  }, [teacher]);

  const [designationState, setDesignationState] = useState(designation || '');

  useEffect(() => { if (designation) setDesignationState(designation); }, [designation]);

  useEffect(() => {
    if (designationState) return;
    const uid = teacher?.id || teacher?.user?.id;
    if (!uid) return;
    const schoolId = teacher?.assignments?.[0]?.classroom?.school?.id || teacher?.classes?.[0]?.school?.id || null;
    const url = schoolId ? `/api/users/teachers/?user=${uid}&school=${schoolId}` : `/api/users/teachers/?user=${uid}`;
    api.get(url).then(res => {
      const arr = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      if (arr[0]?.designation) setDesignationState(arr[0].designation);
    }).catch(() => {});
  }, [teacher, designationState]);

  return (
    <Card sx={{ borderRadius: 4, overflow: 'hidden', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)', transition: 'all 0.4s', '&:hover': { transform: 'translateY(-8px)', boxShadow: '0 16px 48px rgba(102, 126, 234, 0.4)' } }}>
      <CardContent sx={{ p: 3 }}>
        <Stack spacing={2} alignItems="center">
          <Box sx={{ position: 'relative' }}>
            <PhotoUpload currentPhoto={photoUrl} onPhotoChange={handlePhotoChange} userName={fullName} />
            <Box sx={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: '50%', bgcolor: 'success.main', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}><SchoolIcon sx={{ fontSize: 18, color: 'white' }} /></Box>
          </Box>
          <Box sx={{ textAlign: 'center', width: '100%', color: 'white' }}>
            <Typography variant="h5" fontWeight="bold">{fullName}</Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              ({teacher?.username || teacher?.user?.username || 'unknown'})
              {teacher?.gender === 'male' ? ' • পুরুষ' : teacher?.gender === 'female' ? ' • নারী' : ''}
            </Typography>
            {designationState && <Typography variant="subtitle1" fontWeight="700">{designationState}</Typography>}
            {classTeacherInfo && (
              <Typography variant="body2" sx={{ bgcolor: 'rgba(255,255,255,0.15)', display: 'inline-block', px: 1.5, py: 0.5, borderRadius: 1, my: 0.5 }}>
                {classTeacherInfo}
              </Typography>
            )}
            {qualification && <Typography variant="body2" fontStyle="italic">{qualification}</Typography>}
            <Stack spacing={0.5} mt={1}>
              {groupedAssignments.map((ga, i) => (
                <Box key={i}><Chip label={ga.subject} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 'bold' }} /><Typography variant="caption" display="block">• {ga.classes}</Typography></Box>
              ))}
              {groupedAssignments.length === 0 && <Chip label={subjectList} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />}
            </Stack>
          </Box>
          <Box sx={{ width: '100%', bgcolor: 'white', borderRadius: 2, p: 2 }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center"><PhoneIcon fontSize="small" color="primary" /><Typography variant="body2" fontWeight="bold">{mobileNumber}</Typography></Stack>
              {email && <Stack direction="row" spacing={1} alignItems="center"><EmailIcon fontSize="small" color="secondary" /><Typography variant="body2" sx={{ wordBreak: 'break-all' }}>{email}</Typography></Stack>}
            </Stack>
          </Box>
        </Stack>
      </CardContent>
      {(canEdit(authUser) || canDelete(authUser)) && (
        <CardActions sx={{ bgcolor: 'rgba(255,255,255,0.1)', justifyContent: 'center', p: 1 }}>
          {canEdit(authUser) && onEdit && <Button size="small" variant="contained" startIcon={<EditIcon />} onClick={() => onEdit(teacher)} sx={{ bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: '#eee' } }}>Edit</Button>}
          {canDelete(authUser) && onDelete && <Button size="small" variant="contained" color="error" startIcon={<DeleteIcon />} onClick={() => onDelete(teacher)}>Delete</Button>}
        </CardActions>
      )}
    </Card>
  );
}
