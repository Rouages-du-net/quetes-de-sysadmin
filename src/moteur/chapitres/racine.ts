// Chapitre 3 — La Racine : ls -l, permissions (rwx), chmod, whoami, sudo.
// Ici, l'arborescence ressemble enfin à un vrai Linux : /home, /etc,
// /var/log, /root. Fin de l'histoire de l'Effaceur.

import { d, f, type Chapitre } from '../monde';

const M = '/home/vous';
const SOUVENIRS = `${M}/souvenirs`;
const CONF = '/etc/effaceur.conf';
const TOTAL = 8;

const souvenir = (texte: string) => f(texte);

export const racine: Chapitre = {
  id: 'racine',
  numero: 3,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'mv', 'grep', 'rm', 'touch', 'cp', 'mkdir', 'chmod', 'whoami', 'sudo'],
  maison: M,
  accueil: 'arrivee.txt',
  final: 'corrige',
  motDePasse: 'tournesol',
  creerMonde: (t) =>
    d(
      {
        home: d(
          {
            vous: d({
              'arrivee.txt': f(
                t('racine-arrivee'),
                { lu: (j) => void j.drapeaux.add('arrivee') },
              ),
              'manuel_admin.txt': f(t('racine-manuel-admin')),
              'journal.txt': f(
                t('racine-journal'),
                { mode: 'rw-------', lignes: true },
              ),
              'effaceur.conf.corrige': f(t('racine-effaceur-conf-corrige'), { lignes: true }),
              souvenirs: d(
                {
                  ecole: souvenir(t('racine-souvenir-ecole')),
                  premier_programme: souvenir(t('racine-souvenir-premier-programme')),
                  jardin: souvenir(t('racine-souvenir-jardin')),
                  chanson: souvenir(t('racine-souvenir-chanson')),
                  voyage: souvenir(t('racine-souvenir-voyage')),
                  amie: souvenir(t('racine-souvenir-amie')),
                  bibliotheque: souvenir(t('racine-souvenir-bibliotheque')),
                  premier_serveur: souvenir(t('racine-souvenir-premier-serveur')),
                },
                undefined,
                { mode: 'rwxrwxrwx' },
              ),
            }),
            nour: d(
              {
                'journal_intime.txt': f(
                  (j) =>
                    j.qui === 'root'
                      ? j.t('racine-journal-intime-root')
                      : '',
                  { proprio: 'nour', mode: 'rw-------' },
                ),
              },
              undefined,
              { proprio: 'nour', mode: 'rwx------' },
            ),
          },
          undefined,
          { proprio: 'root' },
        ),
        etc: d(
          {
            'effaceur.conf': f(
              t('racine-effaceur-conf'),
              { proprio: 'root', lignes: true },
            ),
            sudoers: f(
              t('racine-sudoers'),
              { proprio: 'root', mode: 'r--r-----', lignes: true },
            ),
          },
          undefined,
          { proprio: 'root' },
        ),
        var: d(
          {
            log: d(
              {
                'effaceur.log': f(
                  t('racine-effaceur-log'),
                  { proprio: 'root', lignes: true },
                ),
              },
              undefined,
              { proprio: 'root' },
            ),
          },
          undefined,
          { proprio: 'root' },
        ),
        root: d(
          {
            'notes.txt': f(
              t('racine-notes-root'),
              { proprio: 'root', mode: 'rw-------' },
            ),
          },
          undefined,
          { proprio: 'root', mode: 'rwx------' },
        ),
      },
      undefined,
      { proprio: 'root' },
    ),
  // L'Effaceur avance : à chaque commande, il efface un souvenir, tant que
  // les autres utilisateurs ont le droit d'écrire dans le lieu.
  apresCommande: (j) => {
    if (!j.drapeaux.has('alerte') || j.drapeaux.has('corrige') || !j.existe(CONF)) return;
    const lieu = j.trouver(SOUVENIRS);
    if (lieu?.type !== 'dossier' || !j.peut(lieu, 'w', 'effaceur') || !j.peut(lieu, 'x', 'effaceur')) return;
    const nom = Object.keys(lieu.enfants).sort()[0];
    if (!nom) return;
    delete lieu.enfants[nom];
    return j.t('racine-souvenir-efface', { souvenir: nom });
  },
  evenements: [
    {
      id: 'alerte',
      condition: (j) => j.drapeaux.has('arrivee'),
      message: (j) => j.t('racine-evenement-alerte'),
    },
    {
      id: 'protege',
      condition: (j) => {
        const lieu = j.trouver(SOUVENIRS);
        return j.drapeaux.has('alerte') && !j.drapeaux.has('corrige') && lieu?.type === 'dossier' && !(j.peut(lieu, 'w', 'effaceur') && j.peut(lieu, 'x', 'effaceur'));
      },
      message: (j) => j.t('racine-evenement-protege', { sauves: j.compter(SOUVENIRS, ''), total: TOTAL }),
    },
    {
      id: 'conf-effacee',
      condition: (j) => !j.existe(CONF),
      message: (j) => j.t('racine-evenement-conf-effacee'),
    },
    {
      id: 'corrige',
      condition: (j) => {
        const conf = j.trouver(CONF);
        return conf?.type === 'fichier' && typeof conf.contenu === 'string' && conf.contenu.includes('cible = /Royaume/Corbeille');
      },
      message: (j) => {
        const sauves = j.compter(SOUVENIRS, '');
        return j.t('racine-evenement-corrige', { sauves, total: TOTAL, perte: sauves < TOTAL ? 'oui' : 'non' });
      },
    },
  ],
};
