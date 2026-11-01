### Story "The Gazette", chapter 5 "The migration": a database migration
### that prevents rolling back. Commands, paths and
### messages from journalctl, systemctl and curl are not translated.

chapter-migration = The migration
    .summary = The new version migrated the database: the old one can no longer read it. When rolling back is impossible, you fix forward.

## Files

migration-message-samia =
    A message from Samia, Tuesday 8:30 am:

    "The Kiosk has been answering with an error since this morning! Théo put 2.0.0
    on green (green) last night and switched nginx before leaving (his note is
    next to this one). This morning he tried to go back to blue (blue)… and that didn't work
    either, so he put everything back on green.

    We need:
      - the Kiosk to work again;
      - and the other slot to become a real safety net again,
        ready to take over.

    For sudo: gazette-2027."
migration-word-theo =
    A note from Théo:

    "Sorry… I launched 2.0.0 on green last night around 11 pm, /health wasn't
    happy but I switched anyway, it was late. This morning I
    tried to put blue (1.6.1) back: error too. I don't understand it at all,
    1.6.1 was working perfectly the day before yesterday!"
migration-notes-200 =
    Kiosk 2.0.0 — release notes

    WARNING: this version MIGRATES THE DATABASE on startup
    (schema 3 → 4: the column abonnes.courriel becomes abonnes.email).
    Versions 1.x cannot read a migrated database: make a
    backup (pg_dump) before starting 2.0.0.

    Configuration: KIOSK_SMTP is replaced by a full address,
      KIOSK_SMTP_URL=smtp://smtp.gazette.example:587
    (in /etc/kiosk/kiosk.env).

## Events

migration-event-green-sick =
    Green (2.0.0) isn't healthy: a configuration variable
    is missing. Its release notes (/srv/kiosk/versions/2.0.0/) probably
    say what changed.
migration-event-schema =
    Blue (1.6.1) can no longer read the database: it's at schema 4, and
    1.6.1 only knows 3. Who changed it? The log of the green
    service tells you (journalctl -u kiosk-green).
migration-event-migration-view =
    There it is: on startup, 2.0.0 migrated the database (the courriel column
    renamed to email). A migration doesn't undo itself:
    1.6.1 will never find its column again. Rolling back to
    blue is impossible; what's left is to fix forward: get
    2.0.0 working.
migration-event-return-impossible =
    nginx sends traffic to blue (1.6.1)… which answers 500: the database was
    migrated under its feet. Changing the code version isn't enough when
    the data has changed shape. Put green back, and fix it.
migration-event-repaired =
    The Kiosk is answering again, on 2.0.0. But the other slot
    is running a version that can no longer read the database: it's no longer a
    safety net. Put it on 2.0.0 too, healthy.
migration-event-end =
    The Kiosk runs on 2.0.0, and both slots can read the
    migrated database: the next rollback will be possible. Samia: "And
    next time, a database backup before every migration."

    Well done! You have finished chapter 5 of The Gazette, and the whole story.

    WHAT HAPPENED
    2.0.0 migrated the database on startup, before receiving even
    a single visitor. Switching the proxy link brings back the old code, not
    the old shape of the data: 1.6.1 could no longer read the database.
    When rolling back is impossible, you fix forward: here, the
    renamed configuration variable, announced in the release notes.

    GOOD PRACTICE
    - Read the release notes; never switch over if /health complains.
    - Back up the database right before a migration (pg_dump), and know how
      to restore it.
    - Migrations compatible with the previous version: expand
      first (add the email column, write to both), switch over,
      then contract (remove courriel) one version later.
    - After a migration, put the standby slot on the same
      version: a safety net that can't read the data isn't
      one.
    - The service logs (journalctl -u) tell you what happened.

    DOCUMENTATION
    - Parallel change (expand, then contract): https://martinfowler.com/bliki/ParallelChange.html
    - pg_dump: https://www.postgresql.org/docs/current/app-pgdump.html
    - journalctl: https://www.freedesktop.org/software/systemd/man/latest/journalctl.html
