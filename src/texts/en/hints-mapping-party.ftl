### Graded hints for The Mapping Party (see src/engine/hints.ts): one message
### per step, hint-<chapter>-<event>, with .lead (a direction, without the
### exact command) and .solution (almost the answer).

## Chapter 1 — The First Plan

hint-first-plan-initialised =
    .lead = The code lives in /srv/dns. A fresh copy must be initialised once before OpenTofu can use it: it installs the provider (man tofu, Yusra's notes).
    .solution = cd /srv/dns; tofu init
hint-first-plan-formatted =
    .lead = Andile's block is badly indented. OpenTofu has its own formatter for the whole directory.
    .solution = tofu fmt (it lists the files it rewrote)
hint-first-plan-valid =
    .lead = Check the configuration against the provider's schema before planning; read each error's file, line and suggestion.
    .solution = tofu validate, then nano records.tf: adresses → addresses; tofu validate again
hint-first-plan-planned =
    .lead = The plan stops on a variable without a value. Where do the values of this configuration live? Then read what OpenTofu would do.
    .solution = add tiles_address = "192.0.2.180" to terraform.tfvars; tofu plan
hint-first-plan-applied =
    .lead = Apply the plan, and answer its question only after reading the summary line.
    .solution = tofu apply, then yes
hint-first-plan-checked =
    .lead = Ask the DNS server itself what it answers for the new name (man dig).
    .solution = dig @127.0.0.1 tiles.wayfinders.example
hint-first-plan-end =
    .lead = Check each part: the record served, managed in the state, the files formatted, the value kept in a file.
    .solution = tofu plan (No changes), tofu fmt -check, dig tiles.wayfinders.example

## Chapter 2 — Drift

hint-drift-locked =
    .lead = Start where Andile stopped: ask OpenTofu what it would change, and read why it refuses.
    .solution = cd /srv/dns; tofu plan (read Lock Info: who, which operation, since when)
hint-drift-freed =
    .lead = A local state's lock belongs to the process that took it. Is that process still running? (man ps, man kill)
    .solution = ps aux | grep tofu, then sudo kill 23817 (Femi's tofu apply)
hint-drift-drift =
    .lead = Now plan, and read both parts: what changed outside OpenTofu, and what applying the code would do about it.
    .solution = tofu plan (Objects have changed outside of OpenTofu: www)
hint-drift-code =
    .lead = Which side is true, the code or the server? Andile's message says it. Make records.tf say what is true, then plan again.
    .solution = nano records.tf: addresses = ["198.51.100.41"] for www (ttl 60, or 300 with a replacement); tofu plan; tofu apply
hint-drift-imported =
    .lead = status exists in named but not in the code nor the state. Describe it in records.tf, then adopt the existing record (man tofu: import).
    .solution = a resource "dns_a_record_set" "status" block (zone, name = "status", addresses = ["198.51.100.42"], ttl = 300), then tofu import dns_a_record_set.status status.wayfinders.example.
hint-drift-end =
    .lead = The work is done when OpenTofu finds nothing left to do.
    .solution = tofu plan: No changes. Your infrastructure matches the configuration.
