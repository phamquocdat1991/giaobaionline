import { NextResponse } from "next/server";
import {
  constantTimeEqual,
  createTeacherSessionCookie,
  expiredGoogleOAuthCookie,
  getGoogleOAuthFlow,
  isGoogleAuthConfigured,
} from "@/lib/auth";

type GoogleIdClaims = {
  aud?: string | string[];
  exp?: number;
  iss?: string;
  nonce?: string;
  sub?: string;
};

type GoogleUserInfo = { email?: string; email_verified?: boolean; sub?: string };

function callbackRedirect(request: Request, error?: string) {
  const url = new URL("/", request.url);
  if (error) url.searchParams.set("auth_error", error);
  return NextResponse.redirect(url, { status: 303 });
}

function decodeIdToken(token: string): GoogleIdClaims {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("Google không trả về ID token hợp lệ.");
  const normalized = payload.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0)))) as GoogleIdClaims;
}

function clearFlowCookie(response: NextResponse) {
  const cookie = expiredGoogleOAuthCookie();
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: cookie.maxAge,
  });
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const googleError = requestUrl.searchParams.get("error");
  if (googleError) {
    const response = callbackRedirect(request, googleError === "access_denied" ? "cancelled" : "google_failed");
    clearFlowCookie(response);
    return response;
  }
  if (!isGoogleAuthConfigured()) return callbackRedirect(request, "not_configured");

  try {
    const code = requestUrl.searchParams.get("code") || "";
    const returnedState = requestUrl.searchParams.get("state") || "";
    const flow = await getGoogleOAuthFlow(request);
    if (!code || !flow || !constantTimeEqual(returnedState, flow.state)) {
      throw new Error("Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn.");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
        client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
        redirect_uri: flow.redirectUri,
        grant_type: "authorization_code",
        code_verifier: flow.verifier,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const tokens = await tokenResponse.json() as { access_token?: string; error_description?: string; id_token?: string };
    if (!tokenResponse.ok || !tokens.id_token || !tokens.access_token) {
      throw new Error(tokens.error_description || "Không đổi được mã đăng nhập Google.");
    }

    const claims = decodeIdToken(tokens.id_token);
    const clientId = process.env.GOOGLE_CLIENT_ID!.trim();
    const audienceValid = Array.isArray(claims.aud) ? claims.aud.includes(clientId) : claims.aud === clientId;
    const issuerValid = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
    if (!audienceValid || !issuerValid || claims.nonce !== flow.nonce || !claims.exp || claims.exp * 1000 <= Date.now()) {
      throw new Error("Google trả về thông tin xác thực không hợp lệ.");
    }
    const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(15_000),
    });
    const userInfo = await userInfoResponse.json() as GoogleUserInfo;
    if (!userInfoResponse.ok || !userInfo.email || userInfo.email_verified !== true || !userInfo.sub || userInfo.sub !== claims.sub) {
      throw new Error("Tài khoản Google chưa xác minh email.");
    }

    const email = userInfo.email.trim().toLowerCase();
    const sessionCookie = await createTeacherSessionCookie(email, "google");
    const response = callbackRedirect(request);
    response.cookies.set(sessionCookie.name, sessionCookie.value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionCookie.maxAge,
    });
    clearFlowCookie(response);
    return response;
  } catch (error) {
    console.error("Google OAuth callback failed", error instanceof Error ? error.message : error);
    const response = callbackRedirect(request, "google_failed");
    clearFlowCookie(response);
    return response;
  }
}
