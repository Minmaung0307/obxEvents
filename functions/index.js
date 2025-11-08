// functions/index.js
import { onRequest } from "firebase-functions/v2/https";
import fetch from "node-fetch";

const clean = (txt = "") =>
  txt.replace(/\s+/g, " ").replace(/&amp;/g, "&").trim();

function parseDateLabel(label = "") {
  const direct = new Date(label);
  if (!isNaN(direct.getTime())) {
    return direct.toISOString().slice(0, 10);
  }
  return null;
}

function filterNext3Months(events) {
  const now = new Date();
  const to = new Date(now);
  to.setMonth(to.getMonth() + 3);
  return events.filter(e => {
    if (!e.isoDate) return false;
    const d = new Date(e.isoDate);
    if (isNaN(d.getTime())) return false;
    return d >= now && d <= to;
  });
}

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
  return e.town || "";
}

export const obxEvents = onRequest({ cors: true }, async (req, res) => {
  try {
    const events = [];

    // --- Source 1: outerbanks.org (demo parsing) ---
    try {
      const html = await (await fetch("https://www.outerbanks.org/events/")).text();
      const itemRe = /class="event-card"([\s\S]*?)(?:<\/article>)/g;
      let m;
      while ((m = itemRe.exec(html))) {
        const block = m[1];
        const title = clean((block.match(/event-card__title">([^<]+)/) || [])[1]);
        const href = (block.match(/href="([^"]+)"/) || [])[1];
        const dateLabel = clean((block.match(/event-card__date">([^<]+)/) || [])[1]);
        const loc = clean((block.match(/event-card__location">([^<]+)/) || [])[1]);
        if (!title) continue;
        const iso = parseDateLabel(dateLabel);

        events.push({
          source: "outerbanks.org",
          title,
          url: href
            ? (href.startsWith("http")
                ? href
                : "https://www.outerbanks.org" + href)
            : undefined,
          dateLabel,
          isoDate: iso,
          town: loc || "",
          venue: loc || "",
          tags: ["featured"]
        });
      }
    } catch (e) {
      console.warn("outerbanks.org parse error:", e.message);
    }

    // --- Source 2: outerbanksthisweek.com (demo parsing) ---
    try {
      const html = await (await fetch("https://outerbanksthisweek.com/events")).text();
      const itemRe = /class="event-item"([\s\S]*?)(?:<\/article>)/g;
      let m;
      while ((m = itemRe.exec(html))) {
        const block = m[1];
        const title = clean((block.match(/class="title">([^<]+)/) || [])[1]);
        const href = (block.match(/href="([^"]+)"/) || [])[1];
        const when = clean((block.match(/class="date">([^<]+)/) || [])[1]);
        const where = clean((block.match(/class="location">([^<]+)/) || [])[1]);
        if (!title) continue;
        const iso = parseDateLabel(when);

        let town = "";
        const lower = where.toLowerCase();
        if (lower.includes("nags head")) town = "Nags Head";
        else if (lower.includes("kill devil hills")) town = "Kill Devil Hills";
        else if (lower.includes("kitty hawk")) town = "Kitty Hawk";
        else if (lower.includes("manteo")) town = "Manteo";

        events.push({
          source: "outerbanksthisweek.com",
          title,
          url: href
            ? (href.startsWith("http")
                ? href
                : "https://outerbanksthisweek.com" + href)
            : undefined,
          dateLabel: when,
          isoDate: iso,
          town,
          venue: where,
          tags: ["community"]
        });
      }
    } catch (e) {
      console.warn("outerbanksthisweek parse error:", e.message);
    }

    // normalize + guess town
    const normalized = events.map(e => ({
      ...e,
      title: clean(e.title || ""),
      dateLabel: clean(e.dateLabel || ""),
      town: guessTown(e)
    }));

    // allowed towns only (or blank)
    const allowed = ["Nags Head", "Kill Devil Hills", "Kitty Hawk", "Manteo", ""];
    const scoped = normalized.filter(e =>
      !e.town || allowed.includes(e.town)
    );

    // de-dupe
    const seen = new Set();
    const unique = [];
    for (const e of scoped) {
      const key = `${e.title}|${e.town}|${e.dateLabel}|${e.source}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(e);
    }

    // ✅ next 3 months only
    const in3 = filterNext3Months(unique);

    res.json({
      lastUpdated: Date.now(),
      events: in3
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});