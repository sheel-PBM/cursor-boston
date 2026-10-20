/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/notify-admin/cfp/route";

const mockSendEmail = jest.fn().mockResolvedValue(undefined);
const mockGetVerifiedUser = jest.fn();
const mockUserGet = jest.fn();

jest.mock("@/lib/mailgun", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: (...args: unknown[]) => mockGetVerifiedUser(...args),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => ({
    collection: () => ({
      doc: () => ({ get: (...args: unknown[]) => mockUserGet(...args) }),
    }),
  }),
}));

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/notify-admin/cfp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  name: "Jane Doe",
  email: "jane@example.com",
  thesisTitle: "AI-Assisted Development Patterns",
  school: "MIT",
  department: "CS",
};

describe("POST /api/notify-admin/cfp", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue({
      uid: "user-1",
      email: "jane@example.com",
    });
    mockUserGet.mockResolvedValue({
      data: () => ({
        email: "jane@example.com",
        additionalEmails: [{ email: "jane.edu@university.edu", verified: true }],
      }),
    });
  });

  it("returns 401 when the caller is not signed in", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 400 for missing required fields", async () => {
    const res = await POST(makeRequest({ name: "Jane" }));
    expect(res.status).toBe(400);
  });

  it("sends the admin notice and a confirmation to an address the account owns", async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jane@example.com",
        subject: expect.stringContaining("AI-Assisted Development Patterns"),
      })
    );
  });

  it("does not mail an address the signed-in account does not own", async () => {
    const res = await POST(
      makeRequest({ ...validBody, email: "victim@example.com" })
    );
    expect(res.status).toBe(200);
    const recipients = mockSendEmail.mock.calls.map(
      (call) => (call[0] as { to?: string }).to
    );
    expect(recipients).not.toContain("victim@example.com");
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when email sending fails", async () => {
    mockSendEmail.mockRejectedValueOnce(new Error("SMTP error"));
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
  });
});
