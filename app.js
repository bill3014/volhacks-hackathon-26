const UTK_CENTER = [-83.9295, 35.9544];
const UTK_BBOX = "35.9400,-83.9520,35.9650,-83.9150";

// GeoJSON polygon matching UTK_BBOX used to clip out duplicate base-map buildings
const UTK_CLIP_POLYGON = {
  type: "Polygon",
  coordinates: [[
    [-83.9520, 35.9400],
    [-83.9150, 35.9400],
    [-83.9150, 35.9650],
    [-83.9520, 35.9650],
    [-83.9520, 35.9400]
  ]]
};

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
  style: "https://tiles.openfreemap.org/styles/liberty",
  center: UTK_CENTER,
  zoom: 16.0,
  pitch: 66,
  bearing: -28,
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

function getSeverityClass(pct) {
  if (pct < 45) return "low";
  if (pct <= 75) return "mid";
  return "high";
}

function parseDimensionMeters(props, heightKey, levelsKey, fallback) {
  if (props[heightKey]) {
    const parsed = parseFloat(String(props[heightKey]).replace(/[^\d.-]/g, ""));
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  if (props[levelsKey]) {
    const levels = parseFloat(String(props[levelsKey]).replace(/[^\d.-]/g, ""));
    if (!Number.isNaN(levels) && levels > 0) return levels * 5;
  }
  return fallback;
}

function enrichGeoJson(geojson) {
  geojson.features = geojson.features.filter(
    (f) =>
      f.geometry &&
      (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon")
  );

  const namedParents = geojson.features
    .filter((f) => f.properties && !f.properties["building:part"])
    .map((f) => ({
      name: f.properties.name || null,
      ring: getOuterRing(f.geometry),
      feature: f,
      partCount: 0
    }));

  // Link building:part tiers to their enclosing parent building so outer shells don't z-fight
  geojson.features.forEach((feature) => {
    const props = feature.properties || {};
    if (props["building:part"]) {
      const center = getPolygonCenter(feature.geometry);
      const match = namedParents.find((p) => isPointInRing(center, p.ring));
      if (match) {
        match.partCount += 1;
        if (!props.name && match.name) {
          props.name = match.name;
        }
      }
    }
  });

  const parentShellsWithParts = new Set(
    namedParents.filter((p) => p.partCount >= 2).map((p) => p.feature)
  );

  const fallbackOccupancyByName = {};

  geojson.features.forEach((feature) => {
    const props = feature.properties || {};
    const isPart = Boolean(props["building:part"]);
    const name = props.name || "UTK Campus Building";

    // Lift base 5cm above ground plane to eliminate ground-level z-fighting
    const renderBase = Math.max(
      0.05,
      parseDimensionMeters(props, "min_height", "building:min_level", 0.05)
    );

    let renderHeight =
      !isPart && BUILDING_HEIGHT_OVERRIDES[name]
        ? BUILDING_HEIGHT_OVERRIDES[name]
        : parseDimensionMeters(
            props,
            "height",
            "building:levels",
            isPart ? renderBase + 10 : 18
          );

    if (!isPart && renderHeight < 15) {
      renderHeight = 15;
    }
    if (renderHeight <= renderBase) {
      renderHeight = renderBase + 8;
    }

    const tracked = occupancyData[name];
    if (!tracked && fallbackOccupancyByName[name] === undefined) {
      fallbackOccupancyByName[name] = Math.floor(20 + Math.random() * 50);
    }

    const occupancy = tracked
      ? tracked.occupancy
      : fallbackOccupancyByName[name];
    const capacity = tracked ? tracked.capacity : 300;

    feature.properties.displayName = name;
    feature.properties.isPart = isPart;
    feature.properties.hasParts = !isPart && parentShellsWithParts.has(feature);
    feature.properties.renderBase = renderBase;
    feature.properties.renderHeight = renderHeight;
    feature.properties.occupancy = occupancy;
    feature.properties.capacity = capacity;
    feature.properties.headcount = Math.round((occupancy / 100) * capacity);
  });

  return geojson;
}

function renderSidebarList(filterText = "") {
  if (!campusGeoJson) return;
  const listEl = document.getElementById("buildingList");
  const query = filterText.trim().toLowerCase();

  const byName = new Map();
  campusGeoJson.features.forEach((f) => {
    const name = f.properties.name;
    if (!name || !name.toLowerCase().includes(query)) return;
    if (!byName.has(name) || (!f.properties.isPart && byName.get(name).properties.isPart)) {
      byName.set(name, f);
    }
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
      map.flyTo({ center, zoom: 17.5, pitch: 68, bearing: -25 });
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

async function fetchUtkBuildings() {
  const query = `
    [out:json][timeout:25];
    (
      way["building"](${UTK_BBOX});
      relation["building"](${UTK_BBOX});
      way["building:part"](${UTK_BBOX});
      relation["building:part"](${UTK_BBOX});
    );
    out body;
    >;
    out skel qt;
  `;

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query
    });
    if (!response.ok) throw new Error("Overpass API error");
    const osmJson = await response.json();
    return osmtogeojson(osmJson);
  } catch (err) {
    console.warn("Falling back to local UTK footprints:", err);
    return JSON.parse(JSON.stringify(FALLBACK_GEOJSON));
  }
}

// Convert any legacy MapLibre filter to modern expression syntax before combining with within()
function toExpressionFilter(f) {
  if (!f || !Array.isArray(f)) return null;
  const op = f[0];
  if (op === "all" || op === "any") {
    const parts = f.slice(1).map(toExpressionFilter).filter(Boolean);
    return parts.length ? [op, ...parts] : null;
  }
  if (op === "none") {
    const parts = f.slice(1).map(toExpressionFilter).filter(Boolean);
    return parts.length ? ["!", ["any", ...parts]] : null;
  }
  if ((op === "==" || op === "!=" || op === "<" || op === "<=" || op === ">" || op === ">=") && typeof f[1] === "string") {
    return [op, ["get", f[1]], f[2]];
  }
  if (op === "!has" && typeof f[1] === "string") {
    return ["!", ["has", f[1]]];
  }
  if (op === "in" && typeof f[1] === "string") {
    return ["in", ["get", f[1]], ["literal", f.slice(2)]];
  }
  if (op === "!in" && typeof f[1] === "string") {
    return ["!", ["in", ["get", f[1]], ["literal", f.slice(2)]]];
  }
  return f;
}

function clipBaseStyleBuildingsOnCampus() {
  const layers = map.getStyle().layers || [];
  const outsideUtkExpr = ["!", ["within", UTK_CLIP_POLYGON]];

  layers.forEach((layer) => {
    const isBase3D =
      layer.type === "fill-extrusion" && layer.id !== "utk-3d-extrusion";
    const isBase2DBuilding =
      layer.type === "fill" && layer["source-layer"] === "building";

    if (isBase3D || isBase2DBuilding) {
      const existingExpr = toExpressionFilter(map.getFilter(layer.id));
      map.setFilter(
        layer.id,
        existingExpr ? ["all", existingExpr, outsideUtkExpr] : outsideUtkExpr
      );
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
        map.easeTo({ pitch: 66, bearing: -28, duration: 700 });
      } else {
        tiltBtn.textContent = "3D: Off";
        tiltBtn.classList.remove("active");
        map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
      }
    });
    buttonRow.appendChild(tiltBtn);
  }

  const mapEl = document.getElementById("map");
  if (mapEl && !document.getElementById("tiltHint")) {
    const hint = document.createElement("div");
    hint.id = "tiltHint";
    hint.textContent = "Right-click + drag (or Ctrl + drag) to tilt & orbit in 3D";
    Object.assign(hint.style, {
      position: "absolute",
      bottom: "14px",
      right: "14px",
      background: "rgba(17, 24, 39, 0.82)",
      color: "#ffffff",
      padding: "6px 12px",
      borderRadius: "8px",
      fontSize: "12px",
      zIndex: "5",
      pointerEvents: "none"
    });
    mapEl.appendChild(hint);
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

  // Remove duplicate base-map 3D/2D buildings inside UTK campus to stop z-fighting
  clipBaseStyleBuildingsOnCampus();

  map.setLight({
    anchor: "viewport",
    color: "#ffffff",
    intensity: 0.6,
    position: [1.5, 210, 35]
  });

  try {
    const occRes = await fetch("./data/occupancy.json");
    const occJson = await occRes.json();
    occupancyData = occJson.buildings || {};
  } catch (e) {
    console.warn("Could not load data/occupancy.json; using generated values.");
  }

  const rawGeoJson = await fetchUtkBuildings();
  campusGeoJson = enrichGeoJson(rawGeoJson);

  const uniqueBuildingCount = new Set(
    campusGeoJson.features.map((f) => f.properties.displayName)
  ).size;

  document.getElementById("statusText").textContent =
    `Tracking ${uniqueBuildingCount} 3D UTK buildings`;

  map.addSource("utk-buildings", {
    type: "geojson",
    data: campusGeoJson
  });

  const layers = map.getStyle().layers || [];
  const firstSymbolLayer = layers.find((l) => l.type === "symbol");
  const beforeId = firstSymbolLayer ? firstSymbolLayer.id : undefined;

  // Opaque (opacity: 1) extrusion enables proper WebGL depth-buffer occlusion
  map.addLayer(
    {
      id: "utk-3d-extrusion",
      type: "fill-extrusion",
      source: "utk-buildings",
      filter: ["!=", ["get", "hasParts"], true],
      paint: {
        "fill-extrusion-height": ["get", "renderHeight"],
        "fill-extrusion-base": ["get", "renderBase"],
        "fill-extrusion-vertical-gradient": true,
        "fill-extrusion-opacity": 1,
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["get", "occupancy"],
          20, "#2ecc71",
          60, "#f1c40f",
          85, "#e74c3c"
        ]
      }
    },
    beforeId
  );

  renderSidebarList();

  map.on("click", "utk-3d-extrusion", (e) => {
    const feature = e.features[0];
    showBuildingPopup(e.lngLat, feature.properties, feature.id);
  });

  map.on("mouseenter", "utk-3d-extrusion", () => {
    map.getCanvas().style.cursor = "pointer";
  });

  map.on("mouseleave", "utk-3d-extrusion", () => {
    map.getCanvas().style.cursor = "";
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