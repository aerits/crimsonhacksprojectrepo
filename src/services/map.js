export function createMap(element, onPick) {
  const L = window.L;
  if (!L) throw new Error('The map library could not load. Check your internet connection and reload.');
  const map = L.map(element, { zoomControl: false }).setView([33.2098, -87.5532], 14);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  const markers = {};
  let routeLayer;
  map.on('click', ({ latlng }) => onPick(latlng));
  return {
    setPoint(kind, point) {
      markers[kind]?.remove();
      markers[kind] = L.marker(point, { icon: L.divIcon({
        className: `map-pin ${kind}`, html: `<span>${kind === 'start' ? 'A' : 'B'}</span>`, iconSize: [30, 30], iconAnchor: [15, 15],
      }) }).addTo(map).bindTooltip(kind === 'start' ? 'Starting point' : 'Destination');
    },
    clearRoute() { routeLayer?.remove(); routeLayer = null; },
    drawRoute(geometry) {
      routeLayer?.remove();
      routeLayer = L.geoJSON(geometry, { style: { color: '#75608e', weight: 6, opacity: 0.9, lineCap: 'round' } }).addTo(map);
      map.fitBounds(routeLayer.getBounds(), { padding: [45, 45] });
    },
    focus(point) { map.flyTo(point, 15); },
  };
}
