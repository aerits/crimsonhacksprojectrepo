// Each persona can use a different Fish Audio voice model.
export function getVoices(config = {}) {
  const voiceIds = config.fish?.voices || {};
  return [
    { id: 'velvet', name: 'Mommy ASMR', initial: 'M', color: '#e5d9ed', mood: 'Warm & reassuring',
      referenceId: voiceIds.velvet, speed: 0.85, cue: '[soft tone][calm]',
      sample: 'Take a little breath, sweetheart. I’ll guide you, one turn at a time.' },
    { id: 'honey', name: 'Mommy', initial: 'M', color: '#f3dfb4', mood: 'Sweet & encouraging',
      referenceId: voiceIds.honey, speed: 0.95, cue: '[soft tone][happy]',
      sample: 'Hey, honey. Get comfortable. We’ve got a lovely little journey ahead.' },
    { id: 'luna', name: 'Mommy', initial: 'M', color: '#d5e4df', mood: 'Slow & soothing',
      referenceId: voiceIds.luna, speed: 0.8, cue: '[whispering][calm]',
      sample: 'Easy now, darling. There’s no rush. I’m right here to guide you.' },
    { id: 'willow', name: 'Mommy', initial: 'M', color: '#dce6cb', mood: 'Soft & comforting',
      referenceId: voiceIds.willow, speed: 0.85, cue: '[soft tone][calm]',
      sample: 'Settle in, sweetheart. We can take this nice and easy together.' },
    { id: 'rose', name: 'Mommy', initial: 'M', color: '#f0d9dc', mood: 'Gentle & supportive',
      referenceId: voiceIds.rose, speed: 0.9, cue: '[warm][calm]',
      sample: 'You’re doing beautifully. Just follow along, one little turn at a time.' },
    { id: 'ember', name: 'Mommy', initial: 'M', color: '#f0dfc7', mood: 'Warm & affectionate',
      referenceId: voiceIds.ember, speed: 0.88, cue: '[soft tone][gentle]',
      sample: 'Take your time, love. You’re safe, and you’re on your way.' },
  ];
}

export function publicVoices(voices, hasKey) {
  return voices.map(({ referenceId, cue, speed, ...voice }) => ({
    ...voice, configured: Boolean(hasKey && referenceId),
  }));
}
