import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FileText, MessageSquare, Mic, MicOff, PhoneOff, Send, Video, VideoOff, X } from 'lucide-react';
import Logo from '../components/Logo';
import { Avatar, Button, Spinner, cx } from '../components/ui';
import { getSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { formatTime } from '../lib/format';

const ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] };

/** 1:1 WebRTC video consultation. Signalling goes through Socket.IO. */
export default function VideoVisit() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDoctor = user.role === 'DOCTOR';
  const backTo = isDoctor ? `/doctor/appointments/${id}` : `/patient/appointments/${id}`;

  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const pcRef = useRef(null);
  const streamRef = useRef(null);
  const pendingIce = useRef([]);

  const [appt, setAppt] = useState(null);
  const [phase, setPhase] = useState('media'); // media → waiting → connected → ended | error
  const [error, setError] = useState('');
  const [peerName, setPeerName] = useState('');
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState('');
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    api.get(isDoctor ? `/doctor/appointments/${id}` : `/patient/appointments/${id}`).then(setAppt).catch(() => {});
  }, [id, isDoctor]);

  useEffect(() => {
    if (phase !== 'connected') return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    const socket = getSocket();
    let closed = false;

    const newPeer = () => {
      pcRef.current?.close();
      const pc = new RTCPeerConnection(ICE);
      streamRef.current?.getTracks().forEach((t) => pc.addTrack(t, streamRef.current));
      pc.onicecandidate = (e) => e.candidate && socket.emit('video:signal', { candidate: e.candidate });
      pc.ontrack = (e) => {
        if (remoteRef.current) remoteRef.current.srcObject = e.streams[0];
        setPhase('connected');
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') setError('Connection lost. Check your internet and rejoin.');
      };
      pendingIce.current = [];
      pcRef.current = pc;
      return pc;
    };

    const makeOffer = async () => {
      const pc = newPeer();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('video:signal', { sdp: pc.localDescription });
    };

    const onSignal = async ({ sdp, candidate }) => {
      try {
        if (sdp) {
          const pc = sdp.type === 'offer' ? newPeer() : pcRef.current;
          if (!pc) return;
          await pc.setRemoteDescription(sdp);
          for (const c of pendingIce.current) await pc.addIceCandidate(c);
          pendingIce.current = [];
          if (sdp.type === 'offer') {
            await pc.setLocalDescription(await pc.createAnswer());
            socket.emit('video:signal', { sdp: pc.localDescription });
          }
        } else if (candidate) {
          const pc = pcRef.current;
          if (pc?.remoteDescription) await pc.addIceCandidate(candidate);
          else pendingIce.current.push(candidate);
        }
      } catch (e) {
        console.error('Signalling error', e);
      }
    };
    const onPeerJoined = ({ name }) => {
      setPeerName(name);
      makeOffer();
    };
    const onPeerLeft = ({ name }) => {
      pcRef.current?.close();
      pcRef.current = null;
      if (remoteRef.current) remoteRef.current.srcObject = null;
      setPhase((p) => (p === 'ended' ? p : 'waiting'));
      setMessages((m) => [...m, { system: true, text: `${name || 'The other person'} left the call`, at: Date.now() }]);
    };
    const onChat = (m) => {
      setMessages((list) => [...list, m]);
      if (m.fromId !== user.id) setUnread((u) => u + 1);
    };

    (async () => {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true });
      } catch {
        if (!closed) {
          setError('We need access to your camera and microphone. Allow it in your browser settings, then reload this page.');
          setPhase('error');
        }
        return;
      }
      if (closed) return streamRef.current.getTracks().forEach((t) => t.stop());
      if (localRef.current) localRef.current.srcObject = streamRef.current;
      socket.on('video:signal', onSignal);
      socket.on('video:peer-joined', onPeerJoined);
      socket.on('video:peer-left', onPeerLeft);
      socket.on('video:chat', onChat);
      socket.emit('video:join', { appointmentId: Number(id) }, (res) => {
        if (closed) return;
        if (res?.error) {
          setError(res.error);
          setPhase('error');
          return;
        }
        setPeerName(res.peerName || '');
        setPhase('waiting');
      });
    })();

    return () => {
      closed = true;
      socket.emit('video:leave');
      socket.off('video:signal', onSignal);
      socket.off('video:peer-joined', onPeerJoined);
      socket.off('video:peer-left', onPeerLeft);
      socket.off('video:chat', onChat);
      pcRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [id, user.id]);

  const toggle = (kind) => {
    const tracks = kind === 'audio' ? streamRef.current?.getAudioTracks() : streamRef.current?.getVideoTracks();
    tracks?.forEach((t) => (t.enabled = !t.enabled));
    kind === 'audio' ? setMic((v) => !v) : setCam((v) => !v);
  };

  const end = () => {
    setPhase('ended');
    getSocket().emit('video:leave');
    pcRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    navigate(backTo);
  };

  const send = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    getSocket().emit('video:chat', text.trim());
    setText('');
  };

  const other = appt ? (isDoctor ? appt.patientName : appt.doctorName) : '';
  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className="h-[100dvh] bg-[#0f1a2c] text-white flex flex-col">
      <header className="h-14 shrink-0 px-4 flex items-center justify-between bg-white text-ink border-b border-line">
        <div className="flex items-center gap-3 min-w-0">
          <Logo to={backTo} className="h-6" />
          <span className="hidden sm:block h-5 w-px bg-line" />
          <p className="hidden sm:block text-sm text-ink-soft truncate">
            Video consultation{other && ` with ${other}`}
            {appt && ` · ${formatTime(appt.time)}`}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {phase === 'connected' && <span className="tabular-nums text-ink-soft">{mmss}</span>}
          {isDoctor && (
            <Button size="sm" variant="secondary" to={`/doctor/appointments/${id}`} target="_blank">
              <FileText className="h-4 w-4" /> Notes
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 flex">
        <main className="relative flex-1 min-w-0 flex items-center justify-center p-3 sm:p-5">
          {phase === 'error' ? (
            <div className="max-w-md text-center bg-white text-ink rounded-xl p-8">
              <p className="font-semibold text-lg">Can't join the call</p>
              <p className="text-ink-muted mt-2">{error}</p>
              <Button to={backTo} className="mt-5">
                Back to appointment
              </Button>
            </div>
          ) : (
            <>
              <video ref={remoteRef} autoPlay playsInline className={cx('w-full h-full object-contain rounded-xl bg-black/30', phase !== 'connected' && 'hidden')} />
              {phase !== 'connected' && (
                <div className="text-center">
                  {other ? <Avatar name={other} size="xl" className="mx-auto !bg-white/10 !text-white !ring-white/20" /> : <Spinner className="mx-auto !text-white" />}
                  <p className="mt-4 text-lg font-medium">{phase === 'media' ? 'Starting your camera…' : `Waiting for ${other || 'the other person'} to join`}</p>
                  <p className="text-white/60 text-sm mt-1">
                    {phase === 'media' ? 'Allow camera and microphone access if your browser asks.' : isDoctor ? 'The patient has been told the room is open.' : 'The doctor will join shortly. Please stay on this page.'}
                  </p>
                </div>
              )}
              <video ref={localRef} autoPlay playsInline muted className={cx('absolute bottom-24 right-4 sm:bottom-6 sm:right-6 w-28 sm:w-56 aspect-video object-cover rounded-lg bg-black border border-white/20 shadow-lg -scale-x-100', !cam && 'opacity-0')} />
              {error && phase !== 'error' && <p className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white text-sm px-4 py-2 rounded-lg">{error}</p>}
            </>
          )}
        </main>

        {chatOpen && (
          <aside className="fixed inset-0 z-30 sm:static sm:w-80 bg-white text-ink flex flex-col border-l border-line">
            <div className="h-12 flex items-center justify-between px-4 border-b border-line">
              <p className="font-medium text-sm">Chat</p>
              <button onClick={() => setChatOpen(false)} className="p-1 text-ink-muted" aria-label="Close chat">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && <p className="text-sm text-ink-muted text-center mt-8">Messages are only visible during this call.</p>}
              {messages.map((m, i) =>
                m.system ? (
                  <p key={i} className="text-xs text-ink-muted text-center">{m.text}</p>
                ) : (
                  <div key={i} className={cx('max-w-[85%] rounded-lg px-3 py-2 text-sm', m.fromId === user.id ? 'ml-auto bg-brand-600 text-white' : 'bg-canvas')}>
                    {m.fromId !== user.id && <p className="text-xs font-medium text-ink-muted mb-0.5">{m.from}</p>}
                    {m.text}
                  </div>
                ),
              )}
            </div>
            <form onSubmit={send} className="p-3 border-t border-line flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" className="input h-10" />
              <Button type="submit" size="sm" className="h-10" aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </aside>
        )}
      </div>

      {phase !== 'error' && (
        <footer className="shrink-0 py-4 flex items-center justify-center gap-3 bg-[#0f1a2c]">
          <CallButton on={mic} onClick={() => toggle('audio')} label={mic ? 'Mute' : 'Unmute'} icon={mic ? Mic : MicOff} />
          <CallButton on={cam} onClick={() => toggle('video')} label={cam ? 'Turn camera off' : 'Turn camera on'} icon={cam ? Video : VideoOff} />
          <CallButton
            on
            onClick={() => {
              setChatOpen((o) => !o);
              setUnread(0);
            }}
            label="Chat"
            icon={MessageSquare}
            badge={unread}
          />
          <button onClick={end} className="h-12 px-6 rounded-full bg-red-600 hover:bg-red-700 flex items-center gap-2 font-medium" aria-label="Leave call">
            <PhoneOff className="h-5 w-5" /> <span className="hidden sm:inline">Leave</span>
          </button>
        </footer>
      )}
      <Link to={backTo} className="sr-only">
        Back to appointment
      </Link>
    </div>
  );
}

function CallButton({ on, onClick, label, icon: Icon, badge }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className={cx('relative h-12 w-12 rounded-full flex items-center justify-center transition-colors', on ? 'bg-white/10 hover:bg-white/20' : 'bg-white text-ink')}>
      <Icon className="h-5 w-5" />
      {badge > 0 && <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-red-500 text-[11px] font-semibold flex items-center justify-center">{badge}</span>}
    </button>
  );
}
