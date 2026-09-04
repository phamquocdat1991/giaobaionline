import { NextResponse } from "next/server";
import { createGoogleOAuthFlow, isGoogleAuthConfigured } from "@/lib/auth";

export async function GET(request: Request) {
  if (!isGoogleAuthConfigured()) {
    return Response.json({ error: "Đăng nhập Google chưa được cấu hình trên máy chủ." }, { status: 503 });
  }

  const { flow, challenge, cookie } = await createGoogleOAuthFlow(request);
  const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizeUrl.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    redirect_uri: flow.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: cookie.maxAge,
  });
  return response;
}
