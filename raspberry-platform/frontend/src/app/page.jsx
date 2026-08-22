import { useState, useEffect, useRef } from 'react'
import { useLang } from '@/components/psychoedu/context/LanguageContext'
import { t }       from '@/components/psychoedu/lib/translations'
import { startSession, saveLanguagePreference } from '@/components/psychoedu/lib/api'
import Eli          from '@/components/psychoedu/child/Eli'
import SceneBackground from '@/components/psychoedu/child/SceneBackground'
import LanguagePicker  from '@/components/psychoedu/child/LanguagePicker'
import jsQR from "jsqr";

const GREETING_KEYS = [
  'welcome.greeting_1', 'welcome.greeting_2',
  'welcome.greeting_3', 'welcome.greeting_4',
]

const SPEECH_LINES = {
  si: 'ආයුබෝවන්! මම එලී, ඔයාගේ යාළුවා.',
  ta: 'வணக்கம்! நான் Eli, உன் நண்பன்.',
  en: 'Hello! I am Eli, your friend.',
}

// Sparkle particle 
function Sparkle({ x, y, color = '#FFD93D', delay = 0 }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      width: 12, height: 12,
      fontSize: 16, lineHeight: '12px',
      animation: `sparkle-float 1.2s ease-out ${delay}s forwards`,
      pointerEvents: 'none', zIndex: 20,
    }}>✨</div>
  )
}

//Camera scan overlay 
function CameraView({ videoRef, onCancel, lang }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem', width:'100%' }}>
      <div style={{
        position: 'relative', width: '100%', maxWidth: 'min(300px,78vw)',
        aspectRatio: '1/1', borderRadius: '2rem', overflow: 'hidden',
        border: '5px solid #FF6B35',
        boxShadow: '0 0 0 4px rgba(255,107,53,0.3), 0 8px 32px rgba(255,107,53,0.25)',
        background: '#000',
      }}>
        <video ref={videoRef} style={{ width:'100%', height:'100%', objectFit:'cover' }} playsInline muted />
        {/* Corner markers */}
        {[
          { top:10, left:10,   borderTop:'4px solid #FFD93D', borderLeft:'4px solid #FFD93D',   borderRadius:'8px 0 0 0' },
          { top:10, right:10,  borderTop:'4px solid #FFD93D', borderRight:'4px solid #FFD93D',  borderRadius:'0 8px 0 0' },
          { bottom:10, left:10,  borderBottom:'4px solid #FFD93D', borderLeft:'4px solid #FFD93D',  borderRadius:'0 0 0 8px' },
          { bottom:10, right:10, borderBottom:'4px solid #FFD93D', borderRight:'4px solid #FFD93D', borderRadius:'0 0 8px 0' },
        ].map((s,i) => <div key={i} style={{ position:'absolute', width:28, height:28, ...s }} />)}
        {/* Scan line */}
        <div style={{
          position:'absolute', left:16, right:16, height:3, borderRadius:'99px',
          background:'linear-gradient(90deg,transparent,#FF6B35,transparent)',
          animation:'scanLine 1.8s ease-in-out infinite',
          boxShadow:'0 0 8px rgba(255,107,53,0.8)',
        }} />
        {/* Caption */}
        <div style={{ position:'absolute', bottom:10, left:0, right:0, display:'flex', justifyContent:'center' }}>
          <span style={{ background:'rgba(0,0,0,0.7)', color:'white', borderRadius:'99px', padding:'4px 16px', fontSize:12, fontWeight:700, fontFamily:"'Nunito',sans-serif" }}>
            {t('welcome.scanning', lang)}
          </span>
        </div>
      </div>
      
      {/* Cancel */}
      <button onClick={onCancel} style={{
        minHeight: 52, padding:'0 2rem', borderRadius:'99px',
        border:'3px solid rgba(255,255,255,0.8)', background:'rgba(255,255,255,0.2)',
        backdropFilter:'blur(8px)',
        color:'white', fontSize:'1rem', fontWeight:800,
        fontFamily:"'Baloo 2',cursive", cursor:'pointer',
      }}>
        ✕ {t('welcome.cancel', lang)}
      </button>
    </div>
  )
}

// Main 
export default function ChildWelcomePage({ onNavigate }) {
  const { lang, setLang } = useLang()

  const [screen,    setScreen]   = useState('language')  // language|camera|loading|welcome
  const [camState,  setCamState] = useState('idle')
  const [errorMsg,  setErrorMsg] = useState('')
  const [greetIdx,  setGreetIdx] = useState(0)
  const [sessionId, setSessionId] = useState(null)
  const [eliMood,   setEliMood]  = useState('wave')
  const [sparkles,  setSparkles] = useState([])
  const [tapCount,  setTapCount] = useState(0)
  const [eliSize,   setEliSize]  = useState(160)

  const videoRef  = useRef(null)
  const streamRef = useRef(null)
  const scanRef   = useRef(null)

  // Greeting rotation
  useEffect(() => {
    if (screen !== 'welcome') return
    const id = setInterval(() => {
      setGreetIdx(i => (i + 1) % GREETING_KEYS.length)
      setEliMood(m => m === 'wave' ? 'happy' : 'wave')
    }, 3200)
    return () => clearInterval(id)
  }, [screen])

  // Keep first render SSR-safe; size updates after mount.
  useEffect(() => {
    function updateEliSize() {
      setEliSize(Math.min(180, Math.round(window.innerWidth * 0.42)))
    }
    updateEliSize()
    window.addEventListener('resize', updateEliSize)
    
    // Load language from localStorage on mount, but still show language picker first
    const savedLang = localStorage.getItem('preferredLanguage')
    if (savedLang && ['si', 'ta', 'en'].includes(savedLang)) {
      setLang(savedLang)
    }
    
    return () => window.removeEventListener('resize', updateEliSize)
  }, [])

  // Camera cleanup
  useEffect(() => () => stopCamera(), [])

  // Tap Eli for sparkles
  function tapEli(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = Date.now()
    setSparkles(s => [...s, { id, x, y }])
    setEliMood('excited')
    setTapCount(c => c + 1)
    setTimeout(() => setSparkles(s => s.filter(sp => sp.id !== id)), 1500)
    setTimeout(() => setEliMood('wave'), 1000)
  }

  // Camera 
  async function startCamera() {
    setErrorMsg('')
    setCamState('requesting')
    setScreen('camera')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 640 } },
      })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
      setCamState('active')
      beginQRScan()
    } catch (err) {
      setErrorMsg(err.name === 'NotAllowedError' ? t('welcome.err_denied', lang) : t('welcome.err_unavailable', lang))
      setCamState('error')
      setScreen('welcome')
    }
  }

  function stopCamera() {
    if (scanRef.current) {
      clearInterval(scanRef.current)
      scanRef.current = null
    }
    if (scanRef.current) clearTimeout(scanRef.current)
    streamRef.current?.getTracks().forEach(tr => tr.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  function cancelCamera() { stopCamera(); setCamState('idle'); setScreen('welcome') }

  function beginQRScan() {
  if (typeof window === 'undefined') return;

  if ('BarcodeDetector' in window) {
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    scanRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes.length > 0) {
          clearInterval(scanRef.current);
          handleQR(codes[0].rawValue);
        }
      } catch (err) {
        console.error("BarcodeDetector error:", err);
      }
    }, 500);
  } else {
    console.warn('[QR] BarcodeDetector API not available, using jsQR fallback');

    scanRef.current = setInterval(() => {
      if (!videoRef.current) return;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height);

      if (code) {
        clearInterval(scanRef.current);
        handleQR(code.data); // decoded child_id
      }
    }, 500);
  }
}

async function handleQR(childId, selectedLang = lang) {
  stopCamera();
  setCamState('idle');
  setScreen('loading');

  let sid = 'offline';
  let resolvedChildId = '';

  const effectiveChildId = (childId || '').trim();
  if (!effectiveChildId) {
    setSessionId(sid);
    if (typeof onNavigate === 'function') {
      onNavigate({ session: sid, lang: selectedLang });
    }
    return;
  }

  try {
    const payload = await startSession(effectiveChildId);
    sid = payload?.sessionId ?? payload?.session_id ?? 'offline';
    resolvedChildId = payload?.child_id || '';
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[DEV] Session creation failed, using offline mode:', err?.message);
    }
    sid = 'offline';
  }

  const childToStore = resolvedChildId || effectiveChildId;
  if (typeof window !== 'undefined' && childToStore) {
    sessionStorage.setItem('selectedChildId', childToStore);
    localStorage.setItem('selectedChildId', childToStore);
  }

  setSessionId(sid);

  if (typeof window !== 'undefined') {
    localStorage.setItem('preferredLanguage', selectedLang);
  }

  if (typeof onNavigate === 'function') {
    onNavigate({ session: sid, child: childToStore, lang: selectedLang });
  }
}

  function handleLanguageSelect(code) {
    setLang(code)
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferredLanguage', code)
    }
    setScreen('welcome')
  }

  //  Language picker screen 
  if (screen === 'language') {
    return <LanguagePicker sessionId={sessionId} onSelect={handleLanguageSelect} />
  }

  // Loading screen 
  if (screen === 'loading') {
    return (
      <SceneBackground largeGroundFlowers>
        <div style={{ minHeight:'100svh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'2rem' }}>
          <div className="eli-float">
            <Eli size={140} mood="happy" animated={false} />
          </div>
          <div style={{ background:'rgba(255,255,255,0.85)', backdropFilter:'blur(12px)', borderRadius:'2rem', padding:'1.25rem 2.5rem', textAlign:'center' }}>
            <p style={{ fontFamily:"'Baloo 2',cursive", fontSize:'clamp(1.4rem,5vw,1.8rem)', fontWeight:900, color:'#0D9488' }}>
              {t('welcome.loading', lang)}
            </p>
            <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:12 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width:12, height:12, borderRadius:'50%', background:'#0D9488', animation:`bounce-dot 1s ease-in-out infinite ${i*0.2}s` }} />
              ))}
            </div>
          </div>
        </div>
      </SceneBackground>
    )
  }

  // Welcome / camera screen
  const greeting = t(GREETING_KEYS[greetIdx], lang)

  return (
    <SceneBackground largeGroundFlowers>
      <style>{`
        @keyframes greeting-pop{0%{opacity:0;transform:scale(0.8) translateY(8px)}100%{opacity:1;transform:scale(1) translateY(0)}}
        .greeting-anim{animation:greeting-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both}
      `}</style>

      <div style={{
        minHeight: '100svh', display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'space-between',
        padding:'clamp(1rem,4vw,1.75rem) clamp(1rem,4vw,1.5rem)',
        boxSizing:'border-box',
      }}>

        {/* ── Centre ── */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'clamp(1rem,3vw,1.5rem)', width:'100%', maxWidth:'min(400px,92vw)' }}>

          {/* Camera */}
          {screen === 'camera' && <CameraView videoRef={videoRef} onCancel={cancelCamera} lang={lang} />}

          {/* Welcome idle */}
          {screen === 'welcome' && (
            <div style={{ width:'100%', display:'flex', flexDirection:'column', alignItems:'center', marginTop:'clamp(2rem,8vw,4.8rem)' }}>
            {/* Eli speech bubble */}
              <div
                className="anim-fade-scale delay-600"
                style={{
                  position:'relative',
                  width:
                    lang === 'si'
                      ? 'min(420px, 94vw)'
                      : lang === 'ta'
                        ? 'min(360px, 92vw)'
                        : 'min(300px, 84vw)',
                  marginTop:'clamp(5.5rem,10vw,7.5rem)',
                }}
              >
                <div style={{
                  background:'rgba(255,255,255,0.92)', backdropFilter:'blur(12px)',
                  borderRadius:'1.5rem 1.5rem 1.5rem 0.3rem',
                  padding:'clamp(0.95rem,3.2vw,1.3rem) clamp(1rem,4vw,1.5rem)',
                  boxShadow:'0 8px 32px rgba(0,0,0,0.1)',
                  border:'3px solid rgba(255,255,255,0.8)',
                  textAlign:'center',
                }}>
                  <p className="greeting-anim" style={{ fontSize:'clamp(0.95rem,3vw,1.08rem)', fontWeight:700, color:'#0D9488', margin:0, letterSpacing:'0.01em', lineHeight:1.35, whiteSpace:'nowrap', textAlign:'center' }}>
                    {SPEECH_LINES[lang] ?? SPEECH_LINES.en}
                  </p>
                </div>
                {/* Bubble tail */}
                <div style={{ position:'absolute', bottom:-12, left:32, width:0, height:0, borderLeft:'12px solid transparent', borderRight:'8px solid transparent', borderTop:'14px solid rgba(255,255,255,0.92)' }} />
              </div>

              {/* Eli — tappable */}
              <div
                onClick={tapEli}
                style={{ position:'relative', cursor:'pointer', userSelect:'none' }}
              >
                <div className="anim-fade-scale delay-100">
                  {/* Glow behind Eli */}
                  <div style={{
                    position:'absolute', inset:'-20px', borderRadius:'50%',
                    background:'radial-gradient(circle, rgba(13,148,136,0.2) 0%, transparent 70%)',
                    pointerEvents:'none',
                  }} />
                  <Eli size={eliSize} mood={eliMood} />
                </div>
                {/* Sparkles */}
                {sparkles.map(sp => <Sparkle key={sp.id} x={sp.x} y={sp.y} />)}
                {/* Tap hint (disappears after first tap) */}
                {tapCount === 0 && (
                  <div style={{
                    position:'absolute', bottom:-10, left:'50%', transform:'translateX(-50%)',
                    background:'rgba(255,255,255,0.9)', borderRadius:'99px', padding:'3px 12px',
                    fontSize:11, fontWeight:700, color:'#FF6B35', whiteSpace:'nowrap',
                    fontFamily:"'Nunito',sans-serif",
                  }}>
                  </div>
                )}
              </div>


              {/* Error */}
              <div style={{ width:'100%', minHeight:72, display:'flex', alignItems:'center' }}>
                {errorMsg && (
                  <div style={{ background:'#FEE2E2', border:'2px solid #FCA5A5', borderRadius:'1rem', padding:'0.75rem 1.25rem', textAlign:'center', fontSize:'clamp(0.85rem,2.5vw,0.95rem)', fontWeight:700, color:'#991B1B', width:'100%' }}>
                    ⚠️ {errorMsg}
                  </div>
                )}
              </div>

              {/* ── SCAN BUTTON ── */}
              <button
                onClick={startCamera}
                disabled={camState === 'requesting'}
                className="scan-btn btn-press"
                style={{
                  width:'100%',
                  marginTop:'40px',
                  minHeight:'clamp(68px,15vw,80px)',
                  background: camState === 'requesting'
                    ? 'linear-gradient(135deg,#FDBA74,#FCD34D)'
                    : 'linear-gradient(135deg,#FF6B35 0%,#FF8C42 50%,#FFB347 100%)',
                  color:'white',
                  borderRadius:'99px',
                  border:'none',
                  fontFamily:"'Baloo 2',cursive",
                  fontSize:'clamp(1.1rem,4.5vw,1.4rem)',
                  fontWeight:900,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:'0.75rem',
                  cursor: camState === 'requesting' ? 'not-allowed' : 'pointer',
                  transition:'transform 0.1s',
                  position:'relative', overflow:'hidden',
                }}
              >
                {/* Shimmer */}
                <div style={{ position:'absolute', inset:0, background:'linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.2) 50%,transparent 60%)', animation:'shimmer 2.5s linear infinite' }} />
                <span style={{ fontSize:'clamp(1.6rem,6vw,2rem)', zIndex:1 }}>
                  {camState === 'requesting' ? '⏳' : '📷'}
                </span>
                <span style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', zIndex:1 }}>
                  <span>
                    {camState === 'requesting' ? t('welcome.requesting', lang) : t('welcome.scan_btn', lang)}
                  </span>
                </span>
              </button>


            </div>
          )}
        </div>

        <div />

      </div>
    </SceneBackground>
  )
}

