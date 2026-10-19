// Le serveur SSH (sshd) d'une machine : lecture de /etc/ssh/sshd_config
// comme OpenSSH (https://man.openbsd.org/sshd_config) :
//   - mots-clés insensibles à la casse, commentaires « # » ;
//   - Include, avec jokers, lu à l'endroit où il apparaît ;
//   - pour chaque mot-clé, la PREMIÈRE valeur lue l'emporte : un fichier de
//     sshd_config.d inclus en tête (comme sur Debian) gagne sur la suite ;
//   - sauf Port, qui peut être répété : sshd écoute sur chacun (les ports
//     sont gardés séparés par des espaces dans valeurs.port).
// La configuration appliquée est celle chargée au dernier démarrage ou
// rechargement du service ssh (etat.sshd.charge), pas celle du fichier.

import type { Jeu } from './shell';
import { joker } from './outils';

export const CONFIG = '/etc/ssh/sshd_config';

// Les mots-clés que le jeu connaît, et leurs valeurs permises (null : libre).
const OUI_NON = ['yes', 'no'];
const MOTS_CLES: Record<string, string[] | null> = {
  include: null,
  port: null,
  listenaddress: null,
  permitrootlogin: ['yes', 'prohibit-password', 'without-password', 'forced-commands-only', 'no'],
  passwordauthentication: OUI_NON,
  pubkeyauthentication: OUI_NON,
  kbdinteractiveauthentication: OUI_NON,
  challengeresponseauthentication: OUI_NON,
  permitemptypasswords: OUI_NON,
  usepam: OUI_NON,
  x11forwarding: OUI_NON,
  printmotd: OUI_NON,
  allowusers: null,
  denyusers: null,
  allowgroups: null,
  maxauthtries: null,
  logingracetime: null,
  clientaliveinterval: null,
  acceptenv: null,
  subsystem: null,
  authorizedkeysfile: null,
};

// Valeurs par défaut d'OpenSSH (celles que sshd -T affiche).
const DEFAUTS: Record<string, string> = {
  port: '22',
  permitrootlogin: 'prohibit-password',
  passwordauthentication: 'yes',
  pubkeyauthentication: 'yes',
  kbdinteractiveauthentication: 'yes',
  permitemptypasswords: 'no',
  usepam: 'no',
  x11forwarding: 'no',
  printmotd: 'yes',
  maxauthtries: '6',
  logingracetime: '120',
  authorizedkeysfile: '.ssh/authorized_keys .ssh/authorized_keys2',
};

export interface ConfigSshd {
  valeurs: Record<string, string>;
  erreurs: string[];
}

/** Lit la configuration comme sshd -t : valeurs effectives et erreurs. */
export function lireConfig(jeu: Jeu, chemin = CONFIG): ConfigSshd {
  const valeurs: Record<string, string> = {};
  const erreurs: string[] = [];
  let mauvaises = 0;
  const lire = (fichier: string) => {
    const texte = jeu.lire(fichier);
    if (texte === null) return;
    texte.split('\n').forEach((brute, i) => {
      const ligne = brute.replace(/#.*/, '').trim();
      if (!ligne) return;
      const [mot, ...reste] = ligne.split(/\s+/);
      const cle = mot.toLowerCase();
      const valeur = reste.join(' ');
      if (!(cle in MOTS_CLES)) {
        erreurs.push(`${fichier}: line ${i + 1}: Bad configuration option: ${mot}`);
        mauvaises++;
        return;
      }
      if (cle === 'include') {
        for (const motif of reste) {
          const absolu = motif.startsWith('/') ? motif : `/etc/ssh/${motif}`;
          const k = absolu.lastIndexOf('/');
          const dossier = jeu.trouver(absolu.slice(0, k));
          const re = joker(absolu.slice(k + 1));
          if (dossier?.type === 'dossier')
            for (const nom of Object.keys(dossier.enfants).sort()) if (re.test(nom)) lire(`${absolu.slice(0, k)}/${nom}`);
        }
        return;
      }
      const permises = MOTS_CLES[cle];
      if (!valeur || (permises && !permises.includes(valeur.toLowerCase()))) {
        erreurs.push(valeur ? `${fichier} line ${i + 1}: unsupported option "${valeur}".` : `${fichier} line ${i + 1}: missing argument.`);
        return;
      }
      if (cle === 'port') {
        const n = Number(valeur);
        if (!/^\d+$/.test(valeur) || n < 1 || n > 65535) erreurs.push(`${fichier} line ${i + 1}: Badly formatted port number.`);
        else if (!valeurs.port?.split(' ').includes(valeur)) valeurs.port = valeurs.port ? `${valeurs.port} ${valeur}` : valeur;
        return;
      }
      if (!(cle in valeurs)) valeurs[cle] = permises ? valeur.toLowerCase() : valeur;
    });
  };
  lire(chemin);
  if (mauvaises) erreurs.push(`${chemin}: terminating, ${mauvaises} bad configuration options`);
  return { valeurs: { ...DEFAUTS, ...valeurs }, erreurs };
}

/** Ce que sshd -T affiche : « mot-clé valeur », en minuscules. */
export const afficherConfig = (c: ConfigSshd) =>
  Object.entries(c.valeurs)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([k, v]) => (k === 'port' ? v.split(' ').map((p) => `port ${p}`) : [`${k} ${v}`]))
    .join('\n');

/** La configuration appliquée laisse-t-elle entrer ce compte avec sa clé ? */
export function autorise(valeurs: Record<string, string>, utilisateur: string): boolean {
  if (valeurs.pubkeyauthentication === 'no') return false;
  if (utilisateur === 'root' && valeurs.permitrootlogin === 'no') return false;
  const liste = (cle: string) => valeurs[cle]?.split(/\s+/).filter(Boolean);
  if (liste('denyusers')?.includes(utilisateur)) return false;
  const permis = liste('allowusers');
  if (permis && !permis.includes(utilisateur)) return false;
  return true;
}

/** Les méthodes que ssh annonce en cas de refus : « publickey » ou « publickey,password ». */
export const methodes = (valeurs: Record<string, string>) =>
  [valeurs.pubkeyauthentication !== 'no' && 'publickey', valeurs.passwordauthentication === 'yes' && 'password'].filter(Boolean).join(',');

/** Les ports sur lesquels sshd écoute avec cette configuration. */
export const portsSshd = (valeurs: Record<string, string> | null | undefined): number[] => (valeurs?.port ?? '22').split(' ').map(Number);
