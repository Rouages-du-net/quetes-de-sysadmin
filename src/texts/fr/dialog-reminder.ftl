### La fenêtre du rappel quotidien (src/engine/reminder.ts), chargée à sa
### première ouverture (src/texts/plugin.mjs : dialog-*.ftl). Son bouton est
### dans interface.ftl.

reminder-title = Un rappel quotidien dans ton agenda
reminder-intro = Choisis une heure : le jeu prépare un fichier d'agenda (.ics) avec un évènement chaque jour à cette heure, et une alerte. Ouvre le fichier avec ton application d'agenda, sur ton téléphone ou ton ordinateur, pour l'ajouter.
reminder-time = Heure du rappel
reminder-download = Télécharger le fichier d'agenda
reminder-floating = L'heure reste la même où que tu sois, et aux changements d'heure.
reminder-private = Rien n'est envoyé nulle part : le fichier est fabriqué dans ton navigateur, et seule ton application d'agenda le garde. Pour arrêter les rappels, supprime l'évènement de ton agenda.
reminder-ready = Fichier téléchargé : ouvre-le pour ajouter le rappel à ton agenda.
reminder-invalid = Choisis une heure, par exemple 18:30.
reminder-close = Fermer
# Le nom du fichier téléchargé.
reminder-file = rappel-quetes-de-sysadmin.ics
# L'évènement dans l'agenda. { $url } : l'adresse du jeu.
reminder-event-title = Quêtes de Sysadmin : l'incident du jour
reminder-event-description = Quelques minutes d'astreinte : l'incident du jour t'attend. { $url }
reminder-event-alarm = C'est l'heure de l'incident du jour
