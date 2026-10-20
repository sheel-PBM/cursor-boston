/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getClientIdentifier } from "@/lib/rate-limit";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";

/** Public form notifications. Tight enough to stop a mail-quota flood. */
const NOTIFY_ADMIN_LIMIT = {
  windowMs: 15 * 60 * 1000,
  maxRequests: 8,
};

export async function enforceNotifyAdminRateLimit(
  request: NextRequest,
  scope: string
): Promise<NextResponse | null> {
  const clientId = getClientIdentifier(request as unknown as Request);
  const rate = await checkUpstashRateLimit(
    `notify-admin:${scope}:${clientId}`,
    NOTIFY_ADMIN_LIMIT
  );
  if (rate.success) return null;

  const retryAfter = rate.retryAfter || 60;
  const unavailable = rate.reason === "rate_limit_unavailable";
  return NextResponse.json(
    {
      error: unavailable ? "Rate limit unavailable" : "Too many requests",
      retryAfter,
    },
    {
      status: unavailable ? 503 : 429,
      headers: { "Retry-After": String(retryAfter) },
    }
  );
}

export function ownedEmails(args: {
  tokenEmail?: string | null;
  profile?: Record<string, unknown> | null;
}): Set<string> {
  const owned = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value !== "string") return;
    const normalized = value.trim().toLowerCase();
    if (normalized.includes("@") && normalized.length <= 254) {
      owned.add(normalized);
    }
  };

  add(args.tokenEmail);
  add(args.profile?.email);

  const additional = args.profile?.additionalEmails;
  if (Array.isArray(additional)) {
    for (const entry of additional) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as { email?: unknown; verified?: unknown };
      if (record.verified === true) add(record.email);
    }
  }

  return owned;
}
