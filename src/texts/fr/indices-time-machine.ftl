### Indices gradués de La Machine à remonter le temps (voir
### src/engine/hints.ts) : un message par étape, indice-<chapitre>-<événement>,
### avec .piste (une direction, sans la commande exacte) et .solution (presque
### la réponse : la commande, avec ce qu'elle fait). Les noms des lieux sont
### ceux de noms.ftl.

## Chapitre 1 — La Machine à remonter le temps

indice-manuscript-historique =
    .piste = Le dossier roman est suivi par git. Avant de réparer, regarde son histoire : la liste de ses commits (aide_git.txt, man git).
    .solution = cd roman, puis git log (ou git log --oneline : un commit par ligne).
indice-manuscript-restaure =
    .piste = L'avant-dernier commit date d'avant le passage du chat. git sait remettre un fichier tel qu'il était dans un commit donné (HEAD~1 : le commit d'avant le dernier).
    .solution = Dans roman : git restore --source=HEAD~1 roman.txt (git diff HEAD~1 roman.txt montre d'abord les dégâts).
indice-manuscript-sauve =
    .piste = Seule ta copie de travail est réparée : le dernier commit contient toujours la bouillie. Prépare le fichier pour la prochaine photo, puis prends-la.
    .solution = git add roman.txt, puis git commit -m "Restaure le chapitre 3"
indice-manuscript-poemes =
    .piste = Les poèmes ne sont suivis par rien. Fais du dossier poemes un dépôt git, puis prends une première photo de tous les poèmes.
    .solution = cd ../poemes, git init, git add . (le point : tout le dossier), puis git commit -m "Premiers poèmes"
indice-manuscript-fin =
    .piste = Il faut les deux : le roman réparé dans un nouveau commit, et les trois poèmes dans un commit de leur propre dépôt. git log, dans chaque dossier, dit où tu en es.
    .solution = Dans roman : git add roman.txt et git commit -m "…" ; dans poemes : git init, git add . et git commit -m "…"
