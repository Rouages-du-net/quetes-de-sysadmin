### Pistas graduales de «La Biblioteca de Herramientas» (ver
### src/engine/hints.ts): un mensaje por paso, hint-<capítulo>-<evento>, con
### .lead (una pista, sin el comando exacto) y .solution (casi la respuesta).

## Capítulo 1 — Quién puede hacer push

hint-who-can-push-history =
    .lead = El repositorio desnudo guarda un reflog de main (man git: reflog); mira a dónde apuntaba main, y cuándo.
    .solution = sudo git --git-dir=/var/lib/forgejo/data/forgejo-repositories/lendshed/lendshed.git reflog --date=iso, luego git show sobre el commit del 14 de octubre
hint-who-can-push-collaborator =
    .lead = Pregunta a la forja quién colabora en el repositorio (man forgejo-api).
    .solution = curl -s -H "Authorization: token $(cat ~/.forgejo-token)" https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/collaborators | jq .
hint-who-can-push-removed =
    .lead = Un colaborador se quita con el DELETE de la API en la misma ruta, seguida del nombre.
    .solution = curl -X DELETE -H "Authorization: token $(cat ~/.forgejo-token)" https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/collaborators/tomasz
hint-who-can-push-token-dead =
    .lead = Los tokens se listan y se borran por cuenta, con autenticación básica; una administradora puede actuar como otra cuenta (Sudo). O bloquea el inicio de sesión de la cuenta, que también detiene sus tokens.
    .solution = curl -u tu:CONTRASENA -H "Sudo: tomasz" https://forge.lendshed.example/api/v1/users/tomasz/tokens, luego lo mismo con -X DELETE …/tokens/ID; o PATCH /api/v1/admin/users/tomasz con {"{"}"prohibit_login": true{"}"}
hint-who-can-push-protected =
    .lead = Una regla de protección de rama para main (POST …/branch_protections): push solo para los mantenedores, una aprobación, la comprobación de estado de la CI (busca su contexto en …/commits/main/statuses).
    .solution = curl -X POST -H "Authorization: token $(cat ~/.forgejo-token)" -H "Content-Type: application/json" -d '{"{"}"rule_name":"main","enable_push":true,"enable_push_whitelist":true,"push_whitelist_usernames":["wanjiru","rosa","tu"],"required_approvals":1,"enable_status_check":true,"status_check_contexts":["ci / test (pull_request_target)"]{"}"}' https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/branch_protections
hint-who-can-push-refused =
    .lead = Comprueba la protección igual que falló: reescribe main en tu clon y fuerza el push.
    .solution = cd ~/lendshed; git reset --hard HEAD~1; git push --force; luego git reset --hard HEAD@{"{"}1{"}"} para volver
hint-who-can-push-end =
    .lead = Colaborador, token, protección, un push forzado rechazado, y el repositorio todavía público: ¿qué falta?
    .solution = curl -s -H "Authorization: token $(cat ~/.forgejo-token)" https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/branch_protections | jq .

## Capítulo 2 — La tubería que gotea

hint-leaky-pipeline-runs =
    .lead = La forja lista las ejecuciones de Actions de un repositorio, cada job con sus registros (man forgejo-api).
    .solution = curl -s https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/actions/runs | jq '.workflow_runs[] | {"{"}index_in_repo, event, title, jobs{"}"}'
hint-leaky-pipeline-log =
    .lead = Lee el registro del job test de la pull request de Kwame.
    .solution = curl -s https://forge.lendshed.example/lendshed/lendshed/actions/runs/2/jobs/0/logs
hint-leaky-pipeline-decoded =
    .lead = Esa línea es base64 (man base64).
    .solution = copia la línea larga en un archivo, luego base64 -d ARCHIVO
hint-leaky-pipeline-workflow =
    .lead = Lee el workflow: en qué evento, qué código descarga, dónde está DEPLOY_KEY.
    .solution = cat ~/lendshed/.forgejo/workflows/ci.yml
hint-leaky-pipeline-old-key-gone =
    .lead = El authorized_keys de la cuenta deploy ya no debe aceptar la clave filtrada.
    .solution = sudo nano /home/deploy/.ssh/authorized_keys (quita la línea ci-deploy)
hint-leaky-pipeline-new-key =
    .lead = Un nuevo par de claves, su mitad pública en authorized_keys, restringida (man sshd: AUTHORIZED_KEYS FILE FORMAT; rrsync).
    .solution = ssh-keygen -t ed25519 -N "" -C ci-deploy -f ~/deploy_key; luego añade a /home/deploy/.ssh/authorized_keys: restrict,from="192.0.2.80",command="rrsync /srv/www/docs" seguido del contenido de ~/deploy_key.pub
hint-leaky-pipeline-secret =
    .lead = El secreto se sustituye con la API (PUT …/actions/secrets/DEPLOY_KEY), un cuerpo JSON {"{"}"data": …{"}"} que jq puede construir a partir del archivo.
    .solution = jq -Rs '{"{"}data: .{"}"}' < ~/deploy_key | curl -X PUT -H "Authorization: token $(cat ~/.forgejo-token)" -H "Content-Type: application/json" --data-binary @- https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/actions/secrets/DEPLOY_KEY
hint-leaky-pipeline-pushed =
    .lead = Arregla el workflow en tu clon y haz push: pull requests en pull_request, su propio checkout, nada impreso; el despliegue solo en un push a main, la clave solo en su paso.
    .solution = nano ~/lendshed/.forgejo/workflows/ci.yml; git commit -am "CI: sin secretos para las pull requests"; git push
hint-leaky-pipeline-safe =
    .lead = Mira la siguiente ejecución de Kwame: qué jobs, con qué código, ¿y se imprime algo?
    .solution = curl -s https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/actions/runs | jq '.workflow_runs[0]'
hint-leaky-pipeline-context =
    .lead = La comprobación de estado obligatoria de la protección debe nombrar lo que informan ahora las pull requests.
    .solution = curl -X PATCH -H "Authorization: token $(cat ~/.forgejo-token)" -H "Content-Type: application/json" -d '{"{"}"status_check_contexts":["ci / test (pull_request)"]{"}"}' https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/branch_protections/main
hint-leaky-pipeline-deployed =
    .lead = El despliegue se ejecuta en un push a main, con el secreto tal como esté entonces.
    .solution = git commit --allow-empty -m "Volver a desplegar con la clave nueva"; git push
hint-leaky-pipeline-end =
    .lead = Clave antigua quitada, la nueva restringida y en el secreto, la ejecución de Kwame segura y probada, la comprobación de estado al día, un despliegue con la clave nueva: ¿qué falta?
    .solution = curl -s https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/actions/runs | jq '.workflow_runs[:3]'

## Capítulo 3 — Firmado y sellado

hint-signed-release-signing =
    .lead = git firma con SSH cuando se le dice (man git: config; gpg.format, user.signingKey).
    .solution = git config --global gpg.format ssh; git config --global user.signingkey ~/.ssh/id_ed25519.pub; git config --global commit.gpgsign true
hint-signed-release-signed-commit =
    .lead = Haz el cambio de versión, firmado.
    .solution = cd ~/lendshed; nano lendshed/__init__.py (2.4.0); git commit -S -am "Release 2.4.0"
hint-signed-release-allowed =
    .lead = Un archivo allowed_signers, «dirección clave» por línea, y git avisado de dónde está (gpg.ssh.allowedSignersFile); las claves están en https://forge.lendshed.example/NOMBRE.keys.
    .solution = echo "tu@lendshed.example $(cut -d' ' -f1,2 ~/.ssh/id_ed25519.pub)" > ~/lendshed/allowed_signers (y las líneas de wanjiru y rosa); git config --global gpg.ssh.allowedSignersFile ~/lendshed/allowed_signers
hint-signed-release-verified =
    .lead = Comprueba la firma de tu commit tal como la ve git.
    .solution = git verify-commit HEAD, o git log --show-signature -1
hint-signed-release-require =
    .lead = La regla de protección de main tiene una opción para los commits firmados.
    .solution = curl -X PATCH -H "Authorization: token $(cat ~/.forgejo-token)" -H "Content-Type: application/json" -d '{"{"}"require_signed_commits":true{"}"}' https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/branch_protections/main
hint-signed-release-pushed =
    .lead = allowed_signers en un commit del repositorio, tus commits firmados, luego el push.
    .solution = git add allowed_signers; git commit -S -m "Añadir las claves de firma de los mantenedores"; git push
hint-signed-release-tag =
    .lead = Una etiqueta anotada y firmada (man git: tag -s), luego envíala.
    .solution = git tag -s v2.4.0 -m "Lendshed 2.4.0"; git verify-tag v2.4.0; git push origin v2.4.0
hint-signed-release-tarball =
    .lead = git archive hace el tarball de una etiqueta.
    .solution = git archive --format=tar.gz --prefix=lendshed-2.4.0/ -o /srv/www/downloads/lendshed-2.4.0.tar.gz v2.4.0
hint-signed-release-sums =
    .lead = El archivo de sumas de comprobación, al lado del tarball.
    .solution = cd /srv/www/downloads; sha256sum lendshed-2.4.0.tar.gz > SHA256SUMS
hint-signed-release-sig =
    .lead = Firma las sumas con tu clave, en el espacio de nombres «file» (man ssh-keygen: -Y sign).
    .solution = ssh-keygen -Y sign -f ~/.ssh/id_ed25519 -n file SHA256SUMS
hint-signed-release-sum-checked =
    .lead = Comprueba el tarball con sus sumas, como lo haría quien lo usa.
    .solution = cd /srv/www/downloads; sha256sum -c SHA256SUMS
hint-signed-release-sig-checked =
    .lead = Comprueba la firma de SHA256SUMS con allowed_signers (man ssh-keygen: -Y verify).
    .solution = ssh-keygen -Y verify -f ~/lendshed/allowed_signers -I tu@lendshed.example -n file -s SHA256SUMS.sig < SHA256SUMS
hint-signed-release-end =
    .lead = Commit firmado en main con allowed_signers, firmas obligatorias, etiqueta firmada, tarball, SHA256SUMS y su firma, las dos comprobaciones: ¿qué falta?
    .solution = ls -l /srv/www/downloads; git verify-tag v2.4.0
