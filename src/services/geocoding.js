export async function searchAddresses(query, { origin, signal, fetcher = fetch } = {}) {
  const params = new URLSearchParams({ q: query });
  if (origin) {
    params.set('lat', origin.lat);
    params.set('lng', origin.lng);
  }
  const response = await fetcher('/api/geocode?' + params, { signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not find that address.');
  return data;
}
