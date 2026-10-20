/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { ShowcaseAwardKind } from "@/lib/hackathon-asprint-2026-awards";

export type MemberType = "human" | "agent";

export interface PublicMember {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  memberType: MemberType;
  bio?: string;
  location?: string;
  company?: string;
  jobTitle?: string;
  discord?: {
    username: string;
  };
  socialLinks?: {
    website?: string;
    linkedIn?: string;
    twitter?: string;
    bluesky?: string;
    github?: string;
    substack?: string;
  };
  visibility?: {
    showEmail: boolean;
    showBio: boolean;
    showLocation: boolean;
    showCompany: boolean;
    showJobTitle: boolean;
    showDiscord: boolean;
    showGithubBadge: boolean;
    showEventsAttended: boolean;
    showTalksGiven: boolean;
    showWebsite: boolean;
    showLinkedIn: boolean;
    showTwitter: boolean;
    showGithub: boolean;
    showSubstack: boolean;
    showBluesky?: boolean;
    showMemberSince: boolean;
    showOwner?: boolean;
  };
  eventsAttended?: number;
  talksGiven?: number;
  pullRequestsCount?: number;
  hackASprint2026ShowcaseBadge?: boolean;
  /** Server-synced showcase winner ribbons (see scripts/sync-hack-a-sprint-showcase-awards-to-profiles.ts). */
  hackASprint2026ShowcaseAwards?: ShowcaseAwardKind[];
  earnedBadgeIds?: string[];
  github?: {
    login: string;
    html_url: string;
  };
  createdAt?: { toDate: () => Date } | string | null;
  /**
   * Present only when the member set `visibility.showEmail`.
   * Never copied from the account record otherwise.
   */
  email?: string;
  // Agent-specific fields
  owner?: {
    displayName?: string;
    email?: string;
  };
}

/** Directory JSON stores createdAt as an ISO string. Older callers still pass a Firestore Timestamp. */
export function memberCreatedAtDate(
  createdAt: PublicMember["createdAt"]
): Date | null {
  if (!createdAt) return null;
  if (typeof createdAt === "string") {
    const date = new Date(createdAt);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof createdAt.toDate !== "function") return null;
  const date = createdAt.toDate();
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
}

export interface MemberFilters {
  hasDiscord: boolean;
  hasLinkedIn: boolean;
  hasTwitter: boolean;
  hasGithub: boolean;
  hasSubstack: boolean;
  hasWebsite: boolean;
  memberType: "all" | "human" | "agent";
}

export type SortOption = "newest" | "oldest" | "mostTalks" | "mostEvents" | "mostPRs" | "name";
