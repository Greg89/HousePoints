import { readSessionSummary, submitPointAdjustment } from "./actions/points";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await readSessionSummary();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-6 py-10 sm:px-10">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">HousePoints</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Shared API + Structured Logging Baseline</h1>
        <p className="text-zinc-600">
          This page uses server actions that emit structured logs aligned with API logging conventions.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Authentication</h2>
        {session.isAuthenticated ? (
          <div className="mt-3 space-y-2 text-sm text-zinc-700">
            <p>
              Signed in as <strong>{session.userName ?? "Unknown"}</strong>
            </p>
            <p className="break-all">Auth0 Subject: {session.userSub}</p>
            <a className="inline-block rounded-md bg-zinc-900 px-3 py-2 text-white" href="/auth/logout">
              Log out
            </a>
          </div>
        ) : (
          <div className="mt-3 space-y-2 text-sm text-zinc-700">
            <p>You are not logged in.</p>
            <a className="inline-block rounded-md bg-zinc-900 px-3 py-2 text-white" href="/auth/login">
              Log in with Auth0
            </a>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Adjust Points (Server Action)</h2>
        <p className="mt-1 text-sm text-zinc-600">
          This action derives the actor from the signed-in Auth0 session and logs `web.action.*` and `points.adjust.*` events with a request correlation id.
        </p>
        <form action={submitPointAdjustment} className="mt-4 grid gap-3">
          <input
            name="targetHouseId"
            className="rounded-md border border-zinc-300 px-3 py-2"
            placeholder="Target house id"
            required
          />
          <input
            name="delta"
            type="number"
            className="rounded-md border border-zinc-300 px-3 py-2"
            placeholder="Points delta (e.g. 10 or -5)"
            required
          />
          <input
            name="reason"
            className="rounded-md border border-zinc-300 px-3 py-2"
            placeholder="Reason"
            required
          />
          <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-white">
            Submit Point Adjustment
          </button>
        </form>
      </section>
    </main>
  );
}
