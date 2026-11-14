"use strict";

/*
 * Sample campus data.
 * Change these records to match your campus.
 */
const INITIAL_SPACES = [
    {
        id: 1,
        name: "Central Library",
        category: "Library",
        location: "Main campus · 3 floors",
        capacity: 240,
        occupied: 142,
        amenities: ["Quiet zones", "Wi-Fi", "Outlets"],
        background: "#e4e8dc",
        artwork: "library"
    },
    {
        id: 2,
        name: "Study Room 204",
        category: "Study room",
        location: "Learning Commons · Floor 2",
        capacity: 8,
        occupied: 2,
        amenities: ["Whiteboard", "Group study", "Outlets"],
        background: "#e9e2d6",
        artwork: "room"
    },
    {
        id: 3,
        name: "The Commons",
        category: "Dining hall",
        location: "Student Center · Ground floor",
        capacity: 180,
        occupied: 153,
        amenities: ["Hot meals", "Coffee", "Social"],
        background: "#e9dfd5",
        artwork: "dining"
    },
    {
        id: 4,
        name: "North Library",
        category: "Library",
        location: "North campus · 2 floors",
        capacity: 120,
        occupied: 29,
        amenities: ["Silent study", "Wi-Fi", "Natural light"],
        background: "#dde6df",
        artwork: "library"
    },
    {
        id: 5,
        name: "Study Room 108",
        category: "Study room",
        location: "Science Building · Floor 1",
        capacity: 6,
        occupied: 6,
        amenities: ["Whiteboard", "Display", "Group study"],
        background: "#dfe5e8",
        artwork: "room"
    },
    {
        id: 6,
        name: "Garden Dining",
        category: "Dining hall",
        location: "West campus · Garden level",
        capacity: 100,
        occupied: 34,
        amenities: ["Outdoor seats", "Plant-based", "Coffee"],
        background: "#e7e8d7",
        artwork: "dining"
    }
];

const STORAGE_KEYS = {
    favorites: "campus-space:favorites",
    reports: "campus-space:reports"
};

/* Storage helpers */

function readStorage(key, fallback) {
    try {
        const value = localStorage.getItem(key);

        return value === null ? fallback : JSON.parse(value);
    } catch {
        return fallback;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

const storedFavorites = readStorage(STORAGE_KEYS.favorites, []);

const favorites = new Set(
    Array.isArray(storedFavorites)
        ? storedFavorites.filter(
            id => INITIAL_SPACES.some(space => space.id === id)
        )
        : []
);

const storedReports = readStorage(STORAGE_KEYS.reports, {});

const reports =
    storedReports &&
    typeof storedReports === "object" &&
    !Array.isArray(storedReports)
        ? storedReports
        : {};

const spaces = INITIAL_SPACES.map(space => {
    const report = reports[space.id];

    const validReport =
        report &&
        Number.isInteger(report.occupied) &&
        report.occupied >= 0 &&
        report.occupied <= space.capacity;

    return {
        ...space,
        occupied: validReport ? report.occupied : space.occupied,
        reportedAt: validReport ? report.updatedAt : null
    };
});

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

function getAvailableSeats(space) {
    return space.capacity - space.occupied;
}

function getOccupancyPercentage(space) {
    if (space.capacity <= 0) {
        return 0;
    }

    return Math.round((space.occupied / space.capacity) * 100);
}

function getOccupancyStatus(space) {
    const percentage = getOccupancyPercentage(space);

    if (space.occupied >= space.capacity) {
        return { className: "busy", label: "Full" };
    }

    if (percentage >= 80) {
        return { className: "busy", label: "Busy" };
    }

    if (percentage >= 50) {
        return { className: "moderate", label: "Filling up" };
    }

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
    if (!space.reportedAt) {
        return "Sample occupancy";
    }

    const timestamp = Date.parse(space.reportedAt);

    if (!Number.isFinite(timestamp)) {
        return "Your report · this device";
    }

    const minutes = Math.max(
        0,
        Math.floor((Date.now() - timestamp) / 60000)
    );

    if (minutes < 1) {
        return "Your report · just now";
    }

    if (minutes < 60) {
        return `Your report · ${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
        return `Your report · ${hours}h ago`;
    }

    return "Your report · " + new Date(timestamp).toLocaleDateString();
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
    const totalCapacity = spaces.reduce(
        (total, space) => total + space.capacity,
        0
    );

    const totalOccupied = spaces.reduce(
        (total, space) => total + space.occupied,
        0
    );

    const available = totalCapacity - totalOccupied;

    const percentage =
        totalCapacity > 0
            ? Math.round((totalOccupied / totalCapacity) * 100)
            : 0;

    elements.availableSeats.textContent = available.toLocaleString();
    elements.spaceCount.textContent = spaces.length;
    elements.campusOccupancy.textContent = `${percentage}%`;
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
            (a, b) => getAvailableSeats(b) - getAvailableSeats(a)
        );
    }

    if (state.sort === "quiet") {
        visibleSpaces.sort(
            (a, b) =>
                a.occupied / a.capacity - b.occupied / b.capacity
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

    return `
    <article class="space-card">
      <div
        class="space-art"
        style="--art-background: ${space.background}"
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
            <strong>${available}</strong>
            of ${space.capacity} seats free
          </span>

          <span>${percentage}% occupied</span>
        </div>

        <div
          class="occupancy-bar"
          role="meter"
          aria-label="${name} occupancy"
          aria-valuemin="0"
          aria-valuemax="${space.capacity}"
          aria-valuenow="${space.occupied}"
          aria-valuetext="${space.occupied} of ${space.capacity} seats occupied"
        >
          <div
            class="occupancy-fill ${status.className}"
            style="width: ${percentage}%"
          ></div>
        </div>

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
    const leastCrowded = [...spaces].sort(
        (a, b) =>
            a.occupied / a.capacity - b.occupied / b.capacity
    )[0];

    if (!leastCrowded) {
        elements.recommendation.textContent =
            "Add campus spaces to see recommendations.";

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
    elements.dialogAvailable.textContent = getAvailableSeats(space);

    elements.occupancyInput.max = space.capacity;
    elements.occupancyInput.value = space.occupied;
    elements.occupancyInput.setCustomValidity("");

    elements.reportFeedback.textContent = "";

    elements.dialog.showModal();
}

/* Occupancy reporting */

function submitOccupancyReport(event) {
    event.preventDefault();

    const space = spaces.find(
        item => item.id === state.selectedSpaceId
    );

    if (!space) {
        return;
    }

    const rawValue = elements.occupancyInput.value.trim();
    const occupied = Number(rawValue);

    const valid =
        rawValue !== "" &&
        Number.isInteger(occupied) &&
        occupied >= 0 &&
        occupied <= space.capacity;

    if (!valid) {
        elements.occupancyInput.setCustomValidity(
            `Enter a whole number between 0 and ${space.capacity}.`
        );

        elements.occupancyInput.reportValidity();
        return;
    }

    elements.occupancyInput.setCustomValidity("");

    const updatedAt = new Date().toISOString();

    space.occupied = occupied;
    space.reportedAt = updatedAt;

    reports[space.id] = {
        occupied,
        updatedAt
    };

    const saved = writeStorage(STORAGE_KEYS.reports, reports);

    elements.dialogAvailable.textContent = getAvailableSeats(space);

    elements.reportFeedback.textContent = saved
        ? "Updated and saved on this device."
        : "Updated for this session. Browser storage is unavailable.";

    render();
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

// Refresh relative report times while the page is open.
setInterval(() => {
    if (!elements.dialog.open) {
        renderSpaces();
    }
}, 60000);

/* Start the app */

render();