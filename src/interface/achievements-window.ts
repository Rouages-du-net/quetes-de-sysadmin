// Achievements and rank (see achievements.ts): earned after a line, shown
// in the terminal, listed in a dialog.

import type { Shell } from '../engine/shell';
import { grade, GRADES, newAchievements, ACHIEVEMENTS } from '../engine/achievements';
import { streak } from '../engine/streak';
import type { Context } from './context';
import { el, icon, ICON_TROPHY, refocusOnClose, uid } from './dom';

export function achievementsPart(ctx: Context) {
  const { t, typo, finished, achievements } = ctx;
  // The count is set on a label span so the icon survives each update (see checkAchievements).
  const achievementsLabel = el('span', {});
  const achievementsButton = el('button', { type: 'button', class: 'pill', 'aria-haspopup': 'dialog' }, icon(...ICON_TROPHY), achievementsLabel);
  const achievementsId = uid('qds-achievements');
  const gradeAchievements = el('p', { class: 'achievement-rank' });
  const listAchievements = el('ul', { class: 'achievement-list' });
  const closeAchievements = el('button', { type: 'button', class: 'button' }, t('map-close'));
  const achievementsWindow = el(
    'dialog',
    { class: 'achievements-window', 'aria-labelledby': achievementsId },
    el('h2', { id: achievementsId }, t('achievements-title')),
    gradeAchievements,
    listAchievements,
    el('p', { class: 'map-actions' }, closeAchievements),
  ) as HTMLDialogElement;

  // The achievements earned by the last line (sh: its session; null: outside a line).
  const checkAchievements = (sh: Shell | null) => {
    for (const id of newAchievements({ sh, finished, notebook: ctx.notebook, records: ctx.records, streak: streak(Object.keys(ctx.results), ctx.today()).best }, achievements)) {
      achievements[id] = new Date().toISOString();
      ctx.show(t('achievements-obtained', { name: t(`achievements-${id}`) }), 'achievements');
    }
    achievementsUpdate();
  };
  const achievementsUpdate = () => {
    achievementsLabel.textContent = t('achievements-button', { earned: Object.keys(achievements).length, total: ACHIEVEMENTS.length });
  };
  achievementsButton.addEventListener('click', () => {
    const current = grade(finished);
    const following = GRADES.find((g) => g.chapters > finished.length);
    gradeAchievements.replaceChildren(
      el('strong', {}, t('achievements-grade', { grade: t(`grade-${current}`) })),
      ...(current === 'sre' ? [] : [' ', t('achievements-grade-next', { grade: t(`grade-${following?.id ?? 'sre'}`), chapters: following?.chapters ?? finished.length })]),
    );
    const date = (iso: string) => new Intl.DateTimeFormat(t.language, { dateStyle: 'medium' }).format(new Date(iso));
    listAchievements.replaceChildren(
      ...ACHIEVEMENTS.map((x) => {
        const obtained = achievements[x.id];
        const visible = obtained || !x.cache;
        return el(
          'li',
          { class: obtained ? 'earned' : 'to-earn' },
          el('span', { class: 'achievement-name' }, `${obtained ? '🏆' : '·'} ${visible ? t(`achievements-${x.id}`) : t('achievements-cache')}`),
          ' ',
          el('span', { class: 'achievement-description' }, visible ? typo(t(`achievements-${x.id}.description`)) : typo(t('achievements-cache.description'))),
          ...(obtained ? [' ', el('span', { class: 'achievement-date' }, t('achievements', { date: date(obtained) }))] : []),
        );
      }),
    );
    achievementsWindow.showModal();
  });
  closeAchievements.addEventListener('click', () => achievementsWindow.close());
  refocusOnClose(achievementsWindow, () => ctx.input);

  return { achievementsButton, achievementsWindow, checkAchievements };
}
