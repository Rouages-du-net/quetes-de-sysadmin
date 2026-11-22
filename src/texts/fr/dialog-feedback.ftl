### La fenêtre de « Signaler un problème ou une idée » (src/engine/feedback.ts),
### chargée à sa première ouverture (src/texts/plugin.mjs : dialog-*.ftl).
### Ses boutons sont dans feedback.ftl.

feedback-title = Signaler un problème ou une idée
feedback-intro = Le jeu n'envoie rien tout seul. Écris ton message, coche ce qui peut nous aider à le comprendre, vérifie le texte plus bas, puis envoie-le toi-même.

## Le type de signalement (un groupe de choix)
feedback-kind-legend = De quoi s'agit-il ?
feedback-kind-bug = Une commande qui se comporte mal
feedback-kind-text = Un texte ou un indice pas clair
feedback-kind-idea = Une idée
feedback-kind-other = Autre chose

## Le message
feedback-message-label = Ton message
feedback-message-help = Ce qui s'est passé, ce que tu attendais, ou ton idée. N'écris rien de personnel : le signalement peut devenir public.

## Ce qu'il faut inclure (chaque case montre exactement ce qu'elle ajoute)
feedback-parts-legend = Ce qu'il faut inclure
feedback-parts-help = Chaque case montre exactement ce qu'elle ajoute au signalement.
feedback-part-version = La version du jeu
feedback-part-language = La langue
feedback-part-chapter = Où tu en es (histoire, chapitre, machine, dossier, événements atteints)
feedback-part-commands = Tes dernières commandes dans ce chapitre et leurs réponses
feedback-part-browser = Ton navigateur et la taille de l'écran
feedback-part-settings = Tes réglages d'affichage
feedback-part-notebook = Les commandes de ton carnet
feedback-commands-help = Tu peux modifier ou effacer des lignes ci-dessous avant d'envoyer. Les mots de passe tapés ne sont jamais inclus. Les commandes peuvent dévoiler la solution du chapitre à qui lira l'issue.
feedback-commands-label = Les commandes qui seront incluses
feedback-commands-none = Aucune commande tapée dans ce chapitre pour l'instant.
feedback-commands-exam = Pas en mode examen : les commandes d'une épreuve restent dans le jeu.
feedback-never = Jamais inclus : ton code de progression, ta sauvegarde, ton nom, ni rien que tu n'as pas coché.

## L'aperçu et l'envoi
feedback-preview = Le texte exact du signalement
feedback-send = Envoie-le toi-même
feedback-github = Ouvrir une issue GitHub
feedback-github-help = Une issue GitHub est publique, et il faut un compte GitHub pour la créer. Le lien ouvre le formulaire de GitHub dans un nouvel onglet, déjà rempli ; rien n'est envoyé tant que tu ne le valides pas là-bas.
feedback-new-tab = (s'ouvre dans un nouvel onglet)
feedback-copy = Copier le texte
feedback-copy-help = Ou copie le texte et colle-le où tu veux.
feedback-copied = Le texte est copié.
feedback-copy-selected = Le texte est sélectionné : appuie sur Ctrl+C (ou ⌘+C) pour le copier.
feedback-link-truncated =
    { $count ->
        [one] Le signalement est trop long pour un lien : le formulaire de GitHub le reçoit sans la plus ancienne ligne de commandes. Copie le texte et colle-le dans l'issue pour tout donner.
       *[other] Le signalement est trop long pour un lien : le formulaire de GitHub le reçoit sans les { $count } plus anciennes lignes de commandes. Copie le texte et colle-le dans l'issue pour tout donner.
    }
feedback-link-message-cut = Le signalement est trop long pour un lien : le formulaire de GitHub reçoit ton message coupé. Copie le texte et colle-le dans l'issue pour tout donner.
feedback-close = Fermer

## Dans le signalement lui-même (les titres ; les libellés dessous restent en anglais)
feedback-heading-kind = Type
feedback-heading-message = Message
feedback-heading-context = Contexte
feedback-heading-commands = Dernières commandes
feedback-no-message = (pas de message)
feedback-redacted = [code de progression retiré]
feedback-output-cut =
    { $count ->
        [one] [… encore une ligne]
       *[other] [… encore { $count } lignes]
    }
feedback-truncated =
    { $count ->
        [one] (La plus ancienne ligne a été retirée pour tenir dans le lien.)
       *[other] (Les { $count } plus anciennes lignes ont été retirées pour tenir dans le lien.)
    }
feedback-message-cut = (Le message a été coupé pour tenir dans le lien.)
