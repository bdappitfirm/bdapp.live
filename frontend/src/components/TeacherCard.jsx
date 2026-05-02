import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import { 
  Card, 
  CardContent, 
  CardActions,
  Button,
  Typography, 
  Box, 
  Avatar, 
  Stack, 
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Badge
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import SchoolIcon from '@mui/icons-material/School';
import PersonIcon from '@mui/icons-material/Person';
import PhotoUpload from './PhotoUpload';
import api from '../utils/api';
import { useToast } from './Toast';
import { getMediaUrl } from '../utils/media';
import { useAuth } from '../context/AuthContext';
import { canEdit, canDelete } from '../utils/helpers';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

/**
 * TeacherCard component
 * Displays teacher information including picture, full name, subject, and mobile number
 */
export default function TeacherCard({ 
  teacher, 
  onPhotoUploaded,
  onEdit, // New prop
  onDelete // New prop
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const { user: authUser } = useAuth(); // Access current logged in user
  
  // Extract teacher information
  const fullName = `${teacher.first_name || ''}${teacher.last_name ? ' ' + teacher.last_name : ''}`.trim() || 
                   (teacher.user ? `${teacher.user.first_name || ''}${teacher.user.last_name ? ' ' + teacher.user.last_name : ''}`.trim() : '') || 
                   teacher.username || 
                   (teacher.user ? teacher.user.username : '') || 
                   'Unknown';
  
  const handlePhotoChange = async (file) => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    if (!file) return;
    
    const formData = new FormData();
    formData.append('photo', file);
    
    try {
      const teacherId = teacher.id || teacher.user?.id;
      if (!teacherId) {
        toast.error('Teacher ID not found');
        return;
      }
      
      await api.patch(`/api/users/teachers/${teacherId}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success('Photo uploaded successfully');
      if (onPhotoUploaded) onPhotoUploaded();
    } catch (err) {
      console.error('Photo upload error:', err);
      toast.error('Failed to upload photo');
    }
  };
                   
  // Get photo URL from multiple possible sources
  const getPhotoUrl = (teacherObj) => {
    if (!teacherObj) return null;
    
    // Priority 1: Check multiple fields for photo path or URL
    const rawPhoto = teacherObj.photo_url || 
                     teacherObj.user?.photo_url || 
                     teacherObj.teacher?.photo_url || 
                     teacherObj.photo || 
                     teacherObj.user?.photo || 
                     teacherObj.teacher?.photo || 
                     teacherObj.profile_picture || 
                     teacherObj.user?.profile_picture || 
                     null;
    
    return getMediaUrl(rawPhoto);
  };
  
  const photoUrl = getPhotoUrl(teacher);
  const [imageError, setImageError] = useState(false);
  
  // Get subjects from multiple possible sources
  const getSubjects = (teacherObj) => {
    // Check assignments for subjects - this is the most accurate source for detailed mapping
    if (teacherObj.assignments && Array.isArray(teacherObj.assignments)) {
      const subjectsMap = new Map();
      teacherObj.assignments.forEach(a => {
        if (a.subject && a.subject.id) {
          subjectsMap.set(a.subject.id, a.subject);
        }
      });
      if (subjectsMap.size > 0) {
        return Array.from(subjectsMap.values());
      }
    }

    // Fallback: Check if teacher has subjects array
    if (teacherObj.subjects && Array.isArray(teacherObj.subjects) && teacherObj.subjects.length > 0) {
      return teacherObj.subjects;
    }
    
    // Check single subject
    if (teacherObj.subject) {
      return [teacherObj.subject];
    }
    
    return [];
  };
  
  const subjects = getSubjects(teacher);
  const subjectList = subjects.length > 0 ? subjects.map(s => s.name).join(', ') : 'No subjects';
  
  // Get assignments grouped by subject
  const getGroupedAssignments = (teacherObj) => {
    if (!teacherObj.assignments || !Array.isArray(teacherObj.assignments)) return [];
    
    const grouped = {};
    teacherObj.assignments.forEach(a => {
      if (!a.subject || !a.classroom) return;
      const sName = a.subject.name;
      if (!grouped[sName]) grouped[sName] = new Set();
      
      let clsName = a.classroom.name;
      if (a.section && a.section.name) {
        // Use full section name like 'মানবিক' or 'ক'
        clsName += `(${a.section.name})`;
      }
      grouped[sName].add(clsName);
    });
    
    return Object.entries(grouped).map(([subject, classes]) => ({
      subject,
      classes: Array.from(classes).sort().join(', ')
    }));
  };

  const groupedAssignments = getGroupedAssignments(teacher);
  
  // Get classes from multiple possible sources
  const getClasses = (teacherObj) => {
    // Check if teacher has classes array
    if (teacherObj.classes && Array.isArray(teacherObj.classes) && teacherObj.classes.length > 0) {
      return teacherObj.classes;
    }
    
    // Check assignments for classes
    if (teacherObj.assignments && Array.isArray(teacherObj.assignments)) {
      const classes = teacherObj.assignments
        .map(a => a.classroom)
        .filter(c => c);
      if (classes.length > 0) {
        return classes;
      }
    }
    
    return [];
  };
  
  const classes = getClasses(teacher);
  
  // Generate class range string
  const getClassRange = (classList) => {
    if (!classList || classList.length === 0) return '';
    
    // Sort classes by name
    const sortedClasses = [...classList].sort((a, b) => a.name.localeCompare(b.name));
    
    // Extract class names and create range
    const classNames = sortedClasses.map(c => c.name);
    
    if (classNames.length === 1) {
      return classNames[0];
    }
    
    if (classNames.length === 2) {
      return `${classNames[0]} - ${classNames[1]}`;
    }
    
    return `${classNames[0]} - ${classNames[classNames.length - 1]}`;
  };
  
  const classRange = getClassRange(classes);
                 
  // Get mobile number from multiple possible sources
  const mobileNumber = teacher.mobile_number || 
                      teacher.phone_number || 
                      (teacher.user ? teacher.user.phone_number || teacher.user.mobile_number : null) || 
                      'Not available';
  
  // Get email
  const email = teacher.email || 
                (teacher.user ? teacher.user.email : null) || 
                '';

  // Get educational qualification
  const qualification = teacher.educational_qualification || 
                       (teacher.user ? teacher.user.educational_qualification : null) || 
                       '';
  const designation = teacher.designation || teacher.profile?.designation || '';
  const [designationState, setDesignationState] = useState(designation || '');

  // Keep state in sync with props
  React.useEffect(() => {
    if (designation) {
      setDesignationState(designation);
    }
  }, [designation]);

  // Fallback fetch if designation is missing
  React.useEffect(() => {
    if (designationState) return; // Already have a designation

    const uid = teacher?.id || teacher?.user?.id;
    if (!uid) return;

    const schoolId =
      teacher?.assignments?.[0]?.classroom?.school?.id ||
      teacher?.classes?.[0]?.school?.id ||
      null;

    const url = schoolId ? `/api/users/teachers/?user=${uid}&school=${schoolId}` : `/api/users/teachers/?user=${uid}`;
    
    api.get(url)
      .then(res => {
        const arr = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        const p = Array.isArray(arr) ? arr[0] : null;
        if (p?.designation) {
          setDesignationState(p.designation);
        }
      })
      .catch(() => {});
  }, [teacher?.id, teacher?.user?.id, designationState]);

  // Debug: Log teacher data
  console.log('Teacher:', fullName);
  console.log('Teacher object:', teacher);
  console.log('Photo URL:', photoUrl);
  console.log('Educational Qualification:', qualification);

  return (
    <Card 
      sx={{ 
        borderRadius: 4, 
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        '&:hover': { 
          transform: 'translateY(-8px) scale(1.02)', 
          boxShadow: '0 16px 48px rgba(102, 126, 234, 0.4)'
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '140px',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
          zIndex: 0
        }
      }}
    >
      <CardContent sx={{ position: 'relative', zIndex: 1, p: 3 }}>
        <Stack spacing={2.5} alignItems="center">
          {/* Teacher Photo with Badge and Upload */}
          <Box sx={{ position: 'relative' }}>
            {/* Photo Upload Component */}
            <PhotoUpload 
              currentPhoto={photoUrl} 
              onPhotoChange={handlePhotoChange} 
              userName={fullName}
            />
            
            {/* Badge */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 36,
                height: 36,
                borderRadius: '50%',
                bgcolor: 'success.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '3px solid white',
                boxShadow: 2,
                zIndex: 2
              }}
            >
              <SchoolIcon sx={{ fontSize: 20, color: 'white' }} />
            </Box>
          </Box>
          
          {/* Teacher Name, Qualification and Subject */}
          <Box sx={{ textAlign: 'center', width: '100%' }}>
            <Typography 
              variant="h5" 
              sx={{ 
                fontWeight: 'bold',
                color: 'white',
                textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                mb: 0.5
              }}
            >
              {fullName}
            </Typography>
            <Typography 
              variant="body2"
              sx={{
                color: 'rgba(255,255,255,0.9)',
                mb: 1,
                textShadow: '0 1px 2px rgba(0,0,0,0.2)'
              }}
            >
              ({teacher?.username || teacher?.user?.username || 'unknown'})
            </Typography>
            {(designationState || designation) && (
              <Typography 
                variant="subtitle1"
                sx={{
                  color: 'white',
                  fontWeight: 700,
                  mb: 0.5,
                  textShadow: '0 1px 2px rgba(0,0,0,0.25)'
                }}
              >
                {designationState || designation}
              </Typography>
            )}
            {qualification && (
              <Typography 
                variant="body2" 
                sx={{ 
                  color: 'rgba(255,255,255,0.9)',
                  fontStyle: 'italic',
                  mb: 1,
                  textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                }}
              >
                {qualification}
              </Typography>
            )}
            
            {/* Subjects and Classes */}
            {groupedAssignments.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, mb: 1, width: '100%' }}>
                {groupedAssignments.map((ga, idx) => (
                  <Box key={idx} sx={{ textAlign: 'center', width: '100%' }}>
                    <Chip 
                      icon={<SchoolIcon sx={{ color: 'white !important' }} />}
                      label={ga.subject} 
                      size="small"
                      sx={{ 
                        bgcolor: 'rgba(255,255,255,0.25)',
                        color: 'white',
                        fontWeight: 'bold',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.3)',
                        mb: 0.5,
                        maxWidth: '90%',
                        '& .MuiChip-icon': { color: 'white' }
                      }}
                    />
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: 'rgba(255,255,255,0.95)',
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                      }}
                    >
                      • {ga.classes}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <>
                <Chip 
                  icon={<SchoolIcon sx={{ color: 'white !important' }} />}
                  label={subjectList} 
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.25)',
                    color: 'white',
                    fontWeight: 'bold',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    mb: 1,
                    '& .MuiChip-icon': {
                      color: 'white'
                    }
                  }}
                />
                
                {/* Class Range */}
                {classRange && (
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: 'rgba(255,255,255,0.8)',
                      fontWeight: '500',
                      textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                      fontSize: '0.9rem',
                      mb: 1
                    }}
                  >
                    {classRange}
                  </Typography>
                )}
              </>
            )}

            {/* Class Teacher Info */}
            {(teacher?.class_teacher_classroom || teacher?.profile?.class_teacher_classroom) && (
              <Chip
                label={`শ্রেণি শিক্ষক: ${
                  teacher?.class_teacher_classroom?.name || 
                  teacher?.profile?.class_teacher_classroom?.name || 
                  'শ্রেণি'
                }${
                  (teacher?.class_teacher_section?.name || teacher?.profile?.class_teacher_section?.name) 
                  ? ` (${teacher?.class_teacher_section?.name || teacher?.profile?.class_teacher_section?.name})` 
                  : ''
                }`}
                size="small"
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.95)',
                  color: 'primary.main',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  mt: 1
                }}
              />
            )}
          </Box>
          
          {/* Contact Information Card */}
          <Box 
            sx={{ 
              width: '100%',
              bgcolor: 'white',
              borderRadius: 3,
              p: 2.5,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            <Typography 
              variant="subtitle2" 
              sx={{ 
                mb: 2, 
                fontWeight: 'bold',
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <PersonIcon fontSize="small" />
              Contact Information
            </Typography>
            
            <Stack spacing={1.5}>
              {/* Phone */}
              <Stack 
                direction="row" 
                spacing={1.5} 
                alignItems="center"
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'grey.50',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: 'primary.50',
                    transform: 'translateX(4px)'
                  }
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <PhoneIcon sx={{ fontSize: 18, color: 'white' }} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                    Mobile
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontWeight: 'bold',
                      color: 'text.primary',
                      wordBreak: 'break-all'
                    }}
                  >
                    {mobileNumber}
                  </Typography>
                </Box>
              </Stack>

              {/* Email */}
              {email && (
                <Stack 
                  direction="row" 
                  spacing={1.5} 
                  alignItems="center"
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'grey.50',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: 'secondary.50',
                      transform: 'translateX(4px)'
                    }
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      bgcolor: 'secondary.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <EmailIcon sx={{ fontSize: 18, color: 'white' }} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                      Email
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 'bold',
                        color: 'text.primary',
                        wordBreak: 'break-all',
                        fontSize: '0.85rem'
                      }}
                    >
                      {email}
                    </Typography>
                  </Box>
                </Stack>
              )}
            </Stack>
          </Box>
        </Stack>
      </CardContent>
      {(canEdit(authUser) || canDelete(authUser)) && (onEdit || onDelete) && (
        <CardActions sx={{ 
          bgcolor: 'rgba(255,255,255,0.1)', 
          justifyContent: 'center', 
          p: 1.5,
          gap: 1
        }}>
          {canEdit(authUser) && onEdit && (
            <Button 
              size="small" 
              variant="contained" 
              startIcon={<EditIcon />}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(teacher);
              }}
              sx={{ 
                bgcolor: 'white', 
                color: 'primary.main',
                fontWeight: 'bold',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' }
              }}
            >
              Edit
            </Button>
          )}
          {canDelete(authUser) && onDelete && (
            <Button 
              size="small" 
              variant="contained" 
              color="error"
              startIcon={<DeleteIcon />}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(teacher);
              }}
              sx={{ 
                fontWeight: 'bold'
              }}
            >
              Delete
            </Button>
          )}
        </CardActions>
      )}
    </Card>
  );
}
