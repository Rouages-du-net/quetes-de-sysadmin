// freeradius (radiusd) et radtest (freeradius-utils), sur le serveur RADIUS
// simulé (../radius.ts). Sorties en anglais, comme les vrais outils.
// Sources : https://manpages.debian.org/trixie/freeradius/freeradius.8.en.html,
// https://manpages.debian.org/trixie/freeradius-utils/radtest.1.en.html

import type { Shell } from '../shell';
import { chargerRadius, enMarche, lireRadius, traiter, type Demande, type Reponse } from '../radius';
import type { Commande } from './index';

const VERSION = 'FreeRADIUS Version 3.2.7';

// Une réponse comme radclient l'affiche : « Received Access-Accept … », puis les attributs.
function recue(r: Reponse, id: number, de: string, vers: string): string[] {
  const type = r.quoi === 'accept' ? 'Access-Accept' : 'Access-Reject';
  const longueur = 20 + r.attributs.reduce((t, a) => t + 3 + a.valeur.length, 0);
  return [
    `Received ${type} Id ${id} from ${de}:1812 to ${vers} length ${longueur}`,
    ...r.attributs.map(
      (a) =>
        `\t${a.attr.includes(':') ? a.attr : `${a.attr}:0`} = ${/^\d+$|^VLAN$|^IEEE-802$/.test(a.valeur) && !a.attr.startsWith('Tunnel-Private') ? a.valeur : `"${a.valeur}"`}`,
    ),
  ];
}

function radtest(jeu: Shell, args: string[]): string {
  const reste = args.filter((a) => !a.startsWith('-'));
  if (reste.length < 5) return jeu.erreur(jeu.t('radtest-usage'), 1);
  const [utilisateur, motDePasse, serveur, port, secret] = reste;
  const id = 154;
  const envoi = [
    `Sent Access-Request Id ${id} from 0.0.0.0:46327 to 127.0.0.1:1812 length ${77 + utilisateur.length}`,
    `\tUser-Name = "${utilisateur}"`,
    `\tUser-Password = "${motDePasse}"`,
    '\tNAS-IP-Address = 127.0.1.1',
    `\tNAS-Port = ${port}`,
    '\tMessage-Authenticator = 0x00',
    `\tCleartext-Password = "${motDePasse}"`,
  ];
  const local = ['localhost', '127.0.0.1', jeu.hote].includes(serveur.split(':')[0]);
  const d: Demande = { client: '127.0.0.1', iif: 'lo', secret, utilisateur, motDePasse };
  const r: Reponse = local ? traiter(jeu, d) : { quoi: 'rien', attributs: [], journal: [] };
  if (r.quoi === 'rien') {
    jeu.statut = 1;
    return [...envoi, ...[1, 2].flatMap(() => envoi), `(0) No reply from server for ID ${id} socket 3`].join('\n');
  }
  const lignes = [...envoi, ...recue(r, id, '127.0.0.1', '127.0.0.1:46327')];
  if (r.quoi === 'reject') {
    lignes.push('(0) -: Expected Access-Accept got Access-Reject');
    jeu.statut = 1;
  }
  return lignes.join('\n');
}

function freeradius(jeu: Shell, args: string[]): string {
  if (args.includes('-v')) return `radiusd: ${VERSION}, for host x86_64-pc-linux-gnu, built on Jan 10 2025 at 08:00:00`;
  const debogage = args.some((a) => /^-[a-zA-Z]*X/.test(a));
  const verifier = args.some((a) => /^-[a-zA-Z]*C/.test(a));
  if (!debogage && !verifier) return jeu.erreur(jeu.t('freeradius-usage'), 1);
  if (jeu.qui !== 'root') return jeu.erreur(`Errors reading ${'/etc/freeradius/3.0'}: Permission denied`, 1);
  const { erreurs } = lireRadius(jeu);
  const debut = [VERSION, 'Copyright (C) 1999-2025 The FreeRADIUS server project and contributors', 'Starting - reading configuration files ...'];
  if (erreurs.length) return jeu.erreur([...debut, ...erreurs].join('\n'), 1);
  if (verifier) return [...debut, 'Configuration appears to be OK'].join('\n');
  if (enMarche(jeu))
    return jeu.erreur(
      [
        ...debut,
        'Failed binding to auth address * port 1812 bound to server default: Address already in use',
        '/etc/freeradius/3.0/sites-enabled/default[59]: Error binding to port for 0.0.0.0 port 1812',
      ].join('\n'),
      1,
    );
  // radiusd -X : la configuration lue, puis les demandes des bornes traitées une à une.
  const avant = jeu.etat.radius;
  chargerRadius(jeu);
  const conf = jeu.etat.radius.conf;
  jeu.etat.radius = avant;
  const demandes: Demande[] = jeu.etat.radiusDemandes ?? [];
  const lignes = [...debut, 'Listening on auth address * port 1812 bound to server default', 'Ready to process requests'];
  demandes.forEach((d, i) => {
    const r = traiter(jeu, d, { conf, marche: true });
    lignes.push(
      `(${i}) Received Access-Request Id ${40 + i} from ${d.client}:41234 to 10.10.30.1:1812 length 120`,
      `(${i})   User-Name = "${d.utilisateur}"`,
    );
    lignes.push(...r.journal.map((l) => (l.startsWith('(') ? l.replace(/^\(0\)/, `(${i})`) : `(${i}) ${l.replace(/^Auth: \(0\) /, '')}`)));
    if (r.quoi !== 'rien')
      lignes.push(
        `(${i}) Sent ${r.quoi === 'accept' ? 'Access-Accept' : 'Access-Reject'} Id ${40 + i} from 10.10.30.1:1812 to ${d.client}:41234 length 0`,
        ...r.attributs.map((a) => `(${i})   ${a.attr} = ${a.valeur}`),
      );
  });
  lignes.push('', jeu.t('freeradius-x-fin'));
  return lignes.join('\n');
}

export const RADIUS: Record<string, Commande> = {
  freeradius: { section: 8, propresOptions: true, lancer: ({ args, jeu }) => freeradius(jeu, args) },
  radtest: { propresOptions: true, lancer: ({ args, jeu }) => radtest(jeu, args) },
};
