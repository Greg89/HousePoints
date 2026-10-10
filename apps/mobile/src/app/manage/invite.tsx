import type { InviteLink } from "@housepoints/contracts";
import { useState } from "react";
import { Share } from "react-native";
import { useActiveOrg } from "@/context/org-provider";
import { useToast } from "@/context/toast-provider";
import { useManageMutation } from "@/hooks/use-manage";
import { env } from "@/lib/env";
import { buildInviteUrl, buildInviteShareMessage, formatInviteExpiration } from "@/lib/invite-sharing";
import { ManageGate, ContextPage, Card, Heading, Note, Action } from "@/components/manage/ManageUI";
export default function InviteScreen() {
  return <ManageGate>
    <ContextPage title="Invite member">{() => <Invite />}</ContextPage>
  </ManageGate>;
}
function Invite() {
  const { activeMembership } = useActiveOrg();
  const { showToast } = useToast();
  const [hours, setHours] = useState(72);
  const [sharing, setSharing] = useState(false);
  const [invite, setInvite] = useState<InviteLink | null>(null);
  const create = useManageMutation("/orgs/invite", "Invite created", setInvite);
  async function share() {
    if (!invite) return;
    setSharing(true);
    try {
      const url = buildInviteUrl(env.webBaseUrl, invite.joinPath);
      await Share.share({ title: `Invite to ${activeMembership?.organizationName}`, message: buildInviteShareMessage(activeMembership?.organizationName ?? "HousePoints", url) });
    } catch { showToast({ message: "Unable to share this invite. Please try again.", variant: "error" }); }
    finally { setSharing(false); }
  }
  return <Card>
    <Heading>Invite a member</Heading>
    <Note>Create a single-use link for {activeMembership?.organizationName}.</Note>
    <Note>Link expires in</Note>
    {[{ hours: 24, label: "24 hours" }, { hours: 72, label: "3 days" }, { hours: 168, label: "7 days" }].map(option => <Action key={option.hours} label={`${hours === option.hours ? "✓ " : ""}${option.label}`} disabled={create.isPending} onPress={() => setHours(option.hours)} />)}
    <Action label={create.isPending ? "Creating…" : invite ? "Create another invite" : "Create invite"} disabled={create.isPending || sharing} onPress={() => create.mutate({ expiresInHours: hours })} />
    {invite ? <>
      <Heading>Invite ready</Heading>
      <Note>Expires {formatInviteExpiration(invite.expiresAt)}</Note>
      <Note>This link can be used once. Creating another link does not revoke this one.</Note>
      <Action label="Share invite" disabled={sharing || create.isPending} onPress={() => void share()} />
    </> : null}
  </Card>;
}
