import Link from "next/link";

export function AdminUnavailablePanel() {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 text-amber-950">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
            Manage tools unavailable
          </div>
          <h3 className="font-display text-2xl font-semibold">Admin tools could not be loaded</h3>
          <p className="max-w-2xl text-sm leading-relaxed text-amber-800">
            The dashboard is still available, but organization management data did not load. Try
            reloading the dashboard; if this keeps happening, check the web and API logs around the
            time of the failed page load.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-800"
        >
          Reload dashboard
        </Link>
      </div>
    </section>
  );
}
