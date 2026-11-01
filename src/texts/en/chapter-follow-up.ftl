### Story "The Audit", chapter "The Follow-up Visit": redo the scan and run
### Lynis to prove the fixes hold, harden what is worth the effort, write the
### closing report. The commands, options, paths and the output of nmap and
### Lynis are not translated. The section titles of the template
### (contre-visite-section-…) must stay those of the template.

chapter-follow-up = The Follow-up Visit
    .summary = Prove the fixes hold: a new scan, a Lynis audit, reasoned hardening, and the closing report.

## Files

follow-up-email-salome =
    From:     Salomé (auditor)
    To:       you
    Subject:  Bakery audit — the follow-up visit

    Hello,

    The four parts of the report are handled: well done. Before closing, I do
    what I always do: the follow-up visit. You don't say "it's fixed", you show
    it.

    What I expect, in this order:
    1. Redo the inventory, like on day one: nmap -sV on the server (and only
       on it, remember the letter of engagement). What does the internet see
       now?
    2. Run Lynis on the server (man lynis). It fixes nothing: it says what it
       finds, and it is up to you to decide. Warnings first; among the
       suggestions, the ones worth the effort (some need a real project: they go
       in the report, you don't install them in a hurry).
    3. Fix, and prove: a hardening index of at least 70, with no warning at
       all, and a new scan that shows up-to-date versions.
    4. Write the closing report in closing_report.md. I read it at every save.

    Salomé
    (For sudo, your password is still: flour-2028)

follow-up-template =
    # Closing report — Le Fournil

    ## Summary
    (to complete: in two sentences, where the server's security stands)

    ## Findings fixed
    (to complete: one point per finding of parts 1 to 4: SSH, forgotten account, sudo, secret, exposure, the intruder's key and cron)

    ## Evidence
    (to complete: the new nmap scan and the Lynis hardening index, with their figures)

    ## Still to do
    (to complete: what is not fixed and why, with the Lynis identifiers)

follow-up-section-summary = Summary
follow-up-section-findings = Findings fixed
follow-up-section-evidence = Evidence
follow-up-section-remaining = Still to do
follow-up-a-complete = (to complete

## Words the review looks for (comma-separated, case-insensitive)

follow-up-words-hint = index, hardening, indice
follow-up-words-ssh = ssh, root
follow-up-words-account = lucas, account
follow-up-words-sudo = sudo, nopasswd
follow-up-words-secret = .env, secret
follow-up-words-network = ufw, firewall, redis
follow-up-words-key = key, cron

## Review

follow-up-review = Salomé reads your report:
follow-up-missing-template = Some "(to complete)" lines of the template are still there.
follow-up-missing-summary = The summary is meant to be two sentences, and it needs a bit more than a word.
follow-up-missing-findings = Under "Findings fixed", findings are missing: go back over parts 1 to 4 (SSH, the forgotten account, sudo, the secret, network exposure, the intruder's key and cron job), at least five out of six.
follow-up-missing-lynis = Run Lynis first: with no audit, there is no figure to quote.
follow-up-missing-proofs = Under "Evidence", quote the hardening index of your last Lynis audit (the exact figure) and what your last scan shows (ports 22, 80 and 443).
follow-up-missing-rest = Under "Still to do", quote at least one Lynis finding that is still open with its identifier (like FINT-4350): an honest report says what is not done.

## Events

follow-up-event-error-ssh =
    There is an error in the SSH configuration! Before reloading, always check
    with  sudo sshd -t : it gives the file and the line at fault.
follow-up-event-locked-out =
    WARNING: with the configuration sshd has just loaded, a new login from your
    account would be refused. Your session stays open: fix it BEFORE you
    disconnect.
follow-up-event-outside-scope =
    You probed an address outside the letter of engagement ({ $addresses }). Even
    for a follow-up visit, you stay in the scope: { $neighbour ->
        [yes] the neighbour's server is still not ours.
       *[no] what is not listed in it is not ours.
    }
# { $outdated }: "oui" if the SSH version shown is not up to date
follow-up-event-scan =
    That is what the internet sees now. Compare with day one: ports 5432
    (PostgreSQL) and 6379 (Redis) no longer answer, SSH, the website and its
    secure port remain. The firewall fixes hold.
    { $outdated ->
        [yes] But look at the SSH version: it is not that of an up-to-date machine. A security update is waiting (apt list --upgradable); that is the kind of detail nmap -sV reveals and nobody looks at.
       *[no] And the SSH version is that of an up-to-date machine.
    }
follow-up-event-lynis =
    There is the audit: a hardening index of { $hint }, and
    { $warnings } warning(s). An index is for comparing, not for chasing
    100: read each suggestion, its identifier (SSH-7408…) and its explanation
    page. Some can be fixed here; others (file integrity, antimalware, remote
    logs, auditd) are real projects that go in the report.

    The audit is kept in /var/log/lynis-report.dat: a  sudo grep suggestion  on
    it gives the list in one go.
follow-up-event-update =
    No security update waiting any more: Lynis's warning (PKGS-7392) is gone,
    and the SSH version nmap will show will be the new one. (Remember to rerun
    nmap and Lynis: a fix that is not proven is only an intention.)
follow-up-event-ssh-a-reload =
    You changed the SSH configuration, but sshd is still running with the old
    one: a service rereads its configuration when told to (sudo sshd -t to
    check, then sudo systemctl reload ssh). Lynis reads the file: its new index
    does not tell you what is applied.
# { $target }: the index to reach
follow-up-event-hardened =
    No warning and an index of at least { $target }, with the SSH configuration
    applied. That is a good level for this server; the rest is a project, not an
    emergency.

    Prove it: run Lynis again, and redo the scan.
follow-up-event-proof-lynis =
    The last Lynis audit reflects the machine's current state: no warning, and
    above the target. Note the index figure: the report quotes it.
follow-up-event-nmap-own =
    The last scan sees only SSH, the website and its secure port, with the SSH
    version up to date. That is the proof, from the internet's side, that
    everything holds. The closing report remains.
# { $mistake }: "oui" if a scan went beyond the scope
follow-up-event-end =
    Salomé: "It is complete, and it is honest. I'll pass it on to Nadia and her
    insurer. I'll come back in six months: security gets rechecked."

    Well done! You have finished the chapter "The Follow-up Visit", and the
    story "The Audit".

    WHAT HAPPENED
    You redid the port scan, ran Lynis, applied the updates and hardened what is
    worth the effort, then redid both to prove it. The new index and the new scan
    are in your report, with what remains to be done. A follow-up visit does not
    try to fix everything: it shows what is fixed, and says frankly what is not.
    { $mistake ->
        [yes] Your scan also touched an address that was not in the letter of engagement: note it for the next mission.
       *[no] All your scans stayed within the scope.
    }

    GOOD PRACTICE
    - Prove, don't assert: the same tool, the same command, before and after.
    - Lynis gives an index, not a mark to maximise: some suggestions are worth
      an afternoon, others a project. The report prioritises.
    - A warning is dealt with before the suggestions.
    - After a configuration change, apply (reload) AND check (nmap, lynis,
      sshd -T): the file is not the service.
    - The version a service displays is evidence (nmap -sV): a security update
      can be seen from the outside.
    - An honest report lists what remains: a known, accepted risk is better
      than an ignored one.

    ANOTHER WAY
    OpenSCAP or the CIS (Center for Internet Security) benchmarks do work
    similar to Lynis's with a precise reference grid: they are used when a
    contract or a standard asks you to prove compliance. A vulnerability
    scanner (OpenVAS, Nessus) crosses versions with databases of known flaws,
    which nmap -sV does not.

    DOCUMENTATION
    - Lynis: https://cisofy.com/documentation/lynis/
    - Lynis controls: https://cisofy.com/lynis/controls/
    - nmap: https://nmap.org/book/man.html
    - sshd_config: https://man.openbsd.org/sshd_config
    - Hygiene and audit guides from national authorities: ANSSI (France, cyber.gouv.fr), BSI (Germany, bsi.bund.de), NCSC (United Kingdom, ncsc.gov.uk), CCN-CERT (Spain, ccn-cert.cni.es), CCB (Belgium, ccb.belgium.be), NCSC (Switzerland, ncsc.admin.ch), CISA (United States, cisa.gov)
