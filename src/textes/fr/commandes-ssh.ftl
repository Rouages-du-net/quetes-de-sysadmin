### Remarques du jeu sur ssh (les messages d'OpenSSH, eux, restent en anglais).

ssh-commande-distante = (Le jeu ne lance pas de commande à distance : connecte-toi d'abord, puis tape-la sur la machine.)
# { $machine } : le nom de la machine
ssh-enferme = (Ta clé est bonne, mais la configuration de sshd sur { $machine } refuse ton compte : tu t'es enfermé·e dehors. Sur un vrai serveur, il faudrait passer par la console de secours de l'hébergeur. Ici, le menu du jeu en tient lieu : ouvre l'histoire depuis le menu, corrige /etc/ssh/sshd_config, recharge ssh, puis reviens tester avec exit et ssh { $machine }.)
# { $machine } : le nom de la machine
ssh-pare-feu = (Le pare-feu de { $machine } bloque le port de SSH : tu t'es enfermé·e dehors. La session que tu avais n'est plus là pour corriger. Ici, le menu du jeu sert de console de secours de l'hébergeur : ouvre l'histoire depuis le menu, autorise SSH dans ufw, puis reviens tester avec ssh { $machine }.)
# { $machine } : le nom de la machine ; { $adresse } : l'adresse du poste
ssh-banni = (fail2ban, sur { $machine }, a banni l'adresse de ton poste ({ $adresse }) : tu t'es enfermé·e dehors. Ici, le menu du jeu sert de console de secours de l'hébergeur : ouvre l'histoire depuis le menu, débannis ton adresse, ajoute-la à ignoreip, puis reviens tester avec ssh { $machine }.)
