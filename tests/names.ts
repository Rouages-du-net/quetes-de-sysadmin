// Les commandes des tests s'écrivent avec les noms français des lieux et des
// objets ; dans une autre langue, chaque nom du monde prend sa traduction
// (voir nom() dans src/engine/world.ts). Une copie numérotée (levain_2)
// suit son original. Le compte du joueur se traduit aussi dans vous@royaume
// ou /home/vous:/bin/bash (@ et : séparent les noms). Les noms de machines
// (royaume → kingdom, voir machines.ftl) se traduisent là où ce sont des noms
// d'hôte : après ssh et ses cousins, après @, dans royaume.internal, id_royaume,
// royaume:chemin (scp), ~/.ssh/config (Host, HostName, ProxyJump) et la
// bannière « Linux royaume ». Les mots de passe des histoires aussi
// (farine-2028 → flour-2028, voir mots-de-passe.ftl), partout où ils sont un mot entier.
import { readFileSync } from 'node:fs';
import { motDePasse, nom } from '../src/engine/world';
import { MACHINES, nomMachine, POSTE } from '../src/engine/machines';
import type { Traduire } from '../src/texts';

const IDS = [POSTE, ...MACHINES].map((m) => m.nom).join('|');
const HOTE = new RegExp(`(?<=@|\\bid_|^Linux |^\\s*(?:Host|HostName|ProxyJump)\\s+|-J )(${IDS})(?![\\w-])|(?<![\\w./-])(${IDS})(?=\\.internal\\b|:[~/\\w])`, 'gim');
const RESEAU = /^\s*(?:sudo\s+)?(?:ssh|ssh-copy-id|sftp|scp|rsync|nc|ping|nmap|host|dig|curl)\b/;

const MOTS_DE_PASSE = [...readFileSync(new URL('../src/texts/fr/mots-de-passe.ftl', import.meta.url), 'utf8').matchAll(/^mdp-(\S+) =/gm)].map((m) => m[1]);
const MDP = new RegExp(`(?<![\\w-])(${MOTS_DE_PASSE.join('|')})(?![\\w-])`, 'g');

export const machinesDansLaLangue = (t: Traduire, ligne: string) => {
  const traduite = ligne.replace(HOTE, (m) => nomMachine(t, m)).replace(MDP, (m) => motDePasse(t, m));
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
