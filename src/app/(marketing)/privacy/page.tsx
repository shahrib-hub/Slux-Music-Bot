import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for the Slux Discord music bot and web dashboard.",
};

const updated = "September 10, 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">
        Privacy <span className="text-gradient">Policy</span>
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>

      <div className="glass mt-10 space-y-10 rounded-2xl p-8 leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Overview</h2>
          <p className="text-sm text-muted-foreground">
            Slux (&quot;we&quot;, &quot;the Bot&quot;) is developed by SHM. This policy explains
            what data the Bot and its dashboard collect, why, and how long it is kept. We collect
            the minimum needed to run the Service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. What we store</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Server settings</span> — per-guild
              preferences such as prefix, language, DJ roles, default volume and autoplay (stored in
              a database).
            </li>
            <li>
              <span className="font-medium text-foreground">Playlists &amp; favorites</span> —
              playlists you create, with track entries and your Discord user ID as the owner.
            </li>
            <li>
              <span className="font-medium text-foreground">Dashboard sessions</span> — when you
              log in with Discord OAuth2, we store your user ID, username and avatar in a signed
              session cookie (never your Discord password — we never see it).
            </li>
            <li>
              <span className="font-medium text-foreground">Runtime state</span> — queues and
              player state live in memory only and are lost on restart.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. What we do NOT collect</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>No message content is read outside commands you address to the Bot.</li>
            <li>No voice audio is ever recorded or transmitted by us.</li>
            <li>No data is sold or shared with third parties for marketing.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Third-party services</h2>
          <p className="text-sm text-muted-foreground">
            The Service relies on Discord (authentication and messaging), Lavalink audio nodes
            (music resolution and streaming), and MongoDB (storage). Music metadata and audio come
            from third-party providers via those nodes. Their handling of requests is governed by
            their own policies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Data retention &amp; deletion</h2>
          <p className="text-sm text-muted-foreground">
            Server settings and playlists are kept until you delete them (commands like{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/playlist delete</code>) or
            the Bot is removed and data is purged. Want everything removed immediately? Ask in the
            support server and we will delete your data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Cookies</h2>
          <p className="text-sm text-muted-foreground">
            The dashboard uses a single httpOnly session cookie for login. We do not use tracking
            or advertising cookies. A local storage entry remembers your theme (dark/light)
            preference only.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">7. Contact</h2>
          <p className="text-sm text-muted-foreground">
            Privacy questions? Reach out on Discord ({" "}
            <span className="font-medium text-foreground">shahrib</span> —{" "}
            <a
              href="https://discord.gg/NC4YdDQj5u"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              support server
            </a>
            ) or via YouTube{" "}
            <a
              href="https://youtube.com/@Letzforge"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              @Letzforge
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
