"use client";

import { ConsoleShell } from "@/components/admin/console-shell";
import { PapersManager } from "@/components/content/papers-manager";

export default function Page() {
  return (
    <ConsoleShell title="Papers" description="Blueprints your candidates sit.">
      <PapersManager />
    </ConsoleShell>
  );
}
