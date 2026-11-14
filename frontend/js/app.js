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
function hasKnownCapacity(space) {
    return Number.isInteger(space.capacity) && space.capacity > 0;
}
function hasSeatEstimate(space) {
    return hasCurrentReport(space) && hasKnownCapacity(space);
}
function getAvailableSeats(space) {
    return hasSeatEstimate(space) ? space.capacity - space.occupied : null;
}

function getOccupancyPercentage(space) {
    return hasSeatEstimate(space)
        ? Math.round(space.occupied / space.capacity * 100) : null;
}

function getOccupancyStatus(space) {
    if (!hasCurrentReport(space)) {
        return { className: "unknown", label: space.occupancy_updated_at ? "Stale" : "No reports" };
    }
    if (!hasKnownCapacity(space)) return { className: "unknown", label: "Reported" };
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
    const source = space.occupancy_source === "demo" ? "SIMULATED" : "Reported";
    return `${source}${hasCurrentReport(space) ? "" : " · stale"} · ${age}${space.capacity_is_estimated ? " · demo capacity" : ""}`;
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
    const known = spaces.filter(hasSeatEstimate);
    const capacity = known.reduce((sum, space) => sum + space.capacity, 0);
    const occupied = known.reduce((sum, space) => sum + space.occupied, 0);
    elements.availableSeats.textContent = capacity ? (capacity - occupied).toLocaleString() : "—";
    elements.spaceCount.textContent = loading ? "—" : spaces.length;
    elements.campusOccupancy.textContent = capacity ? `${Math.round(occupied / capacity * 100)}%` : "—";
    const descriptions = document.querySelectorAll(".stat-description");
    if (descriptions[0]) descriptions[0].textContent = `${known.length} of ${spaces.length} spaces have fresh seat estimates`;
    if (descriptions[2]) descriptions[2].textContent =
        known.some(space => space.occupancy_source === "demo" || space.capacity_is_estimated)
            ? "Includes simulated counts / demo capacities"
            : "Based on fresh reports with known capacity";
}

function getVisibleSpaces() {
    const query = elements.search.value.trim().toLowerCase();

    const visibleSpaces = spaces.filter(space => {
        const matchesCategory =
            state.category === "All" ||
            (state.category === "Residence halls"
                ? space.is_residence_hall === true
                : space.category === state.category);

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
                (hasSeatEstimate(a) ? a.occupied / a.capacity : Infinity) -
                (hasSeatEstimate(b) ? b.occupied / b.capacity : Infinity)
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
    const known = hasSeatEstimate(space);
    const background = /^#[0-9a-f]{6}$/i.test(space.background) ? space.background : "#e4e8dc";

    return `
    <article class="space-card" ${space.is_residence_hall ? `data-detail="${space.id}" style="cursor:pointer"` : ""}>
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
            ${known ? `of ${space.capacity} ${space.capacity_is_estimated ? "demo seats" : "seats"} free` : "Availability unknown"}
          </span>

          <span>${known ? `${percentage}% occupied` : hasCurrentReport(space) ? `${space.occupied} people reported` : status.label}</span>
        </div>

        ${known ? `
        <div class="occupancy-bar" role="meter"
          aria-label="${name} occupancy" aria-valuemin="0"
          aria-valuemax="${space.capacity}" aria-valuenow="${space.occupied}">
          <div class="occupancy-fill ${status.className}" style="width:${percentage}%"></div>
        </div>` : `<p class="space-location" style="margin:10px 0 15px">Capacity: ${hasKnownCapacity(space) ? `${space.capacity} seats` : "Unknown"} · ${hasCurrentReport(space) ? "Headcount reported" : "A fresh report is needed"}</p>`}

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
            ${space.is_residence_hall ? "View study rooms ↗" : "View space ↗"}
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
    const leastCrowded = spaces.filter(hasSeatEstimate).sort(
        (a, b) =>
            (hasSeatEstimate(a) ? a.occupied / a.capacity : Infinity) -
            (hasSeatEstimate(b) ? b.occupied / b.capacity : Infinity)
    )[0];

    if (!leastCrowded) {
        elements.recommendation.textContent =
            loadError || "No fresh occupancy reports yet. Availability will appear after a report is submitted.";

        return;
    }

    elements.recommendation.textContent =
        `${leastCrowded.name} has the lowest ${leastCrowded.occupancy_source === "demo" || leastCrowded.capacity_is_estimated ? "demo" : "reported"} occupancy, ` +
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
    resetResidenceDetails();
    if (space.is_residence_hall) {
        openResidenceRooms(space);
        return;
    }

    elements.dialogCategory.textContent = space.category;
    elements.dialogTitle.textContent = space.name;
    elements.dialogLocation.textContent = space.location;
    elements.dialogAmenities.textContent = [
        ...space.amenities,
        ...(space.occupancy_source === "demo" ? ["SIMULATED occupancy"] : []),
        ...(space.capacity_is_estimated ? [space.capacity_basis || "Demo capacity — not verified"] : [])
    ].join(" · ");
    elements.dialogAvailable.textContent = getAvailableSeats(space) ?? "Unknown";

    if (hasKnownCapacity(space)) elements.occupancyInput.max = space.capacity;
    else elements.occupancyInput.removeAttribute("max");
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
    if (!raw || !Number.isInteger(occupied) || occupied < 0 || (hasKnownCapacity(space) && occupied > space.capacity)) {
        elements.occupancyInput.setCustomValidity(hasKnownCapacity(space) ? `Enter a whole number between 0 and ${space.capacity}.` : "Enter a nonnegative whole number.");
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

/* Residence hall study rooms */
let residenceRequest = 0;
function resetResidenceDetails() {
    residenceRequest += 1;
    document.getElementById("residence-room-browser")?.remove();
    elements.reportForm.hidden = false;
    const availability = document.querySelector(".dialog-availability");
    if (availability) availability.hidden = false;
    const description = document.querySelector(".dialog-description");
    if (description) description.hidden = false;
    if (availability) availability.style.display = "";
    if (description) description.style.display = "";
    elements.dialog.style.width = "";
}

function roomCard(room) {
    const free = room.capacity - room.occupied;
    return `<button type="button" data-room-id="${room.id}" style="text-align:left;padding:15px;border:1px solid #e1e7df;border-radius:10px;background:#f7f8f3;min-width:0">
    <strong>Study room ${room.room_number}</strong>
    <span style="display:block;margin:8px 0;color:#176249">${free} of ${room.capacity} seats free</span>
    <span style="font-size:11px;color:#7b8680">${room.is_demo ? "SIMULATED · " : ""}${room.occupied} people · View room ↗</span>
  </button>`;
}

function renderResidenceFloors(container, space, rooms) {
    const floors = [...new Set(rooms.map(room => room.floor_number))].sort((a,b) => a-b);
    container.innerHTML = `<p style="font-size:12px">Demo layout: two study rooms per floor. Room locations and occupancy are illustrative.${space.floor_count_is_estimated ? " Floor count is estimated." : " Floor count comes from the supplied map data."}</p>` +
        floors.map(floor => `<section style="margin-top:20px" aria-label="Floor ${floor}">
      <h3>Floor ${floor}</h3>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px">
        ${rooms.filter(room => room.floor_number === floor).map(roomCard).join("")}
      </div></section>`).join("");
    container.querySelectorAll("[data-room-id]").forEach(button => {
        button.addEventListener("click", () => {
            const room = rooms.find(item => String(item.id) === button.dataset.roomId);
            if (!room) return;
            container.innerHTML = `<button type="button" data-back class="details-button">← All floors</button>
        <h3 tabindex="-1" data-room-heading style="margin-top:20px">Floor ${room.floor_number} · Study room ${room.room_number}</h3>
        <p>${escapeHtml(space.name)}</p>
        <div style="font-size:30px;font-weight:700;margin:20px 0">${room.capacity - room.occupied} <span style="font-size:14px">seats free</span></div>
        <p>Capacity: ${room.capacity} · Occupied: ${room.occupied}</p>
        <p>${room.amenities.map(escapeHtml).join(" · ")}</p>
        <p style="font-size:12px">${room.is_demo ? "SIMULATED data. Every demo room starts with the same values. These are not verified room locations or live reports." : "Room occupancy from the database."}</p>`;
            container.querySelector("[data-back]").addEventListener("click", () => {
                renderResidenceFloors(container, space, rooms);
                container.querySelector(`[data-room-id="${room.id}"]`)?.focus();
            });
            container.querySelector("[data-room-heading]").focus();
        });
    });
}

async function openResidenceRooms(space) {
    const request = residenceRequest;
    elements.dialogCategory.textContent = "Residence hall";
    elements.dialogTitle.textContent = space.name;
    elements.dialogLocation.textContent = space.location;
    elements.dialogAmenities.textContent = `${space.floor_count || "—"} floors · 2 demo study rooms per floor`;
    elements.reportForm.hidden = true;
    const availability = document.querySelector(".dialog-availability");
    if (availability) { availability.hidden = true; availability.style.display = "none"; }
    const description = document.querySelector(".dialog-description");
    if (description) { description.hidden = true; description.style.display = "none"; }
    elements.dialog.style.width = "600px";
    const container = document.createElement("div");
    container.id = "residence-room-browser";
    container.setAttribute("aria-live", "polite");
    container.textContent = "Loading study rooms…";
    elements.reportForm.before(container);
    if (!elements.dialog.open) elements.dialog.showModal();
    try {
        const { data, error } = await client.from("residence_study_rooms")
            .select("*").eq("building_id", space.id)
            .order("floor_number").order("room_number");
        if (request !== residenceRequest || state.selectedSpaceId !== space.id) return;
        if (error) throw error;
        if (!data?.length) {
            container.textContent = "No study rooms found. Run the residence-room SQL migration first.";
            return;
        }
        renderResidenceFloors(container, space, data);
    } catch (error) {
        if (request === residenceRequest) container.textContent = `Could not load study rooms: ${error.message || "Please try again."}`;
    }
}

/* Filter reset */

function resetFilters() {
    state.search = "";
    state.category = "All";
    state.sort = "recommended";
    state.view = "all";
    elements.search.value = "";
    elements.sort.value = "recommended";
    elements.categoryButtons.forEach(button => {
        const active = button.dataset.category === "All";
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });
    elements.viewButtons.forEach(button => {
        const active = button.dataset.view === "all";
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });
    showPage("all");
    renderSpaces();
}

function handleSearchChange() {
    state.search = elements.search.value;
    if (!state.search.trim()) {
        resetFilters();
        return;
    }
    renderSpaces();
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
      <p>Explore UTK buildings and crowd density.</p>
    </div>
    <iframe id="campus-map" src="map.html" title="UTK campus occupancy map" loading="lazy"
      style="display:block;width:100%;height:75vh;min-height:450px;border:1px solid #e1e7df;border-radius:16px;background:white"></iframe>
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

// Include non-library buildings in the category controls.
const categoryTabs = document.querySelector(".category-tabs");
if (categoryTabs && !categoryTabs.querySelector('[data-category="Campus building"]')) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-button";
    button.dataset.category = "Campus building";
    button.setAttribute("aria-pressed", "false");
    button.textContent = "Other buildings";
    categoryTabs.appendChild(button);
    categoryTabs.style.flexWrap = "wrap";
    elements.categoryButtons = document.querySelectorAll("[data-category]");
}

// Residence halls are identified by database metadata, not by a name match.
if (categoryTabs && !categoryTabs.querySelector('[data-category="Residence halls"]')) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-button";
    button.dataset.category = "Residence halls";
    button.setAttribute("aria-pressed", "false");
    button.textContent = "Residence halls";
    categoryTabs.appendChild(button);
    elements.categoryButtons = document.querySelectorAll("[data-category]");
}

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

elements.search.addEventListener("input", handleSearchChange);
// Some browsers fire a separate event for the built-in search clear button.
elements.search.addEventListener("search", handleSearchChange);
elements.search.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        event.preventDefault();
        resetFilters();
    }
});

const toolbar = document.querySelector(".toolbar");
if (toolbar && !document.getElementById("clear-filters")) {
    const clearButton = document.createElement("button");
    clearButton.id = "clear-filters";
    clearButton.type = "button";
    clearButton.textContent = "Clear filters";
    clearButton.style.cssText = "padding:10px 12px;border:1px solid var(--border,#e1e7df);border-radius:8px;background:var(--surface,#fff);color:var(--green,#176249);white-space:nowrap";
    clearButton.addEventListener("click", resetFilters);
    toolbar.appendChild(clearButton);
    toolbar.style.flexWrap = "wrap";
}

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
    resetResidenceDetails();
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
        const { data, error } = await client.from("space_status").select("*").order("name").range(0, 999);
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
        updatePageLabels();
        if (savedFocus) elements.grid.querySelector(`[data-save="${savedFocus}"]`)?.focus();
        if (detailFocus) elements.grid.querySelector(`[data-detail="${detailFocus}"]`)?.focus();
        if (loadError) elements.recommendation.textContent = loadError;
        const selected = spaces.find(space => space.id === state.selectedSpaceId);
        if (selected) elements.dialogAvailable.textContent = getAvailableSeats(selected) ?? "Unknown";
    }
}

function updatePageLabels() {
    document.querySelectorAll(".demo-badge").forEach(badge => {
        if (badge.id !== "dialog-category") badge.textContent = spaces.some(space => space.occupancy_source === "demo" || space.capacity_is_estimated) ? "Includes demo data" : "Shared occupancy";
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
