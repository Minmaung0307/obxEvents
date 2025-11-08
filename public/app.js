// ==== CONFIG ====
const API_URL = "/events.json";
const DAY_MS = 24 * 60 * 60 * 1000;

// ==== STATE ====
let RAW_EVENTS = [];
let EVENTS = [];

// ==== HELPERS ====
function parseISO(d) {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

// auto compute next occurrence & status
function normalizeEvent(ev, now = new Date()) {
  const base = parseISO(ev.isoDate);
  const recurring = !!ev.recurring;
  let nextDate = null;
  let status = "unknown";
  let statusLabel = "Unknown";
  let statusKind = "unknown";

  if (!base) {
    return { ...ev, recurring, nextDate, status, statusLabel, statusKind };
  }

  const sevenDays = 7 * DAY_MS;

  if (!recurring) {
    const diff = base.getTime() - now.getTime();
    if (diff < -sevenDays) {
      status = "past";
      statusLabel = "Past event";
      statusKind = "past";
    } else if (Math.abs(diff) <= sevenDays) {
      status = "now";
      statusLabel = "Happening now / this week";
      statusKind = "now";
    } else {
      status = "upcoming";
      statusLabel = "Upcoming (confirmed date)";
      statusKind = "upcoming";
    }
    nextDate = base;
  } else {
    // annual-style recurring
    let y = now.getFullYear();
    let candidate = new Date(base);
    candidate.setFullYear(y);

    // လက်ရှိနှစ်ထဲကရက်က လွန်သွားရင် နောက်နှစ်ကိုရွေ့
    if (candidate.getTime() < now.getTime() - sevenDays) {
      candidate.setFullYear(y + 1);
    }

    nextDate = candidate;
    const diff = candidate.getTime() - now.getTime();

    if (Math.abs(diff) <= sevenDays) {
      status = "now";
      statusLabel = "This week (annual; confirm on official site)";
      statusKind = "now";
    } else if (diff > sevenDays && diff <= 90 * DAY_MS) {
      status = "upcoming";
      statusLabel = "Upcoming (annual; confirm on official site)";
      statusKind = "upcoming";
    } else if (diff > 90 * DAY_MS) {
      status = "future";
      statusLabel = "Future (annual; date estimated)";
      statusKind = "future";
    } else {
      status = "past";
      statusLabel = "Past (no upcoming date)";
      statusKind = "past";
    }
  }

  // Next date label
  let nextDateLabel = ev.dateLabel || "";
  if (nextDate && recurring) {
    const mo = nextDate.toLocaleString("en-US", { month: "long" });
    const d = nextDate.getDate();
    const y = nextDate.getFullYear();
    nextDateLabel = `${mo} ${d}, ${y} (est.)`;
  } else if (nextDate && !recurring) {
    const mo = nextDate.toLocaleString("en-US", { month: "long" });
    const d = nextDate.getDate();
    const y = nextDate.getFullYear();
    nextDateLabel = `${mo} ${d}, ${y}`;
  }

  return {
    ...ev,
    recurring,
    nextDate,
    nextDateLabel,
    status,
    statusLabel,
    statusKind
  };
}

// ==== FETCH & INIT ====
async function fetchEvents() {
  try {
    const res = await fetch(API_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load events.json");
    const data = await res.json();
    RAW_EVENTS = Array.isArray(data.events) ? data.events : [];
    const now = new Date();
    EVENTS = RAW_EVENTS.map(ev => normalizeEvent(ev, now));

    // sort by nextDate (or isoDate fallback)
    EVENTS.sort((a, b) => {
      const da = a.nextDate || parseISO(a.isoDate) || new Date(0);
      const db = b.nextDate || parseISO(b.isoDate) || new Date(0);
      return da - db;
    });

    renderEvents();
  } catch (err) {
    console.error("Event API error", err);
    const wrap = document.getElementById("events");
    if (wrap) {
      wrap.innerHTML = `<div class="card"><div class="card-body">Failed to load events.</div></div>`;
    }
  }
}

// ==== RENDER ====
// random fallback images (no local /img required)
const FALLBACK_IMAGES = [
  "https://images.pexels.com/photos/2404370/pexels-photo-2404370.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "https://images.pexels.com/photos/1761419/pexels-photo-1761419.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "https://images.pexels.com/photos/248797/pexels-photo-248797.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "https://images.pexels.com/photos/226424/pexels-photo-226424.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "https://images.pexels.com/photos/2908175/pexels-photo-2908175.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "https://images.pexels.com/photos/1047442/pexels-photo-1047442.jpeg?auto=compress&cs=tinysrgb&w=1200"
];

// ==== TOURIST PLACES ====
// static featured spots (non-events)
const PLACES = [
  {
    name: "Jockey's Ridge State Park",
    town: "Nags Head",
    category: "Nature / Sunset",
    snippet: "Home to the tallest natural sand dunes on the East Coast. Ideal for sunset views, kite flying, and hang gliding.",
    image: "https://images.pexels.com/photos/2908175/pexels-photo-2908175.jpeg",
    url: "https://www.ncparks.gov/state-parks/jockeys-ridge-state-park",
    tags: ["sunset", "sand dunes", "views"]
  },
  {
    name: "Wright Brothers National Memorial",
    town: "Kill Devil Hills",
    category: "History / Museum",
    snippet: "Iconic site of the first powered flight with museum, markers, and panoramic views.",
    image: "https://images.pexels.com/photos/1647160/pexels-photo-1647160.jpeg",
    url: "https://www.nps.gov/wrbr/index.htm",
    tags: ["history", "family", "museum"]
  },
  {
    name: "Jennette’s Pier",
    town: "Nags Head",
    category: "Pier / Family",
    snippet: "Fishing pier with aquarium exhibits, ocean views, and family-friendly experiences.",
    image: "https://images.pexels.com/photos/248797/pexels-photo-248797.jpeg",
    url: "https://www.jennettespier.net/",
    tags: ["pier", "family", "ocean"]
  },
  {
    name: "Roanoke Island Festival Park",
    town: "Manteo",
    category: "History / Waterfront",
    snippet: "Interactive history site with boardwalks, historic ship, and outdoor performances.",
    image: "https://images.pexels.com/photos/1761419/pexels-photo-1761419.jpeg",
    url: "https://www.roanokeisland.com/",
    tags: ["history", "kids", "scenic"]
  },
  {
    name: "Kitty Hawk Woods Coastal Reserve",
    town: "Kitty Hawk",
    category: "Nature / Trails",
    snippet: "Peaceful maritime forest with trails for walking, birding, and kayaking.",
    image: "https://images.pexels.com/photos/2404370/pexels-photo-2404370.jpeg",
    url: "https://www.nccoastalreserve.net",
    tags: ["nature", "trails", "quiet"]
  },
  {
    name: "Downtown Manteo Waterfront",
    town: "Manteo",
    category: "Shops / Harbor",
    snippet: "Charming harbor town with cafés, boutiques, boardwalk, and sunset views.",
    image: "https://images.pexels.com/photos/731928/pexels-photo-731928.jpeg",
    url: "https://www.outerbanks.org/places-to-go/roanoke-island-manteo/",
    tags: ["shops", "waterfront", "dining"]
  }
];

function pickFallback(title = "") {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_IMAGES[hash % FALLBACK_IMAGES.length];
}
function safeImage(url) {
  if (!url) return "";

  // Pexels images: param မပါသေးရင်သာ optimize params ပေါင်းမယ်
  if (url.includes("images.pexels.com")) {
    if (!url.includes("auto=compress")) {
      url += (url.includes("?") ? "&" : "?") +
        "auto=compress&cs=tinysrgb&w=1200&h=800";
    }
  }

  return url;
}
function eventCard(ev) {
  let img = ev.image || ev.img || ev.cover || ev.imageUrl || "";
  if (!img) {
    img = pickFallback(ev.title || ev.town || "obx");
  }

  const townLabel = (ev.town || ev.area || "").trim() || "Outer Banks";

  const badgeClass = {
    past: "badge badge-past",
    now: "badge badge-now",
    upcoming: "badge badge-upcoming",
    future: "badge badge-future",
    unknown: "badge badge-unknown"
  }[ev.status] || "badge badge-unknown";

  // short status text
  const statusShort = (() => {
    if (ev.recurring) {
      if (ev.status === "now") return "Annual · This week";
      if (ev.status === "upcoming") return "Annual · Upcoming";
      if (ev.status === "future") return "Annual · Future";
      if (ev.status === "past") return "Annual · Past";
      return "Annual";
    } else {
      if (ev.status === "now") return "This week";
      if (ev.status === "upcoming") return "Upcoming";
      if (ev.status === "future") return "Future";
      if (ev.status === "past") return "Past";
      return "Event";
    }
  })();

  return `
    <article class="card">
      <div class="card-hero has-img"
           style="background-image:url('${safeImage(img)}')"></div>

      <!-- ✅ Badge directly under image -->
      <div class="card-badge-row">
        <span class="${badgeClass}" title="${ev.statusLabel || ""}">
          ${statusShort}
        </span>
      </div>

      <div class="card-header">
        <div class="card-title-wrap">
          <h3 class="card-title">
            ${ev.title}
            <span class="card-location-inline">
              · <i class="ri-map-pin-line"></i>
              ${townLabel}${ev.venue ? " • " + ev.venue : ""}
            </span>
          </h3>
        </div>
      </div>

      <div class="card-body">
        ${
          ev.nextDateLabel
            ? `<div class="row"><strong>Date:</strong> ${ev.nextDateLabel}</div>`
            : ev.dateLabel
            ? `<div class="row"><strong>Date:</strong> ${ev.dateLabel}</div>`
            : ""
        }
        ${ev.address ? `<div class="row"><strong>Address:</strong> ${ev.address}</div>` : ""}
        ${ev.snippet ? `<div class="snippet">${ev.snippet}</div>` : ""}
        ${
          Array.isArray(ev.tags) && ev.tags.length
            ? `<div class="tags">
                 ${ev.tags.map(t => `<span class="tag">#${t}</span>`).join("")}
               </div>`
            : ""
        }
      </div>

      <!-- ✅ Sticks to bottom (see CSS) -->
      <div class="card-actions">
        ${
          ev.url
            ? `<a class="btn-link" href="${ev.url}" target="_blank" rel="noopener">
                 Official site <i class="ri-external-link-line"></i>
               </a>`
            : `<span class="btn-link secondary">
                 Check local listings
               </span>`
        }
      </div>
    </article>
  `;
}

function placeCard(p) {
  const img = safeImage(p.image || "");
  const town = p.town || "Outer Banks";

  return `
    <article class="card place-card">
      <div class="card-hero has-img"
           style="background-image:url('${img}')"></div>

      <div class="card-badge-row">
        <span class="badge badge-place">
          Top spot
        </span>
      </div>

      <div class="card-header">
        <div class="card-title-wrap">
          <h3 class="card-title">
            ${p.name}
            <span class="card-location-inline">
              · <i class="ri-map-pin-line"></i> ${town}
            </span>
          </h3>
        </div>
      </div>

      <div class="card-body">
        ${p.category ? `<div class="row"><strong>Type:</strong> ${p.category}</div>` : ""}
        ${p.snippet ? `<div class="snippet">${p.snippet}</div>` : ""}
        ${
          Array.isArray(p.tags) && p.tags.length
            ? `<div class="tags">
                 ${p.tags.map(t => `<span class="tag">#${t}</span>`).join("")}
               </div>`
            : ""
        }
      </div>

      <div class="card-actions">
        ${
          p.url
            ? `<a class="btn-link" href="${p.url}" target="_blank" rel="noopener">
                 More details <i class="ri-external-link-line"></i>
               </a>`
            : `<span class="btn-link secondary">Explore this area</span>`
        }
      </div>
    </article>
  `;
}

function getFilters() {
  const locSel = document.getElementById("locationSelect");
  const searchEl = document.getElementById("searchInput");
  const statusSel = document.getElementById("statusFilter");

  return {
    loc: (locSel?.value || "all").toLowerCase(),
    q: (searchEl?.value || "").toLowerCase().trim(),
    status: (statusSel?.value || "all").toLowerCase()
  };
}

function renderEvents() {
  const { loc, q, status } = getFilters();

  const list = EVENTS.filter(ev => {
    const town = (ev.town || ev.area || "").toLowerCase();
    if (loc !== "all" && town !== loc) return false;

    if (status !== "all" && ev.status !== status) return false;

    if (q) {
      const hay = [
        ev.title,
        ev.town,
        ev.area,
        ev.venue,
        ev.address,
        ev.dateLabel,
        ev.nextDateLabel,
        ev.snippet,
        ...(ev.tags || [])
      ].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const wrap = document.getElementById("events");
  if (!wrap) return;
  wrap.innerHTML = "";

  if (!list.length) {
    wrap.innerHTML = `
      <div class="card">
        <div class="card-body">
          No events found. Try a different filter or keyword.
        </div>
      </div>`;
  } else {
    list.forEach(ev => {
      wrap.insertAdjacentHTML("beforeend", eventCard(ev));
    });
  }

  const ec = document.getElementById("eventCount");
  if (ec) {
    ec.textContent = `${list.length} event${list.length !== 1 ? "s" : ""}`;
  }

  // ✅ render tourist places with the same filters (location + search only)
  renderPlaces(loc, q);
}

function renderPlaces(loc, q) {
  const host = document.getElementById("places");
  if (!host) return;

  const list = PLACES.filter(p => {
    const town = (p.town || "").toLowerCase();

    if (loc !== "all" && town !== loc) return false;

    if (q) {
      const hay = [
        p.name,
        p.town,
        p.category,
        p.snippet,
        ...(p.tags || [])
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });

  host.innerHTML = "";

  if (!list.length) {
    host.innerHTML = `
      <div class="card">
        <div class="card-body">
          No featured places for this filter. Try another location or keyword.
        </div>
      </div>`;
    return;
  }

  list.forEach(p => {
    host.insertAdjacentHTML("beforeend", placeCard(p));
  });
}

// ==== INIT LISTENERS ====
document.addEventListener("DOMContentLoaded", () => {
  fetchEvents();
  const searchEl = document.getElementById("searchInput");
  if (searchEl) searchEl.addEventListener("input", renderEvents);
  const locSel = document.getElementById("locationSelect");
  if (locSel) locSel.addEventListener("change", renderEvents);
  const statusSel = document.getElementById("statusFilter");
  if (statusSel) statusSel.addEventListener("change", renderEvents);
});