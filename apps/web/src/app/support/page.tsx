import type { Metadata } from "next";
import { PublicInfoPage } from "@/components/PublicInfoPage";

const supportEmail = "dodson.gregory@gmail.com";

export const metadata: Metadata = {
  title: "Support | HousePoints",
  description: "Get help with the HousePoints web and mobile applications.",
};

export default function SupportPage() {
  return (
    <PublicInfoPage
      eyebrow="HousePoints help"
      title="Support"
      intro="Get help signing in, joining your organization, managing notifications, or using HousePoints."
    >
      <section>
        <h2>Contact support</h2>
        <p className="mt-4">
          Email <a href={`mailto:${supportEmail}`}>{supportEmail}</a>. Please
          include what you were trying to do, whether you used the web or mobile
          app, and any error message you saw. Do not send passwords, access
          tokens, or other credentials.
        </p>
      </section>

      <section>
        <h2>Signing in</h2>
        <p className="mt-4">
          Confirm that you are using the email address invited by your
          organization. If sign-in succeeds but no organization appears, ask an
          organization administrator to verify your membership or send a new
          invitation.
        </p>
      </section>

      <section>
        <h2>Points, houses, and permissions</h2>
        <p className="mt-4">
          Point actions and administrative tools depend on your organization,
          house assignment, role, and enabled features. Contact an organization
          administrator if information is missing or you believe your access is
          incorrect.
        </p>
      </section>

      <section>
        <h2>Mobile notifications</h2>
        <p className="mt-4">
          Check that notifications are allowed for HousePoints in your device
          settings. Signing out unregisters that device; sign in again to
          restore registration. Delivery can also depend on your organization’s
          notification settings.
        </p>
      </section>

      <section>
        <h2>Privacy requests</h2>
        <p className="mt-4">
          Review our <a href="/privacy">Privacy Policy</a> for information about
          the data HousePoints processes. Access, correction, or deletion
          requests can be sent to the support email above.
        </p>
      </section>
    </PublicInfoPage>
  );
}
