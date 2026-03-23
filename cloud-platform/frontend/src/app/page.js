import Image from "next/image";

export default function Home() {
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

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <Image
            src="/smart-camp-box.svg"
            alt="Smart Camp Box full system overview"
            width={1920}
            height={1080}
            priority
            className="h-auto w-full object-contain"
          />
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
