import React, { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import './EmployeeIDCard.css';
import { resolveSchoolLogo, resolveStudentPhoto, getMediaUrl } from '../utils/media';
import fallbackLogo from './fallback_logo.png';

// Faint school logo printed behind the card content (Watermark) - Larger size & higher opacity
const CardWatermark = ({ logo }) => (
  logo ? (
    <img
      src={logo}
      alt=""
      style={{
        position: 'absolute',
        top: '52%',
        left: '50%',
        width: '115%',
        transform: 'translate(-50%, -50%)',
        opacity: 0.18,
        zIndex: 0,
        pointerEvents: 'none',
        userSelect: 'none'
      }}
    />
  ) : null
);

const Row = ({ label, value }) => (
  <div className="emp-card-row">
    <span className="lbl">{label}</span>
    <span className="val">{value || 'N/A'}</span>
  </div>
);

/**
 * Digital Employee ID card (BDapp IT Firm / School).
 * Renders both Front and Back sides, print-ready.
 */
export default function EmployeeIDCard({ employee, school, website = 'https://bdapp.live', signatureUrl: propSignatureUrl }) {
  const [photoError, setPhotoError] = useState(false);

  if (!employee) return null;

  const schoolName = school?.name || 'BDapp IT Firm';
  const schoolAddress = school?.address || 'ভাটারা, রায়পুর, নরসিংদী';
  const schoolLogo = resolveSchoolLogo(school) || fallbackLogo;
  const photo = resolveStudentPhoto(employee) || getMediaUrl(employee.photo_url) || getMediaUrl(employee.photo);
  const photoToDisplay = (!photoError && photo) ? photo : null;

  const signatureUrl = (() => {
    if (propSignatureUrl) return propSignatureUrl;
    const sig = resolveSchoolLogo({ logo: school?.principal_signature }) || getMediaUrl(school?.principal_signature);
    return sig;
  })();

  const nameEn = employee.name_en || employee.name_bn || 'N/A';
  const designation = employee.designation_name || (employee.designation?.name) || 'N/A';
  const department = employee.department_name || (employee.department?.name) || 'N/A';
  const mobile = employee.mobile_number || employee.official_mobile || 'N/A';
  const empId = employee.employee_id || employee.id_card_number || '';
  const blood = employee.blood_group || 'N/A';
  const joining = employee.joining_date || 'N/A';

  const qrData = `EMP|${employee.id}|${empId}|${encodeURIComponent(nameEn)}|${school?.ein || school?.id || ''}`;

  return (
    <div className="emp-card-wrapper" data-emp-id={employee.id}>
      {/* Front Side */}
      <div className="emp-id-card emp-id-card-front">
        <CardWatermark logo={schoolLogo} />

        {/* Header: logo + school name */}
        <div className="emp-card-header">
          <img className="emp-card-logo" src={schoolLogo} alt="logo" onError={(e) => { e.target.src = fallbackLogo; }} />
          <div className="emp-card-school">{schoolName}</div>
          {school?.ein ? <div className="emp-card-sub">EIIN: {school.ein}</div> : null}
          <div className="emp-card-sub">EMPLOYEE IDENTITY CARD</div>
        </div>

        {/* Photo */}
        <div className="emp-card-photo-box">
          <div className="emp-card-photo">
            {photoToDisplay ? (
              <img
                src={photoToDisplay}
                alt={nameEn}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={() => setPhotoError(true)}
              />
            ) : (
              (nameEn && nameEn.charAt(0).toUpperCase()) || '?'
            )}
          </div>
        </div>

        {/* Details */}
        <div className="emp-card-body">
          <div className="emp-card-name">{nameEn}</div>
          <div className="emp-card-id">ID: {empId}</div>

          <div className="emp-card-divider" />

          <div className="emp-card-rows">
            <Row label="Des. :" value={designation} />
            <Row label="Dep. :" value={department} />
            <Row label="Blood :" value={blood} />
            <Row label="Joining :" value={joining} />
            <Row label="Mobile :" value={mobile} />
          </div>

          <div className="emp-card-divider" />

          <div className="emp-card-sign">
            <div className="emp-card-sign-block">
              <div className="emp-card-sign-slot">
                {schoolLogo && (
                  <img
                    className="emp-card-seal"
                    src={schoolLogo}
                    alt=""
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                {signatureUrl ? (
                  <img
                    className="emp-card-sign-img"
                    src={signatureUrl}
                    alt="Authorized Signature"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="emp-card-sign-spacer" />
                )}
              </div>
              <div className="emp-card-sign-label">Authorized Signature</div>
            </div>
          </div>
        </div>

        {/* Footer: website + contact */}
        <div className="emp-card-footer">
          <div className="site">{website}</div>
          {school?.phone_number || school?.email ? (
            <div className="contact">
              {[school?.phone_number, school?.email].filter(Boolean).join(' | ')}
            </div>
          ) : null}
        </div>
      </div>

      {/* Back Side */}
      <div className="emp-id-card emp-id-card-back">
        <CardWatermark logo={schoolLogo} />

        {/* Top Section */}
        <div className="emp-card-back-top">
          <div className="return-title">If found, please return to</div>
        </div>

        {/* QR Code */}
        <div className="emp-card-back-qr-container">
          <div className="emp-card-back-qr-box">
            <QRCodeCanvas value={qrData} size={160} level="M" includeMargin={false} />
          </div>
          <div className="emp-card-back-qr-label">Scan to verify</div>
        </div>

        {/* School Logo & Name in Middle */}
        <div className="emp-card-back-middle">
          <img
            className="emp-card-back-logo"
            src={schoolLogo}
            alt="logo"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div className="emp-card-back-school">{schoolName}</div>
        </div>

        {/* Bottom Section */}
        <div className="emp-card-back-footer">
          <div className="address">{schoolAddress}</div>
          {school?.email ? <div className="email">Email: {school.email}</div> : null}
          {school?.phone_number || school?.phone ? (
            <div className="phone">Mobile: {school.phone_number || school.phone}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
