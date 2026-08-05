import React, { useState, useEffect } from 'react';
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
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Stack,
  Chip
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { scopedGet } from '../utils/schoolApi';
import { useSchool } from '../context/SchoolContext';
import { getMediaUrl } from '../utils/media';
import PrintIcon from '@mui/icons-material/Print';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const EXAM_TYPE_LABELS = {
  'half_yearly': 'অর্ধবার্ষিক',
  'annual': 'বার্ষিক',
  'test': 'বিশেষ মূল্যায়ন',
  'model_test': 'মডেল টেস্ট',
  'pre_test': 'প্রাক-নির্বাচনী',
  'final': 'চূড়ান্ত পরীক্ষা'
};

const MeritListPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { schoolId: contextSchoolId } = useSchool();
  const schoolId = contextSchoolId || id;

  const [examTypes, setExamTypes] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedExamType, setSelectedExamType] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');

  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [schoolData, setSchoolData] = useState(null);

  useEffect(() => {
    if (!schoolId) return;
    scopedGet(`/api/schools/${schoolId}/`, schoolId)
      .then(res => setSchoolData(res.data))
      .catch(err => console.error('School fetch error:', err));

    scopedGet('/api/results/examinations/', schoolId)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        const types = [...new Set(data.map(e => e?.exam_type).filter(Boolean))];
        setExamTypes(types);
      })
      .catch(err => console.error('Examinations fetch error:', err));

    scopedGet('/api/academics/classrooms/', schoolId)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        setClassrooms(data);
      })
      .catch(err => console.error('Classrooms fetch error:', err));
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId || !selectedClass) { setSections([]); return; }
    scopedGet('/api/academics/sections/', schoolId, { classroom: selectedClass })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        setSections(data);
        if (data.length === 1) setSelectedSection(String(data[0].id));
      })
      .catch(() => setSections([]));
  }, [schoolId, selectedClass]);

  const handleFetchMeritList = async () => {
    if (!selectedExamType || !selectedClass || !selectedSection) return;
    setLoading(true);
    setErrorMessage('');
    setRankings([]);

    try {
      const params = {
        classroom: selectedClass,
        section: selectedSection,
        year: selectedYear,
        exam_type: selectedExamType,
        page_size: 2000
      };

      const res = await scopedGet('/api/results/results/', schoolId, params);
      const allResults = Array.isArray(res.data) ? res.data : (res.data?.results || []);

      if (allResults.length === 0) {
        setErrorMessage('কোনো রেজাল্ট পাওয়া যায়নি।');
        setLoading(false);
        return;
      }

      const byStu = new Map();
      allResults.forEach(r => {
        const sid = r?.student?.id ?? r?.student_id;
        if (!sid) return;
        const key = String(sid);
        if (!byStu.has(key)) byStu.set(key, []);
        byStu.get(key).push(r);
      });

      const studentList = [];
      for (const [sid, results] of byStu.entries()) {
        const student = results[0].student;
        let totalMarks = 0;
        const failedSubjects = [];

        results.forEach(r => {
          totalMarks += parseFloat(r.total_obtained || 0);
          if (r.grade === 'F' || r.is_passed === false) {
            failedSubjects.push(r.subject?.name || r.subject_name || 'Unknown');
          }
        });

        studentList.push({
          student,
          totalMarks: Math.round(totalMarks),
          failedSubjects,
          failedCount: failedSubjects.length
        });
      }

      // Sorting logic as requested:
      // All subjects pass first, then 1 failed, 2 failed, etc.
      // Within each failedCount group, sort by total marks descending.
      studentList.sort((a, b) => {
        if (a.failedCount !== b.failedCount) return a.failedCount - b.failedCount;
        return b.totalMarks - a.totalMarks;
      });

      setRankings(studentList);
    } catch (err) {
      setErrorMessage('ডাটা লোড করতে সমস্যা হয়েছে।');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getClassName = () => classrooms.find(c => String(c.id) === String(selectedClass))?.name || '';
  const getSectionName = () => sections.find(s => String(s.id) === String(selectedSection))?.name || '';

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ '@media print': { display: 'none' } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', fontFamily: "'Hind Siliguri', sans-serif" }}>মেরিট লিস্ট (Merit List)</Typography>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>ব্যাক</Button>
        </Stack>

        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel>পরীক্ষা</InputLabel>
                <Select
                  value={selectedExamType}
                  label="পরীক্ষা"
                  onChange={(e) => setSelectedExamType(e.target.value)}
                >
                  <MenuItem value=""><em>Select Examination</em></MenuItem>
                  {examTypes.map(type => (
                    <MenuItem key={type} value={type}>{EXAM_TYPE_LABELS[type] || type}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel>শ্রেণি</InputLabel>
                <Select
                  value={selectedClass}
                  label="শ্রেণি"
                  onChange={(e) => {
                    setSelectedClass(e.target.value);
                    setSelectedSection('');
                  }}
                >
                  <MenuItem value=""><em>Select Class</em></MenuItem>
                  {classrooms.map(cls => (
                    <MenuItem key={cls.id} value={String(cls.id)}>{cls.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <FormControl fullWidth disabled={!selectedClass}>
                <InputLabel>শাখা (Section)</InputLabel>
                <Select
                  value={selectedSection}
                  label="শাখা (Section)"
                  onChange={(e) => setSelectedSection(e.target.value)}
                >
                  <MenuItem value=""><em>Select Section</em></MenuItem>
                  {sections.map(sec => (
                    <MenuItem key={sec.id} value={String(sec.id)}>{sec.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <FormControl fullWidth>
                <InputLabel>সাল</InputLabel>
                <Select
                  value={selectedYear}
                  label="সাল"
                  onChange={(e) => setSelectedYear(e.target.value)}
                >
                  {[0, 1, 2].map(i => {
                    const y = new Date().getFullYear() - i;
                    return <MenuItem key={y} value={y}>{y}</MenuItem>;
                  })}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <Button
                variant="contained"
                onClick={handleFetchMeritList}
                disabled={!selectedExamType || !selectedClass || !selectedSection || loading}
                fullWidth
                sx={{ height: '56px' }}
              >
                দেখুন
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {errorMessage && (
            <Typography color="error" sx={{ textAlign: 'center', mt: 2 }}>{errorMessage}</Typography>
          )}

          {rankings.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2, '@media print': { display: 'none' } }}>
                <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}>প্রিন্ট করুন</Button>
              </Box>

              <TableContainer component={Paper} sx={{ borderRadius: 0, border: '1px solid #000', boxShadow: 'none', mt: 2 }}>
                <Box sx={{
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '2px solid #000'
                }}>
                  <Box sx={{ width: '100px', textAlign: 'left' }}>
                    {schoolData?.logo && <img src={getMediaUrl(schoolData.logo)} alt="logo" style={{ maxHeight: '80px', maxWidth: '100px' }} />}
                  </Box>
                  <Box sx={{ textAlign: 'center', flex: 1 }}>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', textTransform: 'uppercase', fontFamily: "'Hind Siliguri', sans-serif" }}>
                      {schoolData?.bn_name || schoolData?.name}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>মেরিট লিস্ট (মেধাতালিকা)</Typography>
                    <Typography sx={{ fontWeight: 500 }}>
                      শ্রেণি: {getClassName()}, শাখা: {getSectionName()}, সাল: {selectedYear}
                    </Typography>
                    <Typography sx={{ fontWeight: 500 }}>
                      পরীক্ষা: {EXAM_TYPE_LABELS[selectedExamType] || selectedExamType}
                    </Typography>
                  </Box>
                  <Box sx={{ width: '100px', textAlign: 'right' }}>
                    {schoolData?.logo && <img src={getMediaUrl(schoolData.logo)} alt="logo" style={{ maxHeight: '80px', maxWidth: '100px' }} />}
                  </Box>
                </Box>
                <Table size="small" sx={{ '& td, & th': { border: '1px solid #000 !important' } }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f0f0f0' }}>
                      <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '60px' }}>রোল</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>শিক্ষার্থীর নাম</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '100px' }}>মোট নম্বর</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '80px' }}>মেরিট</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>ফলাফল ও মন্তব্য</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rankings.map((row, idx) => (
                      <TableRow key={idx} sx={{ '&:nth-of-type(even)': { bgcolor: '#fafafa' } }}>
                        <TableCell sx={{ textAlign: 'center' }}>{row.student?.roll_number}</TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>
                          {`${row.student?.user?.first_name || ''} ${row.student?.user?.last_name || ''}`.trim()}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center', fontWeight: 'bold' }}>{row.totalMarks}</TableCell>
                        <TableCell sx={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</TableCell>
                        <TableCell>
                          {row.failedCount === 0 ? (
                            <Typography sx={{ color: 'success.main', fontWeight: 'bold', fontSize: '0.85rem' }}>✓ উত্তীর্ণ (Passed)</Typography>
                          ) : (
                            <Box>
                              <Typography sx={{ color: 'error.main', fontWeight: 'bold', fontSize: '0.85rem' }}>✗ অনুত্তীর্ণ ({row.failedCount} বিষয়)</Typography>
                              <Typography variant="caption" display="block" sx={{ color: '#555', fontStyle: 'italic', lineHeight: 1.1 }}>
                                ফেল: {row.failedSubjects.join(', ')}
                              </Typography>
                            </Box>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ mt: 4, display: 'none', '@media print': { display: 'flex', justifyContent: 'space-between' } }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Box sx={{ borderTop: '1px solid #000', width: '150px', mt: 5 }} />
                  <Typography variant="caption">শ্রেণি শিক্ষকের স্বাক্ষর</Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Box sx={{ borderTop: '1px solid #000', width: '150px', mt: 5 }} />
                  <Typography variant="caption">প্রধান শিক্ষকের স্বাক্ষর</Typography>
                </Box>
              </Box>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default MeritListPage;
