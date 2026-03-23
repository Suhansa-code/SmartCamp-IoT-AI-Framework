'use client'

// ─────────────────────────────────────────────────────────────────────────────
// app/child/page.jsx — PAGES Child Welcome + QR Scan + Language Selection
//
// Flow:
//   1. Welcome screen (mascot + rotating greeting)
//   2. Tap CTA → camera opens → scan wristband QR
//   3. POST /api/session/start { childId }
//   4. Language picker (Sinhala / Tamil / English)
//   5. setLang(code) → localStorage + context → router.push(/child/task)
//
// Fully responsive via clamp() + fluid maxWidth — works on all phones + tablets
// No fixed px widths on containers, all touch targets ≥ 64px
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/components/psychoedu/context/LanguageContext'
import { t }       from '@/components/psychoedu/lib/translations'
import LanguagePicker from '@/components/psychoedu/child/LanguagePicker'

// ── Greeting keys (rotated every 3 s) ────────────────────────────────────────
const GREETING_KEYS = [
  'welcome.greeting_1',
  'welcome.greeting_2',
  'welcome.greeting_3',
  'welcome.greeting_4',
]

// ── Elephant mascot SVG ───────────────────────────────────────────────────────
function MascotElephant({ size = 120 }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse cx="80" cy="149" rx="42" ry="7"  fill="#0D9488" opacity="0.12" />
      <ellipse cx="80" cy="108" rx="38" ry="30" fill="#0D9488" />
      <circle  cx="80" cy="72"  r="32"          fill="#0D9488" />
      <ellipse cx="44"  cy="70" rx="15" ry="20" fill="#0A7670" />
      <ellipse cx="44"  cy="70" rx="9"  ry="13" fill="#CCFBF1" opacity="0.5" />
      <ellipse cx="116" cy="70" rx="15" ry="20" fill="#0A7670" />
      <ellipse cx="116" cy="70" rx="9"  ry="13" fill="#CCFBF1" opacity="0.5" />
      <circle cx="68" cy="66" r="7"    fill="white" />
      <circle cx="92" cy="66" r="7"    fill="white" />
      <circle cx="70" cy="67" r="4"    fill="#1E3A5F" />
      <circle cx="94" cy="67" r="4"    fill="#1E3A5F" />
      <circle cx="72" cy="65" r="1.5"  fill="white" />
      <circle cx="96" cy="65" r="1.5"  fill="white" />
      <path d="M68 82 Q80 92 92 82" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M80 96 Q72 114 78 126 Q82 134 78 140" stroke="#0A7670" strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M78 140 Q70 144 72 136"               stroke="#0A7670" strokeWidth="7" strokeLinecap="round" fill="none" />
      <rect x="50" y="128" width="20" height="18" rx="8" fill="#0A7670" />
      <rect x="90" y="128" width="20" height="18" rx="8" fill="#0A7670" />
      <text x="118" y="36" fontSize="18">⭐</text>
      <text x="18"  y="44" fontSize="14">✨</text>
    </svg>
  )
}

// ── Camera scan overlay ───────────────────────────────────────────────────────
function CameraView({ videoRef, onCancel, lang }) {
  return (
    <div style={{ width:'100%', display:'flex', flexDirection:'column', alignItems:'center', gap:'clamp(0.75rem,2.5vw,1rem)' }}>
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 'min(320px, 80vw)',
        aspectRatio: '1/1',
        borderRadius: 'clamp(1.25rem,4vw,1.75rem)',
        overflow: 'hidden',
        border: '5px solid #F97316',
        background: '#000',
        flexShrink: 0,
      }}>
        <video
          ref={videoRef}
          style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
          playsInline muted
        />
        {/* Corner markers */}
        {[
          { top:12, left:12,   borderTop:'4px solid #fff', borderLeft:'4px solid #fff',   borderRadius:'6px 0 0 0' },
          { top:12, right:12,  borderTop:'4px solid #fff', borderRight:'4px solid #fff',  borderRadius:'0 6px 0 0' },
          { bottom:12, left:12,  borderBottom:'4px solid #fff', borderLeft:'4px solid #fff',  borderRadius:'0 0 0 6px' },
          { bottom:12, right:12, borderBottom:'4px solid #fff', borderRight:'4px solid #fff', borderRadius:'0 0 6px 0' },
        ].map((s, i) => <div key={i} style={{ position:'absolute', width:28, height:28, ...s }} />)}

        {/* Scan line */}
        <div style={{
          position:'absolute', left:16, right:16, height:3, borderRadius:'9999px',
          background:'linear-gradient(90deg,transparent,#F97316,transparent)',
          animation:'scanLine 1.8s ease-in-out infinite',
        }} />

        <div style={{ position:'absolute', bottom:10, left:0, right:0, display:'flex', justifyContent:'center' }}>
          <span style={{ background:'rgba(0,0,0,0.65)', color:'white', borderRadius:'9999px', padding:'3px 14px', fontSize:'clamp(11px,2.5vw,13px)', fontWeight:700 }}>
            {t('welcome.scanning', lang)}
          </span>
        </div>
      </div>

      <button
        onClick={onCancel}
        style={{
          minHeight: 'clamp(52px,11vw,60px)',
          padding: '0 clamp(1.5rem,5vw,2.5rem)',
          borderRadius: '9999px',
          border: '2px solid #E2E8F0',
          background: 'white',
          color: '#1E3A5F',
          fontSize: 'clamp(0.9rem,2.5vw,1rem)',
          fontWeight: 700,
          cursor: 'pointer',
          width: '100%',
          maxWidth: 'min(320px,80vw)',
        }}
      >
        {t('welcome.cancel', lang)}
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ChildWelcomePage() {
  const router       = useRouter()
  const { lang, setLang } = useLang()

  // screen: 'welcome' | 'camera' | 'loading' | 'language'
  const [screen,    setScreen]   = useState('welcome')
  const [camState,  setCamState] = useState('idle')  // idle|requesting|active|error
  const [errorMsg,  setErrorMsg] = useState('')
  const [greetIdx,  setGreetIdx] = useState(0)
  const [sessionId, setSessionId] = useState(null)

  const videoRef  = useRef(null)
  const streamRef = useRef(null)
  const scanRef   = useRef(null)

  // Check for skip-welcome param (for testing language picker directly)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('skip-welcome') === 'true') {
      setSessionId('test-session')
      setScreen('language')
    }
  }, [])

  // Rotating greetings
  useEffect(() => {
    if (screen !== 'welcome') return
    const id = setInterval(() => setGreetIdx(i => (i + 1) % GREETING_KEYS.length), 3000)
    return () => clearInterval(id)
  }, [screen])

  // Cleanup camera on unmount
  useEffect(() => () => stopCamera(), [])

  // ── Camera ────────────────────────────────────────────────────────────────
  async function startCamera() {
    setErrorMsg('')
    setCamState('requesting')
    setScreen('camera')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 640 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCamState('active')
      beginQRScan()
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? t('welcome.err_denied', lang)
        : t('welcome.err_unavailable', lang)
      setErrorMsg(msg)
      setCamState('error')
      setScreen('welcome')
    }
  }

  function stopCamera() {
    clearInterval(scanRef.current)
    clearTimeout(scanRef.current)
    streamRef.current?.getTracks().forEach(tr => tr.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  function cancelCamera() {
    stopCamera()
    setCamState('idle')
    setScreen('welcome')
  }

  // ── QR decode ─────────────────────────────────────────────────────────────
  function beginQRScan() {
    if (typeof window === 'undefined') return
    if ('BarcodeDetector' in window) {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
      scanRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return
        try {
          const codes = await detector.detect(videoRef.current)
          if (codes.length > 0) { clearInterval(scanRef.current); handleQRResult(codes[0].rawValue) }
        } catch { /* not ready */ }
      }, 300)
    } else {
      // Demo fallback (replace with jsQR in production)
      scanRef.current = setTimeout(() => handleQRResult('CHILD-DEMO-001'), 2500)
    }
  }

  // ── Session start → show language picker ──────────────────────────────────
  const handleQRResult = useCallback(async (childId) => {
    stopCamera()
    setCamState('idle')
    setScreen('loading')

    try {
      const res = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { sessionId: sid } = await res.json()
      setSessionId(sid)
    } catch {
      setSessionId('offline')
    }
    // Always show language picker after scan
    setScreen('language')
  }, [])

  // ── Language selected ─────────────────────────────────────────────────────
  function handleLanguageSelect(code) {
    setLang(code)
    const sid = sessionId ?? 'offline'
    router.push(`/child/task?session=${sid}&lang=${code}`)
  }

  // ── Render: language picker ───────────────────────────────────────────────
  if (screen === 'language') {
    return (
      <LanguagePicker
        sessionId={sessionId}
        onSelect={handleLanguageSelect}
      />
    )
  }

  // ── Render: loading ───────────────────────────────────────────────────────
  if (screen === 'loading') {
    return (
      <div style={{
        minHeight:'100svh', background:'#F0F9FF',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'clamp(1rem,3vw,1.5rem)',
      }}>
        <div style={{
          width:'clamp(120px,30vw,160px)', height:'clamp(120px,30vw,160px)', borderRadius:'50%',
          background:'linear-gradient(135deg,#CCFBF1,#BAE6FD)',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 8px 40px rgba(13,148,136,0.18)',
        }}>
          <div style={{ width:48, height:48, borderRadius:'50%', border:'5px solid #0D9488', borderTopColor:'transparent', animation:'spin 0.75s linear infinite' }} />
        </div>
        <p style={{ fontFamily:"'Baloo 2',cursive", fontSize:'clamp(1.3rem,4vw,1.7rem)', fontWeight:800, color:'#1E3A5F' }}>
          {t('welcome.loading', lang)}
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Render: welcome + camera ──────────────────────────────────────────────
  const greeting = t(GREETING_KEYS[greetIdx], lang)

  return (
    <>
      <style>{`
        @keyframes scanLine   { 0%,100% { top:18%; } 50% { top:80%; } }
        @keyframes floatUp    { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-10px); } }
        @keyframes fadeSlide  { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin       { to { transform:rotate(360deg); } }
        .mascot-float { animation: floatUp 3.2s ease-in-out infinite; }
        .fade-in      { animation: fadeSlide 0.4s ease forwards; }
      `}</style>

      <main style={{
        minHeight: '100svh',
        background: '#F0F9FF',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'clamp(1.25rem,4vw,2rem) clamp(1rem,4vw,1.5rem)',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}>
        {/* Blobs */}
        <div style={{ position:'absolute', top:0, right:0, width:'min(240px,50vw)', height:'min(240px,50vw)', borderRadius:'50%', background:'#0D9488', opacity:0.07, transform:'translate(35%,-35%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:0, left:0, width:'min(280px,55vw)', height:'min(280px,55vw)', borderRadius:'50%', background:'#F97316', opacity:0.06, transform:'translate(-35%,35%)', pointerEvents:'none' }} />

        {/* PAGES badge */}
        <div className="fade-in" style={{ display:'flex', justifyContent:'center', width:'100%' }}>
          <div style={{
            background:'#0D9488', color:'white', borderRadius:'9999px',
            padding:'clamp(4px,1.5vw,6px) clamp(14px,4vw,20px)',
            fontFamily:"'Baloo 2',cursive", fontWeight:700,
            fontSize:'clamp(11px,2.5vw,13px)', letterSpacing:'0.12em', textTransform:'uppercase',
            boxShadow:'0 2px 12px rgba(13,148,136,0.2)',
          }}>
            {t('welcome.badge', lang)}
          </div>
        </div>

        {/* Centre content */}
        <div style={{
          display:'flex', flexDirection:'column', alignItems:'center',
          gap:'clamp(1.25rem,3.5vw,1.75rem)',
          width:'100%', maxWidth:'min(400px, 92vw)',
        }}>
          {/* Camera view */}
          {screen === 'camera' && (
            <CameraView videoRef={videoRef} onCancel={cancelCamera} lang={lang} />
          )}

          {/* Welcome: mascot + greeting + button */}
          {screen === 'welcome' && (
            <>
              {/* Mascot */}
              <div className="mascot-float">
                <div style={{
                  width: 'clamp(130px,32vw,172px)',
                  height: 'clamp(130px,32vw,172px)',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg,#CCFBF1,#BAE6FD)',
                  display: 'flex', alignItems:'center', justifyContent:'center',
                  boxShadow: '0 12px 48px rgba(13,148,136,0.18)',
                }}>
                  <MascotElephant size={Math.round(0.78 * 150)} />
                </div>
              </div>

              {/* Animated greeting */}
              <div className="fade-in" key={greetIdx} style={{ textAlign:'center' }}>
                <p style={{
                  fontFamily:"'Baloo 2',cursive",
                  fontSize:'clamp(1.7rem,7vw,2.6rem)',
                  fontWeight:900, color:'#1E3A5F', lineHeight:1.15,
                }}>
                  {greeting}
                </p>
              </div>

              {/* Error */}
              {errorMsg && (
                <div className="fade-in" style={{
                  background:'#FED7AA', color:'#9A3412',
                  borderRadius:'clamp(0.75rem,3vw,1rem)',
                  padding:'clamp(0.65rem,2vw,0.85rem) clamp(1rem,3vw,1.25rem)',
                  textAlign:'center',
                  fontSize:'clamp(0.85rem,2.5vw,1rem)', fontWeight:600, width:'100%',
                }}>
                  {errorMsg}
                </div>
              )}

              {/* Scan CTA */}
              <button
                onClick={startCamera}
                disabled={camState === 'requesting'}
                style={{
                  width: '100%',
                  minHeight: 'clamp(64px,14vw,76px)',
                  background: camState === 'requesting' ? '#FDBA74' : '#F97316',
                  color: 'white',
                  borderRadius: '9999px',
                  border: 'none',
                  fontFamily:"'Baloo 2',cursive",
                  fontSize: 'clamp(1.1rem,4vw,1.4rem)',
                  fontWeight: 900,
                  display: 'flex', alignItems:'center', justifyContent:'center',
                  gap: 'clamp(0.5rem,2vw,0.75rem)',
                  boxShadow: '0 8px 32px rgba(249,115,22,0.3)',
                  cursor: camState === 'requesting' ? 'not-allowed' : 'pointer',
                  transition: 'transform 0.1s, background 0.2s',
                  WebkitTapHighlightColor: 'transparent',
                }}
                onPointerDown={e => { if (camState !== 'requesting') e.currentTarget.style.transform = 'scale(0.96)' }}
                onPointerUp={e => e.currentTarget.style.transform = 'scale(1)'}
                aria-label="Scan QR wristband"
              >
                <span style={{ fontSize:'clamp(1.5rem,5vw,2rem)' }}>
                  {camState === 'requesting' ? '⏳' : '📷'}
                </span>
                <span style={{ display:'flex', flexDirection:'column', alignItems:'flex-start' }}>
                  <span>{camState === 'requesting' ? t('welcome.requesting', lang) : t('welcome.scan_btn', lang)}</span>
                  <span style={{ fontSize:'clamp(0.65rem,2vw,0.8rem)', fontWeight:600, opacity:0.85, letterSpacing:'0.08em' }}>
                    {t('welcome.scan_sub', lang)}
                  </span>
                </span>
              </button>
            </>
          )}
        </div>

        {/* Language hint strip */}
        <p style={{
          fontSize:'clamp(0.75rem,2vw,0.85rem)', fontWeight:600, color:'#0D9488', opacity:0.7, textAlign:'center',
        }}>
          සිංහල · தமிழ் · English
        </p>
      </main>
    </>
  )
}
