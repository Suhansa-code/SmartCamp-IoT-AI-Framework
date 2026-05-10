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
  PackageCheck
} from 'lucide-react';

function WristbandScanScreen() {
  const [barcode, setBarcode] = useState('');
  const [profile, setProfile] = useState(null);
  const [todayStatus, setTodayStatus] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState('error'); // 'error' | 'success'
  const [qosInfo, setQosInfo] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = async (e) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    setIsScanning(true);
    
    try {
      const res = await fetch(`http://localhost:5000/api/wristband/${barcode.trim()}`);
      const data = await res.json();
      
      // Artificial delay for UI polish
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
      const res = await fetch('http://localhost:5000/api/distribute', {
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
      
      // Clear success message after 3 seconds
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
      case 'high': return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
      case 'medium': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'low': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      default: return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-5"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <ScanBarcode className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 to-slate-800 tracking-tight">
              Distribution Hub
            </h1>
            <p className="text-slate-500 mt-1 font-medium">
              Scan wristbands to allocate daily resources safely
            </p>
          </div>
        </motion.div>

        {/* Scanner Form */}
        <motion.form 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 sm:p-8 relative overflow-hidden" 
          onSubmit={handleScan}
        >
          <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
          
          <label className="block text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 relative z-10">
            Wristband Barcode
          </label>
          <div className="flex flex-col sm:flex-row gap-4 relative z-10">
            <div className="relative flex-1 group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search className={`w-5 h-5 transition-colors ${isScanning ? 'text-indigo-500 animate-pulse' : 'text-slate-400 group-focus-within:text-indigo-500'}`} />
              </div>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan or type barcode (e.g. WB000001)"
                autoFocus
                className="w-full pl-12 pr-12 py-4 bg-white/80 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-lg font-mono font-medium text-slate-800 shadow-sm placeholder:font-sans placeholder:text-slate-400"
              />
              <AnimatePresence>
                {barcode && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                    type="button"
                    onClick={handleReset}
                    className="absolute inset-y-0 right-4 flex items-center justify-center"
                  >
                    <div className="w-6 h-6 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center hover:bg-slate-300 transition-colors">
                      <X className="w-4 h-4" />
                    </div>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            
            <button
              type="submit"
              disabled={isScanning || !barcode.trim()}
              className="relative group px-10 py-4 bg-slate-900 disabled:bg-slate-300 text-white font-bold rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(15,23,42,0.15)] hover:shadow-[0_0_30px_rgba(79,70,229,0.3)] overflow-hidden disabled:hover:scale-100 disabled:hover:shadow-none"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 disabled:group-hover:opacity-0" />
              <span className="relative flex items-center gap-2 text-lg">
                {isScanning ? <Activity className="w-5 h-5 animate-spin" /> : 'Lookup'}
              </span>
            </button>
          </div>
        </motion.form>

        {/* Status Messages */}
        <AnimatePresence mode="wait">
          {statusMessage && !profile && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className={`mt-2 flex items-center gap-3 px-6 py-4 rounded-2xl border ${
                statusType === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}>
                {statusType === 'error' ? <AlertCircle className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                <span className="font-medium">{statusMessage}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profile & Distribution Cards */}
        <AnimatePresence>
          {profile && todayStatus && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              {/* Profile Card */}
              <div className="bg-white/80 backdrop-blur-2xl border border-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-6 sm:p-8 flex flex-col md:flex-row items-center md:items-start gap-6 relative overflow-hidden">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 p-1 shadow-lg shadow-indigo-500/20 shrink-0">
                  <div className="w-full h-full bg-white rounded-full flex items-center justify-center text-indigo-600 text-3xl font-extrabold">
                    {profile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                </div>
                
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-2xl font-extrabold text-slate-800">{profile.full_name}</h3>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-3">
                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-slate-200">
                      Age {profile.age}
                    </span>
                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-slate-200">
                      {profile.gender}
                    </span>
                    <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-indigo-100 flex items-center gap-1">
                      <UserCircle2 className="w-3 h-3" /> Family {profile.family_unit_id}
                    </span>
                    {profile.is_pregnant === 1 && (
                      <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-amber-200">
                        Pregnant
                      </span>
                    )}
                    {profile.has_chronic_illness === 1 && (
                      <span className="bg-rose-50 text-rose-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-rose-200">
                        Chronic Illness
                      </span>
                    )}
                  </div>
                </div>

                {statusMessage && statusType === 'success' && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    className="absolute top-4 right-4 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-sm font-bold border border-emerald-200 flex items-center gap-2 shadow-sm"
                  >
                    <Check className="w-4 h-4" /> {statusMessage}
                  </motion.div>
                )}
              </div>

              {/* Grid of Distribution Tiles */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <DistributionTile
                  label="Breakfast"
                  icon={Coffee}
                  quantity="500 g"
                  color="amber"
                  given={todayStatus.breakfast}
                  onGive={() => handleDistribute('breakfast')}
                />
                <DistributionTile
                  label="Lunch"
                  icon={Utensils}
                  quantity="600 g"
                  color="orange"
                  given={todayStatus.lunch}
                  onGive={() => handleDistribute('lunch')}
                />
                <DistributionTile
                  label="Dinner"
                  icon={Utensils}
                  quantity="500 g"
                  color="rose"
                  given={todayStatus.dinner}
                  onGive={() => handleDistribute('dinner')}
                />
                <DistributionTile
                  label="Water"
                  icon={Droplets}
                  quantity="15 L"
                  color="blue"
                  given={todayStatus.water}
                  onGive={() => handleDistribute('water')}
                />
              </div>

              {/* QoS Dashboard */}
              {qosInfo && (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="bg-white/40 backdrop-blur-md rounded-2xl p-5 border border-white/50 flex flex-wrap gap-4 text-xs font-bold uppercase tracking-wider items-center shadow-sm"
                >
                  <span className="text-slate-500 flex items-center gap-2">
                    <Activity className="w-4 h-4" /> MQTT Sync
                  </span>
                  <span className={`px-3 py-1.5 rounded-full border ${getPriorityColor(qosInfo.priority)}`}>
                    Priority: {qosInfo.priority}
                  </span>
                  <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full border border-slate-200">
                    QoS {qosInfo.final_qos}
                  </span>
                  <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full border border-slate-200">
                    Net: {qosInfo.network_state}
                  </span>
                  <span className={`px-3 py-1.5 rounded-full border flex items-center gap-1 ${
                    qosInfo.published ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'
                  }`}>
                    {qosInfo.published ? <><PackageCheck className="w-3 h-3" /> Published</> : 'Buffered locally'}
                  </span>
                </motion.div>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </div>
  );
}

function DistributionTile({ label, icon: Icon, quantity, color, given, onGive }) {
  const isGiven = given;
  
  const colorMap = {
    amber: 'from-amber-400 to-orange-500 shadow-amber-500/30 text-amber-500 bg-amber-50 border-amber-200',
    orange: 'from-orange-400 to-rose-500 shadow-orange-500/30 text-orange-500 bg-orange-50 border-orange-200',
    rose: 'from-rose-400 to-pink-500 shadow-rose-500/30 text-rose-500 bg-rose-50 border-rose-200',
    blue: 'from-cyan-400 to-blue-500 shadow-blue-500/30 text-blue-500 bg-blue-50 border-blue-200',
    emerald: 'from-emerald-400 to-teal-500 shadow-emerald-500/30 text-emerald-500 bg-emerald-50 border-emerald-200',
  };

  const bgClasses = colorMap[color] || colorMap.blue;
  const gradient = bgClasses.split(' ').slice(0,2).join(' ');
  const shadow = bgClasses.split(' ')[2];
  const textColor = bgClasses.split(' ')[3];
  const givenBg = bgClasses.split(' ')[4];
  const givenBorder = bgClasses.split(' ')[5];

  return (
    <motion.div 
      whileHover={!isGiven ? { y: -5 } : {}}
      className={`relative rounded-3xl p-6 text-center transition-all duration-300 overflow-hidden flex flex-col items-center justify-center min-h-[220px] ${
        isGiven 
          ? `${givenBg} border-2 ${givenBorder}` 
          : 'bg-white/80 backdrop-blur-md border border-white hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)]'
      }`}
    >
      {/* Decorative gradient blob */}
      {!isGiven && (
        <div className={`absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br ${gradient} rounded-full blur-3xl opacity-10 pointer-events-none`} />
      )}

      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 ${
        isGiven ? 'bg-white shadow-sm scale-90' : `bg-gradient-to-br ${gradient} text-white shadow-lg ${shadow}`
      }`}>
        <Icon className={`w-8 h-8 ${isGiven ? textColor : 'text-white'}`} />
      </div>
      
      <div className={`font-extrabold text-lg mb-1 ${isGiven ? textColor : 'text-slate-800'}`}>{label}</div>
      <div className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-6">{quantity}</div>
      
      <div className="mt-auto w-full">
        {isGiven ? (
          <div className={`flex items-center justify-center gap-2 font-bold text-sm bg-white/50 py-3 rounded-xl border ${givenBorder} ${textColor}`}>
            <Check className="w-4 h-4" /> Allocated
          </div>
        ) : (
          <button
            onClick={onGive}
            className={`w-full group relative px-4 py-3 bg-slate-900 text-white text-sm font-bold rounded-xl transition-all hover:scale-[1.03] active:scale-95 shadow-md overflow-hidden`}
          >
            <div className={`absolute inset-0 bg-gradient-to-r ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
            <span className="relative flex items-center justify-center gap-2">
              Distribute
            </span>
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default WristbandScanScreen;
