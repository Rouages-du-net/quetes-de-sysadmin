// Les pages du manuel, partie technique : options courtes comprises par le
// jeu, commandes d’exemple et renvois (VOIR AUSSI). Les explications sont
// dans src/textes/<langue>/manuel.ftl (man-<commande>, .option-X, .exemple-N).
// Une option absente d’ici donne le vrai message d’erreur, qui renvoie vers --help.

import type { Commande } from './index';

type Page = Pick<Commande, 'options' | 'exemples' | 'voir' | 'section'>;

export const PAGES: Record<string, Page> = {
  apropos: { voir: ['man', 'whatis'] },
  cat: { exemples: ['cat message.txt'], voir: ['less', 'head', 'tail', 'grep'] },
  cd: { exemples: ['cd Port', 'cd ..', 'cd ~', 'cd /'], voir: ['ls', 'pwd'] },
  chgrp: { options: ['R'], exemples: ['chgrp equipe-web rapport.txt', 'sudo chgrp -R equipe-web /srv/equipe'], voir: ['chown', 'chmod', 'groups'] },
  chmod: { exemples: ['chmod o-w souvenirs', 'chmod 755 lieu'], voir: ['ls', 'sudo', 'whoami'] },
  chown: { options: ['R'], exemples: ['sudo chown malo rapport.txt', 'sudo chown -R www-data:www-data /var/www'], voir: ['chgrp', 'chmod', 'id'] },
  cp: { options: ['r'], exemples: ['cp levain levain_2', 'cp ~/Marche/fromage .'], voir: ['mv', 'rm'] },
  curl: { voir: ['dig'] },
  df: { options: ['h'], voir: ['du'] },
  dig: { voir: ['ping', 'curl'] },
  du: { options: ['h', 's'], voir: ['df', 'find'] },
  find: { voir: ['ls', 'grep', 'du'] },
  grep: { options: ['i', 'v', 'c'], exemples: ['grep Effaceur chronique.txt', 'grep -i effaceur *', 'grep "mot de passe" journal.txt'], voir: ['cat', 'find'] },
  groups: { exemples: ['groups', 'groups malo'], voir: ['id', 'usermod'] },
  head: { options: ['n'], voir: ['tail', 'cat'] },
  id: { exemples: ['id', 'id malo'], voir: ['groups', 'whoami', 'usermod'] },
  journalctl: { options: ['u', 'n', 'b', 'p', 'x', 'e'], exemples: ['journalctl -u nginx', 'journalctl -xeu nginx', 'journalctl -b -p err', 'journalctl -n 20'], voir: ['systemctl'] },
  kill: { voir: ['ps'] },
  less: { voir: ['cat', 'head', 'tail'] },
  ls: { options: ['a', 'l', 'h'], exemples: ['ls', 'ls -a', 'ls -l ~/souvenirs'], voir: ['cd', 'pwd', 'chmod'] },
  man: { options: ['k'], exemples: ['man ls', 'man -k copie', 'ls --help'], voir: ['apropos', 'whatis'] },
  mkdir: { exemples: ['mkdir Classe'], voir: ['touch', 'cd'] },
  mv: { exemples: ['mv crabe Seau', 'mv brouillon.txt lettre.txt', 'mv brouillon.txt ~/Port/lettre.txt'], voir: ['cp', 'rm'] },
  exit: { voir: ['ssh'] },
  nano: { exemples: ['nano notes.txt', 'sudo nano /etc/nginx/bloques.conf'], voir: ['cat', 'sudo'] },
  ping: { voir: ['traceroute', 'dig'] },
  ps: { voir: ['kill', 'systemctl'] },
  pwd: { voir: ['cd'] },
  reboot: { section: 8, exemples: ['sudo reboot'], voir: ['systemctl'] },
  rm: { exemples: ['rm barricade'], voir: ['mv', 'cp'] },
  sort: { options: ['n', 'r'], exemples: ['sort -n tailles.txt'], voir: ['uniq', 'wc'] },
  ssh: { options: ['i', 'p'], exemples: ['ssh royaume', 'ssh -i ~/.ssh/id_royaume vous@royaume.example', 'cat ~/.ssh/config'], voir: ['exit', 'chmod'] },
  sshd: { section: 8, options: ['t', 'T', 'f'], exemples: ['sudo sshd -t', 'sudo sshd -T | grep -i password'], voir: ['sshd_config', 'ssh', 'systemctl'] },
  sshd_config: { exemples: ['sudo nano /etc/ssh/sshd_config', 'ls /etc/ssh/sshd_config.d'], voir: ['sshd', 'ssh', 'nano'] },
  sudo: { exemples: ['sudo cat /etc/sudoers'], voir: ['whoami', 'chmod'] },
  systemctl: { exemples: ['systemctl status nginx', 'systemctl --failed', 'sudo systemctl restart nginx', 'sudo systemctl enable --now nginx'], voir: ['journalctl', 'ps', 'sudo', 'reboot'] },
  tail: { options: ['n'], exemples: ['tail -n 5 /var/log/syslog'], voir: ['head', 'cat'] },
  tar: { options: ['c', 't', 'x', 'z', 'v', 'f'], exemples: ['tar -czf sauvegarde.tar.gz Dossier', 'tar -tzf sauvegarde.tar.gz', 'tar -xzf sauvegarde.tar.gz'], voir: ['du', 'df'] },
  tee: { options: ['a'], voir: ['echo'] },
  touch: { exemples: ['touch engrenage'], voir: ['mkdir'] },
  traceroute: { voir: ['ping'] },
  uniq: { options: ['c'], exemples: ['sort visites | uniq -c | sort -n'], voir: ['sort'] },
  wc: { options: ['l', 'w', 'c'], exemples: ['grep erreur journal | wc -l'], voir: ['grep', 'sort'] },
  usermod: { section: 8, options: ['a', 'G'], exemples: ['sudo usermod -aG adm malo', 'sudo usermod -G adm malo'], voir: ['id', 'groups', 'chgrp'] },
  whatis: { voir: ['man', 'apropos'] },
  whoami: { voir: ['sudo'] },
};
