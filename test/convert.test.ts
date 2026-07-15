import { describe, expect, it } from "vitest";
import { atomToRss } from "../src/convert";

// GitHub の releases.atom を模したサンプル
const GITHUB_ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xml:lang="en-US">
  <id>tag:github.com,2008:https://github.com/cloudflare/workers-sdk/releases</id>
  <link type="text/html" rel="alternate" href="https://github.com/cloudflare/workers-sdk/releases"/>
  <link type="application/atom+xml" rel="self" href="https://github.com/cloudflare/workers-sdk/releases.atom"/>
  <title>Release notes from workers-sdk</title>
  <updated>2026-07-10T12:00:00Z</updated>
  <entry>
    <id>tag:github.com,2008:Repository/12345/wrangler@3.65.0</id>
    <updated>2026-07-10T12:00:00Z</updated>
    <link rel="alternate" type="text/html" href="https://github.com/cloudflare/workers-sdk/releases/tag/wrangler%403.65.0"/>
    <title>wrangler@3.65.0</title>
    <content type="html">&lt;p&gt;Bug fixes &amp;amp; improvements&lt;/p&gt;</content>
    <author>
      <name>workers-devprod</name>
    </author>
  </entry>
  <entry>
    <id>tag:github.com,2008:Repository/12345/wrangler@3.64.0</id>
    <updated>2026-07-01T09:30:00Z</updated>
    <link rel="alternate" type="text/html" href="https://github.com/cloudflare/workers-sdk/releases/tag/wrangler%403.64.0"/>
    <title>wrangler@3.64.0</title>
    <content type="html">&lt;p&gt;Older release&lt;/p&gt;</content>
    <author>
      <name>workers-devprod</name>
    </author>
  </entry>
</feed>`;

const SINGLE_ENTRY_ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>tag:github.com,2008:/octocat/hello-world/commits/main</id>
  <title>Recent Commits to hello-world:main</title>
  <updated>2026-07-14T00:00:00Z</updated>
  <link rel="alternate" href="https://github.com/octocat/hello-world/commits/main"/>
  <entry>
    <id>tag:github.com,2008:Grit::Commit/abcdef</id>
    <title>Fix &lt;bug&gt; in parser</title>
    <link rel="alternate" href="https://github.com/octocat/hello-world/commit/abcdef"/>
    <updated>2026-07-14T00:00:00Z</updated>
  </entry>
</feed>`;

describe("atomToRss", () => {
  it("converts a GitHub releases feed to RSS 2.0", () => {
    const rss = atomToRss(GITHUB_ATOM);

    expect(rss).toContain('<rss version="2.0"');
    expect(rss).toContain("<title>Release notes from workers-sdk</title>");
    expect(rss).toContain("<link>https://github.com/cloudflare/workers-sdk/releases</link>");
    expect(rss).toContain("<lastBuildDate>Fri, 10 Jul 2026 12:00:00 GMT</lastBuildDate>");

    // 2 件の item が両方含まれる
    expect(rss.match(/<item>/g)).toHaveLength(2);
    expect(rss).toContain("<title>wrangler@3.65.0</title>");
    expect(rss).toContain(
      "<link>https://github.com/cloudflare/workers-sdk/releases/tag/wrangler%403.65.0</link>",
    );
    expect(rss).toContain(
      '<guid isPermaLink="false">tag:github.com,2008:Repository/12345/wrangler@3.65.0</guid>',
    );
    expect(rss).toContain("<pubDate>Fri, 10 Jul 2026 12:00:00 GMT</pubDate>");
    expect(rss).toContain("<![CDATA[<p>Bug fixes &amp; improvements</p>]]>");
    expect(rss).toContain("<dc:creator>workers-devprod</dc:creator>");
  });

  it("handles a feed with a single entry (not wrapped in an array)", () => {
    const rss = atomToRss(SINGLE_ENTRY_ATOM);

    expect(rss.match(/<item>/g)).toHaveLength(1);
    expect(rss).toContain("<title>Fix &lt;bug&gt; in parser</title>");
  });

  it("handles a feed with no entries", () => {
    const rss = atomToRss(`<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Empty</title>
  <link rel="alternate" href="https://github.com/octocat"/>
  <updated>2026-07-14T00:00:00Z</updated>
</feed>`);

    expect(rss).toContain("<title>Empty</title>");
    expect(rss).not.toContain("<item>");
  });

  it("rejects non-Atom input", () => {
    expect(() => atomToRss("<html></html>")).toThrow(/feed/);
  });

  it("escapes ]]> inside CDATA content", () => {
    const rss = atomToRss(`<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>t</title>
  <updated>2026-07-14T00:00:00Z</updated>
  <entry>
    <id>x</id>
    <title>e</title>
    <updated>2026-07-14T00:00:00Z</updated>
    <content type="html">a]]&gt;b</content>
  </entry>
</feed>`);

    expect(rss).toContain("<![CDATA[a]]]]><![CDATA[>b]]>");
  });
});
