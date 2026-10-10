import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import type { AdminContext } from "@housepoints/contracts";
import { ManageGate, ContextPage, Card, Action, Field, Note, Row } from "@/components/manage/ManageUI";
import { selectManageMembers, type MemberFilter } from "@/lib/manage-overview";

export default function MembersScreen() {
  return <ManageGate>
    <ContextPage title="Members">{context => <Directory context={context} />}</ContextPage>
  </ManageGate>;
}
function Directory({ context }: { context: AdminContext }) {
  const params = useLocalSearchParams<{ filter?: string; houseId?: string }>();
  const [limit, setLimit] = useState(30);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MemberFilter>(params.filter === "unassigned" ? "unassigned" : "all");
  const [houseId, setHouseId] = useState(typeof params.houseId === "string" ? params.houseId : "");
  const [showHouses, setShowHouses] = useState(false);
  const members = selectManageMembers(context.users, search, filter, houseId);
  return <>
    <Field label="Search members" placeholder="Name or email" value={search} onChangeText={setSearch} autoCapitalize="none" autoCorrect={false} />
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{(["all", "unassigned", "admins"] as const).map(value => <Action key={value} label={`${filter === value ? "✓ " : ""}${value === "all" ? "All" : value === "admins" ? "Admins" : "Unassigned"}`} onPress={() => setFilter(value)} />)}</View>
    <Action label={`House: ${context.houses.find(h => h.id === houseId)?.name ?? "All houses"}`} onPress={() => setShowHouses(!showHouses)} />
    {showHouses ? <Card>
      <Action label="All houses" onPress={() => { setHouseId(""); setShowHouses(false); }} />{context.houses.map(house => <Row key={house.id} title={house.name} color={house.color} onPress={() => { setHouseId(house.id); setShowHouses(false); }} />)}</Card> : null}
    <Note>{members.length} members</Note>
    <Card>{members.slice(0, limit).map(user => <Row key={user.id} title={user.displayName} subtitle={context.houses.find(h => h.id === user.houseId)?.name ?? "No house assigned"} badge={user.role.toLowerCase()} onPress={() => router.push({ pathname: "/manage/member/[memberId]", params: { memberId: user.id } })} />)}
      {!members.length ? <Note>No members match these filters.</Note> : null}
      {members.length > limit ? <Action label="Show more members" onPress={() => setLimit(limit + 30)} /> : null}
    </Card>
    <Action label="Invite member" onPress={() => router.push("/manage/invite")} />
  </>;
}
