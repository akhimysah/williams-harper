/* Arabic-Indic display only: preserve URLs, form values, IDs and numeric data. */
(() => {
  'use strict';
  if (document.documentElement.lang !== 'ar') return;
  const digits = '٠١٢٣٤٥٦٧٨٩';
  // A space splits Arabic-Indic numbers into separate RTL runs (1 500 -> 500 1).
  // U+066C keeps each grouped number in one numeric run. Phone spacing is separate.
  const grouped = /\+[0-9٠-٩][0-9٠-٩ ()-]{6,}[0-9٠-٩]|(?<![0-9٠-٩])[0-9٠-٩]{1,3}(?:[ \u00a0\u202f][0-9٠-٩]{3})+(?![0-9٠-٩])/g;
  const format = value => String(value)
    .replace(grouped, number => number.startsWith('+') ? number : number.replace(/[ \u00a0\u202f]/g, '٬'))
    .replace(/([0-9])[.,](?=[0-9])/g, '$1٫')
    .replace(/[0-9]/g, digit => digits[Number(digit)])
    .replace(/%/g, '٪');
  const excluded = 'script,style,textarea,input,code,pre,[contenteditable],.wh-user';
  const attributes = ['alt', 'title', 'aria-label', 'aria-valuetext', 'placeholder'];
  function localize(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      if (!root.parentElement || root.parentElement.closest(excluded)) return;
      const next = format(root.nodeValue);
      if (next !== root.nodeValue) root.nodeValue = next;
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE || root.closest(excluded)) return;
    for (const name of attributes) {
      if (!root.hasAttribute(name)) continue;
      const before = root.getAttribute(name), next = format(before);
      if (next !== before) root.setAttribute(name, next);
    }
    for (const node of root.childNodes) localize(node);
  }
  localize(document.body);
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'childList') record.addedNodes.forEach(localize);
      else localize(record.target);
    }
  }).observe(document.body, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: attributes
  });
})();
