import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import "leaflet-routing-machine";
import "leaflet-control-geocoder";
import "leaflet-control-geocoder/dist/Control.Geocoder.css";

import { fetchRoutes, fetchStops } from "../api";
import StopManager from "../components/StopManager";
import RouteManager from "../components/RouteManager";

export default function UpdateRoutes() {
  const [map, setMap] = useState(null);
  const mapRef = useRef(null);

  const [routes, setRoutes] = useState([]);
  const [allStops, setAllStops] = useState([]);

  const [selecStop, setSelecStop] = useState(null);
  const [waypoints, setWaypoints] = useState([]);
  // layers refs
  const stopsLayerRef = useRef(null);
  const newStopsLayerRef = useRef(null);
  const waypointsLayerRef = useRef(null);

  const [stopsMode, setStopsMode] = useState(false);

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
      mapInstance.remove();
    };
  }, []);

  useEffect(() => {
    if (!map || !stopsLayerRef.current) return;

    const layer = stopsLayerRef.current;
    layer.clearLayers();

    allStops.forEach((stop) => {
      const marker = L.marker([stop.lat, stop.lng], {
        draggable: stopsMode, // Only draggable in edit mode
      })
        .addTo(layer)
        .bindPopup(`<b>${stop.name}</b>`);

      marker.on("click", () => {
        if (stopsMode) {
          setSelecStop({
            id: stop.id,
            name: stop.name,
            lat: stop.lat,
            lng: stop.lng,
          });
          marker.on("dragend", (e) => {
            const { lat, lng } = e.target.getLatLng();
            setSelecStop({
              id: stop.id,
              name: stop.name,
              lat,
              lng,
            });
          });
        } else {
          setWaypoints((prev) => [
            ...prev,
            { id: stop.id, name: stop.name, lat: stop.lat, lng: stop.lng },
          ]);
        }
      });
    });
  }, [map, allStops, stopsMode]);

  const handleSelector = (e) => {
    if (e.target.value === "stop") setStopsMode(true);
    else setStopsMode(false);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* MAP */}
      <div id="map" className="flex-[3] border-r border-gray-300"></div>

      {/* SIDEBAR */}
      <div className="flex-1 bg-white shadow-xl p-5 flex flex-col overflow-y-auto">
        {/* HEADER */}
        <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span>🚌</span> Route Editor
        </h2>

        {/* MODE SELECTOR */}
        <label className="block text-gray-600 font-medium mb-1">Mode</label>
        <select
          className="w-full p-2 rounded border border-gray-300 focus:ring-2 
                 focus:ring-blue-500 focus:outline-none mb-5"
          onChange={handleSelector}
        >
          <option value="route">🛠 Manage Route</option>
          <option value="stop">🛠 Manage Stops</option>
        </select>

        {/* CONTENT CARD */}
        <div className="bg-gray-50 rounded-xl p-4 shadow-inner border border-gray-200">
          {stopsMode && (
            <StopManager
              map={map}
              newStopsLayerRef={newStopsLayerRef}
              selecStop={selecStop}
            />
          )}

          {!stopsMode && (
            <RouteManager
              map={map}
              routes={routes}
              waypoint={waypoints}
              waypointsLayerRef={waypointsLayerRef}
            />
          )}
        </div>
      </div>
    </div>
  );
}
