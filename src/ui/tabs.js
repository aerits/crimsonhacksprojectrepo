// Keep both views mounted so addresses, routes and the selected voice survive tab changes.
export function setupTabs(onChange) {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  let current;
  function activate(name, { focus = false, updateHash = true } = {}) {
    const selected = tabs.find((tab) => tab.dataset.tab === name) || tabs[0];
    for (const tab of tabs) {
      const active = tab === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
    }
    if (focus) selected.focus();
    const next = selected.dataset.tab;
    if (updateHash && location.hash !== '#' + next) history.replaceState(null, '', '#' + next);
    if (next !== current) { current = next; onChange(next); }
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab.dataset.tab));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); activate(tabs[next].dataset.tab, { focus: true }); }
    });
  });
  window.addEventListener('hashchange', () => activate(location.hash.slice(1), { updateHash: false }));
  activate(location.hash.slice(1) || 'journey', { updateHash: false });
  return activate;
}
