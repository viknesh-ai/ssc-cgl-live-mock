"use client";

import { Badge } from "@/components/ui";
import type { RoomView } from "@/lib/types";

export function RoomBadge({ status }: { status: RoomView["status"] }) {
  if (status === "RUNNING") return <Badge tone="ok">Running</Badge>;
  if (status === "PAUSED") return <Badge tone="warn">Paused</Badge>;
  if (status === "ENDED") return <Badge>Ended</Badge>;
  return <Badge tone="accent">Waiting</Badge>;
}
