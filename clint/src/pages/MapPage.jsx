import { useEffect, useRef, useState } from "react";
import { fetchRoutes } from "../api";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-gpx";

export default function MapPage() {
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [selectedDirectionId, setSelectedDirectionId] = useState("");
  const [activeDirections, setActiveDirections] = useState([]);
  const mapRef = useRef(null);

  // Colors for each route
  const routeColors = useRef({});
  const colorIndex = useRef(0);

  const colors = [
    "#ff3b30",
    "#34c759",
    "#007aff",
    "#ffcc00",
    "#af52de",
    "#5ac8fa",
    "#ff9500",
    "#5856d6",
    "#64d2ff",
    "#ff2d55",
  ];

  function getColor(routeId, directionId) {
    const key = `${routeId}-${directionId}`;
    if (!routeColors.current[key]) {
      routeColors.current[key] = colors[colorIndex.current % colors.length];
      colorIndex.current++;
    }
    return routeColors.current[key];
  }

  // Load routes
  useEffect(() => {
    fetchRoutes().then((res) => setRoutes(res.data || []));
  }, []);

  // Init map
  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map("map", {
        zoomControl: true,
      }).setView([33.5138, 36.2765], 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
        mapRef.current
      );
    }
  }, []);

  const addDirectionToMap = (route, direction) => {
    const map = mapRef.current;
    const color = getColor(route.id, direction.id);

    let gpxLayer = null;

    if (direction.gpx) {
      const blob = new Blob([direction.gpx], { type: "application/gpx+xml" });
      gpxLayer = new L.GPX(URL.createObjectURL(blob), {
        async: true,
        polyline_options: { color, weight: 4 },
      })
        .on("loaded", (e) => map.fitBounds(e.target.getBounds()))
        .addTo(map);
    }

    const markers = [];
    direction.stops.forEach((stop, i) => {
      const marker = L.marker([stop.lat, stop.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:14px;height:14px;background:${color};border-radius:50%;border:2px solid white;"></div>`,
        }),
      })
        .addTo(map)
        .bindPopup(`<b>${route.name}</b><br/>${i + 1}. ${stop.name}`);

      markers.push(marker);
    });

    setActiveDirections((prev) => [
      ...prev,
      { routeId: route.id, directionId: direction.id, gpxLayer, markers },
    ]);
  };

  const removeDirection = (routeId, directionId) => {
    const map = mapRef.current;

    const item = activeDirections.find(
      (d) => d.routeId === routeId && d.directionId === directionId
    );

    if (item) {
      if (item.gpxLayer) map.removeLayer(item.gpxLayer);
      item.markers.forEach((m) => map.removeLayer(m));
    }

    setActiveDirections((prev) =>
      prev.filter(
        (d) => !(d.routeId === routeId && d.directionId === directionId)
      )
    );
  };

  const handleAdd = () => {
    if (!selectedRouteId || !selectedDirectionId) {
      alert("Select route + direction");
      return;
    }

    const route = routes.find((r) => r.id == selectedRouteId);
    const direction = route.directions.find((d) => d.id == selectedDirectionId);

    const already = activeDirections.some(
      (d) => d.routeId == route.id && d.directionId == direction.id
    );

    if (already) return alert("Already added");

    addDirectionToMap(route, direction);
  };

  return (
    <div className="flex flex-col items-center p-4 space-y-4 w-full">
      <h1 className="text-3xl font-bold text-gray-800">
        🗺 Damascus Transport Guide
      </h1>

      {/* Selector card */}
      <div className="bg-white p-4 rounded-xl shadow-md w-full max-w-xl space-y-3">
        <select
          className="border p-2 rounded w-full"
          value={selectedRouteId}
          onChange={(e) => {
            setSelectedRouteId(e.target.value);
            setSelectedDirectionId("");
          }}
        >
          <option value="">Select a route…</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        {selectedRouteId && (
          <select
            className="border p-2 rounded w-full"
            value={selectedDirectionId}
            onChange={(e) => setSelectedDirectionId(e.target.value)}
          >
            <option value="">Select direction…</option>
            {routes
              .find((r) => r.id == selectedRouteId)
              ?.directions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.direction} {d.sub_name ? `(${d.sub_name})` : ""}
                </option>
              ))}
          </select>
        )}

        <button
          onClick={handleAdd}
          className="bg-blue-600 text-white w-full py-2 rounded-lg hover:bg-blue-700"
        >
          ➕ Add to Map
        </button>
      </div>

      {/* Active Routes list */}
      <div className="bg-gray-100 w-full max-w-2xl p-3 rounded-xl shadow-inner">
        <h2 className="font-semibold mb-2">🧭 Active Routes</h2>
        {activeDirections.length === 0 ? (
          <p className="text-gray-500">No active routes yet.</p>
        ) : (
          <ul className="space-y-2">
            {activeDirections.map((d, i) => {
              const route = routes.find((r) => r.id === d.routeId);
              const dir = route.directions.find((x) => x.id === d.directionId);

              return (
                <li
                  key={i}
                  className="flex justify-between bg-white p-2 rounded shadow-sm"
                >
                  <span>
                    <b>{route.name}</b> — {dir.direction}
                    {dir.sub_name ? ` (${dir.sub_name})` : ""}
                  </span>
                  <button
                    onClick={() => removeDirection(d.routeId, d.directionId)}
                    className="text-red-600 hover:underline"
                  >
                    ✕ Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Map */}
      <div id="map" className="w-full" style={{ height: "80vh" }} />
    </div>
  );
}
