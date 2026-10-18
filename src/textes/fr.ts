// Textes de l'interface, en français (langue de référence). Chaque langue a
// son fichier avec les mêmes clés. Une phrase entière par clé ; les
// variables sont nommées entre accolades. Les textes des histoires et des
// commandes sont encore dans src/moteur/ : voir docs/ROADMAP.md (phase 0).

export const fr = {
  'histoires.titre': 'Histoires',
  'chapitres.titre': 'Chapitres de « {histoire} »',
  'chapitre.numero': 'Chapitre {numero}',
  'chapitre.titre': '{histoire} — chapitre {numero} : {titre}',
  'etat.histoireTerminee': '✓ Terminée',
  'etat.chapitresFaits': '{faits, plural, one {# chapitre} other {# chapitres}} sur {total}',
  'etat.chapitreTermine': '✓ Terminé',
  'etat.verrouille': '🔒 Termine le chapitre précédent',
  'bouton.suivant': 'Chapitre suivant →',
  'bouton.recommencer': 'Recommencer ce chapitre',
  'astuces':
    'Astuces : Tab complète les noms, ↑ rappelle les commandes, « aide » liste celles que tu connais, « man commande » ouvre le manuel. Ta progression est gardée dans ce navigateur.',
  'saisie.etiquette': 'Commande',
  'credit':
    'Quêtes de Sysadmin, jeu libre (GPL v3, textes CC BY-SA 4.0), inspiré de Terminus, créé au MIT par Shawn Conrad et Michele Pratusevich.',
  'credit.lienProjet': 'Le projet',
  'credit.lienOriginal': 'Terminus (en anglais)',
} as const;

export type Cle = keyof typeof fr;
