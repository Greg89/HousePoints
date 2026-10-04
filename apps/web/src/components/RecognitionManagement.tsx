"use client";

import { useRef, useState, useTransition } from "react";
import type { RecognitionCategory } from "@housepoints/contracts";
import type { MutationResult } from "@/lib/action-results";
import { ManageWorkspace } from "./ManageWorkspace";

type Props = {
  initialCategories: RecognitionCategory[];
  isOwner: boolean;
  onList: () => Promise<RecognitionCategory[]>;
  onCreate: (input: { name: string; description?: string; idempotencyKey: string }) => Promise<MutationResult>;
  onArchive: (categoryId: string) => Promise<MutationResult>;
};

export function RecognitionManagement({ initialCategories, isOwner, onList, onCreate, onArchive }: Props) {
  const [categories, setCategories] = useState(initialCategories);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const creationKey = useRef<string | null>(null);
  const active = categories.filter((category) => !category.archivedAt);
  const archived = categories.filter((category) => category.archivedAt);

  async function refresh() {
    try {
      setCategories(await onList());
      setRefreshError(null);
    } catch {
      setRefreshError("Categories changed, but the list could not refresh. Try Refresh categories.");
    }
  }

  function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOwner || !name.trim() || isPending) return;
    const key = creationKey.current ?? crypto.randomUUID();
    creationKey.current = key;
    setError(null);
    startTransition(async () => {
      try {
        const result = await onCreate({ name: name.trim(), description: description.trim() || undefined, idempotencyKey: key });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setName("");
        setDescription("");
        creationKey.current = null;
        await refresh();
      } catch {
        setError("The category could not be saved. Retry to check whether it was created.");
      }
    });
  }

  function archive(categoryId: string) {
    if (!isOwner || isPending || active.length <= 1) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await onArchive(categoryId);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setConfirmArchiveId(null);
        await refresh();
      } catch {
        setError("The category could not be archived. Refresh categories and try again.");
      }
    });
  }

  return <ManageWorkspace id="recognition" title="Recognition" description="Choose the categories people can use when awarding points." count={active.length} action={<button type="button" onClick={() => startTransition(refresh)} className="rounded-lg border px-3 py-2 text-sm font-semibold">Refresh categories</button>}>
    {!isOwner ? <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">Only organization owners can add or archive recognition categories.</p> : null}
    {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
    {refreshError ? <p role="alert" className="text-sm text-destructive">{refreshError}</p> : null}
    {isOwner ? <form onSubmit={create} className="rounded-xl border bg-card p-4 space-y-3">
      <h3 className="font-semibold">Add category</h3>
      <label className="block text-sm font-medium">Name<input value={name} onChange={(event) => { setName(event.target.value); creationKey.current = null; }} minLength={2} maxLength={60} required className="mt-1 w-full rounded-lg border bg-background px-3 py-2" /></label>
      <label className="block text-sm font-medium">Description (optional)<textarea value={description} onChange={(event) => { setDescription(event.target.value); creationKey.current = null; }} maxLength={240} rows={2} className="mt-1 w-full rounded-lg border bg-background px-3 py-2" /></label>
      <button disabled={isPending || name.trim().length < 2} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{isPending ? "Saving…" : "Add category"}</button>
    </form> : null}
    <section className="space-y-2" aria-label="Active categories"><h3 className="font-semibold">Active categories</h3>
      {active.map((category) => <div key={category.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div><p className="font-semibold">{category.name}</p>{category.description ? <p className="text-sm text-muted-foreground">{category.description}</p> : null}</div>
        {isOwner ? confirmArchiveId === category.id ? <div className="flex items-center gap-2"><span className="text-sm">Remove from future awards?</span><button type="button" disabled={isPending} onClick={() => archive(category.id)} className="rounded-lg bg-destructive px-3 py-2 text-sm font-semibold text-white">Confirm archive</button><button type="button" onClick={() => setConfirmArchiveId(null)} className="rounded-lg border px-3 py-2 text-sm">Cancel</button></div> : <button type="button" disabled={isPending || active.length <= 1} title={active.length <= 1 ? "Add another category before archiving this one." : undefined} onClick={() => setConfirmArchiveId(category.id)} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">Archive</button> : null}
      </div>)}
      {active.length <= 1 && isOwner ? <p className="text-sm text-muted-foreground">Add another category before archiving the last active category.</p> : null}
    </section>
    <section className="space-y-2" aria-label="Archived categories"><h3 className="font-semibold">Archived categories</h3>
      {archived.length ? archived.map((category) => <div key={category.id} className="rounded-xl border bg-muted/30 p-4"><p className="font-semibold">{category.name} <span className="ml-2 text-xs font-normal text-muted-foreground">Archived {new Date(category.archivedAt!).toLocaleDateString()}</span></p>{category.description ? <p className="text-sm text-muted-foreground">{category.description}</p> : null}</div>) : <p className="text-sm text-muted-foreground">No archived categories.</p>}
    </section>
  </ManageWorkspace>;
}
