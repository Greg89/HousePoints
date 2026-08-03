import type { Metadata } from "next";
import { PublicInfoPage } from "@/components/PublicInfoPage";

const supportEmail = "dodson.gregory@gmail.com";

export const metadata: Metadata = {
  title: "Delete Your Account | HousePoints",
  description: "How to request deletion of a HousePoints account and personal information.",
};

export default function AccountDeletionPage() {
  const requestSubject = encodeURIComponent("HousePoints account deletion request");

  return (
    <PublicInfoPage
      eyebrow="HousePoints account controls"
      title="Delete your account"
      intro="You can request deletion from the HousePoints mobile app or contact support if you can no longer sign in."
    >
      <section>
        <h2>Request deletion in the app</h2>
        <ol className="mt-4">
          <li>Sign in to HousePoints.</li>
          <li>Open the Profile tab.</li>
          <li>Select <strong>Delete account</strong> and confirm the request.</li>
        </ol>
        <p className="mt-4">
          If you are the last owner of an organization, transfer ownership to
          another member before requesting deletion.
        </p>
      </section>

      <section>
        <h2>Request deletion without the app</h2>
        <p className="mt-4">
          Email <a href={`mailto:${supportEmail}?subject=${requestSubject}`}>{supportEmail}</a> from
          the address associated with your HousePoints account. Include
          “HousePoints account deletion request” in the subject. Do not send a
          password or authentication code.
        </p>
      </section>

      <section>
        <h2>What happens to your data</h2>
        <p className="mt-4">
          Your HousePoints access, authentication identity, email address,
          display name, memberships, and notification registrations will be
          removed during processing. Historical point and audit records may be
          retained in anonymized form when needed for organization records,
          security, dispute resolution, or legal compliance. Backups expire on
          their normal retention schedule.
        </p>
      </section>

      <section>
        <h2>Processing</h2>
        <p className="mt-4">
          We may verify that the request belongs to you. We aim to complete
          verified requests within 30 days and will contact you if additional
          time or information is required.
        </p>
      </section>
    </PublicInfoPage>
  );
}
