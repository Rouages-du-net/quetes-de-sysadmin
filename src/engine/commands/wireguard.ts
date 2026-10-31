// wg et wg-quick (wireguard-tools), sur le routeur simulé (../wireguard.ts).
// Sorties en anglais, comme les vrais outils.
// Sources : https://man7.org/linux/man-pages/man8/wg.8.html,
// https://man7.org/linux/man-pages/man8/wg-quick.8.html

import type { Shell } from '../shell';
import { dans, lan } from '../lan';
import { confDe, confDistant, demonterWg, etatTunnel, genererCle, lireConfWg, monterWg, publique, wg, type Distant, type InterfaceWg } from '../wireguard';
import { systemd } from '../systemd';
import { modeAvecMasque } from '../tools';
import type { Commande } from './index';

const PAS_ROOT = 'Unable to access interface: Operation not permitted';

// Le nom public d'un routeur (en anglais dans toutes les langues, comme les sites publics).
const NOMS_PUBLICS: Record<string, string> = { ruche: 'hive.example' };

/** L'adresse publique du routeur (eth0) et ses noms, pour l'Endpoint des pairs. */
export const publicDu = (jeu: Shell) => ({
  adressePublique: lan(jeu)?.interfaces.eth0?.adresses[0]?.split('/')[0] ?? '',
  noms: [jeu.hote, jeu.nomHote, NOMS_PUBLICS[jeu.hote] ?? `${jeu.hote}.example`],
});

// La poignée de main a-t-elle eu lieu (le routeur et le pair se sont reconnus) ?
const serre = (e: string) => ['autorisees', 'route', 'transfert', 'ok'].includes(e);

function montrer(jeu: Shell, nom: string, i: InterfaceWg): string[] {
  const lignes = [`interface: ${nom}`];
  if (i.conf.cle) lignes.push(`  public key: ${publique(i.conf.cle)}`, '  private key: (hidden)');
  if (i.conf.port) lignes.push(`  listening port: ${i.conf.port}`);
  const distants: Distant[] = lan(jeu)?.distants ?? [];
  for (const p of i.conf.pairs) {
    lignes.push('', `peer: ${p.cle}`);
    const d = distants.find((x) => x.cle === p.cle);
    const e = d ? etatTunnel(jeu, d, publicDu(jeu)) : null;
    const actif = !!e && e.nom === nom && serre(e.etat);
    if (actif) lignes.push(`  endpoint: ${d!.adresse}:41414`);
    else if (p.endpoint) lignes.push(`  endpoint: ${p.endpoint}`);
    lignes.push(`  allowed ips: ${p.autorisees.length ? p.autorisees.join(', ') : '(none)'}`);
    if (actif) {
      lignes.push('  latest handshake: 7 seconds ago');
      lignes.push(e!.etat === 'ok' ? '  transfer: 48.62 KiB received, 312.07 KiB sent' : '  transfer: 2.18 KiB received, 1.02 KiB sent');
    }
    if (p.keepalive) lignes.push(`  persistent keepalive: every ${p.keepalive} seconds`);
  }
  return lignes;
}

function commandeWg(jeu: Shell, args: string[], entree: string | null): string {
  const [action = 'show', ...reste] = args;
  if (action === 'genkey' || action === 'genpsk') {
    // Comme wg : un avertissement si la clé part dans un fichier que tout le monde peut lire.
    if (jeu.sortieVers) {
      const n = jeu.trouver(jeu.sortieVers);
      const mode = n?.mode ?? (n ? 'rw-r--r--' : modeAvecMasque(false, jeu.masque));
      if (/r|w|x/.test(mode.slice(6, 9)))
        jeu.erreur('Warning: writing to world accessible file.\nConsider setting the umask to 077 and trying again.', 0);
    }
    return genererCle(jeu);
  }
  if (action === 'pubkey') {
    const p = publique((entree ?? '').trim());
    if (!p) return jeu.erreur('pubkey: Key is not the correct length or format', 1);
    return p;
  }
  if (action === 'show' || action === 'showconf') {
    if (jeu.qui !== 'root') return jeu.erreur(PAS_ROOT, 1);
    const toutes = wg(jeu);
    const cible = reste[0];
    if (action === 'showconf') {
      if (!cible) return jeu.erreur('Usage: wg showconf <interface>', 1);
      const i = toutes[cible];
      if (!i) return jeu.erreur(`Unable to access interface: No such device`, 1);
      return [
        '[Interface]',
        ...(i.conf.port ? [`ListenPort = ${i.conf.port}`] : []),
        ...(i.conf.cle ? [`PrivateKey = ${i.conf.cle}`] : []),
        ...i.conf.pairs.flatMap((p) => [
          '',
          '[Peer]',
          `PublicKey = ${p.cle}`,
          ...(p.autorisees.length ? [`AllowedIPs = ${p.autorisees.join(', ')}`] : []),
          ...(p.endpoint ? [`Endpoint = ${p.endpoint}`] : []),
        ]),
      ].join('\n');
    }
    if (cible === 'interfaces') return Object.keys(toutes).join(' ');
    if (cible && cible !== 'all') {
      if (!toutes[cible]) return jeu.erreur(`Unable to access interface: No such device`, 1);
      return montrer(jeu, cible, toutes[cible]).join('\n');
    }
    return Object.entries(toutes)
      .map(([nom, i]) => montrer(jeu, nom, i).join('\n'))
      .join('\n\n');
  }
  if (action === 'set' || action === 'setconf' || action === 'addconf' || action === 'syncconf') return jeu.erreur(jeu.t('wg-set-non-simule'), 1);
  return jeu.erreur(`Invalid subcommand: \`${action}'\n${jeu.t('wg-usage')}`, 1);
}

function wgQuick(jeu: Shell, args: string[]): string {
  const [action, nom] = args;
  if (!action || !['up', 'down', 'strip', 'save'].includes(action) || !nom) return jeu.erreur(jeu.t('wg-quick-usage'), 1);
  if (jeu.qui !== 'root') return jeu.erreur(`wg-quick must be run as root.`, 1);
  if (action === 'strip') {
    const texte = jeu.lire(confDe(nom));
    if (texte === null) return jeu.erreur(`wg-quick: \`${confDe(nom)}' does not exist`, 1);
    return texte
      .split('\n')
      .filter((l) => !/^\s*(Address|DNS|MTU|Table|PreUp|PostUp|PreDown|PostDown|SaveConfig)\s*=/i.test(l))
      .join('\n');
  }
  if (action === 'save') return jeu.erreur(jeu.t('wg-set-non-simule'), 1);
  if (action === 'down') {
    const e = demonterWg(jeu, nom);
    if (e) return jeu.erreur(e, 1);
    return `[#] ip link delete dev ${nom}`;
  }
  const avertissement = modeMonde(jeu, confDe(nom)) ? [`Warning: \`${confDe(nom)}' is world accessible`] : [];
  const { lignes, erreur } = monterWg(jeu, nom, false);
  if (erreur !== null) {
    if (erreur) return jeu.erreur(erreur, 1);
    jeu.erreur([...avertissement, ...lignes].join('\n'), 1);
    return '';
  }
  if (avertissement.length) jeu.erreur(avertissement[0], 0);
  return lignes.join('\n');
}

// Le fichier est-il accessible aux autres (comme le teste wg-quick : stat -c '0%#a', & 0007) ?
const modeMonde = (jeu: Shell, chemin: string) => {
  const n = jeu.trouver(chemin);
  if (!n) return false;
  const mode = n.mode ?? 'rw-r--r--';
  return /[rwx]/.test(mode.slice(6, 9));
};

/** Le service wg-quick@NOM : monte l'interface d'après son fichier, au démarrage s'il est activé. */
export function serviceWg(nom: string) {
  return {
    description: `WireGuard via wg-quick(8) for ${nom}`,
    active: false,
    etat: 'inactive' as const,
    executable: 'wg-quick',
    resteActif: true,
    processus: [],
    verifier: (j: Parameters<typeof monterWg>[0]) => {
      if (j.etat.wg?.[nom]) return [`wg-quick: \`${nom}' already exists`];
      if (j.lire(confDe(nom)) === null) return [`wg-quick: \`${confDe(nom)}' does not exist`];
      const c = lireConfWg(j.lire(confDe(nom))!);
      return c.erreurs.length
        ? [`[#] ip link add ${nom} type wireguard`, `[#] wg setconf ${nom} /dev/fd/63`, ...c.erreurs, `[#] ip link delete dev ${nom}`]
        : null;
    },
    charger: (j: Parameters<typeof monterWg>[0]) => {
      const { lignes } = monterWg(j, nom, true);
      const sd = systemd(j);
      if (sd)
        for (const l of lignes)
          sd.journal.push({
            temps: sd.horloge,
            demarrage: sd.demarrage,
            unite: `wg-quick@${nom}.service`,
            ident: 'wg-quick',
            pid: 2210,
            message: l,
            priorite: 6,
          });
    },
    arret: (j: Parameters<typeof monterWg>[0]) => {
      demonterWg(j, nom);
    },
  };
}

export const WIREGUARD: Record<string, Commande> = {
  wg: { section: 8, propresOptions: true, lancer: ({ args, jeu, entree }) => commandeWg(jeu, args, entree) },
  'wg-quick': { section: 8, propresOptions: true, lancer: ({ args, jeu }) => wgQuick(jeu, args) },
};

/** ping vers une adresse derrière un tunnel : « sans-pair » (aucun pair n'a cette adresse), « perdu » ou « ok ». */
export function pingTunnel(jeu: Shell, ip: string): 'sans-pair' | 'perdu' | 'ok' {
  for (const [nom, i] of Object.entries(wg(jeu))) {
    const p = i.conf.pairs.find((x) => x.autorisees.some((a) => dans(ip, a)));
    if (!p) continue;
    const d = lan(jeu)?.distants?.find((x) => x.cle === p.cle);
    const e = d && etatTunnel(jeu, d, publicDu(jeu));
    if (!d || !e || e.nom !== nom || !serre(e.etat)) return 'perdu';
    const client = confDistant(jeu, d);
    if (client.adresses[0]?.split('/')[0] === ip) return 'ok';
    // Un appareil du site derrière ce pair : seulement si le passage reste ouvert dans sa box.
    return d.reseau && dans(ip, d.reseau) && (!d.derriereNat || client.pairs[0]?.keepalive) ? 'ok' : 'perdu';
  }
  return 'sans-pair';
}
