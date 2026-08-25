import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Band } from "@/lib/supabase/types";

// Public, unauthenticated: resolve an invite token to the band's public
// info so the invite page can greet invitees before they have an account.
// Exposes nothing beyond what holding the invite link already implies;
// joining still requires the band passcode.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: band } = await supabase
    .from("bands")
    .select("id, name")
    .eq("invite_token", token)
    .single<Pick<Band, "id" | "name">>();

  if (!band) {
    return NextResponse.json({ error: "Invalid invite link" }, { status: 404 });
  }

  return NextResponse.json({ band: { id: band.id, name: band.name } });
}
