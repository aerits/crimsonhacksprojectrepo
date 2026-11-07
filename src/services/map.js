export function createMap(element) {
  const L = window.L;
  if (!L) throw new Error('The map library could not load. Check your internet connection and reload.');
  const map = L.map(element, { zoomControl: false, preferCanvas: true }).setView([40.7649, -111.8421], 14);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  const markers = {};
  let routeLayer;
  let simulationMarker;
  let liveMarker;
  let simulationAnimation;
  let liveAnimation;
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
  const setLiveLocation = (point) => {
    if (!liveMarker) {
      liveMarker = L.circleMarker(point, { radius: 9, color: '#ffffff', weight: 3, fillColor: '#557bc7', fillOpacity: 1 })
        .addTo(map).bindTooltip('Your location', { direction: 'top' });
    } else {
      cancelAnimationFrame(liveAnimation);
      const from = liveMarker.getLatLng();
      const startedAt = performance.now();
      const frame = (now) => {
        const progress = Math.min(1, (now - startedAt) / 350);
        // Ease out so new GPS readings never snap the marker backwards mid-frame.
        const eased = 1 - (1 - progress) ** 3;
        liveMarker.setLatLng(pointAt(from, point, eased));
        if (progress < 1) liveAnimation = requestAnimationFrame(frame);
      };
      liveAnimation = requestAnimationFrame(frame);
    }
  };
  const follow = (point, zoom = 17) => {
    if (Math.abs(map.getZoom() - zoom) > 0.25) map.setZoom(zoom, { animate: true });
    // Avoid restarting a pan for every GPS/animation frame. Leaflet only moves
    // the viewport once the position is meaningfully away from its center.
    if (map.distance(map.getCenter(), point) > 35) map.panTo(point, { animate: true, duration: 0.45, easeLinearity: 0.25 });
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
      const distances = [0];
      for (const length of lengths) distances.push(distances.at(-1) + length);
      const total = distances.at(-1);
      if (!total) return setSimulationPoint(points.at(-1));
      const startedAt = performance.now();
      let segment = 0;
      follow(points[0], Math.max(map.getZoom(), 17));
      const frame = (now) => {
        const distance = Math.min(1, (now - startedAt) / duration) * total;
        while (segment < lengths.length - 1 && distances[segment + 1] < distance) segment += 1;
        const travelled = distances[segment];
        const point = pointAt(points[segment], points[segment + 1], (distance - travelled) / lengths[segment]);
        setSimulationPoint(point);
        follow(point);
        if (distance < total) simulationAnimation = requestAnimationFrame(frame);
        else setSimulationPoint(points.at(-1));
      };
      setSimulationPoint(points[0]);
      simulationAnimation = requestAnimationFrame(frame);
    },
    clearSimulationPoint() { cancelAnimationFrame(simulationAnimation); simulationMarker?.remove(); simulationMarker = null; },
    setLiveLocation,
    clearLiveLocation() { cancelAnimationFrame(liveAnimation); liveMarker?.remove(); liveMarker = null; },
    drawRoute(geometry) {
      routeLayer?.remove();
      routeLayer = L.geoJSON(geometry, { style: { color: '#9471b8', weight: 6, opacity: 0.9, lineCap: 'round' } }).addTo(map);
      map.fitBounds(routeLayer.getBounds(), { padding: [45, 45] });
    },
    focus(point, zoom = 15) { map.flyTo(point, zoom, { duration: 0.45, easeLinearity: 0.25 }); },
    follow,
  };
}
