// src/services/dashboardService.js
import api from '../utils/api';
import { getAccessToken } from '../utils/auth';

// Configure axios to use JWT token
const configureAxios = () => {
  const token = getAccessToken();
  if (token) {
    return { headers: { Authorization: `Bearer ${token}` } };
  }
  return {};
};

// Get dashboard statistics
export const getDashboardStats = async (schoolId = null, year = null, isSimple = false) => {
  try {
    console.log('getDashboardStats called with schoolId:', schoolId);
    const endpoint = isSimple ? '/api/dashboard-stats/simple/' : '/api/dashboard-stats/';
    console.log('Making request to:', endpoint);
    const response = await api.get(endpoint, {
      params: { school_id: schoolId || undefined, year: year || undefined },
      timeout: 30000 // Increased timeout to 30s
    });
    console.log('Dashboard stats response:', response.data);
    // Cache the stats
    if (schoolId) {
      localStorage.setItem(`dashboard_stats_${schoolId}`, JSON.stringify(response.data));
    }
    return response.data;
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    console.error('Error details:', error.response?.data);
    console.error('Error status:', error.response?.status);
    // Return cached stats if available
    if (schoolId) {
      const cached = localStorage.getItem(`dashboard_stats_${schoolId}`);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          console.error('Failed to parse cached stats:', e);
        }
      }
    }
    // Return default empty stats
    return {
      total_students: 0,
      total_teachers: 0,
      total_classes: 0,
      class_distribution: [],
      attendance_data: [],
      fee_collection: [],
      fee_dues_summary: null,
      fee_dues_by_class: []
    };
  }
};

// Get current school ID from localStorage or set default
export const getCurrentSchoolId = () => {
  return localStorage.getItem('currentSchoolId') || null;
};

// Set current school ID
export const setCurrentSchoolId = (schoolId) => {
  localStorage.setItem('currentSchoolId', schoolId);
};
