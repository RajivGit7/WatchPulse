import Parser from "rss-parser";

const parser = new Parser();

const FEEDS = [
  "https://www.animenewsnetwork.com/all/rss.xml?ann-hierarchical-critique",
  "https://collider.com/feed/",
];

export const fetchRSSNews = async () => {
  const allItems = [];

  for (const feedUrl of FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      const items = feed.items.slice(0, 20).map((item) => ({
        title: item.title,
        link: item.link,
        description: item.contentSnippet || item.content || "",
        pubDate: item.pubDate,
        source: feed.title,
      }));
      allItems.push(...items);
    } catch (error) {
      console.error(`RSS feed error (${feedUrl}):`, error.message);
    }
  }

  return allItems.sort(
    (a, b) => new Date(b.pubDate) - new Date(a.pubDate)
  );
};
