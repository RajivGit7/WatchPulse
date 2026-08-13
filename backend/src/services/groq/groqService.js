const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

const COOLDOWN_MS = 60 * 60 * 1000;
const MAX_EVENT_DATE_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_EVENT_DATE_FUTURE_MS = 10 * 365 * 24 * 60 * 60 * 1000;
let aiAvailable = true;
let cooldownUntil = 0;

export const isUsableEventDate = (dateStr) => {
  if (!dateStr) return false;
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return false;
  const now = Date.now();
  return (
    parsed.getTime() >= now - MAX_EVENT_DATE_AGE_MS &&
    parsed.getTime() <= now + MAX_EVENT_DATE_FUTURE_MS
  );
};

export const DATE_EVENT_TYPES = [
  "episode_released",
  "movie_released",
  "season_released",
  "release_date_announced",
  "release_date_changed",
  "release_delayed",
];

const PUBLISHED_RELEASE_TYPES = ["episode_released", "movie_released", "season_released"];

const callGroq = async (messages, maxTokens = 200) => {
  const now = Date.now();
  if (!aiAvailable && now < cooldownUntil) return null;
  if (!process.env.GROQ_API_KEY) return null;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      if (response.status === 429 || err.includes("rate") || err.includes("quota")) {
        aiAvailable = false;
        cooldownUntil = Date.now() + COOLDOWN_MS;
        console.warn("Groq rate limited, using fallback for 1 hour.");
      } else {
        console.error("Groq API error:", response.status, err.slice(0, 120));
      }
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error("Groq request error:", error.message?.slice(0, 120));
    return null;
  }
};

const FALLBACK_SUMMARIES = {
  episode_released: (d) => `Episode ${d?.episode ?? d?.new ?? ""} is now available.`,
  movie_released: (d) => `${d?.title ?? "Movie"} is now available.`,
  season_released: (d) => `Season ${d?.season ?? d?.new ?? ""} is now available.`,
  season_confirmed: () => `A new season has been officially confirmed.`,
  release_date_announced: (d) => {
    const date = d?.date ? new Date(d.date).toLocaleDateString() : "TBA";
    const ep = d?.episodeNumber ? ` Episode ${d.episodeNumber}` : "";
    return `Release date announced${ep}: ${date}.`;
  },
  release_date_changed: (d) => {
    const oldDate = d?.old ? new Date(d.old).toLocaleDateString() : "unknown";
    const newDate = d?.new ? new Date(d.new).toLocaleDateString() : "TBA";
    const ep = d?.episodeNumber ? ` Episode ${d.episodeNumber}` : "";
    return `Release date changed${ep} from ${oldDate} to ${newDate}.`;
  },
  release_delayed: (d) => {
    const ep = d?.episodeNumber ? ` Episode ${d.episodeNumber}` : "";
    return `Release delayed${ep} by ${d?.delayDays ?? "?"} days.`;
  },
  official_trailer_released: (d) => {
    if (d?.trailerTitle) return `Official trailer: ${d.trailerTitle}`;
    return "Official trailer released.";
  },
  official_teaser_released: (d) => {
    if (d?.trailerTitle) return `Official teaser: ${d.trailerTitle}`;
    return "Official teaser released.";
  },
  official_poster_released: () => "New official poster released.",
  news_article: (d) => d?.newsTitle ? `News: ${d.newsTitle}` : "New article available.",
  streaming_platform_changed: (d) => {
    const platforms = d?.new;
    if (Array.isArray(platforms) && platforms.length > 0) {
      return `Now streaming on ${platforms.join(", ")}.`;
    }
    return "Streaming availability has changed.";
  },
};

export const summarizeUpdate = async (rawUpdate) => {
  const { type, rawData, titleName } = rawUpdate;

  const text = await callGroq(
    [
      {
        role: "system",
        content:
          "You are a concise entertainment update summarizer. Write exactly 1 sentence. Be specific with dates, episode numbers, and numbers. If episodeNumber is present in the data, mention it. No markdown. No extra context.",
      },
      {
        role: "user",
        content: `Title: ${titleName || "Unknown"}\nEvent type: ${type}\nData: ${JSON.stringify(rawData)}`,
      },
    ],
    100
  );

  if (text && text.length > 5 && text.length < 300) {
    return text;
  }

  const fallback = FALLBACK_SUMMARIES[type];
  return fallback ? fallback(rawData) : "New update available.";
};

const ALLOWED_TYPES = [
  "episode_released",
  "movie_released",
  "season_released",
  "season_confirmed",
  "release_date_announced",
  "release_date_changed",
  "release_delayed",
  "official_trailer_released",
  "official_teaser_released",
  "official_poster_released",
  "streaming_platform_changed",
  "news_article",
];

export const classifyRSSEvent = async (article, titleName) => {
  const text = await callGroq(
    [
      {
        role: "system",
        content: `You are an entertainment event classifier. Analyze news articles and determine if they describe ONE of these specific events:
episode_released, movie_released, season_released, season_confirmed, release_date_announced, release_date_changed, release_delayed, official_trailer_released, official_teaser_released, official_poster_released, streaming_platform_changed, news_article.

Reply with ONLY a JSON object, no markdown, no code blocks:
{"isEvent": true/false, "eventType": "type_or_null", "eventDate": "YYYY-MM-DD_or_null", "summary": "one sentence summary or null"}

eventDate must be the date of the newly announced event only: it must be recent (within the last 3 months) or in the future. NEVER use historical dates from the article's background (e.g., a show's original release year from decades ago). If the article only mentions old/past dates, set eventDate to null. Do not report episode_released, movie_released, season_released, release_date_announced, release_date_changed, or release_delayed for historical events from years ago; classify those as "news_article".

If the article is a general news article about the title (review, interview, feature, etc.) but does NOT match one of the specific event types above, classify it as "news_article" with isEvent: true. Only return {"isEvent": false} if the article is completely unrelated.`,
      },
      {
        role: "user",
        content: `Article about "${titleName}":\nTitle: ${article.title}\nText: ${(article.description || "").slice(0, 500)}`,
      },
    ],
    200
  );

  if (!text) {
    return classifyLocally(article, titleName);
  }

  try {
    let cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (
      parsed.isEvent &&
      parsed.eventType &&
      ALLOWED_TYPES.includes(parsed.eventType)
    ) {
      let eventType = parsed.eventType;
      let eventDate =
        parsed.eventDate ||
        (PUBLISHED_RELEASE_TYPES.includes(parsed.eventType)
          ? article.pubDate
          : null) ||
        null;
      let summary = parsed.summary || null;

      if (eventDate && !isUsableEventDate(eventDate)) {
        if (DATE_EVENT_TYPES.includes(eventType)) {
          console.log(`Downgrading old-date event "${eventType}" (${eventDate}) to news_article.`);
          eventType = "news_article";
          eventDate = null;
          summary = null;
        } else {
          eventDate = null;
        }
      }

      return { isEvent: true, eventType, eventDate, summary };
    }

    return { isEvent: false };
  } catch {
    return classifyLocally(article, titleName);
  }
};

const classifyLocally = (article, titleName) => {
  const text = `${article.title} ${article.description || ""}`.toLowerCase();
  const titleLower = (titleName || "").toLowerCase();

  const IGNORE_KEYWORDS = ["merchandise", "shop", "store", "opening", "collection", "figure", "poster buy", "buy now", "sale", "discount", "coupon", "apparel", "clothing"];
  if (IGNORE_KEYWORDS.some((kw) => text.includes(kw))) {
    return { isEvent: false };
  }

  if (text.includes("delayed") || text.includes("postponed")) {
    return { isEvent: true, eventType: "release_delayed", eventDate: null, summary: null };
  }
  if (
    text.includes("release date") &&
    (text.includes("announced") || text.includes("revealed") || text.includes("set for")) &&
    (text.includes("episode") || text.includes("season") || text.includes("movie") || text.includes("series") || text.includes("film") || titleLower.split(" ").some((w) => w.length > 2 && text.includes(w)))
  ) {
    return { isEvent: true, eventType: "release_date_announced", eventDate: null, summary: null };
  }
  if (text.includes("new season") && (text.includes("confirmed") || text.includes("greenlit") || text.includes("ordered"))) {
    return { isEvent: true, eventType: "season_confirmed", eventDate: null, summary: null };
  }
  if (text.includes("trailer") && (text.includes("official") || text.includes("released") || text.includes("dropped"))) {
    return { isEvent: true, eventType: "official_trailer_released", eventDate: null, summary: null };
  }
  if (text.includes("teaser") && (text.includes("official") || text.includes("released"))) {
    return { isEvent: true, eventType: "official_teaser_released", eventDate: null, summary: null };
  }
  if (text.includes("now streaming") || text.includes("available on") || text.includes("coming to")) {
    return { isEvent: true, eventType: "streaming_platform_changed", eventDate: null, summary: null };
  }

  return { isEvent: true, eventType: "news_article", eventDate: null, summary: null };
};

export const askAI = async (question, followedTitles) => {
  const text = await callGroq(
    [
      {
        role: "system",
        content: `You are a helpful entertainment assistant. The user follows these titles: ${JSON.stringify(followedTitles)}. Answer their question based on this context. Be concise.`,
      },
      { role: "user", content: question },
    ],
    500
  );

  if (text) return text;
  if (!process.env.GROQ_API_KEY) {
    return "AI Assistant requires a GROQ API key. Please add GROQ_API_KEY to your environment variables.";
  }
  return "Sorry, I couldn't process your question right now. Please try again later.";
};

export const isAIAvailable = () => {
  if (!process.env.GROQ_API_KEY) return false;
  if (!aiAvailable && Date.now() < cooldownUntil) return false;
  return true;
};
