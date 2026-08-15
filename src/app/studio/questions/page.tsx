"use client";

import { StudioShell } from "@/components/studio/studio-shell";
import { QuestionBankManager } from "@/components/content/question-bank-manager";

export default function Page() {
  return (
    <StudioShell title="Question bank" description="Write, edit and organise your questions.">
      <QuestionBankManager />
    </StudioShell>
  );
}
