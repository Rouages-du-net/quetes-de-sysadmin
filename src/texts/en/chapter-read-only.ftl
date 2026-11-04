### Story "The Theatre", chapter 3 "Read Only": roles, GRANT, default
### privileges. SQL, paths and the tools' outputs are not translated.

chapter-read-only = Read Only
    .summary = Inès's statistics tool uses the app's own account, the one that owns every table: last week she renamed every show by mistake. Give her an account that reads everything and changes nothing, including the tables still to come.

## Files

read-only-message-camille =
    From:     Camille
    To:       you
    Subject:  Inès and the database

    Hello,

    Inès, our volunteer for the figures, has a little tool that makes the
    weekly report on ticket sales (ticket-stats, a service on the
    server). I gave it the app's account to connect, because that was
    the one I had (see /etc/ticket-stats/config.env).

    Last week, exploring the database with the same account, Inès renamed
    every show to "test" by mistake. I restored last night's backup; we
    lost two hours of bookings.

    Could you give her an account that can read everything but change
    nothing? And put it in the tool. Careful: I'm adding a donations table
    this week (the migration runs as boxoffice, like every migration), and
    she will need it in her report too.

    Same sudo password: curtain-2028.

    Camille

## Events

read-only-event-account =
    The tool logs in as boxoffice: the app's role, which owns every
    table. An owner may do anything with its tables: read, change,
    empty, drop. Who can do what? (man psql: \du for the roles, \dp for
    each table's privileges)
read-only-event-role =
    A new role can read the shows. To try it without its password: as
    the superuser, SET ROLE name; then a query (in the same -c, separated
    by ";"): everything runs with that role's privileges.
read-only-event-too-much =
    This role can also change data (INSERT, UPDATE, DELETE or TRUNCATE on
    a table): that is exactly what must not happen again. GRANT SELECT
    only, and REVOKE the rest (REVOKE ALL ON … FROM role, then GRANT
    SELECT).
read-only-event-superuser =
    A superuser skips every privilege check: it can read, change and drop
    everything, in every database. Never for an account that only reads
    (ALTER ROLE … NOSUPERUSER).
read-only-event-member =
    A member of boxoffice inherits all of boxoffice's rights, including
    owning the tables: it may change and drop them. Give the privileges
    themselves, not the owner's role (REVOKE boxoffice FROM …).
read-only-event-migration =
    Camille: "The migration has run: there is a donations table now." It
    was created by boxoffice, after your GRANT. Can the new role read it?
read-only-event-donations-denied =
    The new role can't read donations: GRANT … ON ALL TABLES only applies
    to the tables that exist at the time. For the tables still to come,
    PostgreSQL has default privileges (man psql: ALTER DEFAULT
    PRIVILEGES), given for the tables a given role will create.
read-only-event-wrong-creator =
    Default privileges apply to the tables created by one role: without
    FOR ROLE, the one running the command (postgres, here). The
    migrations run as boxoffice: ALTER DEFAULT PRIVILEGES FOR ROLE
    boxoffice IN SCHEMA public GRANT SELECT ON TABLES TO …
read-only-event-no-defaults =
    The new role reads donations now, but the next table will be missed
    the same way. Add default privileges for the tables boxoffice will
    create (ALTER DEFAULT PRIVILEGES FOR ROLE boxoffice …).
read-only-event-tool =
    The role is ready. The tool still logs in as boxoffice: change its
    DATABASE_URL in /etc/ticket-stats/config.env (with the new role and
    its password), then restart it.
read-only-event-tool-failed =
    ticket-stats failed to start: systemctl status ticket-stats and
    journalctl -u ticket-stats say why (the role, its password, its LOGIN,
    or a table it can't read).
read-only-event-end =
    The weekly report runs with { $role }: it reads every table, donations
    included, and can change none. Inès: "I can explore without fear
    now!" Camille: "And the next migrations won't break the report."

    Well done! You have finished the chapter "Read Only".

    WHAT HAPPENED
    The tool, and Inès, used boxoffice, the owner of every table. An owner
    may do anything, and PostgreSQL can't tell a mistake from an order:
    UPDATE shows SET title = 'test' was allowed.

    ROLES AND PRIVILEGES
    - CREATE ROLE … LOGIN PASSWORD '…': an account that may log in.
    - GRANT SELECT ON ALL TABLES IN SCHEMA public TO …: the tables that
      exist now.
    - ALTER DEFAULT PRIVILEGES FOR ROLE boxoffice IN SCHEMA public GRANT
      SELECT ON TABLES TO …: the tables boxoffice will create.
    - Not a superuser, not a member of the owner's role: both give every
      right.

    GOOD PRACTICE
    - One role per use: the app, the migrations, the reports, each person.
      The least privilege each needs.
    - Try a role before handing it out: SET ROLE …; then the queries it
      will make, and one it must not make.
    - \dp and \ddp show who can do what.

    DOCUMENTATION
    - Privileges: https://www.postgresql.org/docs/16/ddl-priv.html
    - GRANT: https://www.postgresql.org/docs/16/sql-grant.html
    - ALTER DEFAULT PRIVILEGES: https://www.postgresql.org/docs/16/sql-alterdefaultprivileges.html
