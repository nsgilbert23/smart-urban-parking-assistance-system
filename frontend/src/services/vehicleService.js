import api from "./api";

export async function getVehicles() {
  const response = await api.get("/vehicles/");
  return response.data;
}

export async function createVehicle(data) {
  const response = await api.post("/vehicles/", data);
  return response.data;
}

export async function updateVehicle(id, data) {
  const response = await api.put(`/vehicles/${id}/`, data);
  return response.data;
}

export async function deleteVehicle(id) {
  await api.delete(`/vehicles/${id}/`);
}