export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Distance cumulée depuis le début jusqu'au waypoint d'index `toIndex` */
export function cumulativeDistanceKm(
  waypoints: { lat: number; lng: number }[],
  toIndex: number,
): number {
  let total = 0;
  for (let i = 1; i <= toIndex && i < waypoints.length; i++) {
    total += haversineKm(
      waypoints[i - 1].lat, waypoints[i - 1].lng,
      waypoints[i].lat,     waypoints[i].lng,
    );
  }
  return total;
}
