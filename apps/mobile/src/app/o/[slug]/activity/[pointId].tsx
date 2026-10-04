import { useLocalSearchParams } from "expo-router";
import { OrganizationDeepLink } from "@/components/OrganizationDeepLink";

export default function ActivityDeepLink() {
  const { slug, pointId } = useLocalSearchParams<{ slug: string; pointId: string }>();
  return <OrganizationDeepLink slug={slug} pointId={pointId} />;
}
