import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export type DemoUser = {
  id: string;
  name: string;
  email: string;
  role: "student" | "officer";
  club: string | null;
  issuedAt: number;
};

const cookieName = "tartan_session";

function signature(payload: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET must be configured.");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(user: DemoUser) {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export async function getSession(): Promise<DemoUser | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;

  const [payload, providedSignature] = token.split(".");
  if (!payload || !providedSignature) return null;

  const expectedSignature = Buffer.from(signature(payload));
  const actualSignature = Buffer.from(providedSignature);
  if (expectedSignature.length !== actualSignature.length || !timingSafeEqual(expectedSignature, actualSignature)) {
    return null;
  }

  try {
    const user = JSON.parse(Buffer.from(payload, "base64url").toString()) as DemoUser;
    if (Date.now() - user.issuedAt > 8 * 60 * 60 * 1000) return null;
    return user;
  } catch {
    return null;
  }
}

export const sessionCookieName = cookieName;
