### Histoire « La Machine à remonter le temps », chapitre unique
### (src/moteur/chapitres/temps.ts) : Inès, romancière, a abîmé son
### manuscrit ; on le répare avec git. Le roman, ses versions, les messages
### des commits et les poèmes sont des textes de l'histoire : ils se
### traduisent (les identifiants des commits changent alors avec la langue).

chapitre-manuscrit = La Machine à remonter le temps
    .resume = Voyager dans les versions d’un texte avec git : log, diff, restore, add, commit, init.

# Autrice des commits (git log) : nom et adresse, au format de git
manuscrit-autrice = Inès Haddad <ines@example.org>

## Le roman d'Inès (roman.txt), chapitre par chapitre

manuscrit-roman-chapitre-1 =
    CHAPITRE 1 — LE DÉPART

    Le car de nuit quitta Marseille à vingt-deux heures.
    Yasmina serrait contre elle la lettre de sa grand-mère.
    « Va voir le phare, avait écrit Mamie Zohra. Tout y est. »
manuscrit-roman-chapitre-2 =
    CHAPITRE 2 — LA TRAVERSÉE

    Le bateau pour l'île partait à l'aube.
    Sur le pont, un vieux marin réparait un filet en chantonnant.
    Il connaissait le phare : « Personne n'y monte plus depuis 1962. »
manuscrit-roman-chapitre-3 =
    CHAPITRE 3 — LE PHARE

    La porte céda au troisième coup d'épaule.
    Tout en haut, sous la lanterne, une boîte en fer attendait.
    Dedans : des cahiers, couverts de l'écriture serrée de Zohra.
# Le chapitre 3 après le passage du chat sur le clavier : garder le titre,
# ne traduire que le titre ; les lignes de lettres restent telles quelles.
manuscrit-roman-chapitre-3-abime =
    CHAPITRE 3 — LE PHARE

    jjjjjjjjjjjjjjjjjjjjjjkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk;;;;;;;;;;;;;
    mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm

## Messages des commits d'Inès (git log)

manuscrit-commit-1 = Chapitre 1 : le départ
manuscrit-commit-2 = Chapitre 2 : la traversée
manuscrit-commit-3 = Chapitre 3 : le phare
manuscrit-commit-4 = Sauvegarde du matin

## Les poèmes (dossier poemes)

manuscrit-poeme-mer =
    La mer recoud
    les bords du monde
    avec du fil d’écume.
manuscrit-poeme-phare =
    Un œil qui tourne
    dans la nuit des marins :
    il ne dort jamais.
manuscrit-poeme-zohra =
    Ma grand-mère parlait
    trois langues et demie,
    la demie, c’était le silence.

## Fichiers

manuscrit-message-d-ines =
    Un message d'Inès, ton amie romancière :

    « Catastrophe ! Ce matin, mon chat a marché sur le clavier pendant que mon
    roman était ouvert… et j'ai enregistré sans regarder. Le chapitre 3 n'est
    plus qu'une bouillie de lettres. Et pire : j'ai fait un commit juste après !

    Heureusement, mon dossier roman est suivi par git, une machine à remonter
    le temps pour les fichiers : chaque « commit » est une photo de tous les
    fichiers, avec un message et une date. Tu peux m'aider à retrouver mon
    chapitre ? Commence par jeter un œil :

      cd roman
      cat roman.txt
      git log

    Et pendant que tu y es… mes poèmes, dans le dossier poemes, ne sont suivis
    par rien du tout. Si mon chat recommence, je perds tout. »
manuscrit-aide-git =
    AIDE-MÉMOIRE GIT (voir aussi :  man git)

      git log --oneline          l'historique, un commit par ligne (le plus récent en haut)
      git show ID                ce qu'un commit a changé
      git diff ID roman.txt      les différences entre ce commit et le fichier actuel
                                 (- : la ligne d'avant, + : la ligne de maintenant)
      git restore --source=ID roman.txt
                                 remet roman.txt comme il était dans ce commit
      git status                 ce qui a changé depuis le dernier commit
      git add roman.txt          prépare le fichier pour le prochain commit
      git commit -m "message"    prend la photo, avec un message

    Un commit se désigne par le début de son identifiant (7 caractères suffisent),
    ou par HEAD (le dernier), HEAD~1 (l'avant-dernier), HEAD~2…

    Pour commencer à suivre un dossier :  git init , puis  git add .  (le point =
    tout le dossier) et  git commit -m "…"

## Événements

manuscrit-evenement-historique =
    Quatre commits, du plus récent au plus ancien. Le dernier, « Sauvegarde du
    matin », est celui du chat. L'avant-dernier, « Chapitre 3 : le phare », date
    d'avant la catastrophe. Pour voir ce que le chat a changé : git show HEAD
manuscrit-evenement-restaure =
    Le chapitre 3 est de retour ! Le fichier a voyagé dans le temps.
    Mais pour l'instant, seule ta copie de travail est réparée : le dernier
    commit contient toujours la bouillie. Regarde git status , puis enregistre
    la version réparée :

      git add roman.txt
      git commit -m "Restaure le chapitre 3 (merci le chat)"
manuscrit-evenement-sauve =
    Commit enregistré. Remarque : on n'a rien effacé de l'histoire. Le commit
    du chat est toujours là (git log) ; on a simplement ajouté une nouvelle
    photo, réparée, par-dessus. Avec git, on ne perd presque jamais rien.

    Reste les poèmes d'Inès : dans le dossier poemes, transforme-le en dépôt
    (git init), puis prends une première photo de tous les poèmes.
manuscrit-evenement-poemes = Les trois poèmes sont désormais dans un commit : même si le chat revient, ils sont à l'abri dans l'historique.
manuscrit-evenement-fin =
    Inès te répond : « Mon chapitre ! Mes poèmes ! Tu es une magicienne, un
    magicien, enfin… une personne formidable. »

    FIN DE L'HISTOIRE « LA MACHINE À REMONTER LE TEMPS ».

    Tu sais maintenant lire l'histoire d'un dossier (git log, git show), voir
    les différences (git diff), revenir à une version (git restore) et prendre
    de nouvelles photos (git add, git commit). git a été créé en 2005 par
    Linus Torvalds, pour développer le noyau Linux. On s'en sert aussi pour des
    livres, des thèses, des sites web… comme celui que tu lis.
