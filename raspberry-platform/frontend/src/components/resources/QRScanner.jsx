import React, { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { X, Camera, AlertCircle } from "lucide-react";
import { COLORS } from "../../lib/tokens";

/* ------------------------------------------------------------------ */
/*  QRScanner — camera-based wristband QR reader backed by jsQR.       */
/*  Mirrors the scanning loop used by the child welcome screen but     */
/*  styled for the camp operations UI.                                 */
/* ------------------------------------------------------------------ */

export default function QRScanner({ onScan, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanRef = useRef(null);
  const handledRef = useRef(false);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState("");

  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStarting(false);
        setError("Camera is not available on this device. Use manual entry instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 640 }, height: { ideal: 640 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStarting(false);
        beginScan();
      } catch (err) {
        setStarting(false);
        setError(
          err?.name === "NotAllowedError"
            ? "Camera access was denied. Allow camera permission or use manual entry."
            : "Camera is unavailable. Use manual entry instead."
        );
      }
    }

    function beginScan() {
      scanRef.current = setInterval(() => {
        const video = videoRef.current;
        if (!video || video.readyState < 2 || handledRef.current) return;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        if (!canvas.width || !canvas.height) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
          if (code && code.data) {
            handledRef.current = true;
            stop();
            onScanRef.current(String(code.data).trim());
          }
        } catch {
          /* frame decode hiccup — keep scanning */
        }
      }, 350);
    }

    start();

    return () => {
      cancelled = true;
      if (scanRef.current) clearInterval(scanRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function stop() {
    if (scanRef.current) {
      clearInterval(scanRef.current);
      scanRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  return (
    <div className="rounded-xl border p-4 sm:p-6" style={{ borderColor: COLORS.line }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] uppercase tracking-[0.1em]" style={{ color: COLORS.muted }}>
          Camera scanner
        </p>
        <button
          onClick={onCancel}
          aria-label="Close scanner"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[12px] font-semibold transition-colors hover:opacity-80"
          style={{ borderColor: COLORS.line, color: COLORS.body }}
        >
          <X className="w-3.5 h-3.5" /> Close
        </button>
      </div>

      <div
        className="relative w-full max-w-[280px] aspect-square mx-auto rounded-lg overflow-hidden bg-black"
        style={{ boxShadow: "0 0 0 3px rgba(5,150,105,0.25)" }}
      >
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />

        {/* Corner markers */}
        {[
          { top: 10, left: 10, borderTop: `3px solid ${COLORS.brand}`, borderLeft: `3px solid ${COLORS.brand}`, borderRadius: "6px 0 0 0" },
          { top: 10, right: 10, borderTop: `3px solid ${COLORS.brand}`, borderRight: `3px solid ${COLORS.brand}`, borderRadius: "0 6px 0 0" },
          { bottom: 10, left: 10, borderBottom: `3px solid ${COLORS.brand}`, borderLeft: `3px solid ${COLORS.brand}`, borderRadius: "0 0 0 6px" },
          { bottom: 10, right: 10, borderBottom: `3px solid ${COLORS.brand}`, borderRight: `3px solid ${COLORS.brand}`, borderRadius: "0 0 6px 0" },
        ].map((style, i) => (
          <div key={i} style={{ position: "absolute", width: 28, height: 28, ...style }} />
        ))}

        {/* Scan line */}
        <div
          style={{
            position: "absolute", left: 16, right: 16, height: 2, borderRadius: 99,
            background: `linear-gradient(90deg, transparent, ${COLORS.brand}, transparent)`,
            animation: "qrScanLine 1.6s ease-in-out infinite",
            opacity: error ? 0 : 1,
          }}
        />

        {starting && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-white px-3 py-1.5 rounded-full" style={{ background: "rgba(0,0,0,0.7)" }}>
              <Camera className="w-3.5 h-3.5 animate-pulse" /> Starting camera…
            </div>
          </div>
        )}
      </div>

      {error && (
        <div
          className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg border text-[12.5px] font-medium"
          style={{ color: "#B45309", backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <p className="mt-3 text-center text-[12px]" style={{ color: COLORS.muted }}>
        {error ? "Type the wristband barcode above instead." : "Align the wristband QR code inside the frame."}
      </p>

      <style>{`
        @keyframes qrScanLine { 0% { top: 18% } 50% { top: 82% } 100% { top: 18% } }
      `}</style>
    </div>
  );
}
