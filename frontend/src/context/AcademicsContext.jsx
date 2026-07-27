import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { scopedGet } from '../utils/schoolApi';
import { getCachedData, cacheData } from '../utils/offlineDb';

const AcademicsContext = createContext();

export const useAcademics = () => {
  const context = useContext(AcademicsContext);
  if (!context) {
    throw new Error('useAcademics must be used within an AcademicsProvider');
  }
  return context;
};

export const AcademicsProvider = ({ children }) => {
  const [classrooms, setClassrooms] = useState([]);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState(null);
  const studentsCountRef = useRef(0);
  const classroomsCountRef = useRef(0);
  const sectionsCountRef = useRef(0);
  const subjectsCountRef = useRef(0);

  useEffect(() => {
    studentsCountRef.current = students.length;
    classroomsCountRef.current = classrooms.length;
    sectionsCountRef.current = sections.length;
    subjectsCountRef.current = subjects.length;
  }, [students, classrooms, sections, subjects]);

  const schoolIdRef = useRef(currentSchoolId);
  useEffect(() => {
    schoolIdRef.current = currentSchoolId;
  }, [currentSchoolId]);

  // Clear all data (useful when switching schools or logging out)
  const clearData = useCallback(() => {
    setClassrooms([]);
    setSections([]);
    setStudents([]);
    setSubjects([]);
    setCurrentSchoolId(null);
  }, []);

  // Fetch classrooms
  const refreshClassrooms = useCallback(async (schoolId, force = false) => {
    const sId = schoolId || schoolIdRef.current;
    if (!sId) return;
    
    // DISABLE generic cache for now as it lacks school_id filtering and causes cross-school data leakage
    /*
    if (!force) {
      try {
        const cached = await getCachedData('classrooms');
        if (cached && cached.length > 0) {
          setClassrooms(cached);
          return cached;
        }
      } catch (e) {
        console.warn('Failed to load cached classrooms:', e);
      }
    }
    */

    try {
      const response = await scopedGet('/api/academics/classrooms/', sId, {}, { timeout: 30000 });
      const data = Array.isArray(response.data) ? response.data : (response.data.results || []);
      setClassrooms(data);
      if (data.length > 0) await cacheData('classrooms', data);
      return data;
    } catch (error) {
      console.error('Error fetching classrooms:', error);
      // const cached = await getCachedData('classrooms');
      // if (cached && cached.length > 0) setClassrooms(cached);
    }
  }, []);

  // Fetch sections
  const refreshSections = useCallback(async (schoolId, force = false) => {
    const sId = schoolId || schoolIdRef.current;
    if (!sId) return;
    
    /*
    if (!force) {
      try {
        const cached = await getCachedData('sections');
        if (cached && cached.length > 0) {
          setSections(cached);
          return cached;
        }
      } catch (e) {
        console.warn('Failed to load cached sections:', e);
      }
    }
    */

    try {
      const response = await scopedGet('/api/academics/sections/', sId, {}, { timeout: 15000 });
      const data = Array.isArray(response.data) ? response.data : (response.data.results || []);
      setSections(data);
      if (data.length > 0) await cacheData('sections', data);
      return data;
    } catch (error) {
      console.error('Error fetching sections:', error);
      // const cached = await getCachedData('sections');
      // if (cached && cached.length > 0) setSections(cached);
    }
  }, []);

  // Fetch students
  const refreshStudents = useCallback(async (schoolId, force = false) => {
    const sId = schoolId || schoolIdRef.current;
    if (!sId) return;

    if (!force) {
      try {
        const cached = await getCachedData('students');
        if (cached && cached.length > 0) {
          setStudents(cached);
          return cached;
        }
      } catch (e) {
        console.warn('Failed to load cached students:', e);
      }
    }

    try {
      const pageSize = 500;
      let allStudents = [];
      let page = 1;
      let hasNext = true;

      while (hasNext && page <= 20) {
        const res = await scopedGet('/api/academics/students/', sId, { page, page_size: pageSize }, { timeout: 60000 });
        const data = res.data;
        const arr = Array.isArray(data) ? data : (data?.results || []);
        allStudents = [...allStudents, ...arr];
        hasNext = Boolean(data?.next);
        page++;
        if (!arr.length) break;
      }

      setStudents(allStudents);
      if (allStudents.length > 0) await cacheData('students', allStudents);
      return allStudents;
    } catch (error) {
      console.error('Error fetching students:', error);
      const cached = await getCachedData('students');
      if (cached && cached.length > 0) setStudents(cached);
    }
  }, []);

  // Fetch subjects
  const refreshSubjects = useCallback(async (schoolId, force = false) => {
    const sId = schoolId || schoolIdRef.current;
    if (!sId) return;
    
    if (!force) {
      try {
        const cached = await getCachedData('subjects');
        if (cached && cached.length > 0) {
          setSubjects(cached);
          return cached;
        }
      } catch (e) {
        console.warn('Failed to load cached subjects:', e);
      }
    }

    try {
      const response = await scopedGet('/api/academics/subjects/', sId, {}, { timeout: 60000 });
      const data = Array.isArray(response.data) ? response.data : (response.data.results || []);
      setSubjects(data);
      if (data.length > 0) await cacheData('subjects', data);
      return data;
    } catch (error) {
      console.error('Error fetching subjects:', error);
      const cached = await getCachedData('subjects');
      if (cached && cached.length > 0) setSubjects(cached);
    }
  }, []);

  const isRefreshingRef = useRef(false);

  // Refresh all academic data
  const refreshAll = useCallback(async (schoolId, force = false) => {
    if (!schoolId) return;
    
    const sId = String(schoolId);
    if (isRefreshingRef.current) return;

    // IMPORTANT: Clear old data if switching school
    if (currentSchoolId && String(currentSchoolId) !== sId) {
        setClassrooms([]);
        setSections([]);
        setStudents([]);
        setSubjects([]);
        force = true;
    }

    // If not forced and we have data for the current school, skip
    if (!force && students.length > 0 && String(currentSchoolId) === sId) {
      return;
    }

    isRefreshingRef.current = true;
    setLoading(true);

    try {
      // Use force=false to allow cache usage if available
      await Promise.all([
        refreshClassrooms(sId, force),
        refreshSections(sId, force),
        refreshStudents(sId, force),
        refreshSubjects(sId, force)
      ]);

      setCurrentSchoolId(sId);
      console.log('Academic context refreshed successfully for school:', sId);
    } catch (error) {
      console.error('Error refreshing academic data:', error);
    } finally {
      setLoading(false);
      isRefreshingRef.current = false;
    }
  }, [refreshClassrooms, refreshSections, refreshStudents, refreshSubjects]);

  const fetchStudentsScoped = useCallback(async (schoolId, filters = {}) => {
      // (Implementation remains same, but ensured schoolId consistency)
      const sId = schoolId || schoolIdRef.current;
      if (!sId) return [];
      let all = [];
      try {
        const pageSize = 500;
        const maxPages = 30;
        for (let page = 1; page <= maxPages; page++) {
          const params = { page, page_size: pageSize, ...filters };
          const res = await scopedGet('/api/academics/students/', sId, params, { timeout: 60000 });
          const data = res.data;
          const arr = Array.isArray(data) ? data : (data?.results || []);
          if (!arr.length) break;
          all = [...all, ...arr];
          if (!data?.next) break;
        }
      } catch (e) { console.error(e); }
      return all;
  }, []);

  const updateStudentInContext = useCallback((updatedStudent) => {
    setStudents(prevStudents => {
      const index = prevStudents.findIndex(s => s.id === updatedStudent.id);
      if (index !== -1) {
        const newStudents = [...prevStudents];
        newStudents[index] = { ...newStudents[index], ...updatedStudent };
        return newStudents;
      }
      return [...prevStudents, updatedStudent];
    });
  }, []);

  const getStudentCountForSection = useCallback((sectionId) => {
    if (!Array.isArray(students)) return 0;
    return students.filter(s => {
      const sidRaw = s.section?.id ?? s.section;
      return sidRaw != null && Number(sidRaw) === Number(sectionId);
    }).length;
  }, [students]);

  const value = useMemo(() => ({
    classrooms,
    sections,
    students,
    subjects,
    currentSchoolId,
    refreshClassrooms,
    refreshSections,
    refreshStudents,
    refreshSubjects,
    refreshAll,
    clearData,
    fetchStudentsScoped,
    updateStudentInContext,
    getStudentCountForSection,
    setClassrooms,
    setSections,
    setStudents,
    setSubjects
  }), [classrooms, sections, students, subjects, currentSchoolId, refreshClassrooms, refreshSections, refreshStudents, refreshSubjects, refreshAll, clearData, fetchStudentsScoped, updateStudentInContext, getStudentCountForSection]);

  return (
    <AcademicsContext.Provider value={value}>
      {children}
    </AcademicsContext.Provider>
  );
};

export default AcademicsContext;
