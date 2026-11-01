// Le pare-feu d'une machine, tel que ufw le gère (https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html) :
// une politique par défaut (entrant, sortant) et une liste ordonnée de
// règles ; la PREMIÈRE règle qui correspond décide, sinon la politique par
// défaut. Pare-feu inactif : tout passe. Les connexions déjà établies
// (comme la session ssh en cours) ne sont jamais coupées.
// Écarts : IPv4 et IPv6 confondus (les lignes « (v6) » sont affichées pour
// la forme), pas de routage, de journalisation ni de règles sortantes.

export type Action = 'allow' | 'deny' | 'reject' | 'limit';
export type Policy = 'allow' | 'deny' | 'reject';

export interface Rule {
  action: Action;
  // Ce que ufw affiche dans la colonne « Vers » (22/tcp, 80, OpenSSH…).
  to: string;
  ports: number[];
  // Adresse d'origine, ou null pour « n'importe où ».
  forEachOf: string | null;
}

export interface Firewall {
  enabled: boolean;
  incoming: Policy;
  outgoing: Policy;
  rules: Rule[];
  // Nombre de connexions ssh au moment de l'activation (pour vérifier
  // qu'une nouvelle connexion passe toujours).
  activationAlConnections?: number;
}

export const newFirewall = (): Firewall => ({ enabled: false, incoming: 'deny', outgoing: 'allow', rules: [] });

// Services de /etc/services et profils d'applications de /etc/ufw/applications.d.
export const SERVICES: Record<string, { ports: number[]; proto?: string }> = {
  ssh: { ports: [22], proto: 'tcp' },
  http: { ports: [80], proto: 'tcp' },
  https: { ports: [443], proto: 'tcp' },
  mysql: { ports: [3306], proto: 'tcp' },
};
export const APPLICATIONS: Record<string, number[]> = {
  'Nginx Full': [80, 443],
  'Nginx HTTP': [80],
  'Nginx HTTPS': [443],
  OpenSSH: [22],
};

export type Verdict = 'accepte' | 'refuse' | 'bloque';

/** Une nouvelle connexion vers ce port, depuis cette adresse, passe-t-elle ? */
export function verdict(pf: Firewall, port: number, source: string): Verdict {
  if (!pf.enabled) return 'accepte';
  const r = pf.rules.find((r) => r.ports.includes(port) && (r.forEachOf === null || r.forEachOf === source));
  const action = r?.action ?? pf.incoming;
  return action === 'allow' || action === 'limit' ? 'accepte' : action === 'reject' ? 'refuse' : 'bloque';
}
