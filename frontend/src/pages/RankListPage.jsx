import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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
  Stack
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { scopedGet } from '../utils/schoolApi';
import { useSchool } from '../context/SchoolContext';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InputGuidance from '../components/InputGuidance';

const EXAM_TYPE_LABELS = {
  'half_yearly': 'অর্ধবার্ষিক',
  'annual': 'বার্ষিক',
  'test': 'বিশেষ মূল্যায়ন',
  'model_test': 'মডেল টেস্ট',
  'pre_test': 'প্রাক-নির্বাচনী',
  'final': 'চূড়ান্ত পরীক্ষা'
};

const normalizeName = (s) => String(s || '').replace(/\u200c|\u200d/g, '').replace(/\s*\(.*?\)\s*/g, '').replace(/\s+/g, ' ').trim();

const canonicalSubjectName = (s) => {
  const n = normalizeName(s).toLowerCase();
  if (!n) return '';
  if (/(বাংলা|bangla|bengali).*(১ম|1st|first|i\b)/.test(n)) return 'bangla_1st';
  if (/(বাংলা|bangla|bengali).*(২য়|২য়|2nd|second|ii\b)/.test(n)) return 'bangla_2nd';
  if (/(english|ইংরেজি|ইংরেজী).*(১ম|1st|first|i\b)/.test(n)) return 'english_1st';
  if (/(english|ইংরেজি|ইংরেজী).*(২য়|২য়|2nd|second|ii\b)/.test(n)) return 'english_2nd';
  if (/(গণিত|গনিত|mathematics|math|general math)/.test(n)) return 'math';
  if (/(ict|আইসিটি|তথ্য\s*ও\s*(যোগাযোগ|যোগযোগ)\s*প্রযুক্তি)/i.test(n)) return 'ict';
  if (/(বাংলাদেশ\s*ও\s*বিশ্বপরিচয়|বাংলাদেশ\s*ও\s*বিশ্বপরিয়|bangladesh\s*and\s*global\s*studies|bgs)/i.test(n)) return 'bgs';
  if (/(বিজ্ঞান|science)/i.test(n)) return 'science';
  if (/(ধর্ম|religion|islam|hindu|buddhist|christian)/i.test(n)) return 'religion';
  if (/(কৃষি|agriculture)/i.test(n)) return 'agriculture';
  if (/(শারীরিক|physical)/i.test(n)) return 'physical_education';
  if (/(ব্যবসায়|business)/i.test(n)) return 'business_studies';
  if (/(পৌরনীতি|civics)/i.test(n)) return 'civics';
  if (/(অর্থনীতি|economics)/i.test(n)) return 'economics';
  if (/(ভূগোল|geography)/i.test(n)) return 'geography';
  if (/(ইতিহাস|history)/i.test(n)) return 'history';
  if (/(পদার্থ|physics)/i.test(n)) return 'physics';
  if (/(রসায়ন|রসায়ন|chemistry)/i.test(n)) return 'chemistry';
  if (/(জীববিজ্ঞান|biology)/i.test(n)) return 'biology';
  if (/(উচ্চতর\s*গণিত|উচ্চতর\s*গনিত|higher\s*math)/i.test(n)) return 'higher_math';
  if (/(হিসাব\s*বিজ্ঞান|accounting)/i.test(n)) return 'accounting';
  if (/(ফিন্যান্স|finance)/i.test(n)) return 'finance';
  return n;
};

const labelForCanonical = (can) => {
  const dict = {
    'bangla_1st': 'বাংলা ১ম', 'bangla_2nd': 'বাংলা ২য়', 'bangla': 'বাংলা', 'bangla_combined': 'বাংলা ১+২',
    'english_1st': 'ইংরেজি ১ম', 'english_2nd': 'ইংরেজি ২য়', 'english': 'ইংরেজি', 'english_combined': 'ইংরেজি ১+২',
    'math': 'গণিত', 'ict': 'আইসিটি', 'bgs': 'বিজিএস', 'science': 'বিজ্ঞান', 'religion': 'ধর্ম', 'agriculture': 'কৃষি',
    'physical_education': 'শারীরিক শিক্ষা', 'business_entrepreneurship': 'ব্যবসায় উদ্যোগ', 'business_studies': 'ব্যবসায় শিক্ষা',
    'civics': 'পৌরনীতি', 'economics': 'অর্থনীতি', 'geography': 'ভূগোল', 'history': 'ইতিহাস', 'physics': 'পদার্থ',
    'chemistry': 'রসায়ন', 'biology': 'জীববিজ্ঞান', 'higher_math': 'উচ্চতর গণিত', 'accounting': 'হিসাব বিজ্ঞান', 'finance': 'ফিন্যান্স'
  };
  return dict[can] || can;
};

const RankListPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { schoolId: contextSchoolId } = useSchool();
  const schoolId = contextSchoolId || id;
  const printRef = useRef(null);

  const [examinations, setExaminations] = useState([]);
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
  const [resultsByStudent, setResultsByStudent] = useState(new Map());
  const [activeStep, setActiveStep] = useState(0);

  const guidanceSteps = [
    { selector: '#ranklist-exam', text: 'পরীক্ষা নির্বাচন করুন', autoNext: false },
    { selector: '#ranklist-class', text: 'শ্রেণি নির্বাচন করুন', autoNext: false },
    { selector: '#ranklist-section', text: 'সেকশন নির্বাচন করুন', autoNext: false },
    { selector: '#show-button', text: 'এখানে ক্লিক করুন', autoNext: true }
  ];

  useEffect(() => {
    if (selectedExamType && activeStep === 0) setActiveStep(1);
    if (selectedClass && activeStep === 1) setActiveStep(2);
    if (selectedSection && activeStep === 2) setActiveStep(3);
    if (rankings.length > 0 && activeStep === 3) setActiveStep(4);
  }, [selectedExamType, selectedClass, selectedSection, rankings, activeStep]);

  useEffect(() => {
    document.title = "Rank List (মেধাক্রম)";
    if (!schoolId) return;
    scopedGet('/api/results/examinations/', schoolId, { page_size: 100 })
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        setExaminations(data);
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

  const normalizeExamType = (t, name = '') => {
    const n = String(name || '').toLowerCase();
    const type = String(t || '').toLowerCase();
    const combined = (n + ' ' + type).trim();

    // Specific logic for Class 10 Pre-Test mapping to Half Yearly
    const isTen = /দশম|ten|\b10\b/i.test(String(classrooms.find(c => String(c.id) === String(selectedClass))?.name || ''));
    if (isTen && (/প্রাক-নির্বাচনী|pre-test/i.test(combined))) {
        return 'half_yearly';
    }

    if (/বার্ষিক|annual|yearly|final/.test(combined)) return 'annual';
    if (/অর্ধ|half|mid|semi/.test(combined)) return 'half_yearly';
    if (/টার্মিনাল|terminal|term/.test(combined)) return 'terminal';
    if (/মডেল|model/.test(combined)) return 'model';
    if (/টেস্ট|test|monthly|নির্বাচনী/.test(combined)) return 'test';
    if (/pre-test|প্রাক-নির্বাচনী/.test(combined)) return 'pre_test';
    return type || 'annual';
  };

  const handleFetchRankings = () => {
    if (!selectedExamType || !selectedClass) return;
    setLoading(true);
    setErrorMessage('');
    setRankings([]);
    setResultsByStudent(new Map());

    const selYearStr = String(selectedYear);
    const selTypeNorm = normalizeExamType(selectedExamType);

    // 1. Get candidate examinations
    const matchingExams = examinations.filter(e => {
        const examType = e.exam_type || '';
        const examName = e.name || '';
        const exYear = String(e.year || e.academic_year || '');
        const yearMatch = !exYear || exYear === selYearStr || examName.includes(selYearStr);
        return yearMatch && normalizeExamType(examType, examName) === selTypeNorm;
    });

    if (matchingExams.length === 0) {
        setErrorMessage(`দুঃখিত ${selectedYear} সালের ${EXAM_TYPE_LABELS[selectedExamType] || selectedExamType} রেজাল্ট অত্র বিদ্যালয়ে এখনও ইনপুট দেওয়া হয়নি।`);
        setLoading(false);
        return;
    }

    // 2. Fetch all results with pagination
    (async () => {
        try {
            let allItems = [];
            let page = 1;
            let hasNext = true;

            while (hasNext && page <= 25) {
                const resultsParams = {
                    classroom: selectedClass,
                    page: page,
                    page_size: 500
                };
                if (selectedSection) resultsParams.section = selectedSection;
                if (selectedYear) resultsParams.year = selectedYear;

                const rResp = await scopedGet('/api/results/results/', schoolId, resultsParams, { timeout: 60000 });
                const data = rResp.data;
                let items = Array.isArray(data) ? data : (data.results || []);

                if (items.length === 0 && page === 1 && selectedYear) {
                    const fallbackParams = { ...resultsParams };
                    delete fallbackParams.year;
                    const fRes = await scopedGet('/api/results/results/', schoolId, fallbackParams, { timeout: 60000 });
                    items = Array.isArray(fRes.data) ? fRes.data : (fRes.data?.results || []);
                }

                if (items.length === 0) break;

                const filtered = items.filter(r => {
                    const exObj = typeof r.examination === 'object' ? r.examination : null;
                    const exYear = String(exObj?.year || exObj?.academic_year || r.year || '');
                    const exName = exObj?.name || r.examination_name || '';
                    if (selYearStr && exYear && exYear !== selYearStr && !exName.includes(selYearStr)) return false;
                    const examType = exObj?.exam_type || r.examination_type || '';
                    return normalizeExamType(examType, exName) === selTypeNorm;
                });

                allItems = allItems.concat(filtered);
                if (data.next && page < 25) {
                    page++;
                    await new Promise(resolve => setTimeout(resolve, 200));
                } else hasNext = false;
            }

            const byStu = new Map();
            const studentsSet = new Map();

            for (const r of allItems) {
                const sid = String(r.student?.id ?? r.student_id ?? r.student ?? '');
                if (!sid || sid === 'undefined') continue;
                if (!byStu.has(sid)) byStu.set(sid, []);
                byStu.get(sid).push(r);
                if (!studentsSet.has(sid)) studentsSet.set(sid, r.student);
            }

            setResultsByStudent(byStu);

            const computedRankings = [];
            for (const [sid, results] of byStu.entries()) {
                const student = studentsSet.get(sid);
                let totalObtained = 0;
                let failedCount = 0;
                const subMap = new Map();
                for (const r of results) {
                    const sn = String(r.subject?.name || r.subject_name || '').toLowerCase().trim();
                    const recordDate = new Date(r.updated_at || r.created_at || 0).getTime();
                    if (!subMap.has(sn) || recordDate > subMap.get(sn).date) {
                        subMap.set(sn, { record: r, date: recordDate });
                    }
                }
                for (const entry of subMap.values()) {
                    const r = entry.record;
                    const w = parseFloat(r.written_marks) || 0;
                    const m = parseFloat(r.mcq_marks) || 0;
                    const p = parseFloat(r.practical_marks) || 0;
                    totalObtained += (w + m + p);
                    if (r.grade === 'F' || r.is_passed === false) failedCount++;
                }
                let sName = 'Other';
                if (student?.section?.name) sName = student.section.name;
                else if (selectedSection) {
                    const secObj = sections.find(s => String(s.id) === String(selectedSection));
                    if (secObj) sName = secObj.name;
                }

                computedRankings.push({
                    student,
                    total_marks_obtained: Math.round(totalObtained),
                    failed_subjects_count: failedCount,
                    section_id: String(student?.section?.id || student?.section || selectedSection || 'other'),
                    section_name: sName,
                    _sid: sid
                });
            }

            // Section-wise Ranking logic
            // 1. Group by section
            const bySection = new Map();
            computedRankings.forEach(item => {
                if (!bySection.has(item.section_id)) bySection.set(item.section_id, []);
                bySection.get(item.section_id).push(item);
            });

            const finalRankings = [];
            for (const sectionItems of bySection.values()) {
                // 2. Sort within section
                sectionItems.sort((a, b) => {
                    if (a.is_absent !== b.is_absent) return a.is_absent ? 1 : -1;
                    const aPassed = (a.failed_subjects_count === 0);
                    const bPassed = (b.failed_subjects_count === 0);
                    if (aPassed !== bPassed) return aPassed ? -1 : 1;

                    if (aPassed && bPassed) {
                        if (Math.abs((b.cgpa || 0) - (a.cgpa || 0)) > 0.0001) return (b.cgpa || 0) - (a.cgpa || 0);
                        if (Math.abs((b.total_marks_obtained || 0) - (a.total_marks_obtained || 0)) > 0.01) return (b.total_marks_obtained || 0) - (a.total_marks_obtained || 0);
                        const ar = parseInt(String(a.student?.roll_number || '').replace(/\D/g, ''), 10) || 0;
                        const br = parseInt(String(b.student?.roll_number || '').replace(/\D/g, ''), 10) || 0;
                        return ar - br;
                    }

                    if (a.failed_subjects_count !== b.failed_subjects_count) return a.failed_subjects_count - b.failed_subjects_count;
                    if (Math.abs((b.total_marks_obtained || 0) - (a.total_marks_obtained || 0)) > 0.01) return (b.total_marks_obtained || 0) - (a.total_marks_obtained || 0);
                    const ar = parseInt(String(a.student?.roll_number || '').replace(/\D/g, ''), 10) || 0;
                    const br = parseInt(String(b.student?.roll_number || '').replace(/\D/g, ''), 10) || 0;
                    return ar - br;
                });

                // 3. Assign unique ranks per section based on sort order (Tie-break by Roll)
                for (let i = 0; i < sectionItems.length; i++) {
                    sectionItems[i]._new_roll = i + 1;
                    finalRankings.push(sectionItems[i]);
                }
            }

            // Finally, sort the display list by Section then by Rank
            finalRankings.sort((a, b) => {
                const sComp = (a.section_name || '').localeCompare(b.section_name || '');
                if (sComp !== 0) return sComp;
                return a._new_roll - b._new_roll;
            });

            setRankings(finalRankings);
        } catch (err) {
            console.error("Aggregation error:", err);
            setErrorMessage('ডাটা প্রসেস করতে সমস্যা হয়েছে');
        } finally {
            setLoading(false);
        }
    })();
  };

  const isNineTen = React.useMemo(() => {
    const cls = classrooms.find(c => String(c.id) === String(selectedClass));
    const name = String(cls?.name || '').toLowerCase();
    return /নবম|দশম|class\s*9|class\s*10|\b9\b|\b10\b/.test(name);
  }, [classrooms, selectedClass]);

  const displaySubjects = React.useMemo(() => {
    const set = new Set();
    resultsByStudent.forEach(results => {
      results.forEach(r => {
        const can = canonicalSubjectName(r?.subject?.name || r?.subject_name || '');
        if (can) set.add(can);
      });
    });
    const hasB1 = set.has('bangla_1st'), hasB2 = set.has('bangla_2nd');
    const hasE1 = set.has('english_1st'), hasE2 = set.has('english_2nd');
    if (hasB1 || hasB2) { set.delete('bangla'); if (isNineTen) { set.delete('bangla_1st'); set.delete('bangla_2nd'); set.add('bangla_combined'); } }
    if (hasE1 || hasE2) { set.delete('english'); if (isNineTen) { set.delete('english_1st'); set.delete('english_2nd'); set.add('english_combined'); } }
    
    const order = ['bangla_combined','bangla_1st','bangla_2nd','bangla','english_combined','english_1st','english_2nd','english','math','science','bgs','ict','religion','agriculture','physics','chemistry','biology','higher_math','history','geography','civics','economics','accounting','finance','business_studies'];
    return Array.from(set).sort((a, b) => (order.indexOf(a) === -1 ? 999 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 999 : order.indexOf(b)))
      .map(can => ({ canonical: can, label: labelForCanonical(can) }));
  }, [resultsByStudent, isNineTen]);

  const getStudentResultsMap = (sid) => {
    const arr = resultsByStudent.get(String(sid)) || [];
    const m = new Map();
    arr.forEach(r => {
      const nm = r?.subject?.name || r?.subject_name || '';
      const key = canonicalSubjectName(nm);
      const total = parseFloat(r.total_obtained) || (parseFloat(r.written_marks)||0) + (parseFloat(r.mcq_marks)||0) + (parseFloat(r.practical_marks)||0);
      m.set(key, { total, grade: r.grade, is_passed: r.is_passed });
    });
    return m;
  };

  const resolveSubjectScore = (sid, canonical, map) => {
    if (canonical === 'bangla_combined') return (map.get('bangla_1st')?.total || 0) + (map.get('bangla_2nd')?.total || 0);
    if (canonical === 'english_combined') return (map.get('english_1st')?.total || 0) + (map.get('english_2nd')?.total || 0);
    return map.get(canonical)?.total;
  };

  const handlePrint = () => { window.print(); };

  const downloadPDF = async () => {
    const canvas = await html2canvas(printRef.current, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('l', 'mm', 'a4');
    pdf.addImage(imgData, 'PNG', 0, 0, 297, (canvas.height * 297) / canvas.width);
    pdf.save(`merit-list-${selectedYear}.pdf`);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box className="no-print">
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', fontFamily: "'Hind Siliguri', sans-serif" }}>Rank List (মেধাক্রম)</Typography>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>ব্যাক</Button>
        </Stack>
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel id="ranklist-exam-label">Examination</InputLabel>
                <Select labelId="ranklist-exam-label" id="ranklist-exam" value={selectedExamType} label="Examination" onChange={(e) => setSelectedExamType(e.target.value)}>
                  <MenuItem value=""><em>Select</em></MenuItem>
                  {examTypes.map(t => <MenuItem key={t} value={t}>{EXAM_TYPE_LABELS[t] || t}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel id="ranklist-class-label">Class</InputLabel>
                <Select labelId="ranklist-class-label" id="ranklist-class" value={selectedClass} label="Class" onChange={(e) => setSelectedClass(e.target.value)}>
                  {classrooms.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <FormControl fullWidth>
                <InputLabel id="ranklist-year-label">Year</InputLabel>
                <Select value={String(selectedYear)} label="Year" onChange={(e) => setSelectedYear(e.target.value)}>
                  {[2024, 2025, 2026].map(y => <MenuItem key={y} value={String(y)}>{y}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button id="show-button" variant="contained" onClick={handleFetchRankings} disabled={!selectedExamType || !selectedClass || loading} fullWidth>Show</Button>
            </Grid>
          </Grid>
        </Paper>
      </Box>

      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box> : (
        <>
          {errorMessage && <Paper sx={{ p: 2, mb: 2 }}><Typography color="error">{errorMessage}</Typography></Paper>}
          {rankings.length > 0 && (
            <>
              <Stack direction="row" spacing={2} sx={{ mb: 2 }} className="no-print">
                <Button variant="contained" startIcon={<DownloadIcon />} onClick={downloadPDF}>Download PDF</Button>
                <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>Print</Button>
              </Stack>
              <TableContainer component={Paper} ref={printRef} sx={{ p: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>Roll</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Section</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Total Marks</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Failed</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Merit</TableCell>
                      {displaySubjects.map(s => <TableCell key={s.canonical} align="center" sx={{ fontWeight: 'bold' }}>{s.label}</TableCell>)}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rankings.map((row, idx) => {
                      const map = getStudentResultsMap(row._sid);
                      return (
                        <TableRow key={row._sid}>
                          <TableCell>{row.student?.roll_number}</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>{row.student?.display_name || row.student?.user?.first_name}</TableCell>
                          <TableCell>{row.section_name}</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>{row.total_marks_obtained}</TableCell>
                          <TableCell sx={{ color: row.failed_subjects_count > 0 ? 'red' : 'inherit' }}>{row.failed_subjects_count}</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{row._new_roll}</TableCell>
                          {displaySubjects.map(s => {
                            const score = resolveSubjectScore(row._sid, s.canonical, map);
                            return <TableCell key={s.canonical} align="center">{score ?? '—'}</TableCell>;
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </>
      )}
      <InputGuidance steps={guidanceSteps} activeStep={activeStep} onStepComplete={() => setActiveStep(prev => prev + 1)} />
    </Box>
  );
};

export default RankListPage;
