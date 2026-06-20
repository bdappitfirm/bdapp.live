import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Grid,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  CircularProgress
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import LoginIcon from '@mui/icons-material/Login';
import InputIcon from '@mui/icons-material/Input';
import api from '../../utils/api';

const MasterMonitor = () => {
  const [logs, setLogs] = useState([]);
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMonitorData = async () => {
    try {
      const [logsRes, reportsRes] = await Promise.all([
        api.get('/api/users/activities/?limit=50'),
        api.get('/api/users/activities/reports/')
      ]);
      setLogs(logsRes.data.results || logsRes.data);
      setReports(reportsRes.data);
    } catch (err) {
      console.error('Monitoring failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitorData();
    const interval = setInterval(fetchMonitorData, 10000); // Polling every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const getActionIcon = (type) => {
    switch (type) {
      case 'profile_create': return <PersonAddIcon sx={{ color: '#4ade80' }} />;
      case 'login': return <LoginIcon sx={{ color: '#60a5fa' }} />;
      case 'result_input':
      case 'data_input': return <InputIcon sx={{ color: '#fbbf24' }} />;
      default: return <InputIcon sx={{ color: '#94a3b8' }} />;
    }
  };

  if (loading && !reports) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  const getActionLabel = (log) => {
    switch (log.action_type) {
      case 'profile_create':
        return 'নতুন প্রোফাইল তৈরি';
      case 'login':
        return 'লগইন';
      case 'result_input':
        return 'ফলাফল ইনপুট';
      case 'data_input':
        return 'ডেটা ইনপুট';
      default:
        return 'অ্যাক্টিভিটি';
    }
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: 'text.primary' }}>
        🌍 Master Monitoring System
      </Typography>

      <Grid container spacing={3}>
        {/* Statistics Cards */}
        <Grid item xs={12} md={4}>
          <Card elevation={3} sx={{ 
            background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
            borderRadius: '16px'
          }}>
            <CardContent>
              <Typography color="rgba(255,255,255,0.8)" gutterBottom>
                মোট প্রোফাইল আয় (৫ টাকা হারে)
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'white' }}>
                ৳ {reports?.total_earnings || 0}
              </Typography>
              <Typography variant="caption" display="block" sx={{ mt: 1, color: 'rgba(255,255,255,0.7)' }}>
                প্রতিটি প্রোফাইল ক্রিয়েশন বাবদ ৫ টাকা হিসেবে
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card elevation={3} sx={{ 
            background: 'linear-gradient(135deg, #15803d 0%, #22c55e 100%)',
            borderRadius: '16px'
          }}>
            <CardContent>
              <Typography color="rgba(255,255,255,0.8)" gutterBottom>
                আজকের মোট ইনপুট
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'white' }}>
                {reports?.daily_stats?.[0]?.count || 0}
              </Typography>
              <Typography variant="caption" display="block" sx={{ mt: 1, color: 'rgba(255,255,255,0.7)' }}>
                আজকের মোট প্রোফাইল ক্রিয়েশন সংখ্যা
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card elevation={3} sx={{ 
            background: 'linear-gradient(135deg, #b45309 0%, #f97316 100%)',
            borderRadius: '16px'
          }}>
            <CardContent>
              <Typography color="rgba(255,255,255,0.8)" gutterBottom>
                সক্রিয় স্কুলসমূহ
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'white' }}>
                {reports?.school_stats?.length || 0}
              </Typography>
              <Typography variant="caption" display="block" sx={{ mt: 1, color: 'rgba(255,255,255,0.7)' }}>
                গত ৩০ দিনে অ্যাক্টিভিটি থাকা স্কুল
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Live Feed - Scrollable like betting apps */}
        <Grid item xs={12} md={7}>
          <Paper elevation={3} sx={{ 
            p: 2, 
            borderRadius: '16px',
            background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
            border: '1px solid #334155'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#f1f5f9' }}>
                🎥 Live Activity Feed (রিয়েল-টাইম মনিটরিং)
              </Typography>
              <Box
                component="span"
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: '#ef4444',
                  animation: 'pulse 1.5s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { 
                      opacity: 1,
                      boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.7)'
                    },
                    '50%': { 
                      opacity: 0.5,
                      boxShadow: '0 0 0 10px rgba(239, 68, 68, 0)'
                    }
                  }
                }}
              />
            </Box>
            <Divider sx={{ mb: 2, borderColor: '#334155' }} />
            <List
              sx={{
                maxHeight: 550,
                overflow: 'auto',
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  bgcolor: '#0f172a',
                  borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb': {
                  bgcolor: '#475569',
                  borderRadius: '4px',
                  '&:hover': {
                    bgcolor: '#64748b',
                  }
                },
              }}
            >
              {logs.map((log, index) => (
                <ListItem
                  key={log.id}
                  divider
                  sx={{
                    borderRadius: '12px',
                    mb: 1,
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid #334155',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      background: 'rgba(51, 65, 85, 0.9)',
                      transform: 'translateX(4px)',
                    },
                    animation: `slideIn 0.5s ease-out ${index * 0.1}s both`,
                    '@keyframes slideIn': {
                      from: { 
                        opacity: 0, 
                        transform: 'translateX(-20px)' 
                      },
                      to: { 
                        opacity: 1, 
                        transform: 'translateX(0)' 
                      },
                    }
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ 
                      background: 'transparent',
                      '& svg': { fontSize: '2rem' }
                    }}>
                      {getActionIcon(log.action_type)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#f8fafc' }}>
                            {log.user_full_name || log.username}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                            (ID: {log.user_id || 'N/A'} • রোল: {log.user_role || 'N/A'})
                          </Typography>
                        </Box>
                        <Chip
                          label={new Date(log.timestamp).toLocaleTimeString()}
                          size="small"
                          sx={{ 
                            bgcolor: '#1e293b',
                            color: '#cbd5e1',
                            fontSize: '0.7rem',
                            fontWeight: 'bold'
                          }}
                        />
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Chip
                            label={`[${log.school_name}]`}
                            size="small"
                            sx={{ 
                              bgcolor: '#1d4ed8',
                              color: 'white',
                              fontWeight: 'bold',
                              fontSize: '0.7rem'
                            }}
                          />
                          <Typography variant="body2" component="span" sx={{ color: '#cbd5e1' }}>
                            • {getActionLabel(log)}
                          </Typography>
                        </Box>
                        {log.action_type === 'profile_create' && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              size="small"
                              label={`+৳${log.cost} • ${log.details.role || 'student'}`}
                              sx={{ 
                                background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '0.75rem',
                                animation: 'pulseCost 1s ease-in-out infinite',
                                '@keyframes pulseCost': {
                                  '0%, 100%': { transform: 'scale(1)' },
                                  '50%': { transform: 'scale(1.05)' },
                                }
                              }}
                            />
                          </Box>
                        )}
                        {log.action_type === 'profile_create' && (
                          <Typography variant="caption" display="block" sx={{ mt: 0.5, color: '#94a3b8' }}>
                            তৈরি করা হয়েছে: {log.details.name || 'N/A'} (রোল: {log.details.roll || 'N/A'}, ক্লাস: {log.details.class || 'N/A'})
                          </Typography>
                        )}
                        {log.action_type !== 'profile_create' && (
                          <Typography variant="caption" display="block" sx={{ mt: 0.5, color: '#94a3b8' }}>
                            IP: {log.ip_address || 'N/A'}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
              {logs.length === 0 && (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography align="center" sx={{ color: '#94a3b8' }}>
                    কোন অ্যাক্টিভিটি পাওয়া যায়নি
                  </Typography>
                </Box>
              )}
            </List>
          </Paper>
        </Grid>

        {/* Billing / Earnings Report */}
        <Grid item xs={12} md={5}>
          <Paper elevation={3} sx={{ 
            p: 2, 
            borderRadius: '16px',
            background: '#f8fafc'
          }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', fontWeight: 'bold', color: '#1e293b' }}>
              💰 স্কুল ভিত্তিক বিলিং রিপোর্ট (৩০ দিন)
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <TableContainer sx={{ maxHeight: 280, borderRadius: '8px' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#e2e8f0' }}>
                    <TableCell sx={{ fontWeight: 'bold', color: '#1e293b' }}>স্কুলের নাম</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#1e293b' }}>ইনপুট</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: '#1e293b' }}>বিল (৳)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reports?.school_stats?.map((stat) => (
                    <TableRow 
                      key={stat.school__id} 
                      hover 
                      sx={{ 
                        '&:nth-of-type(odd)': {
                          bgcolor: 'rgba(226, 232, 240, 0.3)'
                        }
                      }}
                    >
                      <TableCell sx={{ fontWeight: 500 }}>{stat.school__name}</TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={stat.count} 
                          size="small" 
                          sx={{ 
                            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                            color: 'white',
                            fontWeight: 'bold'
                          }} 
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: '#16a34a', fontSize: '1rem' }}>
                        ৳ {stat.total_cost}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!reports?.school_stats || reports.school_stats.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} align="center">তথ্য নেই</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper elevation={3} sx={{ 
            p: 2, 
            mt: 3, 
            borderRadius: '16px', 
            bgcolor: '#f1f5f9' 
          }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: '#1e293b' }}>📊 তারিখ ভিত্তিক হিসাব</Typography>
            <Divider sx={{ mb: 1 }} />
            <List size="small">
              {reports?.daily_stats?.slice(0, 7).map((stat) => (
                <ListItem
                  key={stat.date}
                  sx={{
                    py: 0.75,
                    borderBottom: '1px solid #e2e8f0',
                    '&:last-child': { borderBottom: 0 },
                    borderRadius: '8px'
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                          {new Date(stat.date).toLocaleDateString('bn-BD')}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                          <Chip 
                            label={`${stat.count} টি`} 
                            size="small" 
                            sx={{ 
                              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                              color: 'white',
                              fontWeight: 'bold'
                            }} 
                          />
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#16a34a', fontSize: '1rem' }}>
                            ৳ {stat.total_cost}
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default MasterMonitor;