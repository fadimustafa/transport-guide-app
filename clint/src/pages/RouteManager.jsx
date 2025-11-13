import { useEffect, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import "leaflet-routing-machine";
import "leaflet-control-geocoder";
import "leaflet-control-geocoder/dist/Control.Geocoder.css";
import { fetchRoutes, addRoute, updateRoute, deleteRoute } from "../api";

export default function UpdateRoutes() {
  const [map, setMap] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [selectedDirectionId, setSelectedDirectionId] = useState("");
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [waypoints, setWaypoints] = useState([]);
  const [routeName, setRouteName] = useState("");
  const [subName, setSubName] = useState("");
  const [directionType, setDirectionType] = useState("Go");
  const [routeControl, setRouteControl] = useState(null);
  const [gpxData, setGpxData] = useState(null);

  // 🔹 Load routes
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchRoutes();
        setRoutes(res.data || []);
      } catch (err) {
        console.error("❌ Failed to load routes:", err);
      }
    })();
  }, []);

  // 🔹 Initialize map
  useEffect(() => {
    const mapInstance = L.map("map", {
      center: [33.5138, 36.2765],
      zoom: 13,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(mapInstance);

    // Add geocoder (search)
    L.Control.geocoder({ defaultMarkGeocode: false })
      .on("markgeocode", (e) => {
        const { center, name } = e.geocode;
        mapInstance.setView(center, 15);
        L.marker(center)
          .addTo(mapInstance)
          .bindPopup(`<b>${name}</b>`)
          .openPopup();
      })
      .addTo(mapInstance);

    setMap(mapInstance);
    return () => mapInstance.remove();
  }, []);

  // 🔹 Add stops by clicking on map
  useEffect(() => {
    if (!map) return;
    const onClick = (e) => {
      const newStop = {
        name: `Stop ${waypoints.length + 1}`,
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      };
      setWaypoints((prev) => [...prev, newStop]);
    };
    map.on("click", onClick);
    return () => map.off("click", onClick);
  }, [map, waypoints]);

  // 🔹 Draw route when waypoints change
  useEffect(() => {
    if (!map) return;
    if (routeControl) map.removeControl(routeControl);

    if (waypoints.length < 2) {
      // just draw dots if not enough stops
      waypoints.forEach((stop) =>
        L.marker([stop.lat, stop.lng], {
          icon: L.divIcon({
            html: `<div style="width:10px;height:10px;background:red;border-radius:50%;"></div>`,
          }),
        }).addTo(map)
      );
      return;
    }

    const control = L.Routing.control({
      waypoints: waypoints.map((p) => L.latLng(p.lat, p.lng)),
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      lineOptions: { styles: [{ color: "red", weight: 4 }] },
      createMarker: (i, wp) => {
        const stop = waypoints[i];
        return L.marker(wp.latLng).bindPopup(`<b>${stop.name}</b>`);
      },
      show: false,
    }).addTo(map);

    control.on("routesfound", (e) => {
      const coords = e.routes[0].coordinates
        .map((c) => `<trkpt lat="${c.lat}" lon="${c.lng}"></trkpt>`)
        .join("\n");
      const gpx = `<?xml version="1.0"?><gpx version="1.1" creator="RouteManager"><trk><name>${routeName}</name><trkseg>${coords}</trkseg></trk></gpx>`;
      setGpxData(gpx);
    });

    setRouteControl(control);
  }, [waypoints]);

  // 🔹 Select route + direction
  useEffect(() => {
    if (!selectedRouteId) {
      setSelectedRoute(null);
      setRouteName("");
      setSubName("");
      setDirectionType("Go");
      setWaypoints([]);
      return;
    }

    const route = routes.find((r) => r.id === parseInt(selectedRouteId));
    const dir = route?.directions.find(
      (d) => d.id === parseInt(selectedDirectionId)
    );

    if (route && dir) {
      setSelectedRoute(route);
      setRouteName(route.name);
      setSubName(dir.sub_name || "");
      setDirectionType(dir.direction);
      const sortedStops = dir.stops.sort((a, b) => a.id - b.id);
      setWaypoints(sortedStops || []);
    }
  }, [selectedRouteId, selectedDirectionId, routes]);

  // 💾 Save or update
  const handleSave = async () => {
    if (!routeName.trim() || waypoints.length < 2) {
      alert("Enter route name and at least 2 stops.");
      return;
    }

    const data = {
      name: routeName,
      directions: [
        {
          sub_name: subName || null,
          direction: directionType,
          gpx: gpxData,
          stops: waypoints,
        },
      ],
    };

    try {
      await addRoute(data);
      alert("✅ Route created!");
      window.location.reload();
    } catch (err) {
      console.error("❌ Save failed:", err);
      alert("Failed to save route.");
    }
  };

  // 🗑 Delete
  const handleDelete = async () => {
    if (!selectedRoute) return alert("Select a route first!");
    if (!confirm("⚠️ Are you sure you want to delete this route?")) return;
    try {
      await deleteRoute(selectedRoute.id);
      alert("🗑 Deleted successfully!");
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Delete failed!");
    }
  };

  // 🧹 Clear
  const handleClear = () => {
    setSelectedRoute(null);
    setSelectedRouteId("");
    setSelectedDirectionId("");
    setRouteName("");
    setSubName("");
    setDirectionType("Go");
    setWaypoints([]);
    if (routeControl && map) map.removeControl(routeControl);
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* MAP */}
      <div id="map" style={{ flex: 2, height: "100vh" }}></div>

      {/* SIDEBAR */}
      <div
        style={{
          flex: 1,
          background: "#f9f9f9",
          padding: 20,
          borderLeft: "1px solid #ddd",
          overflowY: "auto",
        }}
      >
        <h2>🚌 Route Editor</h2>

        {/* Route Selector */}
        <select
          className="border p-2 rounded w-full mb-2"
          value={selectedRouteId}
          onChange={(e) => {
            setSelectedRouteId(e.target.value);
            setSelectedDirectionId("");
          }}
        >
          <option value="">➕ New Route</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        {/* Direction Selector */}
        {selectedRouteId && (
          <select
            className="border p-2 rounded w-full mb-2"
            value={selectedDirectionId}
            onChange={(e) => setSelectedDirectionId(e.target.value)}
          >
            <option value="">Select direction</option>
            {routes
              .find((r) => r.id === parseInt(selectedRouteId))
              ?.directions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.direction} {d.sub_name ? `(${d.sub_name})` : ""}
                </option>
              ))}
          </select>
        )}

        <label>Route Name:</label>
        <input
          value={routeName}
          onChange={(e) => setRouteName(e.target.value)}
          className="w-full p-2 mb-2 border rounded"
        />

        <label>Direction:</label>
        <select
          value={directionType}
          onChange={(e) => setDirectionType(e.target.value)}
          className="w-full p-2 mb-2 border rounded"
        >
          <option value="Go">Go</option>
          <option value="Return">Return</option>
        </select>

        <label>Sub Name:</label>
        <input
          value={subName}
          onChange={(e) => setSubName(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
        />

        <h3>Stops:</h3>
        {waypoints.map((stop, i) => (
          <div key={i} style={{ display: "flex", marginBottom: 8 }}>
            <input
              value={stop.name}
              onChange={(e) => {
                const updated = [...waypoints];
                updated[i].name = e.target.value;
                setWaypoints(updated);
              }}
              style={{ flex: 1, padding: 5 }}
            />
            <button
              onClick={() => setWaypoints(waypoints.filter((_, j) => j !== i))}
              style={{
                marginLeft: 5,
                background: "red",
                color: "white",
                border: "none",
                padding: "5px 8px",
                borderRadius: "3px",
              }}
            >
              ✕
            </button>
          </div>
        ))}

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button
            onClick={handleSave}
            style={{
              background: "#007bff",
              color: "white",
              flex: 1,
              padding: "10px",
              border: "none",
              borderRadius: "5px",
            }}
          >
            💾 Save
          </button>
          {selectedRoute && (
            <button
              onClick={handleDelete}
              style={{
                background: "red",
                color: "white",
                flex: 1,
                padding: "10px",
                border: "none",
                borderRadius: "5px",
              }}
            >
              🗑 Delete
            </button>
          )}
          <button
            onClick={handleClear}
            style={{
              background: "gray",
              color: "white",
              flex: 1,
              padding: "10px",
              border: "none",
              borderRadius: "5px",
            }}
          >
            🧹 Clear
          </button>
        </div>
      </div>
    </div>
  );
}
