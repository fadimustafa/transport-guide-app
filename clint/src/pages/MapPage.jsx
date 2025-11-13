import { useEffect, useRef, useState } from "react";
import { fetchRoutes } from "../api";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-gpx";

export default function MapPage() {
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [selectedDirectionId, setSelectedDirectionId] = useState("");
  const [activeDirections, setActiveDirections] = useState([]); // 🆕 routes currently shown
  const [map, setMap] = useState(null);

  // 🧭 Load all routes
  useEffect(() => {
    const loadRoutes = async () => {
      const res = await fetchRoutes();
      setRoutes(res.data);
      console.log("Loaded routes:", res.data);
    };
    loadRoutes();
  }, []);

  // 🗺️ Initialize map
  useEffect(() => {
    const mapInstance = L.map("map").setView([33.5138, 36.2765], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(mapInstance);
    setMap(mapInstance);
    return () => mapInstance.remove();
  }, []);

  // ✅ Use an object to store route-color pairs
 const routeColors = useRef({});
const colorIndex = useRef(0);

const colors = [
  "#FF0000", // Red
  "#00FF00", // Lime
  "#0000FF", // Blue
  "#FFFF00", // Yellow
  "#FF00FF", // Magenta
  "#00FFFF", // Cyan
  "#FFA500", // Orange
  "#800080", // Purple
  "#00CED1", // DarkTurquoise
  "#FF1493", // DeepPink
];

function getRouteColor(routeId, directionId) {
  const key = `${routeId}-${directionId}`;
  if (!routeColors.current[key]) {
    routeColors.current[key] = colors[colorIndex.current % colors.length];
    colorIndex.current++;
  }
  return routeColors.current[key];
}


  // 🧩 Add a direction to map
  const addDirectionToMap = (route, direction) => {
    if (!map || !direction) return;

    // 🟦 GPX layer
    let gpxLayer = null;
    const color = getRouteColor(route.id, direction.id);
    if (direction.gpx) {
      const blob = new Blob([direction.gpx], { type: "application/gpx+xml" });
      const url = URL.createObjectURL(blob);
      gpxLayer = new L.GPX(url, {
        async: true,
        polyline_options: { color, weight: 4 },
      })
        .on("loaded", (e) => map.fitBounds(e.target.getBounds()))
        .addTo(map);
    }

    // 🟩 Stop markers
    const markers = [];
    if (direction.stops?.length > 0) {
      direction.stops.forEach((stop, i) => {
        const marker = L.marker([stop.lat, stop.lng], {
          icon: L.divIcon({
            className: "stop-dot",
            html: `<div style="width:12px;height:12px;background:${color};border-radius:50%;border:2px solid white;"></div>`,
          }),
        })
          .addTo(map)
          .bindPopup(`<b>${route.name}</b><br/>${i + 1}. ${stop.name}`);
        markers.push(marker);
      });
    }

    // Save in active list (for removal later)
    setActiveDirections((prev) => [
      ...prev,
      { routeId: route.id, directionId: direction.id, gpxLayer, markers },
    ]);
  };

  // 🧹 Remove direction from map
  const removeDirection = (routeId, directionId) => {
    const dir = activeDirections.find(
      (d) => d.routeId === routeId && d.directionId === directionId
    );
    if (dir) {
      if (dir.gpxLayer) map.removeLayer(dir.gpxLayer);
      if (dir.markers) dir.markers.forEach((m) => map.removeLayer(m));
      setActiveDirections((prev) =>
        prev.filter(
          (d) => d.routeId !== routeId || d.directionId !== directionId
        )
      );
    }
  };

  // 🧠 Handle Add
  const handleAdd = () => {
    if (!selectedRouteId || !selectedDirectionId) {
      alert("Please select a route and direction.");
      return;
    }

    const route = routes.find((r) => r.id === parseInt(selectedRouteId));
    const direction = route?.directions.find(
      (d) => d.id === parseInt(selectedDirectionId)
    );

    // Prevent duplicates
    const alreadyAdded = activeDirections.some(
      (d) => d.routeId === route.id && d.directionId === direction.id
    );
    if (alreadyAdded) {
      alert("This route direction is already on the map.");
      return;
    }

    addDirectionToMap(route, direction);
  };

  return (
    <div className="flex flex-col items-center p-4 space-y-4 w-full">
      <h1 className="text-2xl font-bold">🗺️ Damascus Transport Guide</h1>

      {/* Select Route */}
      <select
        className="border p-2 rounded w-1/2"
        value={selectedRouteId}
        onChange={(e) => {
          setSelectedRouteId(e.target.value);
          setSelectedDirectionId("");
        }}
      >
        <option value="">Select a route...</option>
        {routes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>

      {/* Select Direction */}
      {selectedRouteId && (
        <select
          className="border p-2 rounded w-1/2"
          value={selectedDirectionId}
          onChange={(e) => setSelectedDirectionId(e.target.value)}
        >
          <option value="">Select a direction...</option>
          {routes
            .find((r) => r.id === parseInt(selectedRouteId))
            ?.directions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.direction} {d.sub_name ? `(${d.sub_name})` : ""}
              </option>
            ))}
        </select>
      )}

      {/* Add Button */}
      <button
        onClick={handleAdd}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        ➕ Add to Map
      </button>

      {/* Active Routes List */}
      <div className="w-3/4 mt-4 border rounded p-3 bg-gray-50">
        <h2 className="font-semibold mb-2">🧭 Active Routes</h2>
        {activeDirections.length === 0 ? (
          <p className="text-gray-500">No routes added yet.</p>
        ) : (
          <ul className="space-y-2">
            {activeDirections.map((d, i) => {
              const route = routes.find((r) => r.id === d.routeId);
              const direction = route?.directions.find(
                (dir) => dir.id === d.directionId
              );
              return (
                <li
                  key={i}
                  className="flex justify-between items-center bg-white p-2 rounded shadow-sm"
                >
                  <span>
                    <b>{route.name}</b> — {direction.direction}{" "}
                    {direction.sub_name ? `(${direction.sub_name})` : ""}
                  </span>
                  <button
                    onClick={() => removeDirection(d.routeId, d.directionId)}
                    className="text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Map */}
      <div id="map" style={{ height: "80vh", width: "100%" }} />
    </div>
  );
}
