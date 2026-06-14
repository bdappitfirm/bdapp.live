import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Avatar,
  Button,
  Stack,
  TextField,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  IconButton,
  Chip,
  Paper,
  Alert,
  CardActions,
  useMediaQuery,
  Autocomplete,
  Divider
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ProtectedButton from '../components/ProtectedButton';
import TeacherCard from '../components/TeacherCard';
import PersonIcon from '@mui/icons-material/Person';
import SchoolIcon from '@mui/icons-material/School';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import EmptyState from '../components/EmptyState';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../components/Toast';
import PhotoUpload from '../components/PhotoUpload';
import { useAuth } from '../context/AuthContext';
import { canEdit, canDelete } from '../utils/helpers';
import { getMediaUrl } from '../utils/media';

export default function TeachersPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const [assignments, setAssignments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const toast = useToast();
  const { user } = useAuth();
  
  // Add Teacher Dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [sections, setSections] = useState([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedTeacherProfile, setSelectedTeacherProfile] = useState(null);
  const [selectedTeacherAssignments, setSelectedTeacherAssignments] = useState([]);
  const [selectedTeacherSubjects, setSelectedTeacherSubjects] = useState([]);
  const [selectedTeacherClasses, setSelectedTeacherClasses] = useState([]);
  const [editSelectedSubjectIds, setEditSelectedSubjectIds] = useState([]);
  const [editSelectedClassroomIds, setEditSelectedClassroomIds] = useState([]);
  const [editSelectedSectionId, setEditSelectedSectionId] = useState('');
  const [editSections, setEditSections] = useState([]);
  const [editFormData, setEditFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    password: '', // Password field for editing
    phone_number: '',
    educational_qualification: '',
    designation: '',
    blood_group: '',
    index_number: '',
    joining_date: '',
    assigned_subject: '',
    class_teacher_classroom: '',
    class_teacher_section: '',
    _photoFile: null,
    assignments: [] // New structured assignments array
  });

  // Helper functions for dynamic assignments
  const addEditAssignmentRow = () => {
    setEditFormData(prev => ({
      ...prev,
      assignments: [...prev.assignments, { subjectId: '', classAssignments: [{ classroomId: '', sectionId: '' }] }]
    }));
  };

  const removeEditAssignmentRow = (index) => {
    setEditFormData(prev => ({
      ...prev,
      assignments: prev.assignments.filter((_, i) => i !== index)
    }));
  };

  const addClassToEditAssignment = (assignIndex) => {
    const newAssignments = [...editFormData.assignments];
    newAssignments[assignIndex].classAssignments.push({ classroomId: '', sectionId: '' });
    setEditFormData({ ...editFormData, assignments: newAssignments });
  };

  const removeClassFromEditAssignment = (assignIndex, classIndex) => {
    const newAssignments = [...editFormData.assignments];
    newAssignments[assignIndex].classAssignments = newAssignments[assignIndex].classAssignments.filter((_, i) => i !== classIndex);
    setEditFormData({ ...editFormData, assignments: newAssignments });
  };

  const updateEditAssignment = (assignIndex, field, value) => {
    const newAssignments = [...editFormData.assignments];
    newAssignments[assignIndex][field] = value;
    setEditFormData({ ...editFormData, assignments: newAssignments });
  };

  const updateEditClassAssignment = (assignIndex, classIndex, field, value) => {
    const newAssignments = [...editFormData.assignments];
    newAssignments[assignIndex].classAssignments[classIndex][field] = value;
    setEditFormData({ ...editFormData, assignments: newAssignments });
  };

  const handleEdit = (e, teacher) => {
    if (e) e.stopPropagation();
    setSelectedTeacher(teacher);
    const profile = teacher.profile || null;
    setSelectedTeacherProfile(profile);
    
    // Populate editFormData
    const assignmentsBySubject = {};
    (teacher.assignments || []).forEach(a => {
      const sid = a.subject?.id || a.subject;
      if (!sid) return;
      if (!assignmentsBySubject[sid]) {
        assignmentsBySubject[sid] = { subjectId: sid, classAssignments: [] };
      }
      assignmentsBySubject[sid].classAssignments.push({
        classroomId: a.classroom?.id || a.classroom,
        sectionId: a.section?.id || a.section || ''
      });
    });

    setEditFormData({
      first_name: teacher.first_name || '',
      last_name: teacher.last_name || '',
      email: teacher.email || '',
      username: teacher.username || '',
      password: '',
      phone_number: teacher.phone_number || '',
      educational_qualification: teacher.educational_qualification || '',
      designation: profile?.designation || '',
      blood_group: profile?.blood_group || '',
      index_number: profile?.index_number || '',
      joining_date: profile?.joining_date || '',
      assigned_subject: profile?.assigned_subject?.id || profile?.assigned_subject || '',
      class_teacher_classroom: profile?.class_teacher_classroom || '',
      class_teacher_section: profile?.class_teacher_section || '',
      _photoFile: null,
      assignments: Object.values(assignmentsBySubject).length > 0 
        ? Object.values(assignmentsBySubject) 
        : [{ subjectId: '', classAssignments: [{ classroomId: '', sectionId: '' }] }]
    });

    setEditDialogOpen(true);
  };

  const handleDelete = (e, teacher) => {
    if (e) e.stopPropagation();
    setSelectedTeacher(teacher);
    setSelectedTeacherProfile(teacher.profile || null);
    setDeleteDialogOpen(true);
  };
  
  const [newTeacher, setNewTeacher] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    educational_qualification: '',
    designation: '',
    blood_group: '',
    class_teacher_classroom: '',
    class_teacher_section: '',
    _photoFile: null,
    assignments: [{ subjectId: '', classAssignments: [{ classroomId: '', sectionId: '' }] }]
  });
  const [newTeacherErrors, setNewTeacherErrors] = useState({});

  // Live username availability for legacy Add Teacher dialog
  const [usernameCheck, setUsernameCheck] = useState({ loading: false, available: null, suggestions: [], msg: '' });
  useEffect(() => {
    const uname = (newTeacher.username || '').trim();
    if (!uname) {
      setUsernameCheck({ loading: false, available: null, suggestions: [], msg: '' });
      return;
    }
    let cancelled = false;
    setUsernameCheck(prev => ({ ...prev, loading: true, msg: '' }));
    const h = setTimeout(async () => {
      try {
        const res = await api.get('/api/users/username-availability/', { params: { q: uname } });
        if (cancelled) return;
        setUsernameCheck({ loading: false, available: res.data.available, suggestions: res.data.suggestions || [], msg: '' });
      } catch (e) {
        if (cancelled) return;
        setUsernameCheck({ loading: false, available: null, suggestions: [], msg: e?.response?.data?.error || 'Check failed' });
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(h); };
  }, [newTeacher.username]);
  
  const [setupLoading, setSetupLoading] = useState(false);

  const getPhotoUrl = (userObj, teacherProfile = null) => {
    if (!userObj) return undefined;
    
    const rawPhoto = userObj.photo_url || 
                     teacherProfile?.user?.photo_url || 
                     userObj.photo || 
                     teacherProfile?.user?.photo || 
                     userObj.profile_picture || 
                     teacherProfile?.user?.profile_picture || 
                     undefined;
    
    return getMediaUrl(rawPhoto) || undefined;
  };

  const buildAssignments = (assignDataRaw, teacherProfiles) => {
    const assignData = assignDataRaw || [];
    const profiles = teacherProfiles || [];

    setTeachers(profiles);

    const userIdToProfile = new Map();
    const profileIdToProfile = new Map();

    profiles.forEach(p => {
      if (p.user?.id) {
        userIdToProfile.set(p.user.id, p);
      }
      if (p.id) {
        profileIdToProfile.set(p.id, p);
      }
    });

    const enrichedAssignments = assignData.map(a => {
      const rawTeacher = a.teacher || {};
      const userId = rawTeacher.user?.id || rawTeacher.id || null;
      const teacherIdFromAssignment = a.teacher_id || null;

      let profile = null;
      if (userId && userIdToProfile.has(userId)) {
        profile = userIdToProfile.get(userId);
      } else if (teacherIdFromAssignment && profileIdToProfile.has(teacherIdFromAssignment)) {
        profile = profileIdToProfile.get(teacherIdFromAssignment);
      }

      if (userId && !profile) {
        // No profile found, will be created on edit
      }

      return {
        ...a,
        teacher: rawTeacher,
        teacherProfile: profile
      };
    });

    const assignedTeacherIds = new Set(
      enrichedAssignments
        .map(a => a.teacher?.user?.id || a.teacher?.id)
        .filter(Boolean)
    );

    const placeholders = profiles
      .filter(p => p.user?.id && !assignedTeacherIds.has(p.user.id))
      .map(p => ({
        id: `t-${p.id}`,
        teacher: { ...p.user, ...p },
        teacherProfile: p,
        subject: null,
        classroom: null,
        section: null
      }));

    const validAssignments = enrichedAssignments.filter(a => !!a.teacher);
    return [...validAssignments, ...placeholders];
  };

  const loadAssignments = () => {
    if (!id) return;
    setLoading(true);
    (async () => {
      let rawAssignments = [];
      let teacherProfiles = [];
      try {
        const assignRes = await api.get(`/api/academics/assignments/?classroom__school=${id}&_t=${Date.now()}`);
        rawAssignments = Array.isArray(assignRes.data)
          ? assignRes.data
          : (assignRes.data?.results || []);
      } catch (e) {
        console.warn('Assignments fetch failed:', e?.response?.data || e?.message);
        rawAssignments = [];
      }
      try {
        const teacherRes = await api.get(`/api/users/teachers/?school=${id}&_t=${Date.now()}`);
        const teacherData = teacherRes.data || [];
        teacherProfiles = Array.isArray(teacherData) ? teacherData : (teacherData.results || []);
      } catch (e) {
        console.warn('Teachers fetch failed:', e?.response?.data || e?.message);
        teacherProfiles = [];
      }

      const filteredAssignments = rawAssignments.filter(a => {
          const schoolId =
            a.classroom?.school?.id ||
            a.classroom?.school_id ||
            a.classroom?.school ||
            a.school?.id ||
            a.school_id ||
            a.school;
          if (!id) return true;
          if (!schoolId) return true;
          return String(schoolId) === String(id);
        });

      let filteredProfiles = (teacherProfiles || []).filter(p => {
        const schoolId =
          p.school?.id ||
          p.school_id ||
          p.school ||
          p.user?.school?.id ||
          p.user?.school_id ||
          p.user?.school;
        if (!id) return true;
        if (!schoolId) return false;
        return String(schoolId) === String(id);
      });

      // Fallback: ensure every assigned teacher has a profile attached
      try {
        const assignedUserIds = new Set(
          filteredAssignments
            .map(a => a?.teacher?.user?.id || a?.teacher?.id)
            .filter(Boolean)
        );
        const presentUserIds = new Set(
          (filteredProfiles || [])
            .map(p => p?.user?.id)
            .filter(Boolean)
        );
        if (assignedUserIds.size > presentUserIds.size) {
          const missing = Array.from(assignedUserIds).filter(uid => !presentUserIds.has(uid));
          if (missing.length > 0) {
            const fillIns = (teacherProfiles || []).filter(p => missing.includes(p?.user?.id));
            filteredProfiles = [...filteredProfiles, ...fillIns];
          }
        }
      } catch (_) {}

      // Build final assignments list
      const combined = buildAssignments(filteredAssignments, filteredProfiles);
      
      // Update local state immediately
      setAssignments(combined);
      setTeachers(filteredProfiles);
      
      setLoading(false);
      if (combined.length > 0) {
        toast.success(`Loaded ${combined.length} teacher${combined.length === 1 ? '' : 's'} (including unassigned)`);
      } else {
        toast.warning('No assignments found for this school');
      }
    })();
  };

  useEffect(() => {
    loadAssignments();
    loadFormData();
  }, [id]);
  
  useEffect(() => {
    if (selectedTeacher && editDialogOpen) {
      // Check if data is in the teacher object or in teacher.user
      const userData = selectedTeacher.user || selectedTeacher;
      const userId = userData.id;
      // Find profile to get designation
      let prof = selectedTeacherProfile;
      if (!prof && Array.isArray(teachers) && userId) {
        prof = teachers.find(tp => tp.user?.id === userId) || null;
      }
      
      // Filter current assignments for this teacher
      const currentTeacherAssignments = assignments.filter(a => (a.teacher?.user?.id === userId || a.teacher?.id === userId));
      
      // Group by subject for the UI
      const grouped = [];
      const subjectMap = new Map();
      currentTeacherAssignments.forEach(a => {
        if (!a.subject?.id) return;
        if (!subjectMap.has(a.subject.id)) {
          subjectMap.set(a.subject.id, {
            subjectId: a.subject.id,
            classAssignments: []
          });
          grouped.push(subjectMap.get(a.subject.id));
        }
        subjectMap.get(a.subject.id).classAssignments.push({
          classroomId: a.classroom?.id || '',
          sectionId: a.section?.id || ''
        });
      });

      setEditFormData({
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        email: userData.email || '',
        username: userData.username || '',
        password: '',
        phone_number: userData.phone_number || '',
        educational_qualification: userData.educational_qualification || '',
        designation: prof?.designation || '',
        blood_group: prof?.blood_group || '',
        index_number: prof?.index_number || '',
        joining_date: prof?.joining_date || '',
        assigned_subject: prof?.assigned_subject?.id || prof?.assigned_subject || '',
        class_teacher_classroom: prof?.class_teacher_classroom?.id || prof?.class_teacher_classroom || '',
        class_teacher_section: prof?.class_teacher_section?.id || prof?.class_teacher_section || '',
        _photoFile: null,
        assignments: grouped.length > 0 ? grouped : [{ subjectId: '', classAssignments: [{ classroomId: '', sectionId: '' }] }]
      });
    }
  }, [selectedTeacher, editDialogOpen, assignments, teachers]);
  
  const handleUpdateTeacher = async () => {
    if (!selectedTeacher) {
      toast.error('No teacher selected');
      return;
    }
    
    try {
      // Robustly identify userId from various possible structures
      const userId = selectedTeacher.id || selectedTeacher.user?.id;
      
      if (!userId) {
        toast.error('Unable to update: User ID not found');
        return;
      }
      
      let teacherProfile = selectedTeacher.profile || selectedTeacherProfile;
      if (!teacherProfile && Array.isArray(teachers)) {
        teacherProfile = teachers.find(tp => {
          const tpUserId = tp.user?.id || tp.user;
          return String(tpUserId) === String(userId);
        }) || null;
      }
      
      if (!teacherProfile || !teacherProfile.id) {
        toast.warning('Teacher profile not found. Assignments will still be linked.');
      }
      
      const formData = new FormData();
      console.log('editFormData.password:', editFormData.password);
      
      // Get original user data
      const originalUser = selectedTeacher.user || selectedTeacher;
      
      // Only send username if it's changed
      if (editFormData.username && editFormData.username !== originalUser.username) {
        formData.append('username', editFormData.username);
      }
      
      if (editFormData.password) {
        console.log('Appending password:', editFormData.password);
        formData.append('password', editFormData.password);
      }
      formData.append('first_name', editFormData.first_name || '');
      formData.append('last_name', editFormData.last_name || '');
      formData.append('email', editFormData.email || '');
      formData.append('phone_number', editFormData.phone_number || '');
      formData.append('educational_qualification', editFormData.educational_qualification || '');
      formData.append('designation', editFormData.designation || '');
      formData.append('blood_group', editFormData.blood_group || '');
      formData.append('index_number', editFormData.index_number || '');
      formData.append('joining_date', editFormData.joining_date || '');
      formData.append('assigned_subject', editFormData.assigned_subject || '');
      
      // Only append if they have a value, otherwise they will be handled by to_internal_value on backend
      formData.append('class_teacher_classroom', editFormData.class_teacher_classroom || '');
      formData.append('class_teacher_section', editFormData.class_teacher_section || '');
      
      if (editFormData._photoFile) {
        formData.append('photo', editFormData._photoFile);
      }
      
      if (teacherProfile?.id) {
        try {
          const endpoint = `/api/users/teachers/${teacherProfile.id}/?school=${id}`;
          const response = await api.patch(endpoint, formData);
          // Update local state immediately with response data
          if (response.data) {
            setTeachers(prevTeachers =>
              prevTeachers.map(tp =>
                tp.id === response.data.id ? response.data : tp
              )
            );
            setSelectedTeacherProfile(response.data);
            
            // IMPORTANT: Update assignments state to reflect the newly updated teacher data
            // This ensures the teacher cards show the updated username immediately
            const updatedProfile = response.data;
            if (updatedProfile.user) {
              const updatedUser = updatedProfile.user;
              const updatedUserId = updatedUser.id;
              setAssignments(prevAssignments =>
                prevAssignments.map(a => {
                  // If this assignment belongs to the updated teacher, update the nested teacher and profile data
                  if ((a.teacher?.user?.id === updatedUserId || a.teacher?.id === updatedUserId)) {
                    return {
                      ...a,
                      teacher: {
                        ...a.teacher,
                        ...updatedUser,
                        // Preserve ID fields in case structure differs
                        id: a.teacher?.id || updatedUserId,
                        user: updatedUser
                      },
                      teacherProfile: updatedProfile
                    };
                  }
                  return a;
                })
              );
            }
          }
        } catch (e) {
          console.warn('Profile patch failed, proceeding with assignments', e?.response?.data || e?.message);
          toast.warning('প্রোফাইল আপডেট হয়নি, তবুও অ্যাসাইনমেন্ট লিংক হবে');
        }
      } else if (userId) {
        // Fallback: create teacher profile for this user if missing
        try {
          formData.append('user_id', userId);
          formData.append('school_id', id);
          const response = await api.post('/api/users/teachers/', formData);
          // Update local state with newly created profile
          if (response.data) {
            setTeachers(prevTeachers => [...prevTeachers, response.data]);
            setSelectedTeacherProfile(response.data);
          }
        } catch (e) {
          console.warn('User profile creation failed', e?.response?.data || e?.message);
          toast.error('শিক্ষক প্রোফাইল আপডেট বা তৈরি করতে ব্যর্থ');
        }
      }
      // Bulk Update assignments
      const assignmentsPayload = editFormData.assignments.map(a => {
        const subjectId = a.subjectId;
        const classAssignments = a.classAssignments || [];
        
        return {
          subject_id: subjectId,
          classroom_ids: classAssignments.map(ca => ca.classroomId).filter(Boolean),
          section_ids: classAssignments.map(ca => ca.sectionId).filter(s => s !== null && s !== undefined && s !== '')
        };
      }).filter(a => a.subject_id && a.classroom_ids.length > 0);

      console.log('Bulk assign payload:', { teacher_id: userId, school_id: id, assignments: assignmentsPayload });

      // ALWAYS call bulk_assign if we are in the edit flow to sync assignments
      // even if the payload is empty (means all assignments were removed)
      try {
        await api.post('/api/academics/assignments/bulk_assign/', {
          teacher_id: userId,
          school_id: id,
          assignments: assignmentsPayload
        });
        toast.success('অ্যাসাইনমেন্ট আপডেট হয়েছে');
      } catch (e) {
        console.error('Bulk assignment error', e.response?.data || e.message);
        toast.error('অ্যাসাইনমেন্ট আপডেট করতে ব্যর্থ: ' + (e.response?.data?.detail || e.message));
      }
      
      toast.success('Changes saved')
      setEditDialogOpen(false);
      setEditFormData({
        first_name: '',
        last_name: '',
        email: '',
        username: '',
        password: '',
        phone_number: '',
        educational_qualification: '',
        designation: '',
        blood_group: '',
        index_number: '',
        joining_date: '',
        assigned_subject: '',
        class_teacher_classroom: '',
        class_teacher_section: '',
        _photoFile: null,
        assignments: []
      });
      setSelectedTeacher(null);
      // Short delay to allow DB sync before reload
      setTimeout(() => {
        loadAssignments();
      }, 500);
    } catch (error) {
      let errorMsg = 'Failed to update teacher profile';
      if (error.response?.data) {
        const data = error.response.data;
        if (typeof data === 'string') {
          errorMsg = data;
        } else if (data.detail) {
          errorMsg = data.detail;
        } else if (data.message) {
          errorMsg = data.message;
        } else {
          const fieldErrors = Object.entries(data)
            .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
            .join('; ');
          if (fieldErrors) {
            errorMsg = fieldErrors;
          }
        }
      } else if (error.message) {
        errorMsg = error.message;
      }
      toast.error(errorMsg);
    }
  };
  
  const handleDeleteTeacher = async () => {
    if (!selectedTeacher) return;
    
    setSaving(true);
    
    try {
      // Robustly identify userId from various possible structures
      // We prioritize the ID from the teacher object, then look at nested user.id
      const userId = selectedTeacher.id || selectedTeacher.user?.id;
      
      console.log('Attempting to delete teacher:', {
        userId,
        selectedTeacherId: selectedTeacher.id,
        nestedUserId: selectedTeacher.user?.id,
        username: selectedTeacher.username
      });

      if (!userId) {
        setSaving(false);
        toast.error('শিক্ষকের আইডি খুঁজে পাওয়া যায়নি');
        return;
      }

      // 1. Delete all assignments for this teacher in this school first
      try {
        const resp = await api.get(`/api/academics/assignments/?classroom__school=${id}&teacher=${userId}`);
        const assignmentsToDelete = Array.isArray(resp.data) ? resp.data : (resp.data?.results || []);
        
        console.log(`Found ${assignmentsToDelete.length} assignments to delete for user ${userId}`);

        // Sequential delete to avoid potential race conditions on live server
        for (const a of assignmentsToDelete) {
          if (a?.id) {
            try {
              await api.delete(`/api/academics/assignments/${a.id}/`);
            } catch (e) {
              if (e.response?.status !== 404) {
                console.warn('Assignment delete failed', a.id, e.message);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch assignments for deletion', err);
      }
      
      // 2. Determine primary endpoint (Profile vs User)
      // Try to find the profile ID from the selected teacher or the teachers list
      let teacherProfileId = selectedTeacher.profile?.id || selectedTeacherProfile?.id;
      if (!teacherProfileId && Array.isArray(teachers)) {
        const found = teachers.find(tp => {
          const tpUserId = tp.user?.id || tp.user;
          return String(tpUserId) === String(userId);
        });
        teacherProfileId = found?.id;
      }
      
      console.log('Determined profile ID for deletion:', teacherProfileId);

      // Try to delete profile first if it exists
      if (teacherProfileId) {
        try {
          await api.delete(`/api/users/teachers/${teacherProfileId}/?school=${id}`);
          console.log('Successfully deleted teacher profile:', teacherProfileId);
        } catch (err) {
          if (err.response?.status !== 404) {
            console.warn('Profile deletion failed', err.message);
          }
        }
      }
      
      // 3. Final attempt: Delete the user account itself
      // If we are getting 404 here, it means the ID 6398 might be the profile ID 
      // instead of the user ID, or vice versa.
      try {
        await api.delete(`/api/users/${userId}/`);
        console.log('Successfully deleted user account:', userId);
        toast.success('শিক্ষক সফলভাবে ডিলেট করা হয়েছে');
      } catch (err) {
        if (err.response?.status === 404) {
          console.log('User account not found (404), checking if userId was actually profileId:', userId);
          // If userId was 404, maybe it was a profile ID that was already deleted above
          toast.success('শিক্ষক সফলভাবে ডিলেট করা হয়েছে');
        } else {
          console.error('Final user deletion failed:', err);
          throw err;
        }
      }
      
      setDeleteDialogOpen(false);
      setSelectedTeacher(null);
      setSelectedTeacherProfile(null);
      setSaving(false);
      loadAssignments();
    } catch (error) {
      setSaving(false);
      console.error('Delete error:', error);
      let errorMsg = 'শিক্ষক ডিলেট করতে ব্যর্থ';
      if (error.response?.data?.detail) errorMsg = error.response.data.detail;
      toast.error(errorMsg);
    }
  };

  const loadFormData = async () => {
    try {
      const [subjectsRes, classroomsRes, sectionsRes] = await Promise.all([
        api.get(`/api/academics/subjects/?school=${id}`),
        api.get(`/api/academics/classrooms/?school=${id}`),
        api.get(`/api/academics/sections/?school=${id}`)
      ]);
      const subjectsData = Array.isArray(subjectsRes.data) ? subjectsRes.data : (subjectsRes.data?.results || []);
      const classroomsData = Array.isArray(classroomsRes.data) ? classroomsRes.data : (classroomsRes.data?.results || []);
      const sectionsData = Array.isArray(sectionsRes.data) ? sectionsRes.data : (sectionsRes.data?.results || []);
      
      setSubjects(subjectsData);
      setClassrooms(classroomsData);
      setSections(sectionsData);
      
      // Show warning if no data
      if (subjectsData.length === 0) {
        toast.warning('No subjects found for this school. Please add subjects first.');
      }
      if (classroomsData.length === 0) {
        toast.warning('No classes found for this school. Please add classes first.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load form data (subjects/classes). Please refresh the page.');
    }
  };

  // Handle classroom change for new teacher (for assignments)
  useEffect(() => {
    // If we wanted to load only sections for this classroom, we could do it here
    // but now we load all sections for the school in loadFormData and filter in the UI
  }, [newTeacher.classroom_id]);

  // Handle classroom change for edit assignments
  useEffect(() => {
    // We already have sections from loadFormData
  }, [editSelectedClassroomIds]);

  const handleAddTeacher = async () => {
    // Validation & auto-generate
    const genIfMissing = () => {
      let base = (newTeacher.username || newTeacher.first_name || '').trim();
      if (base) {
        try {
          base = base.normalize('NFKC').toLowerCase();
        } catch (_) {
          base = base.toLowerCase();
        }
      }
      const suffix = String(Math.floor(Math.random() * 900) + 100);
      const username = newTeacher.username || (base ? `${base}${suffix}` : `teacher${suffix}`);
      const password = newTeacher.password || '12345678';
      return { username, password };
    };

    const creds = genIfMissing();

    if (newTeacher.username && usernameCheck.available === false) {
      toast.error('This username is already taken. Please choose another.');
      return;
    }
    if (!newTeacher.first_name && !newTeacher.username) {
      toast.warning('Provide at least a first name or username');
      return;
    }
    if (!newTeacher.subject_id || !newTeacher.classroom_id) {
      toast.warning('Please select subject and classroom');
      return;
    }

    setSaving(true);
    try {
      // Step 1: Ensure a teacher profile exists (preferred endpoint)
      let teacherId = null;
      try {
        const fd = new FormData();
        // Backend expects school_id for role profile creation
        fd.append('school_id', id);
        fd.append('username', creds.username);
        fd.append('password', creds.password);
        fd.append('first_name', newTeacher.first_name || '');
        fd.append('last_name', newTeacher.last_name || '');
        fd.append('email', newTeacher.email || '');
        fd.append('phone_number', newTeacher.phone_number || '');
        fd.append('educational_qualification', newTeacher.educational_qualification || '');
        fd.append('designation', newTeacher.designation || '');
        fd.append('blood_group', newTeacher.blood_group || '');
        if (newTeacher.class_teacher_classroom) fd.append('class_teacher_classroom', newTeacher.class_teacher_classroom);
        if (newTeacher.class_teacher_section) fd.append('class_teacher_section', newTeacher.class_teacher_section);
        if (newTeacher._photoFile) {
          fd.append('photo', newTeacher._photoFile);
        }
        const teacherRes = await api.post('/api/users/teachers/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        teacherId = teacherRes.data?.id || teacherRes.data?.teacher?.id || teacherRes.data?.user?.id || null;
      } catch (e) {
        // fallback: try register() if teachers endpoint not available
        const userRes = await api.post('/api/users/register/', {
          username: creds.username,
          password: creds.password,
          confirm_password: creds.password,
          first_name: newTeacher.first_name || '',
          last_name: newTeacher.last_name || '',
          email: newTeacher.email || '',
          phone_number: newTeacher.phone_number || '',
          school: id,
          role: 'teacher'
        });
        teacherId = userRes.data?.teacher?.id || userRes.data?.user?.id || null;
      }

      // Step 2: Create teacher assignment
      await api.post('/api/academics/assignments/', {
        teacher_id: teacherId,
        subject_id: newTeacher.subject_id,
        classroom_id: newTeacher.classroom_id,
        section_id: newTeacher.section_id || null
      });

      toast.success('Teacher added successfully!');
      setAddDialogOpen(false);
      resetForm();
      loadAssignments();
    } catch (err) {
      console.error('Error adding teacher:', err);
      const n = err.normalized || { message: 'Failed to add teacher', suggestions: [], fieldErrors: {} };
      setNewTeacherErrors(n.fieldErrors || {});
      toast.error(n.message);
      if (n.suggestions?.length) toast.info('Suggestions: ' + n.suggestions.join(', '));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setNewTeacher({
      username: '',
      password: '',
      first_name: '',
      last_name: '',
      email: '',
      phone_number: '',
      educational_qualification: '',
      designation: '',
      blood_group: '',
      subject_id: '',
      classroom_id: '',
      section_id: '',
      class_teacher_classroom: '',
      class_teacher_section: '',
      _photoFile: null,
      assignments: [{ subjectId: '', classAssignments: [{ classroomId: '', sectionId: '' }] }]
    });
  };

  const handleQuickSetup = async () => {
    setSetupLoading(true);
    try {
      // Create classes
      const classNames = [
        'Class 6 (ষষ্ঠ শ্রেণি)',
        'Class 7 (সপ্তম শ্রেণি)',
        'Class 8 (অষ্টম শ্রেণি)',
        'Class 9 (নবম শ্রেণি)',
        'Class 10 (দশম শ্রেণি)',
      ];
      
      for (const name of classNames) {
        try {
          await api.post('/api/academics/classrooms/', {
            school_id: id,
            name: name
          });
        } catch (err) {
          // Ignore if already exists
          if (!err.response?.data?.name?.includes('already exists')) {
            console.error(err);
          }
        }
      }
      
      // Create subjects
      const subjectData = [
        { name: 'বাংলা (Bengali)', code: 'BANG' },
        { name: 'ইংরেজি (English)', code: 'ENG' },
        { name: 'গণিত (Mathematics)', code: 'MATH' },
        { name: 'বিজ্ঞান (Science)', code: 'SCI' },
        { name: 'সামাজিক বিজ্ঞান (Social Science)', code: 'SS' },
        { name: 'ধর্ম ও নৈতিক শিক্ষা (Religion)', code: 'REL' },
        { name: 'কৃষি শিক্ষা (Agriculture)', code: 'AGR' },
        { name: 'তথ্য ও যোগাযোগ প্রযুক্তি (ICT)', code: 'ICT' },
      ];
      
      for (const subject of subjectData) {
        try {
          await api.post('/api/academics/subjects/', {
            school_id: id,
            name: subject.name,
            code: subject.code
          });
        } catch (err) {
          // Ignore if already exists
          if (!err.response?.data?.name?.includes('already exists')) {
            console.error(err);
          }
        }
      }
      
      toast.success('✅ Setup complete! Added 5 classes and 8 subjects.');
      
      // Reload data
      await loadFormData();
      
    } catch (err) {
      console.error(err);
      toast.error('Failed to setup. Please try again.');
    } finally {
      setSetupLoading(false);
    }
  };

  const groupAssignments = (items) => {
    if (!Array.isArray(items)) return [];
    const grouped = [];
    const byUser = new Map();
    items.forEach(a => {
      const uid = a?.teacher?.user?.id || a?.teacher?.id;
      if (!uid) return;
      let g = byUser.get(uid);
      if (!g) {
        // Merge profile data into teacher object
        const mergedTeacher = a.teacherProfile 
          ? { ...a.teacher, ...a.teacherProfile, user: { ...a.teacher, ...a.teacherProfile.user } }
          : a.teacher;
        g = {
          teacher: mergedTeacher,
          teacherProfile: a.teacherProfile || null,
          subjects: new Set(),
          classes: new Set(),
          sectionsByClass: new Map(),
          subjectClassesMap: new Map(),
          subjectAssignmentsMap: new Map(), // Initialize here
          assignments: [], // Add this to hold individual assignments for TeacherCard
          assignmentCount: 0
        };
        byUser.set(uid, g);
        grouped.push(g);
      }
      g.assignments.push(a); // Populate assignments for TeacherCard
      if (a.subject?.name) g.subjects.add(a.subject.name);
      if (a.classroom?.name) {
        g.classes.add(a.classroom.name);
        
        const subjName = a.subject?.name || 'Unknown';
        if (!g.subjectAssignmentsMap.has(subjName)) {
            g.subjectAssignmentsMap.set(subjName, new Set());
        }
        
        let clsDisplay = a.classroom.name;
        if (a.section?.name) {
            clsDisplay += `(${a.section.name})`;
        }
        g.subjectAssignmentsMap.get(subjName).add(clsDisplay);

        if (a.section?.name) {
          const key = a.classroom.name;
          const sec = g.sectionsByClass.get(key) || new Set();
          sec.add(a.section.name);
          g.sectionsByClass.set(key, sec);
        }
        if (a.subject?.name) {
          const subj = a.subject.name;
          const existing = g.subjectClassesMap.get(subj) || new Set();
          existing.add(a.classroom.name);
          g.subjectClassesMap.set(subj, existing);
        }
      }
      g.assignmentCount += 1;
    });
    return grouped;
  };

  const aggregated = groupAssignments(assignments);

  const normalizeClassBase = (name) => {
    const s = String(name || '').toLowerCase();
    return s.replace(/\s*(শ্রেণী|শ্রেণি|শেণি)\s*$/i, '').trim();
  };
  const classOrder = ['প্রথম','দ্বিতীয়','দ্বিতীয়','তৃতীয়','তৃতীয়','চতুর্থ','পঞ্চম','ষষ্ঠ','সপ্তম','অষ্টম','নবম','দশম','একাদশ','দ্বাদশ'];
  const classIndex = (name) => {
    const base = normalizeClassBase(name);
    const idx = classOrder.indexOf(base);
    return idx >= 0 ? idx : 999;
  };
  const formatClassRange = (classesSet) => {
    const arr = Array.from(classesSet || []);
    if (!arr.length) return '';
    const sorted = arr.slice().sort((a, b) => classIndex(a) - classIndex(b));
    if (sorted.length >= 2) {
      const first = normalizeClassBase(sorted[0]);
      const last = normalizeClassBase(sorted[sorted.length - 1]);
      return `${first}-${last} শ্রেণি`;
    }
    const single = normalizeClassBase(sorted[0]);
    return `${single} শ্রেণি`;
  };

  const filtered = aggregated
    .filter(g => {
      const teacherName = g.teacher?.username || '';
      const subjJoined = Array.from(g.subjects).join(', ');
      const classJoined = Array.from(g.classes).join(', ');
      const q = searchQuery.toLowerCase();
      return teacherName.toLowerCase().includes(q) ||
             subjJoined.toLowerCase().includes(q) ||
             classJoined.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const teacherIdA = a.teacher?.user?.id || a.teacher?.id || 0;
      const teacherIdB = b.teacher?.user?.id || b.teacher?.id || 0;
      return teacherIdA - teacherIdB;
    });

  return (
    <Box sx={{ p: 3 }}>
      <Paper 
        elevation={0}
        sx={{ 
          mb: 3, 
          p: 3, 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: 3
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
              <SchoolIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              শিক্ষক ব্যবস্থাপনা
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              নতুন শিক্ষক যোগ করুন এবং অ্যাসাইনমেন্ট পরিচালনা করুন
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ borderColor: 'rgba(255,255,255,0.5)', color: 'white', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}>ব্যাক</Button>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />} 
              onClick={() => window.location.assign(`/school/${id}/teacher/add`)}
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
              }}
            >
              শিক্ষক যোগ করুন (অ্যাকাউন্ট)
            </Button>
            <Button 
              variant="contained"
              onClick={() => window.location.assign(`/school/${id}/teacher/cards`)}
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
              }}
            >
              শিক্ষক কার্ডসমূহ
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<RefreshIcon />} 
              onClick={loadAssignments}
              sx={{ 
                borderColor: 'rgba(255,255,255,0.5)', 
                color: 'white',
                '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
              }}
            >
              রিফ্রেশ
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <TextField
        placeholder="শিক্ষক/বিষয়/শ্রেণি দিয়ে অনুসন্ধান"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        sx={{ mb: 3 }}
        fullWidth
        InputProps={{
          endAdornment: (
            <Tooltip title="শিক্ষক, বিষয় বা শ্রেণির নাম দিয়ে অনুসন্ধান করুন">
              <HelpOutlineIcon sx={{ color: 'text.secondary', cursor: 'help' }} />
            </Tooltip>
          )
        }}
      />

      {loading && <CardSkeleton count={6} />}

      {!loading && assignments.length === 0 && (
        <EmptyState
          icon={SchoolIcon}
          title="এখনও কোনো শিক্ষক অ্যাসাইনমেন্ট নেই"
          message="সিস্টেমে তৈরি হলে এখানে শিক্ষক অ্যাসাইনমেন্টগুলো দেখা যাবে"
        />
      )}

      {!loading && assignments.length > 0 && filtered.length === 0 && (
        <EmptyState
          title="মিলে যাওয়া অ্যাসাইনমেন্ট নেই"
          message={`"${searchQuery}" এর সাথে মিলে কোনো অ্যাসাইনমেন্ট পাওয়া যায়নি। অন্যভাবে অনুসন্ধান করুন।`}
        />
      )}

      {!loading && filtered.length > 0 && (
        <Grid container spacing={2}>
          {filtered
            .sort((a, b) => {
              const usernameA = a.teacher?.username || '';
              const usernameB = b.teacher?.username || '';
              const nameA = a.teacher?.first_name || usernameA;
              const nameB = b.teacher?.first_name || usernameB;

              // Prioritize "shamir"
              if (usernameA === 'shamir') return -1;
              if (usernameB === 'shamir') return 1;

              // Then "Omor"
              if (usernameA === 'Omor') return -1;
              if (usernameB === 'Omor') return 1;

              // Default sort by name
              return nameA.localeCompare(nameB);
            })
            .map(g => {
              const a = g; // aggregated item
              const qualification = a.teacher?.educational_qualification || '';
              const qualificationText = qualification ? qualification.replace(/\s*,\s*/g, ' ও ') : '';
              const classTextRaw = formatClassRange(a.classes) || Array.from(a.classes).join(', ');
              const hasHyphen = classTextRaw.includes('-');
              const classParts = hasHyphen ? classTextRaw.split('-').map(s => s.trim()) : [classTextRaw, ''];
              // Debug log
              console.log('Teacher data:', a.teacher);
              console.log('Educational qualification:', qualification);
              
              return (
              <Grid item xs={12} sm={6} md={4} key={(a.teacher?.user?.id || a.teacher?.id || Math.random())}>
                <TeacherCard 
                  teacher={{
                    ...a.teacher,
                    assignments: a.assignments,
                    profile: a.teacherProfile
                  }} 
                  onEdit={(teacher) => handleEdit(null, teacher)}
                  onDelete={(teacher) => handleDelete(null, teacher)}
                />
              </Grid>
              );
            })}
        </Grid>
      )}

      {/* Teacher Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {`${selectedTeacher?.first_name || ''} ${selectedTeacher?.last_name || ''}`.trim() || selectedTeacher?.username || 'Teacher'} Details
        </DialogTitle>
        <DialogContent dividers>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Avatar src={getPhotoUrl(selectedTeacher)} sx={{ width: 96, height: 96 }}>
              {!getPhotoUrl(selectedTeacher) ? (selectedTeacher?.first_name?.[0] || selectedTeacher?.username?.[0] || '?') : null}
            </Avatar>
            <Box>
              <Typography variant="h6">{`${selectedTeacher?.first_name || ''} ${selectedTeacher?.last_name || ''}`.trim() || selectedTeacher?.username}</Typography>
              <Typography variant="body2" color="text.secondary">{selectedTeacher?.email || ''}</Typography>
            </Box>
          </Stack>
          <Stack spacing={1.5}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {selectedTeacherProfile?.designation && (
                <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 700 }}>
                  {selectedTeacherProfile.designation}
                </Typography>
              )}
              <Typography variant="body1" color="secondary" sx={{ fontWeight: 600 }}>
                {(selectedTeacher?.educational_qualification || '').replace(/\s*,\s*/g, ' ও ') || ''}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {selectedTeacherSubjects.length > 0
                ? selectedTeacherSubjects.map((s, i) => (
                    <Chip
                      key={`${s}-${i}`}
                      label={s}
                      color={['primary','secondary','success','warning','info','error'][i % 6]}
                      size="medium"
                      sx={{ '& .MuiChip-label': { fontSize: '0.95rem', fontWeight: 600 } }}
                    />
                  ))
                : <Chip label="No subjects" size="medium" sx={{ '& .MuiChip-label': { fontSize: '0.9rem' } }} />}
            </Box>
            {(() => {
              const classTextRaw = formatClassRange(new Set(selectedTeacherClasses)) || selectedTeacherClasses.join(', ');
              const hasHyphen = classTextRaw.includes('-');
              const parts = hasHyphen ? classTextRaw.split('-').map(s => s.trim()) : [classTextRaw, ''];
              return (
                <Typography variant="body1" sx={{ wordBreak: 'break-word', overflowWrap: 'anywhere', fontWeight: 600 }}>
                  {hasHyphen ? (
                    <>
                      <Box component="span" sx={{ color: 'primary.main' }}>{parts[0]}</Box>
                      <Box component="span" sx={{ color: 'primary.main' }}>{' - '}</Box>
                      <Box component="span" sx={{ color: 'secondary.main' }}>{parts[1]}</Box>
                    </>
                  ) : (
                    <Box component="span" sx={{ color: 'info.main' }}>{classTextRaw}</Box>
                  )}
                </Typography>
              );
            })()}
            <Typography variant="body1" color="textSecondary">
              <strong>Mobile:</strong> {selectedTeacher?.phone_number || selectedTeacher?.mobile_number || 'Not available'}
            </Typography>
            {selectedTeacherProfile?.blood_group && (
              <Typography variant="body1" color="textSecondary">
                <strong>Blood Group:</strong> {selectedTeacherProfile.blood_group}
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Edit Teacher Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Edit Teacher Profile
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* Profile Photo */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                Profile Photo
              </Typography>
              <PhotoUpload 
                currentPhoto={getPhotoUrl(selectedTeacher)} 
                onPhotoChange={(file) => setEditFormData({...editFormData, _photoFile: file})} 
                userName={`${editFormData.first_name || ''} ${editFormData.last_name || ''}`.trim() || editFormData.username || 'Teacher'} 
              />
            </Box>
            
            <TextField
              label="First Name"
              fullWidth
              value={editFormData.first_name || ''}
              onChange={(e) => setEditFormData({...editFormData, first_name: e.target.value})}
            />
            <TextField
              label="Last Name"
              fullWidth
              value={editFormData.last_name || ''}
              onChange={(e) => setEditFormData({...editFormData, last_name: e.target.value})}
            />
            <TextField
              label="Email"
              fullWidth
              value={editFormData.email || ''}
              onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
            />
            <TextField
              label="Designation"
              fullWidth
              value={editFormData.designation || ''}
              onChange={(e) => setEditFormData({...editFormData, designation: e.target.value})}
            />
            <TextField
              label="Username (Login ID)"
              fullWidth
              value={editFormData.username || ''}
              onChange={(e) => setEditFormData({...editFormData, username: e.target.value})}
              helperText="Username for login"
            />
            <TextField
              label="New Password"
              type="password"
              fullWidth
              value={editFormData.password || ''}
              onChange={(e) => setEditFormData({...editFormData, password: e.target.value})}
              helperText="Leave blank to keep current password"
            />
            <TextField
              label="Phone Number"
              fullWidth
              value={editFormData.phone_number || ''}
              onChange={(e) => setEditFormData({...editFormData, phone_number: e.target.value})}
            />
            <TextField
              label="শিক্ষাগত যোগ্যতা (Educational Qualification)"
              fullWidth
              value={editFormData.educational_qualification || ''}
              onChange={(e) => setEditFormData({...editFormData, educational_qualification: e.target.value})}
              placeholder="e.g., B.A., M.A., B.Ed., এম.এ., বি.এড."
              helperText="Optional - শিক্ষাগত যোগ্যতা লিখুন"
            />
            
            <TextField
              select
              label="রক্তের গ্রুপ (Blood Group)"
              fullWidth
              value={editFormData.blood_group || ''}
              onChange={(e) => setEditFormData({...editFormData, blood_group: e.target.value})}
            >
              <MenuItem value="">নির্বাচন করুন</MenuItem>
              <MenuItem value="A+">A+</MenuItem>
              <MenuItem value="A-">A-</MenuItem>
              <MenuItem value="B+">B+</MenuItem>
              <MenuItem value="B-">B-</MenuItem>
              <MenuItem value="AB+">AB+</MenuItem>
              <MenuItem value="AB-">AB-</MenuItem>
              <MenuItem value="O+">O+</MenuItem>
              <MenuItem value="O-">O-</MenuItem>
            </TextField>

            <TextField
              label="ইনডেক্স নম্বর (Index Number)"
              fullWidth
              value={editFormData.index_number || ''}
              onChange={(e) => setEditFormData({...editFormData, index_number: e.target.value})}
            />

            <TextField
              label="যোগদানের তারিখ (Joining Date)"
              type="date"
              fullWidth
              value={editFormData.joining_date || ''}
              onChange={(e) => setEditFormData({...editFormData, joining_date: e.target.value})}
              InputLabelProps={{ shrink: true }}
            />

            <Autocomplete
              fullWidth
              options={subjects || []}
              getOptionLabel={(s) => s?.name || ''}
              value={subjects.find(s => String(s.id) === String(editFormData.assigned_subject)) || null}
              onChange={(e, val) => setEditFormData({...editFormData, assigned_subject: val ? val.id : ''})}
              renderInput={(params) => (
                <TextField {...params} label="নিযুক্ত বিষয় (Assigned Subject)" placeholder="বিষয় নির্বাচন করুন" />
              )}
            />

            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mt: 2 }}>👨‍🏫 শ্রেণি শিক্ষক তথ্য (Class Teacher Info)</Typography>
            <Stack direction="row" spacing={2}>
              <Autocomplete
                fullWidth
                options={classrooms || []}
                getOptionLabel={(c) => c?.name || ''}
                value={(classrooms || []).find(c => String(c.id) === String(editFormData.class_teacher_classroom)) || null}
                onChange={(e, val) => {
                  setEditFormData({...editFormData, class_teacher_classroom: val ? val.id : '', class_teacher_section: ''});
                }}
                renderInput={(params) => (
                  <TextField {...params} label="শ্রেণি (Class)" placeholder="শ্রেণি নির্বাচন করুন" />
                )}
              />
              <Autocomplete
                fullWidth
                options={sections.filter(s => String(s.classroom?.id || s.classroom) === String(editFormData.class_teacher_classroom)) || []}
                getOptionLabel={(s) => s?.name || ''}
                value={(sections || []).find(s => String(s.id) === String(editFormData.class_teacher_section)) || null}
                onChange={(e, val) => setEditFormData({...editFormData, class_teacher_section: val ? val.id : ''})}
                renderInput={(params) => (
                  <TextField {...params} label="সেকশন (Section)" placeholder="সেকশন নির্বাচন করুন" />
                )}
                disabled={!editFormData.class_teacher_classroom}
              />
            </Stack>

            <Divider sx={{ my: 2 }} />
            
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
              📚 বিষয় এবং ক্লাস অ্যাসাইনমেন্ট (Assignments)
            </Typography>
            
            {(editFormData.assignments || []).map((assign, aIdx) => (
              <Paper key={aIdx} variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#f8f9fa' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>অ্যাসাইনমেন্ট #{aIdx + 1}</Typography>
                  <IconButton color="error" size="small" onClick={() => removeEditAssignmentRow(aIdx)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
                
                <Autocomplete
                  fullWidth
                  sx={{ mb: 2 }}
                  options={subjects || []}
                  getOptionLabel={(s) => s?.name || ''}
                  value={subjects.find(s => String(s.id) === String(assign.subjectId)) || null}
                  onChange={(e, val) => updateEditAssignment(aIdx, 'subjectId', val ? val.id : '')}
                  renderInput={(params) => (
                    <TextField {...params} label="বিষয় (Subject)" placeholder="বিষয় নির্বাচন করুন" />
                  )}
                />
                
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>ক্লাস এবং সেকশনসমূহ:</Typography>
                
                {assign.classAssignments.map((ca, cIdx) => (
                  <Stack key={cIdx} direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
                    <Autocomplete
                      fullWidth
                      options={classrooms || []}
                      getOptionLabel={(c) => c?.name || ''}
                      value={classrooms.find(c => String(c.id) === String(ca.classroomId)) || null}
                      onChange={(e, val) => updateEditClassAssignment(aIdx, cIdx, 'classroomId', val ? val.id : '')}
                      renderInput={(params) => (
                        <TextField {...params} label="শ্রেণি (Class)" size="small" />
                      )}
                    />
                    <Autocomplete
                      fullWidth
                      options={sections.filter(s => String(s.classroom?.id || s.classroom) === String(ca.classroomId)) || []}
                      getOptionLabel={(s) => s?.name || ''}
                      value={sections.find(s => String(s.id) === String(ca.sectionId)) || null}
                      onChange={(e, val) => updateEditClassAssignment(aIdx, cIdx, 'sectionId', val ? val.id : '')}
                      renderInput={(params) => (
                        <TextField {...params} label="সেকশন (Section)" size="small" />
                      )}
                      disabled={!ca.classroomId}
                    />
                    <IconButton size="small" color="error" onClick={() => removeClassFromEditAssignment(aIdx, cIdx)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
                
                <Button 
                  startIcon={<AddIcon />} 
                  size="small" 
                  onClick={() => addClassToEditAssignment(aIdx)}
                  sx={{ mt: 1 }}
                >
                  আরো ক্লাস যোগ করুন
                </Button>
              </Paper>
            ))}
            
            <Button 
              variant="outlined" 
              startIcon={<AddIcon />} 
              onClick={addEditAssignmentRow}
              sx={{ alignSelf: 'flex-start' }}
            >
              নতুন বিষয় যোগ করুন
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleUpdateTeacher}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the teacher profile for {`${selectedTeacher?.first_name || ''} ${selectedTeacher?.last_name || ''}`.trim() || selectedTeacher?.username}?
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="error" 
            onClick={handleDeleteTeacher}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Teacher Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                👨‍🏫 Add New Teacher
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Create a new teacher account and assign to class
              </Typography>
            </Box>
            <IconButton onClick={() => setAddDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                🖼️ Profile Photo
              </Typography>
              <PhotoUpload
                currentPhoto={null}
                onPhotoChange={(file) => setNewTeacher(nt => ({ ...nt, _photoFile: file }))}
                userName={`${newTeacher.first_name || ''} ${newTeacher.last_name || ''}`.trim() || newTeacher.username || 'Teacher'}
              />
            </Grid>
            {/* Account Information */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                🔐 Account Information
              </Typography>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Username *"
                value={newTeacher.username}
                onChange={(e) => setNewTeacher({...newTeacher, username: e.target.value})}
                fullWidth
                error={!!newTeacherErrors.username || usernameCheck.available === false}
                helperText={newTeacherErrors.username || (usernameCheck.loading ? 'Checking availability…' : usernameCheck.available === false ? 'Username not available' : 'Used for login')}
              />
              {usernameCheck.available === false && usernameCheck.suggestions?.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  {usernameCheck.suggestions.map((sug, i) => (
                    <Chip key={i} label={sug} onClick={() => setNewTeacher(nt => ({ ...nt, username: sug }))} clickable />
                  ))}
                </Stack>
              )}
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Password *"
                type="password"
                value={newTeacher.password}
                onChange={(e) => setNewTeacher({...newTeacher, password: e.target.value})}
                fullWidth
                error={!!newTeacherErrors.password}
                helperText={newTeacherErrors.password || 'Minimum 8 characters'}
              />
            </Grid>

            {/* Personal Information */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, mt: 2 }}>
                👤 Personal Information
              </Typography>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="First Name *"
                value={newTeacher.first_name}
                onChange={(e) => setNewTeacher({...newTeacher, first_name: e.target.value})}
                fullWidth
                error={!!newTeacherErrors.first_name}
                helperText={newTeacherErrors.first_name || ''}
              />
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Last Name *"
                value={newTeacher.last_name}
                onChange={(e) => setNewTeacher({...newTeacher, last_name: e.target.value})}
                fullWidth
                error={!!newTeacherErrors.last_name}
                helperText={newTeacherErrors.last_name || ''}
              />
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Email"
                type="email"
                value={newTeacher.email}
                onChange={(e) => setNewTeacher({...newTeacher, email: e.target.value})}
                fullWidth
                error={!!newTeacherErrors.email}
                helperText={newTeacherErrors.email || ''}
              />
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Phone Number"
                value={newTeacher.phone_number}
                onChange={(e) => setNewTeacher({...newTeacher, phone_number: e.target.value})}
                fullWidth
                placeholder="+8801712345678"
                error={!!newTeacherErrors.phone_number}
                helperText={newTeacherErrors.phone_number || 'Include country code'}
              />
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                label="রক্তের গ্রুপ (Blood Group)"
                value={newTeacher.blood_group}
                onChange={(e) => setNewTeacher({...newTeacher, blood_group: e.target.value})}
                fullWidth
              >
                <MenuItem value="">নির্বাচন করুন</MenuItem>
                <MenuItem value="A+">A+</MenuItem>
                <MenuItem value="A-">A-</MenuItem>
                <MenuItem value="B+">B+</MenuItem>
                <MenuItem value="B-">B-</MenuItem>
                <MenuItem value="AB+">AB+</MenuItem>
                <MenuItem value="AB-">AB-</MenuItem>
                <MenuItem value="O+">O+</MenuItem>
                <MenuItem value="O-">O-</MenuItem>
              </TextField>
            </Grid>

            {/* Class Teacher Assignment */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, mt: 2 }}>
                👨‍🏫 শ্রেণি শিক্ষক তথ্য (Class Teacher Assignment)
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                label="শ্রেণি (Class)"
                value={newTeacher.class_teacher_classroom}
                onChange={(e) => setNewTeacher({...newTeacher, class_teacher_classroom: e.target.value, class_teacher_section: ''})}
                fullWidth
              >
                <MenuItem value="">-- শ্রেণি নির্বাচন করুন --</MenuItem>
                {classrooms.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                label="সেকশন (Section)"
                value={newTeacher.class_teacher_section}
                onChange={(e) => setNewTeacher({...newTeacher, class_teacher_section: e.target.value})}
                fullWidth
                disabled={!newTeacher.class_teacher_classroom}
              >
                <MenuItem value="">-- সেকশন নির্বাচন করুন --</MenuItem>
                {sections.filter(s => String(s.classroom?.id || s.classroom) === String(newTeacher.class_teacher_classroom)).map(s => (
                  <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Teaching Assignment */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, mt: 2 }}>
                📚 Teaching Assignment
              </Typography>
              {(subjects.length === 0 || classrooms.length === 0) && (
                <Alert 
                  severity="warning" 
                  sx={{ mb: 2 }}
                  action={
                    <Button 
                      color="inherit" 
                      size="small" 
                      onClick={handleQuickSetup}
                      disabled={setupLoading}
                      variant="outlined"
                    >
                      {setupLoading ? 'Setting up...' : '🚀 Quick Setup'}
                    </Button>
                  }
                >
                  ⚠️ No {subjects.length === 0 ? 'subjects' : ''} 
                  {subjects.length === 0 && classrooms.length === 0 ? ' or ' : ''}
                  {classrooms.length === 0 ? 'classes' : ''} found!
                  <br />
                  Click "Quick Setup" to automatically add common subjects and classes.
                </Alert>
              )}
            </Grid>
            
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                select
                label="Subject *"
                value={newTeacher.subject_id}
                onChange={(e) => setNewTeacher({...newTeacher, subject_id: e.target.value})}
                fullWidth
                disabled={subjects.length === 0}
                error={!!newTeacherErrors.subject_id}
                helperText={newTeacherErrors.subject_id || (subjects.length === 0 ? 'No subjects available' : '')}
              >
                <MenuItem value="">Select Subject</MenuItem>
                {subjects.map(s => (
                  <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                select
                label="Class *"
                value={newTeacher.classroom_id}
                onChange={(e) => setNewTeacher({...newTeacher, classroom_id: e.target.value})}
                fullWidth
                disabled={classrooms.length === 0}
                error={!!newTeacherErrors.classroom_id}
                helperText={newTeacherErrors.classroom_id || (classrooms.length === 0 ? 'No classes available' : '')}
              >
                <MenuItem value="">Select Class</MenuItem>
                {classrooms.map(c => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                select
                label="Section (Optional)"
                value={newTeacher.section_id}
                onChange={(e) => setNewTeacher({...newTeacher, section_id: e.target.value})}
                fullWidth
                error={!!newTeacherErrors.section_id}
                helperText={newTeacherErrors.section_id || ''}
              >
                <MenuItem value="">No Section</MenuItem>
                {sections.filter(s => String(s.classroom?.id || s.classroom) === String(newTeacher.classroom_id)).map(s => (
                  <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleAddTeacher}
            disabled={saving}
            startIcon={<AddIcon />}
          >
            {saving ? 'Adding...' : 'Add Teacher'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
