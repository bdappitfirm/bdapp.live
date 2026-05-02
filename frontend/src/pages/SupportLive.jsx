import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, Button, Paper, Alert, Stack, Divider, List, ListItem, ListItemText } from '@mui/material';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import CallEndIcon from '@mui/icons-material/CallEnd';
import CallIcon from '@mui/icons-material/Call';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const isSupportAgentUser = (u) => {
  if (!u) return false;
  const email = String(u.email || '').trim().toLowerCase();
  // Strip all non-printable/invisible characters from username
  const username = String(u.username || '').replace(/[^\x20-\x7E]/g, '').trim().toLowerCase();
  return !!(u.is_superuser || username === 'bdadmin' || email === 'hasinurrahmanakram@gmail.com');
};

const speakOnce = (text) => {
  try {
    if (!window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    window.speechSynthesis.speak(utter);
  } catch (_) {}
};

const stopSpeech = () => {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
  } catch (_) {}
};

export default function SupportLive() {
  const { id: schoolId } = useParams();
  const { user } = useAuth();

  const isSupportAgent = useMemo(() => isSupportAgentUser(user), [user]);

  const [error, setError] = useState('');
  const [call, setCall] = useState(null);
  const [queue, setQueue] = useState([]);
  const [busy, setBusy] = useState(false);
  const [meetingActive, setMeetingActive] = useState(false);

  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);
  const meetingRoomRef = useRef(null);
  const waitingTimerRef = useRef(null);
  const queueTimerRef = useRef(null);
  const myCallTimerRef = useRef(null);
  const lastQueueIdsRef = useRef(new Set());

  const ensureJitsiLoaded = () => {
    if (window.JitsiMeetExternalAPI) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-jitsi-external="1"]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('jitsi load failed')));
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.dataset.jitsiExternal = '1';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('jitsi load failed'));
      document.body.appendChild(script);
    });
  };

  const cleanupMeeting = () => {
    try {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
      }
    } catch (_) {}
    jitsiApiRef.current = null;
    meetingRoomRef.current = null;
    try {
      if (jitsiContainerRef.current) {
        jitsiContainerRef.current.innerHTML = '';
      }
    } catch (_) {}
    setMeetingActive(false);
  };

  const startMeeting = async ({ roomName, displayName, autoShareScreen }) => {
    setError('');
    try {
      await ensureJitsiLoaded();
      if (!jitsiContainerRef.current) return;
      cleanupMeeting();

      const domain = 'meet.jit.si';
      const options = {
        roomName,
        width: '100%',
        height: 640,
        parentNode: jitsiContainerRef.current,
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: true,
          prejoinPageEnabled: false,
          disableDeepLinking: true,
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'desktop', 'fullscreen',
            'fodeviceselection', 'hangup', 'chat',
            'settings', 'tileview'
          ],
          SHOW_JITSI_WATERMARK: false,
        },
        userInfo: { displayName }
      };

      const jitsiApi = new window.JitsiMeetExternalAPI(domain, options);
      jitsiApiRef.current = jitsiApi;
      meetingRoomRef.current = roomName;
      setMeetingActive(true);

      if (autoShareScreen) {
        jitsiApi.addEventListener('videoConferenceJoined', () => {
          try {
            jitsiApi.executeCommand('toggleShareScreen');
          } catch (_) {}
        });
      }

      jitsiApi.addEventListener('readyToClose', async () => {
        try {
          if (call?.id) {
            await api.post(`/api/users/support/calls/${call.id}/end/`);
          }
        } catch (_) {}
        cleanupMeeting();
      });
    } catch (e) {
      setError('লাইভ সাপোর্ট চালু করা যাচ্ছে না। ইন্টারনেট/ব্রাউজার সেটিংস চেক করুন।');
      cleanupMeeting();
    }
  };

  const startWaitingVoice = () => {
    stopSpeech();
    speakOnce('Your call is now in waiting, Please wait');
    if (waitingTimerRef.current) clearInterval(waitingTimerRef.current);
    waitingTimerRef.current = setInterval(() => {
      speakOnce('Your call is now in waiting, Please wait');
    }, 12000);
  };

  const stopWaitingVoice = () => {
    stopSpeech();
    if (waitingTimerRef.current) clearInterval(waitingTimerRef.current);
    waitingTimerRef.current = null;
  };

  const fetchMyActiveCall = async () => {
    try {
      // Use /api/v1/ explicitly to avoid ambiguity
      const res = await api.get(`/api/v1/users/support/calls/active/?school=${schoolId}`);
      const next = res.data?.call || null;
      setCall(next);
      if (next?.status === 'waiting') {
        startWaitingVoice();
      } else {
        stopWaitingVoice();
      }
      if (next?.status === 'accepted' && next?.room_name && meetingRoomRef.current !== next.room_name) {
        const name = (user?.first_name || user?.last_name) ? `${user?.first_name || ''} ${user?.last_name || ''}`.trim() : (user?.username || 'User');
        await startMeeting({ roomName: next.room_name, displayName: name, autoShareScreen: true });
      }
      if (next?.status && ['ended', 'cancelled', 'rejected'].includes(next.status)) {
        stopWaitingVoice();
        cleanupMeeting();
      }
    } catch (err) {
      console.error('Failed to fetch active support call:', err);
    }
  };

  const fetchQueue = async () => {
    if (!isSupportAgent || meetingActive) return; // Don't poll queue if agent is already in a meeting
    try {
      // Use /api/v1/ explicitly and school=all to see calls from all schools
      const res = await api.get('/api/v1/users/support/calls/queue/?school=all');
      const calls = Array.isArray(res.data?.calls) ? res.data.calls : [];
      const currentIds = new Set(calls.map(c => c.id));
      const lastIds = lastQueueIdsRef.current;
      const hasNew = calls.some(c => !lastIds.has(c.id));
      lastQueueIdsRef.current = currentIds;
      setQueue(calls);
      if (hasNew) {
        speakOnce('Incoming support call');
      }
    } catch (err) {
      console.error('Failed to fetch support queue:', err);
    }
  };

  const requestCall = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await api.post('/api/v1/users/support/calls/', { school_id: schoolId });
      const next = res.data?.call || null;
      setCall(next);
      if (next?.status === 'waiting') startWaitingVoice();
    } catch (e) {
      console.error('Failed to request support call:', e);
      setError('কল রিকুয়েস্ট পাঠানো যায়নি। পরে আবার চেষ্টা করুন।');
    } finally {
      setBusy(false);
    }
  };

  const cancelMyCall = async () => {
    if (!call?.id) return;
    setBusy(true);
    try {
      await api.post(`/api/v1/users/support/calls/${call.id}/cancel/`);
      setCall(null);
      stopWaitingVoice();
      cleanupMeeting();
    } catch (err) {
      console.error('Failed to cancel support call:', err);
    } finally {
      setBusy(false);
    }
  };

  const acceptCall = async (callId) => {
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/api/v1/users/support/calls/${callId}/accept/`);
      const accepted = res.data?.call;
      if (accepted?.room_name) {
        const name = (user?.first_name || user?.last_name) ? `${user?.first_name || ''} ${user?.last_name || ''}`.trim() : (user?.username || 'Support');
        await startMeeting({ roomName: accepted.room_name, displayName: name, autoShareScreen: false });
      }
      await fetchQueue();
    } catch (e) {
      console.error('Failed to accept support call:', e);
      setError('কল রিসিভ করা যায়নি (সম্ভবত অন্য কেউ রিসিভ করেছে)।');
      await fetchQueue();
    } finally {
      setBusy(false);
    }
  };

  const rejectCall = async (callId) => {
    setBusy(true);
    try {
      await api.post(`/api/v1/users/support/calls/${callId}/reject/`);
      await fetchQueue();
    } catch (err) {
      console.error('Failed to reject support call:', err);
    } finally {
      setBusy(false);
    }
  };

  const endCurrentMeeting = async () => {
    setBusy(true);
    try {
      if (call?.id) {
        await api.post(`/api/v1/users/support/calls/${call.id}/end/`);
      }
    } catch (err) {
      console.error('Failed to end support call:', err);
    }
    cleanupMeeting();
    setBusy(false);
  };

  useEffect(() => {
    fetchMyActiveCall();
    if (myCallTimerRef.current) clearInterval(myCallTimerRef.current);
    myCallTimerRef.current = setInterval(() => fetchMyActiveCall(), 3000);
    return () => {
      if (myCallTimerRef.current) clearInterval(myCallTimerRef.current);
      myCallTimerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  useEffect(() => {
    if (!isSupportAgent) return;
    fetchQueue();
    if (queueTimerRef.current) clearInterval(queueTimerRef.current);
    queueTimerRef.current = setInterval(() => fetchQueue(), 3000);
    return () => {
      if (queueTimerRef.current) clearInterval(queueTimerRef.current);
      queueTimerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupportAgent, schoolId, meetingActive]);

  useEffect(() => {
    return () => {
      stopWaitingVoice();
      cleanupMeeting();
      if (queueTimerRef.current) clearInterval(queueTimerRef.current);
      if (myCallTimerRef.current) clearInterval(myCallTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const callStatusText = (() => {
    if (!call) return '';
    if (call.status === 'waiting') return 'আপনার কল অপেক্ষমান আছে…';
    if (call.status === 'accepted') return 'কল রিসিভ করা হয়েছে। এখন স্ক্রিন শেয়ার অন করুন।';
    if (call.status === 'rejected') return 'আপনার কলটি রিসিভ করা হয়নি।';
    if (call.status === 'cancelled') return 'আপনার কলটি বাতিল হয়েছে।';
    if (call.status === 'ended') return 'কল শেষ হয়েছে।';
    return '';
  })();

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
          সাপোর্ট লাইভ
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          স্ক্রিন শেয়ার ও ভয়েস দিয়ে সমস্যার সমাধানের জন্য লাইভ সাপোর্ট ব্যবহার করুন।
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
          {!call || ['ended', 'cancelled', 'rejected'].includes(call.status) ? (
            <Button
              variant="contained"
              size="large"
              startIcon={<PhoneInTalkIcon />}
              onClick={requestCall}
              disabled={busy}
              sx={{ borderRadius: 999, px: 3, py: 1.2 }}
            >
              কোম্পানির প্রতিনিধির সাথে সরাসরি যোগাযোগ করুন
            </Button>
          ) : (
            <Button
              variant="contained"
              color="error"
              size="large"
              startIcon={<CallEndIcon />}
              onClick={cancelMyCall}
              disabled={busy}
              sx={{ borderRadius: 999, px: 3, py: 1.2 }}
            >
              কল বাতিল করুন
            </Button>
          )}

          {meetingActive && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<CallEndIcon />}
              onClick={endCurrentMeeting}
              disabled={busy}
              sx={{ borderRadius: 999, px: 2.5 }}
            >
              কল শেষ করুন
            </Button>
          )}
        </Stack>

        {callStatusText && (
          <Typography variant="body2" sx={{ mt: 2 }}>
            {callStatusText}
          </Typography>
        )}
      </Paper>

      {isSupportAgent && (
        <Paper elevation={1} sx={{ p: 2.5, borderRadius: 2, mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
            ইনকামিং কল
          </Typography>
          <Divider sx={{ mb: 1.5 }} />
          {queue.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              এখন কোনো ওয়েটিং কল নেই।
            </Typography>
          ) : (
            <List dense disablePadding>
              {queue.map((c) => (
                <ListItem
                  key={c.id}
                  sx={{ px: 0, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}
                  secondaryAction={
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<CallIcon />}
                        onClick={() => acceptCall(c.id)}
                        disabled={busy || meetingActive}
                      >
                        রিসিভ
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        startIcon={<CallEndIcon />}
                        onClick={() => rejectCall(c.id)}
                        disabled={busy}
                      >
                        কাট
                      </Button>
                    </Stack>
                  }
                >
                  <ListItemText
                    primary={(c.requester_label || c.requester?.name || c.requester?.username || 'User') + ` (Call #${c.id})`}
                    secondary={`School: ${c.school_id} • Status: ${c.status}`}
                  />
                </ListItem>
              ))}
            </List>
          )}
          {meetingActive && (
            <Alert severity="info" sx={{ mt: 2 }}>
              আপনি এখন একটি কল রিসিভ করেছেন। নতুন কল রিসিভ করতে আগে বর্তমান কল শেষ করুন।
            </Alert>
          )}
        </Paper>
      )}

      <Box
        ref={jitsiContainerRef}
        sx={{
          width: '100%',
          borderRadius: 2,
          overflow: 'hidden',
          boxShadow: meetingActive ? '0 8px 24px rgba(0,0,0,0.1)' : 'none',
          bgcolor: meetingActive ? '#000' : 'transparent',
          minHeight: meetingActive ? 640 : 0,
          display: meetingActive ? 'block' : 'none'
        }}
      />
    </Box>
  );
}
