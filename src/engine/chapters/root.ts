// Chapitre 3 — La Racine : ls -l, permissions (rwx), chmod, whoami, sudo.
// Ici, l'arborescence ressemble enfin à un vrai Linux : /home, /etc,
// /var/log, /root. Fin de l'histoire de l'Effaceur.

import { path, account, d, f, name, type Chapter } from '../world';
import type { Game } from '../shell';

const M = '/home/you';
const MEMORIES = `${M}/memories`;
const CONF = '/etc/eraser.conf';
const TOTAL = 8;
// L'utilisateur système de l'Effaceur, sous son nom dans la langue (effaceur, eraser…).
const eraser = (j: Game) => account(j.t, 'eraser');

const memory = (text: string) => f(text);
// La ligne corrigée de la configuration, dans la langue : « cible = /Royaume/Corbeille ».
const fixedTarget = (j: Game) => `${name(j.t, 'target')} = ${path(j.t, '/Kingdom/Bin')}`;

export const root: Chapter = {
  id: 'root',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'mv', 'grep', 'rm', 'touch', 'cp', 'mkdir', 'chmod', 'whoami', 'sudo'],
  home: M,
  names: true,
  welcome: 'arrival.txt',
  final: 'corrige',
  password: 'sunflower',
  createWorld: (t) =>
    d(
      {
        home: d(
          {
            you: d({
              'arrival.txt': f(
                t('root-arrivee'),
                { read: (j) => void j.flags.add('arrivee') },
              ),
              'admin_manual.txt': f(t('root-manuel-admin')),
              'journal.txt': f(
                t('root-journal'),
                { mode: 'rw-------', lines: true },
              ),
              'eraser.conf.fixed': f(t('root-effaceur-conf-corrige'), { lines: true }),
              memories: d(
                {
                  school: memory(t('root-souvenir-ecole')),
                  first_program: memory(t('root-souvenir-premier-programme')),
                  garden: memory(t('root-souvenir-jardin')),
                  song: memory(t('root-souvenir-chanson')),
                  journey: memory(t('root-souvenir-voyage')),
                  friend: memory(t('root-souvenir-amie')),
                  library: memory(t('root-souvenir-bibliotheque')),
                  first_server: memory(t('root-souvenir-premier-serveur')),
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
                      ? j.t('root-journal-intime-root')
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
              t('root-effaceur-conf'),
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
                  t('root-effaceur-log'),
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
  // L'Effaceur avance : à chaque commande, il efface un souvenir, tant que
  // les autres utilisateurs ont le droit d'écrire dans le lieu.
  afterCommand: (j) => {
    if (!j.flags.has('alerte') || j.flags.has('corrige') || !j.exists(path(j.t, CONF))) return;
    const place = j.find(path(j.t, MEMORIES));
    if (place?.type !== 'dossier' || !j.can(place, 'w', eraser(j)) || !j.can(place, 'x', eraser(j))) return;
    const name = Object.keys(place.children).sort()[0];
    if (!name) return;
    delete place.children[name];
    return j.t('root-souvenir-efface', { souvenir: name });
  },
  events: [
    {
      id: 'alerte',
      condition: (j) => j.flags.has('arrivee'),
      message: (j) => j.t('root-evenement-alerte'),
    },
    {
      id: 'protege',
      condition: (j) => {
        const place = j.find(path(j.t, MEMORIES));
        return j.flags.has('alerte') && !j.flags.has('corrige') && place?.type === 'dossier' && !(j.can(place, 'w', eraser(j)) && j.can(place, 'x', eraser(j)));
      },
      message: (j) => j.t('root-evenement-protege', { sauves: j.count(path(j.t, MEMORIES), ''), total: TOTAL }),
    },
    {
      id: 'conf-effacee',
      condition: (j) => !j.exists(path(j.t, CONF)),
      message: (j) => j.t('root-evenement-conf-effacee'),
    },
    {
      id: 'corrige',
      condition: (j) => {
        const conf = j.find(path(j.t, CONF));
        return conf?.type === 'fichier' && typeof conf.content === 'string' && conf.content.includes(fixedTarget(j));
      },
      message: (j) => {
        const saved = j.count(path(j.t, MEMORIES), '');
        return j.t('root-evenement-corrige', { sauves: saved, total: TOTAL, perte: saved < TOTAL ? 'oui' : 'non' });
      },
    },
  ],
};
