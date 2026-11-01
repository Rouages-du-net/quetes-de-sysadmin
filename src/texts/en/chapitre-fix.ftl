### Story "The Watch", chapter "The Fix": fix nginx and rsync without
### breaking anything. The commands, paths and apt's output are not
### translated.

chapitre-fix = The Fix
    .resume = Fix nginx and rsync without breaking anything: apt update before apt upgrade, then check the site still answers.

## Files

fix-courriel-salome =
    From:     Salomé
    To:       you
    Subject:  Time for the fix

    The order is decided: nginx, then rsync. Both already have a published
    Debian fix, so no temporary workaround needed here: an update is enough
    (man apt).

    One reflex never to skip: refresh the package list before asking for an
    update. Without it, apt doesn't know a fix exists.

    And after fixing: check that the site still answers. Fixing a flaw that
    takes the site down would be an odd favour to do Nadia.

    Salomé
    (For sudo, your password is still: levain-2028)

## Events

fix-evenement-sans-maj =
    apt upgrade says "Upgrading: 0": nothing happened. apt only knows about
    available updates after refreshing its package list (sudo apt update),
    like a catalogue that needs reloading before you can look up something
    new in it.
fix-evenement-corrige =
    nginx and rsync are at the fixed version. One more thing to check
    before moving on: does the site still answer?
fix-evenement-verifie =
    The site answers (curl returns 200): the update broke nothing.
fix-evenement-fin =
    Salomé: "Two fixed, the site still standing. That's all we ask of an
    update."

    Well done! You have finished the chapter "The Fix".

    WHAT HAPPENED
    The Debian fixes for both retained CVEs are now installed. apt upgrade
    installs all available updates at once (not one by one), after
    refreshing the package list; that's why sudo apt update always comes
    first.

    GOOD PRACTICE
    - sudo apt update before any update: without it, apt works from a
      stale list and finds nothing.
    - Check afterwards that what should run still runs (a simple curl is
      enough here): fixing one flaw must not create another, nor take a
      service down.
    - When no fix exists yet (the bulletin's openssh-server case), the
      bulletin usually documents a temporary mitigation: to apply while
      waiting, not instead of a real watch.

    ANOTHER WAY
    unattended-upgrades (already seen in "Automatic Updates", at the
    Co-op) can apply this kind of security fix on its own, without waiting
    for someone to read the bulletin — which is exactly the subject of this
    story's last chapter.

    DOCUMENTATION
    - apt: https://manpages.debian.org/trixie/apt/apt.8.en.html
