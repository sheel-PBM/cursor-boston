/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export interface PublicDisplayName {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
}

/**
 * Display names for other members. Reads the sanitized public directory
 * instead of `users/{uid}`, which also contains email addresses.
 */
export async function lookupPublicDisplayNames(
  uids: string[]
): Promise<Record<string, PublicDisplayName>> {
  const unique = [...new Set(uids.filter((uid) => typeof uid === "string" && uid.length > 0))];
  const map: Record<string, PublicDisplayName> = {};
  for (const uid of unique) {
    map[uid] = { uid, displayName: null, photoURL: null };
  }
  if (unique.length === 0) return map;

  try {
    const res = await fetch("/api/members/public");
    if (!res.ok) return map;
    const body = (await res.json()) as {
      members?: Array<{
        uid?: string;
        displayName?: string | null;
        photoURL?: string | null;
      }>;
    };
    const wanted = new Set(unique);
    for (const member of body.members ?? []) {
      if (!member?.uid || !wanted.has(member.uid)) continue;
      map[member.uid] = {
        uid: member.uid,
        displayName: typeof member.displayName === "string" ? member.displayName : null,
        photoURL: typeof member.photoURL === "string" ? member.photoURL : null,
      };
    }
  } catch {
    // Leave names blank if the directory is unavailable.
  }
  return map;
}
