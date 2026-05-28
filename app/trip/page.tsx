"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { generateWorkspaceToken, isValidWorkspaceToken } from "@/lib/workspace-token";

const STORAGE_KEY = "samwise.trip.workspaceToken";

export default function TripBootstrap() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    let token = window.localStorage.getItem(STORAGE_KEY);
    if (!isValidWorkspaceToken(token)) {
      token = generateWorkspaceToken();
      window.localStorage.setItem(STORAGE_KEY, token);
    }
    router.replace(`/trip/${token}`);
  }, [router]);

  return (
    <main className="paper-module flex items-center justify-center min-h-dvh">
      <p className="label-eyebrow">Opening trip workspace…</p>
    </main>
  );
}
