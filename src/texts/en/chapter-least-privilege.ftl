### Story "The Allotments", chapter "Least Privilege": the app connects as
### root over the network, MariaDB listens on every address. Accounts
### 'user'@'host', CREATE USER, GRANT, REVOKE, DROP USER, unix_socket,
### mariadb-secure-installation, bind-address, ufw. Commands, options, paths,
### SQL and outputs are not translated.

chapter-least-privilege = Least Privilege
    .summary = The booking app moved to a new server, and to get it going again someone gave it the keys to everything: the database's root account, reachable from the whole internet. Give the app what it needs, and nothing more.

## Files

least-privilege-message-halima =
    From: Halima (chair, Greenholme Allotments Association)
    Tuesday 20 May, 18:10

    Hello again,

    Selin, who helps us with the computers, scanned our addresses from her
    home connection last night (we asked her to) and she's worried: see her
    report, I copied it next to this message. Lwazi moved the app to a new
    server, barrow, on Sunday, and admits he "opened things up" to make it
    work. His note is here too.

    Could you close what should be closed, without breaking the site?
    Members are booking their summer plots this week.

    Halima

least-privilege-scan-selin =
    Port scan of the association's public addresses, from outside (Selin)
    Monday 19 May 2031, 22:41

    Nmap scan report for 192.0.2.131
    Host is up (0.012s latency).
    Not shown: 997 filtered tcp ports (no-response)
    PORT     STATE SERVICE VERSION
    22/tcp   open  ssh     OpenSSH 10.0p2 Debian 7 (protocol 2.0)
    3306/tcp open  mysql   MariaDB 11.8.9-MariaDB-0+deb13u1
    8080/tcp closed http-proxy

    Selin: 3306 is the database. Anyone on the internet can try passwords
    on it. Is that on purpose?

least-privilege-note-lwazi =
    Lwazi, Sunday 18 May

    Sorry, I was in a hurry. Plotline now runs on barrow (198.51.100.134):
    shed is gone. On the first start the app got "Host '198.51.100.134' is
    not allowed to connect to this MariaDB server", so:
    - I created root@'%' with a password and put it in the app's settings
      (barrow: /srv/plotline/.env);
    - I set bind-address = 0.0.0.0 in 50-server.cnf "to be sure".
    It works. I know it's not pretty. You can reach barrow with ssh from
    trowel; sudo works there too.

## Events

least-privilege-event-scan =
    3306/tcp open, from Selin's home: MariaDB answers anyone on the internet,
    on trowel's office uplink. That alone isn't a break-in, but every
    account that accepts connections from '%' can be tried from anywhere.
    Who may connect, from where, with which rights? (sudo mariadb; SELECT
    user, host, plugin FROM mysql.user; SHOW GRANTS FOR …)
least-privilege-event-accounts =
    Read the accounts as 'user'@'host': an account is a name AND the address
    it may come from. root@'%' is root from anywhere, with every privilege;
    the accounts with an empty user name are anonymous (anyone, any name);
    plotline@198.51.100.133 belongs to shed, which no longer exists; the test
    database is open to everyone. The app needs four kinds of statements on
    one database: what account would be just enough for it?
least-privilege-event-all-on-all =
    ON *.* gives that account rights over every database, the mysql system
    tables included, and some global privileges let it read files, kill
    connections or change the server's settings. An app that gets broken
    into hands all of that over. Grant on plots.* only, and only what the app
    does (man mariadb: GRANT, REVOKE).
least-privilege-event-any-host =
    '%' as the host means "from any address": with trowel listening on the
    internet, anyone can try that account's password. The app always comes
    from barrow: name its address (or the back network, '198.51.100.%').
least-privilege-event-app-account =
    That account fits the app: its host is barrow's, its rights are
    SELECT, INSERT, UPDATE and DELETE on plots, nothing global. Now the app
    must use it: its settings are on barrow.
least-privilege-event-env-not-loaded =
    The .env file says the new account, but the app still connects as root:
    it read its settings when it started, and keeps them in memory (see
    /srv/plotline/README.txt).
least-privilege-event-app-denied =
    The app can't work with its new settings: { $error }. Its log says the
    same (barrow: /var/log/plotline/app.log). Check the account's host, its
    password (IDENTIFIED BY) against the .env, and its grants (SHOW GRANTS
    FOR …).
least-privilege-event-app-switched =
    Plotline now connects with its own account (barrow's log says so) and
    can only touch plots, with the four statements it uses. root@'%' is no
    longer needed by anyone.
least-privilege-event-locked-out =
    root@localhost can no longer log in through the socket. If nothing else
    has the privileges, nobody can administer the server any more. Debian
    keeps a second way in: mysql@localhost, with unix_socket, for the
    system's mysql account (sudo -u mysql mariadb). Put root back:
    ALTER USER root@localhost IDENTIFIED VIA unix_socket;
least-privilege-event-sys-dropped =
    mariadb.sys is not a leftover: it is a locked account that owns the
    system views, mysql.user among them. Without it, they fail with "The
    user specified as a definer does not exist". Recreate it:
    CREATE USER 'mariadb.sys'@'localhost' ACCOUNT LOCK;
least-privilege-event-root-local =
    root is now only for this machine, through unix_socket: only the
    system's root (sudo mariadb) gets in, with no password to guess.
least-privilege-event-cleanup =
    No anonymous account, no test database open to all, no account for a
    server that no longer exists: what remains is what is used.
least-privilege-event-still-open =
    MariaDB restarted, but it still listens on every address, and nothing
    in front of it filters: Selin's scan would still find 3306 open. Where
    it listens is bind-address; who may reach the port can also be the
    firewall's job (ufw).
least-privilege-event-app-cut =
    The app can't reach the server any more ("Can't connect to server").
    The database must stay reachable from barrow, over the back network:
    127.0.0.1 is only trowel itself, and a firewall rule must let barrow in.
least-privilege-event-network =
    Port 3306 is closed from the internet, and barrow still reaches it over
    the back network.
least-privilege-event-end =
    Halima: "Selin scanned again: only ssh answers. And the bookings didn't
    stop for a second. Thank you!"

    Well done! You finished Least Privilege.

    WHAT HAPPENED
    To get the app going on its new server, it had been given the root
    account, from any address, with a password written in a file, and
    MariaDB listened on every address, the internet included. You gave the
    app an account of its own, from barrow only, with the four statements it
    needs on its database; kept root for the machine itself, through the
    socket; removed what an old installation had left (anonymous accounts,
    the test database, the account of a server that no longer exists); and
    closed the port to the internet.

    GOOD PRACTICE
    - One account per application, named with the address it comes from,
      with the privileges its statements need on its database, nothing
      ON *.*.
    - On Debian, root@localhost uses unix_socket: the system's root logs in
      without a password, and nobody can guess one. Keep it that way.
    - mariadb-secure-installation removes the anonymous accounts, the test
      database and remote root in one go, on a new server.
    - Listen only where clients are (bind-address), and filter in front
      (ufw): two locks rather than one.
    - A password in a file is still a secret: make that file readable by the
      app only (chmod 640, owner root, group of the app).

    DOCUMENTATION
    - CREATE USER and account names: https://mariadb.com/kb/en/create-user/
    - GRANT: https://mariadb.com/kb/en/grant/
    - Authentication with unix_socket: https://mariadb.com/kb/en/authentication-plugin-unix-socket/
    - mariadb-secure-installation: https://mariadb.com/kb/en/mariadb-secure-installation/
    - Configuring MariaDB for remote access: https://mariadb.com/kb/en/configuring-mariadb-for-remote-client-access/
    - The mariadb.sys account: https://mariadb.com/kb/en/mariadbsys-user/
