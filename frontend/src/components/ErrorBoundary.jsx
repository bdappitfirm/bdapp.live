import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
    
    // Auto-reload on chunk load errors ONLY when online
    if ((error.name === 'ChunkLoadError' || error.message?.includes('Loading chunk')) && navigator.onLine) {
      console.log('Chunk load error detected online - reloading page...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Optional: redirect to home, or just reset
    if (this.props.redirectOnReset !== false) {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error?.name === 'ChunkLoadError' || this.state.error?.message?.includes('Loading chunk');
      
      // You can render any custom fallback UI
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            backgroundColor: '#f5f5f5',
            p: 3
          }}
        >
          <Paper
            elevation={3}
            sx={{
              p: 4,
              maxWidth: 500,
              textAlign: 'center',
              borderRadius: 4
            }}
          >
            <ErrorOutlineIcon sx={{ fontSize: 64, color: '#d32f2f', mb: 2 }} />
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
              {isChunkError ? 'লোডিং সমস্যা!' : 'দুঃখিত, কিছু ভুল হয়েছে'}
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              {isChunkError 
                ? 'অ্যাপটি আপডেট হয়েছে, স্বয়ংক্রিয়ভাবে রিফ্রেশ হয়ে যাচ্ছে...' 
                : 'দয়া করে রিফ্রেশ করুন বা ড্যাশবোর্ডে ফিরে যান।'
              }
            </Typography>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Box sx={{ mt: 2, p: 2, bgcolor: '#ffebee', borderRadius: 2, textAlign: 'left' }}>
                <Typography variant="caption" color="error" component="pre" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {this.state.error.toString()}
                </Typography>
              </Box>
            )}
            <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => window.location.reload()}
                sx={{ borderRadius: 2, px: 3 }}
              >
                রিফ্রেশ করুন
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={this.handleReset}
                sx={{ borderRadius: 2, px: 4 }}
              >
                ড্যাশবোর্ডে ফিরে যান
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
