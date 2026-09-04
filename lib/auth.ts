const SESSION_COOKIE = "eduquiz_teacher_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
export const GOOGLE_OAUTH_COOKIE = "eduquiz_google_oauth";
const GOOGLE_OAUTH_TTL_SECONDS = 10 * 60;

export type TeacherSession = {
  email: string;
  expiresAt: number;
  source: "platform" | "cookie" | "google";
};

export type GoogleOAuthFlow = {
  state: string;
  nonce: string;
  verifier: string;
  redirectUri: string;
  expiresAt: number;
};

function toBase64Url(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

export function getCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") || "";
  const row = header.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return row ? row.slice(name.length + 1) : "";
}

function sessionSecret() {
  return process.env.SESSION_SECRET || process.env.TEACHER_ACCESS_CODE || "";
}

function randomBase64Url(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

export function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export function isTeacherAuthConfigured() {
  return Boolean(process.env.TEACHER_ACCESS_CODE && process.env.TEACHER_ACCESS_CODE.length >= 8 && sessionSecret().length >= 8);
}

export function isGoogleAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim()
      && process.env.GOOGLE_CLIENT_SECRET?.trim()
      && process.env.SESSION_SECRET
      && process.env.SESSION_SECRET.length >= 32,
  );
}

export async function verifyTeacherAccessCode(value: string) {
  if (!isTeacherAuthConfigured()) return false;
  const [provided, expected] = await Promise.all([sign(`access:${value}`), sign(`access:${process.env.TEACHER_ACCESS_CODE}`)]);
  return constantTimeEqual(provided, expected);
}

export async function createTeacherSessionCookie(email: string, source: "cookie" | "google" = "cookie") {
  const payload = toBase64Url(JSON.stringify({ email, source, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 }));
  const signature = await sign(payload);
  return {
    name: SESSION_COOKIE,
    value: `${payload}.${signature}`,
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function googleRedirectUri(request: Request) {
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (configured) return configured;
  return `${new URL(request.url).origin}/api/auth/google/callback`;
}

export async function createGoogleOAuthFlow(request: Request) {
  const verifier = randomBase64Url(48);
  const challengeBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const flow: GoogleOAuthFlow = {
    state: randomBase64Url(),
    nonce: randomBase64Url(),
    verifier,
    redirectUri: googleRedirectUri(request),
    expiresAt: Date.now() + GOOGLE_OAUTH_TTL_SECONDS * 1000,
  };
  const payload = toBase64Url(JSON.stringify(flow));
  const signature = await sign(`google:${payload}`);
  return {
    flow,
    challenge: toBase64Url(challengeBytes),
    cookie: { name: GOOGLE_OAUTH_COOKIE, value: `${payload}.${signature}`, maxAge: GOOGLE_OAUTH_TTL_SECONDS },
  };
}

export async function getGoogleOAuthFlow(request: Request): Promise<GoogleOAuthFlow | null> {
  const token = getCookie(request, GOOGLE_OAUTH_COOKIE);
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !constantTimeEqual(await sign(`google:${payload}`), signature)) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as Partial<GoogleOAuthFlow>;
    if (!parsed.state || !parsed.nonce || !parsed.verifier || !parsed.redirectUri || !parsed.expiresAt || parsed.expiresAt <= Date.now()) return null;
    return parsed as GoogleOAuthFlow;
  } catch {
    return null;
  }
}

export function expiredGoogleOAuthCookie() {
  return { name: GOOGLE_OAUTH_COOKIE, value: "", maxAge: 0 };
}

export function expiredTeacherSessionCookie() {
  return { name: SESSION_COOKIE, value: "", maxAge: 0 };
}

export async function getTeacherSession(request: Request): Promise<TeacherSession | null> {
  const platformEmail = request.headers.get("oai-authenticated-user-email")?.trim();
  // Sites strips user-supplied identity headers before adding its verified value.
  // On Vercel this header is user-controlled, so only the signed cookie may authenticate.
  if (!process.env.VERCEL && platformEmail) {
    return { email: platformEmail, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000, source: "platform" };
  }
  if (process.env.NODE_ENV !== "production" && process.env.EDUQUIZ_TEST_MODE === "1") {
    return { email: "qa@eduquiz.local", expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000, source: "platform" };
  }
  if (!isTeacherAuthConfigured() && !isGoogleAuthConfigured()) return null;

  const token = getCookie(request, SESSION_COOKIE);
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !constantTimeEqual(await sign(payload), signature)) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as { email?: string; expiresAt?: number; source?: "cookie" | "google" };
    if (!parsed.email || !parsed.expiresAt || parsed.expiresAt <= Date.now()) return null;
    return { email: parsed.email, expiresAt: parsed.expiresAt, source: parsed.source === "google" ? "google" : "cookie" };
  } catch {
    return null;
  }
}

export async function requireTeacher(request: Request) {
  return getTeacherSession(request);
}

export function unauthorizedResponse() {
  return Response.json({ error: "Phiên giáo viên đã hết hạn. Vui lòng đăng nhập lại." }, { status: 401 });
}
