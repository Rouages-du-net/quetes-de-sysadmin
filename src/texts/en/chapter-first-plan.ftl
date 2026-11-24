### Story "The Mapping Party", chapter "The First Plan": a DNS record added
### as code with OpenTofu (init, fmt, validate, a variable, plan, apply,
### dig). Commands, options, paths, resource addresses, record names and
### OpenTofu's outputs are not translated.

chapter-first-plan = The First Plan
    .summary = Saturday's mapping party needs a name for its tile server. The collective's DNS is kept as code with OpenTofu, and the coordinator wrote the new record herself, in a hurry. Read the configuration, get it working, plan, apply, and check what the DNS server really says.

## Files

first-plan-message-andile =
    From: Andile (Wayfinders coordinator)
    Thursday 10 June, 18:30

    Hello, and thank you for taking over the DNS!

    Saturday is our mapping party at the community centre: forty people
    walking the old town with phones, noting every kerb, step and ramp.
    Dilnoza has set up a tile server for the evening's map, at 192.0.2.180,
    and the phones need a name for it: tiles.wayfinders.example.

    Yusra taught me that we never touch the zone by hand: the records live
    as code in /srv/dns, and OpenTofu makes the DNS server match the code. So
    last night I added the record to /srv/dns/records.tf myself, copying the
    one for www. I haven't dared run anything yet; I've never used the tofu
    command on cairn.

    Her notes are in your home. Can you get tiles.wayfinders.example working
    before Saturday?

    Andile

first-plan-notes-yusra =
    Notes from Yusra (the DNS as code, 2031)

    - The zone wayfinders.example is served by named on this machine. It
      is a dynamic zone: changes arrive as signed updates (RFC 2136) with the
      key tofu-key, and named keeps them in its journal. Don't edit
      /var/lib/bind/db.wayfinders.example: named would ignore it.
    - The code is in /srv/dns (group dnsadmins): versions.tf (OpenTofu and
      the dns provider), provider.tf, variables.tf, records.tf, outputs.tf.
      Values go in terraform.tfvars; the key's secret in secrets.auto.tfvars,
      never committed.
    - OpenTofu remembers what it manages in terraform.tfstate. Don't edit it,
      don't delete it.
    - A fresh copy of the code must be initialised once (tofu init): it
      installs the provider from the local mirror (no internet on cairn, see
      ~/.tofurc) and writes .terraform.lock.hcl, the versions chosen.
    - Then, every time: tofu fmt, tofu validate, tofu plan, read the plan,
      tofu apply. And check with dig.
    - man tofu.

## Events

first-plan-event-not-initialised =
    This copy of the code was never initialised on cairn: no lock file
    (.terraform.lock.hcl), no provider in .terraform. OpenTofu needs the dns
    provider to understand the resources, and tofu init installs it.
first-plan-event-initialised =
    The working directory is initialised: the provider hashicorp/dns came
    from the local mirror, and .terraform.lock.hcl records its version and
    checksum. That file belongs in version control, so that everyone gets
    the same provider; .terraform/ doesn't (see .gitignore).
first-plan-event-formatted =
    tofu fmt rewrote the files in the standard style: two spaces per level,
    the "=" of neighbouring arguments aligned. It changes the layout only;
    a typo stays a typo.
first-plan-event-invalid =
    tofu validate checks the code against the provider's schema without
    touching anything: in records.tf, the tiles block lacks "addresses" and
    has an argument the provider doesn't know. OpenTofu even suggests the
    right name.
first-plan-event-valid =
    The configuration is valid. Valid doesn't mean complete: a variable
    still needs its value before OpenTofu can plan.
first-plan-event-no-value =
    The variable tiles_address is declared in variables.tf, without a
    default, and no file gives it a value. -var gives one for a single
    command; terraform.tfvars keeps it for everyone who runs tofu here.
first-plan-event-planned =
    The plan reads like a diff: + creates, ~ changes in place, - destroys,
    -/+ replaces. Here: one record set to add, nothing else touched. www and
    wiki are refreshed, compared with the code, and left alone.
first-plan-event-zone-by-hand =
    The zone file was edited by hand. named doesn't reread a dynamic zone's
    file (rndc reload refuses it): its truth is in memory and in the
    journal. And OpenTofu wouldn't know either. Put the file back as it was
    (Yusra keeps it untouched), and change the code instead.
first-plan-event-state-gone =
    terraform.tfstate is gone. Without it, OpenTofu forgets that it manages
    www and wiki, and would want to create them again. The previous version
    is in terraform.tfstate.backup: copy it back before anything else.
first-plan-event-applied =
    OpenTofu sent the update to named and wrote the new record in its
    state: it now manages tiles, like www and wiki.
first-plan-event-cli-var =
    The record is there, but the value of tiles_address only lived in your
    command line: the next tofu plan here, by Andile or anyone, will stop on
    "No value for required variable". Keep the value in terraform.tfvars.
first-plan-event-checked =
    dig asked named directly: tiles.wayfinders.example answers 192.0.2.180.
    The code, OpenTofu's state and the server agree.
first-plan-event-end =
    Andile: "Dilnoza sees the tiles on her phone. Saturday is saved!"

    Well done! You finished The First Plan.

    WHAT HAPPENED
    The record was written as code, but the code had never run on cairn:
    tofu init installed the dns provider from the local mirror and wrote
    the lock file. tofu fmt fixed the layout, tofu validate caught the typo
    (adresses), and the new variable got its value in terraform.tfvars.
    tofu plan showed a single addition, tofu apply made it after your "yes"
    (a dynamic update signed with the TSIG key), and dig confirmed what
    named serves.

    GOOD PRACTICE
    - Every change goes through the code: the server's state is a
      consequence, and the code is the record of who changed what (keep it
      in git, with .terraform.lock.hcl).
    - init once per copy, then fmt, validate, plan, apply: read the plan's
      summary line before saying yes.
    - Values that everyone needs go in a .tfvars file; secrets in a file
      that is never committed (or in TF_VAR_ variables).
    - Never edit what OpenTofu manages by hand, neither the records nor
      terraform.tfstate.
    - Check the result where it counts (dig @127.0.0.1 tiles.wayfinders.example).

    ANOTHER WAY
    Terraform, from which OpenTofu was forked in 2023, reads the same files
    and works the same way. Ansible (nsupdate module) or plain nsupdate can
    make the same change, but without a plan to read nor a state to compare
    with next time.

    DOCUMENTATION
    - tofu init: https://opentofu.org/docs/cli/commands/init/
    - tofu plan and apply: https://opentofu.org/docs/cli/commands/plan/
    - Variables: https://opentofu.org/docs/language/values/variables/
    - The dependency lock file: https://opentofu.org/docs/language/files/dependency-lock/
    - The dns provider: https://search.opentofu.org/provider/hashicorp/dns/latest
