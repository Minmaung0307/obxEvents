// functions/index.js
const functions = require("firebase-functions/v2/https");
const fetch = require("node-fetch");

// helper: safe text
function clean(text = "") {
  return text
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

/**
 * Example: aggregate from public OBX event pages.
 * (You MUST respect their robots.txt and terms of use.)
 */
exports.obxEvents = functions.onRequest({ cors: true }, async (req, res) => {
  try {
    const events = [];

    // 1) Outer Banks Visitors Bureau events (listing)   [oai_citation:0‡Outer Banks](https://www.outerbanks.org/events/?utm_source=chatgpt.com)
    try {
      const html = await (await fetch("https://www.outerbanks.org/events/")).text();
      // Very light parsing: this is just a demo, real selector depends on their markup.
      const itemRegex = /class="event-card"([\s\S]*?)(?:<\/article>)/g;
      let m;
      while ((m = itemRegex.exec(html))) {
        const block = m[1];
        const title = clean((block.match(/class="event-card__title">([^<]+)/) || [])[1]);
        const url = (block.match(/href="([^"]+)"/) || [])[1];
        const date = clean((block.match(/class="event-card__date">([^<]+)/) || [])[1]);
        const loc = clean((block.match(/class="event-card__location">([^<]+)/) || [])[1]);
        if (!title) continue;
        events.push({
          source: "outerbanks.org",
          title,
          url: url ? "https://www.outerbanks.org" + url : undefined,
          dateLabel: date || "",
          town: loc || "",
          tags: ["featured"]
        });
      }
    } catch (e) {
      console.warn("outerbanks.org parse error", e.message);
    }

    // 2) OuterBanksThisWeek (snippet demo)   [oai_citation:1‡Outer Banks This Week](https://outerbanksthisweek.com/events?utm_source=chatgpt.com)
    try {
      const html = await (await fetch("https://outerbanksthisweek.com/events")).text();
      const itemRegex = /class="event-item"([\s\S]*?)(?:<\/article>)/g;
      let m;
      while ((m = itemRegex.exec(html))) {
        const block = m[1];
        const title = clean((block.match(/class="title">([^<]+)/) || [])[1]);
        const url = (block.match(/href="([^"]+)"/) || [])[1];
        const when = clean((block.match(/class="date">([^<]+)/) || [])[1]);
        const where = clean((block.match(/class="location">([^<]+)/) || [])[1]);
        if (!title) continue;

        // နေရာနာမည်ထဲက Nags Head / Kill Devil Hills / Manteo / Kitty Hawk စိစစ်
        const lower = where.toLowerCase();
        let town = "";
        if (lower.includes("nags head")) town = "Nags Head";
        else if (lower.includes("kill devil hills")) town = "Kill Devil Hills";
        else if (lower.includes("kitty hawk")) town = "Kitty Hawk";
        else if (lower.includes("manteo")) town = "Manteo";

        events.push({
          source: "outerbanksthisweek.com",
          title,
          url: url?.startsWith("http") ? url : ("https://outerbanksthisweek.com" + (url || "")),
          dateLabel: when,
          town,
          venue: where,
          tags: ["community"]
        });
      }
    } catch (e) {
      console.warn("outerbanksthisweek parse error", e.message);
    }

    // 3) Filter to our towns of interest
    const allowed = ["Nags Head", "Kill Devil Hills", "Kitty Hawk", "Manteo", ""];
    const cleaned = events
      .filter(e => !e.town || allowed.includes(e.town))
      .map(e => ({
        ...e,
        title: clean(e.title),
        dateLabel: clean(e.dateLabel || ""),
        town: e.town || guessTown(e),
      }));

    // De-dupe by (title + town + date)
    const seen = new Set();
    const unique = [];
    for (const e of cleaned) {
      const key = (e.title || "") + "|" + (e.town || "") + "|" + (e.dateLabel || "");
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(e);
    }

    res.json({
      lastUpdated: Date.now(),
      events: unique
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

function guessTown(e) {
  const txt = (
    (e.venue || "") +
    " " +
    (e.address || "") +
    " " +
    (e.snippet || "")
  ).toLowerCase();
  if (txt.includes("nags head")) return "Nags Head";
  if (txt.includes("kill devil hills")) return "Kill Devil Hills";
  if (txt.includes("kitty hawk")) return "Kitty Hawk";
  if (txt.includes("manteo")) return "Manteo";
  return "";
}