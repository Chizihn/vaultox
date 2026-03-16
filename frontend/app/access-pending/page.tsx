import type { Metadata } from "next";
import { AccessPendingView } from "@/components/access-pending/AccessPendingView";

export const metadata: Metadata = {
  title: "Access Pending · VaultOX",
};

export default function AccessPendingPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  // status is set by LoginForm when credentialStatus !== 'verified'.
  // Default to 'unregistered' if not provided.
  const status =
    searchParams.status === "pending_kyc" ? "pending_kyc" : "unregistered";

  return <AccessPendingView status={status} />;
}
