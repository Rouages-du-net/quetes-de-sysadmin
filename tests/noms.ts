// Les commandes des tests s'écrivent avec les noms français des lieux et des
// objets ; dans une autre langue, chaque nom du monde prend sa traduction
// (voir nom() dans src/moteur/monde.ts). Une copie numérotée (levain_2)
// suit son original. Le compte du joueur se traduit aussi dans vous@royaume
// ou /home/vous:/bin/bash (@ et : séparent les noms). Les noms de machines
// (royaume → kingdom, voir machines.ftl) se traduisent là où ce sont des noms
// d'hôte : après ssh et ses cousins, après @, dans royaume.internal, id_royaume,
// royaume:chemin (scp), ~/.ssh/config (Host, HostName, ProxyJump) et la
// bannière « Linux royaume ».
import { nom } from '../src/moteur/monde';
import { MACHINES, nomMachine, POSTE } from '../src/moteur/machines';
import type { Traduire } from '../src/textes';

const IDS = [POSTE, ...MACHINES].map((m) => m.nom).join('|');
const HOTE = new RegExp(`(?<=@|\\bid_|^Linux |^\\s*(?:Host|HostName|ProxyJump)\\s+|-J )(${IDS})(?![\\w-])|(?<![\\w./-])(${IDS})(?=\\.internal\\b|:[~/\\w])`, 'gim');
const RESEAU = /^\s*(?:sudo\s+)?(?:ssh|ssh-copy-id|sftp|scp|rsync|nc|ping|nmap|host|dig|curl)\b/;

export const machinesDansLaLangue = (t: Traduire, ligne: string) => {
  const traduite = ligne.replace(HOTE, (m) => nomMachine(t, m));
  return RESEAU.test(traduite) ? traduite.replace(new RegExp(`(?<![\\w./-])(${IDS})(?![\\w./-])`, 'g'), (m) => nomMachine(t, m)) : traduite;
};

export const dansLaLangue = (t: Traduire, ligne: string) =>
  machinesDansLaLangue(
    t,
    ligne.replace(/[^\s/"'*@:]+/g, (m) => {
      const copie = /^(.+?)(_\d+)$/.exec(m);
      return copie && nom(t, copie[1]) !== copie[1] ? nom(t, copie[1]) + copie[2] : nom(t, m);
    }),
  );
