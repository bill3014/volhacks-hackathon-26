const UTK_CENTER = [-83.9295, 35.9544];
const UTK_BBOX = "35.9400,-83.9520,35.9650,-83.9150";

let occupancyData = {};
let campusGeoJson = null;
let autoTimer = null;

const FALLBACK_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "fallback/hodges-base",
      properties: { name: "John C. Hodges Library", "building:levels": "6" },
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
      id: "fallback/hodges-tower",
      properties: {
        name: "John C. Hodges Library",
        "building:part": "yes",
        height: "34",
        min_height: "24"
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-83.9296, 35.9552], [-83.9291, 35.9552],
          [-83.9291, 35.9548], [-83.9296, 35.9548], [-83.9296, 35.9552]
        ]]
      }
    },
    {
      type: "Feature",
      id: "fallback/student-union",
      properties: { name: "Student Union", "building:levels": "4" },
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
      id: "fallback/ayres-main",
      properties: { name: "Ayres Hall", "building:levels": "3" },
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
      id: "fallback/ayres-tower",
      properties: {
        name: "Ayres Hall",
        "building:part": "yes",
        height: "38",
        min_height: "12"
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-83.9262, 35.9575], [-83.9259, 35.9575],
          [-83.9259, 35.9573], [-83.9262, 35.9573], [-83.9262, 35.9575]
        ]]
      }
    }
  ]
};

const map = new maplibregl.Map({
  container: "map",
  style: "https://tiles.openfreemap.org/styles/positron",
  center: UTK_CENTER,
  zoom: 16.1,
  pitch: 62,
  bearing: -24,
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
    if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
  }
  if (props[levelsKey]) {
    const levels = parseFloat(String(props[levelsKey]).replace(/[^\d.-]/g, ""));
    if (!Number.isNaN(levels) && levels >= 0) return levels * 4;
  }
  return fallback;
}

function enrichGeoJson(geojson) {
  geojson.features = geojson.features.filter(
    (f) =>
      f.geometry &&
      (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon")
  );

  // Collect named campus buildings so unnamed building:part tiers inherit their parent name & crowd density
  const namedParentBuildings = geojson.features
    .filter((f) => f.properties && f.properties.name && !f.properties["building:part"])
    .map((f) => ({
      name: f.properties.name,
      ring: getOuterRing(f.geometry),
      feature: f
    }));

  const parentFeaturesWithParts = new Set();

  geojson.features.forEach((feature) => {
    const props = feature.properties || {};
    const isPart = Boolean(props["building:part"]);

    if (isPart) {
      const center = getPolygonCenter(feature.geometry);
      const enclosingParent = namedParentBuildings.find((parent) =>
        isPointInRing(center, parent.ring)
      );
      if (enclosingParent) {
        if (!props.name) {
          props.name = enclosingParent.name;
        }
        parentFeaturesWithParts.add(enclosingParent.feature);
      }
    }
  });

  // Keep consistent random fallback values per building name across updates
  const fallbackOccupancyByName = {};

  geojson.features.forEach((feature) => {
    const props = feature.properties || {};
    const isPart = Boolean(props["building:part"]);
    const name = props.name || "UTK Campus Building";

    const renderBase = parseDimensionMeters(
      props,
      "min_height",
      "building:min_level",
      0
    );
    let renderHeight = parseDimensionMeters(
      props,
      "height",
      "building:levels",
      isPart ? renderBase + 6 : 12
    );
    if (renderHeight <= renderBase) {
      renderHeight = renderBase + 4;
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
    feature.properties.hasParts = !isPart && parentFeaturesWithParts.has(feature);
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

  // Deduplicate sidebar entries by building name (preferring main footprint over individual roof parts)
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
      map.flyTo({ center, zoom: 17.6, pitch: 66 });
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
      Elevation: ${Math.round(props.renderBase)}–${Math.round(props.renderHeight)} m<br/>
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

function addF4Citywide3DContext() {
  const style = map.getStyle();
  if (!style || !style.sources) return;

  const vectorSourceId = Object.keys(style.sources).find(
    (id) => style.sources[id].type === "vector"
  );
  if (!vectorSourceId) return;

  // Hide flat 2D building fills from the base map so every building renders in 3D
  let buildingSourceLayer = "building";
  (style.layers || []).forEach((layer) => {
    if (layer["source-layer"] === "building") {
      buildingSourceLayer = layer["source-layer"];
      if (layer.type === "fill") {
        map.setLayoutProperty(layer.id, "visibility", "none");
      }
    }
  });

  // Extrude all surrounding Knoxville & world buildings in crisp F4map architectural stone
  map.addLayer(
    {
      id: "citywide-3d-context",
      type: "fill-extrusion",
      source: vectorSourceId,
      "source-layer": buildingSourceLayer,
      minzoom: 13.5,
      filter: ["!=", ["get", "hide_3d"], true],
      paint: {
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "render_height"], 10],
          0, "#f2efe9",
          30, "#e7e2d8",
          80, "#dad3c5"
        ],
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          13.5, 0,
          14.2, ["coalesce", ["get", "render_height"], 10]
        ],
        "fill-extrusion-base": [
          "interpolate",
          ["linear"],
          ["zoom"],
          13.5, 0,
          14.2, ["coalesce", ["get", "render_min_height"], 0]
        ],
        "fill-extrusion-vertical-gradient": true,
        "fill-extrusion-opacity": 0.92
      }
    },
    "utk-3d-extrusion"
  );
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
  // F4map-style directional sunlight for crisp sunlit & shaded 3D facades
  map.setLight({
    anchor: "viewport",
    color: "#fff7e8",
    intensity: 0.55,
    position: [1.35, 210, 38]
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
    `Tracking ${uniqueBuildingCount} 3D UTK buildings (+ city 3D)`;

  map.addSource("utk-buildings", {
    type: "geojson",
    data: campusGeoJson
  });

  // Render UTK campus 3D buildings & multi-level building:part tiers
  map.addLayer({
    id: "utk-3d-extrusion",
    type: "fill-extrusion",
    source: "utk-buildings",
    filter: ["!=", ["get", "hasParts"], true],
    paint: {
      "fill-extrusion-height": ["get", "renderHeight"],
      "fill-extrusion-base": ["get", "renderBase"],
      "fill-extrusion-vertical-gradient": true,
      "fill-extrusion-opacity": 0.94,
      "fill-extrusion-color": [
        "interpolate",
        ["linear"],
        ["get", "occupancy"],
        20, "#2ecc71",
        60, "#f1c40f",
        85, "#e74c3c"
      ]
    }
  });

  // Add surrounding Knoxville 3D buildings underneath the UTK layer
  addF4Citywide3DContext();

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