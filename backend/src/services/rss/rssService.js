import Parser from "rss-parser";

const parser = new Parser();

const FEEDS = [
  "https://www.animenewsnetwork.com/all/rss.xml?ann-hierarchical-critique",
  "https://collider.com/feed/",
];

const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const fetchRSSNews = async () => {
  const allItems = [];
  const recentThreshold = new Date(Date.now() - RECENT_WINDOW_MS);

  for (const feedUrl of FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      const items = feed.items
        .filter((item) => {
          const pubDate = new Date(item.pubDate);
          if (isNaN(pubDate.getTime())) return true;
          return pubDate >= recentThreshold;
        })
        .slice(0, 20)
        .map((item) => ({
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
