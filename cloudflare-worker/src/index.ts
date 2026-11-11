import { route, type WorkerEnv } from "./api";

function corsHeaders(origin: string | null): Record<string, string> {
  // Cho phép GitHub Pages và các domain phát triển cục bộ
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, OAI-Sites-Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const origin = request.headers.get("Origin");

    // Xử lý preflight OPTIONS request của trình duyệt (CORS)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    const path = new URL(request.url).pathname;
    if (!path.startsWith("/api/v1/")) {
      return Response.json(
        { error: "route not found" },
        { status: 404, headers: corsHeaders(origin) }
      );
    }

    try {
      const response = await route(request, env);
      const newHeaders = new Headers(response.headers);
      const cors = corsHeaders(origin);
      for (const [key, value] of Object.entries(cors)) {
        newHeaders.set(key, value);
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (error) {
      console.error(error);
      return Response.json(
        { error: "internal error" },
        { status: 500, headers: corsHeaders(origin) }
      );
    }
  },
};
