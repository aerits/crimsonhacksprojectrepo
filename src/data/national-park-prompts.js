const prompts = [
  {
    name: 'Arches National Park',
    start: 'We’re heading to Arches National Park, where more than two thousand natural stone arches rise from the red desert. Let’s get going.',
    arrival: 'Welcome to Arches National Park. Look forward to red-rock fins, balanced stones, and the trail toward Delicate Arch.',
  },
  {
    name: 'Canyonlands National Park',
    start: 'We’re heading to Canyonlands National Park, a vast landscape shaped by the Colorado and Green Rivers. Let’s get going.',
    arrival: 'Welcome to Canyonlands National Park. Look forward to sweeping overlooks, deep canyons, and wide-open desert horizons.',
  },
  {
    name: 'Capitol Reef National Park',
    start: 'We’re heading to Capitol Reef National Park, home to the Waterpocket Fold and a long ribbon of colorful desert cliffs. Let’s get going.',
    arrival: 'Welcome to Capitol Reef National Park. Look forward to sandstone domes, scenic drives, and historic orchards in Fruita.',
  },
  {
    name: 'Bryce Canyon National Park',
    start: 'We’re heading to Bryce Canyon National Park, where a natural amphitheater is filled with thousands of sculpted hoodoos. Let’s get going.',
    arrival: 'Welcome to Bryce Canyon National Park. Look forward to glowing hoodoos, rim overlooks, and unforgettable sunrise views.',
  },
  {
    name: 'Zion National Park',
    start: 'We’re heading to Zion National Park, where towering sandstone cliffs frame the Virgin River. Let’s get going.',
    arrival: 'Welcome to Zion National Park. Look forward to canyon walls, riverside walks, and trails beneath the cliffs.',
  },
];

const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function nationalParkPromptFor(destination) {
  const label = normalize(destination?.label || destination?.name || destination);
  return prompts.find((park) => label.includes(normalize(park.name))) || null;
}

export const nationalParkPrompts = Object.freeze(prompts.map((prompt) => Object.freeze({ ...prompt })));
