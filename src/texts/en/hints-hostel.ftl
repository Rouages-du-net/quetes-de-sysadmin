### Graded hints for The Hostel (see src/engine/hints.ts): one message per
### step, hint-<chapter>-<event>, with .lead (a direction, without the exact
### command) and .solution (almost the answer).

## Chapter 1 — Sealed

hint-sealed-status =
    .lead = Ask OpenBao itself what state it is in, before touching anything (man bao).
    .solution = bao status
hint-sealed-first-share =
    .lead = A sealed server waits for its key shares, one command per share. Where is your own share?
    .solution = bao operator unseal, then paste the share from /media/usb/unseal-share-3.txt at the prompt
hint-sealed-unsealed =
    .lead = Three different shares are needed. Which of the four you were given can you trust?
    .solution = bao operator unseal with Hiroko's share, then with Nnamdi's (not Desta's blurred one); bao status: Sealed false
hint-sealed-restarted =
    .lead = The vault is open, but is the booking site running? Ask systemd, and read its journal.
    .solution = systemctl status bunks; journalctl -u bunks; sudo systemctl restart bunks
hint-sealed-checked =
    .lead = Check that Bunks really answers (Ruslan's notes mention a health page on port 8080).
    .solution = curl http://127.0.0.1:8080/health
hint-sealed-end =
    .lead = Check each part: the vault unsealed, Bunks running, its health page answering.
    .solution = bao status; systemctl status bunks; curl http://127.0.0.1:8080/health

## Chapter 2 — Need to Know

hint-need-to-know-policy =
    .lead = Write the rules for Bunks in an HCL file: which paths, which capabilities. Mind the real API path of a KV version 2 secret (Ruslan's notes, man bao).
    .solution = a file bunks.hcl with path "secret/data/bunks/*" and capabilities = ["read"], then bao policy write bunks bunks.hcl
hint-need-to-know-token =
    .lead = Create a token that carries only that policy, with your own admin token (not the root one).
    .solution = bao token create -policy=bunks -display-name=bunks -ttl=768h
hint-need-to-know-switched =
    .lead = Check what the new token may do, then give it to Bunks: where does Bunks read its token, and when?
    .solution = bao token capabilities TOKEN secret/data/bunks/db; sudo nano /etc/bunks/bunks.env (BAO_TOKEN=the new token); sudo systemctl restart bunks
hint-need-to-know-checked =
    .lead = Does Bunks answer with its new token?
    .solution = curl http://127.0.0.1:8080/health
hint-need-to-know-root-revoked =
    .lead = The root token of the init is still valid. A token can be revoked by anyone allowed to (man bao: token revoke).
    .solution = bao token revoke followed by the old BAO_TOKEN value (the root token)
hint-need-to-know-end =
    .lead = Check each part: Bunks's token and what it may do, the root token gone, the health page.
    .solution = bao token capabilities TOKEN secret/data/treasurer/bank (deny); bao token lookup on the root token (bad token); curl http://127.0.0.1:8080/health

## Chapter 3 — Leaked Token

hint-leaked-token-identified =
    .lead = Start with the token in the forum post: ask OpenBao what it is (man bao: token lookup).
    .solution = bao token lookup followed by the token from forum_post.txt
hint-leaked-token-traced =
    .lead = Every request is in the audit log, but tokens are written as HMACs. OpenBao can compute the HMAC of a value for you; or look for requests that didn't come from 127.0.0.1.
    .solution = bao write sys/audit-hash/file input=TOKEN, then sudo grep that hash /var/log/openbao/audit.log (or sudo jq on remote_address)
hint-leaked-token-revoked =
    .lead = The token must stop working now, before anything else.
    .solution = bao token revoke followed by the leaked token
hint-leaked-token-rotated =
    .lead = The log shows which secret was read. Give it its new value without losing its other field (man bao: kv patch).
    .solution = bao kv patch secret/bunks/payments api_key=followed by the new key from Desta's message
hint-leaked-token-switched =
    .lead = Bunks needs a new token, with its policy, and must restart to read it and the new key.
    .solution = bao token create -policy=bunks -display-name=bunks; sudo nano /etc/bunks/bunks.env; sudo systemctl restart bunks
hint-leaked-token-end =
    .lead = Check each part: the leaked token refused, the new key in place, the database secret untouched, Bunks healthy.
    .solution = bao token lookup LEAKED_TOKEN (bad token); bao kv get secret/bunks/payments; curl http://127.0.0.1:8080/health
