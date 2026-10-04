import { PlatformUserSearch } from "@/components/PlatformUserSearch";

export const dynamic = "force-dynamic";
export default function PlatformUsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">User and permission search</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Search by name, email, or identity subject. Results are diagnostic and do not impersonate the user.
        </p>
      </div>
      <PlatformUserSearch />
    </div>
  );
}
