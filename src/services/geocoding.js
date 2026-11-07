export async function searchAddresses(query, { signal, fetcher = fetch, bias } = {}) {
  const params = new URLSearchParams({ q: query });
  if (Number.isFinite(bias?.lat) && Number.isFinite(bias?.lng)) {
    params.set('lat', String(bias.lat));
    params.set('lng', String(bias.lng));
  }
  const response = await fetcher(`/api/geocode?${params}`, { signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not find that address.');
  return data;
}
