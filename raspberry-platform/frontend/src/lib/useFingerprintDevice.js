import { useCallback, useEffect, useRef, useState } from "react";
import { API } from "../components/ui/config";

/**
 * Live link to the camp box fingerprint scanner.
 *
 * The sensor pushes events with no HTTP request in flight — a finger touches the
 * pad, or an enrollment advances a step — so the screen listens on an SSE stream
 * rather than polling. Callbacks are held in a ref so the stream is opened once
 * and survives re-renders of the consuming component.
 */
export default function useFingerprintDevice(handlers = {}) {
  const [status, setStatus] = useState(null);
  const [streamOnline, setStreamOnline] = useState(false);

  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/fingerprint/status`);
      if (!res.ok) throw new Error("status unavailable");
      setStatus(await res.json());
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    refreshStatus();

    let source;
    try {
      source = new EventSource(`${API}/api/fingerprint/events`);
    } catch {
      return undefined;
    }

    const on = (name, fn) => {
      const wrapped = (evt) => {
        let payload = null;
        try { payload = JSON.parse(evt.data); } catch { return; }
        fn(payload);
      };
      source.addEventListener(name, wrapped);
      return () => source.removeEventListener(name, wrapped);
    };

    source.onopen = () => setStreamOnline(true);
    source.onerror = () => setStreamOnline(false);

    const offs = [
      on("status", (payload) => {
        setStatus((prev) => (prev ? { ...prev, device: payload, simulation: !payload.connected } : prev));
        handlersRef.current.onStatus?.(payload);
      }),
      on("device", (payload) => handlersRef.current.onDeviceEvent?.(payload)),
      on("scan-result", (payload) => handlersRef.current.onScanResult?.(payload)),
      on("enroll-progress", (payload) => handlersRef.current.onEnrollProgress?.(payload)),
      on("enroll-result", (payload) => {
        handlersRef.current.onEnrollResult?.(payload);
        refreshStatus();
      }),
      on("error", (payload) => handlersRef.current.onDeviceError?.(payload)),
    ];

    return () => {
      offs.forEach((off) => off());
      source.close();
    };
  }, [refreshStatus]);

  const deviceConnected = Boolean(status?.device?.connected);

  return { status, streamOnline, deviceConnected, refreshStatus };
}

/** Operator-facing wording for the sensor's capture prompts. */
export const ENROLL_STEP_LABEL = {
  STARTED: "Starting enrollment…",
  PLACE_FINGER: "Place finger on the sensor",
  LIFT_FINGER: "Lift your finger",
  PLACE_AGAIN: "Place the same finger again",
};
