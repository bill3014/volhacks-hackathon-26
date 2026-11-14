"use strict";

const UTK_CENTER = [-83.9295, 35.9544];
const UTK_BBOX = "35.9435,-83.9470,35.9590,-83.9210";
const CACHE_KEY = "utk_campus_3d_fast_v2";

// Official UTK Campus boundaries (Main Campus, The Hill, West Campus, Athletics & Ag Campus)
const UTK_CAMPUS_ZONES = [
    {
        type: "Polygon",
        coordinates: [[
            [-83.9398, 35.9558],
            [-83.9315, 35.9574],
            [-83.9278, 35.9587],
            [-83.9238, 35.9587],
            [-83.9216, 35.9558],
            [-83.9213, 35.9482],
            [-83.9255, 35.9448],
            [-83.9348, 35.9443],
            [-83.9398, 35.9495],
            [-83.9398, 35.9558]
        ]]
    },
    {
        type: "Polygon",
        coordinates: [[
            [-83.9470, 35.9508],
            [-83.9395, 35.9508],
            [-83.9395, 35.9438],
            [-83.9470, 35.9438],
            [-83.9470, 35.9508]
        ]]
    }
];

const EXCLUDED_PLACEHOLDER_IDS = new Set(["way/1158268988", "way/1158268989", "way/1187507793", "way/1187507794", "way/1187507795", "way/1187507796", "way/1187508046", "way/1187508051", "way/1187508052", "way/1187508053", "way/1187508054", "way/1187508055", "way/1187508057", "way/1187508058", "way/1187508059", "way/1187508060", "way/1187508061", "way/1187508062", "way/1187508063", "way/1187508064", "way/1187508065", "way/1187508070", "way/1187508071", "way/1187508072", "way/1187508073", "way/1187508074", "way/1187508075", "way/1187508076", "way/1187508077", "way/1187508078", "way/1187508079", "way/1187508613", "way/1187508614", "way/1187508615", "way/1187508616", "way/1187508617", "way/1187508618", "way/1187508619", "way/1187508620", "way/1187508621", "way/1187508622", "way/1187508624", "way/1187508625", "way/1187508629", "way/1187508630", "way/1187509568", "way/1187509569", "way/1187509570", "way/1187509571", "way/1187511692", "way/1187511693", "way/119068281", "way/1312720250", "way/1312720251", "way/1312720252", "way/1313509601", "way/1314246177", "way/1314690924", "way/1314690926", "way/1314690929", "way/1314690930", "way/1314690970", "way/1320664892", "way/1472774766", "way/1473481098", "way/1534053826", "way/155024574", "way/155024615", "way/155024617", "way/155024629", "way/1560048729", "way/1562019660", "way/263581009", "way/263585214", "way/263586178", "way/263586179", "way/263674014", "way/263683755", "way/263683895", "way/263683896", "way/263684835", "way/263697161", "way/80675042", "way/833709132", "way/838288788", "way/838288789", "way/838288790", "way/962546890", "way/962546895", "way/962546896", "way/962546897", "way/962546905", "way/962858404", "way/962900057", "way/963608380", "way/963608381", "way/963608407", "way/963608408", "way/963608409", "way/963608410", "way/963608411", "way/963623186"]);

const EXCLUDED_TYPES = new Set([
    "house", "detached", "semidetached_house", "terrace", "bungalow", "static_caravan"
]);

const BUILDING_HEIGHT_OVERRIDES = {
    "McClung Tower": 52,
    "Ayres Hall": 42,
    "John C. Hodges Library": 34,
    "Neyland Stadium": 46,
    "Thompson-Boling Arena": 38,
    "Student Union": 26,
    "Haslam Business Building": 28,
    "James A. Haslam II Business Building": 28,
    "J.D. Tickle Engineering Building": 26,
    "Hess Hall": 30,
    "Stokely Hall": 32
};

// Built-in core UTK campus buildings so the 3D map renders in 0ms with zero network wait
const INSTANT_UTK_GEOJSON = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            id: "utk/hodges",
            properties: { name: "John C. Hodges Library", height: "34" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-83.9299, 35.9554], [-83.9288, 35.9554],
                    [-83.9288, 35.9546], [-83.9299, 35.9546], [-83.9299, 35.9554]
                ]]
            }
        },
        {
            type: "Feature",
            id: "utk/student-union",
            properties: { name: "Student Union", height: "26" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-83.9287, 35.9570], [-83.9272, 35.9570],
                    [-83.9272, 35.9560], [-83.9287, 35.9560], [-83.9287, 35.9570]
                ]]
            }
        },
        {
            type: "Feature",
            id: "utk/ayres",
            properties: { name: "Ayres Hall", height: "42" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-83.9265, 35.9577], [-83.9256, 35.9577],
                    [-83.9256, 35.9571], [-83.9265, 35.9571], [-83.9265, 35.9577]
                ]]
            }
        },
        {
            type: "Feature",
            id: "utk/haslam",
            properties: { name: "James A. Haslam II Business Building", height: "28" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-83.9306, 35.9567], [-83.9296, 35.9567],
                    [-83.9296, 35.9559], [-83.9306, 35.9559], [-83.9306, 35.9567]
                ]]
            }
        },
        {
            type: "Feature",
            id: "utk/tickle",
            properties: { name: "J.D. Tickle Engineering Building", height: "26" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-83.9247, 35.9563], [-83.9238, 35.9563],
                    [-83.9238, 35.9556], [-83.9247, 35.9556], [-83.9247, 35.9563]
                ]]
            }
        },
        {
            type: "Feature",
            id: "utk/mcclung",
            properties: { name: "McClung Tower", height: "52" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-83.9295, 35.9565], [-83.9289, 35.9565],
                    [-83.9289, 35.9560], [-83.9295, 35.9560], [-83.9295, 35.9565]
                ]]
            }
        },
        {
            type: "Feature",
            id: "utk/hess",
            properties: { name: "Hess Hall", height: "30" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-83.9325, 35.9547], [-83.9313, 35.9547],
                    [-83.9313, 35.9538], [-83.9325, 35.9538], [-83.9325, 35.9547]
                ]]
            }
        },
        {
            type: "Feature",
            id: "utk/stokely",
            properties: { name: "Stokely Hall", height: "32" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-83.9347, 35.9558], [-83.9334, 35.9558],
                    [-83.9334, 35.9549], [-83.9347, 35.9549], [-83.9347, 35.9558]
                ]]
            }
        },
        {
            type: "Feature",
            id: "utk/trecs",
            properties: { name: "Tennessee Recreation Center for Students", height: "22" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-83.9372, 35.9522], [-83.9356, 35.9522],
                    [-83.9356, 35.9510], [-83.9372, 35.9510], [-83.9372, 35.9522]
                ]]
            }
        },
        {
            type: "Feature",
            id: "utk/neyland",
            properties: { name: "Neyland Stadium", height: "46" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-83.9262, 35.9560], [-83.9238, 35.9560],
                    [-83.9238, 35.9538], [-83.9262, 35.9538], [-83.9262, 35.9560]
                ]]
            }
        }
    ]
};

let occupancyData = {};
let campusGeoJson = null;
let autoTimer = null;
let selectedMinute = 720;
let simulationEnabled = true;
let activePopup = null;
let popupFeatureId = null;

// Repeatable sample patterns, not measured history or predictions.
function nameHash(name) {
    let hash = 2166136261;
    for (const character of name) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return hash >>> 0;
}

function gaussian(hour, peak, width) {
    return Math.exp(-0.5 * ((hour - peak) / width) ** 2);
}

function getSimulatedOccupancy(name, minute, baseline = 50) {
    const hour = minute / 60;
    const lower = name.toLowerCase();
    let value;
    if (/stadium|arena/.test(lower)) {
        value = 3 + 5 * gaussian(hour, 14, 4); // No event is assumed.
    } else if (/library/.test(lower)) {
        value = 7 + 41 * gaussian(hour, 14, 3.2) + 68 * gaussian(hour, 20, 2.4);
    } else if (/dining|commons|union|cafe|café/.test(lower)) {
        value = 6 + 42 * gaussian(hour, 8.5, 1) + 77 * gaussian(hour, 12.5, 1.3) + 65 * gaussian(hour, 18.5, 1.4);
    } else if (/hall/.test(lower) && /hess|stokely|residence|dorm/.test(lower)) {
        value = 77 - 54 * gaussian(hour, 13, 3.7) + 12 * gaussian(hour, 22, 2);
    } else if (/recreation|gym|trecs/.test(lower)) {
        value = 4 + 37 * gaussian(hour, 7.5, 1.4) + 78 * gaussian(hour, 18, 2.2);
    } else if (/parking|garage/.test(lower)) {
        value = 5 + 76 * gaussian(hour, 12, 3.6);
    } else {
        value = 3 + 76 * gaussian(hour, 12.5, 3) + 9 * gaussian(hour, 18, 1.5);
    }
    const seed = nameHash(name);
    const scale = .86 + (seed % 29) / 100;
    const variation = 3 * Math.sin(hour * Math.PI / 6 + (seed % 31));
    const baselineScale = .85 + Math.max(0, Math.min(100, Number(baseline) || 0)) / 333;
    return Math.round(Math.max(0, Math.min(100, value * scale * baselineScale + variation)));
}

function formatMinute(minute) {
    const hour = Math.floor(minute / 60);
    return `${hour % 12 || 12}:${String(minute % 60).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

function escapeMapText(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
}

function timelineStatus(count) {
    return simulationEnabled
        ? `SIMULATED · ${formatMinute(selectedMinute)} · ${count} buildings · Not historical or live data`
        : `SAMPLE SNAPSHOT · ${count} buildings · Not live data`;
}

function stopPlayback() {
    if (autoTimer !== null) clearInterval(autoTimer);
    autoTimer = null;
    const button = document.getElementById("autoToggle");
    if (button) {
        button.textContent = "▶ Play day";
        button.classList.remove("active");
        button.setAttribute("aria-pressed", "false");
    }
}

function refreshTimeline() {
    const slider = document.getElementById("occupancyTime");
    if (slider) {
        slider.value = String(selectedMinute);
        slider.setAttribute("aria-valuetext", formatMinute(selectedMinute));
    }
    const output = document.getElementById("occupancyTimeLabel");
    if (output) output.textContent = simulationEnabled ? formatMinute(selectedMinute) : "Sample snapshot";
    const badge = document.querySelector(".sidebar-header .badge");
    if (badge) badge.textContent = simulationEnabled ? "SIMULATION" : "SAMPLE DATA";
    if (campusGeoJson) updateMapData(campusGeoJson);
}

function injectTimelineControls() {
    if (document.getElementById("occupancyTime")) return;
    const controls = document.querySelector(".controls");
    if (!controls) return;
    const section = document.createElement("section");
    section.setAttribute("aria-label", "Simulated time of day");
    section.style.cssText = "margin-top:16px;padding:14px;border:1px solid #ffffff30;border-radius:10px;background:#88888812";
    section.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px">
      <label for="occupancyTime" style="font-weight:600">Simulated time</label>
      <output id="occupancyTimeLabel" for="occupancyTime">12:00 PM</output>
    </div>
    <input id="occupancyTime" type="range" min="0" max="1425" step="15" value="720"
      aria-valuetext="12:00 PM" style="width:100%;padding:0;accent-color:#ff8200;cursor:pointer">
    <div style="display:flex;justify-content:space-between;font-size:11px;opacity:.8;margin-top:8px">
      <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11:45 PM</span>
    </div>
    <p style="font-size:12px;line-height:1.5;margin:12px 0 0;opacity:.85">Illustrative daily patterns. Move the slider or play the day to compare estimated crowds. No database data is changed.</p>
  `;
    controls.appendChild(section);
    document.getElementById("occupancyTime").addEventListener("input", event => {
        stopPlayback();
        simulationEnabled = true;
        selectedMinute = Number(event.target.value);
        refreshTimeline();
    });
    const snapshot = document.getElementById("simulateBtn");
    if (snapshot) snapshot.textContent = "Sample snapshot";
    stopPlayback();
    const badge = document.querySelector(".sidebar-header .badge");
    if (badge) badge.textContent = "SIMULATION";
}

let is3DView = true;

const map = new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/positron",
    center: UTK_CENTER,
    zoom: 16.0,
    pitch: 64,
    bearing: -26,
    maxPitch: 85,
    antialias: true
});

map.addControl(
    new maplibregl.NavigationControl({ visualizePitch: true }),
    "top-right"
);

function getOuterRing(geometry) {
    if (!geometry || !geometry.coordinates) return null;
    return geometry.type === "Polygon"
        ? geometry.coordinates[0]
        : geometry.coordinates[0][0];
}

function getPolygonCenter(geometry) {
    const ring = getOuterRing(geometry);
    if (!ring || ring.length === 0) return UTK_CENTER;
    let lngSum = 0;
    let latSum = 0;
    ring.forEach(([lng, lat]) => {
        lngSum += lng;
        latSum += lat;
    });
    return [lngSum / ring.length, latSum / ring.length];
}

function getRingAreaApprox(ring) {
    if (!ring || ring.length < 3) return 0;
    let area = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
    }
    return Math.abs(area / 2);
}

function isPointInRing(point, ring) {
    if (!ring || ring.length < 3) return false;
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        const intersect =
            yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}

function isOnUtkCampus(feature) {
    const props = feature.properties || {};
    const bType = String(props.building || "").toLowerCase();
    const leisure = String(props.leisure || "").toLowerCase();
    const name = String(props.name || "").toLowerCase();
    const op = String(props.operator || "").toLowerCase();

    const isStadium = leisure === "stadium" || name.includes("neyland");
    const taggedUtk =
        isStadium ||
        bType === "university" ||
        bType === "dormitory" ||
        bType === "college" ||
        op.includes("university of tennessee") ||
        op.includes("utk");

    if (EXCLUDED_TYPES.has(bType) && !taggedUtk) return false;

    const center = getPolygonCenter(feature.geometry);
    return (
        taggedUtk ||
        UTK_CAMPUS_ZONES.some((zone) => isPointInRing(center, zone.coordinates[0]))
    );
}

function getSeverityClass(pct) {
    if (pct < 45) return "low";
    if (pct <= 75) return "mid";
    return "high";
}

function parseHeightMeters(props, fallback) {
    if (props.height) {
        const parsed = parseFloat(String(props.height).replace(/[^\d.-]/g, ""));
        if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
    if (props["building:levels"]) {
        const levels = parseFloat(String(props["building:levels"]).replace(/[^\d.-]/g, ""));
        if (!Number.isNaN(levels) && levels > 0) return levels * 5;
    }
    return fallback;
}

function enrichGeoJson(geojson) {
    const campusFeatures = (geojson.features || []).filter(
        (f) =>
            !EXCLUDED_PLACEHOLDER_IDS.has(String(f.id)) &&
            f.geometry &&
            (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") &&
            isOnUtkCampus(f)
    );

    // Keep Neyland Stadium visible even if the loaded GeoJSON only contains building=* ways
    const hasNeyland = campusFeatures.some((f) =>
        /neyland/i.test((f.properties && f.properties.name) || "")
    );
    if (!hasNeyland) {
        const fallbackNeyland = INSTANT_UTK_GEOJSON.features.find(
            (f) => f.id === "utk/neyland"
        );
        if (fallbackNeyland) {
            campusFeatures.push(JSON.parse(JSON.stringify(fallbackNeyland)));
        }
    }

    // Deduplicate overlapping polygons at the same coordinates to prevent Z-fighting
    const deduped = [];
    const seenByName = new Map();

    campusFeatures.forEach((feature) => {
        const props = feature.properties || {};
        const name = props.name || "";
        const area = getRingAreaApprox(getOuterRing(feature.geometry));

        if (name && seenByName.has(name)) {
            const idx = seenByName.get(name);
            const c1 = getPolygonCenter(deduped[idx].geometry);
            const c2 = getPolygonCenter(feature.geometry);
            if (Math.hypot(c1[0] - c2[0], c1[1] - c2[1]) < 0.0002) {
                if (area > deduped[idx]._area) {
                    feature._area = area;
                    deduped[idx] = feature;
                }
                return;
            }
        }

        feature._area = area;
        if (name) seenByName.set(name, deduped.length);
        deduped.push(feature);
    });

    const fallbackOcc = {};

    deduped.forEach((feature, index) => {
        const props = feature.properties || {};
        const name = props.name || "UTK Campus Building";

        let renderHeight = BUILDING_HEIGHT_OVERRIDES[name]
            ? BUILDING_HEIGHT_OVERRIDES[name]
            : parseHeightMeters(props, 18);
        if (renderHeight < 15) renderHeight = 15;

        const tracked = occupancyData[name];
        if (!tracked && fallbackOcc[name] === undefined) {
            fallbackOcc[name] = 20 + nameHash(name) % 50;
        }

        const baseline = tracked ? tracked.occupancy : fallbackOcc[name];
        const occupancy = simulationEnabled ? getSimulatedOccupancy(name, selectedMinute, baseline) : Math.round(Math.max(0, Math.min(100, Number(baseline) || 0)));
        const rawCapacity = tracked ? Number(tracked.capacity) : 300;
        const capacity = Number.isFinite(rawCapacity) && rawCapacity > 0 ? Math.round(rawCapacity) : 300;

        feature.id = feature.id || `utk-bldg-${index}`;
        feature.properties.featureId = String(feature.id);
        feature.properties.displayName = name;
        feature.properties.renderHeight = renderHeight;
        feature.properties.occupancy = occupancy;
        feature.properties.capacity = capacity;
        feature.properties.headcount = Math.round((occupancy / 100) * capacity);
    });

    return { type: "FeatureCollection", features: deduped };
}

function renderSidebarList(filterText = "") {
    if (!campusGeoJson) return;
    const listEl = document.getElementById("buildingList");
    const query = filterText.trim().toLowerCase();

    const byName = new Map();
    campusGeoJson.features.forEach((f) => {
        const name = f.properties.name;
        if (!name || !name.toLowerCase().includes(query)) return;
        if (!byName.has(name)) byName.set(name, f);
    });

    const sorted = Array.from(byName.values()).sort(
        (a, b) => b.properties.occupancy - a.properties.occupancy
    );

    listEl.innerHTML = "";
    sorted.forEach((feature) => {
        const { displayName, occupancy, headcount, capacity } = feature.properties;
        const li = document.createElement("li");
        li.className = "building-item";
        li.innerHTML = `
      <div>
        <div class="building-name">${escapeMapText(displayName)}</div>
        <div class="building-meta">~${headcount} / ${capacity} est. people</div>
      </div>
      <span class="pill ${getSeverityClass(occupancy)}">${occupancy}%</span>
    `;
        li.addEventListener("click", () => {
            const center = getPolygonCenter(feature.geometry);
            is3DView = true;
            map.flyTo({ center, zoom: 17.5, pitch: 66, bearing: -25 });
            showBuildingPopup(center, feature.properties, feature.id);
        });
        listEl.appendChild(li);
    });
}

function popupContent(props, id) {
    return `<strong>${escapeMapText(props.displayName)}</strong><br>
    <span style="color:#a65b00">${simulationEnabled ? `Simulation · ${formatMinute(selectedMinute)}` : "Sample snapshot"}</span><br>
    Crowd level: <b>${props.occupancy}%</b> (~${props.headcount} people)<br>
    Capacity: ${props.capacity}<br>
    3D height: ${Math.round(props.renderHeight)} m<br>
    <small>ID: ${escapeMapText(id || "N/A")}</small>`;
}

function showBuildingPopup(lngLat, props, id) {
    if (activePopup) activePopup.remove();
    popupFeatureId = String(props.featureId || id);
    const popup = new maplibregl.Popup().setLngLat(lngLat)
        .setHTML(popupContent(props, id)).addTo(map);
    activePopup = popup;
    popup.on("close", () => {
        if (activePopup === popup) { activePopup = null; popupFeatureId = null; }
    });
}

function assembleRings(wayIds, waysMap, nodesMap) {
    const segments = wayIds
        .map((id) => waysMap.get(id))
        .filter((w) => w && Array.isArray(w.nodes) && w.nodes.length >= 2)
        .map((w) => [...w.nodes]);

    const rings = [];
    while (segments.length > 0) {
        let chain = segments.shift();
        let extended = true;
        while (extended && chain[0] !== chain[chain.length - 1]) {
            extended = false;
            const tail = chain[chain.length - 1];
            const head = chain[0];
            for (let i = 0; i < segments.length; i++) {
                const seg = segments[i];
                if (seg[0] === tail) {
                    chain = chain.concat(seg.slice(1));
                    segments.splice(i, 1);
                    extended = true;
                    break;
                }
                if (seg[seg.length - 1] === tail) {
                    chain = chain.concat([...seg].reverse().slice(1));
                    segments.splice(i, 1);
                    extended = true;
                    break;
                }
                if (seg[seg.length - 1] === head) {
                    chain = seg.slice(0, -1).concat(chain);
                    segments.splice(i, 1);
                    extended = true;
                    break;
                }
                if (seg[0] === head) {
                    chain = [...seg].reverse().slice(0, -1).concat(chain);
                    segments.splice(i, 1);
                    extended = true;
                    break;
                }
            }
        }

        const coords = chain.map((nid) => nodesMap.get(nid)).filter(Boolean);
        if (coords.length >= 4) {
            if (
                coords[0][0] !== coords[coords.length - 1][0] ||
                coords[0][1] !== coords[coords.length - 1][1]
            ) {
                coords.push(coords[0]);
            }
            rings.push(coords);
        }
    }
    return rings;
}

// Fast native OSM JSON -> GeoJSON converter (supports building ways and stadium relations)
function osmWaysToGeoJson(osmData) {
    const nodes = new Map();
    const ways = new Map();
    const elements = osmData.elements || [];

    elements.forEach((el) => {
        if (el.type === "node") nodes.set(el.id, [el.lon, el.lat]);
        if (el.type === "way") ways.set(el.id, el);
    });

    const features = [];
    elements.forEach((el) => {
        if (el.type === "way" && Array.isArray(el.nodes) && el.tags) {
            const coords = [];
            for (let i = 0; i < el.nodes.length; i++) {
                const pt = nodes.get(el.nodes[i]);
                if (pt) coords.push(pt);
            }
            if (coords.length >= 4) {
                features.push({
                    type: "Feature",
                    id: `way/${el.id}`,
                    properties: el.tags,
                    geometry: { type: "Polygon", coordinates: [coords] }
                });
            }
        } else if (
            el.type === "relation" &&
            el.tags &&
            el.tags.leisure === "stadium" &&
            Array.isArray(el.members)
        ) {
            const outerIds = el.members
                .filter((m) => m.type === "way" && m.role === "outer")
                .map((m) => m.ref);
            const innerIds = el.members
                .filter((m) => m.type === "way" && m.role === "inner")
                .map((m) => m.ref);

            const outerRings = assembleRings(outerIds, ways, nodes);
            const innerRings = assembleRings(innerIds, ways, nodes);

            if (outerRings.length > 0) {
                features.push({
                    type: "Feature",
                    id: `relation/${el.id}`,
                    properties: el.tags,
                    geometry: {
                        type: "Polygon",
                        coordinates: [outerRings[0], ...innerRings]
                    }
                });
            }
        }
    });
    return { type: "FeatureCollection", features };
}

async function fetchFullUtkFootprintsQuietly() {
    // Fast lightweight query: campus buildings + stadium ways/relations
    const query = `[out:json][timeout:6];(way["building"](${UTK_BBOX});way["leisure"="stadium"](${UTK_BBOX});relation["leisure"="stadium"](${UTK_BBOX}););out body;>;out skel qt;`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    try {
        const res = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: query,
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!res.ok) return null;
        const osmJson = await res.json();
        const geojson = osmWaysToGeoJson(osmJson);
        if (geojson.features.length > 5) {
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify(geojson));
            } catch (e) {}
            return geojson;
        }
    } catch (e) {
        clearTimeout(timer);
    }
    return null;
}

function getInitialBuildingsSync() {
    try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (cached && Array.isArray(cached.features) && cached.features.length > 5) {
            return cached;
        }
    } catch (e) {}
    return JSON.parse(JSON.stringify(INSTANT_UTK_GEOJSON));
}

function hideBaseMapBuildings() {
    const style = map.getStyle();
    if (!style || !style.layers) return;
    style.layers.forEach((layer) => {
        if (
            layer["source-layer"] === "building" ||
            layer.id.toLowerCase().includes("building")
        ) {
            map.setLayoutProperty(layer.id, "visibility", "none");
        }
    });
}

function inject3DControls() {
    const buttonRow = document.querySelector(".button-row");
    if (buttonRow && !document.getElementById("tilt3dBtn")) {
        const tiltBtn = document.createElement("button");
        tiltBtn.id = "tilt3dBtn";
        tiltBtn.type = "button";
        tiltBtn.className = "secondary active";
        tiltBtn.textContent = "3D: On";
        tiltBtn.addEventListener("click", () => {
            is3DView = !is3DView;
            tiltBtn.textContent = is3DView ? "3D: On" : "3D: Off";
            tiltBtn.classList.toggle("active", is3DView);
            map.easeTo({
                pitch: is3DView ? 64 : 0,
                bearing: is3DView ? -26 : 0,
                duration: 500
            });
        });
        buttonRow.appendChild(tiltBtn);
    }
}

function updateMapData(rawGeoJson) {
    campusGeoJson = enrichGeoJson(rawGeoJson);
    const count = new Set(campusGeoJson.features.map((f) => f.properties.displayName)).size;
    document.getElementById("statusText").textContent =
        timelineStatus(count);

    const src = map.getSource("utk-buildings");
    if (src) src.setData(campusGeoJson);
    if (activePopup && popupFeatureId) {
        const feature = campusGeoJson.features.find(item => item.properties.featureId === popupFeatureId);
        if (feature) activePopup.setHTML(popupContent(feature.properties, feature.id));
        else activePopup.remove();
    }
    renderSidebarList(document.getElementById("searchInput").value);
}

// Load local occupancy.json immediately
const occupancyPromise = (window.LOCAL_OCCUPANCY_DATA ? Promise.resolve({ ok: true, json: () => Promise.resolve(window.LOCAL_OCCUPANCY_DATA) }) : fetch("../data/occupancy.json"))
    .then((r) => (r.ok ? r.json() : { buildings: {} }))
    .then((j) => j.buildings || {})
    .catch(() => ({}));

map.on("load", async () => {
    inject3DControls();
    injectTimelineControls();
    hideBaseMapBuildings();

    // Low uniform light keeps building faces solid, bright, and free of shadow flicker
    map.setLight({
        anchor: "viewport",
        color: "#ffffff",
        intensity: 0.15,
        position: [1.2, 200, 45]
    });

    occupancyData = await occupancyPromise;

    // 1. Render immediately in 0ms using cached or built-in UTK footprints (never stalls!)
    campusGeoJson = enrichGeoJson(getInitialBuildingsSync());

    const initialCount = new Set(
        campusGeoJson.features.map((f) => f.properties.displayName)
    ).size;
    document.getElementById("statusText").textContent =
        timelineStatus(initialCount);

    map.addSource("utk-buildings", {
        type: "geojson",
        data: campusGeoJson
    });

    const layers = map.getStyle().layers || [];
    const firstSymbolLayer = layers.find((l) => l.type === "symbol");
    const beforeId = firstSymbolLayer ? firstSymbolLayer.id : undefined;

    // 2. UTK Orange (#FF8200) perimeter border around every UTK campus building
    map.addLayer(
        {
            id: "utk-building-borders",
            type: "line",
            source: "utk-buildings",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
                "line-color": "#FF8200",
                "line-width": ["interpolate", ["linear"], ["zoom"], 14, 2, 16, 3.5, 18, 5],
                "line-opacity": 1
            }
        },
        beforeId
    );

    // 3. Hover border highlight in UTK Orange
    map.addLayer(
        {
            id: "utk-building-hover-border",
            type: "line",
            source: "utk-buildings",
            filter: ["==", ["get", "featureId"], ""],
            paint: {
                "line-color": "#FF8200",
                "line-width": 6,
                "line-opacity": 1
            }
        },
        beforeId
    );

    // 4. Solid, opaque 3D extrusions strictly on UTK campus (zero Z-fighting)
    map.addLayer(
        {
            id: "utk-3d-extrusion",
            type: "fill-extrusion",
            source: "utk-buildings",
            paint: {
                "fill-extrusion-height": ["get", "renderHeight"],
                "fill-extrusion-base": 0.25,
                "fill-extrusion-vertical-gradient": false,
                "fill-extrusion-opacity": 1,
                "fill-extrusion-color": [
                    "step",
                    ["get", "occupancy"],
                    "#2ecc71",
                    45, "#f1c40f",
                    76, "#e74c3c"
                ]
            }
        },
        beforeId
    );

    renderSidebarList();

// 5. Silently expand to all ~150+ UTK campus buildings in the background
    (window.LOCAL_UTK_BUILDINGS ? Promise.resolve({ ok: true, json: () => Promise.resolve(window.LOCAL_UTK_BUILDINGS) }) : fetch("../data/utk-buildings.geojson"))
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
        .then((localFile) => localFile || fetchFullUtkFootprintsQuietly())
        .then((fullGeoJson) => {
            if (fullGeoJson) updateMapData(fullGeoJson);
        });

    map.on("click", "utk-3d-extrusion", (e) => {
        const feature = e.features[0];
        showBuildingPopup(e.lngLat, feature.properties, feature.id);
    });

    map.on("mousemove", "utk-3d-extrusion", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const hoveredId = e.features[0]?.properties?.featureId || "";
        map.setFilter("utk-building-hover-border", ["==", ["get", "featureId"], hoveredId]);
    });

    map.on("mouseleave", "utk-3d-extrusion", () => {
        map.getCanvas().style.cursor = "";
        map.setFilter("utk-building-hover-border", ["==", ["get", "featureId"], ""]);
    });
});

document.getElementById("searchInput").addEventListener("input", (e) => {
    renderSidebarList(e.target.value);
});

document.getElementById("simulateBtn").addEventListener("click", () => {
    stopPlayback();
    simulationEnabled = false;
    refreshTimeline();
});

document.getElementById("autoToggle").addEventListener("click", () => {
    if (autoTimer !== null) { stopPlayback(); return; }
    simulationEnabled = true;
    if (selectedMinute >= 1425) selectedMinute = 0;
    refreshTimeline();
    const button = document.getElementById("autoToggle");
    button.textContent = "❚❚ Pause";
    button.classList.add("active");
    button.setAttribute("aria-pressed", "true");
    autoTimer = setInterval(() => {
        selectedMinute = Math.min(1425, selectedMinute + 15);
        refreshTimeline();
        if (selectedMinute >= 1425) stopPlayback();
    }, 800);
});
document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopPlayback();
});
window.addEventListener("pagehide", stopPlayback);
