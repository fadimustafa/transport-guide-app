import { useEffect, useRef, useState } from "react";
import L, { Draggable } from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import "leaflet-routing-machine";
import "leaflet-control-geocoder";
import "leaflet-control-geocoder/dist/Control.Geocoder.css";

import {
  fetchRoutes,
  addRoute,
  deleteRoute,
  fetchStops,
  addStops,
  deleteStop,
  editStop,
  updateRoute,
} from "../api";

export default function UpdateRoutes() {
  const [map, setMap] = useState(null);
  const mapRef = useRef(null);

  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [selectedDirectionId, setSelectedDirectionId] = useState("");
  const [selectedRoute, setSelectedRoute] = useState(null);

  const [allStops, setAllStops] = useState([]);
  const [newStops, setNewStops] = useState([]);
  const [addingStopsMode, setAddingStopsMode] = useState(false);
  const [selectedStop, setSelectedStop] = useState(null);

  const [waypoints, setWaypoints] = useState([]);
  const [routeName, setRouteName] = useState("");
  const [subName, setSubName] = useState("");
  const [bustype, setBusType] = useState("");
  const [tikPrice, setTikPrice] = useState("");
  const [distance, setDistance] = useState("");

  const [directionType, setDirectionType] = useState("Go");

  const [routeControl, setRouteControl] = useState(null);
  const [gpxData, setGpxData] = useState(null);

  // layers refs
  const stopsLayerRef = useRef(null);
  const newStopsLayerRef = useRef(null);
  const waypointsLayerRef = useRef(null);

  // refs to keep latest state inside leaflet handlers (avoid stale closures)
  const selectedRouteIdRef = useRef(selectedRouteId);
  const addingStopsModeRef = useRef(addingStopsMode);

  // keep refs updated
  useEffect(() => {
    selectedRouteIdRef.current = selectedRouteId;
  }, [selectedRouteId]);
  useEffect(() => {
    addingStopsModeRef.current = addingStopsMode;
  }, [addingStopsMode]);

  // -------------------------------
  // Load initial data (once)
  // -------------------------------
  useEffect(() => {
    (async () => {
      try {
        const [rRes, sRes] = await Promise.all([fetchRoutes(), fetchStops()]);
        setRoutes(rRes.data || []);
        setAllStops(sRes.data || []);
      } catch (err) {
        console.error("Failed to load routes/stops:", err);
      }
    })();
  }, []);

  // -------------------------------
  // Initialize Map (once)
  // -------------------------------
  useEffect(() => {
    const mapInstance = L.map("map", {
      center: [33.5138, 36.2765],
      zoom: 15,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(mapInstance);

    L.Control.geocoder({ defaultMarkGeocode: false })
      .on("markgeocode", (e) => {
        const { center, name } = e.geocode;
        mapInstance.setView(center, 15);
        L.marker(center).addTo(mapInstance).bindPopup(name).openPopup();
      })
      .addTo(mapInstance);

    // create layers once
    stopsLayerRef.current = L.layerGroup().addTo(mapInstance);
    newStopsLayerRef.current = L.layerGroup().addTo(mapInstance);
    waypointsLayerRef.current = L.layerGroup().addTo(mapInstance);

    mapRef.current = mapInstance;
    setMap(mapInstance);

    return () => {
      // cleanup: remove routing control and map
      if (routeControl && mapInstance) {
        try {
          mapInstance.removeControl(routeControl);
        } catch {}
      }
      mapInstance.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------
  // Render saved global stops (only when allStops or map changes)
  // -------------------------------
  useEffect(() => {
    if (!map || !stopsLayerRef.current) return;

    const layer = stopsLayerRef.current;
    layer.clearLayers();

    allStops.forEach((stop) => {
      const marker = L.marker([stop.lat, stop.lng], {
        draggable: addingStopsModeRef.current, // Only draggable in edit mode
      })
        .addTo(layer)
        .bindPopup(`<b>${stop.name}</b>`);

      // When dragging ends (edit mode only)
      marker.on("dragend", (e) => {
        if (addingStopsModeRef.current) {
          const { lat, lng } = e.target.getLatLng();
          setSelectedStop({
            id: stop.id,
            name: stop.name,
            lat,
            lng,
          });
        }
      });

      // Click handler
      marker.on("click", () => {
        // Add waypoint only when creating a NEW route
        if (selectedRouteIdRef.current === "") {
          setWaypoints((prev) => [
            ...prev,
            { id: stop.id, name: stop.name, lat: stop.lat, lng: stop.lng },
          ]);
        }

        // Select stop for editing only in edit mode
        if (addingStopsModeRef.current) {
          setSelectedStop({
            id: stop.id,
            name: stop.name,
            lat: stop.lat,
            lng: stop.lng,
          });
        }
      });
    });
  }, [map, allStops, addingStopsModeRef.current]);

  // -------------------------------
  // Map click handler for adding NEW STOPS (temporary until saved)
  // Only active when addingStopsMode === true
  // -------------------------------
  useEffect(() => {
    if (!map) return;

    const onMapClick = (e) => {
      if (!addingStopsModeRef.current) return;
      const stop = {
        name: `New Stop ${newStops.length + 1}`,
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      };
      setNewStops((prev) => [...prev, stop]);
    };

    map.on("click", onMapClick);
    return () => map.off("click", onMapClick);
    // we purposely depend on map only; newStops length does not need to rebind handler
  }, [map]);

  // -------------------------------
  // Show new (unsaved) stops on map layer
  // -------------------------------
  useEffect(() => {
    if (!map || !newStopsLayerRef.current) return;
    const layer = newStopsLayerRef.current;
    layer.clearLayers();

    newStops.forEach((stop) => {
      L.marker([stop.lat, stop.lng])
        .addTo(layer)
        .bindPopup(`<b>${stop.name}</b>`);
    });
  }, [map, newStops]);

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

    if (waypoints.length < 2) {
      // draw simple markers into waypoints layer
      waypoints.forEach((stop) =>
        L.marker([stop.lat, stop.lng])
          .addTo(wLayer)
          .bindPopup(`<b>${stop.name}</b>`)
      );
      setGpxData(null);
      return;
    }

    const control = L.Routing.control({
      waypoints: waypoints.map((p) => L.latLng(p.lat, p.lng)),
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
      const gpx = `<?xml version="1.0"?><gpx version="1.1" creator="RouteManager"><trk><name>${routeName}</name><trkseg>${coords}</trkseg></trk></gpx>`;
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
    if (!selectedRouteId) {
      setSelectedRoute(null);
      setRouteName("");
      setSubName("");
      setDirectionType("Go");
      setWaypoints([]);
      setBusType("");
      setTikPrice("");
      return;
    }
    const route = routes.find((r) => r.id === Number(selectedRouteId));
    const dir = route?.directions.find(
      (d) => d.id === Number(selectedDirectionId)
    );
    if (route && dir) {
      setSelectedRoute(route);
      setRouteName(route.name);
      setSubName(dir.sub_name ?? "");
      setDirectionType(dir.direction ?? "Go");
      setWaypoints(dir.stops || []);
      setBusType(route.bus_type ?? "");
      setTikPrice(dir.tik_price ?? "");
      setDistance(dir.distance ?? "");
    }
  }, [selectedRouteId, selectedDirectionId, routes]);

  // ---------- handlers (kept similar) ----------
  const handleSaveNewRoute = async () => {
    if (!routeName.trim() || waypoints.length < 2)
      return alert("Enter route name and at least 2 stops.");
    const data = {
      name: routeName,
      bus_type: bustype,
      directions: {
        sub_name: subName || null,
        direction: directionType,
        gpx: gpxData,
        stops: waypoints,
        tik_price: tikPrice,
        distance: distance,
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
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    }
  };

  const handleSaveNewStops = async () => {
    if (newStops.length === 0 && selectedStop === null)
      return alert("No new stops to save.");
    try {
      if (!selectedStop) {
        await addStops(newStops);
        alert("New stops saved.");
      } else {
        await editStop(selectedStop);
        alert("stop has been edited.");
      }
      const res = await fetchStops();
      setAllStops(res.data || []);
      setNewStops([]);
      setSelectedStop(null);
    } catch (err) {
      console.error("Failed to save stops:", err);
      alert("Failed to save new stops.");
    }
  };

  const handleDeleteStop = async () => {
    if (!confirm("delete?")) return;
    if (!selectedStop) return;
    try {
      await deleteStop(selectedStop.id);
      setSelectedStop(null);
      const res = await fetchStops();
      setAllStops(res.data || []);
    } catch (err) {
      console.error(err);
      alert(err.response.data.detail);
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

  const toggleAddStopsMode = (enable) => {
    setAddingStopsMode(enable);
    if (!enable) {
      setNewStops([]);
      newStopsLayerRef.current?.clearLayers();
    }
  };
  const handleSelector = (e) => {
    const value = e.target.value;
    setSelectedRouteId(value);
    if (value === "stop") {
      toggleAddStopsMode(true);
      setWaypoints([]); // disable route editing
      return;
    }
    if (value === "route") {
      toggleAddStopsMode(false);
      setSelectedRouteId("");
      setWaypoints([]);
      return;
    }
    // Selecting an existing ROUTE

    setSelectedDirectionId("");
    toggleAddStopsMode(false);
    setWaypoints([]);
  };

  const handleClear = () => {
    setSelectedRouteId("");
    setSelectedDirectionId("");
    setRouteName("");
    setSubName("");
    setTikPrice("");
    setDistance("");
    setWaypoints([]);
    if (routeControl && map) map.removeControl(routeControl);
  };

  // -------------------------------
  // Render
  // -------------------------------
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <div id="map" style={{ flex: 2 }}></div>

      <div
        style={{
          flex: 1,
          background: "#f9f9f9",
          padding: 7,
          borderLeft: "1px solid #ddd",
          overflowY: "auto",
        }}
      >
        <h2>🚌 Route Editor</h2>

        <select
          className="border p-2 rounded w-full mb-2"
          value={selectedRouteId}
          onChange={handleSelector}
        >
          <option value="route">➕ New Route</option>
          <option value="stop">🛠 Edit/Add Stops</option>
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

        {addingStopsMode && (
          <div
            style={{ marginBottom: 12, padding: 12, border: "1px dashed #ccc" }}
          >
            <h4>Add or Edit Stops</h4>
            <p>
              • Click the map to create <b>new stops</b> (temporary) <br />•
              Click an existing stop on the map to <b>select & edit</b> it
            </p>

            <h5 style={{ marginTop: 10 }}>New Stops</h5>
            {newStops.length === 0 ? (
              <p style={{ color: "#777" }}>No new stops yet.</p>
            ) : (
              newStops.map((s, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <input
                    value={s.name}
                    onChange={(e) => {
                      const updated = [...newStops];
                      updated[idx] = { ...updated[idx], name: e.target.value };
                      setNewStops(updated);
                    }}
                    className="flex-1 p-2 border rounded"
                  />
                  <button
                    onClick={() =>
                      setNewStops((prev) => prev.filter((_, i) => i !== idx))
                    }
                    style={{
                      background: "red",
                      color: "white",
                      border: "none",
                      padding: "6px 8px",
                      borderRadius: 4,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}

            {selectedStop && (
              <div style={{ marginTop: 12 }}>
                <h5>Edit Selected Saved Stop</h5>
                <div className="flex justify-normal">
                  <input
                    value={selectedStop.name}
                    onChange={(e) =>
                      setSelectedStop({ ...selectedStop, name: e.target.value })
                    }
                    className="p-2 border rounded w-full"
                  />
                  <button
                    onClick={() => setSelectedStop(null)}
                    style={{
                      background: "none",
                      color: "black",
                      border: "none",
                      padding: "6px 8px",
                      borderRadius: 4,
                    }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={handleSaveNewStops}
                    style={{
                      background: "#007bff",
                      color: "white",
                      borderRadius: 4,
                      padding: "6px 10px",
                    }}
                  >
                    Save Edit
                  </button>

                  <button
                    onClick={handleDeleteStop}
                    style={{
                      background: "red",
                      color: "white",
                      borderRadius: 4,
                      padding: "6px 10px",
                    }}
                  >
                    Delete Stop
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                onClick={handleSaveNewStops}
                style={{
                  background: "#28a745",
                  color: "white",
                  padding: "8px 12px",
                  borderRadius: 4,
                }}
              >
                Save New Stops
              </button>

              <button
                onClick={() => {
                  setNewStops([]);
                  newStopsLayerRef.current?.clearLayers();
                }}
                style={{
                  background: "gray",
                  color: "white",
                  padding: "8px 12px",
                  borderRadius: 4,
                }}
              >
                Clear New Stops
              </button>
            </div>
          </div>
        )}

        {!addingStopsMode && (
          <>
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
              className="w-full p-2 mb-2 border rounded"
            />

            <label>Bus type:</label>
            <input
              value={bustype}
              onChange={(e) => setBusType(e.target.value)}
              className="w-full p-2 mb-4 border rounded"
            />
            <label>Distance:</label>
            <input
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="w-full p-2 mb-4 border rounded"
            />
            <label>Ticket price:</label>
            <input
              value={tikPrice}
              onChange={(e) => setTikPrice(e.target.value)}
              className="w-full p-2 mb-4 border rounded"
              placeholder="3000SP"
              type="number"
            />

            <h3>Stops for this direction:</h3>
            {waypoints.map((stop, i) => (
              <div key={i} className="flex mb-2">
                <div
                  className="flex-1 p-2 border rounded bg-gray-100"
                  style={{ cursor: "default" }}
                >
                  {stop.name}
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
              <input
                type="file"
                accept=".gpx"
                onChange={(e) => handleGPXfile(e)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
