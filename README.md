# Sysadmin Quests

*Learn the job of a Linux system administrator by playing, in your browser,
with real commands and real behaviours.* — [Version française](README.fr.md)

You learn the Linux command line, then how to connect to servers, secure
them, serve websites, deploy, back up, and repair things when everything
breaks. Each quest is a realistic incident or mission, in a fully simulated
system: nothing leaves the browser.

> **Status**: about twenty playable stories and over a hundred chapters,
> reached over `ssh` from your own workstation: the command line,
> permissions and sudo, logs and processes, accounts and groups, systemd
> services, networking, git, archives, SSH keys, jump hosts and tunnels,
> firewalls, fail2ban, backups (rsync, cron, restic, rsnapshot, pg_dump),
> nginx, Apache, Caddy, TLS, DNS, mail (SPF, DKIM, DMARC), Docker and
> Compose, deployments, VLANs, DHCP, nftables, WireGuard, LDAP, RAID and
> LVM, Ansible, security audits, and more — with a built-in manual and a
> `nano` editor. What comes next is in the [roadmap](docs/ROADMAP.md).

## Play

- Online: **https://sysadmin.rouages.net** (in English at `/en/`, in French
  at `/fr/`; the root picks one from your browser's language).
- On your own site, in two lines: see [docs/EMBEDDING.md](docs/EMBEDDING.md).

## Develop

```bash
npm install
npm run dev                # http://localhost:4321
npm test                   # replays every quest (Vitest)
npm run build              # dist/: the site, and dist/integration/: the file to embed
npm run preview &          # http://localhost:4340
npm run test:navigateur    # checks the game in Chromium (1000 and 375 px, CSP, embedding)
```

| Directory | Contents |
|---|---|
| `src/pages/`, `src/layouts/` | the site's pages (Astro): `/en/`, `/fr/`, and the root |
| `public/.htaccess` | Apache configuration: HTTPS, language at the root, cache, security, CORS |
| `src/moteur/` | the engine: simulated shell, commands, manual, stories and their chapters |
| `src/interface/` | the game's interface (terminal, story menu, progress) and its styles |
| `src/element.ts` | the embeddable `<quetes-de-sysadmin>` element |
| `src/textes/` | every text of the game, per language, in Fluent format |
| `tests/` | replayed games and browser checks |
| `docs/` | [scenarios](docs/SCENARIOS.md), [embedding](docs/EMBEDDING.md), [deployment](docs/DEPLOIEMENT.md), [roadmap](docs/ROADMAP.md), [translating](docs/TRADUIRE.md), [an offensive story](docs/VERSION-OFFENSIVE.md) |

Want to write a quest, fix a bug or translate the game? Start with
[CONTRIBUTING.md](CONTRIBUTING.md).

The project started in French: most of the code's identifiers and some of
the documentation are still in French, and are being moved to English
little by little (see CONTRIBUTING.md).

## Where this game comes from

Sysadmin Quests is **inspired by
[Terminus](https://web.mit.edu/mprat/Public/web/Terminus/Web/main.html),
created at MIT by Shawn Conrad and Michele Pratusevich**: the idea of a world
where each place is a directory and each object a file comes from there. The
places, stories, puzzles and code are our own. The game was born as
"Terminus en français" on [Les rouages du net](https://rouages.net), a
French site that explains the internet, computing and AI, before becoming
this independent project.

## Principles

- **Static**: a site with no server and no database, published at
  [sysadmin.rouages.net](https://sysadmin.rouages.net); everything happens in
  the browser, progress is kept locally, with no account.
- **Learning to help yourself**: `man`, `--help` and `man -k` work everywhere
  from the first quest, and some puzzles can only be solved by reading the
  manual.
- **Real commands**: same names, same common options, same outputs; every
  deliberate difference from a real Linux is documented.
- **Safe**: addresses and domain names reserved for examples, no real
  target; security quests stay defensive.
- **Accessible**: keyboard, screen readers, contrast, mobile.
- **No trackers**, no ads, no third-party resources.
- **English first**, French too; more languages will come (German, Spanish,
  Mandarin, Korean…): texts are kept apart from the code.

## Licences

- **Code**: [GNU GPL version 3](LICENSE) (or any later version). You may
  use, study, modify and redistribute the game; modified versions you
  distribute stay under the GPL.
- **Texts** (stories, dialogues, debriefs, documentation):
  [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA
  4.0)](LICENSE-CONTENUS.txt), like [Les rouages du net](https://rouages.net).

Terminus, the MIT game that inspired this one, is not reused: neither its
code nor its texts.
