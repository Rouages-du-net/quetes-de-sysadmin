### Story "The Tool Library", chapter "Signed and Sealed": SSH-signed
### commits and tags, a forge that requires them, a release whose checksums
### are signed, and a check as a downstream user would make it.
### Commands, options, paths and outputs are not translated.

chapter-signed-release = Signed and Sealed
    .summary = A fake Lendshed release circulates with a checksum that "proves" it. Make every step of the next release verifiable, from the commits to the tarball: signed with the maintainers' keys, required by the forge, and checked the way a tool library on the other side of the world will check it.

## Files

signed-release-message-aroha =
    From: Aroha (Wellington Tool Library)
    Sunday 24 November

    Kia ora! I run Lendshed for our tool library. Someone posted a
    "lendshed-2.3.1.tar.gz" on the tool libraries' forum last week, with
    a checksum file next to it, saying it fixes the reminders. There is no
    2.3.1 on your site. The checksum matched the file, of course, since it
    came with it.

    How can I know that a release comes from you? I'd happily check a
    signature, if you tell me how. I'll be installing 2.4.0 as soon as it's
    out.

    Aroha

signed-release-note-wanjiru =
    From: Wanjiru
    Monday 25 November, 9:30

    Aroha is right, and after October I want us to go further: every
    commit on main signed by a maintainer, the forge refusing the others,
    the release tag signed, and the checksums of the tarballs signed too.

    Let's use SSH keys, we already have them: yours is ~/.ssh/id_ed25519
    (not the old one from your previous laptop, that one never went on
    the forge). Our public keys are on the forge too: each account's keys
    are at https://forge.lendshed.example/NAME.keys.

    The plan for 2.4.0:
    - an allowed_signers file at the root of the repository, with our
      three keys, so that anyone can check our signatures;
    - your commits signed (the version bump in lendshed/__init__.py is the
      only change left);
    - main requiring signed commits;
    - the tag v2.4.0, signed;
    - lendshed-2.4.0.tar.gz in /srv/www/downloads, made from the tag
      (prefix lendshed-2.4.0/), with SHA256SUMS and its signature;
    - and check it all as Aroha will, before announcing it.

    Wanjiru

## Events

signed-release-event-signing =
    git now signs with SSH (gpg.format = ssh) and knows which key
    (user.signingKey): git commit -S signs a commit, commit.gpgsign = true
    signs them all.
signed-release-event-old-key =
    That commit is signed with the old key from your previous laptop. It
    signs well enough, but nobody knows it: it isn't in allowed_signers, and
    the forge doesn't have it on your account. A signature proves something
    only with a key others already trust. Sign again with ~/.ssh/id_ed25519
    (git commit --amend -S --no-edit).
signed-release-event-signed-commit =
    Your last commit carries a signature made with your key. Can git check
    it? It needs to know whose keys are trusted.
signed-release-event-no-allowed =
    To check an SSH signature, git reads an allowed_signers file: one line
    per signer, "principal key", the principal being the address of the
    commit's author. git config gpg.ssh.allowedSignersFile tells it where
    the file is.
signed-release-event-allowed =
    git knows the allowed signers, and your key among them.
signed-release-event-verified =
    Good "git" signature for your address: the commit was signed by a key
    that allowed_signers gives to its author.
signed-release-event-require =
    main now requires signed commits: Forgejo checks each pushed commit's
    signature against the keys of the account whose address signed it.
signed-release-event-unsigned-refused =
    The forge refused the push: a commit isn't verified, either unsigned,
    or signed by a key that no account has with that address. Sign the
    commits (git commit --amend -S --no-edit for the last one), then push
    again.
signed-release-event-not-in-repo =
    Your signed commit is on main, but the repository still has no
    allowed_signers file with your key: users who clone it can't check
    our signatures. Add it at the root, commit, push.
signed-release-event-pushed =
    main's head is signed, verified by the forge, and the repository
    carries allowed_signers: anyone can check it with git verify-commit.
signed-release-event-lightweight =
    v2.4.0 is a lightweight tag: a plain name for a commit, with no
    tagger, no message, no signature. git verify-tag has nothing to check.
    Make an annotated, signed tag in its place (git tag -s -f), and if
    the lightweight one was pushed, push the new one with --force.
signed-release-event-tag =
    The tag v2.4.0 is on the forge, annotated and signed with your key, on
    main: git verify-tag v2.4.0 checks it.
signed-release-event-tarball =
    The tarball comes from the tag (git archive): the same tag always gives
    the same bytes, which lets anyone rebuild it and compare.
signed-release-event-sums =
    SHA256SUMS matches the tarball. A checksum only protects against a
    damaged download, though: whoever replaces the tarball replaces the
    checksum next to it, as the 2.3.1 forger did.
signed-release-event-sum-only =
    sha256sum -c says OK, but that's what Aroha already had with the fake
    2.3.1. Without a signature on SHA256SUMS, the checksum proves nothing
    about who made the file. Sign it: ssh-keygen -Y sign -n file.
signed-release-event-sum-checked =
    The checksum matches, and the file of checksums is signed: one more
    check and the release is proven.
signed-release-event-sig =
    SHA256SUMS.sig: SHA256SUMS signed with your key, in the "file"
    namespace (a signature made for git can't be passed off for a file, nor
    the other way round).
signed-release-event-sig-checked =
    Good "file" signature: SHA256SUMS was signed by your key, which
    allowed_signers gives to your address.
signed-release-event-end =
    Wanjiru: "Signed from the first commit to the last byte. I've put the
    two commands in VERIFYING.md for Aroha and the others."
    Aroha: "Checked! Both answers are good. Thank you."

    Well done! You finished Signed and Sealed.

    WHAT HAPPENED
    A fake release circulated with a checksum, which proved nothing since
    it came with the file. You set git to sign with your SSH key, published
    the maintainers' keys in allowed_signers, signed your commit, made the
    forge require verified commits on main, signed the tag v2.4.0, built
    the tarball from it with git archive, wrote and signed SHA256SUMS, and
    checked the release as a user would: sha256sum -c, then ssh-keygen -Y
    verify against allowed_signers.

    GOOD PRACTICE
    - A checksum detects a damaged file; only a signature says who made it.
    - Sign commits and tags with keys others already trust (allowed_signers
      in the repository, keys on the forge); let the forge refuse the rest.
    - An annotated, signed tag for each release; the tarball rebuilt from it.
    - Tell users how to check, in two commands.
    - SLSA and OpenSSF go further: provenance of the builds, reproducible
      builds, two-person review.

    DOCUMENTATION
    - git, signing your work: https://git-scm.com/book/en/v2/Git-Tools-Signing-Your-Work
    - git-config, gpg.format and gpg.ssh.allowedSignersFile: https://git-scm.com/docs/git-config
    - ssh-keygen -Y and ALLOWED SIGNERS: https://man.openbsd.org/ssh-keygen
    - Forgejo, protected branches: https://forgejo.org/docs/latest/user/protection/
    - SLSA, supply-chain threats: https://slsa.dev/spec/v1.0/threats
