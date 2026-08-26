import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listBandMembers, listUserBands } from "@/lib/queries";
import { SettingsView } from "@/components/settings/settings-view";

/**
 * Server Component: loads band, members, and the user's other bands in
 * parallel during render. Editing lives in the SettingsView client island.
 */
export default async function SettingsPage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect("/");
  }

  const supabase = await createClient();
  const [members, userBands] = await Promise.all([
    listBandMembers(supabase, auth.band.id),
    listUserBands(supabase, auth.userId),
  ]);

  return (
    <SettingsView
      initialBand={{
        id: auth.band.id,
        name: auth.band.name,
        invite_token: auth.band.invite_token,
      }}
      members={members ?? []}
      userBands={userBands}
    />
  );
}
