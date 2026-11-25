### Graded hints for The Tool Library (see src/engine/hints.ts): one message
### per step, hint-<chapter>-<event>, with .lead (a direction, without the
### exact command) and .solution (almost the answer).


## Chapter 1 — Who Can Push

hint-who-can-push-history =
    .lead = Das Bare-Repository führt ein Reflog von main (man git: reflog); schau, wohin main gezeigt hat, und wann.
    .solution = sudo git --git-dir=/var/lib/forgejo/data/forgejo-repositories/lendshed/lendshed.git reflog --date=iso, dann git show auf den Commit vom 14. Oktober
hint-who-can-push-collaborator =
    .lead = Frag die Forge, wer am Repository mitarbeitet (man forgejo-api).
    .solution = curl -s -H "Authorization: token $(cat ~/.forgejo-token)" https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/collaborators | jq .
hint-who-can-push-removed =
    .lead = Ein Collaborator wird mit einem DELETE der API auf dieselbe Route entfernt, gefolgt vom Namen.
    .solution = curl -X DELETE -H "Authorization: token $(cat ~/.forgejo-token)" https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/collaborators/tomasz
hint-who-can-push-token-dead =
    .lead = Tokens werden pro Konto aufgelistet und gelöscht, mit Basic-Authentifizierung; ein Admin darf als ein anderes Konto handeln (Sudo). Oder sperr die Anmeldung des Kontos, was auch seine Tokens stoppt.
    .solution = curl -u du:PASSWORT -H "Sudo: tomasz" https://forge.lendshed.example/api/v1/users/tomasz/tokens, dann dasselbe mit -X DELETE …/tokens/ID; oder PATCH /api/v1/admin/users/tomasz mit { "{" }"prohibit_login": true{ "}" }
hint-who-can-push-protected =
    .lead = Eine Schutzregel für den Branch main (POST …/branch_protections): Pushes nur für die Maintainer, eine Freigabe, der Status-Check der CI (seinen Kontext findest du in …/commits/main/statuses).
    .solution = curl -X POST -H "Authorization: token $(cat ~/.forgejo-token)" -H "Content-Type: application/json" -d '{ "{" }"rule_name":"main","enable_push":true,"enable_push_whitelist":true,"push_whitelist_usernames":["wanjiru","rosa","du"],"required_approvals":1,"enable_status_check":true,"status_check_contexts":["ci / test (pull_request_target)"]{ "}" }' https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/branch_protections
hint-who-can-push-refused =
    .lead = Prüfe den Schutz so, wie es gescheitert ist: schreib main in deinem Klon um und erzwinge den Push.
    .solution = cd ~/lendshed; git reset --hard HEAD~1; git push --force; dann git reset --hard HEAD@{ "{" }1{ "}" }, um zurückzukehren
hint-who-can-push-end =
    .lead = Collaborator, Token, Schutz, ein abgelehnter Force-Push, und das Repository noch öffentlich: was fehlt?
    .solution = curl -s -H "Authorization: token $(cat ~/.forgejo-token)" https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/branch_protections | jq .

## Chapter 2 — The Leaky Pipeline

hint-leaky-pipeline-runs =
    .lead = Die Forge listet die Actions-Läufe eines Repositorys, jeden Job mit seinen Logs (man forgejo-api).
    .solution = curl -s https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/actions/runs | jq '.workflow_runs[] | { "{" }index_in_repo, event, title, jobs{ "}" }'
hint-leaky-pipeline-log =
    .lead = Lies das Log des Test-Jobs von Kwames Pull Request.
    .solution = curl -s https://forge.lendshed.example/lendshed/lendshed/actions/runs/2/jobs/0/logs
hint-leaky-pipeline-decoded =
    .lead = Diese Zeile ist base64 (man base64).
    .solution = die lange Zeile in eine Datei kopieren, dann base64 -d DATEI
hint-leaky-pipeline-workflow =
    .lead = Lies den Workflow: auf welchem Event, welchen Code er auscheckt, wo DEPLOY_KEY steht.
    .solution = cat ~/lendshed/.forgejo/workflows/ci.yml
hint-leaky-pipeline-old-key-gone =
    .lead = Die authorized_keys des Kontos deploy dürfen den geleakten Schlüssel nicht mehr annehmen.
    .solution = sudo nano /home/deploy/.ssh/authorized_keys (die Zeile ci-deploy entfernen)
hint-leaky-pipeline-new-key =
    .lead = Ein neues Schlüsselpaar, seine öffentliche Hälfte in authorized_keys, eingeschränkt (man sshd: AUTHORIZED_KEYS FILE FORMAT; rrsync).
    .solution = ssh-keygen -t ed25519 -N "" -C ci-deploy -f ~/deploy_key; dann in /home/deploy/.ssh/authorized_keys hinzufügen: restrict,from="192.0.2.80",command="rrsync /srv/www/docs" gefolgt vom Inhalt von ~/deploy_key.pub
hint-leaky-pipeline-secret =
    .lead = Das Secret wird über die API ersetzt (PUT …/actions/secrets/DEPLOY_KEY), ein JSON-Body { "{" }"data": …{ "}" }, den jq aus der Datei bauen kann.
    .solution = jq -Rs '{ "{" }data: .{ "}" }' < ~/deploy_key | curl -X PUT -H "Authorization: token $(cat ~/.forgejo-token)" -H "Content-Type: application/json" --data-binary @- https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/actions/secrets/DEPLOY_KEY
hint-leaky-pipeline-pushed =
    .lead = Repariere den Workflow in deinem Klon und pushe ihn: Pull Requests auf pull_request, ihr eigener Checkout, keine Ausgabe; das Deployment nur bei einem Push auf main, der Schlüssel nur in seinem Schritt.
    .solution = nano ~/lendshed/.forgejo/workflows/ci.yml; git commit -am "CI: keine Secrets fuer Pull Requests"; git push
hint-leaky-pipeline-safe =
    .lead = Schau dir Kwames nächsten Lauf an: welche Jobs, mit welchem Code, und wird etwas ausgegeben?
    .solution = curl -s https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/actions/runs | jq '.workflow_runs[0]'
hint-leaky-pipeline-context =
    .lead = Der verlangte Status-Check des Schutzes muss nennen, was Pull Requests jetzt melden.
    .solution = curl -X PATCH -H "Authorization: token $(cat ~/.forgejo-token)" -H "Content-Type: application/json" -d '{ "{" }"status_check_contexts":["ci / test (pull_request)"]{ "}" }' https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/branch_protections/main
hint-leaky-pipeline-deployed =
    .lead = Das Deployment läuft bei einem Push auf main, mit dem Secret, wie es dann ist.
    .solution = git commit --allow-empty -m "Neues Deployment mit dem neuen Schluessel"; git push
hint-leaky-pipeline-end =
    .lead = Alter Schlüssel weg, neuer eingeschränkt und im Secret, Kwames Lauf sicher und getestet, der Status-Check aktuell, ein Deployment mit dem neuen Schlüssel: was fehlt?
    .solution = curl -s https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/actions/runs | jq '.workflow_runs[:3]'

## Chapter 3 — Signed and Sealed

hint-signed-release-signing =
    .lead = git signiert mit SSH, wenn man es ihm sagt (man git: config; gpg.format, user.signingKey).
    .solution = git config --global gpg.format ssh; git config --global user.signingkey ~/.ssh/id_ed25519.pub; git config --global commit.gpgsign true
hint-signed-release-signed-commit =
    .lead = Mach die Versionserhöhung, signiert.
    .solution = cd ~/lendshed; nano lendshed/__init__.py (2.4.0); git commit -S -am "Release 2.4.0"
hint-signed-release-allowed =
    .lead = Eine Datei allowed_signers, „Adresse Schlüssel“ pro Zeile, und git gesagt, wo sie liegt (gpg.ssh.allowedSignersFile); die Schlüssel stehen unter https://forge.lendshed.example/NAME.keys.
    .solution = echo "du@lendshed.example $(cut -d' ' -f1,2 ~/.ssh/id_ed25519.pub)" > ~/lendshed/allowed_signers (und die Zeilen von wanjiru und rosa); git config --global gpg.ssh.allowedSignersFile ~/lendshed/allowed_signers
hint-signed-release-verified =
    .lead = Prüfe die Signatur deines Commits, so wie git sie sieht.
    .solution = git verify-commit HEAD, oder git log --show-signature -1
hint-signed-release-require =
    .lead = Die Schutzregel von main hat eine Option für signierte Commits.
    .solution = curl -X PATCH -H "Authorization: token $(cat ~/.forgejo-token)" -H "Content-Type: application/json" -d '{ "{" }"require_signed_commits":true{ "}" }' https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/branch_protections/main
hint-signed-release-pushed =
    .lead = allowed_signers im Repository committet, deine Commits signiert, dann der Push.
    .solution = git add allowed_signers; git commit -S -m "Signaturschluessel der Maintainer"; git push
hint-signed-release-tag =
    .lead = Ein annotierter, signierter Tag (man git: tag -s), dann pushen.
    .solution = git tag -s v2.4.0 -m "Lendshed 2.4.0"; git verify-tag v2.4.0; git push origin v2.4.0
hint-signed-release-tarball =
    .lead = git archive macht den Tarball eines Tags.
    .solution = git archive --format=tar.gz --prefix=lendshed-2.4.0/ -o /srv/www/downloads/lendshed-2.4.0.tar.gz v2.4.0
hint-signed-release-sums =
    .lead = Die Prüfsummendatei, neben dem Tarball.
    .solution = cd /srv/www/downloads; sha256sum lendshed-2.4.0.tar.gz > SHA256SUMS
hint-signed-release-sig =
    .lead = Signiere die Prüfsummen mit deinem Schlüssel, im Namespace „file“ (man ssh-keygen: -Y sign).
    .solution = ssh-keygen -Y sign -f ~/.ssh/id_ed25519 -n file SHA256SUMS
hint-signed-release-sum-checked =
    .lead = Prüfe den Tarball gegen seine Prüfsummen, so wie ein Benutzer es täte.
    .solution = cd /srv/www/downloads; sha256sum -c SHA256SUMS
hint-signed-release-sig-checked =
    .lead = Prüfe die Signatur von SHA256SUMS gegen allowed_signers (man ssh-keygen: -Y verify).
    .solution = ssh-keygen -Y verify -f ~/lendshed/allowed_signers -I du@lendshed.example -n file -s SHA256SUMS.sig < SHA256SUMS
hint-signed-release-end =
    .lead = Signierter Commit auf main mit allowed_signers, verlangte Signaturen, signierter Tag, Tarball, SHA256SUMS und seine Signatur, beide Prüfungen: was fehlt?
    .solution = ls -l /srv/www/downloads; git verify-tag v2.4.0
