import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fingerprint,
  CheckCircle,
  UserPlus,
  ScanLine,
  Activity,
  ArrowRight,
  ShieldCheck,
  User,
  Users
} from "lucide-react";

function RegistrationScreen() {
  const [scanState, setScanState] = useState("idle");
  const [profile, setProfile] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [qosInfo, setQosInfo] = useState(null);

  const [newPersonForm, setNewPersonForm] = useState({
    full_name: "",
    age: "",
    gender: "M",
    person_type: "refugee",
    family_size: 1,
    is_pregnant: 0,
    has_chronic_illness: 0,
    medical_notes: "",
  });

  const handleScanFingerprint = async () => {
    setScanState("scanning");
    setStatusMessage("Initializing biometric scan...");

    try {
      const res = await fetch("http://localhost:5000/api/fingerprint/scan", {
        method: "POST",
      });
      const data = await res.json();

      setTimeout(() => {
        if (data.matched) {
          setProfile(data.person);
          setScanState("found");
          setStatusMessage(`Identity verified: ${data.person.full_name}`);
        } else {
          setScanState("not_found");
          setStatusMessage("No profile found. Please register.");
        }
      }, 1500);
    } catch (err) {
      setScanState("idle");
      setStatusMessage("Scanner offline or error");
    }
  };

  const handleCheckin = async () => {
    const res = await fetch("http://localhost:5000/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ person_id: profile.id }),
    });

    const data = await res.json();
    setQosInfo(data.mqtt);
    setStatusMessage(`Wristband assigned: ${data.wristband_barcode}`);
    setScanState("success");
  };

  const handleRegisterNew = async () => {
    const res = await fetch("http://localhost:5000/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPersonForm),
    });

    const data = await res.json();
    setProfile(data.person);
    setQosInfo(data.mqtt);
    setStatusMessage(`Wristband assigned: ${data.wristband_barcode}`);
    setScanState("success");
  };

  const reset = () => {
    setScanState("idle");
    setProfile(null);
    setStatusMessage("");
    setQosInfo(null);
  };

  return (
    <div className="min-h-screen text-slate-800 font-sans relative overflow-hidden">

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">

        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
            <ScanLine className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-800 tracking-tight">
              Camp Registration Hub
            </h1>
            <p className="text-sm text-slate-500">
              Biometric check-in and secure enrollment
            </p>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-[380px_1fr] gap-6">

          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/70 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-[0_1px_4px_0_rgba(0,0,0,0.04)] p-8 flex flex-col items-center justify-center min-h-[480px]"
          >
            <div className="flex flex-col items-center w-full">
              <div className="relative mb-10">
                <motion.div
                  animate={{
                    scale: scanState === "scanning" ? [1, 1.08, 1] : 1,
                    boxShadow: scanState === "scanning"
                      ? ["0 0 0px rgba(59,130,246,0)", "0 0 30px rgba(59,130,246,0.25)", "0 0 0px rgba(59,130,246,0)"]
                      : "0 0 0px rgba(0,0,0,0)"
                  }}
                  transition={{ duration: 2, repeat: scanState === "scanning" ? Infinity : 0 }}
                  className={`w-56 h-56 rounded-full border-2 flex items-center justify-center relative overflow-hidden transition-colors duration-500
                  ${scanState === "scanning" ? "border-blue-300 bg-blue-50" :
                    scanState === "found" ? "border-blue-500 bg-blue-50" :
                    scanState === "not_found" ? "border-slate-300 bg-slate-50" :
                    scanState === "success" ? "border-blue-300 bg-blue-50" :
                    "border-slate-200 bg-white"}`}
                >
                  <Fingerprint className={`w-20 h-20 transition-colors duration-500 ${
                    scanState === "scanning" ? "text-blue-500" :
                    scanState === "found" ? "text-blue-600" :
                    scanState === "not_found" ? "text-slate-400" :
                    scanState === "success" ? "text-blue-600" :
                    "text-slate-300"
                  }`} />

                  <AnimatePresence>
                    {scanState === "scanning" && (
                      <motion.div
                        initial={{ top: "-10%" }}
                        animate={{ top: "110%" }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        className="absolute left-0 right-0 h-0.5 bg-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.6)] z-20"
                      />
                    )}
                  </AnimatePresence>
                </motion.div>

                {scanState === "scanning" && (
                  <>
                    <motion.div animate={{ scale: [1, 1.4], opacity: [0.3, 0] }} transition={{ duration: 1.5, repeat: Infinity }} className="absolute inset-0 rounded-full border border-blue-300 pointer-events-none" />
                    <motion.div animate={{ scale: [1, 1.8], opacity: [0.15, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }} className="absolute inset-0 rounded-full border border-blue-200 pointer-events-none" />
                  </>
                )}
              </div>

              <div className="text-center w-full">
                <h3 className={`text-base font-semibold mb-1 transition-colors duration-300 ${
                  scanState === "found" ? "text-blue-700" :
                  scanState === "not_found" ? "text-slate-600" :
                  scanState === "success" ? "text-blue-700" :
                  "text-slate-700"
                }`}>
                  {scanState === "idle" && "Ready to Scan"}
                  {scanState === "scanning" && "Analyzing Biometrics"}
                  {scanState === "found" && "Match Confirmed"}
                  {scanState === "not_found" && "No Record Found"}
                  {scanState === "success" && "Process Complete"}
                </h3>

                <p className="text-sm text-slate-400 h-8">
                  {statusMessage || "Place finger on the biometric pad to begin"}
                </p>

                {scanState === "idle" && (
                  <button
                    onClick={handleScanFingerprint}
                    className="mt-6 w-full px-8 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg transition-all hover:bg-blue-700 active:scale-[0.98] shadow-sm"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Fingerprint className="w-4 h-4" />
                      Initiate Scan
                    </span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/70 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-[0_1px_4px_0_rgba(0,0,0,0.04)] p-8 min-h-[480px] flex flex-col justify-center"
          >
            <AnimatePresence mode="wait">
              {(scanState === "idle" || scanState === "scanning") && (
                <motion.div
                  key="waiting"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center text-center h-full space-y-5"
                >
                  <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
                    <ShieldCheck className="w-8 h-8 text-slate-300" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-500">Awaiting Input</h3>
                    <p className="text-sm text-slate-400 mt-1 max-w-xs">Scan a fingerprint to pull up a profile or create a new registration.</p>
                  </div>
                </motion.div>
              )}

              {scanState === "found" && profile && (
                <motion.div
                  key="found"
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                  className="space-y-6"
                >
                  <div className="flex items-start gap-5">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-lg font-bold shrink-0 shadow-sm">
                      {profile.full_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-slate-800 tracking-tight">{profile.full_name}</h2>
                      <div className="flex items-center gap-1.5 mt-1.5 text-blue-600 text-xs font-medium bg-blue-50 w-fit px-2.5 py-1 rounded-md border border-blue-100">
                        <CheckCircle className="w-3.5 h-3.5" /> Identity Verified
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-lg px-4 py-3.5 border border-slate-200 shadow-[0_1px_2px_0_rgba(0,0,0,0.03)]">
                      <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                        <User className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Age & Gender</span>
                      </div>
                      <p className="text-base font-semibold text-slate-800">{profile.age} yrs &middot; {profile.gender}</p>
                    </div>
                    <div className="bg-white rounded-lg px-4 py-3.5 border border-slate-200 shadow-[0_1px_2px_0_rgba(0,0,0,0.03)]">
                      <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                        <Users className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Family</span>
                      </div>
                      <p className="text-base font-semibold text-slate-800">{profile.family_size} Members</p>
                    </div>
                  </div>

                  <button
                    onClick={handleCheckin}
                    className="w-full px-8 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg transition-all hover:bg-blue-700 active:scale-[0.98] shadow-sm"
                  >
                    <span className="flex items-center justify-center gap-2">
                      Confirm Check-in & Assign Wristband
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </button>
                </motion.div>
              )}

              {scanState === "not_found" && (
                <motion.div key="form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <NewPersonForm
                    form={newPersonForm}
                    setForm={setNewPersonForm}
                    onSubmit={handleRegisterNew}
                    onCancel={reset}
                  />
                </motion.div>
              )}

              {scanState === "success" && (
                <motion.div
                  key="success"
                  initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                  className="flex flex-col items-center text-center space-y-5"
                >
                  <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-blue-600" />
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold text-slate-800">Ready to Go</h2>
                    <p className="text-sm text-blue-700 mt-2 bg-blue-50 px-5 py-2 rounded-lg border border-blue-100 font-medium">
                      {statusMessage}
                    </p>
                  </div>

                  {qosInfo && (
                    <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5" />
                      Syncing to cloud (QoS {qosInfo.final_qos})
                    </div>
                  )}

                  <button
                    onClick={reset}
                    className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-all active:scale-[0.98] shadow-sm"
                  >
                    Process Next Person
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function NewPersonForm({ form, setForm, onSubmit, onCancel }) {
  const update = (field, value) => setForm({ ...form, [field]: value });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
          <UserPlus className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-800">New Registration</h2>
          <p className="text-xs text-slate-500">Fill details to create a profile and assign wristband</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
          <input
            placeholder="e.g. John Doe"
            value={form.full_name}
            onChange={(e) => update("full_name", e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-slate-800 placeholder-slate-400"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Age</label>
          <input
            type="number"
            placeholder="Years"
            value={form.age}
            onChange={(e) => update("age", e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-slate-800"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Gender</label>
          <select
            value={form.gender}
            onChange={(e) => update("gender", e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-slate-800"
          >
            <option value="M">Male</option>
            <option value="F">Female</option>
            <option value="O">Other</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Person Type</label>
          <select
            value={form.person_type}
            onChange={(e) => update("person_type", e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-slate-800"
          >
            <option value="refugee">Refugee</option>
            <option value="asylum_seeker">Asylum Seeker</option>
            <option value="idp">IDP (Internally Displaced)</option>
            <option value="returned_refugee">Returned Refugee</option>
            <option value="returned_idp">Returned IDP</option>
            <option value="stateless">Stateless Person</option>
            <option value="ooc">Others of Concern</option>
          </select>
        </div>
      </div>

      <div className="flex gap-3 pt-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-all active:scale-[0.98]"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          className="flex-[2] bg-blue-600 text-white py-2.5 text-sm font-medium rounded-lg hover:bg-blue-700 transition-all active:scale-[0.98] flex justify-center items-center gap-2 shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Enroll & Print
        </button>
      </div>
    </div>
  );
}

export default RegistrationScreen;
