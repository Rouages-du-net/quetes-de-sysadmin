// Les commandes des tests s'écrivent avec les noms français des lieux et des
// objets ; dans une autre langue, chaque nom du monde prend sa traduction
// (voir nom() dans src/engine/world.ts). Une copie numérotée (levain_2)
// suit son original. Le compte du joueur se traduit aussi dans vous@royaume
// ou /home/vous:/bin/bash (@ et : séparent les noms). Machine names are
// written in English, the engine's identifiers (kingdom → royaume in French,
// see machines.ftl), and translated where they are host names: after ssh and
// its cousins, after @, in kingdom.internal, id_kingdom, kingdom:path (scp),
// ~/.ssh/config (Host, HostName, ProxyJump) and the banner "Linux kingdom". Les mots de passe des histoires aussi
// (farine-2028 → flour-2028, voir mots-de-passe.ftl), partout où ils sont un mot entier.
import { readFileSync } from 'node:fs';
import { password, name } from '../src/engine/world';
import { MACHINES, machineName, WORKSTATION } from '../src/engine/machines';
import type { Translate } from '../src/texts';

const IDS = [WORKSTATION, ...MACHINES].map((m) => m.name).join('|');
const HOST = new RegExp(`(?<=@|\\bid_|^Linux |^\\s*(?:Host|HostName|ProxyJump)\\s+|-J )(${IDS})(?![\\w-])|(?<![\\w./-])(${IDS})(?=\\.internal\\b|:[~/\\w])`, 'gim');
const NETWORK = /^\s*(?:sudo\s+)?(?:ssh|ssh-copy-id|sftp|scp|rsync|nc|ping|nmap|host|dig|curl)\b/;

const PASSWORDS = [...readFileSync(new URL('../src/texts/fr/mots-de-passe.ftl', import.meta.url), 'utf8').matchAll(/^mdp-(\S+) =/gm)].map((m) => m[1]);
const MDP = new RegExp(`(?<![\\w-])(${PASSWORDS.join('|')})(?![\\w-])`, 'g');

export const machinesInLanguage = (t: Translate, line: string) => {
  const translated = line.replace(HOST, (m) => machineName(t, m)).replace(MDP, (m) => password(t, m));
  return NETWORK.test(translated) ? translated.replace(new RegExp(`(?<![\\w./-])(${IDS})(?![\\w./-])`, 'g'), (m) => machineName(t, m)) : translated;
};

export const inLanguage = (t: Translate, line: string) =>
  machinesInLanguage(
    t,
    line.replace(/[^\s/"'*@:]+/g, (m) => {
      const copyOf = /^(.+?)(_\d+)$/.exec(m);
      return copyOf && name(t, copyOf[1]) !== copyOf[1] ? name(t, copyOf[1]) + copyOf[2] : name(t, m);
    }),
  );
