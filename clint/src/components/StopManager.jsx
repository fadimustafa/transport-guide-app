import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  MapPin,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  MapPinned,
} from "lucide-react";
import { addStops, deleteStop, editStop } from "../api";

export default function StopManager({
  map,
  newStopsLayerRef,
  selecStop,
}) {
  const [selectedStop, setSelectedStop] = useState(selecStop || null);
  const [newStops, setNewStops] = useState([]);

  useEffect(() => {
    setSelectedStop(selecStop);
  }, [selecStop]);

  useEffect(() => {
    if (!map) return;
    const onMapClick = (e) => {
      const stop = {
        name: `Stop ${newStops.length + 1}`,
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      };
      setNewStops((prev) => [...prev, stop]);
    };

    map.on("click", onMapClick);
    return () => map.off("click", onMapClick);
  }, [map]);

  useEffect(() => {
    if (!map || !newStopsLayerRef.current) return;
    const layer = newStopsLayerRef.current;
    layer.clearLayers();

    newStops.forEach((stop, idx) => {
      // Create custom HTML for the new stop marker with Tailwind-like styles
      const markerHtml = `
        <div class="relative w-8 h-8">
          <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20"></div>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
              ${idx + 1}
            </div>
          </div>
        </div>
      `;

      const marker = L.marker([stop.lat, stop.lng], {
        icon: L.divIcon({
          html: markerHtml,
          className: "custom-marker",
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        }),
      }).addTo(layer).bindPopup(`
          <div class="p-2">
            <div class="font-semibold text-blue-600">${stop.name}</div>
            <div class="text-xs text-gray-500 mt-1">Click to edit name</div>
            <div class="text-xs text-gray-400 mt-1">Lat: ${stop.lat.toFixed(
              4
            )}<br>Lng: ${stop.lng.toFixed(4)}</div>
          </div>
        `);

      marker.on("click", () => {
        // Handle marker click if needed
      });
    });
  }, [map, newStops]);

  const handleSaveNewStops = async () => {
    if (newStops.length === 0 && selectedStop === null) {
      // Use a better alert/notification system in production
      return;
    }
    try {
      if (!selectedStop) {
        await addStops(newStops);
        // Show success toast/notification here
      } else {
        await editStop(selectedStop);
        // Show success toast/notification here
      }

      setNewStops([]);
      setSelectedStop(null);
      window.location.reload()
      newStopsLayerRef.current?.clearLayers();
    } catch (err) {
      console.error("Failed to save stops:", err);
      // Show error toast/notification here
    }
  };

  const handleDeleteStop = async () => {
    if (!selectedStop) return;

    // You could use a custom confirmation modal here
    if (
      !window.confirm(
        "Are you sure you want to delete this stop? This action cannot be undone."
      )
    )
      return;

    try {
      await deleteStop(selectedStop.id);
      setSelectedStop(null);
      window.location.reload()
    } catch (err) {
      console.error(err);
      // Show error toast/notification here
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <MapPinned className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Stop Management</h2>
            <p className="text-sm text-gray-500">
              Add new stops or edit existing ones
            </p>
          </div>
        </div>
      </div>

      {/* Instructions Card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <AlertCircle className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-blue-800 mb-2">How to use:</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-blue-700">
                  <span className="font-medium">Click anywhere on the map</span>{" "}
                  to add new stops
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-blue-700">
                  <span className="font-medium">Click existing stops</span> on
                  the map to edit them
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Stops Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-green-100 rounded-lg">
              <Plus className="w-4 h-4 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-800">New Stops</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-800 rounded-full">
              {newStops.length} pending
            </span>
          </div>
        </div>

        <div className="p-4">
          {newStops.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-gray-100 rounded-full">
                <MapPin className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">No new stops yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Click on the map to add your first stop
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              {newStops.map((s, idx) => (
                <div
                  key={idx}
                  className="overflow-auto group flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200"
                >
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm">
                      {idx + 1}
                    </div>
                  </div>
                  <input
                    value={s.name}
                    onChange={(e) => {
                      const updated = [...newStops];
                      updated[idx] = { ...updated[idx], name: e.target.value };
                      setNewStops(updated);
                    }}
                    className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="Enter stop name"
                  />
                  <button
                    onClick={() =>
                      setNewStops((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove stop"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Selected Stop Section - Only shows when a stop is selected */}
      {selectedStop && (
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-100 rounded-lg">
                <Edit2 className="w-4 h-4 text-amber-600" />
              </div>
              <h3 className="font-semibold text-gray-800">Editing Stop</h3>
            </div>
            <button
              onClick={() => setSelectedStop(null)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Cancel editing"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stop Name
              </label>
              <input
                value={selectedStop.name}
                onChange={(e) =>
                  setSelectedStop({ ...selectedStop, name: e.target.value })
                }
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
              />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="text-center p-2 bg-gray-50 rounded">
                  <div className="text-xs text-gray-500">Latitude</div>
                  <div className="text-sm font-mono font-semibold text-gray-800">
                    {selectedStop.lat.toFixed(6)}
                  </div>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded">
                  <div className="text-xs text-gray-500">Longitude</div>
                  <div className="text-sm font-mono font-semibold text-gray-800">
                    {selectedStop.lng.toFixed(6)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSaveNewStops}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
              <button
                onClick={handleDeleteStop}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200"
              >
                <Trash2 className="w-4 h-4" />
                Delete Stop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons - Only shows when there are new stops and no selected stop */}
      {!selectedStop && newStops.length > 0 && (
        <div className="sticky bottom-0 bg-gradient-to-t from-white via-white to-white/95 backdrop-blur-sm border-t border-gray-200 pt-4 pb-2 mt-4">
          <div className="space-y-2">
            <button
              onClick={handleSaveNewStops}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-4 py-3.5 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
            >
              <CheckCircle className="w-5 h-5" />
              Save All Stops ({newStops.length})
            </button>

            <button
              onClick={() => {
                if (
                  window.confirm(`Clear all ${newStops.length} unsaved stops?`)
                ) {
                  setNewStops([]);
                  newStopsLayerRef.current?.clearLayers();
                }
              }}
              className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-lg font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          </div>

          <div className="text-center mt-3">
            <p className="text-xs text-gray-500">
              You have {newStops.length} unsaved{" "}
              {newStops.length === 1 ? "stop" : "stops"}
            </p>
          </div>
        </div>
      )}

      {/* Empty State Tips - Shows when no stops are selected and no new stops */}
      {!selectedStop && newStops.length === 0 && (
        <div className="text-center py-6">
          <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center bg-gray-100 rounded-full">
            <ChevronRight className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-500">Ready to add stops</p>
          <p className="text-sm text-gray-400 mt-1">
            Click on the map to get started
          </p>
        </div>
      )}
    </div>
  );
}
