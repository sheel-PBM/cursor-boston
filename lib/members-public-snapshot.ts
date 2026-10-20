/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Firestore } from "firebase-admin/firestore";
import type { PublicMember } from "@/types/members";
import { sanitizePublicMember } from "@/lib/public-member";

export const MEMBERS_SNAPSHOT_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours (aligned with analytics job)
const MEMBERS_SNAPSHOT_DOC = "latest";

/**
 * Full directory read — run only from snapshot rebuild (cron/CLI), not from public GET.
 * Rows are allowlisted so account fields (email, additionalEmails, provider)
 * are not stored in the public snapshot.
 */
export async function computePublicMembersSnapshot(db: Firestore): Promise<PublicMember[]> {
  const [usersSnap, agentsSnap] = await Promise.all([
    db
      .collection("users")
      .where("visibility.isPublic", "==", true)
      .orderBy("createdAt", "desc")
      .get(),
    db
      .collection("agents")
      .where("visibility.isPublic", "==", true)
      .where("status", "==", "claimed")
      .orderBy("createdAt", "desc")
      .get(),
  ]);

  const humanMembers = usersSnap.docs.flatMap((doc) => {
    const member = sanitizePublicMember({
      uid: doc.id,
      memberType: "human",
      ...(doc.data() as Record<string, unknown>),
    });
    return member ? [member] : [];
  });

  const agentMembers = agentsSnap.docs.flatMap((doc) => {
    const data = doc.data();
    const member = sanitizePublicMember({
      uid: doc.id,
      memberType: "agent",
      displayName: data.name,
      photoURL: data.avatarUrl || null,
      bio: data.description,
      visibility: {
        ...data.visibility,
        showBio: true,
        showMemberSince: true,
      },
      createdAt: data.createdAt,
      owner: data.visibility?.showOwner
        ? {
            displayName: data.ownerDisplayName,
          }
        : undefined,
    });
    return member ? [member] : [];
  });

  return [...humanMembers, ...agentMembers].sort((a, b) => {
    const ta =
      typeof a.createdAt === "string"
        ? new Date(a.createdAt).getTime()
        : a.createdAt?.toDate?.()?.getTime() || 0;
    const tb =
      typeof b.createdAt === "string"
        ? new Date(b.createdAt).getTime()
        : b.createdAt?.toDate?.()?.getTime() || 0;
    return tb - ta;
  });
}

export async function rebuildPublicMembersSnapshot(db: Firestore): Promise<PublicMember[]> {
  const members = await computePublicMembersSnapshot(db);
  await db.collection("members_snapshots").doc(MEMBERS_SNAPSHOT_DOC).set({
    members,
    expiresAt: new Date(Date.now() + MEMBERS_SNAPSHOT_CACHE_TTL_MS),
    updatedAt: new Date(),
  });
  return members;
}
