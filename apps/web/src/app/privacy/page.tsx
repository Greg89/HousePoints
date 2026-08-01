import type { Metadata } from "next";
import { PublicInfoPage } from "@/components/PublicInfoPage";

const supportEmail = "dodson.gregory@gmail.com";

export const metadata: Metadata = {
  title: "Privacy Policy | HousePoints",
  description: "How HousePoints collects, uses, and protects information.",
};

export default function PrivacyPage() {
  return (
    <PublicInfoPage
      eyebrow="Effective August 1, 2026"
      title="Privacy Policy"
      intro="This policy explains what information HousePoints processes when you use the web or mobile application and the choices available to you."
    >
      <section>
        <h2>Information we process</h2>
        <ul className="mt-4">
          <li>
            Account information supplied through our authentication provider,
            such as your user identifier, name, and email address.
          </li>
          <li>
            Organization and house information, including memberships, roles,
            invitations, and display preferences.
          </li>
          <li>
            App activity, including point awards or adjustments, reasons,
            reactions, leaderboard activity, and notification read status.
          </li>
          <li>
            Mobile notification information, including a push token, device
            platform, and registration status when notifications are enabled.
          </li>
          <li>
            Operational information such as request identifiers, error reports,
            and security logs used to operate and protect the service.
          </li>
        </ul>
      </section>

      <section>
        <h2>How we use information</h2>
        <p className="mt-4">
          We use this information to authenticate users, provide
          organization-scoped features, calculate scores and leaderboards, deliver
          notifications, support users, diagnose errors, prevent abuse, and
          maintain the security and reliability of HousePoints.
        </p>
      </section>

      <section>
        <h2>Service providers and sharing</h2>
        <p className="mt-4">
          HousePoints relies on service providers for authentication, hosting,
          database infrastructure, application delivery, and push
          notifications. These providers process information only as needed to
          provide their services. Information may also be disclosed when
          required by law, to protect users or the service, or as part of a
          business transfer. We do not sell personal information or use it for
          third-party advertising.
        </p>
      </section>

      <section>
        <h2>Retention and security</h2>
        <p className="mt-4">
          We retain information while an account or organization needs the
          service and as reasonably necessary for security, dispute resolution,
          legal compliance, and backups. We use administrative, technical, and
          organizational safeguards, but no system can guarantee absolute
          security.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <p className="mt-4">
          You can disable push notifications through your device settings. To
          request access, correction, or deletion of your information, contact
          your organization administrator or email us. Some records may need to
          be retained for the purposes described above.
        </p>
      </section>

      <section>
        <h2>Organizations and minors</h2>
        <p className="mt-4">
          HousePoints is provided to organizations and their authorized
          members. An organization that makes the service available to minors
          is responsible for obtaining any consent required by applicable law
          and for configuring and supervising that use appropriately. Contact us
          if you believe information was provided without the required consent.
        </p>
      </section>

      <section>
        <h2>Changes to this policy</h2>
        <p className="mt-4">
          We may update this policy as HousePoints changes. We will post the
          revised policy here and update its effective date.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p className="mt-4">
          Questions or privacy requests can be sent to{" "}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
        </p>
      </section>
    </PublicInfoPage>
  );
}
