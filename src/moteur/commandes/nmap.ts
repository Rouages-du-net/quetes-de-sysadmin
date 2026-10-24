// nmap, l'explorateur de réseau (https://nmap.org/book/man.html), sur le
// réseau de l'histoire (src/moteur/scan.ts). Sortie en anglais, comme le vrai
// outil. Options comprises : -sV -sT -sS -sn -Pn -n -F -p -oN --open -T0..5 -v ;
// les autres donnent le message de nmap.

import { balayer, VERSION_NMAP, type Options } from '../scan';
import type { Commande } from './index';

const INVALIDE = (o: string) => `nmap: invalid option -- '${o}'\nSee the output of nmap -h for a summary of options.`;

// Une liste de ports : 22,80 ; 1-1024 ; - (tous).
function lirePorts(spec: string): number[] | 'tous' | null {
  if (spec === '-') return 'tous';
  const ports: number[] = [];
  for (const morceau of spec.split(',')) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(morceau);
    if (!m) return null;
    const [a, b] = [Number(m[1]), Number(m[2] ?? m[1])];
    if (a < 1 || b > 65535 || a > b) return null;
    if (b - a > 2000) return 'tous';
    for (let p = a; p <= b; p++) ports.push(p);
  }
  return ports;
}

export const NMAP: Record<string, Commande> = {
  nmap: {
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      if (args.includes('-V') || args.includes('--version'))
        return `Nmap version ${VERSION_NMAP} ( https://nmap.org )\nPlatform: x86_64-pc-linux-gnu\nCompiled with: liblua-5.4.7 openssl-3.5.1 libssh2-1.11.1 libz-1.3.1 libpcre2-10.45 libpcap-1.10.5 nmap-libdnet-1.12 ipv6\nCompiled without:\nAvailable nsock engines: epoll poll select`;
      const o: Options = { versions: false, ping: false, sansPing: false, nombres: false, ouvertsSeulement: false, ports: null };
      const cibles: string[] = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-sV') o.versions = true;
        else if (a === '-sT') continue;
        else if (a === '-sS') {
          if (jeu.qui !== 'root') return jeu.erreur("You requested a scan type which requires root privileges.\nQUITTING!", 1);
        } else if (a === '-sn') o.ping = true;
        else if (a === '-Pn') o.sansPing = true;
        else if (a === '-n') o.nombres = true;
        else if (a === '-v' || a === '-vv') continue;
        else if (a === '--open') o.ouvertsSeulement = true;
        else if (a === '-F') o.ports ??= 'rapide';
        else if (/^-T[0-5]$/.test(a)) continue;
        else if (a === '-oN') {
          const f = args[++i];
          if (!f) return jeu.erreur('nmap: option requires an argument -- \'oN\'\nSee the output of nmap -h for a summary of options.', 1);
          o.fichier = f;
        } else if (a === '-p' || a.startsWith('-p')) {
          const spec = a === '-p' ? args[++i] : a.slice(2);
          if (spec === undefined) return jeu.erreur("nmap: option requires an argument -- 'p'\nSee the output of nmap -h for a summary of options.", 1);
          const ports = lirePorts(spec);
          if (!ports) return jeu.erreur(`Your port specifications are illegal.  Example of proper form: "-100,200-1024,T:3000-4000,U:60000-"\nQUITTING!`, 1);
          o.ports = ports;
        } else if (a.startsWith('--')) return jeu.erreur(`nmap: unrecognized option '${a}'\nSee the output of nmap -h for a summary of options.`, 1);
        else if (a.startsWith('-')) return jeu.erreur(INVALIDE(a.slice(1, 2)), 1);
        else cibles.push(a);
      }
      if (!cibles.length) return jeu.erreur(jeu.t('nmap-aucune-cible'), 1);
      const r = balayer(jeu, cibles, o, `nmap ${args.join(' ')}`);
      if ('erreur' in r) return jeu.erreur(r.erreur, 1);
      let note = '';
      if (o.fichier) {
        const refus = jeu.placer('nmap', o.fichier, { type: 'fichier', contenu: r.fichier, lignes: true, proprio: jeu.qui });
        if (refus) note = `\nFailed to open normal output file ${o.fichier} for writing: ${refus}`;
      }
      return r.sortie + note;
    },
  },
};
