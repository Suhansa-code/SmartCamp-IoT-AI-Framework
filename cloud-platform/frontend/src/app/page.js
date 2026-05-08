"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [selectedEndpoint, setSelectedEndpoint] = useState('/api/child/turso-child-test');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enrolledChildId, setEnrolledChildId] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [manualChildId, setManualChildId] = useState('');
  const [isValidatingChildId, setIsValidatingChildId] = useState(false);
  const [mode, setMode] = useState('enrol'); // 'enrol' or 'existing'
  const [formData, setFormData] = useState({
    res_id: 'TEST-RES-001',
    grade: '3',
    zone_id: 'ZONE-A',
    language: 'si',
  });

  const apiBase = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    []
  );

  async function handleEnrolStudent() {
    setIsSubmitting(true);
    setErrorMsg('');
    setStatusMsg('Contacting backend endpoint...');

    try {
      const response = await fetch(`${apiBase}${selectedEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          res_id: formData.res_id.trim(),
          grade: Number(formData.grade),
          zone_id: formData.zone_id.trim() || null,
          language: formData.language,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.child_id) {
        throw new Error(payload.message || 'Enrollment failed');
      }

      setEnrolledChildId(payload.child_id);
      setStatusMsg(payload.already_enrolled ? 'Student already enrolled.' : 'Student enrolled successfully.');
    } catch (err) {
      setErrorMsg(err.message || 'Unable to enroll student right now.');
      setStatusMsg('');
      setEnrolledChildId('');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleContinueWithSelectedUser() {
    if (!enrolledChildId) return;
    sessionStorage.setItem('selectedChildId', enrolledChildId);
    router.push('/child');
  }

  async function handleUseExistingChildId() {
    const childId = manualChildId.trim();
    if (!childId) {
      setErrorMsg('Please enter a child ID');
      return;
    }

    setIsValidatingChildId(true);
    setErrorMsg('');
    setStatusMsg('Validating child ID...');

    try {
      const response = await fetch(`${apiBase}/api/child/${encodeURIComponent(childId)}`);
      const payload = await response.json().catch(() => ({}));

      console.log('Validation response:', { status: response.status, payload });

      if (!response.ok || !payload?.child?.child_id) {
        throw new Error(payload.message || 'Child ID not found');
      }

      setEnrolledChildId(payload.child.child_id);
      setStatusMsg('Child ID verified. Ready to continue.');
      setErrorMsg('');
    } catch (err) {
      setEnrolledChildId('');
      setStatusMsg('');
      setErrorMsg(err.message || 'Unable to verify child ID right now.');
    } finally {
      setIsValidatingChildId(false);
    }
  }

  // Show loading while redirecting
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 lg:px-10">
        <div className="space-y-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">Smart Camp Box</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            One integrated platform for field safety, operations, and learning support
          </h1>
          <p className="mx-auto max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
            Smart Camp Box combines disaster intelligence, resource optimization, and psycho-attentional educational support into one coordinated
            system.
          </p>
        </div>
        <Link
          href="/child"
          className="hidden mx-auto rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
        >
          Child Mode
        </Link>
        <div className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <Image
            src="/smart-camp-box.svg"
            alt="Smart Camp Box full system overview"
            width={1920}
            height={1080}
            priority
            className="h-auto w-full object-contain"
          />
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-cyan-200 bg-linear-to-br from-cyan-50 via-white to-emerald-50 p-6 shadow-lg sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-emerald-200/40 blur-3xl" />

          <div className="relative grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Live Endpoint Runner</p>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Student Enrollment Launcher</h2>
              <p className="text-sm leading-6 text-slate-600">
                Run the selected backend endpoint from the home screen, capture the generated student ID, and continue directly to child mode without typing IDs manually.
              </p>

              {/* Mode Tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  suppressHydrationWarning
                  onClick={() => { setMode('enrol'); setManualChildId(''); setEnrolledChildId(''); setStatusMsg(''); setErrorMsg(''); }}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    mode === 'enrol'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200'
                  }`}
                >
                  📝 Enrol New Student
                </button>
                <button
                  suppressHydrationWarning
                  onClick={() => { setMode('existing'); setSelectedEndpoint('/api/child/enrol'); setFormData({ res_id: 'TEST-RES-001', grade: '3', zone_id: 'ZONE-A', language: 'si' }); setStatusMsg(''); setErrorMsg(''); }}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    mode === 'existing'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200'
                  }`}
                >
                  🔑 Use Existing ID
                </button>
              </div>

              {/* Enrol Mode */}
              {mode === 'enrol' && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">Selected endpoint</span>
                      <select
                        suppressHydrationWarning
                        value={selectedEndpoint}
                        onChange={(e) => setSelectedEndpoint(e.target.value)}
                        className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm outline-none ring-cyan-500 transition focus:ring-2"
                      >
                        <option value="/api/child/enrol">POST /api/child/enrol</option>
                        <option value="/api/child/turso-child-test">POST /api/child/turso-child-test</option>
                      </select>
                    </label>

                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">Language</span>
                      <select
                        suppressHydrationWarning
                        value={formData.language}
                        onChange={(e) => setFormData((s) => ({ ...s, language: e.target.value }))}
                        className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm outline-none ring-cyan-500 transition focus:ring-2"
                      >
                        <option value="si">Sinhala</option>
                        <option value="ta">Tamil</option>
                        <option value="en">English</option>
                      </select>
                    </label>

                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">Resident ID</span>
                      <input
                        suppressHydrationWarning
                        value={formData.res_id}
                        onChange={(e) => setFormData((s) => ({ ...s, res_id: e.target.value }))}
                        className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm outline-none ring-cyan-500 transition focus:ring-2"
                        placeholder="TEST-RES-001"
                      />
                    </label>

                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">Grade</span>
                      <input
                        suppressHydrationWarning
                        value={formData.grade}
                        onChange={(e) => setFormData((s) => ({ ...s, grade: e.target.value }))}
                        className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm outline-none ring-cyan-500 transition focus:ring-2"
                        placeholder="3"
                      />
                    </label>

                    <label className="space-y-1 text-sm sm:col-span-2">
                      <span className="font-medium text-slate-700">Zone ID</span>
                      <input
                        suppressHydrationWarning
                        value={formData.zone_id}
                        onChange={(e) => setFormData((s) => ({ ...s, zone_id: e.target.value }))}
                        className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm outline-none ring-cyan-500 transition focus:ring-2"
                        placeholder="ZONE-A"
                      />
                    </label>
                  </div>

                  <button
                    suppressHydrationWarning
                    onClick={handleEnrolStudent}
                    disabled={isSubmitting}
                    className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-cyan-300"
                  >
                    {isSubmitting ? 'Enrolling...' : 'Enrol Student'}
                  </button>
                </>
              )}

              {/* Existing ID Mode */}
              {mode === 'existing' && (
                <>
                  <div className="space-y-3">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">Enter Existing Child ID</span>
                      <input
                        suppressHydrationWarning
                        value={manualChildId}
                        onChange={(e) => setManualChildId(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && manualChildId.trim()) {
                            handleUseExistingChildId();
                          }
                        }}
                        className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm outline-none ring-cyan-500 transition focus:ring-2"
                        placeholder="e.g., CHILD-001"
                      />
                    </label>
                  </div>

                  <button
                    suppressHydrationWarning
                    onClick={handleUseExistingChildId}
                    disabled={!manualChildId.trim() || isValidatingChildId}
                    className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-cyan-300"
                  >
                    {isValidatingChildId ? 'Checking Child ID...' : 'Load Child ID'}
                  </button>
                </>
              )}
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-cyan-200/80 bg-white/90 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Enrollment Output</p>
                <p className="mt-3 text-sm text-slate-600">Student ID:</p>
                <p className="mt-1 min-h-8 rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm font-semibold text-slate-900">
                  {enrolledChildId || 'Not enrolled yet'}
                </p>
                {statusMsg ? <p className="mt-3 text-sm text-emerald-700">{statusMsg}</p> : null}
                {errorMsg ? <p className="mt-3 text-sm text-rose-700">{errorMsg}</p> : null}
              </div>

              <button
                suppressHydrationWarning
                onClick={handleContinueWithSelectedUser}
                disabled={!enrolledChildId}
                className="mt-6 rounded-xl border border-emerald-300 bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-300"
              >
                Continue With Selected User
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
            <h2 className="text-lg font-semibold text-teal-900">Hazard</h2>
            <p className="mt-2 text-sm leading-6 text-teal-800">Disaster management with flood location and flow/LUT prediction support.</p>
          </article>

          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-lg font-semibold text-amber-900">Resources</h2>
            <p className="mt-2 text-sm leading-6 text-amber-800">Intelligent resource management for inventory, logistics, and response planning.</p>
          </article>

          <article className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
            <h2 className="text-lg font-semibold text-indigo-900">PsychoEdu</h2>
            <p className="mt-2 text-sm leading-6 text-indigo-800">Psycho-attentional gated educational workflows for targeted learner support.</p>
          </article>
        </div>

        <p className="text-center text-sm text-slate-500">Replace public/smart-camp-box.svg with your final full Smart Camp Box image when ready.</p>
      </section>
    </main>
  );
}
