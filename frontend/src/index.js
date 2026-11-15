import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { ThemeProvider, createTheme, responsiveFontSizes } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';

const root = ReactDOM.createRoot(document.getElementById('root'));

// safeLazy stale-chunk রিলোডের সময় URL-এ যোগ করা cache-buster প্যারামিটারটি
// সফলভাবে বুট হওয়ার পর সরিয়ে ফেলি, যাতে URL পরিষ্কার থাকে।
try {
  const cleanUrl = new URL(window.location.href);
  if (cleanUrl.searchParams.has('_bdapp_reload')) {
    cleanUrl.searchParams.delete('_bdapp_reload');
    window.history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
  }
} catch (_) {}

let theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: '"Hind Siliguri", "SolaimanLipi", "Roboto", "Helvetica", "Arial", sans-serif',
  },
});
theme = responsiveFontSizes(theme);

root.render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>
);

// Register Service Worker for offline PWA functionality & background asset precaching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // রিলোড লুপ আটকানোর জন্য (safeLazy চাঙ্ক লোড ব্যর্থ হলে যা সেট করে)
    try { sessionStorage.removeItem('bdapp_chunk_reloaded'); } catch (_) {}

    navigator.serviceWorker.register('/service-worker.js')
      .then((reg) => {
        console.log('✅ ServiceWorker registered successfully:', reg.scope);

        // নতুন বিল্ড আছে কিনা দ্রুত ধরে ফেলার জন্য পর্যায়ক্রমে চেক
        const checkForUpdate = () => {
          if (navigator.onLine) reg.update().catch(() => {});
        };
        checkForUpdate();
        setInterval(checkForUpdate, 15 * 60 * 1000);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdate();
        });

        // নতুন ভার্সন activate হলে ইউজারকে কিছু না জানিয়েই একবার নীরব রিলোড —
        // ফলে সর্বশেষ কোড/আপডেট ব্যবহারকারী টের না পেয়েই চালু হয়ে যায়।
        const hadController = !!navigator.serviceWorker.controller;
        let reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!hadController) return; // প্রথমবার ইনস্টল: রিলোড দরকার নেই
          if (reloading) return;
          reloading = true;
          window.location.reload();
        });
      })
      .catch((err) => {
        console.warn('⚠️ ServiceWorker registration failed:', err);
      });
  });
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
