export const PERSONAS = [
  { id: 'cozy', name: 'The cozy copilot', tag: 'Warm & reassuring', icon: 'coffee', color: '#f5e0cf', prompt: 'Be a warm, reassuring road-trip companion. Use gentle encouragement and a little cozy charm. Keep it brief.', flavor: 'A little adventure, at your own pace.' },
  { id: 'explorer', name: 'The adventurer', tag: 'Curious & upbeat', icon: 'compass', color: '#dce9d7', prompt: 'Be an enthusiastic explorer. Add a sense of discovery and optimism, with short, cheerful phrases.', flavor: 'Your next adventure awaits.' },
  { id: 'cosmic', name: 'Mission control', tag: 'Calm & cosmic', icon: 'orbit', color: '#e8e0f6', prompt: 'Sound like calm mission control on a space expedition. Use playful space metaphors, without inventing navigation details.', flavor: 'Mission looking good, commander.' },
  { id: 'custom', name: 'Your own character', tag: 'Make it yours', icon: 'sparkles', color: '#f7e4a8', prompt: 'Be a witty, friendly travel companion. Add a short, playful remark while keeping every direction clear.', flavor: 'A journey with your own soundtrack.' },
];
export const DEMO_ROUTE = {
  id: 'campus-demo', source: 'demo', origin: 'The University of Alabama', destination: 'Tuscaloosa Riverwalk', mode: 'DRIVE',
  distanceMeters: 4184, durationSeconds: 540, label: 'A little campus escape',
  steps: [
    { id: 'demo-0', instruction: 'Head west on University Boulevard.', distanceMeters: 1200, maneuver: 'DEPART', point: {lat:33.2098,lng:-87.5487} },
    { id: 'demo-1', instruction: 'Turn right onto Greensboro Avenue.', distanceMeters: 650, maneuver: 'TURN_RIGHT', point: {lat:33.2098,lng:-87.5655} },
    { id: 'demo-2', instruction: 'Continue on Greensboro Avenue.', distanceMeters: 800, maneuver: 'STRAIGHT', point: {lat:33.2146,lng:-87.5655} },
    { id: 'demo-3', instruction: 'Turn right onto Jack Warner Parkway.', distanceMeters: 1050, maneuver: 'TURN_RIGHT', point: {lat:33.2158,lng:-87.5655} },
    { id: 'demo-4', instruction: 'Turn left toward Tuscaloosa Riverwalk.', distanceMeters: 484, maneuver: 'TURN_LEFT', point: {lat:33.2163,lng:-87.5541} },
    { id: 'demo-5', instruction: 'You have arrived at Tuscaloosa Riverwalk.', distanceMeters: 0, maneuver: 'ARRIVE', point: {lat:33.2181,lng:-87.5541} },
  ],
};
export function formatDistance(meters) { return meters >= 1609 ? (meters / 1609.344).toFixed(1) + ' mi' : Math.round(meters * 3.28084 / 50) * 50 + ' ft'; }
export function googleMapsUrl(origin, destination, mode = 'DRIVE') {
  const url = new URL('https://www.google.com/maps/dir/');
  url.search = new URLSearchParams({api:'1', origin, destination, travelmode:({DRIVE:'driving',WALK:'walking',BICYCLE:'bicycling'})[mode] || 'driving', dir_action:'navigate'}).toString();
  return url.toString();
}
export function decodePolyline(encoded) {
  const points = []; let i=0, lat=0, lng=0;
  const next=()=>{let result=0,shift=0,byte;do {if(i>=encoded.length || shift>30)throw new Error('Invalid route geometry.');byte=encoded.charCodeAt(i++)-63;if(byte<0||byte>63)throw new Error('Invalid route geometry.');result|=(byte&31)<<shift;shift+=5;}while(byte>=32);return result&1?~(result>>1):result>>1;};
  while(i<encoded.length){lat+=next();lng+=next();points.push({lat:lat/1e5,lng:lng/1e5});}
  return points;
}
export function demoNarration(steps, personaId) {
  const persona=PERSONAS.find(p=>p.id===personaId)||PERSONAS[0];
  return steps.map((step,i)=>({id:step.id, instruction:step.instruction, text:step.instruction+(i%2===0?' '+persona.flavor:'' )}));
}
// AI may add a short aside; it never replaces the authoritative instruction.
export function composeNarration(steps, asides) {
  if(asides.length!==steps.length)throw new Error('Incomplete narration response.');
  return steps.map((step,i)=>({id:step.id, instruction:step.instruction, text:step.instruction+(asides[i]?.trim()?' '+asides[i].trim():'')}));
}
