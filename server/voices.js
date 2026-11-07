// Each persona can use a different Fish Audio voice model.
export function getVoices(env = process.env) {
  return [
    { id: 'velvet', name: 'Velvet', initial: 'V', color: '#e5d9ed', mood: 'Warm & reassuring',
      referenceId: env.FISH_VOICE_VELVET, speed: 0.85, cue: '[soft tone][calm]',
      sample: 'Take a little breath, sweetheart. I’ll guide you, one turn at a time.' },
    { id: 'honey', name: 'Honey', initial: 'H', color: '#f3dfb4', mood: 'Sweet & encouraging',
      referenceId: env.FISH_VOICE_HONEY, speed: 0.95, cue: '[soft tone][happy]',
      sample: 'Hey, honey. Get comfortable. We’ve got a lovely little journey ahead.' },
    { id: 'luna', name: 'Luna', initial: 'L', color: '#d5e4df', mood: 'Slow & soothing',
      referenceId: env.FISH_VOICE_LUNA, speed: 0.8, cue: '[whispering][calm]',
      sample: 'Easy now, darling. There’s no rush. I’m right here to guide you.' },
  ];
}

export function publicVoices(voices, hasKey) {
  return voices.map(({ referenceId, cue, speed, ...voice }) => ({
    ...voice, configured: Boolean(hasKey && referenceId),
  }));
}
