// Histoire « La Maison des associations » : ce que ses quatre chapitres ont
// en commun. La machine maison est la passerelle : seule joignable depuis
// internet, elle a le « vrai » ssh (acces.ts : clés, mot de passe,
// authorized_keys). Derrière elle, le réseau interne de la Maison :
// wiki (le wiki des associations) et archives (les sauvegardes), qu'on
// joint en rebondissant par maison (ssh -J, ProxyJump).
// Sources : https://man.openbsd.org/sshd_config, https://man.openbsd.org/ssh

import { d, f, fichiersComptes, type Comptes, type Dossier, type HoteInterne, type Noeud } from '../monde';
import type { Jeu } from '../shell';
import type { Traduire } from '../../textes';
import { nouveauSystemd, systemd, type DefinitionService } from '../systemd';
import { lireConfig } from '../sshd';
import { internet, type ElementPlan } from '../plan';

export const M = '/home/vous';
export const MOT_DE_PASSE = 'lilas-2027';
// Lundi 4 octobre 2027, 18 h 40.
export const MAINTENANT = Date.UTC(2027, 9, 4, 18, 40, 0);

// sshd_config de Debian ; PasswordAuthentication donné en paramètre (null : la ligne commentée d'origine).
const sshdConfig = (motsDePasse: 'yes' | 'no' | null) =>
  `
# This is the sshd server system-wide configuration file.  See
# sshd_config(5) for more information.

Include /etc/ssh/sshd_config.d/*.conf

#Port 22
#ListenAddress 0.0.0.0

# Authentication:

#LoginGraceTime 2m
#PermitRootLogin prohibit-password
#MaxAuthTries 6

#PubkeyAuthentication yes

# To disable tunneled clear text passwords, change to no here!
${motsDePasse ? `PasswordAuthentication ${motsDePasse}` : '#PasswordAuthentication yes'}
#PermitEmptyPasswords no

KbdInteractiveAuthentication no

UsePAM yes

X11Forwarding yes
PrintMotd no

# Allow client to pass locale environment variables
AcceptEnv LANG LC_*

# override default of no subsystems
Subsystem	sftp	/usr/lib/openssh/sftp-server
`.trim();

export const HOSTS = `127.0.0.1\tlocalhost
192.0.2.19\tmaison.internal maison
10.20.0.11\twiki.maison.internal wiki
10.20.0.12\tarchives.maison.internal archives`;

export interface EtatSshd {
  charge: Record<string, string>;
  // Connexions par clé reçues au moment du dernier chargement (se reconnecter après).
  clesAuChargement: number;
  recharges: number;
}
export const sshd = (j: Jeu) => j.etat.sshd as EtatSshd;
export const connexionsPar = (j: Jeu, comment: 'cle' | 'motDePasse') => (j.etat.connexionsSsh?.[comment] as number | undefined) ?? 0;

// Le service ssh, comme celui de Debian : ExecReload vérifie d'abord (sshd -t).
const serviceSsh = (): DefinitionService => ({
  description: 'OpenBSD Secure Shell server',
  active: true,
  executable: 'sshd',
  processus: [{ pid: 588, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
  verifier: (j) => {
    const e = lireConfig(j).erreurs;
    return e.length ? e : null;
  },
  verifierAuRechargement: true,
  charger: (j) => {
    const c = sshd(j);
    if (!c) return;
    c.charge = lireConfig(j).valeurs;
    c.clesAuChargement = connexionsPar(j, 'cle');
    c.recharges++;
  },
});

/** L'état de maison : le vrai ssh, sshd et systemd (plus les services du chapitre). */
export const etatMaison = (services: Record<string, DefinitionService> = {}, plus: Record<string, unknown> = {}) => ({
  sshReel: true,
  sshd: { charge: {}, clesAuChargement: 0, recharges: 0 },
  systemd: nouveauSystemd('maison', MAINTENANT - 9 * 86_400_000, MAINTENANT, { ssh: serviceSsh(), ...services }),
  ...plus,
});

/** Au démarrage : sshd charge sa configuration. */
export const chargerSshd = (j: Jeu) => {
  sshd(j).charge = lireConfig(j).valeurs;
};

export const comptesMaison = (): Comptes => ({
  utilisateurs: { root: { uid: 0, groupe: 'root', maison: '/root' }, vous: { uid: 1000, groupe: 'vous' }, yasmine: { uid: 1001, groupe: 'yasmine' } },
  groupes: {
    root: { gid: 0, membres: [] },
    adm: { gid: 4, membres: ['vous', 'yasmine'] },
    sudo: { gid: 27, membres: ['vous', 'yasmine'] },
    vous: { gid: 1000, membres: [] },
    yasmine: { gid: 1001, membres: [] },
  },
});

const racine = { proprio: 'root' };
const prive = { mode: 'rwx------' };

/** Le dossier ~/.ssh de vous (vide, ou avec ces fichiers). */
export const dossierSsh = (fichiers: Record<string, Noeud> = {}) => d(fichiers, undefined, prive);

/** Le monde de maison : /etc (comptes, hosts, ssh), la maison de vous, et le reste du chapitre. */
export function mondeMaison(o: { motsDePasse: 'yes' | 'no' | null; maison: Record<string, Noeud>; plus?: Record<string, Noeud> }): Dossier {
  return d(
    {
      etc: d(
        {
          ...fichiersComptes(),
          hostname: f('maison', { lignes: true, proprio: 'root' }),
          hosts: f(HOSTS, { lignes: true, proprio: 'root' }),
          ssh: d(
            { sshd_config: f(sshdConfig(o.motsDePasse), { lignes: true, proprio: 'root' }), 'sshd_config.d': d({}, undefined, racine) },
            undefined,
            racine,
          ),
        },
        undefined,
        racine,
      ),
      home: d({ vous: d(o.maison), yasmine: d({}, undefined, { proprio: 'yasmine', mode: 'rwx------' }) }, undefined, racine),
      ...(o.plus ?? {}),
    },
    undefined,
    racine,
  );
}

// ——— Le réseau interne ———

const comptesInternes = (): Comptes => ({
  utilisateurs: { root: { uid: 0, groupe: 'root', maison: '/root' }, vous: { uid: 1000, groupe: 'vous' } },
  groupes: { root: { gid: 0, membres: [] }, sudo: { gid: 27, membres: ['vous'] }, vous: { gid: 1000, membres: [] } },
});

/** Une machine interne : son nom, son adresse, ce qu'il y a dans sa maison et ailleurs. */
export function hoteInterne(
  nom: string,
  adresse: string,
  o: {
    maison?: (t: Traduire) => Record<string, Noeud>;
    plus?: (t: Traduire) => Record<string, Noeud>;
    etat?: (t: Traduire) => Record<string, unknown>;
    initialiser?: (j: Jeu) => void;
    commandes?: string[];
  } = {},
): HoteInterne {
  return {
    adresse,
    domaine: `${nom}.maison.internal`,
    comptes: comptesInternes,
    commandes: o.commandes,
    etat: o.etat,
    initialiser: o.initialiser,
    creerMonde: (t) =>
      d(
        {
          etc: d(
            { ...fichiersComptes(), hostname: f(nom, { lignes: true, proprio: 'root' }), hosts: f(HOSTS, { lignes: true, proprio: 'root' }) },
            undefined,
            racine,
          ),
          home: d({ vous: d({ '.ssh': dossierSsh(), ...(o.maison?.(t) ?? {}) }) }, undefined, racine),
          ...(o.plus?.(t) ?? {}),
        },
        undefined,
        racine,
      ),
  };
}

export const sd = (j: Jeu) => systemd(j)!;

/** Le plan du réseau de la Maison : la passerelle, et derrière elle le wiki et les archives ; l'hébergeur du site, sur internet. */
export const planMaison =
  (o: { hebergeur?: boolean } = {}) =>
  (t: Traduire): ElementPlan =>
    internet(
      t,
      {
        role: 'routeur',
        nom: 'maison',
        adresse: '192.0.2.19',
        note: t('plan-note-passerelle'),
        hote: 'maison',
        enfants: [
          {
            role: 'reseau',
            nom: t('plan-reseau-interne'),
            adresse: '10.20.0.0/24',
            enfants: [
              { role: 'serveur', nom: 'wiki', adresse: '10.20.0.11', note: t('plan-note-wiki'), hote: 'wiki' },
              { role: 'serveur', nom: 'archives', adresse: '10.20.0.12', note: t('plan-note-archives'), hote: 'archives' },
            ],
          },
        ],
      },
      ...(o.hebergeur ? [{ role: 'serveur' as const, nom: 'ftp.hebergeur.example', adresse: '203.0.113.80', note: t('plan-note-hebergeur') }] : []),
    );
