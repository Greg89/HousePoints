import { useState } from "react";
import { router } from "expo-router";
import { createHouseSchema, type AdminContext } from "@housepoints/contracts";
import { useActiveOrg } from "@/context/org-provider";
import { useManageMutation } from "@/hooks/use-manage";
import { ManageGate, ContextPage, Card, Heading, Note, Action, Field, Row } from "@/components/manage/ManageUI";

export default function HousesScreen() {
  return <ManageGate>
    <ContextPage title="Houses">{context => <Houses context={context} />}</ContextPage>
  </ManageGate>;
}
function Houses({ context }: { context: AdminContext }) {
  const { activeMembership } = useActiveOrg();
  const owner = activeMembership?.role === "OWNER";
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#7c3aed");
  const [description, setDescription] = useState("");
  const create = useManageMutation("/admin/houses", "House created", () => { setCreating(false); setName(""); setDescription(""); });
  const parsed = createHouseSchema.safeParse({ name: name.trim(), color, description: description.trim() });
  return <>
    <Action label="+ Create house" disabled={!owner || create.isPending} onPress={() => setCreating(!creating)} />
    {!owner ? <Note>Only owners can create houses.</Note> : null}
    {creating ? <Card>
      <Heading>New house</Heading>
      <Field label="House name" value={name} onChangeText={setName} maxLength={80} editable={!create.isPending} />
      <Field label="Color (#RRGGBB)" value={color} onChangeText={setColor} autoCapitalize="none" maxLength={7} editable={!create.isPending} />
      <Field label="Description (optional)" value={description} onChangeText={setDescription} maxLength={280} multiline editable={!create.isPending} />
      <Note>{parsed.success ? "Ready to create" : "Use a name of 2–80 characters and a six-digit hex color."}</Note>
      <Action label={create.isPending ? "Creating…" : "Create house"} disabled={!owner || !parsed.success || create.isPending} onPress={() => { if (parsed.success) create.mutate(parsed.data); }} />
    </Card> : null}
    {!context.houses.length ? <Card>
      <Note>No houses yet. Create the first house to get started.</Note>
    </Card> : null}
    {context.houses.map(house => <Card key={house.id}>
      <Row title={house.name} color={house.color} subtitle={`${context.users.filter(user => user.houseId === house.id).length} members`} onPress={() => router.push({ pathname: "/manage/members", params: { houseId: house.id } })} />{house.description ? <Note>{house.description}</Note> : null}<Action label="View house performance" onPress={() => router.push({ pathname: "/house/[houseId]", params: { houseId: house.id } })} />
      <Action label="Assign members" onPress={() => router.push({ pathname: "/manage/members", params: { filter: "unassigned" } })} />
    </Card>)}
    <Note>Advanced house appearance settings are available in the web dashboard.</Note>
  </>;
}
