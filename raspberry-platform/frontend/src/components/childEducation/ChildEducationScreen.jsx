import { useEffect, useMemo, useState } from 'react'
 
import { fetchChildDirectory, fetchChildEducation } from '@/components/psychoedu/lib/api'
 
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
 
const badgeClasses = {
  pending: 'bg-amber-100 text-amber-800 border-amber-300',
  resolved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  synced: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  unsynced: 'bg-slate-100 text-slate-700 border-slate-300',
  active: 'bg-rose-100 text-rose-800 border-rose-300',
  none: 'bg-slate-100 text-slate-700 border-slate-300',
}
 
function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
 
function SyncBadge({ synced }) {
  const key = Number(synced) === 1 ? 'synced' : 'unsynced'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${badgeClasses[key]}`}>
      <span className="h-2 w-2 rounded-full bg-current" />
      {Number(synced) === 1 ? 'Synced' : 'Pending Sync'}
    </span>
  )
}
 
function ChildEducationScreen() {
  const [childId, setChildId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [payload, setPayload] = useState(null)
  const [autoLoaded, setAutoLoaded] = useState(false)
  const [directory, setDirectory] = useState({ children: [], pagination: null })
  const [directoryLoading, setDirectoryLoading] = useState(false)
  const [directoryError, setDirectoryError] = useState('')
  const [page, setPage] = useState(1)
 
  const loadChild = async (value) => {
    const searchValue = value.trim()
    if (!searchValue) {
      setError('Enter a child ID to search.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await fetchChildEducation(searchValue)
      setPayload(data)
      setChildId(searchValue)
    } catch (err) {
      setPayload(null)
      setError(err?.message || 'Unable to load child education data.')
    } finally {
      setLoading(false)
    }
  }
 
  const loadDirectory = async (nextPage = 1) => {
    setDirectoryLoading(true)
    setDirectoryError('')
    try {
      const data = await fetchChildDirectory(nextPage, 5)
      setDirectory(data)
      setPage(nextPage)
    } catch (err) {
      setDirectory({ children: [], pagination: null })
      setDirectoryError(err?.message || 'Unable to load child directory.')
    } finally {
      setDirectoryLoading(false)
    }
  }
 
  useEffect(() => {
    loadDirectory(1)
    if (autoLoaded) return
    const cachedChild =
      localStorage.getItem('selectedChildId') ||
      sessionStorage.getItem('selectedChildId')
    if (cachedChild) {
      setChildId(cachedChild)
      setAutoLoaded(true)
      loadChild(cachedChild)
    }
  }, [autoLoaded])
 
  const stats = payload?.stats || {}
  const child = payload?.child || null
  const sessions = payload?.sessions || []
  const alerts = payload?.alerts || []
 
  const alertSummary = useMemo(() => {
    return {
      pending: alerts.filter((alert) => alert.status === 'pending').length,
      resolved: alerts.filter((alert) => alert.status === 'resolved').length,
      unsynced: alerts.filter((alert) => Number(alert.synced) !== 1).length,
    }
  }, [alerts])
 
  return (
    <div className="mx-auto max-w-7xl space-y-6 rounded-3xl bg-slate-50 p-6 font-sans text-slate-900 shadow-sm">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-2xl font-bold uppercase tracking-[0.2em] text-indigo-600">
              Child Education
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900">
              Child session history, alerts, and profile details
            </h2>
          </div>
          <form
            className="flex w-full max-w-xl flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault()
              loadChild(childId)
            }}
          >
            <input
              value={childId}
              onChange={(event) => setChildId(event.target.value)}
              placeholder="Enter child ID, e.g. CAMP-B-000001"
              className="min-h-12 flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <button
              type="submit"
              disabled={loading}
              className="min-h-12 rounded-2xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Loading...' : 'Search Child'}
            </button>
          </form>
        </div>
 
        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        ) : null}
      </div>
 
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-2xl font-bold uppercase tracking-[0.2em] text-indigo-600">Children Directory</p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">Children List from PAGES</h3>
          </div>
          <div className="text-sm font-medium text-slate-600">
            {directory?.pagination ? `Page ${directory.pagination.page} of ${directory.pagination.totalPages}` : 'Loading directory...'}
          </div>
        </div>

        {directoryError ? (
          <div className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {directoryError}
          </div>
        ) : null}

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Child ID</th>
                <th className="px-4 py-3 font-semibold">Res ID</th>
                <th className="px-4 py-3 font-semibold">Grade</th>
                <th className="px-4 py-3 font-semibold">Camp</th>
                <th className="px-4 py-3 font-semibold">Zone</th>
                <th className="px-4 py-3 font-semibold">Sessions</th>
                <th className="px-4 py-3 font-semibold">Alert</th>
                <th className="px-4 py-3 font-semibold">Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {directoryLoading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                    Loading children...
                  </td>
                </tr>
              ) : directory.children.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                    No children found.
                  </td>
                </tr>
              ) : (
                directory.children.map((childRecord) => (
                  <tr key={childRecord.child_id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => loadChild(childRecord.child_id)}
                        className="font-semibold text-indigo-700 transition hover:text-indigo-500"
                      >
                        {childRecord.child_id}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{childRecord.res_id || '-'}</td>
                    <td className="px-4 py-4 text-slate-600">{childRecord.grade ?? '-'}</td>
                    <td className="px-4 py-4 text-slate-600">{childRecord.camp_id || '-'}</td>
                    <td className="px-4 py-4 text-slate-600">{childRecord.zone_id || '-'}</td>
                    <td className="px-4 py-4 text-slate-600">{childRecord.total_sessions ?? 0}</td>
                    <td className="px-4 py-4 text-slate-600">{childRecord.alert_status || '-'}</td>
                    <td className="px-4 py-4">
                      <SyncBadge synced={childRecord.synced} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {directory?.pagination ? (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-600">
              Showing {directory.children.length} of {directory.pagination.total} children
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadDirectory(page - 1)}
                disabled={!directory.pagination.hasPrev || directoryLoading}
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => loadDirectory(page + 1)}
                disabled={!directory.pagination.hasNext || directoryLoading}
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {child ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Total Sessions Completed', value: stats.total_sessions ?? child.total_sessions ?? 0 },
              { label: 'Pending Alerts', value: alertSummary.pending },
              { label: 'Unresolved Alerts', value: stats.pending_alerts ?? alertSummary.pending },
              { label: 'Sync State', value: Number(child.synced) === 1 ? 'Synced' : 'Pending' },
            ].map((item) => (
              <div key={item.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">{item.label}</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
 
          <div className="grid gap-6 xl:grid-cols-[1.1fr_1.2fr]">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-2xl font-bold uppercase tracking-[0.2em] text-indigo-600">Child Record</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-900">{child.child_id}</h3>
                </div>
                <SyncBadge synced={child.synced} />
              </div>
 
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {[
                  ['Res ID', child.res_id],
                  ['Camp ID', child.camp_id],
                  ['Grade', child.grade],
                  ['Language', child.language],
                  ['Zone', child.zone_id || '-'],
                  ['Enrolled At', formatDate(child.enrolled_at)],
                  ['Baseline Score', child.baseline_score],
                  ['Alert Status', child.alert_status],
                  ['Consecutive Low', child.consecutive_low],
                  ['SDQ Band', child.sdq_band],
                  ['QR Available', child.qr_code_data ? 'Yes' : 'No'],
                  ['Total Sessions completed', child.total_sessions],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
                    <p className="mt-2 break-words text-lg font-semibold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
            </section>
 
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-2xl font-bold uppercase tracking-[0.2em] text-indigo-600">Alert Overview</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-900">Triggered alerts</h3>
                </div>
                <div className="text-right text-sm font-medium text-slate-600">
                  <div>Pending: {alertSummary.pending}</div>
                  <div>Resolved: {alertSummary.resolved}</div>
                  <div>Unsynced: {alertSummary.unsynced}</div>
                </div>
              </div>
 
              <div className="mt-5 space-y-4">
                {alerts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                    No alerts found for this child.
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <article key={alert.alert_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="mt-1 text-sm text-slate-500">{formatDate(alert.triggered_at)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${badgeClasses[alert.status] || badgeClasses.pending}`}>
                            {alert.status}
                          </span>
                          <SyncBadge synced={alert.synced} />
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                        <div>
                          <span className="font-medium text-slate-500">Alert ID:</span> {alert.alert_id}
                        </div>
                        <div>
                          <span className="font-medium text-slate-500">Resolved At:</span> {formatDate(alert.resolved_at)}
                        </div>
                        <div className="sm:col-span-2">
                          <span className="font-medium text-slate-500">Resolved Notes:</span> {alert.resolved_notes || '-'}
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
 
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-2xl font-bold uppercase tracking-[0.2em] text-indigo-600">Session History</p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">All recorded sessions</h3>
              </div>
              <div className="text-sm font-medium text-slate-600">
                {sessions.length} session{sessions.length === 1 ? '' : 's'} loaded
              </div>
            </div>
 
            <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Session</th>
                    <th className="px-4 py-3 font-semibold">Date / Time</th>
                    <th className="px-4 py-3 font-semibold">Gate</th>
                    <th className="px-4 py-3 font-semibold">Flags</th>
                    <th className="px-4 py-3 font-semibold">Sync</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-slate-500">
                        No sessions found.
                      </td>
                    </tr>
                  ) : (
                    sessions.map((session) => (
                      <tr key={session.session_id} className="align-top hover:bg-slate-50">
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-900">{session.session_id}</div>
                          <div className="text-xs text-slate-500">{session.content_session_id || '-'}</div>
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          <div>{session.session_date || '-'}</div>
                          <div className="text-xs text-slate-500">{session.session_time || '-'}</div>
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          <div className="font-semibold text-slate-900">{session.gate_decision || '-'}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${Number(session.anomaly_flagged) === 1 ? 'border-rose-300 bg-rose-100 text-rose-800' : 'border-slate-300 bg-slate-100 text-slate-600'}`}>
                              {Number(session.anomaly_flagged) === 1 ? 'Anomaly' : 'Normal'}
                            </span>
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${Number(session.alert_triggered) === 1 ? 'border-amber-300 bg-amber-100 text-amber-800' : 'border-slate-300 bg-slate-100 text-slate-600'}`}>
                              {Number(session.alert_triggered) === 1 ? 'Alert Triggered' : 'No Alert'}
                            </span>
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${session.session_complete === 1 ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : 'border-slate-300 bg-slate-100 text-slate-600'}`}>
                              {session.session_complete === 1 ? 'Completed' : 'Open'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <SyncBadge synced={session.synced} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          Search a child to view the education dashboard.
          <div className="mt-2 text-sm text-slate-400">The page will show child profile data, full session history, alerts, and sync status.</div>
        </div>
      )}
    </div>
  )
}
 
export default ChildEducationScreen
 