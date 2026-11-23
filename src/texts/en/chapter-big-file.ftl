### Story "The Dance Troupe", chapter "The Big File": a presigned URL for a
### week with a key of its own, and a failed Garage node replaced in the
### layout. Commands, options, paths, node IDs and outputs are not
### translated.

chapter-big-file = The Big File
    .summary = A festival wants the film of the spring gala, nearly 4 GB, for a week. Share it without opening the bucket to the world. And one of the three machines that keep the troupe's files has died: is the data safe, and how does the new machine take its place?

## Files

big-file-message-farrukh =
    From: Farrukh (video)
    Thursday 13 May, 10:05

    Hello! Zuri, who produces the Harbourlight festival, wants the full
    film of our spring gala for her selection committee: they meet next
    week. The file is in the media bucket:
    videos/spring-gala-2032-full.mp4 (3.8 GB, far too big for an email).

    She must be able to download it with a simple link, from her office,
    for a week: no account, no software. Can you put the link in
    ~/link_for_zuri.txt? I'll send it to her.

    I'd rather not make the bucket public: our rehearsals are in it too.

    Farrukh

big-file-message-siosaia =
    From: Siosaia
    Wednesday 12 May

    Hi! The machine that holds porch, at my place, died on Tuesday morning
    (its disk, I think: it clicks). I installed Garage on my spare
    computer, with the same garage.toml as Teodora's (same rpc_secret),
    and it's connected: sudo garage status should show it. It has a 4 TB
    disk. I didn't dare touch the layout, Teodora said it's the dangerous
    part. Is our data still safe?

    Siosaia

big-file-notes-teodora =
    Notes from Teodora (wings, the cluster)

    - replication_factor = 3: every piece of data is on three nodes, one
      per zone: studio (wings), mill (vault), home (porch). Garage needs
      two answers out of three to read or write (a quorum).
    - The layout is who stores what: each node's role (zone, capacity).
      Changes are staged first (garage layout assign, remove), shown with
      garage layout show, and only applied with garage layout apply
      --version N.
    - A node is known by its ID (a long hexadecimal string; its first
      characters are enough on the command line), not by its host name.
    - Sharing a file: aws s3 presign gives a link signed with a key, that
      works for a limited time.

## Events

big-file-event-failed-node =
    porch is a failed node: it still has its role in the layout (zone home),
    and Garage hasn't heard from it for two days. The new machine is there
    too, healthy, with "NO ROLE ASSIGNED": connected, but storing nothing.
    How many copies does each piece of data still have?

big-file-event-safe =
    Three copies were planned, one per zone; with porch down, two remain,
    on wings and vault. Garage reads and writes with two answers out of
    three: everything still works. But one more failure and the data would
    be unreachable: the new node should take porch's place soon.

big-file-event-too-long =
    Garage refuses that link: "X-Amz-Expires may not exceed a week". A
    presigned URL (Signature Version 4) lasts at most 604800 seconds, seven
    days; aws s3 presign signs any duration without checking, and the error
    only shows when someone uses the link.

big-file-event-public-media =
    With website access, the web endpoint serves every object of media to
    anyone, the rehearsals and the photos of children included, and for as
    long as nobody turns it off. A link that expires, for this one object,
    does the job without that.

big-file-event-wide-key =
    That link works, but think about its key: a presigned URL acts with the
    rights of the key that signed it, and can't be revoked by itself. Signed
    with a key that can write, or that other tools use, the only way to cut
    it early is to take those rights from everyone using the key. A key made
    for this share, that can only read media, can be deleted the day the
    committee is done.

big-file-event-local-url =
    That link names a host only wings knows (localhost, or wings itself):
    from Zuri's office, it leads nowhere. The public endpoint is
    s3.kestrel.example (the endpoint_url of ~/.aws/config).

big-file-event-read-key =
    A key that can only read media: a link signed with it can never write
    or delete anything, and deleting the key revokes every link it signed.

big-file-event-shared =
    The link is ready: one object, a week at most, signed with a key that
    can only read media, on the public endpoint. The bucket stays private.

big-file-event-staged =
    The change is staged, not applied: garage layout show tells what the
    new layout would be, and the version to give garage layout apply.

big-file-event-same-zone =
    The new node is in the same zone as another one: Garage places at most
    one copy per zone when it can, so with two zones left, two copies of
    each piece of data end up in one building. A fire or a flood there,
    and they are both gone. porch's replacement belongs to porch's zone.

big-file-event-replaced =
    The new node has taken porch's role: three nodes in three zones again.
    Garage now copies the missing pieces onto it (garage stats shows the
    resync queue); the old porch has left the layout.

big-file-event-end =
    Farrukh: "Zuri downloaded it in twenty minutes. Thanks!"
    Siosaia: "garage status is all green, and my old disk can retire."

    Well done! You finished The Big File.

    WHAT HAPPENED
    The gala's film had to reach a festival without making the media bucket
    public: you made a key that can only read media and signed a presigned
    URL with it, for a week, the longest Signature Version 4 allows. Then
    the cluster: porch had failed, and its data still had two copies of
    three, enough for Garage's quorum. You gave porch's role to the new
    node, in the same zone, and applied the new layout.

    GOOD PRACTICE
    - Share an object, not a bucket: a presigned URL gives one object, for
      a limited time, to whoever has the link (treat it like a password).
    - Sign it with a key made for the share, read-only: deleting the key
      revokes the link early. A link can't last more than seven days; for
      longer, sign a new one.
    - Keep replicas in different places (zones): a node's replacement goes
      in its zone. With three copies, Garage keeps working when one node is
      down, but repair before the next failure.
    - Change a layout in two steps: stage, read garage layout show, then
      apply with the version it gives.

    ANOTHER WAY
    garage layout remove followed by garage layout assign does the same as
    --replace. For a long-term share, a separate bucket with website
    access and only what is meant to be public is an option; Amazon S3 and
    MinIO also have bucket policies, which Garage doesn't implement.

    DOCUMENTATION
    - aws s3 presign: https://awscli.amazonaws.com/v2/documentation/api/latest/reference/s3/presign.html
    - Presigned URLs and their seven days: https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
    - Garage, recovering from failures: https://garagehq.deuxfleurs.fr/documentation/operations/recovering/
    - Garage, the cluster layout: https://garagehq.deuxfleurs.fr/documentation/operations/layout/
