import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../utils/api';

// Simple parser to extract /school/:id from URL
function extractSchoolId(pathname) {
  const m = pathname.match(/\/school\/(\d+)/);
  return m ? m[1] : null;
}

const SchoolContext = createContext({
  schoolId: null,
  school: null,
  setSchoolId: () => {},
  refreshSchool: async () => {},
});

export function SchoolProvider({ children }) {
  const location = useLocation();
  const [schoolId, setSchoolId] = useState(() => localStorage.getItem('currentSchoolId'));
  const [school, setSchool] = useState(null);

  // Keep localStorage in sync
  useEffect(() => {
    if (schoolId) localStorage.setItem('currentSchoolId', schoolId);
  }, [schoolId]);

  // Update schoolId from URL changes
  useEffect(() => {
    const idFromUrl = extractSchoolId(location.pathname);
    if (idFromUrl && idFromUrl !== schoolId) {
      setSchoolId(idFromUrl);
    }
  }, [location.pathname, schoolId]);

  // Load school data when schoolId changes
  useEffect(() => {
    if (!schoolId) { setSchool(null); return; }
    (async () => {
      try {
        const res = await api.get(`/api/schools/${schoolId}/`);
        setSchool(res.data);
      } catch (e) {
        // ignore
      }
    })();
  }, [schoolId]);

  const refreshSchool = React.useCallback(async () => {
    if (!schoolId) return;
    try {
      const res = await api.get(`/api/schools/${schoolId}/`);
      setSchool(res.data);
    } catch (e) {}
  }, [schoolId]);

  const value = useMemo(() => ({ schoolId, school, setSchoolId, refreshSchool }), [schoolId, school, refreshSchool]);
  return (
    <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>
  );
}

export function useSchool() {
  return useContext(SchoolContext);
}
