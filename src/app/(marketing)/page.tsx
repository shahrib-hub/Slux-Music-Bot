import { LandingView } from "@/components/landing-view";
import { getEnv } from "@/lib/env";
import { inviteUrl } from "@/lib/invite";

export const dynamic = "force-dynamic";

export default function Page() {
  return <LandingView inviteUrl={inviteUrl(getEnv().DISCORD_CLIENT_ID)} />;
}
