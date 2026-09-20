"use client";

import { useState, useTransition } from "react";
import type { PlatformUserSearchResponse } from "@housepoints/contracts";
import { toast } from "sonner";
import { revokePlatformUserDevices, searchPlatformUsers } from "@/app/actions/platform";

type UserResult = PlatformUserSearchResponse["users"][number];

function UserCard({ user, onDevicesRevoked }: { user: UserResult; onDevicesRevoked: (userId: string, deviceId?: string) => void }) {
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const canRevoke = confirmation === user.displayName && reason.trim().length >= 3 && !pending;
  function revoke(deviceRegistrationId?: string) { startTransition(async () => {
    const result = await revokePlatformUserDevices({ userId: user.id, ...(deviceRegistrationId ? { deviceRegistrationId } : {}), confirmationDisplayName: confirmation, reason });
    if (!result.ok) { toast.error(result.message); return; }
    onDevicesRevoked(user.id, deviceRegistrationId); setConfirmation(""); setReason("");
    toast.success(`${result.revokedCount} device registration${result.revokedCount === 1 ? "" : "s"} revoked.`);
  }); }
  return <article className="rounded-2xl border bg-card p-5">
    <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-display text-xl font-semibold">{user.displayName}</h2><p className="text-sm text-muted-foreground">{user.email ?? "No email"}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{user.auth0Sub}</p></div><div className="text-right text-sm"><p>{user.activeDeviceCount} active device{user.activeDeviceCount === 1 ? "" : "s"}</p>{user.deletionRequestedAt ? <p className="font-semibold text-destructive">Deletion requested</p> : null}</div></div>
    {user.devices.length ? <section className="mt-4 rounded-xl border p-4"><h3 className="font-semibold">Active devices</h3><div className="mt-3 space-y-3">{user.devices.map((device) => <div key={device.id} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"><div><p className="font-semibold">{device.platform} · {device.organizationName}</p><p className="text-xs text-muted-foreground">App {device.appVersion ?? "unknown"} · {device.locale ?? "locale unknown"} · Last seen {new Date(device.lastSeenAt).toLocaleString()}</p></div><button className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={!canRevoke} onClick={() => revoke(device.id)}>Revoke device</button></div>)}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Type <strong>{user.displayName}</strong> to confirm<input aria-label={`Device confirmation for ${user.displayName}`} className="mt-1 block w-full rounded-lg border bg-background px-3 py-2" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><label className="text-sm font-medium">Support reason<input aria-label={`Device revocation reason for ${user.displayName}`} className="mt-1 block w-full rounded-lg border bg-background px-3 py-2" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label></div>{user.devices.length > 1 ? <button className="mt-3 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50" disabled={!canRevoke} onClick={() => revoke()}>Revoke all active devices</button> : null}</section> : null}
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b text-xs uppercase text-muted-foreground"><tr><th className="py-2">Organization</th><th>Role</th><th>Membership</th><th>Organization</th><th>Effective access</th><th>Capabilities</th></tr></thead><tbody>{user.memberships.map((membership) => <tr key={membership.organizationId} className="border-b last:border-0"><td className="py-3"><p className="font-semibold">{membership.organizationName}</p><p className="text-xs text-muted-foreground">{membership.organizationSlug}</p></td><td>{membership.role}</td><td>{membership.membershipStatus}</td><td>{membership.organizationStatus}</td><td>{membership.effectiveAccess}</td><td className="text-xs">{membership.capabilities.join(", ") || "None"}</td></tr>)}</tbody></table>{user.memberships.length === 0 ? <p className="py-3 text-sm text-muted-foreground">No memberships.</p> : null}</div>
  </article>;
}

export function PlatformUserSearch() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [pending, startTransition] = useTransition();
  function search() { if (query.trim().length < 2) { setMessage("Enter at least two characters."); return; } startTransition(async () => { const result = await searchPlatformUsers(query.trim()); setSearched(true); if (!result.ok) { setMessage(result.message); setUsers([]); return; } setMessage(null); setUsers(result.data.users); }); }
  function removeDevices(userId: string, deviceId?: string) { setUsers((current) => current.map((user) => user.id !== userId ? user : { ...user, devices: deviceId ? user.devices.filter((device) => device.id !== deviceId) : [], activeDeviceCount: deviceId ? Math.max(0, user.activeDeviceCount - 1) : 0 })); }
  return <section className="space-y-4"><form className="flex gap-3" onSubmit={(event) => { event.preventDefault(); search(); }}><label className="sr-only" htmlFor="platform-user-query">Search users</label><input id="platform-user-query" className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2" placeholder="Name, email, or Auth0 subject" value={query} onChange={(event) => setQuery(event.target.value)} /><button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50" disabled={pending} type="submit">{pending ? "Searching…" : "Search"}</button></form>{message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}{searched && !message && users.length === 0 ? <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">No matching users.</p> : null}<div className="space-y-4">{users.map((user) => <UserCard key={user.id} user={user} onDevicesRevoked={removeDevices} />)}</div></section>;
}
