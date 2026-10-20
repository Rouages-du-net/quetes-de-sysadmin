// Histoire « Le Datacenter » — chapitre « Deuxième jour » : comptes et
// groupes. Malo doit lire les journaux nginx sans sudo (groupe adm, comme
// sur Debian : https://wiki.debian.org/SystemGroups), et l'équipe web a
// besoin d'un dossier partagé. Commandes : id, groups, ls -l, usermod -aG,
// chgrp, chown, chmod.
// Pièges réels : usermod -G sans -a remplace les groupes secondaires ;
// chmod o+r ouvre les journaux (adresses IP : données personnelles) à tous.
// Les objectifs sont vérifiés sur l'état du système, pas sur la commande.

import { d, f, fichiersComptes, type Chapitre, type Fichier } from '../monde';
import type { Jeu } from '../shell';
import { comptesDatacenter, JOURNAL_NGINX } from './datacenter';

const M = '/home/vous';
const LOGS = '/var/log/nginx';
const PARTAGE = '/srv/equipe';

const ERREURS = `2026/10/13 20:31:02 [error] 613#613: *1842 connect() to unix:/run/php/php-fpm.sock failed (11: Resource temporarily unavailable) while connecting to upstream, client: 198.51.100.77, server: mediatheque.example, request: "GET /catalogue/recherche?q=a HTTP/1.1"
2026/10/13 20:31:09 [error] 613#613: *1857 upstream timed out (110: Connection timed out) while reading response header from upstream, client: 192.0.2.31, server: mediatheque.example, request: "GET /agenda HTTP/1.1"
2026/10/13 21:02:44 [notice] 612#612: signal process started`;

// Sur Debian, les journaux de nginx appartiennent à www-data, groupe adm, en 640.
const journal = (texte: string): Fichier => f(texte, { lignes: true, proprio: 'www-data', groupe: 'adm', mode: 'rw-r-----' });
const fichiers = (j: Jeu) => [`${LOGS}/access.log`, `${LOGS}/error.log`].map((c) => j.trouver(c)!);

const malo = {
  // Malo lit les deux journaux, comme un membre d'adm, et toujours membre d'equipe-web.
  lit: (j: Jeu) => fichiers(j).every((n) => j.peut(n, 'r', 'malo')) && j.groupesDe('malo').includes('equipe-web'),
};
const journauxOuverts = (j: Jeu) => fichiers(j).some((n) => j.peut(n, 'r', 'nobody'));
const partage = (j: Jeu) => j.trouver(PARTAGE)!;

export const deuxiemeJour: Chapitre = {
  id: 'deuxieme-jour',
  numero: 2,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'id', 'groups', 'whoami', 'usermod', 'chgrp', 'chown', 'chmod', 'touch', 'nano', 'sudo'],
  maison: M,
  accueil: 'courriel_awa.txt',
  noms: true,
  final: 'fin',
  motDePasse: 'bienvenue-2026',
  comptes: comptesDatacenter,
  creerMonde: (t) => {
    const racine = { proprio: 'root' };
    const maison = (nom: string) => d({}, undefined, { proprio: nom, mode: 'rwxr-x---' });
    return d(
      {
        etc: d(fichiersComptes(), undefined, racine),
        home: d(
          {
            vous: d({ 'courriel_awa.txt': f(t('deuxieme-jour-courriel-awa')), 'notes_awa.txt': f(t('deuxieme-jour-notes-awa')) }),
            awa: maison('awa'),
            malo: maison('malo'),
          },
          undefined,
          racine,
        ),
        srv: d({ equipe: d({}, undefined, racine) }, undefined, racine),
        var: d(
          {
            log: d(
              { nginx: d({ 'access.log': journal(JOURNAL_NGINX), 'error.log': journal(ERREURS) }, undefined, { proprio: 'root', groupe: 'adm' }) },
              undefined,
              racine,
            ),
            www: d({}, undefined, racine),
          },
          undefined,
          racine,
        ),
      },
      undefined,
      racine,
    );
  },
  evenements: [
    {
      id: 'remplace',
      condition: (j) => !j.groupesDe('malo').includes('equipe-web'),
      message: (j) => j.t('deuxieme-jour-evenement-remplace'),
    },
    {
      id: 'journaux-ouverts',
      condition: journauxOuverts,
      message: (j) => j.t('deuxieme-jour-evenement-journaux-ouverts', { logs: LOGS }),
    },
    {
      id: 'malo-lit',
      condition: (j) => malo.lit(j) && !journauxOuverts(j),
      message: (j) => j.t('deuxieme-jour-evenement-malo-lit'),
    },
    {
      id: 'partage-ouvert',
      condition: (j) => j.peut(partage(j), 'w', 'nobody'),
      message: (j) => j.t('deuxieme-jour-evenement-partage-ouvert', { partage: PARTAGE }),
    },
    {
      id: 'partage',
      condition: (j) => {
        const n = partage(j);
        const equipe = ['vous', 'awa', 'malo'].every((u) => j.peut(n, 'w', u) && j.peut(n, 'x', u));
        return equipe && !j.peut(n, 'r', 'www-data') && !j.peut(n, 'w', 'www-data');
      },
      message: (j) => j.t('deuxieme-jour-evenement-partage', { partage: PARTAGE }),
    },
    {
      id: 'fin',
      condition: (j) => j.drapeaux.has('malo-lit') && j.drapeaux.has('partage') && malo.lit(j) && !journauxOuverts(j),
      message: (j) => j.t('deuxieme-jour-evenement-fin'),
    },
  ],
};
