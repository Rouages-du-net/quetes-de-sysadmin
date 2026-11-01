// Chapitre 3 — La Racine : ls -l, permissions (rwx), chmod, whoami, sudo.
// Ici, l'arborescence ressemble enfin à un vrai Linux : /home, /etc,
// /var/log, /root. Fin de l'histoire de l'Effaceur.

import { path, account, d, f, name, type Chapter } from '../world';
import type { Game } from '../shell';

const M = '/home/vous';
const MEMORIES = `${M}/souvenirs`;
const CONF = '/etc/effaceur.conf';
const TOTAL = 8;
// L'utilisateur système de l'Effaceur, sous son nom dans la langue (effaceur, eraser…).
const eraser = (j: Game) => account(j.t, 'effaceur');

const memory = (text: string) => f(text);
// La ligne corrigée de la configuration, dans la langue : « cible = /Royaume/Corbeille ».
const fixedTarget = (j: Game) => `${name(j.t, 'cible')} = ${path(j.t, '/Royaume/Corbeille')}`;

export const root: Chapter = {
  id: 'racine',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'mv', 'grep', 'rm', 'touch', 'cp', 'mkdir', 'chmod', 'whoami', 'sudo'],
  home: M,
  names: true,
  welcome: 'arrivee.txt',
  final: 'corrige',
  password: 'tournesol',
  createWorld: (t) =>
    d(
      {
        home: d(
          {
            vous: d({
              'arrivee.txt': f(
                t('racine-arrivee'),
                { read: (j) => void j.flags.add('arrivee') },
              ),
              'manuel_admin.txt': f(t('racine-manuel-admin')),
              'journal.txt': f(
                t('racine-journal'),
                { mode: 'rw-------', lines: true },
              ),
              'effaceur.conf.corrige': f(t('racine-effaceur-conf-corrige'), { lines: true }),
              souvenirs: d(
                {
                  ecole: memory(t('racine-souvenir-ecole')),
                  premier_programme: memory(t('racine-souvenir-premier-programme')),
                  jardin: memory(t('racine-souvenir-jardin')),
                  chanson: memory(t('racine-souvenir-chanson')),
                  voyage: memory(t('racine-souvenir-voyage')),
                  amie: memory(t('racine-souvenir-amie')),
                  bibliotheque: memory(t('racine-souvenir-bibliotheque')),
                  premier_serveur: memory(t('racine-souvenir-premier-serveur')),
                },
                undefined,
                { mode: 'rwxrwxrwx' },
              ),
            }),
            nour: d(
              {
                'journal_intime.txt': f(
                  (j) =>
                    j.who === 'root'
                      ? j.t('racine-journal-intime-root')
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
            'effaceur.conf': f(
              t('racine-effaceur-conf'),
              { owner: 'root', lines: true },
            ),
            sudoers: f(
              t('racine-sudoers'),
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
                'effaceur.log': f(
                  t('racine-effaceur-log'),
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
              t('racine-notes-root'),
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
    return j.t('racine-souvenir-efface', { souvenir: name });
  },
  events: [
    {
      id: 'alerte',
      condition: (j) => j.flags.has('arrivee'),
      message: (j) => j.t('racine-evenement-alerte'),
    },
    {
      id: 'protege',
      condition: (j) => {
        const place = j.find(path(j.t, MEMORIES));
        return j.flags.has('alerte') && !j.flags.has('corrige') && place?.type === 'dossier' && !(j.can(place, 'w', eraser(j)) && j.can(place, 'x', eraser(j)));
      },
      message: (j) => j.t('racine-evenement-protege', { sauves: j.count(path(j.t, MEMORIES), ''), total: TOTAL }),
    },
    {
      id: 'conf-effacee',
      condition: (j) => !j.exists(path(j.t, CONF)),
      message: (j) => j.t('racine-evenement-conf-effacee'),
    },
    {
      id: 'corrige',
      condition: (j) => {
        const conf = j.find(path(j.t, CONF));
        return conf?.type === 'fichier' && typeof conf.content === 'string' && conf.content.includes(fixedTarget(j));
      },
      message: (j) => {
        const saved = j.count(path(j.t, MEMORIES), '');
        return j.t('racine-evenement-corrige', { sauves: saved, total: TOTAL, perte: saved < TOTAL ? 'oui' : 'non' });
      },
    },
  ],
};
