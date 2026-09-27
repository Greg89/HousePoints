import { useLocalSearchParams } from "expo-router";
import { OrganizationDeepLink } from "@/components/OrganizationDeepLink";

export default function DashboardDeepLink() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <OrganizationDeepLink slug={slug} />;
}
