"use client";

import { StudioShell } from "@/components/studio/studio-shell";
import { PapersManager } from "@/components/content/papers-manager";

export default function Page() {
  return (
    <StudioShell title="Papers" description="Blueprints your candidates sit.">
      <PapersManager />
    </StudioShell>
  );
}
