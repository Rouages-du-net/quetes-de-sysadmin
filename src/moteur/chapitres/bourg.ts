// Chapitre 2 — Le Bourg : grep, rm, touch, cp, mkdir. Notre propre histoire
// et nos propres énigmes, dans la suite de L'Île du Phare.

import { chemin, d, f, nom, type Chapitre } from '../monde';
import type { Jeu } from '../shell';

const M = '/Quai';
const BOULANGERIE = `${M}/Boulangerie`;
const ATELIER = `${M}/Atelier`;
const RUELLE = `${M}/Ruelle`;
const COUR = `${RUELLE}/Cour`;
const EGOUT = `${COUR}/Egout`;
const CLASSE = `${M}/Ecole/Classe`;

// Les engrenages de l'Atelier (engrenage, engrenage_2…), sous leur nom dans la langue.
const engrenages = (j: Jeu) => j.compter(chemin(j.t, ATELIER), nom(j.t, 'engrenage'));

// Un avis : une phrase par ligne (grep les lit ligne par ligne).
const affiche = (texte: string) => f(texte, { lignes: true });

export const bourg: Chapitre = {
  id: 'bourg',
  numero: 2,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'mv', 'grep', 'rm', 'touch', 'cp', 'mkdir'],
  maison: M,
  noms: true,
  accueil: 'crieur.txt',
  final: 'nour',
  creerMonde: (t) =>
    d({
      Quai: d({
        'crieur.txt': f(t('bourg-crieur')),
        'parchemin_des_sorts.txt': f(t('bourg-parchemin-des-sorts')),
        Marche: d({
          'marchande.txt': f(t('bourg-marchande')),
          'pomme': f(t('bourg-pomme')),
          'pomme_2': f(t('bourg-pomme-2')),
          'fromage': f(t('bourg-fromage'), {
            protege: { rm: t('bourg-fromage-protege-rm') },
          }),
        }),
        Boulangerie: d({
          'boulanger.txt': f(t('bourg-boulanger')),
          'levain': f(t('bourg-levain'), {
            protege: { rm: t('bourg-levain-protege-rm') },
          }),
        }),
        Atelier: d({
          'artisane.txt': f(t('bourg-artisane')),
        }),
        Ecole: d({
          'institutrice.txt': f(t('bourg-institutrice')),
        }),
        Mairie: d({
          'greffiere.txt': f(t('bourg-greffiere')),
          'avis_bal.txt': affiche(t('bourg-avis-bal')),
          'avis_chat.txt': affiche(t('bourg-avis-chat')),
          'avis_egouts.txt': affiche(t('bourg-avis-egouts')),
          'avis_marche.txt': affiche(t('bourg-avis-marche')),
          'avis_horloge.txt': affiche(t('bourg-avis-horloge')),
          '.paillasson': f(t('bourg-paillasson'), {
            lu: (j) => {
              j.drapeaux.add('cle-archives');
              return j.t('bourg-paillasson-lu');
            },
          }),
          Archives: d(
            {
              'archiviste.txt': f(t('bourg-archiviste')),
              'chronique.txt': f(t('bourg-chronique'), { lignes: true }),
            },
            (jeu) => (jeu.drapeaux.has('cle-archives') ? null : jeu.t('bourg-archives-bloque')),
          ),
        }),
        Ruelle: d(
          {
            'barricade': f(t('bourg-barricade'), {
              protege: { mv: t('bourg-barricade-protege-mv') },
            }),
            Cour: d(
              {
                'mur.txt': f(t('bourg-mur')),
                Egout: d(
                  {
                    'rats.txt': f(t('bourg-rats')),
                    Galerie: d(
                      {
                        'nour.txt': f(t('bourg-nour'), {
                          lu: (j) => {
                            j.drapeaux.add('nour-lue');
                          },
                        }),
                      },
                      (jeu) => (jeu.existe(chemin(jeu.t, `${EGOUT}/rats.txt`)) ? jeu.t('bourg-galerie-bloque') : null),
                    ),
                  },
                ),
              },
              (jeu) => (jeu.existe(chemin(jeu.t, `${RUELLE}/barricade`)) ? jeu.t('bourg-cour-bloque') : null),
            ),
          },
          (jeu) =>
            engrenages(jeu) >= 5 ? null : jeu.t('bourg-ruelle-bloque'),
        ),
      }),
    }),
  evenements: [
    {
      id: 'levain',
      condition: (j) => j.compter(chemin(j.t, BOULANGERIE), nom(j.t, 'levain')) >= 3,
      message: (j) => j.t('bourg-evenement-levain'),
    },
    {
      id: 'engrenage',
      condition: (j) => engrenages(j) >= 1,
      message: (j) => j.t('bourg-evenement-engrenage'),
    },
    {
      id: 'engrenages',
      condition: (j) => engrenages(j) >= 5,
      message: (j) => j.t('bourg-evenement-engrenages'),
    },
    {
      id: 'classe',
      condition: (j) => j.trouver(chemin(j.t, CLASSE))?.type === 'dossier',
      message: (j) =>
        j.drapeaux.has('nour-lue')
          ? j.t('bourg-evenement-classe')
          : j.t('bourg-evenement-classe-sans-nour'),
    },
    {
      id: 'barricade',
      condition: (j) => !j.existe(chemin(j.t, `${RUELLE}/barricade`)),
      message: (j) => j.t('bourg-evenement-barricade'),
    },
    {
      id: 'rats',
      condition: (j) => j.existe(chemin(j.t, `${EGOUT}/fromage`)),
      action: (j) => {
        j.effacer(chemin(j.t, `${EGOUT}/rats.txt`));
        j.effacer(chemin(j.t, `${EGOUT}/fromage`));
      },
      message: (j) => j.t('bourg-evenement-rats'),
    },
    {
      id: 'nour-sans-classe',
      condition: (j) => j.drapeaux.has('nour-lue') && j.trouver(chemin(j.t, CLASSE))?.type !== 'dossier',
      message: (j) => j.t('bourg-evenement-nour-sans-classe'),
    },
    {
      id: 'nour',
      condition: (j) => j.drapeaux.has('nour-lue') && j.trouver(chemin(j.t, CLASSE))?.type === 'dossier',
      message: (j) => j.t('bourg-evenement-nour'),
    },
  ],
};
