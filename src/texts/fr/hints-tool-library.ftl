### Indices gradués de L'Outilthèque (voir src/engine/hints.ts) : un message
### par étape, hint-<chapitre>-<événement>, avec .lead (une direction, sans
### la commande exacte) et .solution (presque la réponse).

## Chapitre 1 — Qui peut pousser

hint-who-can-push-history =
    .lead = Le dépôt nu garde un reflog de main (man git : reflog) ; regardez où main pointait, et quand.
    .solution = sudo git --git-dir=/var/lib/forgejo/data/forgejo-repositories/lendshed/lendshed.git reflog --date=iso, puis git show sur le commit du 14 octobre
hint-who-can-push-collaborator =
    .lead = Demandez à la forge qui collabore sur le dépôt (man forgejo-api).
    .solution = curl -s -H "Authorization: token $(cat ~/.forgejo-token)" https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/collaborators | jq .
hint-who-can-push-removed =
    .lead = Un collaborateur se retire avec un DELETE de l'API sur la même route, suivie du nom.
    .solution = curl -X DELETE -H "Authorization: token $(cat ~/.forgejo-token)" https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/collaborators/tomasz
hint-who-can-push-token-dead =
    .lead = Les jetons se listent et se suppriment par compte, en authentification basique ; un administrateur peut agir au nom d'un autre compte (Sudo). Ou interdisez la connexion au compte, ce qui arrête aussi ses jetons.
    .solution = curl -u vous:MOTDEPASSE -H "Sudo: tomasz" https://forge.lendshed.example/api/v1/users/tomasz/tokens, puis la même chose avec -X DELETE …/tokens/ID ; ou PATCH /api/v1/admin/users/tomasz avec {"{"}"prohibit_login": true{"}"}
hint-who-can-push-protected =
    .lead = Une règle de protection pour main (POST …/branch_protections) : pushs réservés aux mainteneur·ses, une approbation, le contrôle de l'intégration continue (son contexte est dans …/commits/main/statuses).
    .solution = curl -X POST -H "Authorization: token $(cat ~/.forgejo-token)" -H "Content-Type: application/json" -d '{"{"}"rule_name":"main","enable_push":true,"enable_push_whitelist":true,"push_whitelist_usernames":["wanjiru","rosa","vous"],"required_approvals":1,"enable_status_check":true,"status_check_contexts":["ci / test (pull_request_target)"]{"}"}' https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/branch_protections
hint-who-can-push-refused =
    .lead = Vérifiez la protection là où ça a cassé : réécrivez main dans votre clone et forcez le push.
    .solution = cd ~/lendshed; git reset --hard HEAD~1; git push --force ; puis git reset --hard HEAD@{"{"}1{"}"} pour revenir
hint-who-can-push-end =
    .lead = Collaborateur, jeton, protection, un push forcé refusé, et le dépôt toujours public : que manque-t-il ?
    .solution = curl -s -H "Authorization: token $(cat ~/.forgejo-token)" https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/branch_protections | jq .

## Chapitre 2 — La Chaîne qui fuit

hint-leaky-pipeline-runs =
    .lead = La forge liste les exécutions Actions d'un dépôt, chaque job avec ses journaux (man forgejo-api).
    .solution = curl -s https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/actions/runs | jq '.workflow_runs[] | {"{"}index_in_repo, event, title, jobs{"}"}'
hint-leaky-pipeline-log =
    .lead = Lisez le journal du job test de la demande de fusion de Kwame.
    .solution = curl -s https://forge.lendshed.example/lendshed/lendshed/actions/runs/2/jobs/0/logs
hint-leaky-pipeline-decoded =
    .lead = Cette ligne, c'est du base64 (man base64).
    .solution = copiez la longue ligne dans un fichier, puis base64 -d FICHIER
hint-leaky-pipeline-workflow =
    .lead = Lisez le workflow : sur quel événement, quel code il récupère, où est DEPLOY_KEY.
    .solution = cat ~/lendshed/.forgejo/workflows/ci.yml
hint-leaky-pipeline-old-key-gone =
    .lead = Les authorized_keys du compte deploy ne doivent plus accepter la clé qui a fuité.
    .solution = sudo nano /home/deploy/.ssh/authorized_keys (retirez la ligne ci-deploy)
hint-leaky-pipeline-new-key =
    .lead = Une nouvelle paire de clés, sa moitié publique dans authorized_keys, restreinte (man sshd : AUTHORIZED_KEYS FILE FORMAT ; rrsync).
    .solution = ssh-keygen -t ed25519 -N "" -C ci-deploy -f ~/deploy_key ; puis ajoutez à /home/deploy/.ssh/authorized_keys : restrict,from="192.0.2.80",command="rrsync /srv/www/docs" suivi du contenu de ~/deploy_key.pub
hint-leaky-pipeline-secret =
    .lead = Le secret se remplace avec l'API (PUT …/actions/secrets/DEPLOY_KEY), un corps JSON {"{"}"data": …{"}"} que jq sait construire à partir du fichier.
    .solution = jq -Rs '{"{"}data: .{"}"}' < ~/deploy_key | curl -X PUT -H "Authorization: token $(cat ~/.forgejo-token)" -H "Content-Type: application/json" --data-binary @- https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/actions/secrets/DEPLOY_KEY
hint-leaky-pipeline-pushed =
    .lead = Corrigez le workflow dans votre clone et poussez-le : demandes de fusion sur pull_request, leur propre code, rien d'affiché ; le déploiement seulement sur un push vers main, la clé dans sa seule étape.
    .solution = nano ~/lendshed/.forgejo/workflows/ci.yml; git commit -am "CI: no secrets for pull requests"; git push
hint-leaky-pipeline-safe =
    .lead = Regardez l'exécution suivante de Kwame : quels jobs, avec quel code, et quelque chose est-il affiché ?
    .solution = curl -s https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/actions/runs | jq '.workflow_runs[0]'
hint-leaky-pipeline-context =
    .lead = Le contrôle requis de la protection doit nommer ce que publient maintenant les demandes de fusion.
    .solution = curl -X PATCH -H "Authorization: token $(cat ~/.forgejo-token)" -H "Content-Type: application/json" -d '{"{"}"status_check_contexts":["ci / test (pull_request)"]{"}"}' https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/branch_protections/main
hint-leaky-pipeline-deployed =
    .lead = Le déploiement tourne sur un push vers main, avec le secret tel qu'il est à ce moment-là.
    .solution = git commit --allow-empty -m "Redeploy with the new key"; git push
hint-leaky-pipeline-end =
    .lead = Ancienne clé partie, nouvelle clé restreinte et dans le secret, exécution de Kwame sûre et testée, contrôle requis à jour, un déploiement avec la nouvelle clé : que manque-t-il ?
    .solution = curl -s https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/actions/runs | jq '.workflow_runs[:3]'

## Chapitre 3 — Signé et scellé

hint-signed-release-signing =
    .lead = git signe avec SSH quand on le lui dit (man git : config ; gpg.format, user.signingKey).
    .solution = git config --global gpg.format ssh; git config --global user.signingkey ~/.ssh/id_ed25519.pub; git config --global commit.gpgsign true
hint-signed-release-signed-commit =
    .lead = Faites le changement de version, signé.
    .solution = cd ~/lendshed; nano lendshed/__init__.py (2.4.0); git commit -S -am "Release 2.4.0"
hint-signed-release-allowed =
    .lead = Un fichier allowed_signers, « adresse clé » par ligne, et git informé de son emplacement (gpg.ssh.allowedSignersFile) ; les clés sont sur https://forge.lendshed.example/NOM.keys.
    .solution = echo "vous@lendshed.example $(cut -d' ' -f1,2 ~/.ssh/id_ed25519.pub)" > ~/lendshed/allowed_signers (et les lignes de wanjiru et de rosa); git config --global gpg.ssh.allowedSignersFile ~/lendshed/allowed_signers
hint-signed-release-verified =
    .lead = Vérifiez la signature de votre commit comme git la voit.
    .solution = git verify-commit HEAD, ou git log --show-signature -1
hint-signed-release-require =
    .lead = La règle de protection de main a une option pour les commits signés.
    .solution = curl -X PATCH -H "Authorization: token $(cat ~/.forgejo-token)" -H "Content-Type: application/json" -d '{"{"}"require_signed_commits":true{"}"}' https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/branch_protections/main
hint-signed-release-pushed =
    .lead = allowed_signers validé dans le dépôt, vos commits signés, puis le push.
    .solution = git add allowed_signers; git commit -S -m "Add the maintainers' signing keys"; git push
hint-signed-release-tag =
    .lead = Une étiquette annotée et signée (man git : tag -s), puis poussez-la.
    .solution = git tag -s v2.4.0 -m "Lendshed 2.4.0"; git verify-tag v2.4.0; git push origin v2.4.0
hint-signed-release-tarball =
    .lead = git archive fabrique l'archive d'une étiquette.
    .solution = git archive --format=tar.gz --prefix=lendshed-2.4.0/ -o /srv/www/downloads/lendshed-2.4.0.tar.gz v2.4.0
hint-signed-release-sums =
    .lead = Le fichier des sommes de contrôle, à côté de l'archive.
    .solution = cd /srv/www/downloads; sha256sum lendshed-2.4.0.tar.gz > SHA256SUMS
hint-signed-release-sig =
    .lead = Signez les sommes avec votre clé, dans l'espace de noms « file » (man ssh-keygen : -Y sign).
    .solution = ssh-keygen -Y sign -f ~/.ssh/id_ed25519 -n file SHA256SUMS
hint-signed-release-sum-checked =
    .lead = Vérifiez l'archive avec ses sommes, comme le ferait un·e utilisateur·rice.
    .solution = cd /srv/www/downloads; sha256sum -c SHA256SUMS
hint-signed-release-sig-checked =
    .lead = Vérifiez la signature de SHA256SUMS avec allowed_signers (man ssh-keygen : -Y verify).
    .solution = ssh-keygen -Y verify -f ~/lendshed/allowed_signers -I vous@lendshed.example -n file -s SHA256SUMS.sig < SHA256SUMS
hint-signed-release-end =
    .lead = Commit signé sur main avec allowed_signers, signatures exigées, étiquette signée, archive, SHA256SUMS et sa signature, les deux vérifications : que manque-t-il ?
    .solution = ls -l /srv/www/downloads; git verify-tag v2.4.0
