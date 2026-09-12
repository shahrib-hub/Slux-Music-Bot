import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for the Slux Discord music bot and web dashboard.",
};

const updated = "September 10, 2026";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">
        Terms of <span className="text-gradient">Service</span>
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>

      <div className="glass mt-10 space-y-10 rounded-2xl p-8 leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Acceptance</h2>
          <p className="text-sm text-muted-foreground">
            By adding the Slux bot (&quot;the Bot&quot;) to a Discord server or using the Slux web
            dashboard (&quot;the Service&quot;), you agree to these Terms of Service. If you do not
            agree, please remove the Bot and stop using the Service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. What the Service provides</h2>
          <p className="text-sm text-muted-foreground">
            Slux is a free music playback bot for Discord. It plays audio from third-party sources
            (such as YouTube, SoundCloud and Spotify catalog lookups), manages playback queues, and
            offers a companion web dashboard. The Service is provided &quot;as is&quot; and &quot;as
            available&quot; without warranties of any kind.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. Fair use</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Do not use the Bot to violate Discord&apos;s Terms of Service or Community Guidelines.</li>
            <li>Do not attempt to disrupt, overload or reverse-engineer the Service.</li>
            <li>Do not use the Bot to infringe copyright — playback is for personal, non-commercial listening.</li>
            <li>Server administrators are responsible for how their members use the Bot.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Availability</h2>
          <p className="text-sm text-muted-foreground">
            We aim for continuous uptime but do not guarantee it. Features may change, and the
            Service may be updated, suspended or discontinued at any time. Music availability
            depends on third-party providers and Lavalink nodes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Termination</h2>
          <p className="text-sm text-muted-foreground">
            We may restrict or terminate access to the Service for abuse, without notice. You may
            stop using the Service at any time by removing the Bot from your server.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Liability</h2>
          <p className="text-sm text-muted-foreground">
            To the maximum extent permitted by law, the developer (&quot;SHM&quot;) is not liable
            for any indirect, incidental or consequential damages arising from the use of, or
            inability to use, the Service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">7. Changes</h2>
          <p className="text-sm text-muted-foreground">
            These terms may be updated occasionally. Continued use of the Service after changes
            constitutes acceptance of the new terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">8. Contact</h2>
          <p className="text-sm text-muted-foreground">
            Questions about these terms? Reach out on Discord ({" "}
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
