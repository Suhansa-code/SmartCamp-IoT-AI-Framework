import React, { useState } from 'react';

function WristbandScanScreen() {
  const [barcode, setBarcode] = useState('');
  const [profile, setProfile] = useState(null);
  const [todayStatus, setTodayStatus] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [qosInfo, setQosInfo] = useState(null);

  const handleScan = async (e) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    try {
      const res = await fetch(
        `http://localhost:5000/api/wristband/${barcode.trim()}`
      );
      const data = await res.json();
      if (data.error) {
        setStatusMessage(data.error);
        setProfile(null);
        return;
      }
      setProfile(data.person);
      setTodayStatus(data.today_distributions);
      setStatusMessage('');
      setQosInfo(null);
    } catch (err) {
      setStatusMessage('Lookup failed: ' + err.message);
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
        return;
      }
      setTodayStatus(data.today_distributions);
      setQosInfo(data.mqtt);
      setStatusMessage(`${resourceType} distributed`);
    } catch (err) {
      setStatusMessage('Distribution failed: ' + err.message);
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
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800">Wristband Scan & Distribution</h2>
          <p className="text-gray-600 mt-2">Scan barcode to distribute meals and water for the day.</p>
        </div>

        <form className="bg-white rounded-2xl shadow-lg p-6 mb-6" onSubmit={handleScan}>
          <label className="block text-sm font-medium text-gray-700 mb-2">Scan or type wristband barcode</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="WB000001"
              autoFocus
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              Look Up
            </button>
            {profile && (
              <button
                type="button"
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                onClick={handleReset}
              >
                Clear
              </button>
            )}
          </div>
        </form>

        {profile && todayStatus && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                {profile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-gray-800">{profile.full_name}</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">Age {profile.age}</span>
                  <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">{profile.gender}</span>
                  <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">Family {profile.family_unit_id}</span>
                  {profile.is_pregnant === 1 && (
                    <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">Pregnant</span>
                  )}
                  {profile.has_chronic_illness === 1 && (
                    <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">Chronic Illness</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <DistributionTile
                label="Breakfast"
                icon="☕"
                quantity="500 g"
                given={todayStatus.breakfast}
                onGive={() => handleDistribute('breakfast')}
              />
              <DistributionTile
                label="Lunch"
                icon="🍛"
                quantity="600 g"
                given={todayStatus.lunch}
                onGive={() => handleDistribute('lunch')}
              />
              <DistributionTile
                label="Dinner"
                icon="🍲"
                quantity="500 g"
                given={todayStatus.dinner}
                onGive={() => handleDistribute('dinner')}
              />
              <DistributionTile
                label="Water"
                icon="💧"
                quantity="15 L"
                given={todayStatus.water}
                onGive={() => handleDistribute('water')}
              />
            </div>

            {qosInfo && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex flex-wrap gap-4 text-sm">
                <span className="text-gray-600">Sent to admin via MQTT</span>
                <span className={`font-semibold px-2 py-0.5 rounded ${getPriorityColor(qosInfo.priority)}`}>
                  {qosInfo.priority}
                </span>
                <span className="text-gray-700">QoS {qosInfo.final_qos}</span>
                <span className="text-gray-700">Network: {qosInfo.network_state}</span>
                <span className="text-gray-700">{qosInfo.published ? 'Published' : 'Buffered'}</span>
              </div>
            )}
          </div>
        )}

        {statusMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mt-6">
            {statusMessage}
          </div>
        )}
      </div>
    </div>
  );
}

function DistributionTile({ label, icon, quantity, given, onGive }) {
  return (
    <div className={`rounded-xl p-4 text-center transition-all duration-200 ${
      given ? 'bg-green-50 border-2 border-green-200' : 'bg-white border-2 border-gray-200 hover:border-blue-300'
    }`}>
      <div className="text-3xl mb-2">{icon}</div>
      <div className="font-semibold text-gray-800 mb-1">{label}</div>
      <div className="text-sm text-gray-500 mb-3">{quantity}</div>
      {given ? (
        <div className="text-green-600 font-medium text-sm">
          <span className="inline-block mr-1">✓</span> Given today
        </div>
      ) : (
        <button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-3 rounded-lg transition-colors duration-200"
          onClick={onGive}
        >
          Mark as Given
        </button>
      )}
    </div>
  );
}

export default WristbandScanScreen;
