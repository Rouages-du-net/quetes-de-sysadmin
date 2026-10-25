// Histoire « La Maison des associations » — chapitre « L'hébergeur » : le
// nouveau site de la Maison est prêt sur le wiki (/srv/wiki/site). Il est
// publié chez un hébergeur mutualisé, qui ne propose que FTP… et refuse
// désormais le FTP en clair. Gaspard publiait avec FileZilla, sans
// chiffrement, sur ftp.community.example (un nom qui pointe chez l'hébergeur,
// mais que son certificat ne couvre pas).
//   - rapatrier le site du wiki sur le poste, par SSH (sftp, get -r) ;
//   - le publier en FTPS avec lftp, sur le nom de l'hébergeur
//     (ftp.hosting.example), certificat vérifié ;
//   - mirror -R (du poste vers l'hébergement), dans public_html, avec
//     --delete (la page des tarifs de 2025 ne doit plus être en ligne).
// Objectif vérifié sur l'état : public_html contient exactement le site du
// wiki, et le dernier envoi est passé chiffré, certificat vérifié.
// Sources : https://man.openbsd.org/sftp, https://lftp.yar.ru/lftp-man.html,
// https://www.rfc-editor.org/rfc/rfc4217

import { d, f, type Chapitre, type Dossier } from '../monde';
import type { Jeu, Shell } from '../shell';
import { fichiersDe, hebergement, HEBERGEMENTS, noeud } from '../hebergeur';
import { chargerSshd, comptesMaison, dossierSsh, etatMaison, hoteInterne, M, mondeMaison, MOT_DE_PASSE, planMaison } from './maison';

export const COMPTE = 'maisonasso';
export const MOT_DE_PASSE_FTP = 'Kp7-hebergement-2028';
const SITE = '/srv/wiki/site';

const STYLE = `body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 40rem; }
header { border-bottom: 2px solid #2a6f4e; }
a { color: #2a6f4e; }`;
const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#2a6f4e"/></svg>';

const page = (t: (id: string) => string, id: string) => f(t(id), { lignes: true, proprio: 'www-data', mode: 'rw-r--r--' });

// L'hébergement de la Maison : l'ancien site, en ligne depuis 2025.
HEBERGEMENTS.hebergeur = {
  noms: ['ftp.hosting.example', 'hosting.example', 'ftp.community.example'],
  adresse: '203.0.113.80',
  certificat: ['*.hosting.example', 'hosting.example'],
  comptes: { [COMPTE]: MOT_DE_PASSE_FTP },
  fichiers: (t) => ({
    [COMPTE]: d({
      public_html: d({
        'index.html': f(t('hebergeur-ancien-index'), { lignes: true }),
        'agenda.html': f(t('hebergeur-ancien-agenda'), { lignes: true }),
        'tarifs-2025.html': f(t('hebergeur-ancien-tarifs'), { lignes: true }),
      }),
      tmp: d({}),
    }),
  }),
};

const poste = (j: Jeu) => (j.etat.poste as (() => Shell) | undefined)?.();
const wiki = (j: Jeu) => (j as Shell).interne('wiki');

// Le site du wiki, par chemin relatif.
function siteDuWiki(j: Jeu): Record<string, string> {
  const w = wiki(j);
  const res: Record<string, string> = {};
  const parcourir = (chemin: string, rel: string) => {
    const n = w?.trouver(chemin);
    if (!n) return;
    if (n.type === 'dossier') for (const k of Object.keys(n.enfants)) parcourir(`${chemin}/${k}`, rel ? `${rel}/${k}` : k);
    else res[rel] = w!.lire(chemin) ?? '';
  };
  parcourir(SITE, '');
  return res;
}

const enLigne = (j: Jeu) => {
  const p = poste(j);
  return p ? hebergement(p, 'hebergeur') : null;
};
const publicHtml = (j: Jeu) => {
  const h = enLigne(j);
  return h ? (fichiersDe(h.racines[COMPTE], '/public_html') ?? {}) : {};
};
const publie = (j: Jeu) => {
  const enligne = publicHtml(j);
  const site = siteDuWiki(j);
  return Object.keys(site).length > 0 && Object.entries(site).every(([k, v]) => enligne[k] === v);
};
const exact = (j: Jeu) => publie(j) && Object.keys(publicHtml(j)).length === Object.keys(siteDuWiki(j)).length;
const dernierEnvoi = (j: Jeu) =>
  enLigne(j)
    ?.journal.filter((e) => e.envoi)
    .at(-1);
const refus = (j: Jeu, quoi: 'clair' | 'certificat') => !!(poste(j)?.etat.refusFtp as string[] | undefined)?.includes(quoi);

export const hebergeur: Chapitre = {
  id: 'hebergeur',
  numero: 5,
  plan: planMaison({ hebergeur: true }),
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'find', 'id', 'whoami', 'hostname', 'ssh', 'scp', 'sftp', 'lftp'],
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
      commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'find', 'du', 'id', 'whoami', 'hostname'],
      plus: (t) => ({
        srv: d(
          {
            wiki: d({
              site: d(
                {
                  'index.html': page(t, 'hebergeur-index'),
                  'agenda.html': page(t, 'hebergeur-agenda'),
                  'adhesion.html': page(t, 'hebergeur-adhesion'),
                  'style.css': f(STYLE, { lignes: true, proprio: 'www-data' }),
                  images: d({ 'logo.svg': f(LOGO, { lignes: true, proprio: 'www-data' }) }, undefined, { proprio: 'www-data' }),
                },
                undefined,
                { proprio: 'www-data' },
              ) as Dossier,
            }),
          },
          undefined,
          { proprio: 'root' },
        ),
      }),
    }),
  },
  creerMonde: (t) =>
    mondeMaison({
      motsDePasse: 'no',
      maison: {
        '.ssh': dossierSsh(),
        'courriel_yasmine.txt': f(t('hebergeur-courriel-yasmine', { compte: COMPTE, motdepasse: MOT_DE_PASSE_FTP })),
        'courriel_hebergeur.txt': f(t('hebergeur-courriel-hebergeur'), { lignes: true }),
        'notes-gaspard.txt': f(t('hebergeur-notes-gaspard'), { lignes: true }),
      },
    }),
  evenements: [
    { id: 'clair', condition: (j) => refus(j, 'clair'), message: (j) => j.t('hebergeur-evenement-clair') },
    { id: 'certificat', condition: (j) => refus(j, 'certificat'), message: (j) => j.t('hebergeur-evenement-certificat') },
    {
      id: 'sans-verification',
      condition: (j) => !!enLigne(j)?.journal.some((e) => !e.verifie),
      message: (j) => j.t('hebergeur-evenement-sans-verification'),
    },
    {
      id: 'mauvais-sens',
      condition: (j) => !!poste(j)?.lire('~/site/tarifs-2025.html') || !!poste(j)?.lire('~/public_html/tarifs-2025.html'),
      message: (j) => j.t('hebergeur-evenement-mauvais-sens'),
    },
    {
      id: 'mauvais-dossier',
      condition: (j) => {
        const h = enLigne(j);
        return !!h && Object.keys(h.racines[COMPTE].enfants).some((k) => !['public_html', 'tmp'].includes(k)) && !publie(j);
      },
      message: (j) => j.t('hebergeur-evenement-mauvais-dossier'),
    },
    {
      id: 'reste',
      condition: (j) => publie(j) && !!noeud(enLigne(j)!.racines[COMPTE], '/public_html/tarifs-2025.html'),
      message: (j) => j.t('hebergeur-evenement-reste'),
    },
    { id: 'fin', condition: (j) => exact(j) && !!dernierEnvoi(j)?.tls && !!dernierEnvoi(j)?.verifie, message: (j) => j.t('hebergeur-evenement-fin') },
  ],
};
