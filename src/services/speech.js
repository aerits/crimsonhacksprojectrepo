// The server synthesizes speech. The browser only plays the returned audio.
export function createSpeechService(audio, onStatus = () => {}) {
  let controller;
  let objectUrl;
  let generation = 0;
  function stop() {
    generation += 1;
    controller?.abort();
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = undefined;
  }
  audio.addEventListener('ended', () => onStatus('Ready for the next turn.'));
  return {
    stop,
    async voices() {
      const response = await fetch('/api/voices');
      if (!response.ok) throw new Error('Could not load voices. Please reload.');
      return response.json();
    },
    async speak(text, voiceId, { afterTurnPhrase = false, customAfterTurnPhrases = [], affirmation } = {}) {
      stop();
      const current = generation;
      controller = new AbortController();
      onStatus('Making a little audio for you…');
      try {
        const response = await fetch('/api/tts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voiceId, ...(afterTurnPhrase && { afterTurnPhrase: true, ...(affirmation && { affirmation }), ...(customAfterTurnPhrases.length && { customAfterTurnPhrases }) }) }), signal: controller.signal,
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'Could not generate speech.');
        }
        const blob = await response.blob();
        if (generation !== current) return;
        objectUrl = URL.createObjectURL(blob);
        audio.src = objectUrl;
        try {
          await audio.play();
          if (generation === current) onStatus('Your guide is speaking.');
        } catch {
          if (generation === current) onStatus('Audio playback was blocked. Try again from a voice button.');
        }
      } catch (error) {
        if (generation === current && error.name !== 'AbortError') onStatus(error.message);
      }
    },
  };
}
