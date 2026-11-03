// The exam-mode checkbox of the site's home page ("For teachers" section),
// wired to the game: it asks the element for exam mode, and follows it when
// the game turns it off (on-call duty, a cancelled confirmation).

import type { SysadminQuests } from './element';

export function wireExam() {
  const game = document.querySelector<SysadminQuests>('quetes-de-sysadmin');
  const box = document.querySelector<HTMLInputElement>('#exam-mode');
  if (!game || !box) return;
  box.checked = game.exam;
  box.addEventListener('change', () => {
    game.exam = box.checked;
    // A chapter in progress asks for confirmation first: until then, nothing changes.
    box.checked = game.exam;
  });
  game.addEventListener('exam-change', (e) => {
    box.checked = (e as CustomEvent<{ exam: boolean }>).detail.exam;
  });
}
