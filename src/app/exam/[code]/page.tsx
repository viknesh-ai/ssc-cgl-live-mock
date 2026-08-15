"use client";

import { use } from "react";
import { AttemptLoader } from "@/components/exam/attempt-loader";
import { api } from "@/lib/api-client";
import type { AttemptState } from "@/lib/types";

/** An invigilated paper inside an examiner's room. */
export default function ExamPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const roomCode = code.toUpperCase();

  return (
    <AttemptLoader
      roomCode={roomCode}
      signInPrompt={`Sign in with Google to join room ${roomCode}. Your name is shown to the examiner.`}
      load={async () => {
        const { state } = await api<{ state: AttemptState }>(`/api/rooms/${roomCode}/join`, {
          method: "POST",
        });
        return state;
      }}
    />
  );
}
