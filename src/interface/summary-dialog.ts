// The end-of-chapter summary's details (see summary.ts in the engine and in
// this directory): step by step, the player's command next to the
// reference; and, after a replay, the comparison with the chapter's earlier
// runs (see runs.ts), whose texts (dialog-compare.ftl) load when they are
// first shown. This module is a chunk of its own (lazy-dialog.ts).

import type { Shell } from '../engine/shell';
import { summary } from '../engine/summary';
import type { Comparison } from '../engine/runs';
import { textsLoaded } from '../texts';
import type { Context } from './context';
import { el, minutes, refocusOnClose, uid } from './dom';

export default function summaryDialog(ctx: Context, replay: (id: string) => void) {
  const { t, typo } = ctx;
  const summaryId = uid('qds-summary');
  const titleSummary = el('h2', { id: summaryId });
  const mapCaption = el('p', { class: 'map-legend' });
  const tableSummary = el('div', { class: 'summary-table', tabindex: '0', role: 'region', 'aria-labelledby': summaryId });
  const encourageSummary = el('p', { class: 'map-legend' });
  // Replay and compare (see runs.ts): the earlier runs next to this one, filled when the dialog opens.
  const compareSection = el('section', { class: 'compare', hidden: '' });
  const replaySummary = el('button', { type: 'button', class: 'button button-secondary' }, t('replay-button'));
  const closeSummary = el('button', { type: 'button', class: 'button' }, t('map-close'));
  const summaryWindow = el(
    'dialog',
    { class: 'summary-window', 'aria-labelledby': summaryId },
    titleSummary,
    mapCaption,
    el('p', { class: 'map-legend' }, typo(t('summary-intro'))),
    tableSummary,
    encourageSummary,
    compareSection,
    el('p', { class: 'map-actions' }, replaySummary, ' ', closeSummary),
  ) as HTMLDialogElement;

  const longDay = (iso: string) => new Intl.DateTimeFormat(t.language, { dateStyle: 'medium' }).format(new Date(iso));
  // The comparison, in the summary's dialog: a table of measures (a column per run), then the commands diff-like.
  const fillComparison = (c: Comparison) => {
    const id = `${summaryId}-compare`;
    const last = c.runs.length - 1;
    const head = (i: number) => {
      const r = c.runs[i];
      const name = i === last ? t('compare-col-this') : t('compare-col-run', { date: longDay(r.date) });
      return el('th', { scope: 'col' }, name, ...(r.exam ? [' ', el('span', { class: 'compare-exam' }, t('compare-exam'))] : []));
    };
    const value = (metric: string, v: number | null) => (v === null ? t('compare-not-measured') : metric === 'time' ? minutes(v) : new Intl.NumberFormat(t.language).format(v));
    const kinds = { both: [' ', 'compare-both'], before: ['−', 'compare-only-before'], after: ['+', 'compare-only-after'] } as const;
    compareSection.replaceChildren(
      el('h3', { id }, t('compare-title')),
      el('p', { class: 'map-legend' }, typo(t('compare-intro'))),
      el(
        'div',
        { class: 'compare-table', tabindex: '0', role: 'region', 'aria-labelledby': id },
        el(
          'table',
          {},
          el('caption', { class: 'visually-hidden' }, t('compare-caption')),
          el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, t('compare-col-measure')), ...c.runs.map((_, i) => head(i)))),
          el(
            'tbody',
            {},
            ...c.rows.map((row) =>
              el(
                'tr',
                {},
                el('th', { scope: 'row' }, t(`compare-${row.metric}`)),
                ...row.values.map((v, i) =>
                  el('td', {}, value(row.metric, v), ...(i === last && row.trend ? [' ', el('span', { class: `compare-trend compare-${row.trend}` }, `(${t(`compare-${row.trend}`)})`)] : [])),
                ),
              ),
            ),
          ),
        ),
      ),
      el('h3', {}, t('compare-diff-title')),
      el('p', { class: 'map-legend' }, typo(t('compare-diff-intro'))),
      c.diff.length
        ? el(
            'ol',
            { class: 'compare-diff', tabindex: '0', 'aria-label': t('compare-diff-title') },
            ...c.diff.map((d) =>
              el('li', { class: `compare-${d.kind}` }, el('span', { class: 'compare-mark', 'aria-hidden': 'true' }, kinds[d.kind][0]), el('span', { class: 'visually-hidden' }, t(kinds[d.kind][1]), ' '), el('code', {}, d.line)),
            ),
          )
        : el('p', { class: 'map-legend' }, t('compare-diff-empty')),
    );
  };
  let summaryShell: Shell | null = null;
  const openSummary = (sh: Shell, recap: string, c: Comparison | null) => {
    if (c && !textsLoaded(t.language, 'dialog-compare')) return ctx.withTexts('dialog-compare', () => openSummary(sh, recap, c));
    summaryShell = sh;
    compareSection.hidden = !c;
    if (c) fillComparison(c);
    const b = summary(sh);
    titleSummary.textContent = t('summary-title', { chapter: t(`chapter-${sh.chapter.id}`) });
    mapCaption.textContent = recap;
    encourageSummary.textContent = t('summary-encourage', { hints: b.hints });
    tableSummary.replaceChildren(
      el(
        'table',
        {},
        el('thead', {}, el('tr', {}, ...['summary-col-step', 'summary-col-you', 'summary-col-reference'].map((k) => el('th', { scope: 'col' }, t(k))))),
        el(
          'tbody',
          {},
          ...b.steps.map((e, i) =>
            el(
              'tr',
              {},
              el('th', { scope: 'row' }, String(i + 1)),
              el('td', { 'data-title': t('summary-col-you') }, e.line === null ? el('span', { class: 'summary-other' }, t('summary-otherwise')) : el('code', {}, e.line)),
              el('td', { 'data-title': t('summary-col-reference') }, typo(e.solution)),
            ),
          ),
        ),
      ),
    );
    summaryWindow.showModal();
  };
  closeSummary.addEventListener('click', () => summaryWindow.close());
  replaySummary.addEventListener('click', () => summaryShell && replay(summaryShell.chapter.id));
  refocusOnClose(summaryWindow, () => ctx.input);

  return { window: summaryWindow, show: openSummary };
}
