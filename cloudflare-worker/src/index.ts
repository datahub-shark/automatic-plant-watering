import { route, type WorkerEnv } from "./api";

// Chỉ trình duyệt từ các origin này được đọc phản hồi API.
// Thiết bị STM32/ESP32 không gửi header Origin nên không bị ảnh hưởng.
const ALLOWED_ORIGINS = new Set(["https://datahub-shark.github.io"]);
const LOCAL_DEV = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !(ALLOWED_ORIGINS.has(origin) || LOCAL_DEV.test(origin))) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const cors = corsHeaders(request.headers.get("Origin"));

    // Preflight của trình duyệt
    if (request.method === "OPTIONS") {
      return new Response(null, { status: Object.keys(cors).length ? 204 : 403, headers: cors });
    }

    const path = new URL(request.url).pathname;
    if (!path.startsWith("/api/v1/")) {
      return Response.json({ error: "route not found" }, { status: 404, headers: cors });
    }

    try {
      const response = await route(request, env);
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(cors)) headers.set(key, value);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    } catch (error) {
      console.error(error);
      return Response.json({ error: "internal error" }, { status: 500, headers: cors });
    }
  },
};
