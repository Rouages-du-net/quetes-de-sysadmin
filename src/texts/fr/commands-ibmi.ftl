### IBM i (Le carnet de commandes) : ce que le jeu ajoute à la session 5250,
### qui n'a pas de touches de fonction. Les écrans et les messages du système
### restent en anglais, comme le système.

# Une longue liste : les lignes laissées de côté entre les premières et les dernières. { $count } : combien.
ibmi-skipped = {"  "}… { $count } lignes de plus (sur un vrai écran 5250 : Page suivante) …
# Sous DSPMSG, quand une demande attend une réponse.
ibmi-reply-tip = Tapez la réponse (une des valeurs entre parenthèses), ? pour lire l'aide du message (F1 sur un vrai écran), ou Entrée pour la laisser sans réponse.
# Après l'ouverture de session.
ibmi-signon-tip = Tapez les commandes CL après ===> (WRKACTJOB, DSPMSG QSYSOPR…). CMD ? affiche l'aide d'une commande (F1/F4 sur un vrai écran). SIGNOFF, ou 90, ferme la session.
# Un numéro de menu autre que 90.
ibmi-menu-option = Les menus ne sont pas simulés : tapez les commandes CL après ===> (WRKACTJOB, DSPMSG QSYSOPR, WRKSPLF…), ou SIGNOFF pour partir.
