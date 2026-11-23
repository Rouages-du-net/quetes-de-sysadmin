### Story "The Dance Troupe", chapter "The Public Bucket": the members'
### documents were published with the website, from the same Garage bucket.
### Buckets, website access, keys and their permissions, aws s3 mv, curl.
### Commands, options, paths, bucket and key names, and outputs are not
### translated.

chapter-public-bucket = The Public Bucket
    .summary = A parent found the troupe's medical contacts list with a web search. The website and the members' documents share one bucket of the troupe's object store: separate them, check from the outside, and give each tool a key that only opens what it needs.

## Files

public-bucket-message-esperanza =
    From: Esperanza (artistic director, Kestrel Dance Company)
    Tuesday 9 March, 9:20

    Hello, and thank you for coming so quickly.

    Last night the father of one of our young dancers phoned me: looking
    for our class times, he found a list with the children's emergency
    contacts and medical notes, on our website's address. I tried it
    myself: https://www.kestrel.example/members/medical-contacts-2032.csv
    opens for anyone.

    Our files are on wings, where you are now (sudo works with your
    password), and on the two other machines of what Teodora called "the
    cluster". Teodora set it all up before she moved away and left notes.
    Hiroshi, who made the website, publishes it with a little script.

    Please make those documents private again, without losing any of
    them: the board needs them. And the website must stay online, the
    spring gala tickets are on it.

    Esperanza

public-bucket-notes-teodora =
    Notes from Teodora (wings, 2029, a few updates since)

    - Our files are in Garage, an object store with an S3 API, on three
      nodes: wings (here, the studio), vault (at the Old Mill theatre, it
      has the fibre) and porch (at Siosaia's). Every object is stored on
      all three. sudo garage status shows them.
    - Garage keeps objects in buckets. sudo garage bucket list, sudo
      garage bucket info NAME (what it holds, website access, which keys
      may use it).
    - A program reaches Garage with an access key (an ID that starts
      with GK, and a secret). Each key has permissions per bucket: read,
      write, owner. sudo garage key list, sudo garage key info NAME.
    - The website is the bucket www.kestrel.example, with "website
      access": Garage's web endpoint serves it to anyone, without a key.
      The S3 API itself never answers without a key.
    - Clients: the AWS command-line tool (aws s3 ls, aws s3 cp…; its
      keys in ~/.aws/credentials, its endpoint and region in
      ~/.aws/config) and rclone (the office backup: /etc/rclone/office.conf,
      run every night by office-backup.timer).
    - I gave everything the key troupe-admin. It's simpler.

## Events

public-bucket-event-exposed =
    Anyone can read it: no key, no password. Before changing anything,
    find out why Garage serves this file. Which bucket is it in, and
    what lets the web endpoint serve that bucket to the world?

public-bucket-event-website =
    That's it: www.kestrel.example has website access, and with it Garage's
    web endpoint serves every object of the bucket, under any path, to
    anyone. The website and the members' documents share that bucket.
    Website access is all or nothing, for a whole bucket: the documents
    need a bucket of their own, without it.

public-bucket-event-deleted =
    A member document is gone from every bucket. The board needs them, and
    Garage keeps no older version of an object (it has no versioning):
    restart the chapter (or use the rescue snapshot). Move the documents
    to a private bucket rather than deleting them.

public-bucket-event-site-down =
    The website no longer answers: www.kestrel.example must keep its
    website access and its index.html, the gala tickets are sold there.
    The documents leave the bucket; the website stays.

public-bucket-event-moved =
    The members' documents are now only in buckets without website access:
    the web endpoint won't serve them, and the S3 API only answers with a
    key that has a permission on their bucket. Check it from the outside,
    the way the parent found them.

public-bucket-event-closed =
    The document's public address now answers 404: the web endpoint no
    longer finds it. Search engines will drop the link. Now the other half
    of the problem: one key opens everything, and two scripts carry it.

public-bucket-event-too-wide =
    That key can do more than its job: owner rights (it could change the
    bucket's website access, or delete it), the right to create buckets, or
    permissions on other buckets. If the deploy script's machine or the
    backup's configuration leaks, that key leaks with them. Give each tool
    read and write on its own bucket, nothing else.

public-bucket-event-deploy-key =
    The site's deploy now uses its own key: read and write on
    www.kestrel.example, nothing else, and it works.

public-bucket-event-backup-key =
    The office backup now uses its own key: read and write on backups,
    nothing else, and it can reach its bucket.

public-bucket-event-end =
    Esperanza: "The list doesn't open any more, and the site is still
    there. I'll call the father back. Thank you!"

    Well done! You finished The Public Bucket.

    WHAT HAPPENED
    The website was a Garage bucket with website access, and the members'
    documents had been put in the same bucket, under members/. Website
    access makes Garage's web endpoint serve every object of the bucket to
    anyone: the documents were public, and a search engine had found
    them. And a single key, with every right on every bucket, was used by
    the deploy script and by the office backup. You moved the documents to
    a private bucket, checked their old address from the outside, and gave
    each tool its own key with only what it needs.

    GOOD PRACTICE
    - One bucket per purpose and audience: what is public in a bucket of
      its own, never next to private files. A prefix ("folder") is not a
      boundary: website access, and permissions, are per bucket.
    - Check from the outside (curl, a private window): what the web
      endpoint serves is what the world sees.
    - One key per program, with the least privilege: read and write on
      its bucket, no owner bit, no other bucket. An admin key stays with
      the administrators, out of scripts.
    - A key that has leaked is deleted (garage key delete), not just
      replaced in a file. Garage has no versioning: a deleted object is
      gone, so think before rm, and keep backups.
    - Documents that were public for a while may have been copied: tell
      the people concerned, as the law on personal data usually requires.

    ANOTHER WAY
    The troupe uses Garage, a small geo-distributed S3 server written for
    self-hosting by the nonprofit Deuxfleurs. MinIO is the best-known
    alternative, but its community edition lost its admin console in 2025
    and is now distributed as source only. With MinIO or Amazon S3, a
    bucket can also be made public with a bucket policy or ACLs, which
    Garage doesn't implement: website access is its only public door.

    DOCUMENTATION
    - Garage, exposing websites: https://garagehq.deuxfleurs.fr/documentation/cookbook/exposing-websites/
    - Garage, buckets and keys: https://garagehq.deuxfleurs.fr/documentation/quick-start/
    - Garage's S3 compatibility: https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/
    - aws s3 mv: https://awscli.amazonaws.com/v2/documentation/api/latest/reference/s3/mv.html
    - The AWS CLI's configuration files: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html

## What the three chapters share, kept here so that it loads with the
## story: the troupe's website, the members' documents (invented people;
## the phone numbers are in the UK's range reserved for fiction), the
## office share's files.

troupe-site-index =
    <!doctype html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Kestrel Dance Company</title><link rel="stylesheet" href="/css/style.css"></head>
    <body>
    <header><h1>Kestrel Dance Company</h1><nav><a href="/">Home</a><a href="/classes.html">Classes</a><a href="/agenda.html">Agenda</a></nav></header>
    <main>
    <p>A community dance company: classes for every age, from 4 to 84, and a spring gala on stage at the Old Mill.</p>
    <p><img src="/images/gala-2031.jpg" alt="The 2031 gala: forty dancers on stage"></p>
    <p>Spring gala, Saturday 1 May: tickets at the studio and on this site.</p>
    </main>
    </body>
    </html>
troupe-site-agenda =
    <!doctype html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Agenda, Kestrel Dance Company</title><link rel="stylesheet" href="/css/style.css"></head>
    <body>
    <main>
    <h1>Agenda</h1>
    <ul>
    <li>13 March: open class for beginners</li>
    <li>3 April: rehearsals start at the Old Mill</li>
    <li>1 May: spring gala</li>
    </ul>
    </main>
    </body>
    </html>
troupe-site-classes =
    <!doctype html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Classes, Kestrel Dance Company</title><link rel="stylesheet" href="/css/style.css"></head>
    <body>
    <main>
    <h1>Classes</h1>
    <p>Little movers (4-7): Wednesday 16:30. Teens: Wednesday 18:00. Contemporary, adults: Thursday 19:30. Gentle moves, 60 and over: Friday 10:00.</p>
    </main>
    </body>
    </html>
troupe-site-404 =
    <!doctype html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Not found</title></head>
    <body><main><h1>This page doesn't exist</h1><p><a href="/">Back to the home page</a></p></main></body>
    </html>

troupe-doc-register =
    member,group,joined,fee_paid
    Ayo Bankole,teens,2029-09,yes
    Ilka Carvalho,adults,2031-01,yes
    Kalani Akana,little movers,2031-09,no
    Rasmus Ekholm,gentle moves,2030-02,yes
    Wren Okonkwo,teens,2032-01,yes
troupe-doc-medical =
    dancer,group,emergency contact,phone,medical notes
    Kalani Akana,little movers,Malia Akana (mother),07700 900127,asthma (inhaler in bag)
    Ayo Bankole,teens,Folasade Bankole (aunt),07700 900341,none
    Wren Okonkwo,teens,Chidi Okonkwo (father),07700 900562,nut allergy
    Rasmus Ekholm,gentle moves,Saga Ekholm (daughter),07700 900718,knee replacement 2030
troupe-doc-minutes =
    Board meeting, 24 February 2032 (minutes)
    Present: Esperanza, Anahera, Linh, Farrukh, Siosaia.
    1. Accounts: the arts council grant was received; the 2031 report is due on 15 April.
    2. Gala: the Old Mill is booked for 1 May; Farrukh will film it.
    3. Fees: two families asked for the reduced rate, granted.
troupe-doc-consent =
    member,photos on the website,photos in the press
    Ayo Bankole,yes,no
    Ilka Carvalho,yes,yes
    Kalani Akana,no,no
    Rasmus Ekholm,yes,yes
    Wren Okonkwo,yes,no

troupe-office-report =
    Arts council: activity report 2031, Kestrel Dance Company
    1. Classes: 6 weekly classes, 112 members (31 under 12, 27 over 60).
    2. Spring gala 2031: 2 performances, 640 tickets, 14 free places for local families.
    3. Outreach: 9 workshops in two primary schools and the day centre.
    4. Accounts: grant of 6,000 spent on the studio's floor and the gala's lights (detail in budget-2032.csv).
    Written by Anahera, treasurer.
troupe-office-report-template =
    Arts council: activity report (TEMPLATE)
    1. Classes: [number of classes, members]
    2. Performances: [dates, tickets]
    3. Outreach: [workshops]
    4. Accounts: [how the grant was spent]
troupe-office-budget =
    item,2031,2032 (planned)
    studio rent,7200,7400
    teachers,9800,10200
    gala (hall and lights),2650,2800
    floor repair,3100,0
troupe-office-schedule =
    Spring rehearsals, Old Mill
    Saturdays 3 April to 24 April, 10:00-13:00: all groups.
    Wednesday 28 April, 18:00: dress rehearsal.
troupe-office-hall =
    To the Old Mill theatre: we confirm the booking of the main hall for
    Saturday 1 May 2032, from 9:00 to 23:00, for our spring gala.
troupe-office-running-order =
    Gala running order (draft 3)
    1. Little movers: The Kestrel's Nest
    2. Teens: Crossings
    3. Gentle moves: Tea at Four
    4. Adults: Tidewater
    5. Everyone: finale
troupe-office-thanks =
    Dear friends of the bakery on Mill Lane, thank you for the cakes at
    every rehearsal: the dancers send their warmest thanks.
troupe-office-joiners =
    name,group,start
    Noa Benali,teens,2032-04
    Bea Ferreira,adults,2032-04
troupe-office-old-plan =
    Winter plan (cancelled): rehearsals in January at the church hall.
