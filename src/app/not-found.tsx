import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EqualizerBars } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <EqualizerBars bars={5} />
      <h1 className="text-7xl font-black">
        <span className="text-gradient">404</span>
      </h1>
      <p className="max-w-md text-muted-foreground">
        This track doesn&apos;t exist. Even Shazam couldn&apos;t find it.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/">Back home</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/commands">Browse commands</Link>
        </Button>
      </div>
    </div>
  );
}
