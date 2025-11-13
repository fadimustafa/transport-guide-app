import axios from "axios";

const API_BASE = "http://127.0.0.1:8000";

export const fetchRoutes = async () => {
  return axios.get(`${API_BASE}/routes`);
};

export const addRoute = async (data) => {
  return axios.post(`${API_BASE}/routes`, data);
};

export const updateRoute = (id, data) => axios.put(`${API_BASE}/routes/${id}`, data);
export const deleteRoute = async (id) => {
  return axios.delete(`${API_BASE}/routes/${id}`);
};
