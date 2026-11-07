const rad = Math.PI / 180;
const deg = 180 / Math.PI;
const normalize = (value) => (value % 360 + 360) % 360;
export function solarPosition({ lat, lng }, time) {
  const n = new Date(time).getTime() / 86_400_000 + 2_440_587.5 - 2_451_545;
  const longitude = (normalize(280.46 + .9856474 * n) + 1.915 * Math.sin(normalize(357.528 + .9856003 * n) * rad) + .02 * Math.sin(2 * normalize(357.528 + .9856003 * n) * rad)) * rad;
  const obliquity = 23.439 * rad;
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(longitude));
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(longitude), Math.cos(longitude)) * deg / 15;
  const hourAngle = (normalize(280.46 + 360.9856474 * n + lng) / 15 - rightAscension) * 15 * rad;
  const latitude = lat * rad;
  const elevation = Math.asin(Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle)) * deg;
  const azimuth = normalize(Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(latitude) - Math.tan(declination) * Math.cos(latitude)) * deg + 180);
  return { azimuth, elevation };
}
export const bearing = (from, to) => normalize(Math.atan2(Math.sin((to.lng - from.lng) * rad) * Math.cos(to.lat * rad), Math.cos(from.lat * rad) * Math.sin(to.lat * rad) - Math.sin(from.lat * rad) * Math.cos(to.lat * rad) * Math.cos((to.lng - from.lng) * rad)) * deg);
export const angularDifference = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
export function sunGlare(from, to, time) { const sun = solarPosition(from, time); const travelBearing = bearing(from, to); return { ...sun, bearing: travelBearing, glare: sun.elevation >= 0 && sun.elevation <= 15 && angularDifference(travelBearing, sun.azimuth) <= 30 }; }
