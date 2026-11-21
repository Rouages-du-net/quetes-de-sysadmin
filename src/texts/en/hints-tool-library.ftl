### Graded hints for The Tool Library (see src/engine/hints.ts): one message
### per step, hint-<chapter>-<event>, with .lead (a direction, without the
### exact command) and .solution (almost the answer).

## Chapter 1 — Who Can Push

hint-who-can-push-history =
    .lead = The bare repository keeps a reflog of main (man git: reflog); look at where main pointed, and when.
    .solution = sudo git --git-dir=/var/lib/forgejo/data/forgejo-repositories/lendshed/lendshed.git reflog --date=iso, then git show on the commit of 14 October
hint-who-can-push-collaborator =
    .lead = Ask the forge who collaborates on the repository (man forgejo-api).
    .solution = curl -s -H "Authorization: token $(cat ~/.forgejo-token)" https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/collaborators | jq .
hint-who-can-push-removed =
    .lead = A collaborator is removed with the API's DELETE on the same route, followed by the name.
    .solution = curl -X DELETE -H "Authorization: token $(cat ~/.forgejo-token)" https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/collaborators/tomasz
hint-who-can-push-token-dead =
    .lead = Tokens are listed and deleted per account, with basic authentication; an administrator may act as another account (Sudo). Or block the account from signing in, which also stops its tokens.
    .solution = curl -u you:PASSWORD -H "Sudo: tomasz" https://forge.lendshed.example/api/v1/users/tomasz/tokens, then the same with -X DELETE …/tokens/ID; or PATCH /api/v1/admin/users/tomasz with {"{"}"prohibit_login": true{"}"}
hint-who-can-push-protected =
    .lead = A branch protection rule for main (POST …/branch_protections): pushes for the maintainers only, an approval, the CI's status check (find its context in …/commits/main/statuses).
    .solution = curl -X POST -H "Authorization: token $(cat ~/.forgejo-token)" -H "Content-Type: application/json" -d '{"{"}"rule_name":"main","enable_push":true,"enable_push_whitelist":true,"push_whitelist_usernames":["wanjiru","rosa","you"],"required_approvals":1,"enable_status_check":true,"status_check_contexts":["ci / test (pull_request_target)"]{"}"}' https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/branch_protections
hint-who-can-push-refused =
    .lead = Check the protection the way it failed: rewrite main in your clone and force the push.
    .solution = cd ~/lendshed; git reset --hard HEAD~1; git push --force; then git reset --hard HEAD@{"{"}1{"}"} to come back
hint-who-can-push-end =
    .lead = Collaborator, token, protection, a refused force-push, and the repository still public: what is missing?
    .solution = curl -s -H "Authorization: token $(cat ~/.forgejo-token)" https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/branch_protections | jq .

## Chapter 2 — The Leaky Pipeline

hint-leaky-pipeline-runs =
    .lead = The forge lists a repository's Actions runs, each job with its logs (man forgejo-api).
    .solution = curl -s https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/actions/runs | jq '.workflow_runs[] | {"{"}index_in_repo, event, title, jobs{"}"}'
hint-leaky-pipeline-log =
    .lead = Read the log of the test job of Kwame's pull request.
    .solution = curl -s https://forge.lendshed.example/lendshed/lendshed/actions/runs/2/jobs/0/logs
hint-leaky-pipeline-decoded =
    .lead = That line is base64 (man base64).
    .solution = copy the long line into a file, then base64 -d FILE
hint-leaky-pipeline-workflow =
    .lead = Read the workflow: on which event, which code it checks out, where DEPLOY_KEY is.
    .solution = cat ~/lendshed/.forgejo/workflows/ci.yml
hint-leaky-pipeline-old-key-gone =
    .lead = The deploy account's authorized_keys must no longer accept the leaked key.
    .solution = sudo nano /home/deploy/.ssh/authorized_keys (remove the ci-deploy line)
hint-leaky-pipeline-new-key =
    .lead = A new key pair, its public half in authorized_keys, restricted (man sshd: AUTHORIZED_KEYS FILE FORMAT; rrsync).
    .solution = ssh-keygen -t ed25519 -N "" -C ci-deploy -f ~/deploy_key; then add to /home/deploy/.ssh/authorized_keys: restrict,from="192.0.2.80",command="rrsync /srv/www/docs" followed by the content of ~/deploy_key.pub
hint-leaky-pipeline-secret =
    .lead = The secret is replaced with the API (PUT …/actions/secrets/DEPLOY_KEY), a JSON body {"{"}"data": …{"}"} that jq can build from the file.
    .solution = jq -Rs '{"{"}data: .{"}"}' < ~/deploy_key | curl -X PUT -H "Authorization: token $(cat ~/.forgejo-token)" -H "Content-Type: application/json" --data-binary @- https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/actions/secrets/DEPLOY_KEY
hint-leaky-pipeline-pushed =
    .lead = Fix the workflow in your clone and push it: pull requests on pull_request, their own checkout, no printing; the deploy only on a push to main, the key in its step only.
    .solution = nano ~/lendshed/.forgejo/workflows/ci.yml; git commit -am "CI: no secrets for pull requests"; git push
hint-leaky-pipeline-safe =
    .lead = Look at Kwame's next run: which jobs, with which code, and is anything printed?
    .solution = curl -s https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/actions/runs | jq '.workflow_runs[0]'
hint-leaky-pipeline-context =
    .lead = The protection's required status check must name what pull requests report now.
    .solution = curl -X PATCH -H "Authorization: token $(cat ~/.forgejo-token)" -H "Content-Type: application/json" -d '{"{"}"status_check_contexts":["ci / test (pull_request)"]{"}"}' https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/branch_protections/main
hint-leaky-pipeline-deployed =
    .lead = The deploy runs on a push to main, with the secret as it is then.
    .solution = git commit --allow-empty -m "Redeploy with the new key"; git push
hint-leaky-pipeline-end =
    .lead = Old key gone, new one restricted and in the secret, Kwame's run safe and tested, the status check up to date, a deploy with the new key: what is missing?
    .solution = curl -s https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/actions/runs | jq '.workflow_runs[:3]'

## Chapter 3 — Signed and Sealed

hint-signed-release-signing =
    .lead = git signs with SSH when told so (man git: config; gpg.format, user.signingKey).
    .solution = git config --global gpg.format ssh; git config --global user.signingkey ~/.ssh/id_ed25519.pub; git config --global commit.gpgsign true
hint-signed-release-signed-commit =
    .lead = Make the version bump, signed.
    .solution = cd ~/lendshed; nano lendshed/__init__.py (2.4.0); git commit -S -am "Release 2.4.0"
hint-signed-release-allowed =
    .lead = An allowed_signers file, "address key" per line, and git told where it is (gpg.ssh.allowedSignersFile); the keys are at https://forge.lendshed.example/NAME.keys.
    .solution = echo "you@lendshed.example $(cut -d' ' -f1,2 ~/.ssh/id_ed25519.pub)" > ~/lendshed/allowed_signers (and the lines of wanjiru and rosa); git config --global gpg.ssh.allowedSignersFile ~/lendshed/allowed_signers
hint-signed-release-verified =
    .lead = Check your commit's signature as git sees it.
    .solution = git verify-commit HEAD, or git log --show-signature -1
hint-signed-release-require =
    .lead = The protection rule of main has an option for signed commits.
    .solution = curl -X PATCH -H "Authorization: token $(cat ~/.forgejo-token)" -H "Content-Type: application/json" -d '{"{"}"require_signed_commits":true{"}"}' https://forge.lendshed.example/api/v1/repos/lendshed/lendshed/branch_protections/main
hint-signed-release-pushed =
    .lead = allowed_signers committed in the repository, your commits signed, then the push.
    .solution = git add allowed_signers; git commit -S -m "Add the maintainers' signing keys"; git push
hint-signed-release-tag =
    .lead = An annotated, signed tag (man git: tag -s), then push it.
    .solution = git tag -s v2.4.0 -m "Lendshed 2.4.0"; git verify-tag v2.4.0; git push origin v2.4.0
hint-signed-release-tarball =
    .lead = git archive makes the tarball of a tag.
    .solution = git archive --format=tar.gz --prefix=lendshed-2.4.0/ -o /srv/www/downloads/lendshed-2.4.0.tar.gz v2.4.0
hint-signed-release-sums =
    .lead = The checksums file, next to the tarball.
    .solution = cd /srv/www/downloads; sha256sum lendshed-2.4.0.tar.gz > SHA256SUMS
hint-signed-release-sig =
    .lead = Sign the checksums with your key, in the "file" namespace (man ssh-keygen: -Y sign).
    .solution = ssh-keygen -Y sign -f ~/.ssh/id_ed25519 -n file SHA256SUMS
hint-signed-release-sum-checked =
    .lead = Check the tarball against its checksums, as a user would.
    .solution = cd /srv/www/downloads; sha256sum -c SHA256SUMS
hint-signed-release-sig-checked =
    .lead = Check the signature of SHA256SUMS against allowed_signers (man ssh-keygen: -Y verify).
    .solution = ssh-keygen -Y verify -f ~/lendshed/allowed_signers -I you@lendshed.example -n file -s SHA256SUMS.sig < SHA256SUMS
hint-signed-release-end =
    .lead = Signed commit on main with allowed_signers, required signatures, signed tag, tarball, SHA256SUMS and its signature, both checks: what is missing?
    .solution = ls -l /srv/www/downloads; git verify-tag v2.4.0
