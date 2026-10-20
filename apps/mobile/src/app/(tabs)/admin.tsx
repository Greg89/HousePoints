import { useState } from "react";
import { Linking } from "react-native";
import { router } from "expo-router";
import { useActiveOrg } from "@/context/org-provider";
import { useToast } from "@/context/toast-provider";
import { env } from "@/lib/env";
import { buildWebAdminUrl } from "@/lib/mobile-admin";
import { manageAttention } from "@/lib/manage-overview";
import { ManageGate, ContextPage, Card, Heading, Note, Action, Row } from "@/components/manage/ManageUI";

export default function AdminScreen() {
  return <ManageGate>
    <Overview />
  </ManageGate>;
}
function Overview() {
  const { activeOrgSlug, activeMembership } = useActiveOrg();
  const { showToast } = useToast();
  const [opening, setOpening] = useState(false);
  async function openWeb() {
    if (!activeOrgSlug) return;
    setOpening(true);
    try { await Linking.openURL(buildWebAdminUrl(env.webBaseUrl, activeOrgSlug)); }
    catch { showToast({ message: "Unable to open the web dashboard.", variant: "error" }); }
    finally { setOpening(false); }
  }
  return <ContextPage title="Manage">{context => {
    const attention = manageAttention(context);
    return <>
      <Heading>{activeMembership?.organizationName}</Heading>
      <Action label="+ Invite member" onPress={() => router.push("/manage/invite")} />
      <Card>
        <Heading>Needs attention</Heading>
        {attention.unassigned > 0 ? <Row title={`${attention.unassigned} members need a house`} subtitle="Review unassigned members" onPress={() => router.push({ pathname: "/manage/members", params: { filter: "unassigned" } })} /> : null}
        {!context.houses.length ? <Row title="Create your first house" subtitle="An owner can set up houses" onPress={() => router.push("/manage/houses")} /> : null}
        {attention.emptyHouses.map(house => <Row key={house.id} title={`${house.name} has no members`} color={house.color} subtitle="Assign members to this house" onPress={() => router.push({ pathname: "/manage/members", params: { filter: "unassigned" } })} />)}
        {!attention.unassigned && context.houses.length > 0 && !attention.emptyHouses.length ? <Note>Every member has a house, and every house has members.</Note> : null}
      </Card>
      <Card>
        <Row title="Members" subtitle="Search, assign houses, and manage access" badge={String(context.users.length)} onPress={() => router.push("/manage/members")} />
        <Row title="Houses" subtitle="Members and house setup" badge={String(context.houses.length)} onPress={() => router.push("/manage/houses")} />
        {env.recognitionCategoriesEnabled ? <Row title="Recognition categories" subtitle="Browse, create, and archive categories" onPress={() => router.push("/manage/categories")} /> : null}
        {env.pointAdjustmentsEnabled ? <Row title="Point deduction" subtitle="Deduct points using the existing eligibility rules" onPress={() => router.push("/deduct")} /> : null}
      </Card>
      <Card>
        <Heading>Recent admin activity</Heading>
        {context.recentAdminActions.slice(0, 3).map(event => <Note key={event.id}>{event.summary}{"\n"}{new Date(event.occurredAt).toLocaleString()}</Note>)}
        {!context.recentAdminActions.length ? <Note>No admin activity yet.</Note> : null}
        <Action label="View all activity" onPress={() => router.push("/manage/activity")} />
      </Card>
      <Card>
        <Action label="Full web dashboard ↗" disabled={opening} onPress={() => void openWeb()} />
        <Note>Season transitions, advanced appearance, ownership, organization archive and restore, and detailed reports.</Note>
      </Card>
    </>;
  }}</ContextPage>;
}
