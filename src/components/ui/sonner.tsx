"use client";

import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/components/theme-provider";

type ToasterProps = React.ComponentProps<typeof Sonner>;

function Toaster({ ...props }: ToasterProps) {
  const { theme } = useTheme();
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        style: {
          background: "var(--popover)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
          backdropFilter: "blur(16px) saturate(160%)",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
