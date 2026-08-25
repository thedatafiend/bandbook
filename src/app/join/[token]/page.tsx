import { JoinInvite } from "@/components/join-invite";

export default async function JoinByLink({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <JoinInvite inviteToken={token} />;
}
