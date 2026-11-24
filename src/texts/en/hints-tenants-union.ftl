### Graded hints for The Tenants' Union (see src/engine/hints.ts): one message
### per step, hint-<chapter>-<event>, with .lead (a direction, without the
### exact command) and .solution (almost the answer).

## Chapter 1 — Out of the Open

hint-out-of-the-open-history-seen =
    .lead = Before fixing anything, see what the forge's visitors could see: every version of .env, in the repository's history (man git).
    .solution = cd /srv/repairline; git log -p
hint-out-of-the-open-key-made =
    .lead = To encrypt for yourself, you need an age key of your own, in the place sops reads it from (man sops, man age-keygen).
    .solution = mkdir -p ~/.config/sops/age; age-keygen -o ~/.config/sops/age/keys.txt
hint-out-of-the-open-rule-written =
    .lead = A .sops.yaml at the root of the repository says which files are encrypted, and for which public keys: the server's (in the README) and yours.
    .solution = nano .sops.yaml: creation_rules:, then - path_regex: \.env$ and age: SERVER_KEY,YOUR_KEY (age-keygen -y ~/.config/sops/age/keys.txt prints yours)
hint-out-of-the-open-encrypted =
    .lead = Encrypt the file in place: sops finds the rule in .sops.yaml by itself.
    .solution = sops --encrypt --in-place .env; then cat .env
hint-out-of-the-open-rotated =
    .lead = The old password is in the history for good: change it where it is checked, in PostgreSQL, as its administrator account.
    .solution = sudo -u postgres psql -c "ALTER ROLE repairline PASSWORD 'a-new-long-password'"
hint-out-of-the-open-deployed =
    .lead = Put the new password in the encrypted .env with sops, then make deploy.sh decrypt .env with the server's key, and run it.
    .solution = sops set .env '["DB_PASSWORD"]' '"a-new-long-password"'; in deploy.sh: export SOPS_AGE_KEY_FILE=/etc/repairline/age.key and sops --decrypt .env > /etc/repairline/env; sudo ./deploy.sh
hint-out-of-the-open-committed =
    .lead = Commit what the others need: the encrypted .env, .sops.yaml and deploy.sh. Never the password in clear.
    .solution = git add .env .sops.yaml deploy.sh; git commit -m "Encrypt .env with sops and age"
hint-out-of-the-open-pushed =
    .lead = The volunteers clone from origin.
    .solution = git push
hint-out-of-the-open-end =
    .lead = Check each part: the app runs, the deployed settings are root's only, .env is encrypted for the server and for you, origin has the same.
    .solution = systemctl status repairline; ls -l /etc/repairline/env; sops -d .env; git log --stat -1; git status

## Chapter 2 — Keys Change Hands

hint-keys-change-hands-config-updated =
    .lead = Who gets new files is decided by .sops.yaml: put Ikenna's public key in (from his message), take Makoa's out.
    .solution = nano .sops.yaml: replace Makoa's age1… with Ikenna's
hint-keys-change-hands-keys-updated =
    .lead = The files already encrypted don't follow the rule by themselves: sops can bring each one in line with it (man sops).
    .solution = sops updatekeys .env, answer y; sops updatekeys mail.env, answer y
hint-keys-change-hands-data-rotated =
    .lead = Makoa's key could open the data key of both files: that key must change too.
    .solution = sops rotate --in-place .env; sops rotate --in-place mail.env
hint-keys-change-hands-rotated =
    .lead = Makoa read the database password when he deployed: change it in PostgreSQL.
    .solution = sudo -u postgres psql -c "ALTER ROLE repairline PASSWORD 'another-long-password'"
hint-keys-change-hands-deployed =
    .lead = The new password goes in the encrypted .env, without ever leaving sops, then the deploy.
    .solution = sops edit .env (or sops set .env '["DB_PASSWORD"]' '"another-long-password"'); sudo /srv/repairline/deploy.sh
hint-keys-change-hands-committed =
    .lead = Commit the rule and both files.
    .solution = git add .sops.yaml .env mail.env; git commit -m "Ikenna in, Makoa out, new keys"
hint-keys-change-hands-pushed =
    .lead = Ikenna will clone from origin.
    .solution = git push
hint-keys-change-hands-end =
    .lead = Check that Makoa's key is gone everywhere, and that your own key never left your keys.txt.
    .solution = grep age1 .sops.yaml; sops filestatus .env; systemctl status repairline; ls -l ~/.config/sops/age/keys.txt
