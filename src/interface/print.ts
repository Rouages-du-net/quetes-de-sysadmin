// The teachers' pages' "Print" buttons (data-print): hidden without
// JavaScript (the browser's own Print still works, with the same print
// styles, see site.css), shown and wired here. A module of its own: the CSP
// allows no inline script.

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-print]')) {
  button.addEventListener('click', () => window.print());
  button.closest<HTMLElement>('[hidden]')?.removeAttribute('hidden');
}
