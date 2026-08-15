"use client";

import { ConsoleShell } from "@/components/admin/console-shell";
import { QuestionBankManager } from "@/components/content/question-bank-manager";

export default function Page() {
  return (
    <ConsoleShell title="Question bank" description="Write, edit and organise your questions.">
      <QuestionBankManager />
    </ConsoleShell>
  );
}
