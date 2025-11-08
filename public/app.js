const API_URL = "/api/events"; // Cloud Function endpoint

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

let EVENTS = [];
let lastUpdated = null;

function eventCard(ev) {
  const hero = ev.image || "";
  const tags = (ev.tags || [])
    .map(t => `<span class="tag">#${t}</span>`)
    .join("");

  return `
    <article class="card">
      <div class="card-hero" style="${hero ? `background-image:url('${hero}')` : ""}"></div>
      <div class="card-header">
        <div class="card-icon"><i class="ri-calendar-event-line"></i></div>
        <div>
          <h3 class="card-title">${ev.title}</h3>
          <p class="card-location">
            <i class="ri-map-pin-line"></i>
            ${ev.town || ev.area || ""}${
              ev.venue ? " • " + ev.venue : ""
            }
          </p>
        </div>
      </div>
      <div class="card-body">
        ${ev.dateLabel ? `<div><strong>Date:</strong> ${ev.dateLabel}</div>` : ""}
        ${ev.timeLabel ? `<div><strong>Time:</strong> ${ev.timeLabel}</div>` : ""}
        ${ev.address ? `<div><strong>Address:</strong> ${ev.address}</div>` : ""}
        ${ev.snippet ? `<div>${ev.snippet}</div>` : ""}
        ${tags ? `<div class="tags">${tags}</div>` : ""}
      </div>
      <div class="card-actions">
        ${
          ev.url
            ? `<a class="btn-link" href="${ev.url}" target="_blank" rel="noopener">
                 Official site <i class="ri-external-link-line"></i>
               </a>`
            : `<span class="btn-link secondary">
                 <i class="ri-information-line"></i>Details onsite
               </span>`
        }
        ${
          ev.town
            ? `<span class="btn-link secondary">
                 <i class="ri-compass-3-line"></i>${ev.town}
               </span>`
            : ""
        }
      </div>
    </article>
  `;
}

function renderEvents() {
  const loc = $("#locationSelect").value;
  const q = ($("#searchInput").value || "").toLowerCase().trim();

  const filtered = EVENTS.filter(ev => {
    const matchLoc =
      loc === "all" ||
      (ev.town || ev.area || "")
        .toLowerCase() === loc.toLowerCase();

    if (!matchLoc) return false;

    if (!q) return true;

    const hay = [
      ev.title,
      ev.town,
      ev.area,
      ev.venue,
      ev.address,
      ev.dateLabel,
      ev.timeLabel,
      ev.snippet,
      ...(ev.tags || [])
    ]
      .join(" ")
      .toLowerCase();

    return hay.includes(q);
  });

  const container = $("#events");
  container.innerHTML = "";

  if (!filtered.length) {
    container.innerHTML = `
      <div class="card">
        <div class="card-body">
          No events match your filters at the moment.
          Try another location / keyword or check the official calendars below.
        </div>
      </div>`;
  } else {
    filtered
      .sort((a, b) => {
        // if they have isoDate, sort by that
        if (a.isoDate && b.isoDate) {
          return new Date(a.isoDate) - new Date(b.isoDate);
        }
        return (a.title || "").localeCompare(b.title || "");
      })
      .forEach(ev => {
        container.insertAdjacentHTML("beforeend", eventCard(ev));
      });
  }

  const ec = $("#eventCount");
  if (ec) {
    const ts = lastUpdated
      ? ` • updated ${new Date(lastUpdated).toLocaleTimeString()}`
      : "";
    ec.textContent = `${filtered.length} event${
      filtered.length !== 1 ? "s" : ""
    } showing${ts}`;
  }
}

async function fetchEvents() {
  try {
    const res = await fetch(API_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load events");
    const data = await res.json();
    EVENTS = Array.isArray(data.events) ? data.events : [];
    lastUpdated = data.lastUpdated || Date.now();
  } catch (err) {
    console.error("Event API error:", err);

    // Fallback sample (if API fails)
    EVENTS = [
      {
        title: "Wright Brothers First Flight Celebration",
        town: "Kill Devil Hills",
        venue: "Wright Brothers National Memorial",
        dateLabel: "Every Dec 17",
        timeLabel: "Daytime",
        url: "https://www.nps.gov/wrbr/index.htm",
        tags: ["annual", "history", "family"],
        image:
          "https://images.pexels.com/photos/208745/pexels-photo-208745.jpeg?auto=compress&w=900"
      }
    ];
    lastUpdated = Date.now();
  }

  renderEvents();
}

window.addEventListener("DOMContentLoaded", () => {
  $("#locationSelect")?.addEventListener("change", renderEvents);
  $("#searchInput")?.addEventListener("input", renderEvents);

  fetchEvents();

  // Optional: auto-refresh every 10 minutes
  setInterval(fetchEvents, 10 * 60 * 1000);
});