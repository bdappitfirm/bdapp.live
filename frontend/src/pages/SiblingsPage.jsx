import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Stack,
  Avatar,
  Divider,
  Card,
  CardContent,
  Grid,
  Chip
} from '@mui/material';
import { scopedGet } from '../utils/schoolApi';
import { useToast } from '../components/Toast';
import { getMediaUrl } from '../utils/media';

// Helper to normalize Bengali/English names for parent matching
const cleanTitle = (str) => {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/^(md\.|md|mohammad|mohammed|ms\.|mst\.|mst|মোঃ|মোসাম্মৎ|মোসাঃ|মিসেস|মিস|আঃ|আকন্দ|বেগম|খাঁন|খান|ইসলাম|পাটওয়ারী|বেপারী|গাজী|ঢালী|দর্জি|মুন্সী|হোসেন|হোসাইন|চৌধুরী|শেখ)\s+/gi, '')
    .replace(/[^\w\u0980-\u09FF]/g, '')
    .trim();
};

const cleanPhone = (ph) => {
  if (!ph) return '';
  const digits = String(ph).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

const isStudentCompatibleWithGuardian = (student, guardian) => {
  if (!guardian) return true;
  const gName = cleanTitle(`${guardian.first_name || ''} ${guardian.last_name || ''}`);
  const gPhone = cleanPhone(guardian.phone_number);
  const uPhone = cleanPhone(student.user?.phone_number || student.phone_number);
  const fName = cleanTitle(student.father_name);
  const mName = cleanTitle(student.mother_name);

  // Positive evidence matches
  const hasFatherMatch = Boolean(fName && gName && (fName.includes(gName) || gName.includes(fName)));
  const hasMotherMatch = Boolean(mName && gName && (mName.includes(gName) || gName.includes(mName)));
  const hasPhoneMatch = Boolean(gPhone && uPhone && gPhone === uPhone);

  if (hasFatherMatch || hasMotherMatch || hasPhoneMatch) {
    return true;
  }

  // Contradictions
  if (fName && gName && !fName.includes(gName) && !gName.includes(fName)) {
    return false;
  }

  // Lacks any father/mother name AND lacks matching phone (or phone is empty)
  if (!fName && !mName && (!uPhone || (gPhone && uPhone !== gPhone))) {
    return false;
  }

  // Phone differs from guardian phone
  if (uPhone && gPhone && uPhone !== gPhone) {
    return false;
  }

  return false;
};

const areParentsCompatible = (s1, s2) => {
  const f1 = (s1.father_name || '').trim();
  const f2 = (s2.father_name || '').trim();
  const m1 = (s1.mother_name || '').trim();
  const m2 = (s2.mother_name || '').trim();

  // If both have father_name and they are distinctly different
  if (f1 && f2) {
    const cf1 = cleanTitle(f1);
    const cf2 = cleanTitle(f2);
    if (cf1 && cf2 && cf1 !== cf2 && !cf1.includes(cf2) && !cf2.includes(cf1)) {
      return false;
    }
  }

  // If both have mother_name and they are distinctly different
  if (m1 && m2) {
    const cm1 = cleanTitle(m1);
    const cm2 = cleanTitle(m2);
    if (cm1 && cm2 && cm1 !== cm2 && !cm1.includes(cm2) && !cm2.includes(cm1)) {
      return false;
    }
  }

  const p1 = cleanPhone(s1.user?.phone_number || s1.phone_number);
  const p2 = cleanPhone(s2.user?.phone_number || s2.phone_number);
  if (p1 && p2 && p1 !== p2) {
    const cf1 = cleanTitle(f1);
    const cf2 = cleanTitle(f2);
    if (!cf1 || !cf2 || cf1 !== cf2) {
      return false;
    }
  }

  return true;
};

export default function SiblingsPage() {
  const { id } = useParams();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [siblingGroups, setSiblingGroups] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await scopedGet('/api/academics/students/', id, { page_size: 5000 });
      const allStudents = Array.isArray(res.data) ? res.data : (res.data?.results || []);

      const usedStudentIds = new Set();
      const finalGroups = [];

      // Pass 1: Group by Guardian ID, filtering out incompatible students first
      const byGuardian = new Map();
      allStudents.forEach(s => {
        const gId = s.guardian?.id || (typeof s.guardian === 'number' ? s.guardian : null);
        if (gId) {
          if (!byGuardian.has(gId)) byGuardian.set(gId, []);
          byGuardian.get(gId).push(s);
        }
      });

      byGuardian.forEach((members) => {
        const compatMembers = members.filter(m => isStudentCompatibleWithGuardian(m, m.guardian));
        if (compatMembers.length < 2) return;

        const subgroups = [];
        compatMembers.forEach(m => {
          let added = false;
          for (const sg of subgroups) {
            if (sg.every(x => areParentsCompatible(m, x))) {
              sg.push(m);
              added = true;
              break;
            }
          }
          if (!added) subgroups.push([m]);
        });

        subgroups.forEach(sg => {
          if (sg.length > 1) {
            sg.forEach(x => usedStudentIds.add(x.id));
            const primary = sg[0];
            finalGroups.push({
              guardian: primary.guardian,
              father_name: primary.father_name,
              mother_name: primary.mother_name,
              phone_number: primary.guardian?.phone_number || primary.phone_number || '',
              students: sg
            });
          }
        });
      });

      // Pass 2: Group remaining students by clean father_name + mother_name
      const remainingStudents = allStudents.filter(s => !usedStudentIds.has(s.id));
      const byParentNames = new Map();

      remainingStudents.forEach(s => {
        const cf = cleanTitle(s.father_name);
        const cm = cleanTitle(s.mother_name);
        if (cf && cm) {
          const key = `${cf}_${cm}`;
          if (!byParentNames.has(key)) byParentNames.set(key, []);
          byParentNames.get(key).push(s);
        }
      });

      byParentNames.forEach((members) => {
        if (members.length > 1) {
          const primary = members[0];
          finalGroups.push({
            guardian: null,
            father_name: primary.father_name,
            mother_name: primary.mother_name,
            phone_number: primary.user?.phone_number || '',
            students: members
          });
        }
      });

      // Sort groups by number of children descending
      finalGroups.sort((a, b) => b.students.length - a.students.length);
      setSiblingGroups(finalGroups);
    } catch (err) {
      console.error(err);
      toast.error('তথ্য লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    if (id) loadData();
  }, [id, loadData]);

  return (
    <Box sx={{ p: { xs: 1, sm: 3 } }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 3 }} className="no-print">
        ভাই-বোন তালিকা (একই অভিভাবকের একাধিক সন্তান)
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 10 }}><CircularProgress /></Box>
      ) : siblingGroups.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center' }}>
          <Typography color="textSecondary">কোনো অভিভাবকের একাধিক সন্তান পাওয়া যায়নি।</Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {siblingGroups.map((group, idx) => (
            <Grid item xs={12} key={idx}>
              <Card sx={{ borderLeft: '5px solid #1976d2', boxShadow: 3 }}>
                <CardContent>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ sm: 'center' }}>
                    <Box sx={{ minWidth: 200 }}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar
                          src={getMediaUrl(group.guardian?.photo)}
                          sx={{ width: 60, height: 60, bgcolor: 'primary.main' }}
                        >
                          {group.guardian?.first_name?.[0] || 'G'}
                        </Avatar>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            {group.guardian?.first_name ? `${group.guardian.first_name} ${group.guardian.last_name || ''}` : group.father_name || 'অভিভাবক'}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            মোবাইল: {group.guardian?.phone_number || group.phone_number || 'নেই'}
                          </Typography>
                          <Chip size="small" label={`${group.students.length} জন সন্তান`} color="primary" sx={{ mt: 0.5 }} />
                        </Box>
                      </Stack>
                    </Box>

                    <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />

                    <Box sx={{ flexGrow: 1 }}>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>শিক্ষার্থীর নাম</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>শ্রেণি</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>সেকশন</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>রোল</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>আইডি</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {group.students.map((student) => (
                              <TableRow key={student.id}>
                                <TableCell>
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <Avatar src={getMediaUrl(student.user?.photo)} sx={{ width: 24, height: 24 }} />
                                    <Typography variant="body2">{student.user?.first_name} {student.user?.last_name}</Typography>
                                  </Stack>
                                </TableCell>
                                <TableCell>{student.classroom?.name}</TableCell>
                                <TableCell>{student.section?.name || '-'}</TableCell>
                                <TableCell>{student.roll_number}</TableCell>
                                <TableCell>{student.student_custom_id}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
