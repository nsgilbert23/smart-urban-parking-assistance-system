import api from "./api";

export async function getReportsAnalytics({ start_date, end_date }) {
  const response = await api.get("/reports/analytics/", {
    params: { start_date, end_date },
  });
  return response.data;
}
