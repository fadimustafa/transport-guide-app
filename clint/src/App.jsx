import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import MapPage from "./pages/MapPage";
import "leaflet/dist/leaflet.css";
import RoutesEditor from "./pages/RoutesEditor";
import RouteManager from "./pages/RouteManager";

export default function App() {
  return (
    <BrowserRouter>
      <nav className="flex justify-center space-x-6 bg-gray-800 text-white p-4">
        <Link to="/" className="hover:underline">
          🗺️ Map
        </Link>
        <Link to="/update-routes" className="hover:underline">
          RouteManager
        </Link>
      </nav>

      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/update-routes" element={<RoutesEditor />} />
      </Routes>
    </BrowserRouter>
  );
}
