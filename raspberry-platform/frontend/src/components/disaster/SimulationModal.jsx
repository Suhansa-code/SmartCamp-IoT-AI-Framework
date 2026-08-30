import { useState } from 'react'
import { X, FlaskConical, Play, RotateCcw } from 'lucide-react'
import { COLORS, SHADOW_CARD } from '../../lib/tokens'
import { API } from '../ui/config'

const DEFAULT_VALUES = {
  rainfall_mm: 50,
  latitude: 7.2345,
  longitude: 80.1234,
  elevation_m: 30,
  river_distance_km: 1.5,
  water_level_m: 2.0,
  gauge_alert_level: 4.0,
  gauge_minor_level: 5.0,
  gauge_major_level: 7.0,
}

const FIELD_DEFS = [
  { key: 'rainfall_mm',       label: 'Rainfall',            unit: 'mm',     min: 0,   max: 500,  step: 5,   section: 'Weather' },
  { key: 'water_level_m',     label: 'Water Level',         unit: 'm',      min: -5,  max: 15,   step: 0.1, section: 'Weather' },
  { key: 'elevation_m',       label: 'Camp Elevation',      unit: 'm',      min: 0,   max: 3000, step: 1,   section: 'Terrain' },
  { key: 'river_distance_km', label: 'River Distance',      unit: 'km',     min: 0,   max: 50,   step: 0.1, section: 'Terrain' },
  { key: 'latitude',          label: 'Latitude',            unit: 'deg',    min: -90, max: 90,   step: 0.0001, section: 'Location', decimals: 4 },
  { key: 'longitude',         label: 'Longitude',           unit: 'deg',    min: -180,max: 180,  step: 0.0001, section: 'Location', decimals: 4 },
  { key: 'gauge_alert_level', label: 'Alert Level',         unit: 'm',      min: 0,   max: 15,   step: 0.1, section: 'Gauge Thresholds' },
  { key: 'gauge_minor_level', label: 'Minor Flood Level',   unit: 'm',      min: 0,   max: 15,   step: 0.1, section: 'Gauge Thresholds' },
  { key: 'gauge_major_level', label: 'Major Flood Level',   unit: 'm',      min: 0,   max: 15,   step: 0.1, section: 'Gauge Thresholds' },
]

const SECTIONS = ['Weather', 'Terrain', 'Location', 'Gauge Thresholds']

export default function SimulationModal({ open, onClose, onSimulate, onExitSimulation, isSimulating, simResult }) {
  const [values, setValues] = useState({ ...DEFAULT_VALUES })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState(null)

  if (!open) return null

  const handleChange = (key, raw) => {
    const num = Number(raw)
    setValues(prev => ({ ...prev, [key]: raw === '' ? '' : num }))
    setErrors(prev => ({ ...prev, [key]: null }))
    setApiError(null)
  }

  const validate = () => {
    const errs = {}
    for (const f of FIELD_DEFS) {
      const v = values[f.key]
      if (v === '' || v === null || v === undefined || isNaN(Number(v))) {
        errs[f.key] = 'Required'
      } else if (Number(v) < f.min || Number(v) > f.max) {
        errs[f.key] = `${f.min}–${f.max}`
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleRun = async () => {
    if (!validate()) return
    setLoading(true)
    setApiError(null)
    try {
      const payload = {}
      for (const f of FIELD_DEFS) {
        payload[f.key] = Number(values[f.key])
      }
      const res = await fetch(`${API}/api/disaster/predict-simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.status === 'success' && data.prediction) {
        onSimulate(data)
        onClose()
      } else {
        setApiError(data.error || 'Prediction failed')
      }
    } catch (err) {
      setApiError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setValues({ ...DEFAULT_VALUES })
    setErrors({})
    setApiError(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        style={{ border: `1px solid ${COLORS.line}` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: COLORS.line }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F0FDF4' }}>
              <FlaskConical className="w-4 h-4" style={{ color: COLORS.brand }} />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold">Prediction Simulation</h3>
              <p className="text-[11px]" style={{ color: COLORS.muted }}>Enter model inputs manually</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" style={{ color: COLORS.muted }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {apiError && (
            <div className="rounded-lg border px-3 py-2 text-[12px] bg-red-50 border-red-200 text-red-700">
              {apiError}
            </div>
          )}

          {SECTIONS.map(section => (
            <div key={section}>
              <p className="text-[10.5px] uppercase tracking-wider mb-2" style={{ color: COLORS.muted }}>
                {section}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FIELD_DEFS.filter(f => f.section === section).map(f => (
                  <div key={f.key}>
                    <label className="text-[11px] font-medium" style={{ color: COLORS.body }}>
                      {f.label} <span className="" style={{ color: COLORS.muted }}>({f.unit})</span>
                    </label>
                    <input
                      type="number"
                      value={values[f.key]}
                      onChange={e => handleChange(f.key, e.target.value)}
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      className={`mt-1 w-full rounded-lg border px-3 py-2 text-[13px] outline-none transition-colors ${
                        errors[f.key] ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-teal-500'
                      }`}
                      style={{ color: COLORS.ink }}
                    />
                    {errors[f.key] && (
                      <p className="text-[10px] text-red-500 mt-0.5">{errors[f.key]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t" style={{ borderColor: COLORS.line }}>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[12px] font-medium transition-colors hover:bg-gray-50"
            style={{ borderColor: COLORS.line, color: COLORS.body }}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <div className="flex-1" />
          {isSimulating && (
            <button
              onClick={onExitSimulation}
              className="px-4 py-2 rounded-lg border text-[12px] font-semibold transition-colors hover:bg-gray-50"
              style={{ borderColor: COLORS.line, color: COLORS.body }}
            >
              Exit Simulation
            </button>
          )}
          <button
            onClick={handleRun}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: COLORS.brand }}
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" fill="currentColor" /> Run Simulation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
