"use client";

import { StudioShell } from "@/components/studio/studio-shell";
import { ImportManager } from "@/components/content/import-manager";

export default function Page() {
  return (
    <StudioShell title="Import questions" description="Upload a paper as PDF, Word or text. The file is read, parsed and discarded — it is never stored.">
      <ImportManager />
    </StudioShell>
  );
}
