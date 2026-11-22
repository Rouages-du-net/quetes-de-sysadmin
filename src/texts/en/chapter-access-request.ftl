### Story "The Choir", chapter "The Access Request": a member asks for a
### copy of all the data the choir holds about her (GDPR article 15). psql
### (WHERE, --csv), grep -r, zgrep, find, cp. Commands, options, paths and
### outputs are not translated.

chapter-access-request = The Access Request
    .summary = An alto asks the choir for a copy of everything it holds about her. Her row in the members table is the easy part: find her everywhere the server keeps her, and send her all of it, and nobody else's.

## Files

access-request-message-amara =
    From: Amara (chair)
    Monday 17 March, 18:40

    Hello again,

    Priya Raman, one of our altos, wrote to us (her message is in your home
    directory). She is entitled to it, and we have a month to answer.

    Could you gather everything the server holds about her in
    /srv/choir/gdpr-requests/priya-raman/? Any format is fine, as long as she
    can read it; I'll send it to her through the members' area with a
    letter. Only her data, please: nothing about the others.

    Amara

access-request-request-priya =
    From: Priya Raman
    To: the board of the Riverside Community Choir
    Sunday 16 March

    Dear board,

    Under article 15 of the GDPR, I would like a copy of all the personal
    data the choir holds about me, wherever it is kept, and to know how
    long you keep it.

    Nothing is wrong, I love singing with you! I'm just curious, and I
    work in data protection, so I like to practise what I preach.

    Best wishes,
    Priya Raman (alto)

## Events

access-request-event-her-row =
    That's her record in the members table: her contact details. But a
    members' app rarely keeps a person in a single table. What else does
    the database hold (\dt), and which tables point to her, by her id or her
    email?
access-request-event-tables =
    Her rehearsals and her subscriptions are hers too: every row that points
    to her id is her data. psql can write them straight into a file
    (redirect its output, or --csv for a spreadsheet).
access-request-event-backups =
    Last night's dump holds her data again, as every backup does. You don't
    send her the backups themselves (they hold everybody's data), but the
    answer should say they exist and how long they are kept: the policy
    says three months.
access-request-event-uploads =
    Her photo and its consent form, in the members' uploads (one directory
    per member id). They are hers: copies go in the answer.
access-request-event-logs =
    The logs mention her too: the members' area's security log (this
    month's, and last month's, gzipped: zgrep reads it), and the mail log
    (the newsletters sent to her address). Her lines are her data; the
    other lines are not.
access-request-event-old-copy =
    A forgotten copy: Ruben's phone-tree export from last October, with her
    old address. Data you didn't know you had is still data you hold: it
    belongs in the answer (her line only), and then the file has no reason
    to exist any more.
access-request-event-members-only =
    The answer holds her record from the members table, and nothing else.
    The members table is one place among several: her rehearsals, her
    subscriptions, the newsletter, her uploads, the logs… Search wider:
    grep -r on her email, the tables of the database.
access-request-event-leak =
    The answer holds other members' data (an email address or a phone
    number that isn't hers): a whole file copied, a table without WHERE, a
    log without grep. Sending it would be a data breach of its own. Keep
    only her lines.
access-request-event-incomplete =
    The answer is taking shape. Still missing: { $missing }.
access-request-part-member = her record in the members table
access-request-part-attendance = her rehearsals
access-request-part-payments = her subscriptions
access-request-part-newsletter = her newsletter subscription
access-request-part-photo = her photo
access-request-part-consent = her consent form
access-request-part-audit = her lines in the security log (both months)
access-request-part-mail = her lines in the mail log
access-request-part-phone-tree = her line in the old phone-tree export
access-request-event-end =
    Amara: "I've read it all before sending it: I had no idea we knew so
    much about our singers. Priya already answered: 'Impressive, and
    nothing from anyone else. Thank you!'"

    Well done! You finished The Access Request.

    WHAT HAPPENED
    Priya used her right of access. Her data wasn't only in the members
    table: her rehearsals and subscriptions in two other tables, the
    newsletter, her photo and consent form in the uploads, her lines in two
    logs (one of them gzipped), and a phone-tree export with her old address
    that nobody remembered. You gathered all of it, and only hers.

    GOOD PRACTICE
    - The right of access (GDPR, article 15) covers all the data held about
      a person, wherever it is, and what is done with it, for how long, and
      who receives it. The answer is due within one month (article 12(3)).
    - Know where personal data lives before anyone asks: a short inventory
      (tables, files, logs, exports, backups) turns a request into an
      evening's work instead of a hunt.
    - Search by every identifier: the id in the database, the email in the
      logs, the phone number in a spreadsheet.
    - Answer one person, and only that person: a table without WHERE or a
      whole log in the answer is a breach of everybody else's data.
    - Forgotten exports are the classic leak: once the answer is sent, the
      phone-tree file should go.
    - Backups hold the same data: say so, and how long they are kept,
      rather than digging through them.

    DOCUMENTATION
    - GDPR, articles 12 and 15: https://eur-lex.europa.eu/eli/reg/2016/679/oj
    - The CNIL: https://www.cnil.fr/
    - psql: https://www.postgresql.org/docs/16/app-psql.html
    - gzip and zgrep: https://www.gnu.org/software/gzip/manual/gzip.html
