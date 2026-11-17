### Story "Next Door Windows", chapter "Invisible Characters": a script
### written on Windows (CR LF line endings) that bash can't run, how to see
### it, convert it and keep git from bringing it back. Commands, file
### contents and tool outputs are not translated.

chapter-line-endings = Invisible Characters
    .summary = A backup script written on a Windows laptop won't even start on Linux: find the invisible character at the end of every line, convert the file, and make git keep it right.

## Shared by the story

mixed-fleet-ops-readme =
    ops - the Drawing Office's scripts (compass)

    nightly-copy.sh    nightly copy of /srv/projects/current to /srv/nightly
                 (cron, 01:30, as you)

    Write them anywhere, push them here, run them on compass.
    Henrik

mixed-fleet-project-notes =
    Current projects - Drawing Office
    harbour-library: facade revision C, due 30 November
    school-canteen: kitchen layout, client review on Friday

mixed-fleet-plotter-conf =
    # Plotter - exports the drawings to PDF every morning at 06:00
    {"["}export]
    source = /srv/projects/current
    target = /mnt/plans/exports
    user = plotter

mixed-fleet-templates-readme =
    Title blocks and templates of the Drawing Office. Ask Ifeoma before changing them.

mixed-fleet-handover =
    cabinet - handover notes (Priya, contractor), 28 October 2029

    Windows Server 2022 Standard, file server of the Drawing Office.
    C: system (100 GB), D: Data (500 GB): the shares live on D:\Shares.

    Shares: plans (D:\Shares\plans): projects, PDF exports, templates.
            scans (D:\Shares\scans): the copier drops its scans there.
    compass reaches plans with the local account compass-svc.

    OpenSSH Server is on (built into Windows): ssh lands in PowerShell.
    Your key is in C:\ProgramData\ssh\administrators_authorized_keys
    (for administrators, Windows reads that file, not your profile's).

    SMB1 is off and stays off. Windows Update restarts the server on
    Tuesday nights, between 03:00 and 03:30.

    I look after this server on the first Monday of the month; for
    anything else, write to me what you saw, I'll take it from there.
    Priya

## Files

line-endings-email-ifeoma =
    From:  Ifeoma
    To:    you

    Hello, and welcome to the Drawing Office!

    Our servers are a bit of a mix. compass, where you are, is our Linux
    server: it keeps the backups of the projects and runs Plotter, the
    service that exports our drawings to PDF. Next to it, cabinet is the
    Windows server where everyone saves their plans; Priya, our
    contractor, installed it and looks after it.

    First thing: Henrik wrote a script for the nightly backup of the
    current projects, on his laptop (Windows), and put it in ~/ops, our
    scripts' git repository. It has never run: last night, /srv/nightly
    stayed empty, and when I try it myself it says something about a
    "bad interpreter". The file looks perfectly normal to me.

    Could you find out what's wrong with it, get one backup done, and make
    sure the next script that comes from a Windows machine doesn't do
    this again?

    Thank you!
    Ifeoma

## Events

line-endings-event-bad-interpreter =
    "/bin/bash^M: bad interpreter": the kernel read the #! line and looked
    for a program called /bin/bash followed by an invisible character,
    shown as ^M. That character is a carriage return (CR, \r, byte 0x0D):
    Windows ends each line with CR LF (\r\n), Linux with LF (\n) alone.
    Look at the file's bytes rather than its text: file, cat -A, od -c.
line-endings-event-carriage-return =
    "$'\r': command not found": bash prints the carriage return in $'…'
    quoting, the way it writes characters you can't see. For bash, the
    empty line 5 is a command named \r, and SRC holds "/srv/projects\r":
    that directory doesn't exist. Every line carries a \r at its end.
line-endings-event-chmod =
    The script was already executable (rwx in ls -l): rights were never
    the problem. The interpreter named on the first line is.
line-endings-event-crlf =
    There it is: every line ends with \r\n (^M$ for cat -A, \r \n for
    od -c, "with CRLF line terminators" for file). An editor on Windows
    writes that; bash only knows \n. Convert the file to Unix line
    endings (man dos2unix; sed and tr can do it too).
line-endings-event-converted =
    nightly-copy.sh is in Unix format now: no \r left, the commands untouched.
    Run it.
line-endings-event-ran =
    /srv/nightly/current is there: the backup ran. Now, so that Henrik's
    next push doesn't bring the \r back: tell git that these files are
    text with LF line endings (man gitattributes), and commit it with the
    converted script.
line-endings-event-committed =
    The repository now says that *.sh are text with LF line endings, and
    its script is in LF: whatever editor Henrik uses, git stores and
    checks out LF.
line-endings-event-end =
    Ifeoma: "It ran! And Henrik says he'll pull before he edits next
    time. Thank you."

    Well done! You have finished the chapter "Invisible Characters".

    WHAT HAPPENED
    Henrik's editor on Windows saved the script with CR LF line endings.
    On Linux, the carriage return (\r, ^M) became part of every line's
    last word: the #! line asked for "/bin/bash\r" (bad interpreter),
    bash run by hand took an empty line for a command named $'\r', and
    the variables kept a \r at the end of their values. You saw it with
    file, cat -A or od -c, converted the file, ran it, and added
    a .gitattributes so git keeps the repository's scripts in LF.

    GOOD PRACTICE
    - When a script "looks fine" but fails strangely, look at its bytes:
      file, cat -A (^M$ at each line's end), od -c (\r \n).
    - dos2unix (or sed -i 's/\r$//', or tr -d '\r' through a pipe) to
      convert; unix2dos for the other way.
    - In the repository, a .gitattributes with "*.sh text eol=lf" (or
      "* text=auto eol=lf"): git stores LF and writes LF on checkout,
      whatever the machine. Commit it first, then the files.
    - On Windows, editors can save in LF (VS Code, Notepad++), and git's
      core.autocrlf setting converts on checkout; .gitattributes wins,
      and travels with the repository.

    ANOTHER WAY
    WSL (the Windows Subsystem for Linux) runs a real Linux on the
    laptop: a script written and tested there has LF endings and meets
    bash before it meets compass.

    DOCUMENTATION
    - dos2unix(1): https://waterlan.home.xs4all.nl/dos2unix/dos2unix.htm
    - gitattributes, the eol and text attributes: https://git-scm.com/docs/gitattributes
    - bash, ANSI-C quoting ($'…'): https://www.gnu.org/software/bash/manual/bash.html#ANSI_002dC-Quoting
