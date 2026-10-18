### Interface du jeu : choix des histoires et des chapitres, terminal,
### progression. Une phrase entière par message ; variables entre { }.

histoires-titre = Histoires
# { $histoire } : titre de l'histoire
chapitres-titre = Chapitres de « { $histoire } »
chapitre-numero = Chapitre { $numero }
chapitre-titre-complet = { $histoire } — chapitre { $numero } : { $titre }
etat-histoire-terminee = ✓ Terminée
etat-chapitres-faits =
    { $faits ->
        [one] { $faits } chapitre
       *[other] { $faits } chapitres
    } sur { $total }
etat-chapitre-termine = ✓ Terminé
etat-verrouille = 🔒 Termine le chapitre précédent
bouton-suivant = Chapitre suivant →
bouton-recommencer = Recommencer ce chapitre
astuces = Astuces : Tab complète les noms, ↑ rappelle les commandes, « aide » liste celles que tu connais, « man commande » ouvre le manuel. Ta progression est gardée dans ce navigateur.
saisie-etiquette = Commande
credit = Quêtes de Sysadmin, jeu libre (GPL v3, textes CC BY-SA 4.0), inspiré de Terminus, créé au MIT par Shawn Conrad et Michele Pratusevich.
credit-lien-projet = Le projet
credit-lien-original = Terminus (en anglais)
