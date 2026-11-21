### Story "The Tool Library", chapter "The Leaky Pipeline": a CI workflow
### that hands the deploy key to a fork's pull request and prints it.
### Commands, options, paths, API routes and outputs are not translated.

chapter-leaky-pipeline = The Leaky Pipeline
    .summary = The CI that tests Lendshed's pull requests and publishes its documentation printed the deploy key in a public log, and gave it to the code of any fork. Find the leak, rotate the key, and rebuild the pipeline so that a contributor's code is tested without ever touching a secret.

## Files

leaky-pipeline-message-rosa =
    From: Rosa (maintainer)
    Wednesday 13 November, 13:40

    Hi! Something odd in the CI. I was reading the run of Kwame's pull
    request (#57, his Swahili translation) and the "test" job prints a
    huge line of letters and numbers under a step called "Show deploy
    configuration". Tomasz added that step in February "to debug the
    deploy", and the workflow has been like that ever since.

    Our repository is public, and so are its runs and their logs.

    The CI is .forgejo/workflows/ci.yml in the repository (your clone is
    in ~/lendshed). The runs are in the API (man forgejo-api), and each
    job's log is a plain web page. The documentation is published by the
    "deploy" job as the deploy account on anvil (deploy@anvil.internal),
    with the key stored in the forge's DEPLOY_KEY secret.

    Your API token is still in ~/.forgejo-token.

    Rosa

## Events

leaky-pipeline-kwame-sync = (Kwame rebased his pull request #57 on the new main: the CI ran again on it.)
leaky-pipeline-event-runs =
    The forge's runs: pushes to main, and Kwame's pull request #57, run
    on pull_request_target. Each job has its log (logs_url); for a public
    repository, anyone can read it.
leaky-pipeline-event-log =
    The "Show deploy configuration" step prints a long line: base64. The
    runner masks the secrets it knows in the logs (*** in their place), but
    only their exact text: once encoded, the secret is just another line.
    What is it? base64 -d reads it back.
leaky-pipeline-event-decoded =
    It's the deploy key: an OpenSSH private key, in a public log since
    February, and given to every pull request's code on top of that. It
    must be considered stolen: hiding the log now changes nothing. A
    leaked key is rotated: a new key, the old one refused, the secret
    updated. And the workflow, how does it give a fork the key?
leaky-pipeline-event-workflow =
    There's the pattern GitHub's security lab calls a "pwn request":
    pull_request_target runs the base branch's workflow with the
    repository's secrets, so that a workflow can comment on a pull request;
    but this one checks out the pull request's own code
    (github.event.pull_request.head.sha) and runs it, with DEPLOY_KEY in
    the whole workflow's environment. A fork's pip install or test file
    could read it. A pull request's code must be tested with
    pull_request, which gives a fork no secrets; the key belongs to the
    deploy step only, on a push to main.
leaky-pipeline-event-old-key-gone =
    The leaked key is no longer in the deploy account's authorized_keys:
    whoever copied it gets "Permission denied". The documentation can't be
    published until a new key is in place.
leaky-pipeline-event-unrestricted =
    A key in authorized_keys without any option can do everything the
    deploy account can: a shell, port forwarding... For a CI's key,
    restrict it: restrict, from="192.0.2.80" (the runner's address), and
    command="rrsync /srv/www/docs", which only allows rsync into that
    directory (man authorized_keys in sshd's manual, rrsync).
leaky-pipeline-event-new-key =
    A new, restricted key for the deploy account. Its private half must
    now go into the forge's DEPLOY_KEY secret (PUT
    /repos/OWNER/REPO/actions/secrets/NAME, a JSON body {"{"}"data": "…"{"}"}),
    and then off this machine.
leaky-pipeline-event-json-error =
    Forgejo can't read the JSON: a private key has line breaks, and a JSON
    string may not hold raw newlines; they must be written \n. jq builds
    the JSON properly: jq -Rs '{"{"}data: .{"}"}' < KEY reads the file as a
    single string. Careful too: curl -d @FILE strips newlines from the
    file it sends; --data-binary @FILE keeps them.
leaky-pipeline-event-secret =
    The DEPLOY_KEY secret now holds the new key (the forge never shows a
    secret's value again: only its name and date). Delete your local copy
    of the private key once it's stored.
leaky-pipeline-event-pushed =
    main has moved: the forge ran the push workflow, and Kwame will update
    his pull request on top of it.
leaky-pipeline-event-no-ci =
    There's no workflow left on main: no more leak, but no more tests on
    pull requests either, and no documentation published. The CI must stay;
    it must just stop handing secrets to untrusted code.
leaky-pipeline-event-still-exposed =
    Kwame's latest run still gives the secrets to the fork's code, or still
    prints one. Look at the runs and their logs again: which event, which
    code is checked out, where DEPLOY_KEY is in the environment.
leaky-pipeline-event-untested =
    Kwame's run no longer touches the key, but it no longer tests his code
    either: pull_request_target with the base branch's checkout tests main,
    not the pull request. Test pull requests on pull_request: their own
    code, without secrets.
leaky-pipeline-event-masked-only =
    The workflow is safe now, but the leaked key still opens the deploy
    account: it was public for nine months. Rotate it.
leaky-pipeline-event-safe =
    Kwame's latest run: his code tested on pull_request, without any
    secret, nothing printed. Even a malicious fork could only break its
    own run.
leaky-pipeline-event-stale-context =
    The required status check on main still names "ci / test
    (pull_request_target)": that context will never come again, and no
    pull request could be merged. Update the protection with the context
    the pull request reports now.
leaky-pipeline-event-context =
    The protection now waits for the context the CI really reports on pull
    requests.
leaky-pipeline-event-deploy-failed =
    The deploy job of the last push failed: look at its log. The key in
    the secret, the line in authorized_keys and its options (from=, the
    rrsync directory) must agree. Once fixed, a new push to main runs it
    again (git commit --allow-empty, for instance).
leaky-pipeline-event-deployed =
    The last push to main deployed the documentation with the new key,
    the only one the deploy account accepts.
leaky-pipeline-event-end =
    Rosa: "So the key was out for nine months... and it's worthless now.
    Kwame's runs are green, and nobody's code but ours ever sees a secret.
    Thank you!"

    Well done! You finished The Leaky Pipeline.

    WHAT HAPPENED
    The CI ran pull requests on pull_request_target, which gives the
    repository's secrets to the workflow, and checked out the fork's code;
    the deploy key was in every job's environment, and a debug step
    printed it in base64, past the log masking. The key had leaked in
    public logs. You decoded it to be sure, rotated it (a new key,
    restricted with rrsync and from=, the old one removed, the forge's
    secret updated through the API), rewrote the workflow (pull requests
    tested on pull_request without secrets, the deploy only on a push to
    main, the key in its step only), and checked the next runs.

    GOOD PRACTICE
    - Untrusted code (a fork's pull request) never runs where a secret is:
      pull_request, not pull_request_target with the head checked out.
    - A secret is in the environment of the step that needs it, nowhere
      else; never printed, not even encoded: masking only knows its exact
      text.
    - A leaked secret is rotated, not hidden.
    - A CI's deploy key is restricted on the server: restrict, from=,
      command= (rrsync for rsync).
    - Required status checks follow the workflow's contexts.

    DOCUMENTATION
    - Forgejo Actions, events: https://forgejo.org/docs/latest/user/actions/reference/
    - Forgejo Actions, security: https://forgejo.org/docs/latest/user/actions/security/
    - GitHub Security Lab, preventing pwn requests: https://securitylab.github.com/resources/github-actions-preventing-pwn-requests/
    - sshd, AUTHORIZED_KEYS FILE FORMAT: https://man.openbsd.org/sshd#AUTHORIZED_KEYS_FILE_FORMAT
