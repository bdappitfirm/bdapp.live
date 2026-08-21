// src/App.jsx
import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { SchoolProvider } from './context/SchoolContext';
import { AcademicsProvider } from './context/AcademicsContext';
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import { isAuthenticated } from './utils/auth';
import { CircularProgress, Box, Typography } from '@mui/material';
import SyncManager from './components/SyncManager';
import {
  Paper, Stack, Button
} from '@mui/material';

const GlobalInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = React.useState(null);
  const [showPrompt, setShowPrompt] = React.useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <Paper
      elevation={10}
      sx={{
        position: 'fixed',
        top: 10,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        p: 1.5,
        width: { xs: '95%', sm: 'auto' },
        minWidth: { sm: 400 },
        borderRadius: 2,
        background: 'linear-gradient(135deg, #1a237e 0%, #3949ab 100%)',
        color: 'white',
        border: '1px solid rgba(255,255,255,0.2)'
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>সহজ ব্যবহারের জন্য অ্যাপটি ইনস্টল করুন!</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            size="small"
            sx={{ bgcolor: 'white', color: '#1a237e', fontWeight: 'bold', '&:hover': { bgcolor: '#f5f5f5' } }}
            onClick={handleInstallClick}
          >
            ইনস্টল
          </Button>
          <Button color="inherit" size="small" onClick={() => setShowPrompt(false)}>পরে</Button>
        </Stack>
      </Stack>
    </Paper>
  );
};

const APP_VERSION = '2.1.3';
const CACHE_VERSION_KEY = 'bdapp_cache_version';

// Cleaned up CacheClearer - no more redirect loops
const CacheClearer = () => {
  useEffect(() => {
    try {
      const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
      if (storedVersion && storedVersion !== APP_VERSION) {
        console.log(`Version mismatch: ${storedVersion} -> ${APP_VERSION}. Updating local storage...`);
        localStorage.setItem(CACHE_VERSION_KEY, APP_VERSION);
      } else if (!storedVersion) {
        localStorage.setItem(CACHE_VERSION_KEY, APP_VERSION);
      }
    } catch (e) {}
  }, []);
  return null;
};

const PublicVerify = React.lazy(() => import('./pages/PublicVerify'));
const WelcomePage = React.lazy(() => import('./pages/WelcomePage'));
const SchoolDashboard = React.lazy(() => import('./pages/SchoolDashboard.jsx'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const RoleDashboard = React.lazy(() => import('./pages/RoleDashboard'));
const RoleDetail = React.lazy(() => import('./pages/RoleDetail'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const SignupPage = React.lazy(() => import('./pages/SignupPage'));
const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = React.lazy(() => import('./pages/ResetPasswordPage'));
const ChangePasswordPage = React.lazy(() => import('./pages/ChangePasswordPage'));
const TeachersPage = React.lazy(() => import('./pages/TeachersPage'));
const AddTeacherPage = React.lazy(() => import('./pages/AddTeacherPage'));
const CredentialsPage = React.lazy(() => import('./pages/CredentialsPage'));
const TeacherCardsPage = React.lazy(() => import('./pages/TeacherCardsPage'));
const SoftwareAssistant = React.lazy(() => import('./pages/SoftwareAssistant.jsx'));
const StudentsPage = React.lazy(() => import('./pages/StudentsPage'));
const AddStudentPage = React.lazy(() => import('./pages/AddStudentPage'));
const EditStudentPage = React.lazy(() => import('./pages/EditStudentPage'));
const AcademicsPage = React.lazy(() => import('./pages/AcademicsPage'));
const ParentsPage = React.lazy(() => import('./pages/ParentsPage'));
const AddParentPage = React.lazy(() => import('./pages/AddParentPage'));
const ParentDashboard = React.lazy(() => import('./pages/ParentDashboard'));
const StudentDashboard = React.lazy(() => import('./pages/StudentDashboard'));
const ResultsPage = React.lazy(() => import('./pages/ResultsPage'));
const ExaminationsPage = React.lazy(() => import('./pages/ExaminationsPage'));
const ResultCardGenerator = React.lazy(() => import('./pages/ResultCardGenerator'));
const MeritListPage = React.lazy(() => import('./pages/MeritListPage'));
const RankListPage = React.lazy(() => import('./pages/RankListPage'));
const ToTListPage = React.lazy(() => import('./pages/ToTListPage'));
const VoterListPage = React.lazy(() => import('./pages/VoterListPage'));
const StudentListPage = React.lazy(() => import('./pages/StudentListPage'));
const SiblingsPage = React.lazy(() => import('./pages/SiblingsPage.jsx'));
const ClassResultsPage = React.lazy(() => import('./pages/ClassResultsPage'));
const IDCardGenerator = React.lazy(() => import('./pages/IDCardGenerator'));
const CertificateGenerator = React.lazy(() => import('./pages/CertificateGenerator'));
const AdmissionCardGenerator = React.lazy(() => import('./pages/AdmissionCardGenerator'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const SMSPage = React.lazy(() => import('./pages/SMSPage'));
const SubjectsPage = React.lazy(() => import('./pages/SubjectsPage'));
const ClassroomsPage = React.lazy(() => import('./pages/ClassroomsPage'));
const AddCommitteePage = React.lazy(() => import('./pages/AddCommitteePage'));
const AttendancePageNew = React.lazy(() => import('./pages/AttendancePageNew'));
const AttendanceReportCard = React.lazy(() => import('./pages/AttendanceReportCard'));
const FeesPage = React.lazy(() => import('./pages/FeesPage'));
const FeePaymentReceipt = React.lazy(() => import('./components/FeePaymentReceipt'));
const ReceiptBook = React.lazy(() => import('./components/ReceiptBook'));
const GroupsPage = React.lazy(() => import('./pages/GroupsPage'));
const SchoolsPage = React.lazy(() => import('./pages/SchoolsPage'));
const AttendanceRecordsPage = React.lazy(() => import('./pages/AttendanceRecordsPage'));
const YearReportPage = React.lazy(() => import('./pages/YearReportPage'));
const VirtualClassPage = React.lazy(() => import('./pages/VirtualClassPage'));
const SupportLivePage = React.lazy(() => import('./pages/SupportLive.jsx'));
const SchoolSettings = React.lazy(() => import('./pages/SchoolSettings.jsx'));
const SeatAllocationPage = React.lazy(() => import('./pages/SeatAllocationPage.jsx'));
const WhatsAppSettings = React.lazy(() => import('./pages/WhatsAppSettings.jsx'));
const BillingPage = React.lazy(() => import('./pages/billing/BillingPage.jsx'));
const BanbeisPage = React.lazy(() => import('./pages/BanbeisPage.jsx'));

const StartupRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    try {
      const unauth = !isAuthenticated();
      const path = location.pathname || '/';
      const protectedMatch = /^\/school\/[^/]+\/(results|examinations|fees|fee-receipt|receipt-book|groups|schools|id-card|certificate|admission-cards|sms|academics|attendance\/records|attendance\/report-card|year-report)(\/|$)/.test(path);
      if (unauth && protectedMatch && window.location.pathname === path) {
        const next = encodeURIComponent(path + location.search);
        navigate(`/login?next=${next}`, { replace: true });
      }
    } catch (_) {}
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

const PathTracker = () => {
  const location = useLocation();
  useEffect(() => {
    try {
      const path = location.pathname + (location.search || '');
      if (!/^\/login(\/|$)/.test(location.pathname)) {
        sessionStorage.setItem('lastPath', path);
        const m = location.pathname.match(/^\/school\/([^/]+)/);
        if (m && m[1]) {
          localStorage.setItem('currentSchoolId', m[1]);
        }
      }
    } catch (_) {}
  }, [location.pathname, location.search]);
  return null;
};

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch (e) {}
  }, [pathname]);
  return null;
};

const OfflineIndicator = () => {
  const [isOffline, setIsOffline] = React.useState(!navigator.onLine);

  useEffect(() => {
    const handleStatusChange = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        bgcolor: '#f44336',
        color: 'white',
        px: 2,
        py: 1,
        borderRadius: 2,
        zIndex: 10000,
        boxShadow: 3,
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}
    >
      <Box sx={{ width: 10, height: 10, bgcolor: 'white', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>অফলাইন মোড</Typography>
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </Box>
  );
};

function App() {
  return (
    <Router>
      <CacheClearer />
      <GlobalInstallPrompt />
      <OfflineIndicator />
      <ErrorBoundary>
        <AuthProvider>
          <ToastProvider>
            <SyncManager />
            <NotificationProvider>
              <SchoolProvider>
                <AcademicsProvider>
                  <Suspense fallback={
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        minHeight: '100vh',
                        gap: 2
                      }}
                    >
                      <CircularProgress />
                      <Typography variant="body1">Loading...</Typography>
                    </Box>
                  }>
                    <StartupRedirect />
                    <PathTracker />
                    <ScrollToTop />
                    <Routes>
          {/* হোমপেজে WelcomePage */}
          <Route path="/" element={<WelcomePage />} />
          <Route path="/verify/:studentId" element={<PublicVerify />} />

        {/* স্কুল ড্যাশবোর্ড + nested */}
        <Route path="/school/:id" element={<SchoolDashboard />}>
          <Route index element={<Box sx={{ p: 0 }} />} />
          <Route path="dashboard-stats" element={<Dashboard />} />
          <Route path="teacher" element={<TeachersPage />} />
          <Route path="teacher/add" element={<AddTeacherPage />} />
          <Route path="teacher/cards" element={<TeacherCardsPage />} />
          <Route path="student" element={<StudentsPage />} />
          <Route path="student/add" element={<AddStudentPage />} />
          <Route path="student/:studentId/edit" element={<EditStudentPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="banbeis" element={<BanbeisPage />} />
          <Route path="promotion" element={<ProtectedRoute allowedRoles={['admin','teacher']}><StudentsPage /></ProtectedRoute>} />
          <Route path="year-report" element={<ProtectedRoute allowedRoles={['admin','teacher']}><YearReportPage /></ProtectedRoute>} />
          <Route path="subjects" element={<SubjectsPage />} />
          <Route path="classes" element={<ClassroomsPage />} />
          <Route path="attendance" element={<AttendancePageNew />} />
          <Route path="attendance/records" element={<ProtectedRoute allowedRoles={['admin','teacher']}><AttendanceRecordsPage /></ProtectedRoute>} />
          <Route path="attendance/report-card" element={<ProtectedRoute allowedRoles={['admin','teacher']}><AttendanceReportCard /></ProtectedRoute>} />
          <Route path="academics" element={<ProtectedRoute allowedRoles={['admin','teacher']}><AcademicsPage /></ProtectedRoute>} />
          <Route path="live-class" element={<VirtualClassPage />} />
          <Route path="results" element={<ProtectedRoute allowedRoles={['admin','teacher']}><ResultsPage /></ProtectedRoute>} />
          <Route path="examinations" element={<ProtectedRoute allowedRoles={['admin','teacher']}><ExaminationsPage /></ProtectedRoute>} />
          <Route path="fees" element={<ProtectedRoute allowedRoles={['admin','teacher']}><FeesPage /></ProtectedRoute>} />
          <Route path="fee-receipt" element={<ProtectedRoute allowedRoles={['admin','teacher']}><FeePaymentReceipt /></ProtectedRoute>} />
          <Route path="receipt-book" element={<ProtectedRoute allowedRoles={['admin','teacher']}><ReceiptBook /></ProtectedRoute>} />
          <Route path="groups" element={<ProtectedRoute allowedRoles={['admin','teacher']}><GroupsPage /></ProtectedRoute>} />
          <Route path="schools" element={<ProtectedRoute allowedRoles={['admin','teacher']}><SchoolsPage /></ProtectedRoute>} />
          <Route path="result-card" element={<ResultCardGenerator />} />
          <Route path="class-results" element={<ProtectedRoute allowedRoles={['admin','teacher']}><ClassResultsPage /></ProtectedRoute>} />
          <Route path="rank-list" element={<RankListPage />} />
          <Route path="merit-list" element={<MeritListPage />} />
          <Route path="tot-list" element={<ToTListPage />} />
          <Route path="voter-list" element={<VoterListPage />} />
          <Route path="student-list" element={<StudentListPage />} />
          <Route path="siblings" element={<ProtectedRoute allowedRoles={['admin','teacher']}><SiblingsPage /></ProtectedRoute>} />
          <Route path="id-card" element={<IDCardGenerator />} />
          <Route path="certificate" element={<ProtectedRoute allowedRoles={['admin','teacher']}><CertificateGenerator /></ProtectedRoute>} />
          <Route path="admission-cards" element={<ProtectedRoute allowedRoles={['admin','teacher']}><AdmissionCardGenerator /></ProtectedRoute>} />
          <Route path="assistant" element={<SoftwareAssistant />} />
          <Route path="support-live" element={<ProtectedRoute><SupportLivePage /></ProtectedRoute>} />
          <Route path="sms" element={<ProtectedRoute allowedRoles={['admin','teacher']}><SMSPage /></ProtectedRoute>} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="admin" element={<RoleDashboard role="admin" />} />
          <Route path="settings" element={<ProtectedRoute allowedRoles={['admin']}><SchoolSettings /></ProtectedRoute>} />
          <Route path="whatsapp" element={<ProtectedRoute allowedRoles={['admin']}><WhatsAppSettings /></ProtectedRoute>} />
          <Route path="parent" element={<ParentsPage />} />
          <Route path="credentials" element={<ProtectedRoute allowedRoles={['admin']}><CredentialsPage /></ProtectedRoute>} />
          <Route path="parent/add" element={<AddParentPage />} />
          <Route path="parent/:parentId/dashboard" element={<ParentDashboard />} />
          <Route path="student/:studentId/dashboard" element={<StudentDashboard />} />
          <Route path="seat-allocation" element={<ProtectedRoute allowedRoles={['admin','teacher']}><SeatAllocationPage /></ProtectedRoute>} />
          <Route path="committee" element={<RoleDashboard role="committee" />} />
          <Route path="committee/add" element={<AddCommitteePage />} />
          <Route path=":role/:itemId" element={<RoleDetail />} />
        </Route>

        {/* লগইন */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:uid/:token" element={<ResetPasswordPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
                    </Routes>
                  </Suspense>
                </AcademicsProvider>
              </SchoolProvider>
            </NotificationProvider>
          </ToastProvider>
        </AuthProvider>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
