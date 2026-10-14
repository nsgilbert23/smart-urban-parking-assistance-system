import api from "./api";

export async function getOperatorDashboard() {
  const response = await api.get("/operator/dashboard/");
  return response.data;
}

export async function updateOperatorSlotStatus(slotId, newStatus) {
  const response = await api.patch(`/operator/slots/${slotId}/status/`, {
    status: newStatus,
  });
  return response.data;
}
