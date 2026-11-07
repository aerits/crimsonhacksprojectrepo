export const MAX_CUSTOM_PHRASES = 20;
export const MAX_PHRASE_LENGTH = 160;

export function normalizeCustomPhrases(value = []) {
  if (!Array.isArray(value)) throw new Error('Custom phrases must be a list of text entries.');
  if (value.length > MAX_CUSTOM_PHRASES) throw new Error('You can save up to ' + MAX_CUSTOM_PHRASES + ' custom phrases.');
  const seen = new Set();
  const phrases = [];
  for (const entry of value) {
    if (typeof entry !== 'string') throw new Error('Each custom phrase must be text.');
    const phrase = entry.replace(/\s+/gu, ' ').trim();
    if (!phrase) throw new Error('Enter a phrase before saving.');
    if (phrase.length > MAX_PHRASE_LENGTH) throw new Error('Keep each phrase to ' + MAX_PHRASE_LENGTH + ' characters or fewer.');
    const key = phrase.toLowerCase();
    if (!seen.has(key)) { seen.add(key); phrases.push(phrase); }
  }
  return phrases;
}
