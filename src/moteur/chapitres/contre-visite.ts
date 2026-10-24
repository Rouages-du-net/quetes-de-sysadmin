// Histoire « L'Audit » — chapitre « La contre-visite » : les correctifs des
// parties 1 à 4 sont en place. Avant de rendre son rapport, Salomé revient
// vérifier, comme une auditrice : on refait le balayage, on passe Lynis, on
// corrige ce qui compte, on prouve, puis on écrit le rapport de clôture.
//   - nmap -sV fournil.internal : plus que 22, 80 et 443 vus d'internet ; mais
//     la version de SSH est celle d'avant la mise à jour de sécurité ;
//   - sudo lynis audit system : un avertissement (PKGS-7392, des paquets
//     vulnérables) et des suggestions de gravité inégale. Certaines se
//     corrigent ici (sshd_config, UMASK de login.defs, bannière /etc/issue),
//     d'autres demandent un vrai chantier (intégrité des fichiers, antimalware,
//     journalisation distante, auditd) : on les met au rapport avec leur
//     identifiant plutôt que de les installer à la va-vite ;
//   - sudo apt update ; sudo apt upgrade : corrige PKGS-7392 ET change la
//     version de SSH que nmap affiche (la preuve) ; sshd_config modifié demande
//     sshd -t puis reload : Lynis lit le fichier, pas le service qui tourne ;
//   - rapport-cloture.md : un résumé, les constats corrigés, les preuves
//     (l'indice Lynis et le balayage), ce qui reste à faire. Salomé relit à
//     chaque enregistrement.
// Objectif vérifié sur l'état : plus d'avertissement Lynis et un indice d'au
// moins 70, la configuration de ssh appliquée, un dernier balayage qui ne voit
// que 22, 80 et 443 avec la version de SSH à jour, un dernier audit Lynis qui
// reflète la machine, et un rapport complet qui cite l'indice et un constat
// encore ouvert.
// Sources : https://cisofy.com/documentation/lynis/, https://nmap.org/book/man.html,
// https://man.openbsd.org/sshd_config

import { chemin, d, f, type Chapitre } from '../monde';
import type { Jeu } from '../shell';
import { nouveauPareFeu, type Regle } from '../parefeu';
import { nouveauSystemd } from '../systemd';
import { autorise, lireConfig } from '../sshd';
import { misesDisponibles, type EtatApt } from '../commandes/apt';
import { constats, indice as indiceDe } from '../lynis';
import type { Balayage } from '../scan';
import { aptFournil, chargerSshd, sectionsMd, comptesFournil, ecouteFournil, fichier, M, MAINTENANT, MOT_DE_PASSE, mondeFournil, scanFournil, serviceSsh, sshd } from './audit';

const RAPPORT = `${M}/rapport-cloture.md`;
const CIBLE = 70;
const CLES_SSH = ['permitrootlogin', 'x11forwarding', 'maxauthtries', 'allowtcpforwarding', 'allowagentforwarding'];
const SECTIONS = ['resume', 'constats', 'preuves', 'reste'];
const SUJETS = ['ssh', 'compte', 'sudo', 'secret', 'reseau', 'cle'];

const LOGIN_DEFS = `# /etc/login.defs - Configuration control definitions for the login package.
MAIL_DIR        /var/mail
FAILLOG_ENAB            yes
LOG_UNKFAIL_ENAB        no
LOG_OK_LOGINS           no
UMASK           022
PASS_MAX_DAYS   99999
PASS_MIN_DAYS   0
PASS_WARN_AGE   7
ENCRYPT_METHOD  YESCRYPT`;

// Le pare-feu après « L'exposition » : SSH, 80 et 443.
const REGLES: Regle[] = [
  { action: 'allow', vers: 'OpenSSH', ports: [22], de: null },
  { action: 'allow', vers: 'Nginx Full', ports: [80, 443], de: null },
];

const apt = (j: Jeu) => j.etat.apt as EtatApt;
const balayages = (j: Jeu): Balayage[] => j.etat.scans ?? [];
const enPerimetre = (b: Balayage) => b.versions && b.horsPerimetre.length === 0 && b.adresses.includes('192.0.2.22');
const dernierBalayage = (j: Jeu) => balayages(j).filter(enPerimetre).at(-1);
const horsPerimetre = (j: Jeu) => balayages(j).some((b) => b.horsPerimetre.length > 0);
const trois = (b: Balayage | undefined) => !!b && JSON.stringify(b.ouverts['192.0.2.22']) === JSON.stringify([22, 80, 443]);
const sshAJour = (b: Balayage | undefined) => !!b && (b.produits['192.0.2.22'] ?? []).some((p) => /^OpenSSH.*\+deb13u1/.test(p));

const aJour = (j: Jeu) => misesDisponibles(apt(j)).length === 0;
const liste = (j: Jeu) => constats(j);
const avertissements = (j: Jeu) => liste(j).filter((c) => c.type === 'warning').length;
const indiceReel = (j: Jeu) => indiceDe(liste(j));
const durci = (j: Jeu) => avertissements(j) === 0 && indiceReel(j) >= CIBLE;
const lynis = (j: Jeu) => j.etat.lynis as { indice: number; ids: string[]; avertissements: number } | undefined;
const preuveLynis = (j: Jeu) => !!lynis(j) && lynis(j)!.indice === indiceReel(j) && lynis(j)!.avertissements === 0 && lynis(j)!.indice >= CIBLE;
const sshApplique = (j: Jeu) => {
  const fichierSsh = lireConfig(j).valeurs;
  return CLES_SSH.every((k) => fichierSsh[k] === sshd(j).charge[k]);
};
const sshChange = (j: Jeu) => !sshApplique(j);
const sshErreur = (j: Jeu) => lireConfig(j).erreurs.length > 0;
const entre = (j: Jeu) => autorise(sshd(j).charge, j.joueur);
const nmapOk = (j: Jeu) => {
  const b = dernierBalayage(j);
  return trois(b) && sshAJour(b);
};

const sections = (j: Jeu, texte: string) => sectionsMd(j, texte, 'contre-visite-section', SECTIONS);
const mots = (j: Jeu, cle: string) => j.t(cle).split(',').map((m) => m.trim().toLowerCase());
// Les nombres écrits juste après le mot « indice » (ou « index », « hardening »…) : « indice de durcissement 80 ».
const chiffres = (j: Jeu, texte: string) => {
  const mot = mots(j, 'contre-visite-mots-indice').map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return [...texte.matchAll(new RegExp(`(?:${mot})\\D{0,40}(\\d+)`, 'gi'))].map((x) => Number(x[1]));
};
const lireRapport = (j: Jeu) => j.lire(chemin(j.t, RAPPORT));

const manques = (j: Jeu): string[] => {
  const texte = lireRapport(j) ?? '';
  const s = sections(j, texte);
  const m: string[] = [];
  if (texte.toLowerCase().includes(j.t('contre-visite-a-completer').toLowerCase())) m.push('modele');
  if ((s.resume ?? '').trim().length < 30) m.push('resume');
  const bas = (s.constats ?? '').toLowerCase();
  if (SUJETS.filter((x) => mots(j, `contre-visite-mots-${x}`).some((w) => bas.includes(w))).length < 5) m.push('constats');
  const l = lynis(j);
  if (!l) m.push('lynis');
  else if (!chiffres(j, s.preuves ?? '').includes(l.indice) || !/443/.test(s.preuves ?? '')) m.push('preuves');
  const ids = (s.reste ?? '').match(/\b[A-Z]{3,4}-\d{4}\b/g) ?? [];
  if (!ids.some((id) => lynis(j)?.ids.includes(id))) m.push('reste');
  return m;
};
const rapportOk = (j: Jeu) => manques(j).length === 0;

export const contreVisite: Chapitre = {
  id: 'contre-visite',
  numero: 5,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'find', 'nano', 'id', 'whoami', 'sudo', 'systemctl', 'journalctl', 'sshd', 'ss', 'ufw', 'apt', 'nmap', 'lynis'],
  maison: M,
  accueil: 'courriel_salome.txt',
  noms: true,
  final: 'fin',
  etapes: ['balayage', 'lynis', 'mise-a-jour', 'durci', 'preuve-lynis', 'nmap-propre', 'fin'],
  motDePasse: MOT_DE_PASSE,
  comptes: () => comptesFournil(false),
  etat: () => ({
    sshd: { charge: {}, connexionsAuChargement: 1, recharges: 0 },
    ufw: { ...nouveauPareFeu(), actif: true, regles: REGLES.map((r) => ({ ...r })) },
    ecoute: ecouteFournil(true),
    scan: scanFournil(),
    apt: aptFournil(true),
    systemd: nouveauSystemd('fournil', MAINTENANT - 5 * 86_400_000, MAINTENANT, {
      ssh: serviceSsh(),
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
    }),
  }),
  initialiser: (j) => {
    chargerSshd(j);
    // Salomé ne relit que ce qui a changé : l'état de départ compte comme déjà lu.
    j.etat.rapportLu = lireRapport(j);
  },
  creerMonde: (t) =>
    mondeFournil(t, {
      sansLucas: true,
      maison: { 'courriel_salome.txt': f(t('contre-visite-courriel-salome')), 'rapport-cloture.md': f(t('contre-visite-modele'), { lignes: true }) },
      etc: {
        'login.defs': fichier(LOGIN_DEFS),
        issue: fichier('Debian GNU/Linux 13 \\n \\l\n'),
      },
      ssh: { 'sshd_config.d': d({ '00-durcissement.conf': fichier('PermitRootLogin no', 'root') }, undefined, { proprio: 'root' }) },
      plus: { var: d({ log: d({}, undefined, { proprio: 'root' }) }, undefined, { proprio: 'root' }) },
    }),
  // Salomé relit le rapport de clôture après chaque enregistrement.
  apresCommande: (j) => {
    const texte = lireRapport(j);
    if (texte === j.etat.rapportLu || j.etat.rapportFini) return;
    j.etat.rapportLu = texte;
    const reste = manques(j);
    if (!reste.length) {
      j.etat.rapportFini = true;
      return;
    }
    return [j.t('contre-visite-relecture'), ...reste.map((m) => `- ${j.t(`contre-visite-manque-${m}`, { cible: String(CIBLE) })}`)].join('\n');
  },
  evenements: [
    { id: 'erreur-ssh', condition: sshErreur, message: (j) => j.t('contre-visite-evenement-erreur-ssh') },
    { id: 'enferme', condition: (j) => !entre(j), message: (j) => j.t('contre-visite-evenement-enferme') },
    {
      id: 'hors-perimetre',
      condition: horsPerimetre,
      message: (j) => j.t('contre-visite-evenement-hors-perimetre'),
    },
    {
      id: 'balayage',
      condition: (j) => !!dernierBalayage(j),
      message: (j) => j.t('contre-visite-evenement-balayage', { ancienne: sshAJour(dernierBalayage(j)) ? 'non' : 'oui' }),
    },
    {
      id: 'lynis',
      condition: (j) => !!lynis(j),
      message: (j) => j.t('contre-visite-evenement-lynis', { indice: String(lynis(j)!.indice), avertissements: String(lynis(j)!.avertissements) }),
    },
    { id: 'mise-a-jour', condition: aJour, message: (j) => j.t('contre-visite-evenement-mise-a-jour') },
    {
      id: 'ssh-a-recharger',
      condition: (j) => sshChange(j) && !sshErreur(j),
      message: (j) => j.t('contre-visite-evenement-ssh-a-recharger'),
    },
    { id: 'durci', condition: (j) => durci(j) && sshApplique(j), message: (j) => j.t('contre-visite-evenement-durci', { cible: String(CIBLE) }) },
    { id: 'preuve-lynis', condition: (j) => preuveLynis(j) && sshApplique(j), message: (j) => j.t('contre-visite-evenement-preuve-lynis') },
    { id: 'nmap-propre', condition: nmapOk, message: (j) => j.t('contre-visite-evenement-nmap-propre') },
    {
      id: 'fin',
      condition: (j) => preuveLynis(j) && sshApplique(j) && nmapOk(j) && rapportOk(j),
      message: (j) => j.t('contre-visite-evenement-fin', { faute: horsPerimetre(j) ? 'oui' : 'non' }),
    },
  ],
};
