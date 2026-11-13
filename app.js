const UTK_CENTER = [-83.9295, 35.9544];
const UTK_BBOX = "35.9460,-83.9430,35.9610,-83.9200";

let occupancyData = {};
let campusGeoJson = null;
let autoTimer = null;

// Fallback footprints in case Overpass API is temporarily busy
const FALLBACK_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "fallback/hodges",
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
      id: "fallback/ayres",
      properties: { name: "Ayres Hall", "building:levels": "4" },
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
  zoom: 15.8,
  pitch: 56,
  bearing: -20,
  antialias: true
});

map.addControl(new maplibregl.NavigationControl(), "top-right");

function getPolygonCenter(geometry) {
  const ring = geometry.type === "Polygon"
    ? geometry.coordinates[0]
    : geometry.coordinates[0][0];
  let lngSum = 0;
  let latSum = 0;
  ring.forEach(([lng, lat]) => {
    lngSum += lng;
    latSum += lat;
  });
  return [lngSum / ring.length, latSum / ring.length];
}

function getSeverityClass(pct) {
  if (pct < 45) return "low";
  if (pct <= 75) return "mid";
  return "high";
}

function enrichGeoJson(geojson) {
  geojson.features = geojson.features.filter(
    (f) => f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon")
  );

  geojson.features.forEach((feature) => {
    const props = feature.properties || {};
    const name = props.name || "UTK Campus Building";

    let height = 12;
    if (props.height) {
      height = parseFloat(props.height) || 12;
    } else if (props["building:levels"]) {
      height = (parseFloat(props["building:levels"]) || 3) * 4;
    }

    const tracked = occupancyData[name];
    const occupancy = tracked
      ? tracked.occupancy
      : Math.floor(20 + Math.random() * 50);
    const capacity = tracked ? tracked.capacity : 300;

    feature.properties.displayName = name;
    feature.properties.renderHeight = height;
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

  const namedFeatures = campusGeoJson.features
    .filter((f) => f.properties.name && f.properties.name.toLowerCase().includes(query))
    .sort((a, b) => b.properties.occupancy - a.properties.occupancy);

  listEl.innerHTML = "";
  namedFeatures.forEach((feature) => {
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
      map.flyTo({ center, zoom: 17.5, pitch: 62 });
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
      Building Height: ${Math.round(props.renderHeight)} m<br/>
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
    return structuredClone(FALLBACK_GEOJSON);
  }
}

function simulateLiveUpdate() {
  if (!campusGeoJson) return;
  Object.keys(occupancyData).forEach((buildingName) => {
    const delta = Math.floor(Math.random() * 21) - 10;
    const next = Math.min(99, Math.max(8, occupancyData[buildingName].occupancy + delta));
    occupancyData[buildingName].occupancy = next;
  });

  campusGeoJson = enrichGeoJson(campusGeoJson);
  map.getSource("utk-buildings").setData(campusGeoJson);
  renderSidebarList(document.getElementById("searchInput").value);
}

map.on("load", async () => {
  try {
    const occRes = await fetch("./data/occupancy.json");
    const occJson = await occRes.json();
    occupancyData = occJson.buildings || {};
  } catch (e) {
    console.warn("Could not load data/occupancy.json; using generated values.");
  }

  const rawGeoJson = await fetchUtkBuildings();
  campusGeoJson = enrichGeoJson(rawGeoJson);

  document.getElementById("statusText").textContent =
    `Tracking ${campusGeoJson.features.length} 3D UTK buildings`;

  map.addSource("utk-buildings", {
    type: "geojson",
    data: campusGeoJson
  });

  map.addLayer({
    id: "utk-3d-extrusion",
    type: "fill-extrusion",
    source: "utk-buildings",
    paint: {
      "fill-extrusion-height": ["get", "renderHeight"],
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 0.9,
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