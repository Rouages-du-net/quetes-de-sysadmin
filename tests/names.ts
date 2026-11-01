// Les commandes des tests s'écrivent avec les noms français des lieux et des
// objets ; dans une autre langue, chaque nom du monde prend sa traduction
// (voir nom() dans src/engine/world.ts). Une copie numérotée (sourdough_2)
// suit son original. Le compte du joueur se traduit aussi dans vous@royaume
// ou /home/vous:/bin/bash (@ et : séparent les noms). Machine names are
// written in English, the engine's identifiers (kingdom → royaume in French,
// see machines.ftl), and translated where they are host names: after ssh and
// its cousins, after @, in kingdom.internal, id_kingdom, kingdom:path (scp),
// ~/.ssh/config (Host, HostName, ProxyJump) and the banner "Linux kingdom". Les mots de passe des histoires aussi
// (farine-2028 → flour-2028, voir mots-de-passe.ftl), partout où ils sont un mot entier.
import { readFileSync } from 'node:fs';
import { password, name, systemDirectory } from '../src/engine/world';
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

// Names that are also words of commands (restic snapshots, rsnapshot
// backup…): in a command too, only translated in a path.
const WORDS = new Set(['snapshots', 'backup', 'backups', 'live', 'rules', 'share', 'target', 'password', 'minutes', 'press', 'team', 'maps', 'repo']);

// A command typed in the game: one line, starting with a lower-case word that isn't followed by a colon.
const COMMAND = { test: (line: string) => !line.trim().includes('\n') && /^\s*(?:sudo\s+)?(?:@\w+|[\d*/,-]+|[a-z][\w.+-]*)(?:\s|$)/.test(line) && !/^\s*[a-z][\w.+-]*:/.test(line) };

export const inLanguage = (t: Translate, line: string) =>
  machinesInLanguage(
    t,
    line.replace(/[^\s/"'*@:]+/g, (m, at: number) => {
      // In a command, every word can be a name; in an expected output, a
      // plain English word (password, target, backup…) is only a name where
      // it looks like one: in a path, next to @, or with a dot, an
      // underscore, a capital or a digit.
      if ((!COMMAND.test(line) || WORDS.has(m)) && /^[a-z]+$/.test(m) && !/[/@~"=(]/.test(line[at - 1] ?? '') && !/[/@]/.test(line[at + m.length] ?? '') && !/\b(?:User|Host|HostName|ProxyJump|AllowUsers)\s+$/.test(line.slice(0, at))) return m;
      const before = /(?:\/[\w.-]+)+\/$/.exec(line.slice(0, at));
      if (before && systemDirectory(before[0] + m)) return m;
      const copyOf = /^(.+?)(_\d+)$/.exec(m);
      return copyOf && name(t, copyOf[1]) !== copyOf[1] ? name(t, copyOf[1]) + copyOf[2] : name(t, m);
    }),
  );
