import { CommandsView } from "@/components/commands-view";
import { commandCatalog } from "@/lib/command-catalog";

export const metadata = {
  title: "Commands",
};

export default function CommandsPage() {
  return <CommandsView commands={commandCatalog} />;
}
