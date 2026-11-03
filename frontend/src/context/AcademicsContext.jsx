import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { scopedGet } from '../utils/schoolApi';
import { getCachedData, cacheData } from '../utils/offlineDb';
import { sortClassrooms } from '../utils/classroomUtils';

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

  // Helper to filter cached offline data by current active school
  const filterBySchool = useCallback((items, targetSchoolId) => {
    if (!Array.isArray(items) || !targetSchoolId) return [];
    const targetIdStr = String(targetSchoolId);
    return items.filter(item => {
      if (!item) return false;
      const sId = item.school_id ??
                  item.school?.id ??
                  (typeof item.school === 'number' || typeof item.school === 'string' ? item.school : null) ??
                  item.classroom?.school_id ??
                  item.classroom?.school?.id ??
                  (typeof item.classroom?.school === 'number' || typeof item.classroom?.school === 'string' ? item.classroom?.school : null);
      if (sId != null && String(sId) !== '') {
        return String(sId) === targetIdStr;
      }
      return false;
    });
  }, []);

  // Fetch classrooms
  const refreshClassrooms = useCallback(async (schoolId, force = false) => {
    const sId = schoolId || schoolIdRef.current;
    if (!sId) return;

    try {
      const response = await scopedGet('/api/academics/classrooms/', sId, { page_size: 1000 }, { timeout: 30000 });
      const data = Array.isArray(response.data) ? response.data : (response.data.results || []);
      const sorted = sortClassrooms(data);
      setClassrooms(sorted);
      if (sorted.length > 0) await cacheData('classrooms', sorted);
      return sorted;
    } catch (error) {
      console.warn('Network error fetching classrooms, falling back to local DB:', error);
      const cached = await getCachedData('classrooms');
      const schoolFiltered = filterBySchool(cached, sId);
      if (schoolFiltered && schoolFiltered.length > 0) {
        const sorted = sortClassrooms(schoolFiltered);
        setClassrooms(sorted);
        return sorted;
      }
    }
  }, [filterBySchool]);

  // Fetch sections
  const refreshSections = useCallback(async (schoolId, force = false) => {
    const sId = schoolId || schoolIdRef.current;
    if (!sId) return;

    try {
      const response = await scopedGet('/api/academics/sections/', sId, { page_size: 1000 }, { timeout: 15000 });
      const data = Array.isArray(response.data) ? response.data : (response.data.results || []);

      setSections(data);
      if (data.length > 0) await cacheData('sections', data);
      return data;
    } catch (error) {
      console.warn('Network error fetching sections, falling back to local DB:', error);
      const cached = await getCachedData('sections');
      const schoolFiltered = filterBySchool(cached, sId);
      if (schoolFiltered && schoolFiltered.length > 0) {
        setSections(schoolFiltered);
        return schoolFiltered;
      }
    }
  }, [filterBySchool]);

  // Fetch students
  const refreshStudents = useCallback(async (schoolId, force = false) => {
    const sId = schoolId || schoolIdRef.current;
    if (!sId) return;

    if (!force) {
      try {
        const cached = await getCachedData('students');
        const schoolFiltered = filterBySchool(cached, sId);
        if (schoolFiltered && schoolFiltered.length > 0) {
          setStudents(schoolFiltered);
          return schoolFiltered;
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

        // Update local state early if we have some data
        if (arr.length > 0) {
          const isFirstPage = page === 1;
          setStudents(prev => {
            const combined = isFirstPage ? arr : [...prev, ...arr];
            const seen = new Set();
            return combined.filter(s => {
              if (seen.has(s.id)) return false;
              seen.add(s.id);
              return true;
            });
          });
        }

        allStudents = [...allStudents, ...arr];
        hasNext = Boolean(data?.next);
        page++;
        if (!arr.length) break;
      }

      if (allStudents.length > 0) {
        setStudents(allStudents);
        await cacheData('students', allStudents);
      }
      return allStudents;
    } catch (error) {
      console.error('Error fetching students:', error);
      const cached = await getCachedData('students');
      const schoolFiltered = filterBySchool(cached, sId);
      if (schoolFiltered && schoolFiltered.length > 0) setStudents(schoolFiltered);
    }
  }, [filterBySchool]);

  // Fetch subjects
  const refreshSubjects = useCallback(async (schoolId, force = false) => {
    const sId = schoolId || schoolIdRef.current;
    if (!sId) return;
    
    if (!force) {
      try {
        const cached = await getCachedData('subjects');
        const schoolFiltered = filterBySchool(cached, sId);
        if (schoolFiltered && schoolFiltered.length > 0) {
          setSubjects(schoolFiltered);
          return schoolFiltered;
        }
      } catch (e) {
        console.warn('Failed to load cached subjects:', e);
      }
    }

    try {
      const response = await scopedGet('/api/academics/subjects/', sId, { page_size: 1000 }, { timeout: 60000 });
      const data = Array.isArray(response.data) ? response.data : (response.data.results || []);
      setSubjects(data);
      if (data.length > 0) await cacheData('subjects', data);
      return data;
    } catch (error) {
      console.error('Error fetching subjects:', error);
      const cached = await getCachedData('subjects');
      const schoolFiltered = filterBySchool(cached, sId);
      if (schoolFiltered && schoolFiltered.length > 0) setSubjects(schoolFiltered);
    }
  }, [filterBySchool]);

  const isRefreshingRef = useRef(false);

  // Refresh all academic data
  const refreshAll = useCallback(async (schoolId, force = false) => {
    if (!schoolId) return;
    
    const sId = String(schoolId);
    if (isRefreshingRef.current) return;

    const prevSchoolId = schoolIdRef.current;
    // IMPORTANT: Clear old data if switching school
    if (prevSchoolId && String(prevSchoolId) !== sId) {
        setClassrooms([]);
        setSections([]);
        setStudents([]);
        setSubjects([]);
        force = true;
    }

    // If not forced and we have students, skip re-fetching students, but ALWAYS refresh classrooms and sections
    if (!force && studentsCountRef.current > 0 && String(prevSchoolId) === sId) {
      await Promise.all([
        refreshClassrooms(sId, true),
        refreshSections(sId, true)
      ]);
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
    loading,
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
  }), [classrooms, sections, students, subjects, loading, currentSchoolId, refreshClassrooms, refreshSections, refreshStudents, refreshSubjects, refreshAll, clearData, fetchStudentsScoped, updateStudentInContext, getStudentCountForSection]);

  return (
    <AcademicsContext.Provider value={value}>
      {children}
    </AcademicsContext.Provider>
  );
};

export default AcademicsContext;
