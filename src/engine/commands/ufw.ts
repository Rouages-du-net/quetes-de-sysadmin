// ufw (Uncomplicated Firewall), d'après https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html :
// status [verbose|numbered], enable, disable, default, allow, deny, reject,
// limit, delete, app list. Les règles vivent dans etat.ufw (../parefeu.ts).
// ufw est traduit : ses messages suivent la langue du système (textes .ftl),
// sauf les noms d'actions (ALLOW, DENY…), qu'il n'affiche qu'en anglais.

import type { Shell } from '../shell';
import { APPLICATIONS, SERVICES, type Action, type PareFeu, type Politique, type Regle } from '../firewall';
import type { Commande } from './index';

const ACTIONS = ['allow', 'deny', 'reject', 'limit'];

// « 22 », « 22/tcp », « ssh », « OpenSSH », ou « from X [to any port N] [proto P] ».
function lireRegle(jeu: Shell, action: Action, mots: string[]): Regle | null {
  if (mots.length === 1) {
    const [spec] = mots;
    if (APPLICATIONS[spec]) return { action, vers: spec, ports: APPLICATIONS[spec], de: null };
    if (SERVICES[spec]) return { action, vers: `${SERVICES[spec].ports[0]}/${SERVICES[spec].proto}`, ports: SERVICES[spec].ports, de: null };
    const m = /^(\d{1,5})(?:\/(tcp|udp))?$/.exec(spec);
    return m ? { action, vers: spec, ports: [Number(m[1])], de: null } : null;
  }
  let de: string | null = null;
  let port: string | null = null;
  let proto: string | null = null;
  for (let i = 0; i < mots.length; i++) {
    const [mot, valeur] = [mots[i], mots[i + 1]];
    if (mot === 'from' && valeur) (de = valeur === 'any' ? null : valeur), i++;
    else if (mot === 'to' && valeur === 'any') i++;
    else if (mot === 'port' && valeur && /^\d+$/.test(valeur)) (port = valeur), i++;
    else if (mot === 'proto' && (valeur === 'tcp' || valeur === 'udp')) (proto = valeur), i++;
    else return null;
  }
  if (de !== null && !/^\d+\.\d+\.\d+\.\d+(\/\d+)?$/.test(de)) return null;
  const vers = port ? (proto ? `${port}/${proto}` : port) : jeu.t('ufw-partout');
  return { action, vers, ports: port ? [Number(port)] : [], de };
}

const memeRegle = (a: Regle, b: Regle) => a.action === b.action && a.vers === b.vers && a.de === b.de;
const texteRegle = (r: Regle) => (r.de ? `${r.action} from ${r.de}${r.ports.length ? ` to any port ${r.vers}` : ''}` : `${r.action} ${r.vers}`);

// Le tableau de ufw status : une ligne par règle, plus sa jumelle (v6).
function tableau(jeu: Shell, pf: PareFeu, sens: string, numeros: boolean): string[] {
  const partout = jeu.t('ufw-partout');
  const lignes: [string, string, string][] = [];
  for (const r of pf.regles) {
    const action = r.action.toUpperCase() + sens;
    lignes.push([r.vers, action, r.de ?? partout]);
    if (!r.de) lignes.push([r.vers === partout ? r.vers : `${r.vers} (v6)`, action, `${partout} (v6)`]);
  }
  const entete = (numeros ? '     ' : '') + `${jeu.t('ufw-vers').padEnd(27)}${jeu.t('ufw-action').padEnd(12)}${jeu.t('ufw-de')}`;
  const traits = (numeros ? '     ' : '') + `${'-'.repeat(jeu.t('ufw-vers').length).padEnd(27)}${'-'.repeat(jeu.t('ufw-action').length).padEnd(12)}${'-'.repeat(jeu.t('ufw-de').length)}`;
  return [entete, traits, ...lignes.map(([v, a, d], i) => (numeros ? `[${String(i + 1).padStart(2)}] ` : '') + `${v.padEnd(27)}${a.padEnd(12)}${d}`)];
}

export const UFW: Record<string, Commande> = {
  ufw: {
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const pf: PareFeu | undefined = jeu.etat.ufw;
      const [action, ...reste] = args;
      if (!action || action === '--help') return jeu.erreur(jeu.t('ufw-usage'));
      if (jeu.qui !== 'root') return jeu.erreur(jeu.t('ufw-root'));
      if (!pf) return jeu.erreur(jeu.t('ufw-absent'));
      const v6 = (cle: string) => `${jeu.t(cle)}\n${jeu.t(cle)} (v6)`;
      if (action === 'status') {
        if (!pf.actif) return jeu.t('ufw-inactif');
        const detail = reste[0] === 'verbose';
        const entete = [jeu.t('ufw-statut-actif')];
        if (detail)
          entete.push(
            jeu.t('ufw-journalisation'),
            jeu.t('ufw-defauts', { entrant: pf.entrant, sortant: pf.sortant }),
            jeu.t('ufw-profils'),
          );
        if (!pf.regles.length) return entete.join('\n');
        return [...entete, '', ...tableau(jeu, pf, detail || reste[0] === 'numbered' ? ' IN' : '', reste[0] === 'numbered')].join('\n');
      }
      if (action === 'enable') {
        if (pf.actif) return jeu.t('ufw-deja-actif');
        jeu.demander(jeu.t('ufw-question'), (r) => {
          if (!/^(y|yes|o|oui)$/i.test(r)) return jeu.t('ufw-abandon');
          pf.actif = true;
          pf.connexionsALActivation = jeu.etat.connexions ?? 1;
          return jeu.t('ufw-active');
        });
        return '';
      }
      if (action === 'disable') {
        pf.actif = false;
        return jeu.t('ufw-desactive');
      }
      if (action === 'default') {
        const [politique, sens = 'incoming'] = reste;
        if (!['allow', 'deny', 'reject'].includes(politique) || !['incoming', 'outgoing'].includes(sens)) return jeu.erreur(jeu.t('ufw-syntaxe'));
        if (sens === 'incoming') pf.entrant = politique as Politique;
        else pf.sortant = politique as Politique;
        return jeu.t(sens === 'incoming' ? 'ufw-defaut-entrant' : 'ufw-defaut-sortant', { politique });
      }
      if (action === 'app' && reste[0] === 'list') return [jeu.t('ufw-applications'), ...Object.keys(APPLICATIONS).sort().map((a) => `  ${a}`)].join('\n');
      if (action === 'delete') {
        if (reste.length === 1 && /^\d+$/.test(reste[0])) {
          // La numérotation de ufw status numbered compte aussi les lignes (v6).
          const lignes = pf.regles.flatMap((r) => (r.de ? [r] : [r, r]));
          const r = lignes[Number(reste[0]) - 1];
          if (!r) return jeu.erreur(jeu.t('ufw-numero', { numero: reste[0] }));
          jeu.demander(jeu.t('ufw-question-suppression', { regle: texteRegle(r) }), (rep) => {
            if (!/^(y|yes|o|oui)$/i.test(rep)) return jeu.t('ufw-abandon');
            pf.regles = pf.regles.filter((q) => q !== r);
            return r.de ? jeu.t('ufw-regle-supprimee') : v6('ufw-regle-supprimee');
          });
          return '';
        }
        const r = ACTIONS.includes(reste[0]) ? lireRegle(jeu, reste[0] as Action, reste.slice(1)) : null;
        if (!r) return jeu.erreur(jeu.t('ufw-syntaxe'));
        const existante = pf.regles.find((q) => memeRegle(q, r));
        if (!existante) return jeu.erreur(jeu.t('ufw-inexistante'));
        pf.regles = pf.regles.filter((q) => q !== existante);
        return r.de ? jeu.t('ufw-regle-supprimee') : v6('ufw-regle-supprimee');
      }
      if (ACTIONS.includes(action)) {
        const r = lireRegle(jeu, action as Action, reste);
        if (!r) return jeu.erreur(jeu.t('ufw-syntaxe'));
        if (pf.regles.some((q) => memeRegle(q, r))) return r.de ? jeu.t('ufw-existante') : v6('ufw-existante');
        pf.regles.push(r);
        return r.de ? jeu.t('ufw-regles-mises-a-jour') : v6('ufw-regles-mises-a-jour');
      }
      return jeu.erreur(jeu.t('ufw-syntaxe'));
    },
  },
};
