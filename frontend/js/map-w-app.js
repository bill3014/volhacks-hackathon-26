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
      fallbackOcc[name] = Math.floor(20 + Math.random() * 50);
    }

    const occupancy = tracked ? tracked.occupancy : fallbackOcc[name];
    const capacity = tracked ? tracked.capacity : 300;

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
        <div class="building-name">${displayName}</div>
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

function showBuildingPopup(lngLat, props, id) {
  new maplibregl.Popup()
    .setLngLat(lngLat)
    .setHTML(`
      <strong>${props.displayName}</strong><br/>
      Crowd Level: <b>${props.occupancy}%</b> (~${props.headcount} people)<br/>
      3D Height: ${Math.round(props.renderHeight)} m<br/>
      <small style="color:#6b7280">ID: ${id || "N/A"}</small>
    `)
    .addTo(map);
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
    `Tracking ${count} 3D UTK campus buildings`;

  const src = map.getSource("utk-buildings");
  if (src) src.setData(campusGeoJson);
  renderSidebarList(document.getElementById("searchInput").value);
}

function simulateLiveUpdate() {
  if (!campusGeoJson) return;
  Object.keys(occupancyData).forEach((name) => {
    const delta = Math.floor(Math.random() * 21) - 10;
    occupancyData[name].occupancy = Math.min(
      99,
      Math.max(8, occupancyData[name].occupancy + delta)
    );
  });
  updateMapData(campusGeoJson);
}

// Load local occupancy.json immediately
const occupancyPromise = fetch("./data/occupancy.json")
  .then((r) => (r.ok ? r.json() : { buildings: {} }))
  .then((j) => j.buildings || {})
  .catch(() => ({}));

map.on("load", async () => {
  inject3DControls();
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
    `Tracking ${initialCount} 3D UTK campus buildings`;

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
  fetch("./data/utk-buildings.geojson")
    .then((r) => (r.ok ? r.json() : null))
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

document.getElementById("simulateBtn").addEventListener("click", simulateLiveUpdate);

document.getElementById("autoToggle").addEventListener("click", (e) => {
  const btn = e.target;
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
    btn.textContent = "Auto: Off";
    btn.classList.remove("active");
  } else {
    autoTimer = setInterval(simulateLiveUpdate, 3000);
    btn.textContent = "Auto: On (3s)";
    btn.classList.add("active");
  }
});