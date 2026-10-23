import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const sessionMock = vi.hoisted(() => ({
  createSessionToken: vi.fn(() => "signed-preview-session"),
  getSession: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  createSessionToken: sessionMock.createSessionToken,
  getSession: sessionMock.getSession,
  sessionCookieName: "tartan_session",
}));

import { POST } from "@/app/api/session/route";

describe("preview name sign-in in production mode", () => {
  beforeEach(() => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("NODE_ENV", "production");
    sessionMock.createSessionToken.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("accepts a typed preview name without a real authentication provider", async () => {
    const request = new NextRequest("https://tartan-tickets.example/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Jordan Lee", role: "student" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user.name).toBe("Jordan Lee");
    expect(body.user.role).toBe("student");
    expect(response.headers.get("set-cookie")).toContain("tartan_session=");
    expect(sessionMock.createSessionToken).toHaveBeenCalledOnce();
  });
});
