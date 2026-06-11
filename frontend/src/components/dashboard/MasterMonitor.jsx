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
        api.get('/api/users/activities/?limit=20'),
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
      case 'profile_create': return <PersonAddIcon color="success" />;
      case 'login': return <LoginIcon color="info" />;
      case 'result_input':
      case 'data_input': return <InputIcon color="warning" />;
      default: return <InputIcon />;
    }
  };

  if (loading && !reports) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: '#1976d2' }}>
        🌍 Master Monitoring System
      </Typography>

      <Grid container spacing={3}>
        {/* Statistics Cards */}
        <Grid item xs={12} md={4}>
          <Card elevation={3} sx={{ bgcolor: '#e3f2fd' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>মোট প্রোফাইল আয় (৩ টাকা হারে)</Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1565c0' }}>
                ৳ {reports?.total_earnings || 0}
              </Typography>
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                প্রতিটি প্রোফাইল ক্রিয়েশন বাবদ ৩ টাকা হিসেবে
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card elevation={3} sx={{ bgcolor: '#f1f8e9' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>আজকের মোট ইনপুট</Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                {reports?.daily_stats?.[0]?.count || 0}
              </Typography>
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                আজকের মোট প্রোফাইল ক্রিয়েশন সংখ্যা
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card elevation={3} sx={{ bgcolor: '#fff3e0' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>সক্রিয় স্কুলসমূহ</Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ef6c00' }}>
                {reports?.school_stats?.length || 0}
              </Typography>
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                গত ৩০ দিনে অ্যাক্টিভিটি থাকা স্কুল
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Live Feed */}
        <Grid item xs={12} md={7}>
          <Paper elevation={3} sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              🎥 Live Activity Feed (রিয়েল-টাইম মনিটরিং)
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <List sx={{ maxHeight: 500, overflow: 'auto' }}>
              {logs.map((log) => (
                <ListItem key={log.id} divider>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'transparent' }}>
                      {getActionIcon(log.action_type)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                          {log.username} ({log.user_full_name})
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="body2" component="span" sx={{ color: '#1976d2', fontWeight: 'bold' }}>
                          [{log.school_name}]
                        </Typography>
                        {' — '}
                        {log.action_type === 'profile_create' ? (
                          <Chip size="small" label={`+3 TK | ${log.details.role}`} color="success" sx={{ height: 20, fontSize: '0.7rem' }} />
                        ) : log.action_type === 'login' ? (
                          <Chip size="small" label="Logged In" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                        ) : (
                          log.action_type
                        )}
                        <Typography variant="caption" display="block">
                          {log.action_type === 'profile_create' ? `ক্রিয়েট করেছে: ${log.details.name || 'N/A'}` : `IP: ${log.ip_address || 'N/A'}`}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              ))}
              {logs.length === 0 && (
                <Typography align="center" sx={{ p: 3, color: 'text.secondary' }}>কোন অ্যাক্টিভিটি পাওয়া যায়নি</Typography>
              )}
            </List>
          </Paper>
        </Grid>

        {/* Billing / Earnings Report */}
        <Grid item xs={12} md={5}>
          <Paper elevation={3} sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              💰 স্কুল ভিত্তিক বিলিং রিপোর্ট (৩০ দিন)
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <TableContainer sx={{ maxHeight: 500 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>স্কুলের নাম</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>ইনপুট</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>বিল (৳)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reports?.school_stats?.map((stat) => (
                    <TableRow key={stat.school__id}>
                      <TableCell>{stat.school__name}</TableCell>
                      <TableCell align="center">{stat.count}</TableCell>
                      <TableCell align="right">৳ {stat.total_cost}</TableCell>
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

          <Paper elevation={3} sx={{ p: 2, mt: 3, borderRadius: 2, bgcolor: '#f5f5f5' }}>
            <Typography variant="h6" gutterBottom>📊 তারিখ ভিত্তিক হিসাব</Typography>
            <Divider sx={{ mb: 1 }} />
            <List size="small">
              {reports?.daily_stats?.slice(0, 7).map((stat) => (
                <ListItem key={stat.date} sx={{ py: 0.5 }}>
                  <ListItemText 
                    primary={new Date(stat.date).toLocaleDateString('bn-BD')} 
                    secondary={`${stat.count} টি প্রোফাইল ক্রিয়েট`}
                  />
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>৳ {stat.total_cost}</Typography>
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
