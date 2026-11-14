const UTK_CENTER = [-83.9295, 35.9544];
const UTK_BBOX = "35.9430,-83.9475,35.9600,-83.9205";
const CACHE_KEY = "utk_3d_buildings_cache_v3";

// Official UTK Campus zones (Main Campus, The Hill, West Campus, Athletics, and Ag Campus)
const UTK_CAMPUS_ZONES = [
  {
    // Main Campus, The Hill, West Campus & Athletic District
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
    // UT Institute of Agriculture (Ag Campus)
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

const EXCLUDED_BUILDING_TYPES = new Set([
  "house",
  "detached",
  "semidetached_house",
  "terrace",
  "bungalow",
  "static_caravan"
]);

let occupancyData = {};
let campusGeoJson = null;
let autoTimer = null;
let is3DView = true;

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

const FALLBACK_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "fallback/hodges",
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
      id: "fallback/student-union",
      properties: { name: "Student Union", height: "26" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-83.9285, 35.9569], [-83.9272, 35.9569],
          [-83.9272, 35.9560], [-83.9285, 35.9560], [-83.9285, 35.9569]
        ]]
      }
    },
    {
      type: "Feature",
      id: "fallback/ayres",
      properties: { name: "Ayres Hall", height: "42" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-83.9265, 35.9577], [-83.9256, 35.9577],
          [-83.9256, 35.9571], [-83.9265, 35.9571], [-83.9265, 35.9577]
        ]]
      }
    }
  ]
};

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

function isPointInGeometry(point, geometry) {
  if (!geometry || !geometry.coordinates) return false;
  if (geometry.type === "Polygon") {
    if (!isPointInRing(point, geometry.coordinates[0])) return false;
    for (let i = 1; i < geometry.coordinates.length; i++) {
      if (isPointInRing(point, geometry.coordinates[i])) return false;
    }
    return true;
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polyCoords) => {
      if (!isPointInRing(point, polyCoords[0])) return false;
      for (let i = 1; i < polyCoords.length; i++) {
        if (isPointInRing(point, polyCoords[i])) return false;
      }
      return true;
    });
  }
  return false;
}

function isUtkCampusBuilding(feature, osmCampusGeometries) {
  const props = feature.properties || {};
  if (!props.building) return false;

  const buildingType = String(props.building).toLowerCase();
  const operator = String(props.operator || "").toLowerCase();
  const isTaggedUtk =
    buildingType === "university" ||
    buildingType === "dormitory" ||
    buildingType === "college" ||
    operator.includes("university of tennessee") ||
    operator.includes("utk");

  if (EXCLUDED_BUILDING_TYPES.has(buildingType) && !isTaggedUtk) {
    return false;
  }

  const center = getPolygonCenter(feature.geometry);
  const ring = getOuterRing(feature.geometry) || [];
  const testPoints = [center, ...ring.filter((_, idx) => idx % 2 === 0)];

  // 1. Check against official OSM amenity=university boundary polygons if returned
  if (osmCampusGeometries.length > 0) {
    const inOsmBoundary = testPoints.some((pt) =>
      osmCampusGeometries.some((campusGeom) => isPointInGeometry(pt, campusGeom))
    );
    if (inOsmBoundary) return true;
  }

  // 2. Check against defined UTK Main Campus & Ag Campus zones
  const inCampusZone = testPoints.some((pt) =>
    UTK_CAMPUS_ZONES.some((zone) => isPointInGeometry(pt, zone))
  );

  return inCampusZone || isTaggedUtk;
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
  const allFeatures = geojson.features || [];

  // Extract OSM campus boundary polygons (amenity=university) for accurate campus clipping,
  // without rendering the campus ground polygon itself as a 3D building
  const osmCampusGeometries = allFeatures
    .filter(
      (f) =>
        f.geometry &&
        (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") &&
        f.properties &&
        f.properties.amenity === "university" &&
        !f.properties.building
    )
    .map((f) => f.geometry);

  // Keep only buildings located strictly ON UTK campus
  const utkBuildingsOnly = allFeatures.filter((f) => {
    if (!f.geometry || (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon")) {
      return false;
    }
    return isUtkCampusBuilding(f, osmCampusGeometries);
  });

  // Deduplicate overlapping OSM way/relation entries for the same building to prevent z-fighting
  const deduped = [];
  const seenByName = new Map();

  utkBuildingsOnly.forEach((feature) => {
    const props = feature.properties || {};
    const name = props.name || "";
    const ring = getOuterRing(feature.geometry);
    const area = getRingAreaApprox(ring);

    if (name && seenByName.has(name)) {
      const existingIdx = seenByName.get(name);
      const existingCenter = getPolygonCenter(deduped[existingIdx].geometry);
      const currentCenter = getPolygonCenter(feature.geometry);
      const dist = Math.hypot(
        existingCenter[0] - currentCenter[0],
        existingCenter[1] - currentCenter[1]
      );
      if (dist < 0.0002) {
        if (area > deduped[existingIdx]._area) {
          feature._area = area;
          deduped[existingIdx] = feature;
        }
        return;
      }
    }

    feature._area = area;
    if (name) seenByName.set(name, deduped.length);
    deduped.push(feature);
  });

  const fallbackOccupancyByName = {};

  deduped.forEach((feature, index) => {
    const props = feature.properties || {};
    const name = props.name || "UTK Campus Building";

    let renderHeight = BUILDING_HEIGHT_OVERRIDES[name]
      ? BUILDING_HEIGHT_OVERRIDES[name]
      : parseHeightMeters(props, 18);

    if (renderHeight < 15) renderHeight = 15;

    const tracked = occupancyData[name];
    if (!tracked && fallbackOccupancyByName[name] === undefined) {
      fallbackOccupancyByName[name] = Math.floor(20 + Math.random() * 50);
    }

    const occupancy = tracked ? tracked.occupancy : fallbackOccupancyByName[name];
    const capacity = tracked ? tracked.capacity : 300;

    feature.id = feature.id || `utk-bldg-${index}`;
    feature.properties.featureId = String(feature.id);
    feature.properties.displayName = name;
    feature.properties.renderHeight = renderHeight;
    feature.properties.occupancy = occupancy;
    feature.properties.capacity = capacity;
    feature.properties.headcount = Math.round((occupancy / 100) * capacity);
  });

  return {
    type: "FeatureCollection",
    features: deduped
  };
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

  const sortedBuildings = Array.from(byName.values()).sort(
    (a, b) => b.properties.occupancy - a.properties.occupancy
  );

  listEl.innerHTML = "";
  sortedBuildings.forEach((feature) => {
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

function readCachedBuildings() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.features) && parsed.features.length > 0) {
      return parsed;
    }
  } catch (e) {
    // Ignore storage errors
  }
  return null;
}

function saveCachedBuildings(geojson) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(geojson));
  } catch (e) {
    // Ignore quota errors
  }
}

async function fetchUtkBuildingsFromNetwork() {
  const query = `
    [out:json][timeout:10];
    (
      way["building"](${UTK_BBOX});
      relation["building"](${UTK_BBOX});
      way["amenity"="university"](${UTK_BBOX});
      relation["amenity"="university"](${UTK_BBOX});
    );
    out body;
    >;
    out skel qt;
  `;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7500);

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error("Overpass API error");
    const osmJson = await response.json();
    const converted = osmtogeojson(osmJson);
    if (converted && converted.features && converted.features.length > 0) {
      saveCachedBuildings(converted);
      return converted;
    }
    throw new Error("Empty Overpass response");
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn("Using fallback UTK footprints:", err);
    return JSON.parse(JSON.stringify(FALLBACK_GEOJSON));
  }
}

// Fetch occupancy and UTK campus footprints in parallel immediately on page load
const occupancyPromise = fetch("./data/occupancy.json")
  .then((r) => (r.ok ? r.json() : { buildings: {} }))
  .then((j) => j.buildings || {})
  .catch(() => ({}));

const cachedBuildings = readCachedBuildings();
const buildingsPromise = cachedBuildings
  ? Promise.resolve(cachedBuildings)
  : fetchUtkBuildingsFromNetwork();

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
      if (is3DView) {
        tiltBtn.textContent = "3D: On";
        tiltBtn.classList.add("active");
        map.easeTo({ pitch: 64, bearing: -26, duration: 600 });
      } else {
        tiltBtn.textContent = "3D: Off";
        tiltBtn.classList.remove("active");
        map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
      }
    });
    buttonRow.appendChild(tiltBtn);
  }
}

function simulateLiveUpdate() {
  if (!campusGeoJson) return;
  Object.keys(occupancyData).forEach((buildingName) => {
    const delta = Math.floor(Math.random() * 21) - 10;
    const next = Math.min(
      99,
      Math.max(8, occupancyData[buildingName].occupancy + delta)
    );
    occupancyData[buildingName].occupancy = next;
  });

  campusGeoJson = enrichGeoJson(campusGeoJson);
  map.getSource("utk-buildings").setData(campusGeoJson);
  renderSidebarList(document.getElementById("searchInput").value);
}

map.on("load", async () => {
  inject3DControls();
  hideBaseMapBuildings();

  // Gentle uniform lighting keeps solid colors clean without harsh shading artifacts
  map.setLight({
    anchor: "viewport",
    color: "#ffffff",
    intensity: 0.25,
    position: [1.2, 200, 45]
  });

  const [loadedOccupancy, rawGeoJson] = await Promise.all([
    occupancyPromise,
    buildingsPromise
  ]);

  occupancyData = loadedOccupancy;
  campusGeoJson = enrichGeoJson(rawGeoJson);

  const uniqueBuildingCount = new Set(
    campusGeoJson.features.map((f) => f.properties.displayName)
  ).size;

  document.getElementById("statusText").textContent =
    `Tracking ${uniqueBuildingCount} 3D UTK campus buildings`;

  map.addSource("utk-buildings", {
    type: "geojson",
    data: campusGeoJson
  });

  const layers = map.getStyle().layers || [];
  const firstSymbolLayer = layers.find((l) => l.type === "symbol");
  const beforeId = firstSymbolLayer ? firstSymbolLayer.id : undefined;

  // 1. UTK Orange (#FF8200) perimeter border around every UTK campus building
  map.addLayer(
    {
      id: "utk-building-borders",
      type: "line",
      source: "utk-buildings",
      layout: {
        "line-join": "round",
        "line-cap": "round"
      },
      paint: {
        "line-color": "#FF8200",
        "line-width": ["interpolate", ["linear"], ["zoom"], 14, 1.5, 16, 2.6, 18, 3.8],
        "line-opacity": 1
      }
    },
    beforeId
  );

  // 2. Thicker UTK Orange border highlight when hovering over a building
  map.addLayer(
    {
      id: "utk-building-hover-border",
      type: "line",
      source: "utk-buildings",
      filter: ["==", ["get", "featureId"], ""],
      paint: {
        "line-color": "#FF8200",
        "line-width": 5,
        "line-opacity": 1
      }
    },
    beforeId
  );

  // 3. Solid, opaque 3D extrusions strictly for UTK campus buildings (zero z-fighting)
  map.addLayer(
    {
      id: "utk-3d-extrusion",
      type: "fill-extrusion",
      source: "utk-buildings",
      paint: {
        "fill-extrusion-height": ["get", "renderHeight"],
        "fill-extrusion-base": 0.1,
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

  // Refresh cache silently in the background if loaded from localStorage
  if (cachedBuildings) {
    fetchUtkBuildingsFromNetwork().then((freshGeoJson) => {
      if (freshGeoJson && freshGeoJson.features && freshGeoJson.features.length > 3) {
        campusGeoJson = enrichGeoJson(freshGeoJson);
        const src = map.getSource("utk-buildings");
        if (src) src.setData(campusGeoJson);
        renderSidebarList(document.getElementById("searchInput").value);
      }
    });
  }

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