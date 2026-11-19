### Story "The Pool", chapter "The Locker Room": the database password sits
### in a ConfigMap and in clear in a git repository shared with the town's
### IT. A Secret, secretKeyRef, rollout restart, base64 that is not
### encryption, git's history. Commands, resource names, fields and outputs
### are not translated.

chapter-locker-room = The Locker Room
    .summary = The booking app's database password sits in a ConfigMap, and in clear in the manifests' git repository, which the town's IT can read. It was changed this morning on the database: put the new one in a Secret, take the old one out of the files, and make sure the pods use it.

## Files

locker-room-message-folake =
    From: Folake (Riverside Pool, front office)
    Monday 18 June, 9:05

    Hello,

    Kemal called me at 8:50, a bit worried: he found the database's
    password written in clear in the manifests that Rui shares with the
    town's IT. He says anyone at the town hall who can read that
    repository could have read it, so he changed it on the database
    right away. His note is next to this message.

    The site still works. Kemal says it's only "until the next restart".
    I don't know what that means, but it doesn't sound good.

    Folake
locker-room-note-kemal =
    Note from Kemal (town IT)

    Last Tuesday we turned on password authentication on
    db.pool.internal, and Rui put the password of the booking account in
    the ConfigMap, so in ~/manifests/config.yaml, which he commits and
    pushes to /srv/git/pool-manifests.git: the repository I pull, and
    that half of the town's IT can read.

    At 9:00 I changed that account's password on the database. The new
    one is in ~/new_db_password.txt (only you can read it). The pods that
    run keep the connections they opened; but a pod that starts now with
    the old password won't get in.

    What's needed:
    - the new password in a Kubernetes Secret, not in a ConfigMap;
    - the app reading it from there (the ConfigMap still gives it
      database_host);
    - pods that really use it;
    - nothing secret left in the files, and the fixed files pushed.

    Kemal

## Git

pool-commit-1 = booking app on k3s
pool-commit-2 = 2.3.1, a Service and an Ingress
pool-commit-3 = The database now asks for a password

## Events

locker-room-event-config-read =
    There it is, in clear: the old password, in the ConfigMap and in
    config.yaml. A ConfigMap is for settings anyone may read (kubectl get
    configmap -o yaml shows it all); a password goes in a Secret.
locker-room-event-history-seen =
    git's history keeps every version of every file: the old password
    stays in the commit that added it, and in every clone of the
    repository, even once the file is fixed. Rewriting history wouldn't
    reach the copies others already have. That is why Kemal changing it on
    the database was the real fix: the one in the history no longer opens
    anything.
locker-room-event-old-secret =
    This Secret holds the old password, the one written in the
    repository: Kemal changed it on the database at 9:00, so a pod that
    starts with it won't get in. The new one is in ~/new_db_password.txt.
locker-room-event-auth-failed =
    "password authentication failed for user "booking"": the database
    refuses the password this container started with. Which password does
    the template give it, and is it the one in ~/new_db_password.txt?
locker-room-event-newline =
    This Secret holds the password followed by a newline: --from-file
    takes the whole file, and the file ends with one. The database would
    refuse it. Use --from-literal (or a file without the newline).
locker-room-event-secret-created =
    The Secret holds the new password. Look at it with kubectl get secret
    NAME -n swim -o yaml: is it hidden?
locker-room-event-decoded =
    base64 is an encoding, not encryption: anyone who can read the Secret
    gets the password back with one command. A Secret is safer than a
    ConfigMap because of what is done around it: who may read it (RBAC),
    how it is stored (etcd encryption), and that it stays out of the
    repository.
locker-room-event-base64-config =
    The password in base64 in the ConfigMap is still the password: base64
    -d gives it back to anyone. It's not where it is written that changes;
    it's who may read it. Put it in a Secret.
locker-room-event-config-deleted =
    The ConfigMap booking-config is gone, but the app still takes
    database_host from it: the next pod to start will stay in
    CreateContainerConfigError. Take the password out of it; keep the rest.
locker-room-event-literal =
    The password is now written in the Deployment itself (value:), so in
    booking.yaml, so in the repository. Reference the Secret instead
    (valueFrom.secretKeyRef).
locker-room-event-referenced =
    The Deployment's template now takes DATABASE_PASSWORD from the Secret.
locker-room-event-config-cleaned =
    The ConfigMap no longer holds a password, and still gives the app its
    database_host.
locker-room-event-stale-env =
    The template gives the new password, but some running pods started
    with the old one: a container reads its environment variables once,
    when it starts. Changing a Secret or a ConfigMap restarts nothing.
    kubectl rollout restart deployment/booking -n swim replaces the pods
    one by one, without a cut.
locker-room-event-restarted =
    Every booking pod now runs with the new password, read from the
    Secret.
locker-room-event-secret-file =
    { $file } in ~/manifests holds the password (in clear, or in base64,
    which is the same): it would go into the repository with the rest.
    Keep it out of the repository (kubectl create secret generic needs no
    file), then remove it from there.
locker-room-event-committed =
    The last commit no longer holds a password. Kemal pulls from the
    shared repository: is it there too?
locker-room-event-pushed =
    The shared repository is up to date: what Kemal pulls holds no
    password any more (but its history still holds the old one: see git
    log -p).
locker-room-event-drift =
    The pods use the Secret, but the files in ~/manifests don't say so:
    the next kubectl apply -f ~/manifests/ would put the password back in
    the ConfigMap. Fix the files and apply them.
locker-room-event-end =
    Kemal: "Perfect. The old password opens nothing any more, the new one
    is in a Secret only the cluster's admins can read, and the repository
    has nothing left to hide. I'll tell the security officer."

    Well done! You finished The Locker Room.

    WHAT HAPPENED
    The database's password sat in a ConfigMap, so in config.yaml, so in
    a git repository the town's IT could read. Kemal changed it on the
    database: the running pods kept their connections, but any new start
    would have failed. You put the new password in a Secret, had the
    Deployment read it with secretKeyRef, took it out of the ConfigMap
    (which still gives database_host), replaced the pods so that they read
    it (an environment variable is read once, when the container starts),
    and pushed files without it.

    GOOD PRACTICE
    - A password goes in a Secret, never in a ConfigMap, and never in the
      repository. kubectl create secret generic --from-literal needs no
      file; --dry-run=client -o yaml shows what it would create.
    - base64 is an encoding: a Secret is protected by who may read it
      (RBAC: get, list and watch on secrets are as good as the password),
      by etcd's encryption at rest (k3s server --secrets-encryption), and
      by staying out of git. Tools such as Sealed Secrets or an external
      vault keep them out of the repository for good.
    - A secret that leaked is changed at its source (rotation). git's
      history and its copies keep the old one forever: rewriting history
      doesn't make a password secret again.
    - Variables are read at start: after changing a Secret, kubectl
      rollout restart. A Secret mounted as a volume is updated by the
      kubelet within a minute or so (but not through subPath), and the app
      must read the file again.

    DOCUMENTATION
    - Secrets: https://kubernetes.io/docs/concepts/configuration/secret/
    - Good practices for Secrets: https://kubernetes.io/docs/concepts/security/secrets-good-practices/
    - Configure a Pod to use a ConfigMap: https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/
    - Distribute credentials securely using Secrets: https://kubernetes.io/docs/tasks/inject-data-application/distribute-credentials-secure/
    - Encrypting data at rest: https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/
    - Secrets encryption in k3s: https://docs.k3s.io/security/secrets-encryption
