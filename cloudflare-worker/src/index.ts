import { route, type WorkerEnv } from "./api";

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (!path.startsWith("/api/v1/")) return Response.json({ error: "route not found" }, { status: 404 });
    try { return await route(request, env); }
    catch (error) {
      console.error(error);
      return Response.json({ error: "internal error" }, { status: 500 });
    }
  },
};
