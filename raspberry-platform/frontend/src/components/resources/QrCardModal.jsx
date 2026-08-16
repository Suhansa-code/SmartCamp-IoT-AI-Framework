import React from "react";
import { QrCode, X, Download } from "lucide-react";
import { COLORS, SHADOW_CARD } from "../../lib/tokens";

export default function QrCardModal({ data, onClose }) {
  if (!data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg p-4 sm:p-5 max-w-sm w-full" style={{ boxShadow: SHADOW_CARD }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13.5px] font-semibold flex items-center gap-1.5" style={{ color: COLORS.ink }}>
            <QrCode className="w-4 h-4" style={{ color: COLORS.brand }} /> QR Card
          </h3>
          <button onClick={onClose} className="text-[12px] font-semibold flex items-center gap-1" style={{ color: COLORS.muted }}>
            <X className="w-3.5 h-3.5" /> Close
          </button>
        </div>

        <div className="rounded-lg border p-3" style={{ borderColor: COLORS.line, backgroundColor: "#FAFAF9" }}>
          <p className="text-[14px] font-serif font-medium text-center mb-2" style={{ color: COLORS.ink }}>
            {data.full_name}
          </p>
          <div className="flex items-center justify-center bg-white rounded-lg p-2 border" style={{ borderColor: COLORS.line }}>
            <img src={data.data_url} alt={`QR for ${data.full_name}`} style={{ width: 220, height: 220 }} />
          </div>
          <div className="flex items-center justify-center gap-2 mt-2.5">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-md" style={{ color: COLORS.body, backgroundColor: "#F5F6F5" }}>
              {data.wristband_barcode}
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-md" style={{ color: COLORS.muted, backgroundColor: "#F5F6F5" }}>
              {data.qr_identifier}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <a
            href={data.data_url}
            download={`qr-${data.wristband_barcode || data.person_id || "person"}.png`}
            className="text-[12.5px] font-semibold inline-flex items-center gap-1.5"
            style={{ color: COLORS.brand }}
          >
            <Download className="w-3.5 h-3.5" /> Download PNG
          </a>
          <button
            onClick={() => window.print()}
            className="text-[12.5px] font-semibold px-3 py-1.5 rounded-lg border"
            style={{ borderColor: COLORS.line, color: COLORS.body }}
          >
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
