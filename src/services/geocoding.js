export async function geocodeAddress(query, { signal, fetcher = fetch } = {}) {
  const response = await fetcher(`/api/geocode?q=${encodeURIComponent(query)}`, { signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not find that address.');
  return data;
}
