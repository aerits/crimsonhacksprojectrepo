import catalog from './utah-outdoors.json' with { type: 'json' };

export const utahStateParks = catalog.stateParks.map(({ name }) => name);

export function stateParkPageUrl(name) {
  const park = catalog.stateParks.find((item) => item.name === name);
  const slug = park?.slug || name
    .replace(/ State Park(?: and Museum| Museum)?$| State Recreation Area$| and Golf Course$/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `https://stateparks.utah.gov/parks/${slug}/`;
}
