"use client";

import { use } from "react";
import { AttemptLoader } from "@/components/exam/attempt-loader";
import { api } from "@/lib/api-client";
import type { AttemptState } from "@/lib/types";

/** A solo paper: same rules and clock, no examiner and no camera. */
export default function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <AttemptLoader
      signInPrompt="Sign in with Google to open your practice paper."
      load={async () => {
        const { state } = await api<{ state: AttemptState }>(`/api/attempts/${id}`);
        return state;
      }}
    />
  );
}
