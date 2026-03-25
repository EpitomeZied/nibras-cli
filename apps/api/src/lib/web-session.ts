import { FastifyRequest } from "fastify";

const COOKIE_NAME = "nibras_web_session";

type CookieOptions = {
  maxAgeSeconds?: number;
};

function isSecureRequest(request: FastifyRequest): boolean {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : typeof forwardedProto === "string"
      ? forwardedProto.split(",")[0]?.trim()
      : request.protocol;
  return proto === "https";
}

export function webSessionCookieName(): string {
  return COOKIE_NAME;
}

export function createWebSessionCookie(
  request: FastifyRequest,
  token: string,
  options: CookieOptions = {}
): string {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax"
  ];

  if (isSecureRequest(request)) {
    parts.push("Secure");
  }
  if (typeof options.maxAgeSeconds === "number") {
    parts.push(`Max-Age=${options.maxAgeSeconds}`);
  }

  return parts.join("; ");
}

export function clearWebSessionCookie(request: FastifyRequest): string {
  return createWebSessionCookie(request, "", { maxAgeSeconds: 0 });
}
