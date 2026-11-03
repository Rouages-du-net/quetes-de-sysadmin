### Les indices gradués de l'histoire « L'Observatoire » : une piste, puis
### presque la réponse, pour chaque étape (voir src/engine/hints.ts).

## Chapitre 1 — Grosse charge

hint-heavy-load-load =
    .lead = À quel point la machine est-elle occupée ? (man uptime : la charge moyenne ; man nproc : combien de processeurs)
    .solution = uptime donne une charge d'environ 9 ; nproc dit 2 processeurs : sept processus attendent un processeur à chaque instant.
hint-heavy-load-workers =
    .lead = Qui prend le processeur ? (man top, man ps)
    .solution = top : huit processus stack-worker de jules, chacun à 22 % environ, et la galerie (node) avec la même part.
hint-heavy-load-end =
    .lead = Baisse la priorité des workers, tous, sans les arrêter (man renice : -n, -p, -u). Puis chronomètre la galerie comme Amara.
    .solution = sudo renice -n 19 -u jules, puis curl -s -o /dev/null -w '%{"{"}time_total{"}"}\n' http://localhost:8080/

## Chapitre 2 — Le Quota

hint-quota-measure =
    .lead = Combien de processeur l'empilement prend-il ce matin, nice ou pas ? (man top, man systemd-cgtop)
    .solution = top : les huit workers à NI 19 prennent presque tout des deux processeurs ; systemd-cgtop montre stacking.service près de 200 %.
hint-quota-end =
    .lead = Nice ne plafonne pas : systemd peut limiter le temps processeur d'un service (man systemd.resource-control : CPUQuota=). 40 % de deux processeurs, c'est combien de pourcents d'UN seul ?
    .solution = sudo systemctl set-property stacking CPUQuota=80% (appliqué tout de suite, gardé sur le disque), puis systemd-cgtop.
