import { useRef, useState } from "react";
import { Alert } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { createPointSubmissionKeys, createRecognitionCategorySchema } from "@housepoints/contracts";
import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { callApi } from "@/lib/api-client";
import { env } from "@/lib/env";
import { generateRequestId } from "@/lib/request-id";
import { useManageMutation } from "@/hooks/use-manage";
import { ManageGate, ContextPage, Card, Heading, Note, Action, Field } from "@/components/manage/ManageUI";

export default function CategoriesScreen() {
  return <ManageGate>
    <ContextPage title="Recognition categories">{() => env.recognitionCategoriesEnabled ? <Categories /> : <Note>Recognition categories are not enabled in this build.</Note>}</ContextPage>
  </ManageGate>;
}
function Categories() {
  const { activeOrgSlug, activeMembership } = useActiveOrg();
  const { getAccessToken } = useAppAuth();
  const owner = activeMembership?.role === "OWNER";
  const [creating, setCreating] = useState(false);
  const [archived, setArchived] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const keys = useRef(createPointSubmissionKeys(generateRequestId));
  const query = useQuery({ queryKey: ["manage-categories", activeOrgSlug], queryFn: async ({ signal }) => callApi("/recognition-categories/list", { includeArchived: true }, { accessToken: await getAccessToken(), organizationSlug: activeOrgSlug, signal }) });
  const create = useManageMutation("/recognition-categories/create", "Category created", (_result, body) => { keys.current.complete(body.idempotencyKey); setName(""); setDescription(""); setCreating(false); });
  const archive = useManageMutation("/recognition-categories/archive", "Category archived");
  const pending = create.isPending || archive.isPending;
  const categories = query.data?.categories ?? [];
  const activeCount = categories.filter(category => !category.archivedAt).length;
  const fields = { name: name.trim(), description: description.trim() || undefined };
  // Validation uses the same constraints as the API; the submission key is stable for retries.
  const valid = createRecognitionCategorySchema.omit({ idempotencyKey: true }).safeParse(fields).success;
  if (query.isPending) return <Note>Loading categories…</Note>;
  if (query.isError) return <Action label="Unable to load categories. Tap to retry" onPress={() => void query.refetch()} />;
  return <>
    <Action label="+ Create category" disabled={!owner || pending} onPress={() => setCreating(!creating)} />
    {!owner ? <Note>Only owners can create and archive categories.</Note> : null}
    {creating ? <Card>
      <Heading>New category</Heading>
      <Field label="Category name" value={name} onChangeText={setName} maxLength={60} editable={!pending} />
      <Field label="Description (optional)" value={description} onChangeText={setDescription} maxLength={240} multiline editable={!pending} />
      <Note>Use a name of 2–60 characters.</Note>
      <Action label={create.isPending ? "Creating…" : "Create category"} disabled={!owner || !valid || pending} onPress={() => create.mutate({ ...fields, idempotencyKey: keys.current.keyFor([activeOrgSlug, fields]) })} />
    </Card> : null}
    <Action label={archived ? "Show active categories" : "Show archived categories"} onPress={() => setArchived(!archived)} />
    {categories.filter(category => !!category.archivedAt === archived).map(category => <Card key={category.id}>
      <Heading>{category.name}</Heading>{category.description ? <Note>{category.description}</Note> : null}<Note>{category.archivedAt ? `Archived ${new Date(category.archivedAt).toLocaleDateString()}` : "Active"}</Note>{!category.archivedAt ? <>
        <Action label="Archive category" danger disabled={!owner || pending || activeCount <= 1} onPress={() => Alert.alert("Archive category?", `${category.name} will no longer be available for new awards. Existing awards keep their category.`, [{ text: "Cancel", style: "cancel" }, { text: "Archive", style: "destructive", onPress: () => archive.mutate({ categoryId: category.id }) }])} />{activeCount <= 1 ? <Note>Keep at least one active category.</Note> : null}</> : null}</Card>)}
    {!categories.some(category => !!category.archivedAt === archived) ? <Note>No {archived ? "archived" : "active"} categories.</Note> : null}
    <Action label="Refresh categories" disabled={query.isFetching} onPress={() => void query.refetch()} />
  </>;
}
