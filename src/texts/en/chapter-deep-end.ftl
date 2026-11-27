### Story "The Pool", chapter "The Deep End": the swim meet's load, memory
### limits copied from a tutorial (OOMKilled, exit code 137), a release
### with a memory leak. kubectl top, describe's Last State, rollout history
### and undo, requests and limits from what was measured. Commands,
### resource names, fields and outputs are not translated.

chapter-deep-end = The Deep End
    .summary = Saturday is the regional swim meet, and everyone follows the timetable and the results on the booking app. Since this morning its pods keep restarting. Measure what the app really uses, find out why it is killed, and give it the room it needs, no more.

## Files

deep-end-message-folake =
    From: Folake (Riverside Pool, front office)
    Saturday 23 June, 9:15

    Hello, sorry to call you on a Saturday!

    It's the regional swim meet today: two hundred swimmers, their clubs,
    their families, and everyone looks at the timetable and the results
    on the booking site. Since the start at 8:00 it only says "404 page
    not found". Last Saturday it held all morning.

    Rui put a new version in last night (his note is here). He's at the
    meet, as a timekeeper: he can't touch his phone before noon.

    Folake
deep-end-note-rui =
    Note from Rui (Friday, 18:20)

    I've applied the new release: a cache of results, so that the
    timetable page is faster tomorrow. I've also added memory requests and
    limits, as the Kubernetes tutorial does: it's cleaner. The pods
    started fine.

    Rui

## Events

deep-end-event-oom =
    OOMKilled, exit code 137 (128 + 9: killed by SIGKILL): the container
    used more memory than its limit, and the kernel killed it. The kubelet
    starts it again, less and less often (CrashLoopBackOff). How much
    memory does the app use, and how much is it allowed?
deep-end-event-top =
    kubectl top asks the metrics-server what each pod uses right now
    (kubectl top node for the whole machine). Compare it with the limit in
    the Deployment; under the meet's load it moves from minute to minute:
    look more than once, the peak is what counts.
deep-end-event-history =
    kubectl rollout history lists the Deployment's revisions, with their
    CHANGE-CAUSE: 2.4.0 brought a new cache yesterday. A Deployment keeps
    its previous ReplicaSets: going back is one command.
deep-end-event-leak =
    The results cache grows with every request and never forgets: 2.4.0's
    memory climbs as long as it runs, whatever room it is given. That's a
    leak; no limit fixes it. The version that held the last meet is 2.3.1.
deep-end-event-pending =
    "0/1 nodes are available: 1 Insufficient memory": the scheduler only
    places a pod where its requests fit in what the node can still give
    (kubectl describe node: Allocatable, Allocated resources). It stays
    Pending, and the rolling update waits. Requests are what the pod is
    sure to get: ask for what it uses, not for the whole node.
deep-end-event-whole-node =
    A limit of more than a gigabyte, on a node of 4 GiB for everything
    (k3s, Traefik, the other pods): the app has never needed a quarter of
    that. A limit is a safety net set a little above the measured peak; a
    leak would then fill the node before it was stopped.
deep-end-event-no-limits =
    No memory limit any more: a container may now take all the node's
    memory. With a leak, the node's kubelet would start evicting pods, or
    the kernel's OOM killer would pick a process, maybe k3s itself. Keep a
    limit, above the measured peak.
deep-end-event-pods-deleted =
    Deleting the pods only brings back new ones, with the same limit and
    the same image: they are killed the same way. The fix is in the
    Deployment's template.
deep-end-event-leak-fills =
    Even with more room, 2.4.0 got OOMKilled again: its memory kept
    growing until it reached the new limit. Look at what it logs (kubectl
    logs), and at the Deployment's history.
deep-end-event-undo-leaky =
    kubectl rollout undo goes back one revision: the one before the
    current is still 2.4.0. kubectl rollout history lists them, and
    --to-revision picks one (kubectl rollout history … --revision=N shows
    what it holds).
deep-end-event-rolled-back =
    The Deployment runs 2.3.1 again. Is it in the files, and does it have
    room enough for the meet's peak?
deep-end-event-below-peak =
    This limit is below what 2.3.1 uses at the meet's busiest minutes: at
    the peak, it would be killed again. Measure it (kubectl top pod, more
    than once) and set the limit above the peak, with a margin.
deep-end-event-limit-raised =
    The memory limit is now above the meet's peak.
deep-end-event-requests-low =
    The requests are far below what the app uses under load: the
    scheduler reserves that much, and might place other pods where the
    app then needs the room. Ask for what it usually uses (kubectl top
    pod).
deep-end-event-requests =
    Requests that reserve what the app uses, a limit above its peak: the
    pods are scheduled, and the kernel leaves them alone.
deep-end-event-drift =
    The pods run as they should, but ~/manifests/booking.yaml still says
    otherwise: the next kubectl apply -f ~/manifests/ would put back 2.4.0
    or the old limits. Write it in the file and apply it.
deep-end-event-end =
    Folake: "The results are on the screens and on everyone's phones! Rui
    says, between two races, that he'll try his cache on a quiet weekday
    next time."

    Well done! You finished The Deep End.

    WHAT HAPPENED
    Rui's limits, copied from a tutorial (128Mi), were fine on a quiet
    evening; under the meet's load the app needs up to 230Mi, so the
    kernel killed each container as soon as it was busy (OOMKilled, exit
    code 137) and the site lost its pods one after the other. And 2.4.0's
    results cache never forgets: given more room, it fills it too. You
    went back to 2.3.1, and set requests and limits from what was
    measured, in the file.

    GOOD PRACTICE
    - Measure before setting: kubectl top pod and node, at the busiest
      time (better: a history, from Prometheus). Requests: what the app
      usually uses (the scheduler reserves it). Memory limit: above the
      measured peak, with a margin.
    - OOMKilled: kubectl describe pod, Last State: Terminated, Reason:
      OOMKilled, Exit Code: 137; kubectl get pods counts the restarts.
    - Memory that keeps growing is a leak: a bigger limit only delays the
      kill. Roll back (kubectl rollout undo, or the previous image in the
      file), then look for the cause on a quiet day.
    - Requests bigger than the node: the pod stays Pending
      (FailedScheduling: Insufficient memory). No limit at all: one leak
      can take the whole node.
    - kubectl rollout undo changes what runs, not the files: write the
      fix in the manifest too.

    DOCUMENTATION
    - Resource Management for Pods and Containers: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
    - Assign Memory Resources to Containers and Pods (exceeding a limit, OOM): https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/
    - Node-pressure Eviction: https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/
    - Rolling back a Deployment: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-back-a-deployment
    - kubectl top: https://kubernetes.io/docs/reference/kubectl/generated/kubectl_top/
