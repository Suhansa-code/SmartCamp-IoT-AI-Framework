import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanBarcode,
  Search,
  X,
  Check,
  AlertCircle,
  Activity,
  UserCircle2,
  Droplets,
  Utensils,
  Coffee,
  PackageCheck,
  Package,
} from 'lucide-react';
import Button from '../ui/base/Button';

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

function WristbandScanScreen() {
  const [barcode, setBarcode] = useState('');
  const [profile, setProfile] = useState(null);
  const [todayStatus, setTodayStatus] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState('error');
  const [qosInfo, setQosInfo] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = async (e) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    setIsScanning(true);

    try {
      const res = await fetch(`${API}/api/wristband/${barcode.trim()}`);
      const data = await res.json();

      setTimeout(() => {
        setIsScanning(false);
        if (data.error) {
          setStatusMessage(data.error);
          setStatusType('error');
          setProfile(null);
          return;
        }
        setProfile(data.person);
        setTodayStatus(data.today_distributions);
        setStatusMessage('');
        setQosInfo(null);
      }, 600);

    } catch (err) {
      setIsScanning(false);
      setStatusMessage('Lookup failed: ' + err.message);
      setStatusType('error');
    }
  };

  const handleDistribute = async (resourceType) => {
    try {
      const res = await fetch(`${API}/api/distribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode,
          resource_type: resourceType,
        }),
      });
      const data = await res.json();

      if (data.error) {
        setStatusMessage(data.error);
        setStatusType('error');
        return;
      }

      setTodayStatus(data.today_distributions);
      setQosInfo(data.mqtt);
      setStatusMessage(`${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} distributed successfully.`);
      setStatusType('success');

      setTimeout(() => setStatusMessage(''), 3000);

    } catch (err) {
      setStatusMessage('Distribution failed: ' + err.message);
      setStatusType('error');
    }
  };

  const handleReset = () => {
    setBarcode('');
    setProfile(null);
    setTodayStatus(null);
    setStatusMessage('');
    setQosInfo(null);
  };

  const getPriorityColor = (priority) => {
    switch(priority?.toLowerCase()) {
      case 'high': return 'bg-teal-500/10 text-teal-700 border-teal-500/20';
      case 'medium': return 'bg-sky-500/10 text-sky-700 border-sky-500/20';
      case 'low': return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
      default: return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    }
  };

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-800 font-sans relative">

      <div className="max-w-7xl mx-auto  sm:px-6  sm:py-8 space-y-6 sm:space-y-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-500/25">
              <ScanBarcode className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-slate-800 tracking-tight">
                Distribution Hub
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Scan wristbands to allocate daily resources safely
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/80 border border-slate-200/80 rounded-full px-3.5 py-1.5 w-fit shadow-sm">
            <Package className="w-3.5 h-3.5 text-teal-600" />
            <span className="font-medium">Daily Ration Allocation</span>
          </div>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/90 backdrop-blur-xl border border-slate-200/70 rounded-2xl shadow-[0_1px_4px_0_rgba(0,0,0,0.04)] p-6 sm:p-8"
          onSubmit={handleScan}
        >
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Wristband Barcode
          </label>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search className={`w-5 h-5 transition-colors ${isScanning ? 'text-teal-600 animate-pulse' : 'text-slate-400'}`} />
              </div>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan or type barcode (e.g. WB000001)"
                autoFocus
                className="w-full pl-12 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 transition-all text-sm font-mono font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-sans"
              />
              <AnimatePresence>
                {barcode && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                    type="button"
                    onClick={handleReset}
                    className="absolute inset-y-0 right-4 flex items-center justify-center"
                    aria-label="Clear barcode"
                  >
                    <div className="w-6 h-6 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center hover:bg-slate-300 transition-colors">
                      <X className="w-4 h-4" />
                    </div>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <Button
              type="submit"
              loading={isScanning}
              loadingText="Lookup"
              disabled={!barcode.trim()}
            >
              Lookup
            </Button>
          </div>
        </motion.form>

        <AnimatePresence mode="wait">
          {statusMessage && !profile && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className={`mt-2 flex items-center gap-3 px-5 py-3 rounded-lg border ${
                statusType === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}>
                {statusType === 'error' ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                <span className="text-sm font-medium">{statusMessage}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {profile && todayStatus && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className="bg-white/90 backdrop-blur-xl border border-slate-200/70 rounded-2xl shadow-[0_1px_4px_0_rgba(0,0,0,0.04)] p-6 sm:p-8 flex flex-col md:flex-row items-center md:items-start gap-6 relative overflow-hidden">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white text-lg font-bold shrink-0 shadow-md shadow-teal-500/25">
                  {profile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>

                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-xl font-semibold text-slate-800">{profile.full_name}</h3>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-2">
                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-md text-xs font-semibold tracking-wide border border-slate-200">
                      Age {profile.age}
                    </span>
                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-md text-xs font-semibold tracking-wide border border-slate-200">
                      {profile.gender}
                    </span>
                    <span className="bg-teal-50 text-teal-700 px-3 py-1 rounded-md text-xs font-semibold tracking-wide border border-teal-100 flex items-center gap-1">
                      <UserCircle2 className="w-3 h-3" /> Family {profile.family_unit_id}
                    </span>
                    {profile.is_pregnant === 1 && (
                      <span className="bg-violet-50 text-violet-700 px-3 py-1 rounded-md text-xs font-semibold tracking-wide border border-violet-100">
                        Pregnant
                      </span>
                    )}
                    {profile.has_chronic_illness === 1 && (
                      <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-md text-xs font-semibold tracking-wide border border-amber-100">
                        Chronic Illness
                      </span>
                    )}
                  </div>
                </div>

                {(statusMessage && statusType === 'success') && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    className="absolute top-4 right-4 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium border border-emerald-100 flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" /> {statusMessage}
                  </motion.div>
                )}
                {(statusMessage && statusType === 'error') && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    className="absolute top-4 right-4 bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-medium border border-red-100 flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" /> {statusMessage}
                  </motion.div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <DistributionTile
                  label="Breakfast"
                  icon={Coffee}
                  quantity="500 g"
                  given={todayStatus.breakfast}
                  onGive={() => handleDistribute('breakfast')}
                />
                <DistributionTile
                  label="Lunch"
                  icon={Utensils}
                  quantity="600 g"
                  given={todayStatus.lunch}
                  onGive={() => handleDistribute('lunch')}
                />
                <DistributionTile
                  label="Dinner"
                  icon={Utensils}
                  quantity="500 g"
                  given={todayStatus.dinner}
                  onGive={() => handleDistribute('dinner')}
                />
                <DistributionTile
                  label="Water"
                  icon={Droplets}
                  quantity="15 L"
                  given={todayStatus.water}
                  onGive={() => handleDistribute('water')}
                />
              </div>

              {qosInfo && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="bg-white/90 backdrop-blur-xl border border-slate-200/70 rounded-2xl p-5 flex flex-wrap gap-4 text-xs font-semibold uppercase tracking-wider items-center shadow-[0_1px_4px_0_rgba(0,0,0,0.04)]"
                >
                  <span className="text-slate-500 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-teal-600" /> MQTT Sync
                  </span>
                  <span className={`px-3 py-1.5 rounded-md border ${getPriorityColor(qosInfo.priority)}`}>
                    Priority: {qosInfo.priority}
                  </span>
                  <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-md border border-slate-200">
                    QoS {qosInfo.final_qos}
                  </span>
                  <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-md border border-slate-200">
                    Net: {qosInfo.network_state}
                  </span>
                  <span className={`px-3 py-1.5 rounded-md border flex items-center gap-1 ${
                    qosInfo.published ? 'bg-teal-50 text-teal-700 border-teal-100' : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}>
                    {qosInfo.published ? <><PackageCheck className="w-3 h-3" /> Published</> : 'Buffered locally'}
                  </span>
                </motion.div>
              )}

            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

function DistributionTile({ label, icon: Icon, quantity, given, onGive }) {
  const isGiven = given;

  return (
    <motion.div
      whileHover={!isGiven ? { y: -4 } : {}}
      className={`relative rounded-2xl p-5 text-center transition-all duration-300 overflow-hidden flex flex-col items-center justify-center min-h-[200px] ${
        isGiven
          ? 'bg-teal-50/70 border-2 border-teal-100'
          : 'bg-white/90 backdrop-blur-xl border border-slate-200/70 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]'
      }`}
    >
      {!isGiven && (
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-teal-400 to-sky-500 rounded-full blur-3xl opacity-5 pointer-events-none" />
      )}

      <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 ${
        isGiven ? 'bg-white shadow-sm scale-90' : 'bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-md shadow-teal-500/25'
      }`}>
        <Icon className={`w-7 h-7 ${isGiven ? 'text-teal-600' : 'text-white'}`} />
      </div>

      <div className={`font-semibold text-base mb-1 ${isGiven ? 'text-teal-700' : 'text-slate-800'}`}>{label}</div>
      <div className="text-xs font-semibold text-slate-400 tracking-wide mb-5">{quantity}</div>

      <div className="mt-auto w-full">
        {isGiven ? (
          <div className="flex items-center justify-center gap-2 text-sm font-medium bg-white/80 py-2 rounded-lg border border-teal-100 text-teal-700">
            <Check className="w-4 h-4" /> Allocated
          </div>
        ) : (
          <Button onClick={onGive} className="w-full">
            Distribute
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export default WristbandScanScreen;
