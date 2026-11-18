// src/App.jsx
import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { SchoolProvider } from './context/SchoolContext';
import { AcademicsProvider } from './context/AcademicsContext';
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import { CircularProgress, Box, Typography, Paper, Stack, Button } from '@mui/material';
import SignalWifiOffIcon from '@mui/icons-material/SignalWifiOff';
import SyncManager from './components/SyncManager';
import { startAutoSync } from './utils/offlineDb';

// Offline Page Fallback Component (shows clean message instead of white blank screen)
const OfflinePageFallback = () => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      p: 3,
      textAlign: 'center'
    }}
  >
    <Paper elevation={3} sx={{ p: 4, borderRadius: 3, maxWidth: 460 }}>
      <SignalWifiOffIcon sx={{ fontSize: 56, color: '#f44336', mb: 1.5 }} />
      <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
        পেজটি অফলাইনে ডাউনলোডেড নেই
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        আপনি এখন অফলাইনে আছেন; এই পেজটি এখনো ডিভাইসে সেভ করা নেই। প্রথমবার অনলাইনে একবার লোড করার পর পেজটি সবসময় অফলাইনে পাওয়া যাবে।
      </Typography>
      <Button variant="contained" onClick={() => window.history.back()}>
        পিছনে ফিরে যান
      </Button>
    </Paper>
  </Box>
);

// Safe Lazy Component Loader that catches chunk import errors offline
const CHUNK_RELOAD_FLAG = 'bdapp_chunk_reloaded';

export const safeLazy = (importFn) => {
  return React.lazy(async () => {
    try {
      const module = await importFn();
      try { sessionStorage.removeItem(CHUNK_RELOAD_FLAG); } catch (_) {}
      if (module && (module.default || typeof module === 'function')) {
        return module;
      }
      return { default: OfflinePageFallback };
    } catch (error) {
      console.warn('SafeLazy: Chunk load attempt failed', error);

      if (navigator.onLine) {
        // Quick retry (150ms delay for temporary network blips)
        try {
          await new Promise((r) => setTimeout(r, 150));
          const module = await importFn();
          try { sessionStorage.removeItem(CHUNK_RELOAD_FLAG); } catch (_) {}
          if (module && (module.default || typeof module === 'function')) {
            return module;
          }
        } catch (retryErr) {
          console.warn('SafeLazy: Retry failed', retryErr);
        }

        // Stale deployment chunk cache-busting reload check
        let alreadyReloaded = false;
        try { alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_FLAG) === '1'; } catch (_) {}
        if (!alreadyReloaded) {
          try { sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1'); } catch (_) {}
          try {
            const freshUrl = new URL(window.location.href);
            freshUrl.searchParams.set('_bdapp_reload', String(Date.now()));
            window.location.replace(freshUrl.toString());
          } catch (_) {
            window.location.reload();
          }
        }
      }

      return { default: OfflinePageFallback };
    }
  });
};

const GlobalInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = React.useState(null);
  const [showPrompt, setShowPrompt] = React.useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
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

const PublicVerify = safeLazy(() => import('./pages/PublicVerify'));
const WelcomePage = safeLazy(() => import('./pages/WelcomePage'));
const SchoolDashboard = safeLazy(() => import('./pages/SchoolDashboard.jsx'));
const Dashboard = safeLazy(() => import('./pages/Dashboard'));
const RoleDashboard = safeLazy(() => import('./pages/RoleDashboard'));
const RoleDetail = safeLazy(() => import('./pages/RoleDetail'));
const LoginPage = safeLazy(() => import('./pages/LoginPage'));
const SignupPage = safeLazy(() => import('./pages/SignupPage'));
const ForgotPasswordPage = safeLazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = safeLazy(() => import('./pages/ResetPasswordPage'));
const ChangePasswordPage = safeLazy(() => import('./pages/ChangePasswordPage'));
const TeachersPage = safeLazy(() => import('./pages/TeachersPage'));
const AddTeacherPage = safeLazy(() => import('./pages/AddTeacherPage'));
const CredentialsPage = safeLazy(() => import('./pages/CredentialsPage'));
const TeacherCardsPage = safeLazy(() => import('./pages/TeacherCardsPage'));
const SoftwareAssistant = safeLazy(() => import('./pages/SoftwareAssistant.jsx'));
const StudentsPage = safeLazy(() => import('./pages/StudentsPage'));
const AddStudentPage = safeLazy(() => import('./pages/AddStudentPage'));
const EditStudentPage = safeLazy(() => import('./pages/EditStudentPage'));
const AcademicsPage = safeLazy(() => import('./pages/AcademicsPage'));
const ParentsPage = safeLazy(() => import('./pages/ParentsPage'));
const AddParentPage = safeLazy(() => import('./pages/AddParentPage'));
const ParentDashboard = safeLazy(() => import('./pages/ParentDashboard'));
const StudentDashboard = safeLazy(() => import('./pages/StudentDashboard'));
const ResultsPage = safeLazy(() => import('./pages/ResultsPage'));
const ExaminationsPage = safeLazy(() => import('./pages/ExaminationsPage'));
const ResultCardGenerator = safeLazy(() => import('./pages/ResultCardGenerator'));
const MeritListPage = safeLazy(() => import('./pages/MeritListPage'));
const RankListPage = safeLazy(() => import('./pages/RankListPage'));
const ToTListPage = safeLazy(() => import('./pages/ToTListPage'));
const VoterListPage = safeLazy(() => import('./pages/VoterListPage'));
const StudentListPage = safeLazy(() => import('./pages/StudentListPage'));
const SiblingsPage = safeLazy(() => import('./pages/SiblingsPage.jsx'));
const ClassResultsPage = safeLazy(() => import('./pages/ClassResultsPage'));
const TopSheetPage = safeLazy(() => import('./pages/TopSheetPage'));
const IDCardGenerator = safeLazy(() => import('./pages/IDCardGenerator'));
const CertificateGenerator = safeLazy(() => import('./pages/CertificateGenerator'));
const AdmissionCardGenerator = safeLazy(() => import('./pages/AdmissionCardGenerator'));
const ProfilePage = safeLazy(() => import('./pages/ProfilePage'));
const SMSPage = safeLazy(() => import('./pages/SMSPage'));
const SubjectsPage = safeLazy(() => import('./pages/SubjectsPage'));
const ClassroomsPage = safeLazy(() => import('./pages/ClassroomsPage'));
const AddCommitteePage = safeLazy(() => import('./pages/AddCommitteePage'));
const AttendancePageNew = safeLazy(() => import('./pages/AttendancePageNew'));
const AttendanceReportCard = safeLazy(() => import('./pages/AttendanceReportCard'));
const FeesPage = safeLazy(() => import('./pages/FeesPage'));
const DailyCollectionRegisterPage = safeLazy(() => import('./pages/DailyCollectionRegisterPage.jsx'));
const FeePaymentReceipt = safeLazy(() => import('./components/FeePaymentReceipt'));
const ReceiptBook = safeLazy(() => import('./components/ReceiptBook'));
const GroupsPage = safeLazy(() => import('./pages/GroupsPage'));
const SchoolsPage = safeLazy(() => import('./pages/SchoolsPage'));
const AttendanceRecordsPage = safeLazy(() => import('./pages/AttendanceRecordsPage'));
const YearReportPage = safeLazy(() => import('./pages/YearReportPage'));
const VirtualClassPage = safeLazy(() => import('./pages/VirtualClassPage'));
const SupportLivePage = safeLazy(() => import('./pages/SupportLive.jsx'));
const SchoolSettings = safeLazy(() => import('./pages/SchoolSettings.jsx'));
const SeatAllocationPage = safeLazy(() => import('./pages/SeatAllocationPage.jsx'));
const WhatsAppSettings = safeLazy(() => import('./pages/WhatsAppSettings.jsx'));
const BillingPage = safeLazy(() => import('./pages/billing/BillingPage.jsx'));
const SoftwareAccountsPage = safeLazy(() => import('./pages/SoftwareAccountsPage.jsx'));
const BanbeisPage = safeLazy(() => import('./pages/BanbeisPage.jsx'));
const PayrollPage = safeLazy(() => import('./pages/PayrollPage.jsx'));
const PayslipGenerator = safeLazy(() => import('./pages/PayslipGenerator.jsx'));
const AllStudentsOverviewPage = safeLazy(() => import('./pages/AllStudentsOverviewPage.jsx'));
const EmployeePage = safeLazy(() => import('./pages/EmployeePage.jsx'));
const EmployeeIDCardGenerator = safeLazy(() => import('./pages/EmployeeIDCardGenerator.jsx'));
const BenchStickerGenerator = safeLazy(() => import('./pages/BenchStickerGenerator'));
const IDCardRibbonGenerator = safeLazy(() => import('./pages/IDCardRibbonGenerator.jsx'));

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
  useEffect(() => {
    const stopAutoSync = startAutoSync(30000);
    return () => {
      stopAutoSync();
    };
  }, []);

  return null;
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
                    <PathTracker />
                    <ScrollToTop />
                    <Routes>
          {/* হোমপেজে WelcomePage */}
          <Route path="/" element={<WelcomePage />} />
          <Route path="/verify/:studentId" element={<PublicVerify />} />

        {/* স্কুল ড্যাশবোর্ড + nested */}
        <Route path="/school/:id" element={<SchoolDashboard />}>
          <Route index element={<Box sx={{ p: 0 }} />} />
          <Route path="dashboard-stats" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="teacher" element={<ProtectedRoute allowedRoles={['admin','teacher']}><TeachersPage /></ProtectedRoute>} />
          <Route path="teacher/add" element={<ProtectedRoute allowedRoles={['admin']}><AddTeacherPage /></ProtectedRoute>} />
          <Route path="teacher/cards" element={<ProtectedRoute allowedRoles={['admin','teacher']}><TeacherCardsPage /></ProtectedRoute>} />
          <Route path="student" element={<ProtectedRoute allowedRoles={['admin','teacher']}><StudentsPage /></ProtectedRoute>} />
          <Route path="student/add" element={<ProtectedRoute allowedRoles={['admin','teacher']}><AddStudentPage /></ProtectedRoute>} />
          <Route path="student/:studentId/edit" element={<ProtectedRoute allowedRoles={['admin','teacher']}><EditStudentPage /></ProtectedRoute>} />
          <Route path="billing" element={<ProtectedRoute allowedRoles={['admin']}><BillingPage /></ProtectedRoute>} />
          <Route path="accounts" element={<ProtectedRoute allowedRoles={['admin']}><SoftwareAccountsPage /></ProtectedRoute>} />
          <Route path="banbeis" element={<ProtectedRoute allowedRoles={['admin','teacher']}><BanbeisPage /></ProtectedRoute>} />
          <Route path="promotion" element={<ProtectedRoute allowedRoles={['admin','teacher']}><StudentsPage /></ProtectedRoute>} />
          <Route path="year-report" element={<ProtectedRoute allowedRoles={['admin','teacher']}><YearReportPage /></ProtectedRoute>} />
          <Route path="subjects" element={<ProtectedRoute allowedRoles={['admin','teacher']}><SubjectsPage /></ProtectedRoute>} />
          <Route path="classes" element={<ProtectedRoute allowedRoles={['admin','teacher']}><ClassroomsPage /></ProtectedRoute>} />
          <Route path="attendance" element={<ProtectedRoute allowedRoles={['admin','teacher']}><AttendancePageNew /></ProtectedRoute>} />
          <Route path="attendance/records" element={<ProtectedRoute allowedRoles={['admin','teacher']}><AttendanceRecordsPage /></ProtectedRoute>} />
          <Route path="attendance/report-card" element={<ProtectedRoute allowedRoles={['admin','teacher']}><AttendanceReportCard /></ProtectedRoute>} />
          <Route path="academics" element={<ProtectedRoute allowedRoles={['admin','teacher']}><AcademicsPage /></ProtectedRoute>} />
          <Route path="live-class" element={<ProtectedRoute allowedRoles={['admin','teacher','student']}><VirtualClassPage /></ProtectedRoute>} />
          <Route path="results" element={<ProtectedRoute allowedRoles={['admin','teacher']}><ResultsPage /></ProtectedRoute>} />
          <Route path="examinations" element={<ProtectedRoute allowedRoles={['admin','teacher']}><ExaminationsPage /></ProtectedRoute>} />
          <Route path="fees" element={<ProtectedRoute allowedRoles={['admin','teacher']}><FeesPage /></ProtectedRoute>} />
          <Route path="daily-collection-register" element={<ProtectedRoute><DailyCollectionRegisterPage /></ProtectedRoute>} />
          <Route path="fee-receipt" element={<ProtectedRoute allowedRoles={['admin','teacher']}><FeePaymentReceipt /></ProtectedRoute>} />
          <Route path="receipt-book" element={<ProtectedRoute allowedRoles={['admin','teacher']}><ReceiptBook /></ProtectedRoute>} />
          <Route path="groups" element={<ProtectedRoute allowedRoles={['admin','teacher']}><GroupsPage /></ProtectedRoute>} />
          <Route path="schools" element={<ProtectedRoute allowedRoles={['admin']}><SchoolsPage /></ProtectedRoute>} />
          <Route path="result-card" element={<ProtectedRoute allowedRoles={['admin','teacher','student','parent']}><ResultCardGenerator /></ProtectedRoute>} />
          <Route path="class-results" element={<ProtectedRoute allowedRoles={['admin','teacher']}><ClassResultsPage /></ProtectedRoute>} />
          <Route path="top-sheet" element={<ProtectedRoute allowedRoles={['admin','teacher']}><TopSheetPage /></ProtectedRoute>} />
          <Route path="rank-list" element={<ProtectedRoute allowedRoles={['admin','teacher']}><RankListPage /></ProtectedRoute>} />
          <Route path="merit-list" element={<ProtectedRoute allowedRoles={['admin','teacher']}><MeritListPage /></ProtectedRoute>} />
          <Route path="tot-list" element={<ProtectedRoute allowedRoles={['admin','teacher']}><ToTListPage /></ProtectedRoute>} />
          <Route path="voter-list" element={<ProtectedRoute allowedRoles={['admin','teacher']}><VoterListPage /></ProtectedRoute>} />
          <Route path="student-list" element={<ProtectedRoute allowedRoles={['admin','teacher']}><StudentListPage /></ProtectedRoute>} />
          <Route path="all-students-overview" element={<ProtectedRoute allowedRoles={['admin','teacher','student','parent','committee']}><AllStudentsOverviewPage /></ProtectedRoute>} />
          <Route path="siblings" element={<ProtectedRoute allowedRoles={['admin','teacher']}><SiblingsPage /></ProtectedRoute>} />
          <Route path="id-card" element={<ProtectedRoute allowedRoles={['admin','teacher']}><IDCardGenerator /></ProtectedRoute>} />
          <Route path="certificate" element={<ProtectedRoute allowedRoles={['admin','teacher']}><CertificateGenerator /></ProtectedRoute>} />
          <Route path="admission-cards" element={<ProtectedRoute allowedRoles={['admin','teacher']}><AdmissionCardGenerator /></ProtectedRoute>} />
          <Route path="bench-sticker" element={<ProtectedRoute allowedRoles={['admin','teacher']}><BenchStickerGenerator /></ProtectedRoute>} />
          <Route path="id-card-ribbon" element={<ProtectedRoute allowedRoles={['admin','teacher']}><IDCardRibbonGenerator /></ProtectedRoute>} />
          <Route path="assistant" element={<ProtectedRoute><SoftwareAssistant /></ProtectedRoute>} />
          <Route path="support-live" element={<ProtectedRoute><SupportLivePage /></ProtectedRoute>} />
          <Route path="sms" element={<ProtectedRoute allowedRoles={['admin','teacher']}><SMSPage /></ProtectedRoute>} />
          <Route path="payroll" element={<ProtectedRoute allowedRoles={['admin']}><PayrollPage /></ProtectedRoute>} />
          <Route path="employee" element={<ProtectedRoute allowedRoles={['admin','teacher']}><EmployeePage /></ProtectedRoute>} />
          <Route path="employee/id-card" element={<ProtectedRoute allowedRoles={['admin','teacher']}><EmployeeIDCardGenerator /></ProtectedRoute>} />
          <Route path="payslip/:recordId" element={<ProtectedRoute allowedRoles={['admin','teacher']}><PayslipGenerator /></ProtectedRoute>} />
          <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="admin" element={<ProtectedRoute allowedRoles={['admin']}><RoleDashboard role="admin" /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute allowedRoles={['admin']}><SchoolSettings /></ProtectedRoute>} />
          <Route path="whatsapp" element={<ProtectedRoute allowedRoles={['admin']}><WhatsAppSettings /></ProtectedRoute>} />
          <Route path="parent" element={<ProtectedRoute allowedRoles={['admin','teacher']}><ParentsPage /></ProtectedRoute>} />
          <Route path="credentials" element={<ProtectedRoute allowedRoles={['admin']}><CredentialsPage /></ProtectedRoute>} />
          <Route path="parent/add" element={<ProtectedRoute allowedRoles={['admin','teacher']}><AddParentPage /></ProtectedRoute>} />
          <Route path="parent/:parentId/dashboard" element={<ProtectedRoute allowedRoles={['admin','teacher','parent']}><ParentDashboard /></ProtectedRoute>} />
          <Route path="student/:studentId/dashboard" element={<ProtectedRoute allowedRoles={['admin','teacher','student','parent']}><StudentDashboard /></ProtectedRoute>} />
          <Route path="seat-allocation" element={<ProtectedRoute allowedRoles={['admin','teacher']}><SeatAllocationPage /></ProtectedRoute>} />
          <Route path="committee" element={<ProtectedRoute allowedRoles={['admin','committee']}><RoleDashboard role="committee" /></ProtectedRoute>} />
          <Route path="committee/add" element={<ProtectedRoute allowedRoles={['admin']}><AddCommitteePage /></ProtectedRoute>} />
          <Route path=":role/:itemId" element={<ProtectedRoute><RoleDetail /></ProtectedRoute>} />
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
