import { FastifyRequest } from "fastify";

export function requestBaseUrl(request: FastifyRequest): string {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const forwardedHost = request.headers["x-forwarded-host"];
  const proto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : typeof forwardedProto === "string"
      ? forwardedProto.split(",")[0]?.trim()
      : request.protocol;
  const host = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : typeof forwardedHost === "string"
      ? forwardedHost.split(",")[0]?.trim()
      : request.headers.host || "127.0.0.1:4848";
  return `${proto || "http"}://${host}`;
}
