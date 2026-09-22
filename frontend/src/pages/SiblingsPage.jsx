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

      // Group by Guardian ID
      const groups = new Map();
      allStudents.forEach(s => {
        const gId = s.guardian?.id || s.guardian;
        if (gId) {
            const key = typeof gId === 'object' ? gId.id : gId;
            if (!groups.has(key)) {
                groups.set(key, {
                    guardian: s.guardian,
                    father_name: s.father_name,
                    mother_name: s.mother_name,
                    students: []
                });
            }
            groups.get(key).students.push(s);
        }
      });

      // Filter groups with more than 1 student
      const multipleChildrenGroups = Array.from(groups.values())
        .filter(g => g.students.length > 1)
        .sort((a, b) => b.students.length - a.students.length);

      setSiblingGroups(multipleChildrenGroups);
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
                            মোবাইল: {group.guardian?.phone_number || 'নেই'}
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
