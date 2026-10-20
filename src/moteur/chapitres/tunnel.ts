// Histoire « La Maison des associations » — chapitre « Le tunnel » : la page
// d'administration du wiki n'écoute que sur 127.0.0.1:8080 du wiki (exprès :
// elle n'est pas faite pour internet), et le wiki n'a pas de navigateur.
// Ouvrir un tunnel depuis son poste (ssh -f -N -L 8080:localhost:8080 wiki),
// valider les inscriptions en attente (sauf le compte publicitaire), puis
// refermer le tunnel (ps, kill).
// Pièges réels : « localhost » dans -L s'entend du côté de la machine d'en
// face (-L 8080:localhost:8080 maison mène à maison, où rien n'écoute ;
// -L 8080:wiki:8080 maison arrive par l'adresse du wiki, pas par 127.0.0.1).
// Objectif vérifié sur l'état : les deux inscriptions validées, la
// publicitaire non, et plus aucun tunnel ouvert sur le poste.
// Sources : https://man.openbsd.org/ssh#L, https://man.openbsd.org/ssh#N

import { f, type Chapitre } from '../monde';
import type { Jeu, Shell } from '../shell';
import type { Appli } from '../nginx';
import { nouveauSystemd } from '../systemd';
import { chargerSshd, comptesMaison, dossierSsh, etatMaison, hoteInterne, M, MAINTENANT, mondeMaison, MOT_DE_PASSE } from './maison';

type Inscription = 'attente' | 'validee' | 'refusee';
const VALIDER = ['samir', 'lea'];
const PUBLICITE = 'promo-casino';
const INSCRIPTIONS = (): Record<string, Inscription> => ({ samir: 'attente', lea: 'attente', [PUBLICITE]: 'attente' });

const inscriptions = (j: Jeu) => j.etat.inscriptions as Record<string, Inscription>;

// La page d'administration du wiki : la liste des inscriptions, et une adresse pour valider ou refuser chacune.
const ADMIN: Appli = {
  service: 'wiki-admin',
  pages: {},
  repondre: (j, chemin) => {
    const liste = inscriptions(j);
    if (chemin === '/' || chemin === '/admin' || chemin === '/admin/') {
      const lignes = Object.entries(liste).map(([nom, etat]) => j.t('tunnel-admin-ligne', { nom, etat }));
      return { code: 200, type: 'text/plain; charset=utf-8', corps: j.t('tunnel-admin-page', { lignes: lignes.join('\n') }) };
    }
    const m = /^\/admin\/(valider|refuser)\/([\w-]+)\/?$/.exec(chemin);
    if (m && liste[m[2]]) {
      liste[m[2]] = m[1] === 'valider' ? 'validee' : 'refusee';
      return { code: 200, type: 'text/plain; charset=utf-8', corps: j.t(`tunnel-admin-${m[1]}`, { nom: m[2] }) };
    }
    return { code: 404, type: 'text/plain; charset=utf-8', corps: j.t('tunnel-admin-introuvable') };
  },
};

const wiki = (j: Jeu) => (j as Shell).interne('wiki')!;
const poste = (j: Jeu) => (j.etat.poste as (() => Shell) | undefined)?.();
// Les tunnels du poste encore ouverts (leur processus ssh tourne).
const tunnelsOuverts = (j: Jeu) => {
  const p = poste(j);
  if (!p) return 0;
  const vivants = ((p.etat.processus ?? []) as { pid: number }[]).map((x) => x.pid);
  return ((p.etat.tunnels ?? []) as { pid: number }[]).filter((t) => vivants.includes(t.pid)).length;
};
const validees = (j: Jeu) => VALIDER.every((n) => inscriptions(wiki(j))[n] === 'validee');
const publiciteValidee = (j: Jeu) => inscriptions(wiki(j))[PUBLICITE] === 'validee';

export const tunnel: Chapitre = {
  id: 'tunnel',
  numero: 3,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'id', 'whoami', 'hostname', 'ssh'],
  maison: M,
  accueil: 'courriel_yasmine.txt',
  noms: true,
  final: 'fin',
  motDePasse: MOT_DE_PASSE,
  comptes: comptesMaison,
  clesDuJoueur: true,
  surveillePoste: true,
  etat: () => etatMaison(),
  initialiser: chargerSshd,
  hotes: {
    wiki: hoteInterne('wiki', '10.20.0.11', {
      commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'id', 'whoami', 'hostname', 'systemctl', 'ss'],
      maison: (t) => ({ 'note_gaspard.txt': f(t('tunnel-note-gaspard')) }),
      etat: () => ({
        inscriptions: INSCRIPTIONS(),
        ecoute: [
          { proto: 'tcp', adresse: '0.0.0.0', port: 22, processus: 'sshd', pid: 512 },
          { proto: 'tcp', adresse: '127.0.0.1', port: 8080, processus: 'python3', pid: 731 },
        ],
        applis: { '127.0.0.1:8080': ADMIN },
        systemd: nouveauSystemd('wiki', MAINTENANT - 30 * 86_400_000, MAINTENANT, {
          'wiki-admin': {
            description: 'Wiki admin interface (127.0.0.1:8080)',
            active: true,
            executable: 'wiki-admin',
            processus: [
              { pid: 731, utilisateur: 'www-data', cpu: 0.1, mem: 1.4, commande: '/usr/bin/python3 /srv/wiki/admin.py --bind 127.0.0.1:8080' },
            ],
          },
        }),
      }),
    }),
    archives: hoteInterne('archives', '10.20.0.12'),
  },
  creerMonde: (t) => mondeMaison({ motsDePasse: 'no', maison: { 'courriel_yasmine.txt': f(t('tunnel-courriel-yasmine')), '.ssh': dossierSsh() } }),
  evenements: [
    { id: 'publicite', condition: publiciteValidee, message: (j) => j.t('tunnel-evenement-publicite', { compte: PUBLICITE }) },
    { id: 'validees', condition: (j) => validees(j) && !publiciteValidee(j), message: (j) => j.t('tunnel-evenement-validees') },
    { id: 'fin', condition: (j) => validees(j) && !publiciteValidee(j) && tunnelsOuverts(j) === 0, message: (j) => j.t('tunnel-evenement-fin') },
  ],
};
