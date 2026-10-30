// Les commandes d'Ansible : ansible (commandes ad-hoc), ansible-playbook,
// ansible-inventory et ansible-doc. Messages d'après ansible-core
// (https://docs.ansible.com/ansible/latest/cli/). Le moteur est dans ansible.ts.
// L'historique des exécutions est gardé dans etat.ansible (pour les histoires).

import type { Shell } from '../shell';
import type { Commande } from './index';
import {
  adhoc,
  DOCS,
  ErreurAnsible,
  hotesDu,
  jouer,
  lireConfig,
  lireInventaire,
  lirePlaybook,
  modulesConnus,
  moduleDe,
  motifInconnu,
  VERSION,
  type Contexte,
  type Execution,
  type Inventaire,
} from '../ansible';

export interface EtatAnsible {
  executions: (Execution & { ligne: string; limite: string | null })[];
  pings: Record<string, string>[];
}
export const historique = (jeu: Shell): EtatAnsible => (jeu.etat.ansible ??= { executions: [], pings: [] });

const VERSION_LONGUE = (programme: string, maison: string, config: string | null) =>
  [
    `${programme} [core ${VERSION}]`,
    `  config file = ${config ?? 'None'}`,
    `  configured module search path = ['${maison}/.ansible/plugins/modules', '/usr/share/ansible/plugins/modules']`,
    '  ansible python module location = /usr/lib/python3/dist-packages/ansible',
    `  ansible collection location = ${maison}/.ansible/collections:/usr/share/ansible/collections`,
    `  executable location = /usr/bin/${programme}`,
    '  python version = 3.13.5 (main, Jun 25 2025, 18:55:22) [GCC 14.2.0] (/usr/bin/python3)',
    '  jinja version = 3.1.6',
    '  libyaml = True',
  ].join('\n');

// Les options communes : -i inventaire, -u compte, -b (become), --check, --diff, --limit.
function lireOptions(args: string[]) {
  const o: { inventaire?: string; utilisateur?: string; become: boolean; verifier: boolean; difference: boolean; limite: string | null; reste: string[]; module?: string; arguments?: string; inconnue?: string; drapeaux: Set<string> } = {
    become: false,
    verifier: false,
    difference: false,
    limite: null,
    reste: [],
    drapeaux: new Set(),
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const valeur = () => args[++i] ?? '';
    if (a === '-i' || a === '--inventory') o.inventaire = valeur();
    else if (a.startsWith('--inventory=')) o.inventaire = a.slice(12);
    else if (a === '-u' || a === '--user') o.utilisateur = valeur();
    else if (a === '-b' || a === '--become') o.become = true;
    else if (a === '-C' || a === '--check') o.verifier = true;
    else if (a === '-D' || a === '--diff') o.difference = true;
    else if (a === '-l' || a === '--limit') o.limite = valeur();
    else if (a.startsWith('--limit=')) o.limite = a.slice(8);
    else if (a === '-m' || a === '--module-name') o.module = valeur();
    else if (a === '-a' || a === '--args') o.arguments = valeur();
    else if (/^-v+$/.test(a)) continue;
    else if (['--syntax-check', '--list-hosts', '--list-tasks', '--version', '--graph', '--list', '--force-handlers'].includes(a)) o.drapeaux.add(a);
    else if (a.startsWith('-')) o.inconnue ??= a;
    else o.reste.push(a);
  }
  return o;
}

// Le contexte : configuration, inventaire (avec les avertissements d'Ansible s'il manque).
function contexte(jeu: Shell, o: ReturnType<typeof lireOptions>): { c: Contexte; avertissements: string[] } {
  const config = lireConfig(jeu);
  const avertissements: string[] = [];
  const chemin = jeu.resoudre(o.inventaire ?? config.inventaire);
  let inventaire: Inventaire;
  // -i nom1,nom2, : une liste d'hôtes directement.
  if (o.inventaire?.includes(',')) inventaire = lireInventaire(o.inventaire.split(',').filter(Boolean).join('\n'));
  else {
    const texte = jeu.lire(chemin);
    if (texte === null) {
      if (o.inventaire) avertissements.push(`[WARNING]: Unable to parse ${chemin} as an inventory source`);
      avertissements.push('[WARNING]: No inventory was parsed, only implicit localhost is available');
    }
    inventaire = lireInventaire(texte ?? '');
  }
  return {
    c: { jeu, config, inventaire, verifier: o.verifier, difference: o.difference, sorties: [], sessions: {}, utilisateurForce: o.utilisateur, become: o.become },
    avertissements,
  };
}

const USAGE_ANSIBLE = `usage: ansible [-h] [--version] [-v] [-b] [--become-method BECOME_METHOD] [-i INVENTORY] [--list-hosts] [-l SUBSET] [-C] [-D] [-u REMOTE_USER] [-a MODULE_ARGS] [-m MODULE_NAME] pattern`;

function ansible(jeu: Shell, args: string[]): string {
  const o = lireOptions(args);
  if (o.drapeaux.has('--version')) return VERSION_LONGUE('ansible', jeu.comptes.utilisateurs[jeu.qui]?.maison ?? `/home/${jeu.qui}`, lireConfig(jeu).fichier);
  if (o.inconnue) return jeu.erreur(`${USAGE_ANSIBLE}\nansible: error: unrecognized arguments: ${o.inconnue}`, 2);
  const motif = o.reste[0];
  if (!motif) return jeu.erreur(`${USAGE_ANSIBLE}\nansible: error: the following arguments are required: pattern`, 2);
  const { c, avertissements } = contexte(jeu, o);
  const sortie = [...avertissements];
  const hotes = hotesDu(c.inventaire, motif);
  if (motifInconnu(c.inventaire, motif)) sortie.push(`[WARNING]: Could not match supplied host pattern, ignoring: ${motif}`);
  if (o.drapeaux.has('--list-hosts')) return [...sortie, `  hosts (${hotes.length}):`, ...hotes.map((h) => `    ${h}`)].join('\n');
  if (!hotes.length) {
    sortie.push('[WARNING]: No hosts matched, nothing to do');
    return jeu.erreur(sortie.join('\n'), 0);
  }
  const brut = o.module ?? 'command';
  const module = moduleDe(brut);
  if (!module) return jeu.erreur([...sortie, `ERROR! couldn't resolve module/action '${brut}'. This often indicates a misspelling, missing collection, or incorrect module path.`].join('\n'), 1);
  if ((module === 'command' || module === 'shell') && !o.arguments) return jeu.erreur(`ERROR! No argument passed to ${module} module`, 1);
  const r = adhoc(c, motif, module, o.arguments ?? '', o.become);
  if (module === 'ping') historique(jeu).pings.push(r.resultats);
  if (r.code) jeu.statut = r.code;
  return [...sortie, ...r.lignes].join('\n');
}

const USAGE_PLAYBOOK = 'usage: ansible-playbook [-h] [--version] [-v] [-i INVENTORY] [--list-hosts] [-l SUBSET] [-C] [-D] [-u REMOTE_USER] [-b] [--force-handlers] [--syntax-check] [--list-tasks] playbook [playbook ...]';

function playbook(jeu: Shell, args: string[]): string {
  const o = lireOptions(args);
  if (o.drapeaux.has('--version')) return VERSION_LONGUE('ansible-playbook', jeu.comptes.utilisateurs[jeu.qui]?.maison ?? `/home/${jeu.qui}`, lireConfig(jeu).fichier);
  if (o.inconnue) return jeu.erreur(`${USAGE_PLAYBOOK}\nansible-playbook: error: unrecognized arguments: ${o.inconnue}`, 2);
  const fichier = o.reste[0];
  if (!fichier) return jeu.erreur(`${USAGE_PLAYBOOK}\nansible-playbook: error: the following arguments are required: playbook`, 2);
  const chemin = jeu.resoudre(fichier);
  const texte = jeu.lire(chemin);
  if (texte === null) return jeu.erreur(`ERROR! the playbook: ${fichier} could not be found`, 1);
  let plays;
  try {
    plays = lirePlaybook(texte, chemin);
  } catch (e) {
    if (e instanceof ErreurAnsible) return jeu.erreur(e.message, 4);
    throw e;
  }
  const { c, avertissements } = contexte(jeu, o);
  if (o.drapeaux.has('--syntax-check')) return [...avertissements, '', `playbook: ${fichier}`].join('\n');
  if (o.drapeaux.has('--list-hosts') || o.drapeaux.has('--list-tasks')) {
    const lignes = [...avertissements, '', `playbook: ${fichier}`];
    plays.forEach((p, n) => {
      let hotes = hotesDu(c.inventaire, p.hotes);
      if (o.limite) hotes = hotes.filter((h) => hotesDu(c.inventaire, o.limite!).includes(h));
      lignes.push('', `  play #${n + 1} (${p.hotes}): ${p.nom}\tTAGS: []`);
      if (o.drapeaux.has('--list-hosts')) lignes.push(`    pattern: ['${p.hotes}']`, `    hosts (${hotes.length}):`, ...hotes.map((h) => `      ${h}`));
      if (o.drapeaux.has('--list-tasks')) lignes.push('    tasks:', ...p.taches.map((t) => `      ${t.nom}\tTAGS: []`));
    });
    return lignes.join('\n');
  }
  c.sorties.push(...avertissements);
  try {
    const { execution, code } = jouer(c, plays, o.limite, o.drapeaux.has('--force-handlers'));
    historique(jeu).executions.push({ ...execution, fichier: chemin, ligne: args.join(' '), limite: o.limite });
    if (code) jeu.statut = code;
  } catch (e) {
    if (!(e instanceof ErreurAnsible)) throw e;
    c.sorties.push(e.message);
    jeu.statut = 1;
  }
  return c.sorties.join('\n').replace(/^\n/, '');
}

function inventaire(jeu: Shell, args: string[]): string {
  const o = lireOptions(args);
  const { c, avertissements } = contexte(jeu, o);
  const inv = c.inventaire;
  if (o.drapeaux.has('--graph')) {
    const groupes = Object.keys(inv.groupes).filter((g) => g !== 'all' && (g !== 'ungrouped' || inv.groupes[g].length || true));
    const lignes = ['@all:'];
    for (const g of ['ungrouped', ...groupes.filter((x) => x !== 'ungrouped')]) {
      lignes.push(`  |--@${g}:`);
      for (const h of inv.groupes[g] ?? []) lignes.push(`  |  |--${h}`);
    }
    return [...avertissements, ...lignes].join('\n');
  }
  if (o.drapeaux.has('--list')) {
    const json: Record<string, unknown> = {
      _meta: { hostvars: Object.fromEntries(inv.ordre.map((h) => [h, inv.hotes[h]])) },
      all: { children: ['ungrouped', ...Object.keys(inv.groupes).filter((g) => g !== 'all' && g !== 'ungrouped')] },
    };
    for (const [g, l] of Object.entries(inv.groupes)) if (g !== 'all' && l.length) json[g] = { hosts: l };
    return [...avertissements, JSON.stringify(json, null, 4)].join('\n');
  }
  return jeu.erreur('usage: ansible-inventory [-h] [--version] [-v] [-i INVENTORY] [--list] [--host HOST] [--graph] [group]\nansible-inventory: error: No action selected, at least one of --host, --graph or --list needs to be specified.', 2);
}

function doc(jeu: Shell, args: string[]): string {
  if (args.includes('-l') || args.includes('--list'))
    return modulesConnus()
      .map((m) => `ansible.builtin.${m.padEnd(20)} ${DOCS[m].court}`)
      .join('\n');
  const nom = args.find((a) => !a.startsWith('-'));
  if (!nom) return jeu.erreur('usage: ansible-doc [-h] [--version] [-v] [-l] [-s] [plugin ...]\nansible-doc: error: Incorrect options passed', 5);
  const m = moduleDe(nom);
  if (!m || !DOCS[m]) return jeu.erreur(`[WARNING]: module ${nom} not found in:\n/home/${jeu.qui}/.ansible/plugins/modules:/usr/share/ansible/plugins/modules:/usr/lib/python3/dist-packages/ansible/modules`, 1);
  const d = DOCS[m];
  return [
    `> ANSIBLE.BUILTIN.${m.toUpperCase()}    (/usr/lib/python3/dist-packages/ansible/modules/${m}.py)`,
    '',
    `  ${d.court}`,
    '',
    'OPTIONS (= indicates it is required):',
    '',
    ...Object.entries(d.options).flatMap(([k, v]) => [`${v.includes('(required)') ? '=' : '-'} ${k}`, `        ${v.replace(' (required)', '')}`, '']),
    'EXAMPLES:',
    '',
    d.exemple,
  ].join('\n');
}

export const ANSIBLE: Record<string, Commande> = {
  ansible: { propresOptions: true, lancer: ({ args, jeu }) => ansible(jeu, args) },
  'ansible-playbook': { propresOptions: true, lancer: ({ args, jeu }) => playbook(jeu, args) },
  'ansible-inventory': { propresOptions: true, lancer: ({ args, jeu }) => inventaire(jeu, args) },
  'ansible-doc': { propresOptions: true, lancer: ({ args, jeu }) => doc(jeu, args) },
};
