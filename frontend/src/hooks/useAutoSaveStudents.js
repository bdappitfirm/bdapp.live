import { useState, useRef, useCallback, useEffect } from 'react';
import { scopedPost } from '../utils/schoolApi';
import { useToast } from '../components/Toast';

export function useAutoSaveStudents(schoolId, delayMs = 2000) {
  const toast = useToast();
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const timerRef = useRef(null);
  const studentsRef = useRef([]);

  const setStudentsToSave = useCallback((students) => {
    studentsRef.current = students;
  }, []);

  const triggerSave = useCallback(async () => {
    const studentsToSave = studentsRef.current;
    if (!studentsToSave || studentsToSave.length === 0 || !schoolId) return;

    setSaveStatus('saving');
    try {
      const updates = studentsToSave.map(s => {
        const parseDate = (dateStr, originalDate) => {
          if (!dateStr || String(dateStr).trim() === '') return null;
          const dmYRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
          const match = String(dateStr).match(dmYRegex);
          if (match) {
            const [, d, m, y] = match;
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          }
          const yMdRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (yMdRegex.test(String(dateStr))) return String(dateStr);
          return originalDate || null;
        };

        return {
          id: s.id,
          first_name: s.first_name,
          first_name_en: s.first_name_en,
          father_name: s.father_name,
          mother_name: s.mother_name,
          guardian_name: s.voterName || s.guardian_name,
          address: s.address,
          address_en: s.address_en,
          phone_number: s.phone_number || s.mobile,
          remarks: s.remarks,
          birth_date: parseDate(s.manual_birth_date, s.birth_date),
          admission_date: parseDate(s.manual_admission_date, s.admission_date),
          roll_number: s.roll_number || s.roll,
          voter_number: s.voterNumber || s.voter_number,
          student_group: s.student_group,
          optional_subject_id: s.optional_subject_id || s.optional_subject?.id || s.optional_subject,
          subjects_list: s.manual_subjects
        };
      });

      await scopedPost(`/api/academics/students/bulk_update_students/`, schoolId, { updates });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Auto-save failed:', err);
      setSaveStatus('error');
      toast.error('তথ্য সেভ করতে সমস্যা হয়েছে');
    }
  }, [schoolId, toast]);

  const scheduleSave = useCallback((students) => {
    studentsRef.current = students;
    setSaveStatus('saving');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      triggerSave();
    }, delayMs);
  }, [triggerSave, delayMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    saveStatus,
    scheduleSave,
    triggerSave,
    setStudentsToSave
  };
}
