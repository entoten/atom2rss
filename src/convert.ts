import { XMLParser } from "fast-xml-parser";

interface AtomLink {
  rel?: string;
  type?: string;
  href?: string;
}

interface AtomEntry {
  id?: string;
  title?: unknown;
  link?: AtomLink | AtomLink[];
  updated?: string;
  published?: string;
  content?: unknown;
  summary?: unknown;
  author?: { name?: string; email?: string } | { name?: string; email?: string }[];
  category?: { term?: string } | { term?: string }[];
}

interface AtomFeed {
  id?: string;
  title?: unknown;
  subtitle?: unknown;
  updated?: string;
  link?: AtomLink | AtomLink[];
  author?: { name?: string } | { name?: string }[];
  entry?: AtomEntry | AtomEntry[];
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

// fast-xml-parser は <title type="html">x</title> を { "#text": "x", type: "html" } に、
// 属性なしなら文字列にする。どちらでもテキストを取り出せるようにする。
function text(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object" && "#text" in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>)["#text"] ?? "");
  }
  return "";
}

function alternateHref(link: AtomLink | AtomLink[] | undefined): string {
  const links = asArray(link);
  const alternate = links.find((l) => !l.rel || l.rel === "alternate");
  return alternate?.href ?? links[0]?.href ?? "";
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cdata(value: string): string {
  // CDATA 内に "]]>" があるとセクションが壊れるので分割する
  return `<![CDATA[${value.replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;
}

// RSS 2.0 の日付は RFC 822 形式
function rfc822(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toUTCString();
}

export function atomToRss(atomXml: string): string {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    removeNSPrefix: true,
    // GitHub のフィードは &lt; などの定義済みエンティティを大量に含むため、
    // 既定の展開回数上限 (1000) では実フィードで失敗する。件数・サイズ上限のみ
    // 緩め、再帰展開の深さ制限は既定のまま残す(billion laughs 対策)。
    processEntities: {
      enabled: true,
      maxTotalExpansions: 1_000_000,
      maxExpandedLength: 20_000_000,
    },
  });
  const parsed = parser.parse(atomXml) as { feed?: AtomFeed };
  const feed = parsed.feed;
  if (!feed) {
    throw new Error("Not an Atom feed: <feed> element not found");
  }

  const channelTitle = text(feed.title) || "Untitled feed";
  const channelLink = alternateHref(feed.link) || "https://github.com/";
  const channelDescription = text(feed.subtitle) || channelTitle;
  const lastBuildDate = rfc822(feed.updated);

  const items = asArray(feed.entry)
    .map((entry) => {
      const title = text(entry.title) || "(no title)";
      const link = alternateHref(entry.link);
      const guid = entry.id ?? link;
      const pubDate = rfc822(entry.published ?? entry.updated);
      const description = text(entry.content) || text(entry.summary);
      const author = asArray(entry.author)
        .map((a) => a.name)
        .filter(Boolean)
        .join(", ");
      const categories = asArray(entry.category)
        .map((c) => c.term)
        .filter((term): term is string => Boolean(term));

      const parts = [
        `      <title>${escapeXml(title)}</title>`,
        link ? `      <link>${escapeXml(link)}</link>` : "",
        guid ? `      <guid isPermaLink="false">${escapeXml(String(guid))}</guid>` : "",
        pubDate ? `      <pubDate>${pubDate}</pubDate>` : "",
        description ? `      <description>${cdata(description)}</description>` : "",
        author ? `      <dc:creator>${escapeXml(author)}</dc:creator>` : "",
        ...categories.map((c) => `      <category>${escapeXml(c)}</category>`),
      ].filter(Boolean);

      return `    <item>\n${parts.join("\n")}\n    </item>`;
    })
    .join("\n");

  const channelParts = [
    `    <title>${escapeXml(channelTitle)}</title>`,
    `    <link>${escapeXml(channelLink)}</link>`,
    `    <description>${escapeXml(channelDescription)}</description>`,
    lastBuildDate ? `    <lastBuildDate>${lastBuildDate}</lastBuildDate>` : "",
    `    <generator>arom2rss</generator>`,
    items,
  ].filter(Boolean);

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
${channelParts.join("\n")}
  </channel>
</rss>
`;
}
