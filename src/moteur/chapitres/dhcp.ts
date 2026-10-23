// Histoire « La Ruche » — chapitre « Le DHCP » : les VLAN sont là, mais les
// ordinateurs et les téléphones n'ont plus d'adresse : dnsmasq sert encore
// l'ancien réseau à plat (interface=eth1, 192.168.1.x). La nouvelle
// imprimante, elle, doit garder 10.10.30.10 (tous les postes l'ont configurée).
//   - une plage par VLAN (dhcp-range), dans le réseau de chaque interface ;
//   - dnsmasq doit écouter les VLAN (interface=eth1.10…, ou eth1*), et
//     surtout pas eth0, le réseau du fournisseur d'accès ;
//   - une réservation pour l'imprimante (dhcp-host=MAC,nom,adresse) ;
//   - dnsmasq --test, puis systemctl restart dnsmasq.
// Objectif vérifié sur l'état : chaque appareil en DHCP a reçu une adresse
// dans le réseau de son VLAN, l'imprimante la sienne, et dnsmasq n'écoute pas
// eth0.
// Sources : https://dnsmasq.org/docs/dnsmasq-man.html

import { f, type Chapitre } from '../monde';
import type { Jeu } from '../shell';
import { dans, lan } from '../lan';
import { repondSur } from '../dnsmasq';
import { comptesRuche, initialiserRuche, INTERFACES_VLAN, M, mondeRuche, MOT_DE_PASSE, nouveauLan, systemdRuche, VLANS, planRuche } from './ruche';

const DNSMASQ_A_PLAT = `# The DHCP server of the LAN
interface=eth1
dhcp-range=192.168.1.100,192.168.1.200,12h`;
const IMPRIMANTE = '10.10.30.10';

const enDhcp = (j: Jeu) => lan(j)!.appareils.filter((a) => !a.fixe);
const bienServi = (j: Jeu) =>
  enDhcp(j).every((a) => a.bail && dans(a.bail, VLANS.find((v) => v.id === a.vlan)!.reseau)) &&
  lan(j)!.appareils.find((a) => a.nom === 'imprimante')?.bail === IMPRIMANTE;

export const dhcp: Chapitre = {
  id: 'dhcp',
  numero: 2,
  plan: planRuche(),
  commandes: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'nano',
    'cp',
    'sudo',
    'id',
    'whoami',
    'ip',
    'ifup',
    'ifdown',
    'ping',
    'systemctl',
    'journalctl',
    'dnsmasq',
  ],
  maison: M,
  accueil: 'courriel_malik.txt',
  noms: true,
  final: 'fin',
  motDePasse: MOT_DE_PASSE,
  comptes: comptesRuche,
  etat: () => ({ lan: nouveauLan(true), systemd: systemdRuche() }),
  initialiser: initialiserRuche,
  creerMonde: (t) =>
    mondeRuche({ interfaces: INTERFACES_VLAN, dnsmasq: DNSMASQ_A_PLAT, maison: { 'courriel_malik.txt': f(t('dhcp-courriel-malik')) } }),
  evenements: [
    { id: 'wan', condition: (j) => repondSur(j, 'eth0'), message: (j) => j.t('dhcp-evenement-wan') },
    {
      id: 'imprimante-ailleurs',
      condition: (j) => {
        const b = lan(j)!.appareils.find((a) => a.nom === 'imprimante')?.bail;
        return !!b && b !== IMPRIMANTE;
      },
      message: (j) => j.t('dhcp-evenement-imprimante-ailleurs', { adresse: IMPRIMANTE }),
    },
    { id: 'fin', condition: (j) => bienServi(j) && !repondSur(j, 'eth0'), message: (j) => j.t('dhcp-evenement-fin') },
  ],
};
