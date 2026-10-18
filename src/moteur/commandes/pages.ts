// Compléments du manuel : options, exemples et renvois de chaque commande,
// ajoutés à sa définition (voir index.ts). Les options listées ici sont
// exactement celles que le jeu comprend ; une autre option donne le vrai
// message d'erreur, qui renvoie vers --help.

import type { Commande } from './index';

type Complement = Pick<Commande, 'options' | 'exemples' | 'voir'>;

export const PAGES: Record<string, Complement> = {
  ls: {
    options: {
      a: 'montre tout (all), y compris les fichiers cachés, dont le nom commence par un point, et les lieux . et ..',
      l: 'format long : type, permissions, propriétaire, groupe, taille et nom, une entrée par ligne.',
      h: 'avec -l, écrit les tailles de façon lisible (human-readable) : 1,2K, 34M, 5G.',
    },
    exemples: [
      ['ls', 'ce qu’il y a ici'],
      ['ls -a', 'tout, même ce qui est caché'],
      ['ls -l ~/souvenirs', 'les permissions du lieu souvenirs'],
    ],
    voir: ['cd', 'pwd', 'chmod'],
  },
  cd: {
    exemples: [
      ['cd Port', 'entrer dans le lieu Port'],
      ['cd ..', 'remonter d’un cran'],
      ['cd ~', 'rentrer chez soi'],
      ['cd /', 'aller à la racine'],
    ],
    voir: ['ls', 'pwd'],
  },
  pwd: { voir: ['cd'] },
  cat: { exemples: [['cat message.txt', 'afficher un fichier']], voir: ['less', 'head', 'tail', 'grep'] },
  less: { voir: ['cat', 'head', 'tail'] },
  mv: {
    exemples: [
      ['mv crabe Seau', 'déplacer crabe dans le lieu Seau'],
      ['mv brouillon.txt lettre.txt', 'renommer'],
      ['mv brouillon.txt ~/Port/lettre.txt', 'déplacer et renommer d’un coup'],
    ],
    voir: ['cp', 'rm'],
  },
  cp: {
    options: { r: 'copie un lieu entier, avec tout ce qu’il contient (récursif).' },
    exemples: [
      ['cp levain levain_2', 'faire une copie à côté'],
      ['cp ~/Marche/fromage .', 'copier ici (.) un fichier d’ailleurs'],
    ],
    voir: ['mv', 'rm'],
  },
  rm: {
    exemples: [['rm barricade', 'effacer un fichier, pour toujours']],
    voir: ['mv', 'cp'],
  },
  touch: { exemples: [['touch engrenage', 'créer un fichier vide']], voir: ['mkdir'] },
  mkdir: { exemples: [['mkdir Classe', 'créer un lieu']], voir: ['touch', 'cd'] },
  grep: {
    options: {
      i: 'ignore la différence entre majuscules et minuscules.',
      v: 'inverse la recherche : garde les lignes qui ne contiennent PAS le motif.',
      c: 'compte les lignes trouvées au lieu de les afficher.',
    },
    exemples: [
      ['grep Effaceur chronique.txt', 'les lignes qui parlent de l’Effaceur'],
      ['grep -i effaceur *', 'dans tous les fichiers d’ici, majuscule ou pas'],
      ['grep "mot de passe" journal.txt', 'un motif avec des espaces, entre guillemets'],
    ],
    voir: ['cat', 'find'],
  },
  chmod: {
    exemples: [
      ['chmod o-w souvenirs', 'retirer aux autres le droit d’écrire'],
      ['chmod 755 lieu', 'rwx pour le propriétaire, r-x pour les autres'],
    ],
    voir: ['ls', 'sudo', 'whoami'],
  },
  sudo: {
    exemples: [['sudo cat /etc/sudoers', 'lire un fichier réservé à root']],
    voir: ['whoami', 'chmod'],
  },
  whoami: { voir: ['sudo'] },
  head: { options: { n: 'nombre de lignes à afficher (10 par défaut) : head -n 3 fichier.' }, voir: ['tail', 'cat'] },
  tail: {
    options: { n: 'nombre de lignes à afficher (10 par défaut) : tail -n 3 fichier.' },
    exemples: [['tail -n 5 /var/log/syslog', 'les 5 événements les plus récents']],
    voir: ['head', 'cat'],
  },
  wc: {
    options: { l: 'compte les lignes.', w: 'compte les mots.', c: 'compte les octets.' },
    exemples: [['grep erreur journal | wc -l', 'combien de lignes contiennent « erreur » ?']],
    voir: ['grep', 'sort'],
  },
  sort: {
    options: { n: 'trie les nombres par valeur (2 avant 10).', r: 'trie à l’envers.' },
    exemples: [['sort -n tailles.txt', 'du plus petit au plus grand']],
    voir: ['uniq', 'wc'],
  },
  uniq: {
    options: { c: 'compte combien de fois chaque ligne se répète.' },
    exemples: [['sort visites | uniq -c | sort -n', 'compter les répétitions, puis trier']],
    voir: ['sort'],
  },
  tee: { options: { a: 'ajoute à la fin du fichier au lieu de l’écraser.' }, voir: ['echo'] },
  du: {
    options: { h: 'tailles lisibles : K, M, G.', s: 'un seul total par lieu (summary), sans le détail.' },
    voir: ['df', 'find'],
  },
  df: { options: { h: 'tailles lisibles : K, M, G.' }, voir: ['du'] },
  tar: {
    options: {
      c: 'crée une archive (create).',
      t: 'liste le contenu d’une archive.',
      x: 'extrait une archive (extract).',
      z: 'compresse ou décompresse avec gzip.',
      v: 'affiche les fichiers traités (verbose).',
      f: 'le nom de l’archive suit (file).',
    },
    exemples: [
      ['tar -czf sauvegarde.tar.gz Dossier', 'archiver et compresser'],
      ['tar -tzf sauvegarde.tar.gz', 'voir ce qu’il y a dedans'],
      ['tar -xzf sauvegarde.tar.gz', 'extraire'],
    ],
    voir: ['du', 'df'],
  },
  find: { voir: ['ls', 'grep', 'du'] },
  ps: { voir: ['kill', 'systemctl'] },
  kill: { voir: ['ps'] },
  systemctl: { voir: ['ps', 'sudo'] },
  ping: { voir: ['traceroute', 'dig'] },
  dig: { voir: ['ping', 'curl'] },
  traceroute: { voir: ['ping'] },
  curl: { voir: ['dig'] },
};
