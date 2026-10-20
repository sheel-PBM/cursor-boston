/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { PublicMember } from "@/types/members";

/**
 * Fields a public directory card is allowed to show. User documents also
 * hold email, additionalEmails, and other account data. Those must never
 * ride along on a public profile read.
 */
const VISIBILITY_FLAGS = [
  "isPublic",
  "showEmail",
  "showBio",
  "showLocation",
  "showCompany",
  "showJobTitle",
  "showDiscord",
  "showGithubBadge",
  "showEventsAttended",
  "showTalksGiven",
  "showWebsite",
  "showLinkedIn",
  "showTwitter",
  "showGithub",
  "showSubstack",
  "showBluesky",
  "showMemberSince",
  "showOwner",
] as const;

const SOCIAL_LINK_KEYS = [
  "website",
  "linkedIn",
  "twitter",
  "bluesky",
  "github",
  "substack",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === "string");
  return items.length === value.length ? items : items;
}

function plainCreatedAt(value: unknown): PublicMember["createdAt"] | string | null | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.toDate === "function") {
    const date = (value.toDate as () => Date)();
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return undefined;
}

function pickVisibility(value: unknown): PublicMember["visibility"] | undefined {
  if (!isRecord(value)) return undefined;
  const out: Record<string, boolean> = {};
  for (const key of VISIBILITY_FLAGS) {
    if (typeof value[key] === "boolean") {
      out[key] = value[key];
    }
  }
  return Object.keys(out).length > 0 ? (out as PublicMember["visibility"]) : undefined;
}

function pickDiscord(value: unknown): PublicMember["discord"] | undefined {
  if (!isRecord(value)) return undefined;
  const username = asString(value.username);
  return username ? { username } : undefined;
}

function pickGithub(value: unknown): PublicMember["github"] | undefined {
  if (!isRecord(value)) return undefined;
  const login = asString(value.login);
  const htmlUrl = asString(value.html_url);
  if (!login || !htmlUrl) return undefined;
  return { login, html_url: htmlUrl };
}

function pickSocialLinks(value: unknown): PublicMember["socialLinks"] | undefined {
  if (!isRecord(value)) return undefined;
  const out: NonNullable<PublicMember["socialLinks"]> = {};
  for (const key of SOCIAL_LINK_KEYS) {
    const link = asString(value[key]);
    if (link) out[key] = link;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Project a Firestore user/agent document, or a previously stored directory
 * row, down to the public card. Email and other account fields are included
 * only when the member explicitly turned on `visibility.showEmail`.
 */
export function sanitizePublicMember(input: unknown): PublicMember | null {
  if (!isRecord(input)) return null;
  const uid = asString(input.uid);
  if (!uid) return null;

  const memberType = input.memberType === "agent" ? "agent" : "human";
  const visibility = pickVisibility(input.visibility);
  const member: PublicMember = {
    uid,
    memberType,
    displayName: asNullableString(input.displayName) ?? null,
    photoURL: asNullableString(input.photoURL) ?? null,
  };

  if (visibility) member.visibility = visibility;

  const bio = asString(input.bio);
  if (bio !== undefined) member.bio = bio;
  const location = asString(input.location);
  if (location !== undefined) member.location = location;
  const company = asString(input.company);
  if (company !== undefined) member.company = company;
  const jobTitle = asString(input.jobTitle);
  if (jobTitle !== undefined) member.jobTitle = jobTitle;

  const discord = pickDiscord(input.discord);
  if (discord) member.discord = discord;
  const github = pickGithub(input.github);
  if (github) member.github = github;
  const socialLinks = pickSocialLinks(input.socialLinks);
  if (socialLinks) member.socialLinks = socialLinks;

  const eventsAttended = asNumber(input.eventsAttended);
  if (eventsAttended !== undefined) member.eventsAttended = eventsAttended;
  const talksGiven = asNumber(input.talksGiven);
  if (talksGiven !== undefined) member.talksGiven = talksGiven;
  const pullRequestsCount = asNumber(input.pullRequestsCount);
  if (pullRequestsCount !== undefined) member.pullRequestsCount = pullRequestsCount;

  if (typeof input.hackASprint2026ShowcaseBadge === "boolean") {
    member.hackASprint2026ShowcaseBadge = input.hackASprint2026ShowcaseBadge;
  }
  const awards = asStringArray(input.hackASprint2026ShowcaseAwards);
  if (awards && awards.length > 0) {
    member.hackASprint2026ShowcaseAwards =
      awards as PublicMember["hackASprint2026ShowcaseAwards"];
  }
  const earnedBadgeIds = asStringArray(input.earnedBadgeIds);
  if (earnedBadgeIds && earnedBadgeIds.length > 0) {
    member.earnedBadgeIds = earnedBadgeIds;
  }

  const createdAt = plainCreatedAt(input.createdAt);
  if (createdAt !== undefined) {
    member.createdAt = createdAt as PublicMember["createdAt"];
  }

  if (visibility?.showEmail) {
    const email = asString(input.email);
    if (email) member.email = email;
  }

  if (memberType === "agent" && visibility?.showOwner && isRecord(input.owner)) {
    const displayName = asString(input.owner.displayName);
    if (displayName) {
      member.owner = { displayName };
      if (visibility.showEmail) {
        const email = asString(input.owner.email);
        if (email) member.owner.email = email;
      }
    }
  }

  return member;
}
