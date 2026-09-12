import { LandingView } from "@/components/landing-view";
import { getWebEnv } from "@/lib/web-env";
import { INVITE_PERMISSIONS } from "@/lib/invite";

export default function Page() {
  const web = getWebEnv();
  const invite = web.clientId
    ? `https://discord.com/oauth2/authorize?client_id=${web.clientId}&scope=bot+applications.commands&permissions=${INVITE_PERMISSIONS}`
    : "/dashboard";
  return <LandingView inviteUrl={invite} />;
}
