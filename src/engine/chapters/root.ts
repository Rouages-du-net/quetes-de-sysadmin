// Chapter 3 — The Root: ls -l, permissions (rwx), chmod, whoami, sudo.
// Here, the tree finally looks like a real Linux: /home, /etc,
// /var/log, /root. End of the Eraser's story.

import { path, account, d, f, name, type Chapter } from '../world';
import type { Game } from '../shell';

const M = '/home/you';
const MEMORIES = `${M}/memories`;
const CONF = '/etc/eraser.conf';
const TOTAL = 8;
// The Eraser's system user, under its name in the language (effaceur, eraser…).
const eraser = (j: Game) => account(j.t, 'eraser');

const memory = (text: string) => f(text);
// The fixed configuration line, in the language: "target = /Kingdom/Bin".
const fixedTarget = (j: Game) => `${name(j.t, 'target')} = ${path(j.t, '/Kingdom/Bin')}`;

export const root: Chapter = {
  id: 'root',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'mv', 'grep', 'rm', 'touch', 'cp', 'mkdir', 'chmod', 'whoami', 'sudo'],
  home: M,
  names: true,
  welcome: 'arrival.txt',
  final: 'fixed',
  password: 'sunflower',
  createWorld: (t) =>
    d(
      {
        home: d(
          {
            you: d({
              'arrival.txt': f(
                t('root-arrival'),
                { read: (j) => void j.flags.add('arrival') },
              ),
              'admin_manual.txt': f(t('root-manual-admin')),
              'journal.txt': f(
                t('root-journal'),
                { mode: 'rw-------', lines: true },
              ),
              'eraser.conf.fixed': f(t('root-eraser-conf-fixed'), { lines: true }),
              memories: d(
                {
                  school: memory(t('root-memory-school')),
                  first_program: memory(t('root-memory-first-program')),
                  garden: memory(t('root-memory-garden')),
                  song: memory(t('root-memory-song')),
                  journey: memory(t('root-memory-journey')),
                  friend: memory(t('root-memory-friend')),
                  library: memory(t('root-memory-library')),
                  first_server: memory(t('root-memory-first-server')),
                },
                undefined,
                { mode: 'rwxrwxrwx' },
              ),
            }),
            nour: d(
              {
                'diary.txt': f(
                  (j) =>
                    j.who === 'root'
                      ? j.t('root-journal-private-root')
                      : '',
                  { owner: 'nour', mode: 'rw-------' },
                ),
              },
              undefined,
              { owner: 'nour', mode: 'rwx------' },
            ),
          },
          undefined,
          { owner: 'root' },
        ),
        etc: d(
          {
            'eraser.conf': f(
              t('root-eraser-conf'),
              { owner: 'root', lines: true },
            ),
            sudoers: f(
              t('root-sudoers'),
              { owner: 'root', mode: 'r--r-----', lines: true },
            ),
          },
          undefined,
          { owner: 'root' },
        ),
        var: d(
          {
            log: d(
              {
                'eraser.log': f(
                  t('root-eraser-log'),
                  { owner: 'root', lines: true },
                ),
              },
              undefined,
              { owner: 'root' },
            ),
          },
          undefined,
          { owner: 'root' },
        ),
        root: d(
          {
            'notes.txt': f(
              t('root-notes-root'),
              { owner: 'root', mode: 'rw-------' },
            ),
          },
          undefined,
          { owner: 'root', mode: 'rwx------' },
        ),
      },
      undefined,
      { owner: 'root' },
    ),
  // The Eraser moves on: at each command, it erases a memory, as long as
  // other users are allowed to write in the place.
  afterCommand: (j) => {
    if (!j.flags.has('alert') || j.flags.has('fixed') || !j.exists(path(j.t, CONF))) return;
    const place = j.find(path(j.t, MEMORIES));
    if (place?.type !== 'directory' || !j.can(place, 'w', eraser(j)) || !j.can(place, 'x', eraser(j))) return;
    const name = Object.keys(place.children).sort()[0];
    if (!name) return;
    delete place.children[name];
    return j.t('root-memory-erases', { memory: name });
  },
  events: [
    {
      id: 'alert',
      condition: (j) => j.flags.has('arrival'),
      message: (j) => j.t('root-event-alert'),
    },
    {
      id: 'protected',
      condition: (j) => {
        const place = j.find(path(j.t, MEMORIES));
        return j.flags.has('alert') && !j.flags.has('fixed') && place?.type === 'directory' && !(j.can(place, 'w', eraser(j)) && j.can(place, 'x', eraser(j)));
      },
      message: (j) => j.t('root-event-protected', { saved: j.count(path(j.t, MEMORIES), ''), total: TOTAL }),
    },
    {
      id: 'conf-erased',
      condition: (j) => !j.exists(path(j.t, CONF)),
      message: (j) => j.t('root-event-conf-erased'),
    },
    {
      id: 'fixed',
      condition: (j) => {
        const conf = j.find(path(j.t, CONF));
        return conf?.type === 'file' && typeof conf.content === 'string' && conf.content.includes(fixedTarget(j));
      },
      message: (j) => {
        const saved = j.count(path(j.t, MEMORIES), '');
        return j.t('root-event-fixed', { saved: saved, total: TOTAL, loss: saved < TOTAL ? 'yes' : 'no' });
      },
    },
  ],
};
