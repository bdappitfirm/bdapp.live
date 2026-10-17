import './reactRefreshShim';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
// index.js বা App.js এ
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { CssBaseline } from '@mui/material';
import { ThemeProvider, createTheme, responsiveFontSizes } from '@mui/material/styles';

const root = ReactDOM.createRoot(document.getElementById('root'));
let theme = createTheme({
  typography: {
    fontSize: 16,
  },
  components: {
    MuiTableContainer: {
      styleOverrides: {
        root: {
          overflowX: 'auto',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiInputBase-input': {
            fontSize: '1rem',
          },
          '& .MuiInputLabel-root': {
            fontSize: '1rem',
          },
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          fontSize: '1.1rem',
          fontWeight: 500,
        },
      },
    },
  },
});
theme = responsiveFontSizes(theme);

root.render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>
);

// Register service worker for offline support and PWA caching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((reg) => {
        console.log('✅ ServiceWorker registered with scope:', reg.scope);
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
