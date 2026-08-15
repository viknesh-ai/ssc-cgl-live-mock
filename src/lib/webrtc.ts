"use client";

/**
 * Peer-connection settings for proctoring.
 *
 * STUN alone gets a direct connection through most home networks. Where it
 * cannot (symmetric NAT, restrictive corporate firewalls) the candidate falls
 * back to sending still frames over the websocket, so invigilation never goes
 * dark. Setting the NEXT_PUBLIC_TURN_* variables adds a relay and removes the
 * need for that fallback.
 */
export function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ];
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl.split(",").map((u) => u.trim()),
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  }
  return servers;
}

/** How long to wait for a peer connection before switching to snapshots. */
export const PEER_TIMEOUT_MS = 9_000;
export const SNAPSHOT_INTERVAL_MS = 1_500;
export const SNAPSHOT_WIDTH = 320;
