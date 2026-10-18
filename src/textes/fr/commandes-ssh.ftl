### Remarques du jeu sur ssh (les messages d'OpenSSH, eux, restent en anglais).

ssh-commande-distante = (Le jeu ne lance pas de commande à distance : connecte-toi d'abord, puis tape-la sur la machine.)
# { $machine } : le nom de la machine
ssh-enferme = (Ta clé est bonne, mais la configuration de sshd sur { $machine } refuse ton compte : tu t'es enfermé·e dehors. Sur un vrai serveur, il faudrait passer par la console de secours de l'hébergeur. Ici, le menu du jeu en tient lieu : ouvre l'histoire depuis le menu, corrige /etc/ssh/sshd_config, recharge ssh, puis reviens tester avec exit et ssh { $machine }.)
