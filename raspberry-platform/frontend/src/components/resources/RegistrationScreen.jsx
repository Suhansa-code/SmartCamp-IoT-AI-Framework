import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Fingerprint,
  CheckCircle,
  UserPlus,
  XCircle,
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
    setStatusMessage("Scanning fingerprint...");

    try {
      const res = await fetch("http://localhost:5000/api/fingerprint/scan", {
        method: "POST",
      });
      const data = await res.json();

      if (data.matched) {
        setProfile(data.person);
        setScanState("found");
        setStatusMessage(`Welcome ${data.person.full_name}`);
      } else {
        setScanState("not_found");
        setStatusMessage("No profile found. Register new person.");
      }
    } catch (err) {
      setScanState("idle");
      setStatusMessage("Scanner error");
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
    setStatusMessage(`Wristband: ${data.wristband_barcode}`);
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
    setStatusMessage(`Wristband: ${data.wristband_barcode}`);
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
    <div className="p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* HEADER */}
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900">
            Camp Registration
          </h1>
          <p className="text-gray-500 mt-2">
            Scan fingerprint or register new individuals
          </p>
        </div>

        {/* MAIN CARD */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* SCANNER */}
          <div className="bg-white rounded-2xl shadow-xl p-6 flex flex-col items-center justify-center">

            <motion.div
              animate={{ scale: scanState === "scanning" ? 1.1 : 1 }}
              className={`w-56 h-56 rounded-full border-4 flex flex-col items-center justify-center
              ${scanState === "scanning" ? "border-yellow-400 bg-yellow-50 animate-pulse" :
                scanState === "found" ? "border-green-400 bg-green-50" :
                scanState === "not_found" ? "border-red-400 bg-red-50" :
                scanState === "success" ? "border-blue-400 bg-blue-50" :
                "border-gray-300 bg-gray-50"}`}
            >
              <Fingerprint className="w-20 h-20 text-gray-600" />
              <p className="mt-2 font-semibold">
                {scanState === "idle" && "Ready"}
                {scanState === "scanning" && "Scanning..."}
                {scanState === "found" && "Matched"}
                {scanState === "not_found" && "Not Found"}
                {scanState === "success" && "Done"}
              </p>
            </motion.div>

            {scanState === "idle" && (
              <button
                onClick={handleScanFingerprint}
                className="mt-6 w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-200 font-semibold text-lg"
              >
                Start Scan
              </button>
            )}
          </div>

          {/* RIGHT PANEL */}
          <div className="bg-white rounded-2xl shadow-xl p-6">

            {/* FOUND */}
            {scanState === "found" && profile && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="text-3xl font-bold text-gray-900">{profile.full_name}</h2>
                <p className="text-green-600 font-semibold mt-1">Profile Found</p>

                <div className="grid grid-cols-2 gap-4 mt-6 p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Age</p>
                    <p className="text-lg font-semibold text-gray-900">{profile.age}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Gender</p>
                    <p className="text-lg font-semibold text-gray-900">{profile.gender}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Family Size</p>
                    <p className="text-lg font-semibold text-gray-900">{profile.family_size}</p>
                  </div>
                </div>

                <button
                  onClick={handleCheckin}
                  className="mt-6 w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200"
                >
                  Confirm Check-in
                </button>
              </motion.div>
            )}

            {/* NOT FOUND → FORM */}
            {scanState === "not_found" && (
              <NewPersonForm
                form={newPersonForm}
                setForm={setNewPersonForm}
                onSubmit={handleRegisterNew}
                onCancel={reset}
              />
            )}

            {/* SUCCESS */}
            {scanState === "success" && (
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="text-center py-8"
              >
                <CheckCircle className="w-20 h-20 text-green-500 mx-auto animate-bounce" />
                <h2 className="text-3xl font-bold mt-4 text-gray-900">Success!</h2>
                <p className="text-gray-600 mt-3 text-lg">{statusMessage}</p>

                <button
                  onClick={reset}
                  className="mt-8 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200"
                >
                  Next Person
                </button>
              </motion.div>
            )}

            {/* STATUS */}
            {scanState !== "success" && statusMessage && (
              <p className="text-blue-600 mt-4">{statusMessage}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- FORM ----------------
function NewPersonForm({ form, setForm, onSubmit, onCancel }) {
  const update = (field, value) => setForm({ ...form, [field]: value });

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 flex items-center">
        <UserPlus className="mr-2" /> New Registration
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
          <input
            placeholder="Enter full name"
            value={form.full_name}
            onChange={(e) => update("full_name", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Age</label>
          <input
            type="number"
            placeholder="Enter age"
            value={form.age}
            onChange={(e) => update("age", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Person Type</label>
          <select
            value={form.person_type}
            onChange={(e) => update("person_type", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
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

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Medical Notes</label>
          <textarea
            placeholder="Enter medical notes or health information"
            value={form.medical_notes}
            onChange={(e) => update("medical_notes", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
            rows="3"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onSubmit}
          className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2 rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200"
        >
          Register
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all duration-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default RegistrationScreen;