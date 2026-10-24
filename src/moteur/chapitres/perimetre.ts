// Histoire « L'Audit » — chapitre « Le périmètre » : avant de balayer quoi que
// ce soit, on lit la lettre de mission : elle dit ce qu'on a le droit de sonder
// (le serveur fournil, 192.0.2.22) et ce qu'on n'a pas le droit de toucher. Le
// serveur du voisin (la pizzeria, 192.0.2.24) partage la box et paraît
// « intéressant » (une base ouverte) : il est hors périmètre. On fait
// l'inventaire du Fournil vu d'internet avec nmap, on garde la trace (-oN), et
// on rédige ses notes : ce qu'on a trouvé, et ce qu'on a repéré sans y toucher.
//   - nmap -sV fournil.internal -oN inventaire.txt : les ports ouverts et les
//     versions ; les ports 5432 (PostgreSQL) et 6379 (Redis) n'ont rien à faire là ;
//   - un balayage de tout le réseau (192.0.2.0/24) sonde le voisin : la faute.
//     Le jeu l'accepte (sans conséquence) et la raconte dans le débrief ;
//   - notes-audit.md : périmètre, constats, hors périmètre. Salomé relit à chaque
//     enregistrement et dit ce qui manque.
// Objectif vérifié sur l'état : une trace nmap -sV du Fournil gardée dans un
// fichier, des notes complétées qui nomment les ports 5432 et 6379 et la
// machine hors périmètre. Le débrief dépend de ce qui a été sondé.
// Sources : https://nmap.org/book/man.html, https://nmap.org/book/legal-issues.html

import { chemin, f, nom, type Chapitre } from '../monde';
import type { Jeu, Shell } from '../shell';
import { nouveauSystemd } from '../systemd';
import type { Balayage } from '../scan';
import { PAQUETS, INSTALLES_DE_BASE } from '../commandes/apt';
import { nomMachine } from '../machines';
import { chargerSshd, comptesFournil, sectionsMd, ecouteFournil, fichier, M, MAINTENANT, MOT_DE_PASSE, mondeFournil, scanFournil, serviceSsh, VOISIN } from './audit';

const NOTES = `${M}/notes-audit.md`;
const MODELE_NOTES = 'perimetre-notes-modele';

const balayages = (j: Jeu): Balayage[] => j.etat.scans ?? [];
const sonde = (b: Balayage) => b.adresses.includes('192.0.2.22') || b.adresses.includes('127.0.0.1');
const horsPerimetre = (j: Jeu) => balayages(j).some((b) => b.horsPerimetre.length > 0);
// Les adresses sondées hors de la lettre de mission, et si le voisin en fait partie.
const adressesHors = (j: Jeu) => [...new Set(balayages(j).flatMap((b) => b.horsPerimetre))];

// Les fichiers de la maison : le texte de chacun (la trace nmap peut avoir n'importe quel nom).
const textes = (j: Jeu): string[] => {
  const maison = j.trouver((j as Shell).maison);
  if (maison?.type !== 'dossier') return [];
  return Object.entries(maison.enfants)
    .filter(([, n]) => n.type === 'fichier')
    .map(([nom]) => j.lire(`${(j as Shell).maison}/${nom}`) ?? '');
};
const traceOk = (j: Jeu) => textes(j).some((t) => /^# Nmap .* as: nmap .*-sV/m.test(t) && t.includes(`Nmap scan report for ${nomMachine(j.t, 'fournil')}`) && /5432\/tcp/.test(t) && /6379\/tcp/.test(t));

const lireNotes = (j: Jeu) => j.lire(chemin(j.t, NOTES));
const mots = (j: Jeu, cle: string) => j.t(cle).split(',').map((m) => m.trim().toLowerCase());
const manques = (j: Jeu): string[] => {
  const brut = lireNotes(j) ?? '';
  const s = sectionsMd(j, brut, 'perimetre-section', ['perimetre', 'trouve', 'hors']);
  const trouve = (s.trouve ?? '').toLowerCase();
  const hors = (s.hors ?? '').toLowerCase();
  const m: string[] = [];
  if (brut.toLowerCase().includes(j.t('perimetre-a-completer').toLowerCase())) m.push('modele');
  if (!trouve.includes('5432') || !trouve.includes('6379')) m.push('ports');
  if (!hors.includes(VOISIN.adresse) && !hors.includes('voisin')) m.push('voisin');
  else if (!mots(j, 'perimetre-mots-hors').some((x) => hors.includes(x))) m.push('hors');
  return m;
};
const notesOk = (j: Jeu) => manques(j).length === 0;

export const perimetre: Chapitre = {
  id: 'perimetre',
  numero: 1,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'id', 'whoami', 'sudo', 'ss', 'nmap'],
  maison: M,
  accueil: 'courriel_salome.txt',
  noms: true,
  final: 'fin',
  etapes: ['lettre', 'balayage', 'trace', 'fin'],
  motDePasse: MOT_DE_PASSE,
  comptes: () => comptesFournil(true),
  etat: () => ({
    sshd: { charge: {}, connexionsAuChargement: 1, recharges: 0 },
    ecoute: ecouteFournil(),
    scan: scanFournil(),
    apt: {
      listes: true,
      installes: Object.fromEntries(INSTALLES_DE_BASE.map((p) => [p, PAQUETS[p].version])),
      mises: {},
    },
    systemd: nouveauSystemd('fournil', MAINTENANT - 5 * 86_400_000, MAINTENANT, { ssh: serviceSsh() }),
  }),
  initialiser: (j) => {
    chargerSshd(j);
    // Salomé ne relit que ce qui a changé : le modèle de départ compte comme déjà lu.
    j.etat.notesLues = lireNotes(j);
  },
  creerMonde: (t) =>
    mondeFournil(t, {
      maison: {
        'courriel_salome.txt': f(t('perimetre-courriel-salome')),
        'lettre-de-mission.txt': f(t('perimetre-lettre-de-mission'), { lignes: true }),
        'notes-audit.md': f(t(MODELE_NOTES), { lignes: true }),
      },
      sudoersD: { '90-cloud-init-users': fichier('# Created by cloud-init\n\nvous ALL=(ALL) NOPASSWD:ALL', 'root', 'r--r-----') },
    }),
  // Salomé relit les notes après chaque enregistrement.
  apresCommande: (j) => {
    const texte = lireNotes(j);
    if (texte === j.etat.notesLues || j.etat.notesFinies) return;
    j.etat.notesLues = texte;
    const reste = manques(j);
    if (!reste.length) {
      j.etat.notesFinies = true;
      return;
    }
    return [j.t('perimetre-relecture'), ...reste.map((m) => `- ${j.t(`perimetre-manque-${m}`)}`)].join('\n');
  },
  evenements: [
    {
      id: 'lettre',
      condition: (j) => j.derniere.commandes.some((c) => c.some((a) => a.endsWith(nom(j.t, 'lettre-de-mission.txt')))),
      message: (j) => j.t('perimetre-evenement-lettre'),
    },
    {
      id: 'balayage',
      condition: (j) => balayages(j).some(sonde),
      message: (j) => j.t('perimetre-evenement-balayage'),
    },
    {
      id: 'hors-perimetre',
      condition: horsPerimetre,
      message: (j) => j.t('perimetre-evenement-hors-perimetre', { adresses: adressesHors(j).join(', '), voisin: adressesHors(j).includes(VOISIN.adresse) ? 'oui' : 'non' }),
    },
    { id: 'trace', condition: traceOk, message: (j) => j.t('perimetre-evenement-trace') },
    {
      id: 'fin',
      condition: (j) => traceOk(j) && notesOk(j),
      message: (j) => j.t('perimetre-evenement-fin', { faute: horsPerimetre(j) ? 'oui' : 'non' }),
    },
  ],
};
