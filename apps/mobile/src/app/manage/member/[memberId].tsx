import { useState } from "react";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { updateMemberDisplayNameSchema, type AdminContext, type AdminUser } from "@housepoints/contracts";
import { useActiveOrg } from "@/context/org-provider";
import { useManageMutation } from "@/hooks/use-manage";
import { canManageMemberRole, canRemoveMember } from "@/lib/member-management";
import { ManageGate, ContextPage, Card, Heading, Note, Action, Field } from "@/components/manage/ManageUI";

export default function MemberScreen() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  return <ManageGate>
    <ContextPage title="Manage member">{context => {
      const member = context.users.find(user => user.id === memberId);
      return member ? <MemberEditor key={member.id} member={member} context={context} /> : <Note>This member is no longer available in this organization.</Note>;
    }}</ContextPage>
  </ManageGate>;
}
function MemberEditor({ member, context }: { member: AdminUser; context: AdminContext }) {
  const { activeMembership } = useActiveOrg();
  const actorRole = activeMembership?.role === "OWNER" ? "OWNER" : "ADMIN";
  const [name, setName] = useState(member.displayName);
  const [choosingHouse, setChoosingHouse] = useState(false);
  const rename = useManageMutation("/admin/users/display-name", "Display name updated");
  const assign = useManageMutation("/admin/users/assign-house", "House assignment updated", () => setChoosingHouse(false));
  const role = useManageMutation("/admin/users/role", "Member access updated");
  const remove = useManageMutation("/admin/users/remove", "Member removed", () => router.back());
  const pending = rename.isPending || assign.isPending || role.isPending || remove.isPending;
  const validName = updateMemberDisplayNameSchema.safeParse({ targetUserId: member.id, displayName: name });
  const confirmRole = () => {
    const nextRole = member.role === "ADMIN" ? "MEMBER" : "ADMIN";
    Alert.alert(nextRole === "ADMIN" ? "Promote to admin?" : "Remove admin access?", `${member.displayName} will become ${nextRole.toLowerCase()}.`, [{ text: "Cancel", style: "cancel" }, { text: "Confirm", onPress: () => role.mutate({ targetUserId: member.id, role: nextRole }) }]);
  };
  return <>
    <Card>
      <Heading>{member.displayName}</Heading>
      <Note>{member.email ?? "No email available"} · {member.role.toLowerCase()}</Note>
      <Action label="View performance" onPress={() => router.push({ pathname: "/member/[memberId]", params: { memberId: member.id } })} />
    </Card>
    <Card>
      <Heading>Display name</Heading>
      <Field label="Display name" value={name} onChangeText={setName} maxLength={120} editable={!pending} />
      <Note>This updates the member’s display name across their organizations.</Note>
      <Action label={rename.isPending ? "Saving…" : "Save name"} disabled={pending || !validName.success || name.trim() === member.displayName} onPress={() => { if (validName.success) rename.mutate(validName.data); }} />
    </Card>
    <Card>
      <Heading>House</Heading>
      <Note>{context.houses.find(h => h.id === member.houseId)?.name ?? "No house assigned"}</Note>
      <Action label="Change house" disabled={pending || !context.houses.length} onPress={() => setChoosingHouse(!choosingHouse)} />
      {!context.houses.length ? <Note>An owner needs to create a house first.</Note> : null}
      {choosingHouse ? context.houses.map(house => <Action key={house.id} label={`${house.id === member.houseId ? "✓ " : ""}${house.name}`} disabled={pending || house.id === member.houseId} onPress={() => Alert.alert("Change house?", `Move ${member.displayName} to ${house.name}?`, [{ text: "Cancel", style: "cancel" }, { text: "Move", onPress: () => assign.mutate({ targetUserId: member.id, targetHouseId: house.id }) }])} />) : null}
    </Card>
    <Card>
      <Heading>Access</Heading>
      <Action label={member.role === "ADMIN" ? "Remove admin access" : "Promote to admin"} disabled={pending || !canManageMemberRole(actorRole, member.role)} onPress={confirmRole} />{!canManageMemberRole(actorRole, member.role) ? <Note>{member.role === "OWNER" ? "Ownership changes are available on the web." : "Only owners can change member roles."}</Note> : null}</Card>
    <Card>
      <Action label="Remove member" danger disabled={pending || !canRemoveMember(actorRole, member.role)} onPress={() => Alert.alert("Remove member?", `${member.displayName} will lose access to this organization.`, [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => remove.mutate({ targetUserId: member.id }) }])} />{!canRemoveMember(actorRole, member.role) ? <Note>Only owners can remove members. Transfer ownership on the web before removing an owner.</Note> : null}</Card>
  </>;
}
