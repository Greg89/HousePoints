export default function Loading() {
  return (
    <div className="min-h-screen bg-background" role="status" aria-label="Loading dashboard">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
          <div className="h-6 w-36 animate-pulse rounded bg-primary/20" />
          <div className="flex items-center gap-3">
            <div className="hidden h-8 w-32 animate-pulse rounded-full bg-muted sm:block" />
            <div className="hidden h-10 w-32 animate-pulse rounded-lg bg-primary/20 sm:block" />
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 space-y-3">
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="h-9 w-56 animate-pulse rounded bg-muted" />
        </div>

        <div className="mb-8 flex gap-3 border-b pb-3">
          <div className="h-7 w-24 animate-pulse rounded bg-muted" />
          <div className="h-7 w-24 animate-pulse rounded bg-muted" />
          <div className="h-7 w-28 animate-pulse rounded bg-muted" />
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="h-7 w-44 animate-pulse rounded bg-muted" />
            <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
          </div>
          <div className="h-9 w-48 animate-pulse rounded-full bg-muted" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {["one", "two", "three", "four"].map((key) => (
            <div key={key} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="mb-4 h-5 w-28 animate-pulse rounded bg-muted" />
              <div className="mb-6 h-9 w-20 animate-pulse rounded bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <div className="h-48 rounded-2xl border bg-card p-5">
            <div className="h-5 w-36 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-48 rounded-2xl border bg-card p-5">
            <div className="h-5 w-36 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-48 rounded-2xl border bg-card p-5">
            <div className="h-5 w-36 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </main>
    </div>
  );
}
