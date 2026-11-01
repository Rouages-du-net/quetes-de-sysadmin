### Story "The Watch", chapter "The Bulletin": sort the CVEs in a weekly
### security bulletin, say which ones really concern this server. The CVE
### identifiers are fictional (CVE-2099-NNNNN, in the form of real ones);
### package names, commands and paths are not translated. The template's
### section titles (bulletin-section-…) must stay those of the template.

chapter-bulletin = The Bulletin
    .summary = Sort a bulletin of CVEs: what really concerns this server, and what is only a false alarm.

## Files

# The Bakery's website (/var/www/bakery/index.html), as curl shows it.
watch-site-index =
    <!DOCTYPE html>
    <html lang="en">
    <title>The Bakery</title>
    <h1>The Bakery</h1>
    <p>Order your bread online and pick it up at the shop.</p>
    </html>

bulletin-email-salome =
    From:     Salomé
    To:       you
    Subject:  The watch, six months on

    Hello!

    It's been six months since the audit. The business has grown: you've
    migrated to a new server (kneader), and Nadia asked for me again, not to
    recheck everything this time, but to help you build a habit: the
    security watch. I won't come back every six months to always check
    everything for you.

    Every week, a mailing list I follow (like the Debian security
    advisories) sends a bulletin of recently fixed flaws. This week's is in
    your folder: security_bulletin.txt.

    First rule, and the most important: a line in the bulletin is only an
    alert if it really concerns this server. Before worrying about a CVE,
    check:
    - is the package even installed here? (apt list --installed)
    - if so, is the installed version in the affected range, or already
      past the fixed version?

    Sort what you find in watch.md: what concerns this server on one side,
    what you don't need to worry about on the other (with why).

    Salomé
    (For sudo, your password is: sourdough-2028)

bulletin-file =
    SECURITY BULLETIN — week of 8 September 2028
    (fictional CVEs, for teaching purposes: none of them really exist)

    CVE-2099-41042 — nginx                                        [high, 8.2]
    Bypass of access restrictions through HTTP/2 request confusion. A
    server acting as a reverse proxy may let a request through to a path
    that is normally protected.
    Affected versions: nginx < 1.26.3-3+deb13u3
    Fixed in:           nginx 1.26.3-3+deb13u3

    CVE-2099-37715 — rsync                                        [critical, 9.8]
    Extracting a specially crafted archive can execute arbitrary code with
    the rights of the account running rsync.
    Affected versions: rsync < 3.4.1+ds1-5
    Fixed in:           rsync 3.4.1+ds1-5

    CVE-2099-50288 — python3-certbot-nginx                        [medium, 5.3]
    During certificate renewal, the account key is briefly readable by
    every account on the system (a fraction of a second, the time of a
    file write).
    Affected versions: python3-certbot-nginx < 3.5.0

    CVE-2099-12003 — curl                                         [medium, 6.1]
    Following a redirect with a specially crafted header, curl can read
    past the intended memory area (denial of service).
    Affected versions: curl ≤ 8.14.1-2
    Fixed in:           curl 8.14.1-3

    CVE-2099-29107 — openssh-server                                [medium, 5.9]
    Timing side channel in "keyboard-interactive" authentication
    (KbdInteractiveAuthentication): the server's response time may leak
    information about a password being checked. No Debian fix yet; in the
    meantime, disable KbdInteractiveAuthentication in sshd_config.
    Affected versions: openssh-server (all, if the option is enabled)

bulletin-template =
    # Watch — The Bakery

    ## Concerns this server
    (to complete: the CVEs that really apply, with their identifier)

    ## Not applicable
    (to complete: the CVEs that don't apply, with their identifier and why)

bulletin-section-affected = Concerns this server
bulletin-section-not-applicable = Not applicable
bulletin-a-complete = (to complete
bulletin-words-missing = is not installed, not installed, absent, no such package, doesn't exist on this server
bulletin-words-fixed = already fixed, already up to date, installed version, past the fixed version, newer than the fixed version, more recent

## Review

bulletin-review = Salomé reviews your sort:
bulletin-missing-template = Some "(to complete)" lines of the template are still there.
bulletin-missing-concerns = Under "Concerns this server" there must be exactly nginx, rsync and openssh-server (that one applies, even though it needs nothing more here) — neither certbot nor curl belong there.
bulletin-missing-not-applicable = Under "Not applicable", explain why for each one: certbot (check whether it is even installed) and curl (compare the installed version with the bulletin's fixed version).

## Events

bulletin-event-read =
    Five lines, five CVEs. Before fixing anything: which ones REALLY concern
    this server? apt list --installed tells you what is installed here, and
    at which version (man apt).
bulletin-event-sort =
    Your sort separates what deserves attention from what doesn't need to
    worry you: certbot isn't on this server, curl is already past the fixed
    version. What's left is nginx, rsync, and openssh-server (already
    protected by the configuration, but worth keeping an eye on).
bulletin-event-end =
    Salomé: "That's the right reflex: read before panicking. Half of a
    security bulletin, usually, doesn't concern you."

    Well done! You have finished the chapter "The Bulletin".

    WHAT HAPPENED
    A security bulletin lists flaws fixed in widely used software; most of
    them don't concern a given server (the package isn't there, or the
    installed version isn't in the affected range). Sorting before acting
    avoids panicking for nothing, and keeps attention for what truly
    matters.

    GOOD PRACTICE
    - Check both installation AND version before keeping a CVE
      (apt list --installed, never just the package name).
    - A CVE that applies in theory can already be harmless thanks to a
      configuration that was already careful (here,
      KbdInteractiveAuthentication).
    - Keep a written record of the sort: the next watch will build on it,
      and someone else must be able to reread it.

    ANOTHER WAY
    Large organisations use a vulnerability scanner (OpenVAS, Nessus, or
    the Lynis already seen in "The Audit") that automatically cross-checks
    installed versions against a CVE database: this removes part of this
    chapter's manual work, without removing the decision of what is worth
    fixing.

    DOCUMENTATION
    - Debian security advisories: https://www.debian.org/security/
    - CVE: https://www.cve.org/
    - CVSS (the score calculator): https://www.first.org/cvss/calculator/4-0
