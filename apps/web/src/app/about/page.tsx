import type { Metadata } from "next";
import Link from "next/link";
import { PublicInfoPage } from "@/components/PublicInfoPage";

export const metadata: Metadata = {
  title: "HousePoints | Recognition and House Scoring",
  description:
    "HousePoints helps organizations recognize members, award points, and follow house standings.",
};

export default function AboutPage() {
  return (
    <PublicInfoPage
      eyebrow="Recognition that builds community"
      title="HousePoints"
      intro="HousePoints helps organizations recognize members, award meaningful points, and follow friendly house standings from the web or mobile app."
    >
      <section>
        <h2>What HousePoints does</h2>
        <p className="mt-4">
          Organizations use HousePoints to place members into houses, recognize
          positive contributions, record point awards and adjustments, and see
          current leaderboard standings. Activity is scoped to each organization
          and managed by its authorized members, administrators, and owners.
        </p>
      </section>

      <section>
        <h2>Web and mobile access</h2>
        <p className="mt-4">
          Members can securely sign in, join an invited organization, review
          activity, and manage their profile. HousePoints is available as a web
          application and is being prepared for release on Android.
        </p>
        <p className="mt-4">
          <Link href="/auth/login">Sign in to HousePoints</Link>
        </p>
      </section>

      <section>
        <h2>Privacy and account controls</h2>
        <p className="mt-4">
          Read the <Link href="/privacy">HousePoints Privacy Policy</Link>, get
          help from <Link href="/support">HousePoints Support</Link>, or review
          the <Link href="/account-deletion">account deletion instructions</Link>.
        </p>
      </section>
    </PublicInfoPage>
  );
}
