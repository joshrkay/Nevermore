// Stand-in for deno.land/std@0.168.0/http/server.ts (blocked in this sandbox): same default port (8000).
export function serve(handler: (req: Request) => Response | Promise<Response>) {
  Deno.serve({ port: Number(Deno.env.get("FUNC_PORT") ?? 8000), hostname: "127.0.0.1" }, handler);
}
