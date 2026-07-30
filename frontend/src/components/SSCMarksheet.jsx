import React, { useMemo } from 'react';
import './SSCMarksheet.css';
import { getMediaUrl } from '../utils/media';
import fallbackLogo from './fallback_logo.png';

// Bangladesh Emblem Placeholder (SVG for stability)
const BangladeshEmblem = () => (
    <div className="ssc-emblem-container">
        <svg width="70" height="70" viewBox="0 0 100 100" className="ssc-emblem">
            <circle cx="50" cy="50" r="48" fill="none" stroke="#006a4e" strokeWidth="1.5" />
            <circle cx="50" cy="50" r="30" fill="#f42a41" />
            <text x="50" y="55" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold">BD</text>
        </svg>
    </div>
);

const toBn = (v) => String(v ?? '').replace(/[0-9]/g, d => ['০','১','২','৩','৪','৫','৬','৭','৮','৯'][d]);

export default function SSCMarksheet({ studentData, results, overallResult, examination, school, forceLanguage }) {
  const student = studentData?.student || studentData || {};
  const user = student.user || {};
  const isBn = forceLanguage === 'bn';
  const n = (v) => isBn ? toBn(v) : v;

  const logoUrl = getMediaUrl(school?.logo || fallbackLogo);

  // Formatting Names and Details
  const studentName = ((user.first_name || '') + ' ' + (user.last_name || '')).trim().toUpperCase() || 'UNKNOWN STUDENT';
  const fatherName = (student.father_name || 'N/A').toUpperCase();
  const motherName = (student.mother_name || 'N/A').toUpperCase();
  const institution = (school?.name || 'N/A').toUpperCase();
  const rollNo = student.roll_number || 'N/A';
  const regNo = student.registration_number || 'N/A';
  const dob = useMemo(() => {
    if (!student.date_of_birth) return 'N/A';
    const d = new Date(student.date_of_birth);
    const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Simple helper to convert date to words (optional but looks good)
    const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    const dayNames = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "EIGHTH", "NINTH", "TENTH", "ELEVENTH", "TWELFTH", "THIRTEENTH", "FOURTEENTH", "FIFTEENTH", "SIXTEENTH", "SEVENTEENTH", "EIGHTEENTH", "NINETEENTH", "TWENTIETH", "TWENTY FIRST", "TWENTY SECOND", "TWENTY THIRD", "TWENTY FOURTH", "TWENTY FIFTH", "TWENTY SIXTH", "TWENTY SEVENTH", "TWENTY EIGHTH", "TWENTY NINTH", "THIRTIETH", "THIRTY FIRST"];

    try {
        const words = `(${dayNames[d.getDate()-1]} ${monthNames[d.getMonth()]} ${d.getFullYear()})`;
        return `${datePart} ${words}`;
    } catch (_) { return datePart; }
  }, [student.date_of_birth]);
  const centre = school?.centre_name || 'N/A';
  const session = student.session || examination?.academic_year || 'N/A';

  // Grouping Results
  const { main, optional, coCurricular } = useMemo(() => {
    const isCoCurricular = (name) => {
        const n = String(name).toLowerCase();
        return ['physical education', 'arts & crafts', 'work and life', 'শারীরিক', 'চারু', 'কর্ম ও জীবন'].some(k => n.includes(k));
    };

    const isOptional = (r) => {
        const sname = String(r.subject?.name || r.subject_name || '').toLowerCase();
        const optId = student.optional_subject?.id || student.optional_subject;
        if (optId && String(optId) === String(r.subject?.id || r.subject)) return true;
        return sname.includes('agriculture') || sname.includes('higher math') || sname.includes('ঐচ্ছিক') || sname.includes('কৃষি');
    };

    return {
        main: results.filter(r => !isCoCurricular(r.subject?.name || r.subject_name) && !isOptional(r)),
        optional: results.filter(r => !isCoCurricular(r.subject?.name || r.subject_name) && isOptional(r)),
        coCurricular: results.filter(r => isCoCurricular(r.subject?.name || r.subject_name))
    };
  }, [results, student]);

  // Advanced GPA Calculations
  const { gpaWithoutOptional, gpaWithOptional } = useMemo(() => {
    if (!main.length) return { gpaWithoutOptional: '0.00', gpaWithOptional: '0.00' };

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

  return (
    <div className="ssc-print-root">
      <div className="ssc-border-outer">

        {/* Header Section */}
        <div className="ssc-header-container">
            <div className="ssc-serial-section">
                <div>Serial No. CB {n(serialNo)}</div>
                <div style={{ fontSize: '8pt', marginTop: '2pt' }}>{school?.code || 'cbj17'}: {n(subSerialNo)}</div>
            </div>

            <h1 className="ssc-board-name">BOARD OF INTERMEDIATE AND SECONDARY EDUCATION, {school?.district || 'COMILLA'}</h1>
            <div className="ssc-country">BANGLADESH</div>

            <BangladeshEmblem />

            <div className="ssc-exam-name">
                {examination?.name || 'Secondary School Certificate'} Examination - {n(examination?.academic_year || '2024')}
            </div>

            <div className="ssc-transcript-title">ACADEMIC TRANSCRIPT</div>

            {/* Grade Scale (Top Right) */}
            <div className="ssc-grade-scale-box">
                <table className="ssc-grade-table">
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

        {/* Student Details Grid */}
        <div className="ssc-info-grid">
            <div className="ssc-info-row">
                <span className="ssc-info-label">Name of Student</span>
                <span className="ssc-info-colon">:</span>
                <span className="ssc-info-value">{studentName}</span>
            </div>
            <div className="ssc-info-row">
                <span className="ssc-info-label">Father's Name</span>
                <span className="ssc-info-colon">:</span>
                <span className="ssc-info-value">{fatherName}</span>
            </div>
            <div className="ssc-info-row">
                <span className="ssc-info-label">Mother's Name</span>
                <span className="ssc-info-colon">:</span>
                <span className="ssc-info-value">{motherName}</span>
            </div>
            <div className="ssc-info-row">
                <span className="ssc-info-label">Name of Institution</span>
                <span className="ssc-info-colon">:</span>
                <span className="ssc-info-value">({school?.ein || '000000'}) {institution}</span>
            </div>

            <div className="ssc-info-multi">
                <div className="ssc-info-item">
                    <span className="ssc-info-label" style={{ width: '100pt' }}>Name of Centre</span>
                    <span className="ssc-info-colon">:</span>
                    <span className="ssc-info-value">{centre}</span>
                </div>
                <div className="ssc-info-item">
                    <span className="ssc-info-label" style={{ width: '80pt' }}>Type</span>
                    <span className="ssc-info-colon">:</span>
                    <span className="ssc-info-value">{student.student_type || 'Regular'}</span>
                </div>
            </div>

            <div className="ssc-info-multi">
                <div className="ssc-info-item">
                    <span className="ssc-info-label" style={{ width: '100pt' }}>Roll No.</span>
                    <span className="ssc-info-colon">:</span>
                    <span className="ssc-info-value">{n(rollNo)}</span>
                </div>
                <div className="ssc-info-item">
                    <span className="ssc-info-label" style={{ width: '100pt' }}>Registration No.</span>
                    <span className="ssc-info-colon">:</span>
                    <span className="ssc-info-value">{n(regNo)} / {n(session)}</span>
                </div>
            </div>

            <div className="ssc-info-row">
                <span className="ssc-info-label">Date of Birth</span>
                <span className="ssc-info-colon">:</span>
                <span className="ssc-info-value">{n(dob)}</span>
            </div>
        </div>

        {/* Results Table Section */}
        <div className="ssc-results-container">
            {/* Watermark Logo */}
            <div className="ssc-watermark-wrapper">
                <img src={logoUrl} alt="" className="ssc-watermark" />
            </div>

            <table className="ssc-main-table">
                <thead>
                    <tr>
                        <th width="8%">SI. No.</th>
                        <th width="42%">Name of Subjects</th>
                        <th width="15%">Letter Grade</th>
                        <th width="15%">Grade Point</th>
                        <th width="10%">GPA<br/><span style={{ fontSize: '7pt', fontWeight: 'normal' }}>(Without optional)</span></th>
                        <th width="10%">GPA</th>
                    </tr>
                </thead>
                <tbody>
                    {main.map((r, idx) => (
                        <tr key={idx}>
                            <td className="ssc-center-text">{n(idx + 1)}</td>
                            <td>{r.subject?.name || r.subject_name}</td>
                            <td className="ssc-center-text">{r.grade}</td>
                            <td className="ssc-center-text">{n(r.gpa)}</td>
                            {idx === 0 && (
                                <td rowSpan={main.length} className="ssc-center-text ssc-gpa-cell">
                                    {n(gpaWithoutOptional)}
                                </td>
                            )}
                            {idx === 0 && (
                                <td rowSpan={main.length} className="ssc-center-text ssc-gpa-cell">
                                    {n(gpaWithOptional)}
                                </td>
                            )}
                        </tr>
                    ))}

                    {/* Optional Subject Section */}
                    <tr>
                        <td colSpan={6} className="ssc-section-header">Optional Subject</td>
                    </tr>
                    {optional.map((r, idx) => (
                        <tr key={`opt-${idx}`}>
                            <td className="ssc-center-text">{n(main.length + idx + 1)}</td>
                            <td>{r.subject?.name || r.subject_name}</td>
                            <td className="ssc-center-text">{r.grade}</td>
                            <td className="ssc-center-text">{n(r.gpa)}</td>
                            <td colSpan={2} className="ssc-center-text" style={{ fontSize: '9pt', fontWeight: 'bold' }}>
                                GP above 2<br/>{n(Math.max(0, parseFloat(r.gpa) - 2).toFixed(2))}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Continuous Assessment Section */}
            {coCurricular.length > 0 && (
                <div className="ssc-ca-section">
                    <div className="ssc-ca-title">Continuous Assessment</div>
                    <table className="ssc-ca-table">
                        <tbody>
                            {coCurricular.map((r, idx) => (
                                <tr key={`ca-${idx}`}>
                                    <td width="10%" className="ssc-center-text">{n(idx + 1)}</td>
                                    <td width="70%">{r.subject?.name || r.subject_name}</td>
                                    <td width="20%" className="ssc-center-text">{r.grade}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>

        {/* Footer Section */}
        <div className="ssc-footer-container">
            <div className="ssc-date-box">
                <div>Date of Publication of Result : <b>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</b></div>
            </div>

            <div className="ssc-sig-box">
                <div className="ssc-sig-wave">
                   {/* Signature SVG/Image can go here */}
                   <svg width="100" height="30" viewBox="0 0 100 30">
                       <path d="M10,20 Q30,5 50,20 T90,20" fill="none" stroke="#000" strokeWidth="1" />
                   </svg>
                </div>
                <div className="ssc-sig-line"></div>
                <div className="ssc-sig-text">Controller of Examinations</div>
            </div>
        </div>

      </div>
    </div>
  );
}
