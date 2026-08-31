import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { COLORS } from "../../../lib/tokens";
import Button from "../base/Button";

export default function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", variant = "danger", onConfirm, onCancel }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }} onClick={onCancel} />
          <motion.div
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative bg-white rounded-xl p-6 w-full max-w-sm space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                variant === "danger" ? "" : ""
              }`} style={{ backgroundColor: variant === "danger" ? COLORS.dangerSoft : COLORS.warningSoft }}>
                <AlertTriangle className="w-4.5 h-4.5" style={{ color: variant === "danger" ? COLORS.danger : COLORS.warning }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[13px] font-semibold" style={{ color: COLORS.ink }}>{title}</h3>
                <p className="text-[12px] mt-1" style={{ color: COLORS.muted }}>{message}</p>
              </div>
              <button onClick={onCancel} style={{ color: COLORS.muted }} className="hover:opacity-70 transition-opacity">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" onClick={onCancel} className="flex-1">
                Cancel
              </Button>
              <Button variant={variant} onClick={onConfirm} className="flex-1">
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
