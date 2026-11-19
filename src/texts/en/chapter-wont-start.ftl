### Story "The Pool", chapter "The Pod That Won't Start": a Deployment's
### new release never starts (a wrong image tag, then a setting renamed).
### kubectl get, describe and its Events, logs --previous, apply -f,
### rollout status. Commands, resource names, fields and outputs are not
### translated.

chapter-wont-start = The Pod That Won't Start
    .summary = The pool's booking app runs on a small Kubernetes cluster, and this morning's release never started. Registration for the summer lessons opens at nine: find out why the new pod won't start, and fix it where it belongs.

## Files

wont-start-message-folake =
    From: Folake (Riverside Pool, front office)
    Monday 4 June, 8:35

    Hello, and thank you for coming so early!

    Registration for the summer swimming lessons opens at 9:00 on the
    booking site, and it needs version 2.3.1 of the app. Rui deployed it
    this morning on lane, our Kubernetes server, just before taking his
    train, and he texted me: "the new pod doesn't start, no time, sorry!".

    The site still answers, with the old version. Can you get the new one
    running before 9:00?

    Rui's files are in ~/manifests, and his note is next to this message.

    Folake
wont-start-note-rui =
    Note from Rui

    lane runs k3s, a one-machine Kubernetes. kubectl works with your
    account (~/.kube/config). Everything of the booking app is in the swim
    namespace: a Deployment, booking (two pods), and its settings, the
    ConfigMap booking-config.

    The manifests are in ~/manifests; I change them, then:
      kubectl apply -f ~/manifests/

    Releases are in the town's registry, registry.pool.example/booking:
    2.2.0 (what ran until today), 2.3.0, 2.3.1.

    Rui

## Events

wont-start-event-default-namespace =
    Nothing in the default namespace: the booking app lives in swim. Add
    -n swim to your commands (or make swim your context's namespace: man
    kubectl, the examples).
wont-start-event-pods =
    The new pod is stuck in ErrImagePull, then ImagePullBackOff: the node
    can't get its image, and tries again less and less often (10 s, 20 s,
    40 s… up to 5 minutes). The two old pods still run: a rolling update
    removes them only once new ones are available. Why can't the image be
    pulled? kubectl describe pod NAME -n swim: the Events at the end.
wont-start-event-pull-error =
    "not found": the registry answers, but has no such tag. Compare the
    image the Deployment asks for with the releases in Rui's note.
wont-start-event-pod-deleted =
    The pod is gone… and another one took its place, with the same error.
    A pod of a Deployment belongs to a ReplicaSet, which keeps the number
    of pods it was asked for: the fix is in the Deployment's template, not
    in its pods.
wont-start-event-run =
    kubectl run starts a lone pod: no ReplicaSet watches it, the Service
    and the Deployment don't know it, and if the node restarts nobody will
    start it again. It can help to try an image, but it fixes nothing: the
    Deployment still asks for the same thing. Delete it when you are done
    (kubectl delete pod NAME -n swim).
wont-start-event-pod-edited =
    You changed a pod, not its Deployment. Its ReplicaSet still has the
    old template: the next pod it makes (a restart, a node that reboots, a
    scale) will come back with the old values. Fix the template, in
    ~/manifests/booking.yaml, and apply it.
wont-start-event-tag-fixed =
    The Deployment asks for registry.pool.example/booking:2.3.1 now: a new
    ReplicaSet (a new pod-template-hash) starts its pods. Watch them: kubectl
    get pods -n swim.
wont-start-event-crash =
    The image is there, the container starts… and stops at once:
    CrashLoopBackOff. The kubelet restarts it, waiting longer each time
    (RESTARTS goes up). What did it say before stopping? kubectl logs POD -n
    swim (add --previous once it has restarted: the instance that crashed).
wont-start-event-logs =
    The app says it: since 2.3.0 it reads DATABASE_HOST, and no longer
    DB_HOST. In the template, the variable keeps the value from the
    ConfigMap (the key database_host); only its name has to change.
wont-start-event-config-error =
    CreateContainerConfigError: the kubelet can't build the container's
    environment, because a ConfigMap or one of its keys doesn't exist. The
    key is the name in the ConfigMap (kubectl get configmap booking-config
    -n swim -o yaml); the variable's name is what the app reads.
wont-start-event-env-fixed =
    The template now gives DATABASE_HOST to the container. kubectl rollout
    status deployment/booking -n swim follows the rollout until it
    finishes (or fails).
wont-start-event-rolled-out = The new release runs on both pods, and the old ones are gone.
wont-start-event-drift =
    The cluster runs the right version, but ~/manifests/booking.yaml still
    describes the old one: the next kubectl apply -f ~/manifests/ would
    put the mistakes back. Bring the file in line with what runs, and apply
    it (it should then say unchanged).
wont-start-event-lone-pod =
    One more thing: the pod { $pod } is still there, and nobody manages it.
    Delete it.
wont-start-event-end =
    Folake: "8:56! The page shows 2.3.1, the first families are signing
    up. Rui will be relieved."

    Well done! You finished The Pod That Won't Start.

    WHAT HAPPENED
    A Deployment keeps a pod template; each version of it gets its own
    ReplicaSet, which keeps the pods. Rui's new template asked for the
    image tag 2.31: the registry has no such tag, so the node's containerd
    failed to pull it (ErrImagePull), and the kubelet tried again less and
    less often (ImagePullBackOff). Meanwhile the rolling update kept the
    two old pods, since no new one was available. With 2.3.1, the
    container started and crashed (CrashLoopBackOff): release 2.3.0 had
    renamed DB_HOST to DATABASE_HOST, as the crashed container's log said.
    The fix went into the manifest, then kubectl apply, and the rollout
    replaced the old pods one by one.

    GOOD PRACTICE
    - Read in order: kubectl get pods (the state), kubectl describe pod
      (the Events say why), kubectl logs --previous (what the app said
      before it crashed).
    - Fix the Deployment, never its pods: a deleted pod comes back, an
      edited pod is forgotten at the next restart.
    - The manifests are the truth: change the file, kubectl apply -f, and
      check that a second apply says unchanged. A kubectl edit or set image
      that the file doesn't know is undone by the next apply.
    - kubectl rollout status waits for the end of a rollout; a rollout
      that stays stuck ends with ProgressDeadlineExceeded (10 minutes by
      default), and kubectl rollout undo goes back to the previous
      template.
    - minReadySeconds and readiness probes keep a rollout from removing
      old pods too early.

    DOCUMENTATION
    - Debugging pods: https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/
    - A pod's lifecycle: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/
    - Images and ImagePullBackOff: https://kubernetes.io/docs/concepts/containers/images/
    - Deployments and rolling updates: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
