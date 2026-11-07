const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export function createVoicePicker({ select, summary, gallery, selection, onSelect, onPreview }) {
  let voices = [];
  const cards = new Map();
  select.addEventListener('change', () => onSelect(select.value));
  function setSelected(id) {
    const voice = voices.find((item) => item.id === id);
    select.value = voice?.id || '';
    summary.textContent = voice ? voice.mood : 'Choose a voice for your journey.';
    selection.textContent = voice ? voice.name + ' · ' + voice.mood : 'Choose a little company for the road.';
    for (const [voiceId, { card, button, badge }] of cards) {
      const selected = voiceId === id;
      card.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.textContent = selected ? '✓ Selected for your journey' : 'Use this voice';
      badge.hidden = !selected;
    }
  }
  function render(items, selectedId) {
    voices = items;
    cards.clear();
    select.replaceChildren();
    gallery.replaceChildren();
    if (!voices.length) {
      const option = element('option', '', 'No voices available');
      option.value = '';
      select.append(option);
      select.disabled = true;
      gallery.append(element('p', 'library-empty', 'No voices are available yet. Try loading them again.'));
      setSelected('');
      return;
    }
    select.disabled = false;
    voices.forEach((voice, index) => {
      const option = element('option', '', voice.name + ' — ' + voice.mood + (voice.configured ? '' : ' · Setup needed'));
      option.value = voice.id;
      select.append(option);
      const card = element('article', 'library-card');
      const titleId = 'voice-title-' + index;
      card.setAttribute('aria-labelledby', titleId);
      const art = element('div', 'voice-art voice-art-' + index % 3);
      const portrait = document.createElement('img');
      portrait.className = 'voice-portrait';
      portrait.src = [
        '/images/guide-luna.png',
        '/images/guide-rose.png',
        '/images/guide-iris.png',
        '/images/guide-sage.png',
        '/images/guide-amber.png',
        '/images/guide-ember.png',
      ][index % 6];
      portrait.alt = `Illustrated anime portrait of ${voice.name}`;
      portrait.loading = 'lazy';
      const badge = element('span', 'selected-badge', '✓ Your voice');
      art.append(portrait, badge);
      const body = element('div', 'library-card-body');
      const top = element('div', 'voice-card-heading');
      const title = element('h2', '', voice.name);
      title.id = titleId;
      top.append(title, element('span', 'voice-availability' + (voice.configured ? ' ready' : ''), voice.configured ? 'Ready to play' : 'Setup needed'));
      body.append(
        top,
        element('p', 'voice-mood', voice.mood),
        element('p', 'voice-description', voice.description),
        element('blockquote', 'voice-quote', '“' + voice.sample + '”'),
      );
      const actions = element('div', 'library-card-actions');
      const preview = element('button', 'preview-voice', '▷ Preview voice');
      preview.type = 'button';
      preview.disabled = !voice.configured;
      preview.setAttribute('aria-label', 'Preview ' + voice.name + ' — ' + voice.mood);
      preview.addEventListener('click', () => onPreview(voice));
      const choose = element('button', 'choose-voice', 'Use this voice');
      choose.type = 'button';
      choose.setAttribute('aria-label', 'Use ' + voice.name + ' — ' + voice.mood);
      choose.addEventListener('click', () => onSelect(voice.id));
      actions.append(preview, choose);
      body.append(actions);
      card.append(art, body);
      gallery.append(card);
      cards.set(voice.id, { card, button: choose, badge });
    });
    setSelected(selectedId);
  }
  function showError(message) {
    select.replaceChildren(element('option', '', 'Voices unavailable'));
    select.disabled = true;
    summary.textContent = 'Open the voice library to retry.';
    selection.textContent = 'We could not load your voices.';
    cards.clear();
    gallery.replaceChildren(element('p', 'library-empty', message));
  }
  return { render, setSelected, showError };
}
