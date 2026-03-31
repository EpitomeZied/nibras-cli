import http, { IncomingMessage, Server, ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import httpProxy from "http-proxy";

export type ProxyConfig = {
  host: string;
  port: number;
  apiOrigin: string;
  webOrigin: string;
};

function loadConfig(): ProxyConfig {
  return {
    host: process.env.NIBRAS_PROXY_HOST || "127.0.0.1",
    port: Number(process.env.NIBRAS_PROXY_PORT || "8080"),
    apiOrigin: process.env.NIBRAS_LOCAL_API_ORIGIN || "http://127.0.0.1:4848",
    webOrigin: process.env.NIBRAS_LOCAL_WEB_ORIGIN || "http://127.0.0.1:3000"
  };
}

function isApiRequest(url = "/"): boolean {
  return url === "/v1" || url.startsWith("/v1/") || url === "/dev" || url.startsWith("/dev/");
}

function pickTarget(url: string | undefined, config: ProxyConfig): string {
  return isApiRequest(url) ? config.apiOrigin : config.webOrigin;
}

function isServerResponse(value: unknown): value is ServerResponse<IncomingMessage> {
  return value !== null && typeof value === "object" && "writeHead" in value && "end" in value;
}

export function buildProxyServer(config: Partial<ProxyConfig> = {}): Server {
  const resolved = { ...loadConfig(), ...config };
  const proxy = httpProxy.createProxyServer({
    changeOrigin: true,
    ws: true,
    xfwd: true
  });

  proxy.on("error", (error, _request, response) => {
    if (!isServerResponse(response) || response.headersSent) {
      return;
    }
    response.writeHead(502, { "content-type": "application/json" });
    response.end(JSON.stringify({
      error: `Proxy request failed: ${error.message}`
    }));
  });

  const server = http.createServer((request, response) => {
    proxy.web(request, response, {
      target: pickTarget(request.url, resolved)
    });
  });

  server.on("upgrade", (request, socket, head) => {
    proxy.ws(request, socket, head, {
      target: pickTarget(request.url, resolved)
    });
  });

  return server;
}

async function startServer(): Promise<void> {
  const config = loadConfig();
  const server = buildProxyServer(config);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => resolve());
  });
  const address = server.address() as AddressInfo | null;
  const boundHost = address?.address || config.host;
  const boundPort = address?.port || config.port;
  console.log(`Nibras proxy listening on http://${boundHost}:${boundPort}`);
  console.log(`API origin: ${config.apiOrigin}`);
  console.log(`Web origin: ${config.webOrigin}`);
}

if (require.main === module) {
  void startServer().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
