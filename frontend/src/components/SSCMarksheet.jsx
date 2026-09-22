import React, { useMemo } from 'react';
import './SSCMarksheet.css';
import { getMediaUrl } from '../utils/media';
import fallbackLogo from './fallback_logo.png';

const toBn = (v) => String(v ?? '').replace(/[0-9]/g, d => ['০','১','২','৩','৪','৫','৬','৭','৮','৯'][d]);

export default function SSCMarksheet({ studentData, results, overallResult, examination, school, forceLanguage }) {
  const student = useMemo(() => studentData?.student || studentData || {}, [studentData]);
  const user = student.user || {};
  const isBn = forceLanguage === 'bn';
  const formatNum = (v) => isBn ? toBn(v) : v;

  const logoUrl = getMediaUrl(school?.logo || fallbackLogo);

  // Formatting Names and Details
  const studentName = ((user.first_name || '') + ' ' + (user.last_name || '')).trim().toUpperCase() || 'UNKNOWN STUDENT';
  const fatherName = (student.father_name || 'N/A').toUpperCase();
  const motherName = (student.mother_name || 'N/A').toUpperCase();
  const institution = (school?.name || 'N/A').toUpperCase();
  const rollNo = student.roll_number || 'N/A';
  const regNo = student.registration_number || student.student_custom_id || 'N/A';
  const session = student.session || examination?.academic_year || new Date().getFullYear() - 1;
  const centre = (school?.centre_name || school?.district || 'RAMGANJ-4').toUpperCase();
  const studentType = (student.student_type || 'REGULAR').toUpperCase();

  const dob = useMemo(() => {
    if (!student.date_of_birth && !student.birth_date) return 'N/A';
    const d = new Date(student.date_of_birth || student.birth_date);
    const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    const dayNames = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "EIGHTH", "NINTH", "TENTH", "ELEVENTH", "TWELFTH", "THIRTEENTH", "FOURTEENTH", "FIFTEENTH", "SIXTEENTH", "SEVENTEENTH", "EIGHTEENTH", "NINETEENTH", "TWENTIETH", "TWENTY FIRST", "TWENTY SECOND", "TWENTY THIRD", "TWENTY FOURTH", "TWENTY FIFTH", "TWENTY SIXTH", "TWENTY SEVENTH", "TWENTY EIGHTH", "TWENTY NINTH", "THIRTIETH", "THIRTY FIRST"];
    try {
        const words = `(${dayNames[d.getDate()-1]} ${monthNames[d.getMonth()]} ${d.getFullYear()})`;
        return `${datePart} ${words}`;
    } catch (_) { return datePart; }
  }, [student]);

  // Grouping Results
  const { main, optional, coCurricular } = useMemo(() => {
    const isCoCurricular = (name) => {
        const ln = String(name).toLowerCase();
        return ['physical education', 'arts & crafts', 'work and life', 'শারীরিক', 'চারু', 'কর্ম ও জীবন'].some(k => ln.includes(k));
    };

    const studentGroup = String(student.student_group || student.group || studentData?.group || '').toLowerCase();
    const isSciGroup = studentGroup.includes('science') || studentGroup.includes('বিজ্ঞান');

    const optId = String(student.optional_subject?.id || student.optional_subject || '');
    const optName = String(student.optional_subject?.name || '').toLowerCase();

    // Exclude Science electives for Non-Science students if no marks and not assigned on profile
    const validResults = results.filter(r => {
        const sname = String(r.subject?.name || r.subject_name || '').toLowerCase();
        const sid = String(r.subject?.id || r.subject || '');
        const tot = parseFloat(r.total_obtained) || 0;
        const w = parseFloat(r.written_marks) || 0;
        const m = parseFloat(r.mcq_marks) || 0;
        const p = parseFloat(r.practical_marks) || 0;
        const hasMarks = tot > 0 || w > 0 || m > 0 || p > 0;
        const isAssigned = (optId && sid === optId) || (optName && (sname === optName || sname.includes(optName)));

        if (!isSciGroup && !hasMarks && !isAssigned) {
            const isHM = sname.includes('উচ্চতর') || sname.includes('higher');
            const isPureScience = sname.includes('পদার্থ') || sname.includes('physics') || sname.includes('রসায়ন') || sname.includes('chemistry') || sname.includes('জীব') || sname.includes('biology');
            if (isHM || isPureScience) return false;
        }
        return true;
    });

    const isOptional = (r) => {
        const sname = String(r.subject?.name || r.subject_name || '').toLowerCase();
        const sid = String(r.subject?.id || r.subject || '');

        // 1. Explicitly assigned on student profile
        if (optId && sid === optId) return true;
        if (optName && (sname === optName || sname.includes(optName))) return true;

        // 2. Marks check
        const tot = parseFloat(r.total_obtained) || 0;
        const w = parseFloat(r.written_marks) || 0;
        const m = parseFloat(r.mcq_marks) || 0;
        const p = parseFloat(r.practical_marks) || 0;
        const hasMarks = tot > 0 || w > 0 || m > 0 || p > 0;

        const isHM = sname.includes('উচ্চতর') || sname.includes('higher');
        const isAgri = sname.includes('কৃষি') || sname.includes('agriculture') || sname.includes('গার্হস্থ্য') || sname.includes('home science');

        if (isAgri) {
            return hasMarks || !isSciGroup;
        }
        if (isHM) {
            const isAssigned = (optId && sid === optId) || (optName && (sname === optName || sname.includes(optName)));
            if (!isSciGroup && !isAssigned) return false;
            return isSciGroup || hasMarks;
        }

        return sname.includes('ঐচ্ছিক') || sname.includes('fourth') || sname.includes('৪র্থ');
    };

    let optCandidates = validResults.filter(r => !isCoCurricular(r.subject?.name || r.subject_name) && isOptional(r));
    let mainList = validResults.filter(r => !isCoCurricular(r.subject?.name || r.subject_name) && !isOptional(r));

    // Limit optional to at most one subject with actual marks or assigned
    if (optCandidates.length > 0) {
        let primary = optCandidates.find(r => {
            const matchesId = optId && String(r.subject?.id || r.subject) === optId;
            const matchesName = optName && (r.subject?.name || r.subject_name || '').toLowerCase().includes(optName);
            if (!matchesId && !matchesName) return false;

            const isHM = /higher|উচ্চতর/i.test(r.subject?.name || r.subject_name || '');
            const hasMarks = !r.isActuallyAbsent && (parseFloat(r.total_obtained) > 0 || (parseFloat(r.written_marks)||0) > 0);
            if (!isSciGroup && isHM && !hasMarks) return false;

            return true;
        });

        if (!primary) {
            const withMarks = optCandidates.filter(r => {
                const tot = parseFloat(r.total_obtained) || 0;
                const w = parseFloat(r.written_marks) || 0;
                return tot > 0 || w > 0;
            });
            if (withMarks.length > 0) {
                primary = withMarks[0];
            }
        }

        if (primary) {
            return {
                main: mainList,
                optional: [primary],
                coCurricular: validResults.filter(r => isCoCurricular(r.subject?.name || r.subject_name))
            };
        }
    }

    return {
        main: mainList,
        optional: [],
        coCurricular: validResults.filter(r => isCoCurricular(r.subject?.name || r.subject_name))
    };
  }, [results, student, studentData]);

  // GPA Calculations (Simplified for Display Matching)
  const { gpaWithoutOptional, gpaWithOptional } = useMemo(() => {
    if (!main.length) return { gpaWithoutOptional: '0.00', gpaWithOptional: '0.00' };

    // Main GPA calculation
    const sumMainGP = main.reduce((s, r) => s + (parseFloat(r.gpa) || 0), 0);
    const countMain = main.length;
    const hasFail = main.some(r => (parseFloat(r.gpa) || 0) === 0);

    if (hasFail) return { gpaWithoutOptional: '0.00', gpaWithOptional: '0.00' };

    const gpaWO = sumMainGP / countMain;

    let bonus = 0;
    if (optional.length > 0) {
        const optGP = parseFloat(optional[0].gpa) || 0;
        bonus = Math.max(0, optGP - 2);
    }

    const gpaW = Math.min(5.0, (sumMainGP + bonus) / countMain);

    return {
        gpaWithoutOptional: gpaWO.toFixed(2),
        gpaWithOptional: gpaW.toFixed(2)
    };
  }, [main, optional]);

  const serialNo = useMemo(() => {
    const seed = String(student.id || '') + String(examination?.id || '');
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    return Math.abs(hash % 9000000) + 1000000;
  }, [student.id, examination?.id]);

  const subSerialNo = useMemo(() => {
    const seed = String(student.roll_number || '') + String(student.id || '');
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    return Math.abs(hash % 9000000);
  }, [student.roll_number, student.id]);

  const pubDate = useMemo(() => {
    const d = examination?.exam_date ? new Date(examination.exam_date) : new Date();
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }, [examination]);

  return (
    <div className="ssc-board-transcript-root">
      <div className="transcript-outer-container">

        {/* Header Section */}
        <div className="transcript-header">
            <div className="serial-info">
                <div style={{ fontSize: '11pt', fontWeight: 'bold' }}>Serial No. CB &nbsp; <span style={{ fontSize: '13pt' }}>{formatNum(serialNo)}</span></div>
                <div className="sub-serial" style={{ fontWeight: 'bold' }}>{school?.code || 'cbj17'}: {formatNum(subSerialNo)}</div>
            </div>

            <div className="board-info">
                <h1 className="board-name">BOARD OF INTERMEDIATE AND SECONDARY EDUCATION, {(school?.district || 'COMILLA').toUpperCase()}</h1>
                <div className="country-name">BANGLADESH</div>

                <div className="emblem-box">
                    <img src="/emblem_bd.png" alt="" onError={(e) => e.target.src = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Government_Seal_of_Bangladesh.svg/1200px-Government_Seal_of_Bangladesh.svg.png'} />
                </div>

                <div className="exam-title">
                    {String(examination?.name || 'Secondary School Certificate').toUpperCase()} EXAMINATION, {formatNum(examination?.academic_year || '2024')}
                </div>

                <div className="transcript-label">ACADEMIC TRANSCRIPT</div>
            </div>

            {/* Grade Scale (Top Right) */}
            <div className="grade-scale-box">
                <table className="grade-scale-table">
                    <thead>
                        <tr>
                            <th>Letter<br/>Grade</th>
                            <th>Class<br/>Interval</th>
                            <th>Grade<br/>Point</th>
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
            </div>
        </div>

        {/* Student Data Section */}
        <div className="student-details-grid">
            <div className="detail-row">
                <span className="detail-label">Name of Student</span>
                <span className="detail-colon">:</span>
                <span className="detail-value italic-bold">{studentName}</span>
            </div>
            <div className="detail-row">
                <span className="detail-label">Father's Name</span>
                <span className="detail-colon">:</span>
                <span className="detail-value">{fatherName}</span>
            </div>
            <div className="detail-row">
                <span className="detail-label">Mother's Name</span>
                <span className="detail-colon">:</span>
                <span className="detail-value">{motherName}</span>
            </div>
            <div className="detail-row">
                <span className="detail-label">Name of Institution</span>
                <span className="detail-colon">:</span>
                <span className="detail-value">({school?.ein || '------'}) {institution}</span>
            </div>

            <div className="detail-multi-row">
                <div style={{ display: 'flex', width: '65%', alignItems: 'baseline' }}>
                    <span className="detail-label" style={{ width: '110pt' }}>Name of Centre</span>
                    <span className="detail-colon">:</span>
                    <span className="detail-value">({formatNum(Math.floor(serialNo/10000))}) {centre}</span>
                </div>
                <div style={{ display: 'flex', width: '30%', alignItems: 'baseline', marginLeft: '10pt' }}>
                    <span className="detail-label" style={{ width: '40pt' }}>Type</span>
                    <span className="detail-colon">:</span>
                    <span className="detail-value">{studentType}</span>
                </div>
            </div>

            <div className="detail-multi-row">
                <div style={{ display: 'flex', width: '45%', alignItems: 'baseline' }}>
                    <span className="detail-label" style={{ width: '110pt' }}>Roll No.</span>
                    <span className="detail-colon">:</span>
                    <span className="detail-value bold-text">{formatNum(rollNo)}</span>
                </div>
                <div style={{ display: 'flex', width: '50%', alignItems: 'baseline', marginLeft: '10pt' }}>
                    <span className="detail-label" style={{ width: '100pt' }}>Registration No.</span>
                    <span className="detail-colon">:</span>
                    <span className="detail-value">{formatNum(regNo)} / {formatNum(session)}</span>
                </div>
            </div>

            <div className="detail-row">
                <span className="detail-label">Date of Birth</span>
                <span className="detail-colon">:</span>
                <span className="detail-value">{formatNum(dob)}</span>
            </div>
        </div>

        {/* Results Table Section */}
        <div className="results-wrapper">
            {/* Watermark Logo */}
            <div className="watermark-overlay">
                <img src={logoUrl} alt="" className="watermark-img" />
            </div>

            <table className="transcript-table">
                <thead>
                    <tr>
                        <th width="8%">Sl. No.</th>
                        <th width="42%">Name of Subjects</th>
                        <th width="15%">Letter Grade</th>
                        <th width="15%">Grade Point</th>
                        <th width="10%">GPA<br/><span className="tiny-text">(Without optional subject)</span></th>
                        <th width="10%">GPA</th>
                    </tr>
                </thead>
                <tbody>
                    {main.map((r, idx) => (
                        <tr key={idx}>
                            <td align="center">{formatNum(idx + 1)}</td>
                            <td>{r.subject?.name || r.subject_name}</td>
                            <td align="center">{r.grade}</td>
                            <td align="center">{formatNum(r.gpa)}</td>
                            {idx === 0 && (
                                <td rowSpan={main.length} align="center" className="gpa-cell">
                                    {formatNum(gpaWithoutOptional)}
                                </td>
                            )}
                            {idx === 0 && (
                                <td rowSpan={main.length} align="center" className="gpa-cell">
                                    {formatNum(gpaWithOptional)}
                                </td>
                            )}
                        </tr>
                    ))}

                    {/* Optional Subject */}
                    <tr className="section-header-row">
                        <td colSpan={6}><b>Optional Subject:</b></td>
                    </tr>
                    {optional.map((r, idx) => (
                        <tr key={`opt-${idx}`}>
                            <td align="center">{formatNum(main.length + idx + 1)}</td>
                            <td>{r.subject?.name || r.subject_name}</td>
                            <td align="center">{r.grade}</td>
                            <td align="center">{formatNum(r.gpa)}</td>
                            <td colSpan={2} align="center" className="bonus-gp">
                                GP above 2<br/>{formatNum(Math.max(0, parseFloat(r.gpa) - 2).toFixed(2))}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Continuous Assessment Table */}
            {coCurricular.length > 0 && (
                <div className="ca-table-section">
                    <div className="ca-title">Continuous Assessment</div>
                    <table className="ca-table">
                        <tbody>
                            {coCurricular.map((r, idx) => (
                                <tr key={`ca-${idx}`}>
                                    <td width="10%" align="center">{formatNum(idx + 1)}</td>
                                    <td width="70%">{r.subject?.name || r.subject_name}</td>
                                    <td width="20%" align="center">{r.grade}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>

        {/* Signature and Footer Section */}
        <div className="transcript-footer">
            <div className="footer-left">
                <div className="pub-date">Date of Publication of Result : &nbsp; <b>{pubDate}</b></div>
            </div>

            <div className="footer-right">
                <div className="signature-container">
                    <div className="signature-img" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '20pt', fontWeight: 'bold', color: '#000', fontFamily: 'Arial' }}>v</span>
                        <svg width="120" height="40" viewBox="0 0 120 40">
                            <path d="M10,30 Q30,5 50,25 T90,20 T110,15" fill="none" stroke="#000" strokeWidth="1.5" />
                        </svg>
                    </div>
                    <div className="signature-line"></div>
                    <div className="signature-label">Controller of Examinations</div>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}
