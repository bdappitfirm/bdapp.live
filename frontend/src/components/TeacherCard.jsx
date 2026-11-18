import React, { useCallback, useMemo, useState } from 'react';
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
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Grid,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import SchoolIcon from '@mui/icons-material/School';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import BadgeIcon from '@mui/icons-material/Badge';
import WorkIcon from '@mui/icons-material/Work';

import PhotoUpload from './PhotoUpload';
import api from '../utils/api';
import { useToast } from './Toast';
import { getMediaUrl } from '../utils/media';
import { useAuth } from '../context/AuthContext';
import { canEdit, canDelete } from '../utils/helpers';

const getPhotoUrlHelper = (teacherObj) => {
  if (!teacherObj) return null;
  const rawPhoto = teacherObj.photo_url || teacherObj.user?.photo_url || teacherObj.teacher?.photo_url || teacherObj.photo || teacherObj.user?.photo || teacherObj.teacher?.photo || teacherObj.profile_picture || teacherObj.user?.profile_picture || teacherObj.profile?.photo_url || teacherObj.profile?.photo || null;
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

export default function TeacherCard({ teacher, onPhotoUploaded, onEdit, onDelete, onViewProfile }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

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

  const designationState = teacher?.designation || teacher?.profile?.designation || teacher?.user?.profile?.designation || designation || '';
  const indexNumber = teacher?.index_number || teacher?.profile?.index_number || 'N/A';
  const joiningDate = teacher?.joining_date || teacher?.profile?.joining_date || 'N/A';
  const bloodGroup = teacher?.blood_group || teacher?.profile?.blood_group || teacher?.user?.blood_group || 'N/A';
  const gender = teacher?.gender || teacher?.profile?.gender || teacher?.user?.gender || '';

  const handleOpenProfile = () => {
    if (onViewProfile) {
      onViewProfile(teacher);
    } else {
      setProfileDialogOpen(true);
    }
  };

  return (
    <>
      <Card sx={{ borderRadius: 4, overflow: 'hidden', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)', transition: 'all 0.4s', '&:hover': { transform: 'translateY(-8px)', boxShadow: '0 16px 48px rgba(102, 126, 234, 0.4)' } }}>
        <CardContent sx={{ p: 3, cursor: 'pointer' }} onClick={handleOpenProfile}>
          <Stack spacing={2} alignItems="center">
            <Box sx={{ position: 'relative' }}>
              <PhotoUpload currentPhoto={photoUrl} onPhotoChange={handlePhotoChange} userName={fullName} />
              <Box sx={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: '50%', bgcolor: 'success.main', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}><SchoolIcon sx={{ fontSize: 18, color: 'white' }} /></Box>
            </Box>
            <Box sx={{ textAlign: 'center', width: '100%', color: 'white' }}>
              <Typography variant="h5" fontWeight="bold">{fullName}</Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                ({teacher?.username || teacher?.user?.username || 'unknown'})
                {gender === 'male' ? ' • পুরুষ' : gender === 'female' ? ' • নারী' : ''}
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
        <CardActions sx={{ bgcolor: 'rgba(255,255,255,0.1)', justifyContent: 'center', p: 1, gap: 1 }}>
          <Button size="small" variant="contained" startIcon={<VisibilityIcon />} onClick={handleOpenProfile} sx={{ bgcolor: 'rgba(255,255,255,0.9)', color: 'primary.main', '&:hover': { bgcolor: 'white' } }}>
            প্রোফাইল
          </Button>
          {canEdit(authUser) && onEdit && (
            <Button size="small" variant="contained" startIcon={<EditIcon />} onClick={() => onEdit(teacher)} sx={{ bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: '#eee' } }}>
              সম্পাদনা
            </Button>
          )}
          {canDelete(authUser) && onDelete && (
            <Button size="small" variant="contained" color="error" startIcon={<DeleteIcon />} onClick={() => onDelete(teacher)}>
              মুছুন
            </Button>
          )}
        </CardActions>
      </Card>

      {/* Teacher Profile View Dialog */}
      <Dialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, bgcolor: 'primary.main', color: 'white' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <SchoolIcon />
            <Typography variant="h6" fontWeight="bold">শিক্ষক প্রফাইল விவரণ</Typography>
          </Stack>
          <IconButton onClick={() => setProfileDialogOpen(false)} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 3 }}>
          <Grid container spacing={3}>
            {/* Header / Avatar */}
            <Grid item xs={12} md={4} sx={{ textAlign: 'center' }}>
              <Paper elevation={2} sx={{ p: 3, borderRadius: 3, background: 'linear-gradient(180deg, #f8fafc 0%, #edf2f7 100%)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  <PhotoUpload currentPhoto={photoUrl} onPhotoChange={handlePhotoChange} userName={fullName} />
                </Box>
                <Typography variant="h6" fontWeight="bold" color="primary.main">{fullName}</Typography>
                <Typography variant="body2" color="text.secondary">@{teacher?.username || teacher?.user?.username || 'user'}</Typography>

                {designationState && (
                  <Chip
                    label={designationState}
                    color="primary"
                    size="small"
                    sx={{ mt: 1.5, fontWeight: 'bold' }}
                  />
                )}

                {classTeacherInfo && (
                  <Typography variant="body2" sx={{ bgcolor: 'secondary.light', color: 'secondary.contrastText', px: 1.5, py: 0.5, borderRadius: 2, mt: 1, fontWeight: 'bold' }}>
                    {classTeacherInfo}
                  </Typography>
                )}
              </Paper>
            </Grid>

            {/* Profile Details Grid */}
            <Grid item xs={12} md={8}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
                <BadgeIcon fontSize="small" /> ব্যক্তিগত ও চাকরি সংক্রান্ত তথ্য
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block">ইনডেক্স / এনআইডি নম্বর</Typography>
                    <Typography variant="body1" fontWeight="600">{indexNumber}</Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block">যোগদানের তারিখ</Typography>
                    <Typography variant="body1" fontWeight="600">{joiningDate}</Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block">মোবাইল নম্বর</Typography>
                    <Typography variant="body1" fontWeight="600">{mobileNumber}</Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block">ইমেইল</Typography>
                    <Typography variant="body1" fontWeight="600">{email || 'N/A'}</Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block">রক্তের গ্রুপ</Typography>
                    <Typography variant="body1" fontWeight="600">{bloodGroup}</Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block">লিঙ্গ</Typography>
                    <Typography variant="body1" fontWeight="600">
                      {gender === 'male' ? 'পুরুষ (Male)' : gender === 'female' ? 'নারী (Female)' : gender || 'N/A'}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block">শিক্ষাগত যোগ্যতা</Typography>
                    <Typography variant="body1" fontWeight="600">{qualification || 'N/A'}</Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Subject & Classroom Assignments */}
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 3, mb: 1, display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
                <WorkIcon fontSize="small" /> বিষয় ও ক্লাস সমূহের বিস্তারিত তালিকা
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {groupedAssignments.length > 0 ? (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>বিষয়</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>ক্লাস ও সেকশন</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {groupedAssignments.map((ga, idx) => (
                        <TableRow key={idx}>
                          <TableCell><Chip label={ga.subject} size="small" color="primary" variant="outlined" /></TableCell>
                          <TableCell>{ga.classes}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary" fontStyle="italic">
                  কোন বিষয় বা ক্লাস অ্যাসাইনমেন্ট পাওয়া যায়নি।
                </Typography>
              )}
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          {canEdit(authUser) && onEdit && (
            <Button variant="outlined" startIcon={<EditIcon />} onClick={() => { setProfileDialogOpen(false); onEdit(teacher); }}>
              সম্পাদনা করুন
            </Button>
          )}
          <Button variant="contained" onClick={() => setProfileDialogOpen(false)}>
            বন্ধ করুন
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

