// Ce que les chapitres de « La flotte » ont en commun : le poste de pilotage
// des maisons de quartier (pilote, 192.0.2.25), où Ansible est installé, et
// les trois serveurs des maisons de quartier (north, south, east, sur
// 10.30.0.0/24), joints en ssh avec le compte deploy (sudo sans mot de passe).
// Sources : https://docs.ansible.com/ansible/latest/inventory_guide/intro_inventory.html,
// https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_intro.html

import { d, f, fichiersComptes, joueur, type Comptes, type Dossier, type HoteInterne, type Noeud } from '../world';
import type { Jeu, Shell } from '../shell';
import type { Traduire } from '../../texts';
import { genererCle } from '../access';
import { lireConfig } from '../sshd';
import { nouveauSystemd, systemd } from '../systemd';
import { historique } from '../commands/ansible';
import { cleHote } from '../machines';

export const M = '/home/vous';
export const DOSSIER = `${M}/ansible`;
export const CENTRES: Record<string, string> = { north: '10.30.0.11', south: '10.30.0.12', east: '10.30.0.13' };
export const NOMS = Object.keys(CENTRES);
const MAINTENANT = Date.UTC(2027, 8, 14, 9, 0, 0);

// La clé du compte vous sur pilote ; sa partie publique est dans ~deploy/.ssh/authorized_keys sur chaque centre.
export const CLE = genererCle('pilote-ansible', 'vous@pilote');

export const HOSTS = `127.0.0.1\tlocalhost
192.0.2.25\tpilote.internal pilote
${NOMS.map((n) => `${CENTRES[n]}\t${n}.centres.internal ${n}`).join('\n')}`;

export const MOTD_DEBIAN = `
The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.`;

const SSHD_CONFIG = `# This is the sshd server system-wide configuration file.  See
# sshd_config(5) for more information.

Include /etc/ssh/sshd_config.d/*.conf

#Port 22
#PermitRootLogin prohibit-password
#PubkeyAuthentication yes

# To disable tunneled clear text passwords, change to no here!
#PasswordAuthentication yes
#PermitEmptyPasswords no

KbdInteractiveAuthentication no
UsePAM yes
X11Forwarding yes
PrintMotd no
AcceptEnv LANG LC_*
Subsystem\tsftp\t/usr/lib/openssh/sftp-server`;

// Les paquets que le miroir Debian connaît (apt), et ceux déjà installés.
const DEPOT: Record<string, string> = { htop: '3.4.1-4', tree: '2.2.1-1', vim: '2:9.1.1230-2', curl: '8.14.1-2', nginx: '1.26.3-3', fail2ban: '1.1.0-8', chrony: '4.6.1-3', ncdu: '1.21-2' };
const INSTALLES: Record<string, string> = { curl: '8.14.1-2', 'openssh-server': '1:10.0p1-7', sudo: '1.9.16p2-3' };

const comptesCentre = (): Comptes => ({
  utilisateurs: {
    root: { uid: 0, groupe: 'root', maison: '/root' },
    deploy: { uid: 1001, groupe: 'deploy', maison: '/home/deploy', shell: '/bin/bash' },
  },
  groupes: { root: { gid: 0, membres: [] }, sudo: { gid: 27, membres: ['deploy'] }, deploy: { gid: 1001, membres: [] } },
});

// Le service ssh d'un centre : sshd charge sa configuration au démarrage et au rechargement.
const serviceSsh = {
  description: 'OpenBSD Secure Shell server',
  active: true,
  executable: 'sshd',
  processus: [{ pid: 612, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
  verifier: (j: Jeu) => {
    const e = lireConfig(j).erreurs;
    return e.length ? e : null;
  },
  verifierAuRechargement: true,
  charger: (j: Jeu) => {
    j.etat.sshd = { ...(j.etat.sshd ?? {}), charge: lireConfig(j).valeurs };
  },
};

export interface EtatCentre {
  motd?: (t: Traduire) => string;
  partage?: boolean;
  paquets?: string[];
  sshd?: string;
}

/** Un centre : son monde (comptes, sshd, la clé autorisée de deploy, motd), ses paquets et son ssh. */
export function centre(nom: string, e: EtatCentre = {}): HoteInterne {
  return {
    adresse: CENTRES[nom],
    domaine: `${nom}.centres.internal`,
    comptes: comptesCentre,
    commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'mkdir', 'echo', 'sudo', 'systemctl', 'journalctl', 'sshd', 'id', 'whoami', 'exit', 'logout'],
    etat: () => ({
      paquets: { ...INSTALLES, ...Object.fromEntries((e.paquets ?? []).map((p) => [p, DEPOT[p]])) },
      depot: DEPOT,
      sshd: { charge: {} },
      systemd: nouveauSystemd(nom, MAINTENANT - 20 * 86_400_000, MAINTENANT, { ssh: serviceSsh }),
    }),
    initialiser: (j) => serviceSsh.charger(j),
    creerMonde: (t) => {
      const racine = { proprio: 'root' };
      const fichier = (texte: string) => f(texte, { lignes: true, proprio: 'root' });
      return d(
        {
          etc: d(
            {
              ...fichiersComptes(),
              hostname: fichier(nom),
              hosts: fichier(HOSTS),
              motd: fichier(e.motd?.(t) ?? MOTD_DEBIAN),
              ssh: d({ sshd_config: fichier(e.sshd ?? SSHD_CONFIG), 'sshd_config.d': d({}, undefined, racine) }, undefined, racine),
              'sudoers.d': d({ deploy: f('deploy ALL=(ALL) NOPASSWD: ALL', { lignes: true, proprio: 'root', mode: 'r--r-----' }) }, undefined, racine),
            },
            undefined,
            racine,
          ),
          home: d(
            {
              deploy: d(
                { '.ssh': d({ authorized_keys: f(CLE.publique, { lignes: true, proprio: 'deploy', mode: 'rw-------' }) }, undefined, { proprio: 'deploy', mode: 'rwx------' }) },
                undefined,
                { proprio: 'deploy', mode: 'rwxr-xr-x' },
              ),
            },
            undefined,
            racine,
          ),
          srv: d(e.partage ? { shared: d({}, undefined, { proprio: 'root', mode: 'rwxr-xr-x' }) } : {}, undefined, racine),
        },
        undefined,
        racine,
      );
    },
  };
}

export const comptesPilote = (): Comptes => ({
  utilisateurs: { root: { uid: 0, groupe: 'root', maison: '/root' }, vous: { uid: 1000, groupe: 'vous' }, theo: { uid: 1001, groupe: 'theo' } },
  groupes: {
    root: { gid: 0, membres: [] },
    sudo: { gid: 27, membres: ['vous', 'theo'] },
    vous: { gid: 1000, membres: [] },
    theo: { gid: 1001, membres: [] },
  },
});

export const etatPilote = () => ({
  systemd: nouveauSystemd('pilote', MAINTENANT - 30 * 86_400_000, MAINTENANT, {
    ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd' },
  }),
});

/** Le monde de pilote : /etc/hosts, la clé ssh de vous (et son known_hosts), ~/ansible, et Ansible. */
export function mondePilote(t: Parameters<typeof joueur>[0], o: { connus: string[]; ansible: Record<string, Noeud>; maison: Record<string, Noeud> }): Dossier {
  const racine = { proprio: 'root' };
  const binaire = (taille: number) => f('', { proprio: 'root', mode: 'rwxr-xr-x', taille });
  const prive = { mode: 'rwx------' };
  const connus = o.connus.map((n) => `${n} ${cleHoteDe(n)}`).join('\n');
  return d(
    {
      etc: d(
        {
          ...fichiersComptes(),
          hostname: f('pilote', { lignes: true, proprio: 'root' }),
          hosts: f(HOSTS, { lignes: true, proprio: 'root' }),
          ansible: d({ 'ansible.cfg': f('# Since Ansible 2.12 (core):\n# To generate an example config file (a "disabled" one with all default settings, commented out):\n#               $ ansible-config init --disabled > ansible.cfg', { lignes: true, proprio: 'root' }) }, undefined, racine),
        },
        undefined,
        racine,
      ),
      home: d(
        {
          vous: d({
            '.ssh': d(
              {
                id_ed25519: f(CLE.prive, { lignes: true, mode: 'rw-------' }),
                'id_ed25519.pub': f(CLE.publique.replace('vous@', `${joueur(t)}@`), { lignes: true }),
                ...(connus ? { known_hosts: f(connus, { lignes: true, mode: 'rw-------' }) } : {}),
              },
              undefined,
              prive,
            ),
            ansible: d(o.ansible),
            ...o.maison,
          }),
          theo: d({}, undefined, { proprio: 'theo', mode: 'rwx------' }),
        },
        undefined,
        racine,
      ),
      usr: d(
        { bin: d({ ansible: binaire(5_412), 'ansible-playbook': binaire(5_412), 'ansible-inventory': binaire(5_412), 'ansible-doc': binaire(5_412), python3: binaire(6_830_640) }, undefined, racine) },
        undefined,
        racine,
      ),
    },
    undefined,
    racine,
  );
}

// La clé d'hôte d'un centre, telle que known_hosts la garde (celle que connecterSansQuestion attend).
export const cleHoteDe = (nom: string) => cleHote({ nom, domaine: `${nom}.centres.internal`, adresse: CENTRES[nom] }, '');

// ——— Ce que les chapitres vérifient ———

/** Une session sur un centre (créée à la première demande). */
export const surCentre = (j: Jeu, nom: string) => (j as Shell).interne(nom)!;

/** La dernière exécution complète (sans --check, sans --limit) d'un playbook. */
export function derniereComplete(j: Jeu) {
  return [...historique(j as Shell).executions].reverse().find((e) => !e.verifier && !e.limite && NOMS.every((n) => e.hotes[n]));
}

/** Idempotent : la dernière exécution complète n'a rien changé, rien raté, joint tout le monde. */
export const idempotent = (j: Jeu) => {
  const e = derniereComplete(j);
  return !!e && NOMS.every((n) => e.hotes[n].changed === 0 && e.hotes[n].failed === 0 && e.hotes[n].unreachable === 0);
};

export const sdDe = (j: Jeu) => systemd(j)!;
