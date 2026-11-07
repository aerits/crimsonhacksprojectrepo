export function createMap(element) {
  const L = window.L;
  if (!L) throw new Error('The map library could not load. Check your internet connection and reload.');
  const map = L.map(element, { zoomControl: false }).setView([40.7649, -111.8421], 14);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  const markers = {};
  let routeLayer;
  let simulationMarker;
  let simulationAnimation;
  const pointAt = (from, to, amount) => ({
    lat: from.lat + (to.lat - from.lat) * amount,
    lng: from.lng + (to.lng - from.lng) * amount,
  });
  const segmentLength = (from, to) => Math.hypot(to.lat - from.lat, (to.lng - from.lng) * Math.cos((from.lat + to.lat) * Math.PI / 360));
  const setSimulationPoint = (point) => {
    if (!simulationMarker) {
      simulationMarker = L.circleMarker(point, { radius: 9, color: '#ffffff', weight: 3, fillColor: '#ce82a7', fillOpacity: 1 })
        .addTo(map).bindTooltip('Simulated location', { direction: 'top' });
    } else simulationMarker.setLatLng(point);
  };
  return {
    resize() { map.invalidateSize({ pan: false }); },
    setPoint(kind, point) {
      markers[kind]?.remove();
      markers[kind] = L.marker(point, { icon: L.divIcon({
        className: `map-pin ${kind}`, html: `<span>${kind === 'start' ? 'A' : 'B'}</span>`, iconSize: [30, 30], iconAnchor: [15, 15],
      }) }).addTo(map).bindTooltip(kind === 'start' ? 'Starting point' : 'Destination');
    },
    clearRoute() { routeLayer?.remove(); routeLayer = null; },
    setSimulationPoint,
    animateSimulationPath(coordinates, duration) {
      cancelAnimationFrame(simulationAnimation);
      const points = coordinates.map(([lng, lat]) => ({ lat, lng }));
      if (points.length < 2) return setSimulationPoint(points[0]);
      const lengths = points.slice(1).map((point, index) => segmentLength(points[index], point));
      const total = lengths.reduce((sum, length) => sum + length, 0);
      if (!total) return setSimulationPoint(points.at(-1));
      const startedAt = performance.now();
      const frame = (now) => {
        const distance = Math.min(1, (now - startedAt) / duration) * total;
        let travelled = 0;
        for (let index = 0; index < lengths.length; index += 1) {
          if (travelled + lengths[index] >= distance) {
            setSimulationPoint(pointAt(points[index], points[index + 1], (distance - travelled) / lengths[index]));
            break;
          }
          travelled += lengths[index];
        }
        if (distance < total) simulationAnimation = requestAnimationFrame(frame);
        else setSimulationPoint(points.at(-1));
      };
      setSimulationPoint(points[0]);
      simulationAnimation = requestAnimationFrame(frame);
    },
    clearSimulationPoint() { cancelAnimationFrame(simulationAnimation); simulationMarker?.remove(); simulationMarker = null; },
    drawRoute(geometry) {
      routeLayer?.remove();
      routeLayer = L.geoJSON(geometry, { style: { color: '#9471b8', weight: 6, opacity: 0.9, lineCap: 'round' } }).addTo(map);
      map.fitBounds(routeLayer.getBounds(), { padding: [45, 45] });
    },
    focus(point) { map.flyTo(point, 15); },
  };
}
