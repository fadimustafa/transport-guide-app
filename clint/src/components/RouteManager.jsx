import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { addRoute, deleteRoute, updateRoute } from "../api";

export default function RouteManager({
  map,
  routes,
  waypointsLayerRef,
  waypoint,
}) {
  const [waypoints, setWaypoints] = useState(waypoint || []);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [gpxData, setGpxData] = useState(null);
  const [routeControl, setRouteControl] = useState(null);
  const [curRoute, setCurRoute] = useState({
    routeName: "",
    subName: "",
    bustype: "",
    tikPrice: "",
    distance: "",
    directionType: "",
  });

  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [selectedDirectionId, setSelectedDirectionId] = useState("");

  useEffect(() => {
    if (Array.isArray(waypoint)) {
      setWaypoints(waypoint);
    }
  }, [waypoint]);

  // -------------------------------
  // Draw route when waypoints change (safe: uses dedicated layer & control cleanup)
  // -------------------------------
  useEffect(() => {
    if (!map || !waypointsLayerRef.current) return;

    // remove existing routing control (if any)
    if (routeControl) {
      try {
        map.removeControl(routeControl);
      } catch {}
      setRouteControl(null);
    }

    // clear waypoints markers layer
    const wLayer = waypointsLayerRef.current;
    wLayer.clearLayers();

    if (waypoints?.length < 2) {
      // draw simple markers into waypoints layer
      waypoints?.forEach((stop) =>
        L.marker([stop?.lat, stop?.lng])
          .addTo(wLayer)
          .bindPopup(`<b>${stop?.name}</b>`)
      );
      setGpxData(null);
      return;
    }

    const control = L.Routing.control({
      waypoints: waypoints?.map((p) => L.latLng(p.lat, p.lng)),
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
        .join("");
      const gpx = `<?xml version="1.0"?>
        <gpx version="1.1" creator="RouteManager">
          <trk>
            <name>${curRoute.routeName}</name>
            <trkseg>${coords}</trkseg>
          </trk>
        </gpx>`;

      setGpxData(gpx);
    });

    setRouteControl(control);

    // cleanup when waypoints change again
    return () => {
      try {
        map.removeControl(control);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, waypoints]); // only depends on map and waypoints

  // -------------------------------
  // When selecting route/direction: load stops into waypoints
  // -------------------------------
  useEffect(() => {
    if (selectedRouteId == "") {
      setCurRoute({
        routeName: "",
        subName: "",
        bustype: "",
        tikPrice: "",
        distance: "",
        directionType: "",
      });
      setWaypoints([])
      return;
    }
    const route = routes.find((r) => r.id === Number(selectedRouteId));
    const dir = route?.directions.find(
      (d) => d.id === Number(selectedDirectionId)
    );
    if (route && dir) {
      setCurRoute({
        routeName: route.name,
        subName: dir.sub_name ?? "",
        bustype: route.bus_type ?? "",
        tikPrice: dir.tik_price ?? "",
        distance: dir.distance ?? "",
        directionType: dir.direction ?? "Go",
      });
      setSelectedRoute(route);
      setWaypoints(dir.stops || []);
    }
  }, [selectedRouteId, selectedDirectionId, routes]);

  // ---------- handlers (kept similar) ----------
  const handleSaveNewRoute = async () => {
    if (!curRoute.routeName.trim() || waypoints.length < 2)
      return alert("Enter route name and at least 2 stops.");
    const data = {
      name: curRoute.routeName,
      bus_type: curRoute.bustype,
      directions: {
        sub_name: curRoute.subName || null,
        direction: curRoute.directionType,
        gpx: gpxData,
        stops: waypoints,
        tik_price: curRoute.tikPrice,
        distance: curRoute.distance,
      },
    };

    try {
      if (!selectedRouteId) {
        await addRoute(data);
        alert("Saved");
      } else {
        await updateRoute(selectedRouteId, selectedDirectionId, data);
        alert("Route has been edited");
      }
    } catch (err) {
      console.error(err);
      alert("Failed");
    }
  };
  const handleDeleteRoute = async () => {
    if (!confirm("Delete?")) return;
    try {
      await deleteRoute(selectedRouteId, selectedDirectionId);
      alert("Deleted");
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    }
  };

  const handleGPXfile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    setGpxData(text);
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "text/xml");
    const points = Array.from(xml.getElementsByTagName("trkpt"));
    const extractedStops = points.map((pt, i) => ({
      name: `Stop ${i + 1}`,
      lat: parseFloat(pt.getAttribute("lat")),
      lng: parseFloat(pt.getAttribute("lon")),
    }));
    setWaypoints(extractedStops);
  };

  const handleClear = () => {
    setCurRoute({
        routeName: "",
        subName: "",
        bustype: "",
        tikPrice: "",
        distance: "",
        directionType: "",
      });
    setWaypoints([])
  };

  return (
    <>
      <select
        className="border p-2 rounded w-full mb-2"
        value={selectedRouteId}
        onChange={(e) => setSelectedRouteId(e.target.value)}
      >
        <option value="">➕ New Route</option>
        {routes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>

      {selectedRouteId && selectedRouteId !== "stop" && (
        <select
          className="border p-2 rounded w-full mb-2"
          value={selectedDirectionId}
          onChange={(e) => setSelectedDirectionId(e.target.value)}
        >
          <option value="">Select direction</option>
          {routes
            .find((r) => r.id === Number(selectedRouteId))
            ?.directions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.direction} {d.sub_name ? `(${d.sub_name})` : ""}
              </option>
            ))}
        </select>
      )}
      <label>Route Name:</label>
      <input
        value={curRoute.routeName}
        onChange={(e) =>
          setCurRoute((prev) => ({ ...prev, routeName: e.target.value }))
        }
        className="w-full p-2 mb-2 border rounded"
      />

      <label>Direction:</label>
      <select
        value={curRoute.directionType}
        onChange={(e) =>
          setCurRoute((prev) => ({ ...prev, directionType: e.target.value }))
        }
        className="w-full p-2 mb-2 border rounded"
      >
        <option value="Go">Go</option>
        <option value="Return">Return</option>
      </select>

      <label>Sub Name:</label>
      <input
        value={curRoute.subName}
        onChange={(e) =>
          setCurRoute((prev) => ({ ...prev, subName: e.target.value }))
        }
        className="w-full p-2 mb-2 border rounded"
      />

      <label>Bus type:</label>
      <input
        value={curRoute.bustype}
        onChange={(e) =>
          setCurRoute((prev) => ({ ...prev, bustype: e.target.value }))
        }
        className="w-full p-2 mb-4 border rounded"
      />
      <label>Distance:</label>
      <input
        value={curRoute.distance}
        onChange={(e) =>
          setCurRoute((prev) => ({ ...prev, distance: e.target.value }))
        }
        className="w-full p-2 mb-4 border rounded"
      />
      <label>Ticket price:</label>
      <input
        value={curRoute.tikPrice}
        onChange={(e) =>
          setCurRoute((prev) => ({ ...prev, tikPrice: e.target.value }))
        }
        className="w-full p-2 mb-4 border rounded"
        placeholder="3000SP"
        type="number"
      />

      <h3>Stops for this direction:</h3>
      {waypoints?.map((stop, i) => (
        <div key={i} className="flex mb-2">
          <div
            className="flex-1 p-2 border rounded bg-gray-100"
            style={{ cursor: "default" }}
          >
            {stop?.name}
          </div>
          <button
            onClick={() =>
              setWaypoints((prev) => prev.filter((_, j) => j !== i))
            }
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

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          onClick={handleSaveNewRoute}
          className="p-2"
          style={{
            background: "#007bff",
            color: "white",
            borderRadius: 4,
          }}
        >
          💾 Save
        </button>

        {selectedRoute && (
          <button
            onClick={handleDeleteRoute}
            className="p-2"
            style={{ background: "red", color: "white", borderRadius: 4 }}
          >
            🗑 Delete
          </button>
        )}

        <button
          onClick={handleClear}
          className="p-2"
          style={{ background: "gray", color: "white", borderRadius: 4 }}
        >
          🧹 Clear
        </button>
      </div>

      <div className="mt-3">
        <h3>add gpx file..</h3>
        <input type="file" accept=".gpx" onChange={(e) => handleGPXfile(e)} />
      </div>
    </>
  );
}
