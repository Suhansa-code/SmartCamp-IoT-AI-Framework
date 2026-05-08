import React, { useState, useEffect, useCallback } from 'react';

const API = 'http://localhost:5000';

const NETWORK_STYLE = {
  STABLE:   { badge: 'bg-green-100 text-green-800',  dot: 'bg-green-500' },
  DEGRADED: { badge: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
  CRITICAL: { badge: 'bg-red-100 text-red-800',      dot: 'bg-red-500' },
};

const STATUS_STYLE = {
  none:     'bg-gray-100 text-gray-500',
  pending:  'bg-yellow-100 text-yellow-700',
  sent:     'bg-blue-100 text-blue-700',
  buffered: 'bg-orange-100 text-orange-700',
  complete: 'bg-green-100 text-green-800',
};

const STATUS_LABEL = {
  none:     'No forecast yet',
  pending:  'Pending...',
  sent:     'Sent — awaiting cloud result',
  buffered: 'Buffered (low network)',
  complete: 'Complete',
};

const TYPE_LABELS = {
  refugees:          'Refugees',
  asylum_seekers:    'Asylum Seekers',
  idps:              'IDPs',
  returned_refugees: 'Returned Refugees',
  returned_idps:     'Returned IDPs',
  stateless:         'Stateless',
  ooc:               'Others of Concern',
};

function StatChip({ label, value, unit = '' }) {
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3 flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-lg font-bold text-gray-800">
        {typeof value === 'number' && value < 1 && value > 0
          ? `${(value * 100).toFixed(1)}%`
          : (value?.toLocaleString() ?? '—')}
        {unit && <span className="text-xs text-gray-400 ml-1">{unit}</span>}
      </span>
    </div>
  );
}

function ForecastRow({ row, isToday }) {
  const r = row.result;
  const pop = row.projected_population;
  const dateObj = new Date(row.date + 'T00:00:00');
  const dayName = isToday ? 'Today' : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
  const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <tr className={`border-t border-gray-100 ${isToday ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
      <td className="px-4 py-3">
        <div className={`font-semibold text-sm ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>{dayName}</div>
        <div className="text-xs text-gray-400">{dateStr}</div>
      </td>
      <td className="px-4 py-3 text-sm font-mono text-gray-700">{pop?.toLocaleString() ?? '—'}</td>
      {r ? (
        <>
          <td className="px-4 py-3 text-sm font-mono text-amber-700">{r.food_kg_day?.toLocaleString()}</td>
          <td className="px-4 py-3 text-sm font-mono text-blue-700">{r.water_liters_day?.toLocaleString()}</td>
          <td className="px-4 py-3 text-sm font-mono text-green-700">{r.shelter_units?.toLocaleString()}</td>
          <td className="px-4 py-3 text-sm font-mono text-purple-700">{r.medical_staff_needed?.toLocaleString()}</td>
        </>
      ) : (
        <td colSpan={4} className="px-4 py-3 text-sm text-gray-400 italic">
          Awaiting prediction...
        </td>
      )}
    </tr>
  );
}

function PredictionScreen() {
  const [campData, setCampData]       = useState(null);
  const [forecasts, setForecasts]     = useState([]);
  const [reqStatus, setReqStatus]     = useState('none');
  const [requestId, setRequestId]     = useState(null);
  const [networkState, setNetworkState] = useState('STABLE');
  const [mqttInfo, setMqttInfo]       = useState(null);
  const [statusMsg, setStatusMsg]     = useState('');
  const [loading, setLoading]         = useState(false);

  // Load camp demographics + latest result on mount
  useEffect(() => {
    fetch(`${API}/api/prediction/inputs`)
      .then(r => r.json())
      .then(setCampData)
      .catch(() => {});

    fetch(`${API}/api/network/state`)
      .then(r => r.json())
      .then(d => setNetworkState(d.state || 'STABLE'))
      .catch(() => {});

    fetch(`${API}/api/prediction/results`)
      .then(r => r.json())
      .then(d => {
        if (d.status !== 'none') {
          setReqStatus(d.status);
          setRequestId(d.request_id);
          if (d.forecasts) setForecasts(d.forecasts);
        }
      })
      .catch(() => {});
  }, []);

  // Poll for result every 5s when pending/sent/buffered
  useEffect(() => {
    if (!requestId || reqStatus === 'complete' || reqStatus === 'none') return;
    const interval = setInterval(() => {
      fetch(`${API}/api/prediction/results`)
        .then(r => r.json())
        .then(d => {
          if (d.request_id === requestId) {
            setReqStatus(d.status);
            if (d.forecasts) {
              setForecasts(d.forecasts);
              if (d.status === 'complete') clearInterval(interval);
            }
          }
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [requestId, reqStatus]);

  const handleForecast = useCallback(async () => {
    setLoading(true);
    setStatusMsg('');
    setMqttInfo(null);
    try {
      const res = await fetch(`${API}/api/prediction/forecast?days=7`);
      const data = await res.json();
      if (data.error) { setStatusMsg(data.error); return; }
      setRequestId(data.request_id);
      setReqStatus(data.status);
      setForecasts(data.forecasts || []);
      setMqttInfo(data.mqtt || null);
      setStatusMsg(data.message || (data.status === 'complete' ? '' : 'Forecast submitted'));
    } catch (e) {
      setStatusMsg('Failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const ns = NETWORK_STYLE[networkState] || NETWORK_STYLE.STABLE;

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">AI Resource Forecast</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            All inputs are computed automatically from registered persons and check-in data.
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${ns.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${ns.dot}`} />
            {networkState}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[reqStatus]}`}>
            {STATUS_LABEL[reqStatus]}
          </span>
        </div>
      </div>

      {/* Camp demographics — auto-fetched, read-only */}
      {campData && (
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h3 className="font-semibold text-gray-800">
            Camp Demographics
            <span className="ml-2 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-normal">auto from Pi DB</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatChip label="Total Population"   value={campData.total_population} />
            <StatChip label="Daily Arrival Rate" value={campData.daily_arrival_rate} unit="/ day" />
            <StatChip label="Children Ratio"     value={campData.children_ratio} />
            <StatChip label="Elderly Ratio"      value={campData.elderly_ratio} />
            <StatChip label="Female Ratio"       value={campData.female_ratio} />
            <StatChip label="Yearly Arrivals"    value={campData.yearly_arrivals} />
            <StatChip label="Pregnant"           value={campData.pregnant} />
            <StatChip label="Chronic Illness"    value={campData.chronic_illness} />
          </div>

          {/* UNHCR breakdown */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">UNHCR Category Breakdown</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                campData[key] > 0 && (
                  <span key={key} className="bg-indigo-50 text-indigo-700 text-xs px-3 py-1 rounded-full font-medium">
                    {label}: {campData[key].toLocaleString()}
                  </span>
                )
              ))}
              {Object.keys(TYPE_LABELS).every(k => !campData[k]) && (
                <span className="text-xs text-gray-400 italic">
                  No category breakdown yet — select Person Type during registration to populate this.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Generate button */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={handleForecast}
            disabled={loading}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? 'Generating...' : 'Generate 7-Day Forecast'}
          </button>

          {statusMsg && <span className="text-sm text-gray-600">{statusMsg}</span>}

          {mqttInfo && (
            <div className="flex gap-2 flex-wrap">
              <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">Priority: {mqttInfo.priority}</span>
              <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">QoS {mqttInfo.final_qos}</span>
              <span className={`text-xs px-2 py-1 rounded-full ${mqttInfo.published ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                {mqttInfo.published ? 'Published' : 'Buffered'}
              </span>
            </div>
          )}

          {(reqStatus === 'sent' || reqStatus === 'buffered') && (
            <span className="text-xs text-gray-400 animate-pulse">Polling for result every 5s...</span>
          )}
        </div>

        {networkState === 'CRITICAL' && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
            Network CRITICAL — forecast will be buffered and sent when connectivity recovers.
          </div>
        )}
        {networkState === 'DEGRADED' && (
          <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-sm text-yellow-700">
            Network DEGRADED — QoS upgraded automatically to ensure delivery.
          </div>
        )}
      </div>

      {/* 7-day forecast table */}
      {forecasts.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">7-Day Resource Forecast</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Population projected using {campData?.daily_arrival_rate ?? '—'} daily arrivals/day.
              Ratios held constant.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Est. Population</th>
                  <th className="px-4 py-3 text-amber-600">Food (kg/day)</th>
                  <th className="px-4 py-3 text-blue-600">Water (L/day)</th>
                  <th className="px-4 py-3 text-green-600">Shelter Units</th>
                  <th className="px-4 py-3 text-purple-600">Medical Staff</th>
                </tr>
              </thead>
              <tbody>
                {forecasts.map((row, i) => (
                  <ForecastRow key={row.date} row={row} isToday={i === 0} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

export default PredictionScreen;
