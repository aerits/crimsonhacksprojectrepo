import { MAX_CUSTOM_PHRASES, MAX_PHRASE_LENGTH, normalizeCustomPhrases } from '../utils/phrases.js';
import { createPhraseStore } from '../services/phrase-preferences.js';

export function createPhraseSettings() {
  const form = document.querySelector('#phrase-form');
  const input = document.querySelector('#custom-phrase');
  const list = document.querySelector('#custom-phrases');
  const empty = document.querySelector('#phrases-empty');
  const count = document.querySelector('#phrase-count');
  const characters = document.querySelector('#phrase-characters');
  const submit = document.querySelector('#save-phrase');
  const cancel = document.querySelector('#cancel-phrase');
  const status = document.querySelector('#phrase-status');
  let storage;
  try { storage = window.localStorage; } catch { /* Phrases still work for this visit. */ }
  const store = createPhraseStore(storage);
  let editingIndex = null;
  input.maxLength = MAX_PHRASE_LENGTH;

  function message(text, invalid = false) {
    status.textContent = text;
    input.setAttribute('aria-invalid', String(invalid));
  }
  function updateEditor() {
    submit.textContent = editingIndex === null ? 'Add phrase' : 'Save changes';
    submit.disabled = editingIndex === null && store.get().length >= MAX_CUSTOM_PHRASES;
    cancel.hidden = editingIndex === null;
    characters.textContent = input.value.length + ' / ' + MAX_PHRASE_LENGTH;
  }
  function resetEditor() {
    editingIndex = null;
    input.value = '';
    input.setAttribute('aria-invalid', 'false');
    updateEditor();
  }
  function savedMessage(action, persisted) {
    message(action + (persisted ? ' Saved in this browser.' : ' Available for this visit; browser storage could not save it.'));
  }
  function render() {
    const phrases = store.get();
    count.textContent = phrases.length + ' / ' + MAX_CUSTOM_PHRASES + ' custom';
    empty.hidden = phrases.length > 0;
    list.replaceChildren();
    phrases.forEach((phrase, index) => {
      const item = document.createElement('li');
      const text = document.createElement('p');
      text.textContent = phrase;
      const actions = document.createElement('div');
      actions.className = 'phrase-item-actions';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'text-button';
      edit.textContent = 'Edit';
      edit.setAttribute('aria-label', 'Edit phrase: ' + phrase);
      edit.addEventListener('click', () => {
        editingIndex = index;
        input.value = phrase;
        updateEditor();
        message('Editing phrase ' + (index + 1) + '. Save your changes or cancel.');
        input.focus();
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'text-button';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', 'Remove phrase: ' + phrase);
      remove.addEventListener('click', () => {
        const persisted = store.save(store.get().filter((_, position) => position !== index));
        if (editingIndex === index) resetEditor();
        else if (editingIndex !== null && editingIndex > index) editingIndex -= 1;
        render();
        savedMessage('Phrase removed.', persisted);
        input.focus();
      });
      actions.append(edit, remove);
      item.append(text, actions);
      list.append(item);
    });
    updateEditor();
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const [phrase] = normalizeCustomPhrases([input.value]);
      const next = store.get();
      if (next.some((entry, index) => index !== editingIndex && entry.toLowerCase() === phrase.toLowerCase())) {
        throw new Error('That phrase is already in your list.');
      }
      const action = editingIndex === null ? 'Phrase added.' : 'Phrase updated.';
      if (editingIndex === null) next.push(phrase);
      else next[editingIndex] = phrase;
      const persisted = store.save(next);
      resetEditor();
      render();
      savedMessage(action, persisted);
    } catch (error) { message(error.message, true); }
    input.focus();
  });
  input.addEventListener('input', () => { input.setAttribute('aria-invalid', 'false'); updateEditor(); });
  cancel.addEventListener('click', () => { resetEditor(); message('Edit canceled.'); input.focus(); });
  render();
  if (store.loadError) message('Saved phrases could not be loaded. You can add a new list here.');
  else if (!storage) message('Browser storage is unavailable. Phrases will work for this visit.');
  return { getPhrases: () => store.get() };
}
