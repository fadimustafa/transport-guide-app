import axios from "axios";

const API_BASE = "http://127.0.0.1:8000/api";

//routes
export const fetchRoutes = async () => {
  return axios.get(`${API_BASE}/route`);
};
export const addRoute = async (data) => {
  return axios.post(`${API_BASE}/route`, data);
};
export const updateRoute = (selectedRouteId, selectedDirectionId, data) =>
  axios.put(`${API_BASE}/${selectedRouteId}/${selectedDirectionId}`, data);

export const deleteRoute = async (route_id, dirction_id) => {
  return axios.delete(`${API_BASE}/route/${route_id}/${dirction_id}`);
};

//stops
export const fetchStops = async () => {
  return axios.get(`${API_BASE}/stop`);
};
export const addStops = (stops) => axios.post(`${API_BASE}/stop`, { stops });
export const editStop = (stop) => axios.put(`${API_BASE}/stop`, stop);

export const deleteStop = (stop_id) => {
  return axios.delete(`${API_BASE}/stop/${stop_id}`);
};


