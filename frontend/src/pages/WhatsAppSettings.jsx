import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, CircularProgress, Button, Alert, Card, CardContent } from '@mui/material';
import { WhatsApp as WhatsAppIcon, Refresh as RefreshIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import api from '../utils/api';

export default function WhatsAppSettings() {
    const [status, setStatus] = useState('LOADING');
    const [qrImage, setQrImage] = useState(null);
    const [loading, setLoading] = useState(true);

    const checkStatus = async () => {
        try {
            // Always check localhost:3001 regardless of where the app is hosted
            const response = await fetch('http://127.0.0.1:3001/status');
            const data = await response.json();
            setStatus(data.status);
            setQrImage(data.qr);
        } catch (error) {
            console.error('Failed to connect to WhatsApp Gateway:', error);
            setStatus('GATEWAY_OFFLINE');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 5000); // Polling every 5 seconds
        return () => clearInterval(interval);
    }, []);

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                <WhatsAppIcon sx={{ mr: 1, color: '#25D366' }} />
                WhatsApp গেটওয়ে সেটিংস
            </Typography>

            <Paper sx={{ p: 3, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>কানেকশন স্ট্যাটাস</Typography>

                {status === 'CONNECTED' ? (
                    <Alert icon={<CheckCircleIcon fontSize="inherit" />} severity="success" sx={{ mb: 3 }}>
                        আপনার হোয়াটসঅ্যাপ সফলভাবে সংযুক্ত আছে! আপনি এখন মেসেজ পাঠাতে পারবেন।
                    </Alert>
                ) : status === 'QR_READY' ? (
                    <Alert severity="info" sx={{ mb: 3 }}>
                        নিচের QR কোডটি আপনার মোবাইলের WhatsApp {'>'} Linked Devices দিয়ে স্ক্যান করুন।
                    </Alert>
                ) : status === 'GATEWAY_OFFLINE' ? (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        হোয়াটসঅ্যাপ গেটওয়ে সার্ভারটি বন্ধ আছে। দয়া করে এডমিনের সাথে যোগাযোগ করুন।
                    </Alert>
                ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                        <Typography variant="body1">সার্ভার লোড হচ্ছে, অপেক্ষা করুন...</Typography>
                    </Box>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    {status === 'QR_READY' && qrImage && (
                        <Box sx={{ p: 2, bgcolor: 'white', border: '1px solid #ddd', borderRadius: 2 }}>
                            <img src={qrImage} alt="WhatsApp QR Code" style={{ width: 250, height: 250 }} />
                            <Typography variant="caption" display="block" align="center" sx={{ mt: 1 }}>
                                স্ক্যান করার পর স্বয়ংক্রিয়ভাবে কানেক্ট হবে।
                            </Typography>
                        </Box>
                    )}

                    {status === 'CONNECTED' && (
                        <Box sx={{ textAlign: 'center' }}>
                            <WhatsAppIcon sx={{ fontSize: 100, color: '#25D366', mb: 2 }} />
                            <Typography variant="h5" color="success.main">WhatsApp Linked</Typography>
                        </Box>
                    )}
                </Box>

                <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
                    <Button variant="outlined" startIcon={<RefreshIcon />} onClick={checkStatus}>
                        স্ট্যাটাস রিফ্রেশ করুন
                    </Button>
                </Box>
            </Paper>

            <Card sx={{ mt: 3, bgcolor: '#fff9c4' }}>
                <CardContent>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>গুরুত্বপূর্ণ তথ্য:</Typography>
                    <Typography variant="body2">
                        ১. এই সিস্টেমটি আপনার ফোন ব্যবহার করে মেসেজ পাঠাবে, তাই ফোনে ইন্টারনেট থাকা জরুরি। <br />
                        ২. একসাথে অনেক বেশি মানুষকে একই মেসেজ পাঠাবেন না, এতে অ্যাকাউন্ট ব্যান্ড হওয়ার ঝুঁকি থাকে। <br />
                        ৩. কোনো সমস্যা হলে মোবাইল থেকে Logout করে পুনরায় স্ক্যান করুন।
                    </Typography>
                </CardContent>
            </Card>
        </Box>
    );
}
