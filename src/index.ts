import { atomToRss } from "./convert";

export interface Env {
  CACHE_TTL_SECONDS?: string;
}

const HELP = `atom2rss — GitHub Atom feed to RSS 2.0 converter

Usage:
  /<path of a github.com atom feed>

Examples:
  /cloudflare/workers-sdk/releases.atom
  /cloudflare/workers-sdk/commits/main.atom
  /cloudflare/workers-sdk/tags.atom
  /torvalds.atom                      (user activity)

The worker fetches https://github.com<path>, converts the Atom feed to
RSS 2.0 and serves it with Content-Type: application/rss+xml, so it can be
consumed by readers that only support RSS (e.g. the Microsoft Teams RSS app).

Query strings are passed through to GitHub (e.g. private feed tokens).
`;

function errorResponse(status: number, message: string): Response {
  return new Response(message + "\n", {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return errorResponse(405, "Method not allowed");
    }

    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/help") {
      return new Response(HELP, {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    if (url.pathname === "/favicon.ico" || url.pathname === "/robots.txt") {
      return errorResponse(404, "Not found");
    }

    // オープンプロキシ化を防ぐため、取得先は github.com のパスに固定する
    if (!url.pathname.endsWith(".atom")) {
      return errorResponse(400, "Path must be a GitHub Atom feed path ending in .atom");
    }
    const target = new URL(`https://github.com${url.pathname}${url.search}`);

    const ttl = Math.max(60, Number(env.CACHE_TTL_SECONDS) || 300);
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) {
      return cached;
    }

    let upstream: Response;
    try {
      upstream = await fetch(target.toString(), {
        headers: {
          "user-agent": "atom2rss (+https://github.com/entoten/atom2rss)",
          accept: "application/atom+xml, application/xml, text/xml",
        },
        redirect: "follow",
      });
    } catch (err) {
      return errorResponse(502, `Failed to fetch ${target}: ${String(err)}`);
    }

    if (!upstream.ok) {
      return errorResponse(
        upstream.status === 404 ? 404 : 502,
        `GitHub returned ${upstream.status} for ${target}`,
      );
    }

    let rss: string;
    try {
      rss = atomToRss(await upstream.text());
    } catch (err) {
      return errorResponse(502, `Failed to convert feed: ${String(err)}`);
    }

    const response = new Response(rss, {
      headers: {
        "content-type": "application/rss+xml; charset=utf-8",
        "cache-control": `public, max-age=${ttl}`,
      },
    });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
} satisfies ExportedHandler<Env>;
