import React, { useMemo } from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Grid } from '@mui/material';
import './ResultCard.css';
import ImageWithFallback from './ImageWithFallback';
import api from '../utils/api';
import fallbackLogo from './fallback_logo.png';
import { getMediaUrl } from '../utils/media';

export default function ResultCard({ studentData, results: rawResults, overallResult, examination, school, schoolId }) {
  const student = studentData?.student || {};
  const user = student.user || {};
  const studentName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
  const guardianName = (
    (student.guardian ? `${student.guardian.first_name || ''} ${student.guardian.last_name || ''}`.trim() : '') ||
    student.guardian_name || student.parent_name || student.father_name || student.mother_name ||
    user.guardian_name || user.parent_name || ''
  );

  const [resolvedSchool, setResolvedSchool] = React.useState(school || null);

  // --- 1. CLASSIFICATION LOGIC ---
  const isClassNineOrTen = useMemo(() => {
    try {
      const sources = [student?.classroom?.name, examination?.classroom?.name, examination?.name, student?.classroom?.display_name].filter(Boolean).map(s => String(s).toLowerCase());
      const text = sources.join(' ');
      return /নবম|দশম|ssc|\b9\b|\b10\b|\bnine\b|\bten\b|\bix\b|\bx\b|class\s*9|class\s*10/.test(text);
    } catch (_) { return false; }
  }, [student, examination]);

  const isCoCurricular = (name) => {
    const n = String(name || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
    const baseList = ['শারীরিক শিক্ষা ও স্বাস্থ্য', 'শারীরিক শিক্ষা', 'Physical Education', 'Physical Education and Health', 'ক্যারিয়ার শিক্ষা', 'ক্যারিয়ার শিক্ষা', 'Career Education', 'ক্যারিয়ার', 'ক্যারিয়ার', 'Word Collection Achievement Test', 'WCAT', 'বই পড়া', 'বই পড়া', 'চারু ও কারুকলা', 'Arts and Crafts'];

    if (!isClassNineOrTen) {
      if (n.includes('কৃষি') || n.includes('agriculture') || n.includes('গার্হস্থ্য') || n.includes('home economics')) {
        return true;
      }
    }
    return baseList.some(sub => n.includes(sub.toLowerCase()));
  };

  const isOptionalSubject = (r) => {
    if (!r) return false;
    const sname = String(r.subject?.name || r.subject_name || '').toLowerCase();
    const optId = student.optional_subject?.id || student.optional_subject;
    if (optId && String(optId) === String(r.subject?.id || r.subject)) return true;
    const optSubName = String(student.optional_subject?.name || '').toLowerCase();
    if (optSubName && sname.includes(optSubName)) return true;
    const isNineTenAgri = isClassNineOrTen && (sname.includes('কৃষি') || sname.includes('গার্হস্থ্য'));
    return sname.includes('optional') || sname.includes('ঐচ্ছিক') || sname.includes('fourth') || sname.includes('৪র্থ') || sname.includes('উচ্চতর') || isNineTenAgri;
  };

  const getSubjectMaxima = (name) => {
    const lower = String(name || '').toLowerCase();
    if (lower.includes('ict') || lower.includes('তথ্য')) return isClassNineOrTen ? { cq: 0, mcq: 25, pr: 25 } : { cq: 10, mcq: 15, pr: 25 };
    if (isClassNineOrTen) {
      if (lower.includes('পদার্থ') || lower.includes('physics') || lower.includes('রসায়ন') || lower.includes('রসায়ন') || lower.includes('chemistry') || lower.includes('জীব') || lower.includes('biology') || lower.includes('উচ্চতর')) return { cq: 50, mcq: 25, pr: 25 };
      if (lower.includes('কৃষি') || lower.includes('agriculture') || lower.includes('গার্হস্থ্য') || lower.includes('home economics')) return { cq: 50, mcq: 25, pr: 25 };
      if (lower.includes('বাংলা') || lower.includes('bangla')) return { cq: 70, mcq: 30, pr: 0 };
      if (lower.includes('english') || lower.includes('ইংরেজি') || lower.includes('ইংরেজী')) return { cq: 100, mcq: 0, pr: 0 };
    } else {
      if (lower.includes('কৃষি') || lower.includes('agriculture') || lower.includes('গার্হস্থ্য') || lower.includes('home economics')) return { cq: 35, mcq: 15, pr: 0 };
      if ((lower.includes('বাংলা') || lower.includes('bangla')) && (lower.includes('২য়') || lower.includes('২য়') || lower.includes('2nd') || lower.includes('second'))) return { cq: 35, mcq: 15, pr: 0 };
      if ((lower.includes('english') || lower.includes('ইংরেজি') || lower.includes('ইংরেজী')) && (lower.includes('২য়') || lower.includes('২য়') || lower.includes('2nd') || lower.includes('second'))) return { cq: 50, mcq: 0, pr: 0 };
      if (lower.includes('ধর্ম') || lower.includes('religion') || lower.includes('ইসলাম') || lower.includes('হিন্দ')) return { cq: 70, mcq: 30, pr: 0 };
    }
    return { cq: 70, mcq: 30, pr: 0 };
  };

  const computeGrade = (pct) => {
    if (pct >= 80) return 'A+'; if (pct >= 70) return 'A'; if (pct >= 60) return 'A-';
    if (pct >= 50) return 'B'; if (pct >= 40) return 'C'; if (pct >= 33) return 'D';
    return 'F';
  };

  const computeGpa = (pct) => {
    if (pct >= 80) return 5.0; if (pct >= 70) return 4.0; if (pct >= 60) return 3.5;
    if (pct >= 50) return 3.0; if (pct >= 40) return 2.0; if (pct >= 33) return 1.0;
    return 0.0;
  };

  const getGradeFromCgpa = (v) => {
    const val = parseFloat(v);
    if (val >= 5.0) return 'A+'; if (val >= 4.0) return 'A'; if (val >= 3.5) return 'A-';
    if (val >= 3.0) return 'B'; if (val >= 2.0) return 'C'; if (val >= 1.0) return 'D';
    return 'F';
  };

  const allRecalculated = useMemo(() => {
    if (!Array.isArray(rawResults)) return [];
    return rawResults.map(r => {
      const w = parseFloat(r.written_marks) || 0;
      const m = parseFloat(r.mcq_marks) || 0;
      const p = parseFloat(r.practical_marks) || 0;
      const spec = getSubjectMaxima(r.subject?.name || r.subject_name);
      const totalPossible = spec.cq + spec.mcq + spec.pr || 100;
      const obtained = w + m + p;
      const percentage = (obtained / totalPossible) * 100;
      const passThreshold = Math.round(totalPossible * 0.33);
      let isPassed = obtained >= passThreshold;
      if (isClassNineOrTen && !isCoCurricular(r.subject?.name || r.subject_name) && !isOptionalSubject(r)) {
        if (spec.cq > 0 && w < Math.round(spec.cq * 0.33)) isPassed = false;
        if (spec.mcq > 0 && m < Math.round(spec.mcq * 0.33)) isPassed = false;
        if (spec.pr > 0 && p < Math.round(spec.pr * 0.33)) isPassed = false;
      }
      return { ...r, total_obtained: obtained, total_possible: totalPossible, grade: isPassed ? computeGrade(percentage) : 'F', gpa: isPassed ? computeGpa(percentage).toFixed(2) : '0.00', is_passed: isPassed };
    });
  }, [rawResults, isClassNineOrTen]);

  const displayResults = useMemo(() => {
    let mainResults = allRecalculated.filter(r => !isCoCurricular(r.subject?.name || r.subject_name) && !isOptionalSubject(r));
    let optionalResults = allRecalculated.filter(isOptionalSubject);
    let coCurricularResults = allRecalculated.filter(r => isCoCurricular(r.subject?.name || r.subject_name));

    if (isClassNineOrTen) {
      const merged = [];
      const handledSubjectIds = new Set();
      const papers = {
        bangla: mainResults.filter(r => { const n = String(r.subject?.name || r.subject_name || '').toLowerCase(); return (n.includes('বাংলা') || n.includes('bangla')) && !n.includes('বাংলাদেশ'); }),
        english: mainResults.filter(r => { const n = String(r.subject?.name || r.subject_name || '').toLowerCase(); return n.includes('english') || n.includes('ইংরেজি') || n.includes('ইংরেজী'); })
      };

      if (papers.bangla.length > 0) {
        const sumObtained = papers.bangla.reduce((s, r) => s + r.total_obtained, 0);
        const totalPossible = papers.bangla.reduce((s, r) => s + r.total_possible, 0);
        const allPassed = papers.bangla.every(r => r.is_passed);
        const firstName = String(papers.bangla[0]?.subject?.name || papers.bangla[0]?.subject_name || '').toLowerCase();
        const mergedName = firstName.includes('bangla') ? 'Bangla (1st + 2nd)' : 'বাংলা (১ম + ২য়)';
        merged.push({ id: 'merged-bangla', subject: { name: mergedName }, written_marks: papers.bangla.map(r => r.written_marks).join(' + '), mcq_marks: papers.bangla.map(r => r.mcq_marks).join(' + '), practical_marks: '--', total_obtained: sumObtained, total_possible: totalPossible, grade: allPassed ? computeGrade((sumObtained/totalPossible)*100) : 'F', gpa: allPassed ? computeGpa((sumObtained/totalPossible)*100).toFixed(2) : '0.00', is_passed: allPassed });
        papers.bangla.forEach(r => handledSubjectIds.add(r.subject?.id || r.subject));
      }
      if (papers.english.length > 0) {
        const sumObtained = papers.english.reduce((s, r) => s + r.total_obtained, 0);
        const totalPossible = papers.english.reduce((s, r) => s + r.total_possible, 0);
        const allPassed = papers.english.every(r => r.is_passed);
        const firstName = String(papers.english[0]?.subject?.name || papers.english[0]?.subject_name || '').toLowerCase();
        const mergedName = firstName.includes('english') ? 'English (1st + 2nd)' : 'ইংরেজি (১ম + ২য়)';
        merged.push({ id: 'merged-english', subject: { name: mergedName }, written_marks: papers.english.map(r => r.total_obtained).join(' + '), mcq_marks: '--', practical_marks: '--', total_obtained: sumObtained, total_possible: totalPossible, grade: allPassed ? computeGrade((sumObtained/totalPossible)*100) : 'F', gpa: allPassed ? computeGpa((sumObtained/totalPossible)*100).toFixed(2) : '0.00', is_passed: allPassed });
        papers.english.forEach(r => handledSubjectIds.add(r.subject?.id || r.subject));
      }
      mainResults.forEach(r => {
        const sid = r.subject?.id || r.subject;
        if (!handledSubjectIds.has(sid)) merged.push(r);
      });
      return { main: [...merged, ...optionalResults], coCurricular: coCurricularResults };
    }
    return { main: [...mainResults, ...optionalResults], coCurricular: coCurricularResults };
  }, [allRecalculated, isClassNineOrTen]);

  const finalSummary = useMemo(() => {
    let totalObtained = 0, totalPossible = 0, sumGpa = 0, count = 0, hasFail = false;
    displayResults.main.forEach(r => {
      if (isOptionalSubject(r)) return;
      totalObtained += r.total_obtained; totalPossible += r.total_possible;
      const gpa = parseFloat(r.gpa);
      if (gpa === 0) hasFail = true;
      sumGpa += gpa; count++;
    });
    const opt = allRecalculated.find(isOptionalSubject);
    let bonus = 0;
    if (opt) {
      const optGpa = parseFloat(opt.gpa);
      bonus = Math.max(0, optGpa - 2.0);
      const optObtained = opt.total_obtained;
      const optThreshold = opt.total_possible * 0.4;
      if (optObtained > optThreshold) totalObtained += (optObtained - optThreshold);
    }
    const cgpa = (count > 0 && !hasFail) ? Math.min(5.0, (sumGpa + bonus) / count) : 0;
    const finalCgpaStr = cgpa.toFixed(2);
    return { obtained: Math.round(totalObtained), possible: Math.round(totalPossible), cgpa: finalCgpaStr, isPassed: !hasFail && count > 0, grade: getGradeFromCgpa(finalCgpaStr) };
  }, [displayResults.main, allRecalculated]);

  const toBn = (v) => String(v ?? '').replace(/[0-9]/g, d => ['০','১','২','৩','৪','৫','৬','৭','৮','৯'][d]);
  const formatMark = (val) => (val === null || val === undefined || val === '' || val === 0 || val === '0' || val === '--') ? '--' : val;
  const getGradeColor = (g) => { const map = { 'A+': '#1b5e20', 'A': '#2e7d32', 'A-': '#4caf50', 'B': '#f9a825', 'C': '#ef6c00', 'D': '#d84315', 'F': '#c62828' }; return map[g] || '#757575'; };

  const studentGroupEn = useMemo(() => {
    const g = String(student.student_group || student.group || '').toLowerCase();
    if (g === 'science') return 'Science';
    if (g === 'arts') return 'Humanities';
    if (g === 'commerce') return 'Business Studies';
    return '';
  }, [student]);

  React.useEffect(() => { if (school && !resolvedSchool) setResolvedSchool(school); }, [school, resolvedSchool]);
  const logoUrl = getMediaUrl(resolvedSchool?.logo || fallbackLogo);
  const studentPhotoUrl = getMediaUrl(user?.photo || user?.photo_url);

  return (
    <Box className="result-card-container" sx={{
      maxWidth: 900, mx: 'auto', bgcolor: 'white', p: 1.5, position: 'relative', overflow: 'visible',
      border: 'none !important', boxShadow: 'none !important', outline: 'none !important'
    }}>
      <Box sx={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', opacity: 0.22, zIndex: 0, pointerEvents: 'none', display: 'flex', justifyContent: 'center' }}><img src={logoUrl} alt="" style={{ width: '100%', maxWidth: '550px' }} /></Box>
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 1.5, mt: 0.5, minHeight: '125px', overflow: 'visible' }}>
          <Box sx={{ width: '120px', height: '120px', flexShrink: 0, display: 'flex', alignItems: 'center' }}><ImageWithFallback src={logoUrl} alt="Logo" width="100%" height="auto" /></Box>
          <Box sx={{ flexGrow: 1, textAlign: 'center', minWidth: 0, px: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 900, color: '#1a237e !important', fontSize: (resolvedSchool?.name?.length > 50) ? '1.2rem' : (resolvedSchool?.name?.length > 35) ? '1.4rem' : '1.8rem', mb: 0.1, lineHeight: 1.6, pt: 0.8, pb: 0.4, display: 'block', wordWrap: 'break-word', overflow: 'visible', WebkitPrintColorAdjust: 'exact' }}>{resolvedSchool?.name || "BD School"}</Typography>
            {resolvedSchool?.ein && (<Typography sx={{ fontSize: '12px', color: '#1a237e !important', fontWeight: 'bold', mt: -0.2, WebkitPrintColorAdjust: 'exact' }}>EIIN: {resolvedSchool.ein}</Typography>)}
            <Typography variant="h6" sx={{ color: '#5c6bc0 !important', fontSize: '12px', lineHeight: 1.1, WebkitPrintColorAdjust: 'exact' }}>{resolvedSchool?.address || "" }</Typography>
            <Box sx={{ mt: 1, mx: 'auto', width: 'fit-content', px: 3, py: 0.5, borderRadius: '50px', bgcolor: '#1a237e !important', color: 'white !important', whiteSpace: 'nowrap', WebkitPrintColorAdjust: 'exact' }}><Typography sx={{ fontWeight: 'bold', fontSize: '14px' }}>ACADEMIC RESULT CARD</Typography></Box>
          </Box>
          <Box sx={{ width: '120px', height: '120px', border: '2.5px solid #1a237e', borderRadius: 1.5, overflow: 'hidden', flexShrink: 0 }}><ImageWithFallback src={studentPhotoUrl} alt="Student" width="100%" height="100%" /></Box>
        </Box>
        <Grid container spacing={1} sx={{ mb: 1, mt: 1, bgcolor: '#f8f9fa !important', p: 1.5, borderRadius: 2, borderLeft: '6px solid #1a237e', WebkitPrintColorAdjust: 'exact' }}>
          <Grid item xs={12} sm={6}><Typography sx={{ color: 'black !important' }}><strong>Student Name:</strong> {studentName}</Typography></Grid>
          <Grid item xs={6} sm={3}><Typography sx={{ color: 'black !important' }}><strong>Roll No:</strong> {student.roll_number}</Typography></Grid>
          <Grid item xs={6} sm={3}><Typography sx={{ color: 'black !important' }}><strong>Class:</strong> {student.classroom?.name} {student.section?.name ? `(${student.section.name})` : ''} {studentGroupEn ? `| ${studentGroupEn}` : ''}</Typography></Grid>
          <Grid item xs={12} sm={6}><Typography sx={{ color: 'black !important' }}><strong>Examination:</strong> {examination?.academic_year} {examination?.name}</Typography></Grid>
          <Grid item xs={12} sm={6}><Typography sx={{ color: 'black !important' }}><strong>Guardian:</strong> {guardianName}</Typography></Grid>
        </Grid>
        <TableContainer component={Paper} elevation={0} sx={{ mb: 1, border: '1.5px solid #1a237e', bgcolor: 'transparent', boxShadow: 'none' }}>
          <Table size="small" sx={{ bgcolor: 'transparent', tableLayout: 'fixed' }}>
            <colgroup><col style={{ width: '36%' }} /><col style={{ width: '12%' }} /><col style={{ width: '12%' }} /><col style={{ width: '8%' }} /><col style={{ width: '10%' }} /><col style={{ width: '11%' }} /><col style={{ width: '11%' }} /></colgroup>
            <TableHead>
              <TableRow sx={{ bgcolor: '#1a237e !important', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                <TableCell sx={{ color: 'white !important', fontWeight: 'bold', bgcolor: '#1a237e !important', WebkitPrintColorAdjust: 'exact' }}>SUBJECT NAME</TableCell>
                <TableCell align="center" sx={{ color: 'white !important', fontWeight: 'bold', bgcolor: '#1a237e !important', WebkitPrintColorAdjust: 'exact' }}>CQ</TableCell>
                <TableCell align="center" sx={{ color: 'white !important', fontWeight: 'bold', bgcolor: '#1a237e !important', WebkitPrintColorAdjust: 'exact' }}>MCQ</TableCell>
                <TableCell align="center" sx={{ color: 'white !important', fontWeight: 'bold', bgcolor: '#1a237e !important', WebkitPrintColorAdjust: 'exact' }}>PRAC</TableCell>
                <TableCell align="center" sx={{ color: 'white !important', fontWeight: 'bold', bgcolor: '#1a237e !important', WebkitPrintColorAdjust: 'exact' }}>TOTAL</TableCell>
                <TableCell align="center" sx={{ color: 'white !important', fontWeight: 'bold', bgcolor: '#1a237e !important', WebkitPrintColorAdjust: 'exact' }}>GRADE</TableCell>
                <TableCell align="center" sx={{ color: 'white !important', fontWeight: 'bold', bgcolor: '#1a237e !important', WebkitPrintColorAdjust: 'exact' }}>GPA</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayResults.main.map((r, idx) => (
                <TableRow key={r.id || idx} sx={{ bgcolor: isOptionalSubject(r) ? 'rgba(255, 249, 196, 0.6) !important' : (idx % 2 ? 'rgba(0, 0, 0, 0.03) !important' : 'transparent'), WebkitPrintColorAdjust: 'exact', '& td': { borderBottom: '1px solid #1a237e' } }}>
                  <TableCell sx={{ fontWeight: 600, py: 0.5 }}>{isOptionalSubject(r) ? `(Optional) ${r.subject?.name || r.subject_name}` : (r.subject?.name || r.subject_name)}</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}><strong>{formatMark(r.written_marks)}</strong></TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}><strong>{formatMark(r.mcq_marks)}</strong></TableCell>
                  <TableCell align="center"><strong>{formatMark(r.practical_marks)}</strong></TableCell>
                  <TableCell align="center"><strong>{r.total_obtained}</strong></TableCell>
                  <TableCell align="center"><Box sx={{ bgcolor: getGradeColor(r.grade), color: 'white !important', fontWeight: 'bold', borderRadius: '10px', px: 1, fontSize: '11px', display: 'inline-block', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{r.grade}</Box></TableCell>
                  <TableCell align="center"><strong>{r.gpa}</strong></TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ bgcolor: 'rgba(232, 234, 246, 0.7) !important', WebkitPrintColorAdjust: 'exact', fontWeight: 'bold', '& td': { borderTop: '2px solid #1a237e' } }}>
                <TableCell colSpan={4} sx={{ color: '#1a237e !important' }}>TOTAL MARKS / OVERALL RESULT</TableCell>
                <TableCell align="center" sx={{ color: '#1a237e !important' }}><strong>{finalSummary.obtained} / {finalSummary.possible}</strong></TableCell>
                <TableCell align="center"><Box sx={{ bgcolor: getGradeColor(finalSummary.isPassed ? finalSummary.grade : 'F'), color: 'white !important', fontWeight: 900, borderRadius: '16px', px: 2, py: 0.5, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{finalSummary.isPassed ? finalSummary.grade : 'F'}</Box></TableCell>
                <TableCell align="center" sx={{ color: '#1a237e !important' }}><strong>{finalSummary.cgpa}</strong></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        {displayResults.coCurricular.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1a237e !important', mb: 0.5, pl: 1, borderLeft: '4px solid #1a237e' }}>CONTINUOUS ASSESSMENT (ধারাবাহিক মূল্যায়ন)</Typography>
            <TableContainer component={Paper} elevation={0} sx={{ border: '1.5px solid #1a237e', bgcolor: 'transparent', boxShadow: 'none' }}>
              <Table size="small" sx={{ bgcolor: 'transparent', tableLayout: 'fixed' }}>
                <colgroup><col style={{ width: '36%' }} /><col style={{ width: '12%' }} /><col style={{ width: '12%' }} /><col style={{ width: '8%' }} /><col style={{ width: '10%' }} /><col style={{ width: '11%' }} /><col style={{ width: '11%' }} /></colgroup>
                <TableBody>
                  {displayResults.coCurricular.map((r, idx) => (
                    <TableRow key={r.id || idx} sx={{ bgcolor: idx % 2 ? 'rgba(0, 0, 0, 0.03) !important' : 'transparent', WebkitPrintColorAdjust: 'exact', '& td': { borderBottom: '1px solid #1a237e' } }}>
                      <TableCell sx={{ fontWeight: 600, py: 0.5 }}>{r.subject?.name || r.subject_name}</TableCell>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{formatMark(r.written_marks)}</TableCell>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{formatMark(r.mcq_marks)}</TableCell>
                      <TableCell align="center">{formatMark(r.practical_marks)}</TableCell>
                      <TableCell align="center"><strong>{r.total_obtained}</strong></TableCell>
                      <TableCell align="center"><Box sx={{ bgcolor: getGradeColor(r.grade), color: 'white !important', fontWeight: 'bold', borderRadius: '10px', px: 1, fontSize: '11px', display: 'inline-block', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{r.grade}</Box></TableCell>
                      <TableCell align="center"><strong>{r.gpa}</strong></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
        <Box sx={{ p: 1, borderRadius: 2, border: '1.5px solid #1a237e' }}>
          <Grid container spacing={1} textAlign="center">
            <Grid item xs={4}><Typography variant="overline">Final Status</Typography><Typography variant="h6" sx={{ color: finalSummary.isPassed ? '#2e7d32' : '#d32f2f', fontWeight: 900, border: '2px solid', borderRadius: 1.5 }}>{finalSummary.isPassed ? '✓ PASSED' : '✗ FAILED'}</Typography></Grid>
            <Grid item xs={4}><Typography variant="overline">Overall GPA</Typography><Typography variant="h6" sx={{ color: '#1a237e', fontWeight: 900 }}>{finalSummary.cgpa}</Typography></Grid>
            <Grid item xs={4}><Typography variant="overline">Letter Grade</Typography><Typography variant="h6" sx={{ color: getGradeColor(finalSummary.isPassed ? finalSummary.grade : 'F'), fontWeight: 900 }}>{finalSummary.isPassed ? finalSummary.grade : 'F'}</Typography></Grid>
          </Grid>
        </Box>
        <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', pl: 4, pr: 1, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <Box sx={{ textAlign: 'center', width: '150px' }}><Box sx={{ height: '30px', mb: 0.2 }} /><Typography variant="body2" sx={{ borderTop: '1.5px solid #333', pt: 0.2, fontWeight: 'bold', fontSize: '12px' }}>Class Teacher's Signature</Typography></Box>
          <Box sx={{ textAlign: 'center', width: '150px' }}><Box sx={{ height: '30px', mb: 0.2 }} /><Typography variant="body2" sx={{ borderTop: '1.5px solid #333', pt: 0.2, fontWeight: 'bold', fontSize: '12px' }}>Guardian's Signature</Typography></Box>
          <Box sx={{ width: '250px', textAlign: 'center', mr: 1 }}>
            <Box sx={{ height: '40px', mb: 0.1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
               {resolvedSchool?.school_seal && <img src={getMediaUrl(resolvedSchool.school_seal)} alt="" style={{ position: 'absolute', maxHeight: '40px', maxWidth: '70px', opacity: 0.7, mixBlendMode: 'multiply', WebkitPrintColorAdjust: 'exact' }} />}
               {resolvedSchool?.principal_signature && <img src={getMediaUrl(resolvedSchool.principal_signature)} alt="" style={{ position: 'absolute', maxHeight: '35px', maxWidth: '180px', zIndex: 2, mixBlendMode: 'multiply', WebkitPrintColorAdjust: 'exact' }} />}
               {!resolvedSchool?.principal_signature && !resolvedSchool?.school_seal && <img src="/signature.png" alt="" style={{ position: 'absolute', maxHeight: '35px', maxWidth: '140px', mixBlendMode: 'multiply', WebkitPrintColorAdjust: 'exact' }} />}
            </Box>
            <Box sx={{ borderTop: '1.5px solid #333', pt: 0.1 }}><Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '12px', color: '#1a237e' }}>{resolvedSchool?.principal_name || 'Headmaster'}</Typography><Typography variant="caption" sx={{ display: 'block', fontSize: '9px' }}>Headmaster / Principal</Typography></Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
