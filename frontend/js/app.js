"use strict";

// Occupancy comes from Supabase. Favorites stay on this device.
const STORAGE_KEYS = { favorites: "campus-space:favorites" };
function readStorage(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
}
function writeStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { /* Favorites remain available for this session. */ }
}
const storedFavorites = readStorage(STORAGE_KEYS.favorites, []);
const favorites = new Set(Array.isArray(storedFavorites) ? storedFavorites : []);
let spaces = [];
let loading = true;
let loadError = "";
let fetching = false;
let submitting = false;
const client = window.db || (typeof db !== "undefined" ? db : null);

/* Application state */

const state = {
    category: "All",
    view: "all",
    search: "",
    sort: "recommended",
    selectedSpaceId: null
};

/* DOM references */

const elements = {
    availableSeats: document.getElementById("available-seats"),
    spaceCount: document.getElementById("space-count"),
    campusOccupancy: document.getElementById("campus-occupancy"),

    search: document.getElementById("search-input"),
    sort: document.getElementById("sort-select"),

    resultsHeading: document.getElementById("results-heading"),
    resultsCount: document.getElementById("results-count"),
    grid: document.getElementById("spaces-grid"),
    recommendation: document.getElementById("recommendation"),

    categoryButtons: document.querySelectorAll("[data-category]"),
    viewButtons: document.querySelectorAll("[data-view]"),

    dialog: document.getElementById("space-dialog"),
    dialogCategory: document.getElementById("dialog-category"),
    dialogTitle: document.getElementById("dialog-title"),
    dialogLocation: document.getElementById("dialog-location"),
    dialogAmenities: document.getElementById("dialog-amenities"),
    dialogAvailable: document.getElementById("dialog-available"),

    closeDialog: document.getElementById("close-dialog"),
    reportForm: document.getElementById("occupancy-form"),
    occupancyInput: document.getElementById("occupancy-input"),
    reportFeedback: document.getElementById("report-feedback")
};

/* Data helpers */

function hasCurrentReport(space) {
    const timestamp = Date.parse(space.occupancy_updated_at);
    return space.is_fresh === true && Number.isInteger(space.occupied) &&
        Number.isFinite(timestamp) &&
        Date.now() < timestamp + space.stale_after_minutes * 60000;
}
function getAvailableSeats(space) {
    return hasCurrentReport(space) ? space.capacity - space.occupied : null;
}

function getOccupancyPercentage(space) {
    return hasCurrentReport(space)
        ? Math.round(space.occupied / space.capacity * 100) : null;
}

function getOccupancyStatus(space) {
    if (!hasCurrentReport(space)) {
        return { className: "unknown", label: space.occupancy_updated_at ? "Stale" : "No reports" };
    }
    const ratio = space.occupied / space.capacity;
    if (ratio >= 1) return { className: "busy", label: "Full" };
    if (ratio >= .8) return { className: "busy", label: "Busy" };
    if (ratio >= .5) return { className: "moderate", label: "Filling up" };
    return { className: "available", label: "Available" };
}

/*
 * Escape text before inserting it into an HTML template.
 * This also makes future API-supplied names safer to render.
 */
function escapeHtml(value) {
    const replacements = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    };

    return String(value).replace(
        /[&<>"']/g,
        character => replacements[character]
    );
}

function getReportLabel(space) {
    const timestamp = Date.parse(space.occupancy_updated_at);
    if (!Number.isFinite(timestamp)) return "No occupancy reports yet";
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    const age = minutes < 1 ? "just now" : minutes < 60 ? `${minutes}m ago` :
        new Date(timestamp).toLocaleString();
    return `${hasCurrentReport(space) ? "Updated" : "Stale report"} · ${age}`;
}

/* Decorative SVG illustrations */

function getArtwork(type) {
    const illustrations = {
        library: `
      <rect
        x="35" y="28" width="120" height="80"
        fill="#ffffff88"
        stroke="#6b7c67"
        stroke-width="2"
      />

      <path
        d="M35 55h120 M35 82h120"
        stroke="#6b7c67"
        stroke-width="2"
      />

      <path
        d="
          M44 35v18 M53 35v18 M63 35v18
          M76 35v18 M87 35v18 M100 35v18
          M113 35v18 M123 35v18 M139 35v18
          M44 62v18 M56 62v18 M69 62v18
          M82 62v18 M94 62v18 M108 62v18
          M121 62v18 M138 62v18
          M45 89v16 M58 89v16 M72 89v16
          M86 89v16 M99 89v16 M114 89v16
          M128 89v16 M141 89v16
        "
        stroke="#85987b"
        stroke-width="6"
      />
    `,

        room: `
      <rect
        x="26" y="22" width="138" height="82"
        fill="#ffffff66"
        stroke="#a59d87"
      />

      <rect
        x="39" y="32" width="70" height="35"
        fill="#ffffffaa"
      />

      <path
        d="M52 49h40"
        stroke="#a4b5a0"
        stroke-width="2"
      />

      <path
        d="M43 83h106v8H43z M52 91v24 M138 91v24"
        fill="#a6a58c"
        stroke="#8a8d76"
        stroke-width="3"
      />

      <path
        d="M72 98v21 M117 98v21"
        stroke="#718777"
        stroke-width="12"
      />
    `,

        dining: `
      <path
        d="M32 70h125v8H32z M42 78v34 M147 78v34"
        fill="#ae9c81"
        stroke="#ae9c81"
        stroke-width="3"
      />

      <ellipse
        cx="70" cy="67" rx="15" ry="4"
        fill="white"
      />

      <ellipse
        cx="120" cy="67" rx="15" ry="4"
        fill="white"
      />

      <path
        d="M58 87v29 M128 87v29"
        stroke="#7d9079"
        stroke-width="13"
      />

      <path
        d="M93 17v18 M75 47h36l-8-13H83z"
        fill="#73856e"
        stroke="#73856e"
      />

      <path
        d="M171 62v30 M166 110h12l5-28h-22z"
        fill="#8a9d7a"
        stroke="#8a9d7a"
      />
    `
    };

    return `
    <svg viewBox="0 0 190 125" aria-hidden="true">
      <path d="M13 119h166" stroke="#83927a55" />
      ${illustrations[type] || illustrations.library}
    </svg>
  `;
}

/* Rendering */

function renderSummary() {
    const known = spaces.filter(hasCurrentReport);
    const capacity = known.reduce((sum, space) => sum + space.capacity, 0);
    const occupied = known.reduce((sum, space) => sum + space.occupied, 0);
    elements.availableSeats.textContent = capacity ? (capacity - occupied).toLocaleString() : "—";
    elements.spaceCount.textContent = loading ? "—" : spaces.length;
    elements.campusOccupancy.textContent = capacity ? `${Math.round(occupied / capacity * 100)}%` : "—";
    const descriptions = document.querySelectorAll(".stat-description");
    if (descriptions[0]) descriptions[0].textContent = `${known.length} of ${spaces.length} spaces have fresh reports`;
    if (descriptions[2]) descriptions[2].textContent = "Based on spaces with fresh reports";
}

function getVisibleSpaces() {
    const query = state.search.trim().toLowerCase();

    const visibleSpaces = spaces.filter(space => {
        const matchesCategory =
            state.category === "All" ||
            space.category === state.category;

        const matchesView =
            state.view === "all" ||
            favorites.has(space.id);

        const searchableText = [
            space.name,
            space.location,
            space.category,
            ...space.amenities
        ].join(" ").toLowerCase();

        const matchesSearch = searchableText.includes(query);

        return matchesCategory && matchesView && matchesSearch;
    });

    if (state.sort === "available") {
        visibleSpaces.sort(
            (a, b) => (getAvailableSeats(b) ?? -1) - (getAvailableSeats(a) ?? -1)
        );
    }

    if (state.sort === "quiet") {
        visibleSpaces.sort(
            (a, b) =>
                (hasCurrentReport(a) ? a.occupied / a.capacity : Infinity) -
                (hasCurrentReport(b) ? b.occupied / b.capacity : Infinity)
        );
    }

    return visibleSpaces;
}

function createSpaceCard(space) {
    const available = getAvailableSeats(space);
    const percentage = getOccupancyPercentage(space);
    const status = getOccupancyStatus(space);
    const isSaved = favorites.has(space.id);

    const name = escapeHtml(space.name);
    const known = hasCurrentReport(space);
    const background = /^#[0-9a-f]{6}$/i.test(space.background) ? space.background : "#e4e8dc";

    return `
    <article class="space-card">
      <div
        class="space-art"
        style="--art-background: ${background}"
      >
        ${getArtwork(space.artwork)}

        <span class="space-type">
          ${escapeHtml(space.category)}
        </span>

        <button
          class="favorite-button ${isSaved ? "saved" : ""}"
          data-save="${space.id}"
          aria-label="${isSaved ? "Unsave" : "Save"} ${name}"
          aria-pressed="${isSaved}"
        >
          ${isSaved ? "★" : "☆"}
        </button>
      </div>

      <div class="card-body">
        <div class="card-title-row">
          <h3>${name}</h3>

          <span class="status ${status.className}">
            ${status.label}
          </span>
        </div>

        <p class="space-location">
          ${escapeHtml(space.location)}
        </p>

        <div class="occupancy-summary">
          <span>
            <strong>${known ? available : "—"}</strong>
            ${known ? `of ${space.capacity} seats free` : "Availability unknown"}
          </span>

          <span>${known ? `${percentage}% occupied` : status.label}</span>
        </div>

        ${known ? `
        <div class="occupancy-bar" role="meter"
          aria-label="${name} occupancy" aria-valuemin="0"
          aria-valuemax="${space.capacity}" aria-valuenow="${space.occupied}">
          <div class="occupancy-fill ${status.className}" style="width:${percentage}%"></div>
        </div>` : `<p class="space-location" style="margin:10px 0 15px">Capacity: ${space.capacity} seats · A fresh report is needed</p>`}

        <div class="amenities">
          ${space.amenities.map(amenity => `
            <span>· ${escapeHtml(amenity)}</span>
          `).join("")}
        </div>

        <div class="card-footer">
          <span>${escapeHtml(getReportLabel(space))}</span>

          <button
            class="details-button"
            data-detail="${space.id}"
          >
            View space ↗
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderSpaces() {
    if (loading || (loadError && spaces.length === 0)) {
        elements.resultsCount.textContent = "";
        elements.grid.innerHTML = `<div class="empty-state" role="status">${escapeHtml(loading ? "Loading campus spaces…" : loadError)}${loading ? "" : '<br><button type="button" data-retry>Retry</button>'}</div>`;
        return;
    }
    const visibleSpaces = getVisibleSpaces();

    elements.resultsHeading.textContent =
        state.view === "saved" ? "Saved spaces" : "Around campus";

    elements.resultsCount.textContent =
        `${visibleSpaces.length} ` +
        `${visibleSpaces.length === 1 ? "space" : "spaces"}`;

    if (visibleSpaces.length === 0) {
        elements.grid.innerHTML = `
      <div class="empty-state">
        No spaces found. Try another search or category,
        or save a space using its star button.
      </div>
    `;

        return;
    }

    elements.grid.innerHTML = visibleSpaces
        .map(createSpaceCard)
        .join("");
}

function renderRecommendation() {
    const leastCrowded = spaces.filter(hasCurrentReport).sort(
        (a, b) =>
            (hasCurrentReport(a) ? a.occupied / a.capacity : Infinity) -
            (hasCurrentReport(b) ? b.occupied / b.capacity : Infinity)
    )[0];

    if (!leastCrowded) {
        elements.recommendation.textContent =
            loadError || "No fresh occupancy reports yet. Availability will appear after a report is submitted.";

        return;
    }

    elements.recommendation.textContent =
        `${leastCrowded.name} has the lowest reported occupancy, ` +
        `with ${getAvailableSeats(leastCrowded)} of ` +
        `${leastCrowded.capacity} seats free.`;
}

function render() {
    renderSummary();
    renderSpaces();
    renderRecommendation();
}

/* Favorites */

function toggleFavorite(spaceId) {
    if (favorites.has(spaceId)) {
        favorites.delete(spaceId);
    } else {
        favorites.add(spaceId);
    }

    writeStorage(STORAGE_KEYS.favorites, [...favorites]);
    renderSpaces();
}

/* Space details */

function openSpaceDetails(spaceId) {
    const space = spaces.find(item => item.id === spaceId);

    if (!space) {
        return;
    }

    state.selectedSpaceId = spaceId;

    elements.dialogCategory.textContent = space.category;
    elements.dialogTitle.textContent = space.name;
    elements.dialogLocation.textContent = space.location;
    elements.dialogAmenities.textContent = space.amenities.join(" · ");
    elements.dialogAvailable.textContent = getAvailableSeats(space) ?? "Unknown";

    elements.occupancyInput.max = space.capacity;
    elements.occupancyInput.value = hasCurrentReport(space) ? space.occupied : "";
    elements.occupancyInput.setCustomValidity("");

    elements.reportFeedback.textContent = "Submitting reports requires a signed-in Supabase user.";

    elements.dialog.showModal();
}

/* Occupancy reporting */

async function submitOccupancyReport(event) {
    event.preventDefault();
    if (submitting) return;
    const space = spaces.find(item => item.id === state.selectedSpaceId);
    if (!space) return;
    const raw = elements.occupancyInput.value.trim();
    const occupied = Number(raw);
    if (!raw || !Number.isInteger(occupied) || occupied < 0 || occupied > space.capacity) {
        elements.occupancyInput.setCustomValidity(`Enter a whole number between 0 and ${space.capacity}.`);
        elements.occupancyInput.reportValidity();
        return;
    }
    elements.occupancyInput.setCustomValidity("");
    const button = elements.reportForm.querySelector('button[type="submit"]');
    const selectedId = space.id;
    const showFeedback = message => {
        if (state.selectedSpaceId === selectedId) elements.reportFeedback.textContent = message;
    };
    submitting = true;
    button.disabled = true;
    try {
        if (!client) throw new Error("Supabase client is missing. Check supabase-client.js.");
        const { data: { session }, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) {
            showFeedback("Sign in is required. This page still needs a sign-in form before you can submit reports.");
            showFeedback("Sign in using the email form near the top of the page, then submit your report again.");
            return;
        }
        const { error } = await client.rpc("submit_occupancy_report", {
            p_space_id: selectedId, p_occupied: occupied
        });
        if (error) throw error;
        const refreshed = await loadSpaces();
        showFeedback(refreshed ? "Report saved to Supabase and shared with other visitors." :
            "Report saved, but refreshing the page data failed. Try reloading.");
    } catch (error) {
        showFeedback(`Could not submit report: ${error.message || "Please try again."}`);
    } finally {
        submitting = false;
        button.disabled = false;
    }
}

/* Map page */

function setupMapPage() {
    const nav = document.querySelector(".sidebar nav");
    const main = document.querySelector("main");
    if (!nav || !main || document.getElementById("map-page")) return;

    const mapButton = document.createElement("button");
    mapButton.type = "button";
    mapButton.className = "nav-button";
    mapButton.dataset.view = "map";
    mapButton.setAttribute("aria-pressed", "false");
    mapButton.textContent = "⌖  Map";
    nav.appendChild(mapButton);

    // Preserve the existing elements and event handlers when switching pages.
    const explorePage = document.createElement("div");
    explorePage.id = "explore-page";
    const topbar = main.querySelector(".topbar");
    Array.from(main.children).forEach(child => {
        if (child !== topbar) explorePage.appendChild(child);
    });
    main.appendChild(explorePage);

    const mapPage = document.createElement("section");
    mapPage.id = "map-page";
    mapPage.hidden = true;
    mapPage.setAttribute("aria-labelledby", "map-heading");
    mapPage.innerHTML = `
    <div class="page-heading">
      <h1 id="map-heading" tabindex="-1">Campus map</h1>
      <p>Find your way to libraries, study rooms, and dining halls.</p>
    </div>
    <div id="campus-map" aria-label="Campus map"
      style="min-height:460px;min-height:min(65vh,650px);border:1px solid var(--border,#e1e7df);border-radius:16px;overflow:hidden;background:var(--surface,#fff)">
      <!-- Replace this placeholder with your map image, embed, or interactive map. -->
      <div style="min-height:inherit;display:grid;place-items:center;padding:32px;text-align:center;background:linear-gradient(90deg,#e1e7df55 1px,transparent 1px),linear-gradient(#e1e7df55 1px,transparent 1px);background-size:36px 36px">
        <div style="padding:28px;border-radius:14px;background:var(--surface,#fff);max-width:340px;box-shadow:0 8px 30px #203a3208">
          <span aria-hidden="true" style="display:block;color:var(--green,#176249);font-size:42px;margin-bottom:14px">⌖</span>
          <h2>Your campus, mapped out.</h2>
          <p style="margin-bottom:0">Your campus map will appear here.</p>
        </div>
      </div>
    </div>
  `;
    main.appendChild(mapPage);
    elements.viewButtons = document.querySelectorAll("[data-view]");
}

function showPage(view) {
    const isMap = view === "map";
    const explorePage = document.getElementById("explore-page");
    const mapPage = document.getElementById("map-page");
    if (explorePage) explorePage.hidden = isMap;
    if (mapPage) mapPage.hidden = !isMap;
    const breadcrumb = document.querySelector(".topbar > span:first-child");
    if (breadcrumb) breadcrumb.textContent = "Campus / " +
        (isMap ? "Map" : view === "saved" ? "Saved spaces" : "Explore spaces");
    if (isMap) document.getElementById("map-heading")?.focus();
}

setupMapPage();

/* Events */

elements.categoryButtons.forEach(button => {
    button.addEventListener("click", () => {
        state.category = button.dataset.category;

        elements.categoryButtons.forEach(item => {
            const active = item === button;

            item.classList.toggle("active", active);
            item.setAttribute("aria-pressed", String(active));
        });

        renderSpaces();
    });
});

elements.viewButtons.forEach(button => {
    button.addEventListener("click", () => {
        state.view = button.dataset.view;
        showPage(state.view);

        elements.viewButtons.forEach(item => {
            const active = item === button;

            item.classList.toggle("active", active);
            item.setAttribute("aria-pressed", String(active));
        });

        renderSpaces();
    });
});

elements.search.addEventListener("input", event => {
    state.search = event.target.value;
    renderSpaces();
});

elements.sort.addEventListener("change", event => {
    state.sort = event.target.value;
    renderSpaces();
});

elements.grid.addEventListener("click", event => {
    if (event.target.closest("[data-retry]")) {
        loadSpaces();
        return;
    }
    const saveButton = event.target.closest("[data-save]");

    if (saveButton) {
        const spaceId = Number(saveButton.dataset.save);
        toggleFavorite(spaceId);

        // Restore focus after replacing the card HTML.
        elements.grid
            .querySelector(`[data-save="${spaceId}"]`)
            ?.focus();

        return;
    }

    const detailButton = event.target.closest("[data-detail]");

    if (detailButton) {
        openSpaceDetails(Number(detailButton.dataset.detail));
    }
});

elements.closeDialog.addEventListener("click", () => {
    elements.dialog.close();
});

elements.dialog.addEventListener("close", () => {
    state.selectedSpaceId = null;
});

elements.occupancyInput.addEventListener("input", () => {
    elements.occupancyInput.setCustomValidity("");
});

elements.reportForm.addEventListener(
    "submit",
    submitOccupancyReport
);

// Shared occupancy is polled every 30 seconds.
async function loadSpaces() {
    if (fetching) return false;
    fetching = true;
    try {
        if (!client) throw new Error("Supabase client is missing. Check your script order.");
        const { data, error } = await client.from("space_status").select("*").order("id");
        if (error) throw error;
        spaces = data || [];
        loadError = "";
        return true;
    } catch (error) {
        loadError = `Could not refresh campus spaces: ${error.message || "Network error"}`;
        console.error(loadError);
        return false;
    } finally {
        loading = false;
        fetching = false;
        // Keep a keyboard user's current card control focused after refresh.
        const active = document.activeElement;
        const savedFocus = elements.grid.contains(active)
            ? active?.dataset?.save : null;
        const detailFocus = elements.grid.contains(active)
            ? active?.dataset?.detail : null;
        render();
        if (savedFocus) elements.grid.querySelector(`[data-save="${savedFocus}"]`)?.focus();
        if (detailFocus) elements.grid.querySelector(`[data-detail="${detailFocus}"]`)?.focus();
        if (loadError) elements.recommendation.textContent = loadError;
        const selected = spaces.find(space => space.id === state.selectedSpaceId);
        if (selected) elements.dialogAvailable.textContent = getAvailableSeats(selected) ?? "Unknown";
    }
}

function updatePageLabels() {
    document.querySelectorAll(".demo-badge").forEach(badge => {
        if (badge.id !== "dialog-category") badge.textContent = "Shared occupancy";
    });
    const campusLabel = document.querySelector(".campus-label span");
    if (campusLabel) campusLabel.textContent = "Campus occupancy";
    const description = document.querySelector(".dialog-description");
    if (description) description.textContent = "Signed-in users can submit headcounts to the shared database. Older reports are marked stale.";
    const footer = document.querySelector("footer span:last-child");
    if (footer) footer.textContent = "Refreshes every 30 seconds · Favorites saved on this device";
}

updatePageLabels();
render();
loadSpaces();
setInterval(() => {
    if (!document.hidden) loadSpaces();
}, 30000);
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadSpaces();
});