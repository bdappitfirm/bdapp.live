import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import './SSCMarksheet.css';
import { getMediaUrl } from '../utils/media';
import fallbackLogo from './fallback_logo.png';

const toBn = (v) => String(v ?? '').replace(/[0-9]/g, d => ['০','১','২','৩','৪','৫','৬','৭','৮','৯'][d]);

export default function SSCMarksheet({ studentData, results, overallResult, examination, school, forceLanguage }) {
  const student = studentData?.student || {};
  const user = student.user || {};
  const isBn = forceLanguage === 'bn';
  const n = (v) => isBn ? toBn(v) : v;

  const logoUrl = getMediaUrl(school?.logo || fallbackLogo);

  const studentName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
  const fatherName = student.father_name || 'N/A';
  const motherName = student.mother_name || 'N/A';
  const institution = school?.name || 'N/A';
  const rollNo = student.roll_number || 'N/A';
  const regNo = student.registration_number || 'N/A';
  const session = examination?.academic_year || 'N/A';
  const group = student.student_group || student.group || 'General';
  const studentType = student.student_type || 'Regular';
  const dob = student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : 'N/A';

  // Process and merge results (e.g. Bangla/English papers)
  const processedResults = useMemo(() => {
    const isNineTen = /নবম|দশম|ssc|\b9\b|\b10\b/.test(String(student.classroom?.name || examination?.name || '').toLowerCase());

    if (!isNineTen) return results;

    const merged = [];
    const handledIds = new Set();

    const banglaPapers = results.filter(r => {
        const n = String(r.subject?.name || r.subject_name || '').toLowerCase();
        return (n.includes('বাংলা') || n.includes('bangla')) && !n.includes('বাংলাদেশ');
    });

    const englishPapers = results.filter(r => {
        const n = String(r.subject?.name || r.subject_name || '').toLowerCase();
        return n.includes('english') || n.includes('ইংরেজি') || n.includes('ইংরেজী');
    });

    if (banglaPapers.length > 0) {
        const sumObtained = banglaPapers.reduce((s, r) => s + (parseFloat(r.total_obtained) || 0), 0);
        const totalPossible = banglaPapers.reduce((s, r) => s + (parseFloat(r.total_marks) || 100), 0);
        const allPassed = banglaPapers.every(r => r.is_passed);
        merged.push({
            subject_name: isBn ? 'বাংলা (১ম + ২য়)' : 'Bangla (1st + 2nd)',
            grade: allPassed ? 'Merged' : 'F', // Grade calculation logic can be added here
            gpa: (sumObtained / totalPossible * 5).toFixed(2), // Simple estimate
            total_obtained: sumObtained,
            is_merged: true
        });
        banglaPapers.forEach(p => handledIds.add(p.id));
    }

    if (englishPapers.length > 0) {
        const sumObtained = englishPapers.reduce((s, r) => s + (parseFloat(r.total_obtained) || 0), 0);
        const totalPossible = englishPapers.reduce((s, r) => s + (parseFloat(r.total_marks) || 100), 0);
        const allPassed = englishPapers.every(r => r.is_passed);
        merged.push({
            subject_name: isBn ? 'ইংরেজি (১ম + ২য়)' : 'English (1st + 2nd)',
            grade: allPassed ? 'Merged' : 'F',
            gpa: (sumObtained / totalPossible * 5).toFixed(2),
            total_obtained: sumObtained,
            is_merged: true
        });
        englishPapers.forEach(p => handledIds.add(p.id));
    }

    results.forEach(r => {
        if (!handledIds.has(r.id)) merged.push(r);
    });

    return merged;
  }, [results, student, examination, isBn]);

  // Sort subjects to match board order if possible
  const sortedResults = useMemo(() => {
    return [...processedResults].sort((a, b) => {
        // Simple heuristic for board ordering
        const getWeight = (name) => {
            const n = String(name).toLowerCase();
            if (n.includes('bangla') || n.includes('বাংলা')) return 1;
            if (n.includes('english') || n.includes('ইংরেজি')) return 2;
            if (n.includes('math') || n.includes('গণিত')) return 3;
            return 10;
        };
        return getWeight(a.subject?.name || a.subject_name) - getWeight(b.subject?.name || b.subject_name);
    });
  }, [results]);

  return (
    <Box className="ssc-marksheet-container">
      <Box className="ssc-marksheet-inner">
        {/* Header */}
        <Box className="ssc-header">
          <Typography className="ssc-board-name">BOARD OF INTERMEDIATE AND SECONDARY EDUCATION, {school?.district || 'DHAKA'}</Typography>
          <Typography className="ssc-country">BANGLADESH</Typography>
          <Box className="ssc-exam-info">
            <Typography variant="h6">Secondary School Certificate Examination - {n(examination?.academic_year || new Date().getFullYear())}</Typography>
          </Box>
          <Typography className="ssc-transcript-title">ACADEMIC TRANSCRIPT</Typography>
        </Box>

        {/* Grade Scale Table (Top Right) */}
        <Box className="ssc-grade-scale">
            <table className="ssc-grade-table">
                <thead>
                    <tr>
                        <th>Letter Grade</th>
                        <th>Class Interval</th>
                        <th>Grade Point</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>A+</td><td>80-100</td><td>5.0</td></tr>
                    <tr><td>A</td><td>70-79</td><td>4.0</td></tr>
                    <tr><td>A-</td><td>60-69</td><td>3.5</td></tr>
                    <tr><td>B</td><td>50-59</td><td>3.0</td></tr>
                    <tr><td>C</td><td>40-49</td><td>2.0</td></tr>
                    <tr><td>D</td><td>33-39</td><td>1.0</td></tr>
                    <tr><td>F</td><td>00-32</td><td>0.0</td></tr>
                </tbody>
            </table>
        </Box>

        {/* Student Details */}
        <Box className="ssc-student-details">
            <Box className="ssc-details-row">
                <span className="label">Name of Student</span>
                <span className="colon">:</span>
                <span className="value bold">{studentName}</span>
            </Box>
            <Box className="ssc-details-row">
                <span className="label">Father's Name</span>
                <span className="colon">:</span>
                <span className="value">{fatherName}</span>
            </Box>
            <Box className="ssc-details-row">
                <span className="label">Mother's Name</span>
                <span className="colon">:</span>
                <span className="value">{motherName}</span>
            </Box>
            <Box className="ssc-details-row">
                <span className="label">Name of Institution</span>
                <span className="colon">:</span>
                <span className="value">{institution}</span>
            </Box>
            <Box className="ssc-details-row">
                <span className="label">Name of Centre</span>
                <span className="colon">:</span>
                <span className="value">{school?.centre_name || '..........................................................'}</span>
            </Box>
            <Box className="ssc-details-grid">
                <Box className="ssc-details-row half">
                    <span className="label">Roll No.</span>
                    <span className="colon">:</span>
                    <span className="value">{n(rollNo)}</span>
                </Box>
                <Box className="ssc-details-row half">
                    <span className="label">Registration No.</span>
                    <span className="colon">:</span>
                    <span className="value">{n(regNo)}</span>
                </Box>
                <Box className="ssc-details-row half">
                    <span className="label">Group</span>
                    <span className="colon">:</span>
                    <span className="value">{group}</span>
                </Box>
                <Box className="ssc-details-row half">
                    <span className="label">Type of Student</span>
                    <span className="colon">:</span>
                    <span className="value">{studentType}</span>
                </Box>
            </Box>
        </Box>

        {/* Results Table */}
        <Box className="ssc-results-wrapper">
            {/* Watermark Logo */}
            <Box className="ssc-table-watermark">
                <img src={logoUrl} alt="" />
            </Box>

            <table className="ssc-results-table">
                <thead>
                    <tr>
                        <th width="10%">Subject Code</th>
                        <th width="50%">Name of Subjects</th>
                        <th width="20%">Letter Grade</th>
                        <th width="20%">Grade Point (GP)</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedResults.map((r, idx) => (
                        <tr key={idx}>
                            <td align="center">{r.subject?.code || r.subject?.subject_code || n(idx + 101)}</td>
                            <td>{r.subject?.name || r.subject_name}</td>
                            <td align="center">{r.grade}</td>
                            <td align="center">{n(r.gpa)}</td>
                        </tr>
                    ))}
                    {/* Empty rows to maintain height if needed */}
                    {[...Array(Math.max(0, 10 - sortedResults.length))].map((_, i) => (
                        <tr key={`empty-${i}`} className="empty-row">
                            <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan={3} className="gpa-label">Grade Point Average (GPA)</td>
                        <td align="center" className="gpa-value">{n(overallResult?.cgpa || '0.00')}</td>
                    </tr>
                </tfoot>
            </table>
        </Box>

        {/* Footer */}
        <Box className="ssc-footer">
            <Box className="ssc-date-section">
                <Typography>Date of Publication of Result:</Typography>
                <Typography className="bold">{new Date().toLocaleDateString('en-GB')}</Typography>
            </Box>
            <Box className="ssc-signature-section">
                <Box className="ssc-signature">
                    <div className="sig-line"></div>
                    <Typography>Controller of Examinations</Typography>
                </Box>
            </Box>
        </Box>
      </Box>
    </Box>
  );
}
