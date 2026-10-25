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

export async function confirmOperatorArrival(slotId) {
  const response = await api.post(`/parking-sessions/${slotId}/operator-arrival/`);
  return response.data;
}

export async function confirmOperatorDeparture(sessionId, paymentMethod) {
  const response = await api.post(`/parking-sessions/${sessionId}/operator-departure/`, {
    payment_method: paymentMethod,
  });
  return response.data;
}

export async function refreshOperatorPaymentStatus(sessionId) {
  const response = await api.get(`/parking-sessions/${sessionId}/payment-status/`);
  return response.data;
}
