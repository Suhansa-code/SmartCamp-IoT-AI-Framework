import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fingerprint,
  CheckCircle,
  UserPlus,
  XCircle,
  ScanLine,
  Activity,
  ArrowRight,
  ShieldCheck,
  User,
  HeartPulse,
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

  // ---------------- API CALLS ----------------
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
      }, 1500); // Artificial delay for premium feel
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

  // ---------------- UI ----------------
  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-8 lg:p-10 text-slate-800 font-sans relative overflow-hidden">
      {/* Dynamic Background Blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[100px] mix-blend-multiply pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-emerald-400/20 rounded-full blur-[120px] mix-blend-multiply pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">

        {/* HEADER */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
            <ScanLine className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-900 to-slate-800 tracking-tight">
              Camp Registration Hub
            </h1>
            <p className="text-slate-500 mt-1 font-medium">
              Biometric check-in and secure enrollment
            </p>
          </div>
        </motion.div>

        {/* MAIN GRID */}
        <div className="grid lg:grid-cols-[400px_1fr] gap-8">

          {/* LEFT: SCANNER PANEL */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 flex flex-col items-center justify-center min-h-[500px] relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none" />
            
            <div className="relative z-10 flex flex-col items-center w-full">
              <div className="relative mb-12">
                <motion.div
                  animate={{ 
                    scale: scanState === "scanning" ? [1, 1.1, 1] : 1,
                    boxShadow: scanState === "scanning" 
                      ? ["0 0 0px rgba(59,130,246,0)", "0 0 40px rgba(59,130,246,0.4)", "0 0 0px rgba(59,130,246,0)"] 
                      : "0 0 0px rgba(0,0,0,0)"
                  }}
                  transition={{ duration: 2, repeat: scanState === "scanning" ? Infinity : 0 }}
                  className={`w-64 h-64 rounded-full border-2 flex items-center justify-center relative overflow-hidden transition-colors duration-500
                  ${scanState === "scanning" ? "border-blue-400 bg-blue-50/50" :
                    scanState === "found" ? "border-emerald-400 bg-emerald-50/50" :
                    scanState === "not_found" ? "border-amber-400 bg-amber-50/50" :
                    scanState === "success" ? "border-blue-500 bg-blue-50/50" :
                    "border-slate-200 bg-white"}`}
                >
                  <Fingerprint className={`w-24 h-24 transition-colors duration-500 ${
                    scanState === "scanning" ? "text-blue-500" :
                    scanState === "found" ? "text-emerald-500" :
                    scanState === "not_found" ? "text-amber-500" :
                    scanState === "success" ? "text-blue-600" :
                    "text-slate-300"
                  }`} />

                  {/* Scanning Animation Overlay */}
                  <AnimatePresence>
                    {scanState === "scanning" && (
                      <motion.div
                        initial={{ top: "-10%" }}
                        animate={{ top: "110%" }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        className="absolute left-0 right-0 h-1 bg-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.8)] z-20"
                      />
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Radar rings */}
                {scanState === "scanning" && (
                  <>
                    <motion.div animate={{ scale: [1, 1.5], opacity: [0.5, 0] }} transition={{ duration: 1.5, repeat: Infinity }} className="absolute inset-0 rounded-full border border-blue-400 pointer-events-none" />
                    <motion.div animate={{ scale: [1, 2], opacity: [0.3, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }} className="absolute inset-0 rounded-full border border-blue-300 pointer-events-none" />
                  </>
                )}
              </div>

              <div className="text-center w-full">
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  {scanState === "idle" && "Ready to Scan"}
                  {scanState === "scanning" && "Analyzing Biometrics"}
                  {scanState === "found" && "Match Confirmed"}
                  {scanState === "not_found" && "No Record Found"}
                  {scanState === "success" && "Process Complete"}
                </h3>
                
                <p className="text-sm font-medium text-slate-500 h-10">
                  {statusMessage || "Place finger on the biometric pad to begin"}
                </p>

                {scanState === "idle" && (
                  <button
                    onClick={handleScanFingerprint}
                    className="mt-6 w-full group relative px-8 py-4 bg-slate-900 text-white font-bold rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(15,23,42,0.15)] hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <span className="relative flex items-center justify-center gap-2">
                      <Fingerprint className="w-5 h-5" />
                      Initiate Scan
                    </span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          {/* RIGHT: CONTENT PANEL */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/80 backdrop-blur-2xl border border-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-8 sm:p-10 relative overflow-hidden min-h-[500px] flex flex-col justify-center"
          >
            <AnimatePresence mode="wait">
              {/* IDLE / SCANNING */}
              {(scanState === "idle" || scanState === "scanning") && (
                <motion.div 
                  key="waiting"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center text-slate-400 text-center h-full space-y-6"
                >
                  <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center">
                    <ShieldCheck className="w-10 h-10 text-slate-300" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-500">Awaiting Input</h3>
                    <p className="text-sm mt-2 max-w-xs">Scan a fingerprint to pull up a profile or create a new registration.</p>
                  </div>
                </motion.div>
              )}

              {/* FOUND */}
              {scanState === "found" && profile && (
                <motion.div 
                  key="found"
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <div className="flex items-start gap-6">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 p-1 shadow-lg shadow-emerald-500/20">
                      <div className="w-full h-full bg-white rounded-full flex items-center justify-center text-emerald-600 text-2xl font-bold">
                        {profile.full_name.substring(0, 2).toUpperCase()}
                      </div>
                    </div>
                    <div>
                      <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">{profile.full_name}</h2>
                      <div className="flex items-center gap-2 mt-2 text-emerald-600 font-semibold bg-emerald-50 w-fit px-3 py-1 rounded-full text-sm">
                        <CheckCircle className="w-4 h-4" /> Identity Verified
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <User className="w-4 h-4" /> <span className="text-xs font-bold uppercase tracking-wider">Age & Gender</span>
                      </div>
                      <p className="text-xl font-bold text-slate-800">{profile.age} yrs • {profile.gender}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Users className="w-4 h-4" /> <span className="text-xs font-bold uppercase tracking-wider">Family Unit</span>
                      </div>
                      <p className="text-xl font-bold text-slate-800">{profile.family_size} Members</p>
                    </div>
                  </div>

                  <button
                    onClick={handleCheckin}
                    className="w-full group relative px-8 py-4 bg-emerald-500 text-white font-bold rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <span className="relative flex items-center justify-center gap-2 text-lg">
                      Confirm Check-in & Assign Wristband
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>
                </motion.div>
              )}

              {/* NOT FOUND → FORM */}
              {scanState === "not_found" && (
                <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <NewPersonForm
                    form={newPersonForm}
                    setForm={setNewPersonForm}
                    onSubmit={handleRegisterNew}
                    onCancel={reset}
                  />
                </motion.div>
              )}

              {/* SUCCESS */}
              {scanState === "success" && (
                <motion.div 
                  key="success"
                  initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                  className="flex flex-col items-center text-center space-y-6"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 rounded-full" />
                    <CheckCircle className="w-24 h-24 text-blue-500 relative z-10" />
                  </div>
                  
                  <div>
                    <h2 className="text-3xl font-extrabold text-slate-800">Ready to Go</h2>
                    <p className="text-slate-500 mt-2 text-lg font-medium bg-blue-50 text-blue-700 px-6 py-3 rounded-2xl inline-block border border-blue-100">
                      {statusMessage}
                    </p>
                  </div>

                  {qosInfo && (
                    <div className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Syncing to cloud (QoS {qosInfo.final_qos})
                    </div>
                  )}

                  <button
                    onClick={reset}
                    className="mt-8 px-8 py-3 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 hover:border-slate-300 transition-all hover:scale-105 active:scale-95"
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

// ---------------- FORM ----------------
function NewPersonForm({ form, setForm, onSubmit, onCancel }) {
  const update = (field, value) => setForm({ ...form, [field]: value });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
          <UserPlus className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">New Registration</h2>
          <p className="text-xs font-medium text-slate-500">Fill details to create a profile and assign wristband</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
          <input
            placeholder="e.g. John Doe"
            value={form.full_name}
            onChange={(e) => update("full_name", e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-800 placeholder-slate-400"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Age</label>
          <input
            type="number"
            placeholder="Years"
            value={form.age}
            onChange={(e) => update("age", e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-800"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Gender</label>
          <select
            value={form.gender}
            onChange={(e) => update("gender", e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-800"
          >
            <option value="M">Male</option>
            <option value="F">Female</option>
            <option value="O">Other</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Person Type</label>
          <select
            value={form.person_type}
            onChange={(e) => update("person_type", e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-800"
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

      <div className="flex gap-4 pt-4">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all hover:scale-105 active:scale-95"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all hover:scale-105 active:scale-95 flex justify-center items-center gap-2"
        >
          <UserPlus className="w-5 h-5" />
          Enroll & Print
        </button>
      </div>
    </div>
  );
}

export default RegistrationScreen;