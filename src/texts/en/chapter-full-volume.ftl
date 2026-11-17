### Story "Next Door Windows", chapter "The Other Side": the share's volume
### is full, but not because of the share; a look inside the Windows server
### through its OpenSSH and PowerShell, read only. Commands, cmdlets,
### paths and outputs are not translated.

chapter-full-volume = The Other Side
    .summary = The Windows share is full while the share itself isn't: go and look inside the Windows server through its OpenSSH, read it with a few PowerShell cmdlets, and write down what fills the disk for the person who looks after it.

## Files

full-volume-email-ifeoma =
    From:  Ifeoma
    To:    you

    Hello,

    Plotter didn't manage to save this morning's PDFs on cabinet: "No
    space left on device", says its log (/var/log/plotter/export.log).
    That's strange: our plans aren't that big, and nobody added anything
    this week, as far as I know.

    Priya comes on the first Monday of the month, and she's the one who
    administers cabinet: please don't change anything on it. But you have
    an account there (she put your key on it), and she says it's
    "OpenSSH, built into Windows". Could you go and look at what fills it,
    and write down what you find in cabinet-report.txt? I'll send it to
    her.

    Ifeoma

full-volume-report =
    cabinet - why the share is full (for Priya)

    The full volume:
    What fills it (full path):
    Since when:
    Seen in the event log:

## Events

full-volume-event-full =
    df says it: the share's volume is full (100%), about 500 GB. That's
    cabinet's disk, as cabinet counts it, not just the share's folder.
    How much does the share itself hold? (du)
full-volume-event-outside =
    The share holds about 60 GB, the volume 500 GB: what fills it is on
    the same disk, but outside the share, where compass can't see. To
    look there, you have to be on cabinet: its OpenSSH, built into
    Windows, opens a PowerShell.
full-volume-event-deleted-drawings =
    Careful: those were the office's drawings, and making room isn't
    your call here. The share only holds a fraction of the volume: what
    fills it is elsewhere.
full-volume-event-powershell =
    "PS C:\Users\you>": you are on Windows, in PowerShell. Commands are
    called cmdlets, named verb-noun (Get-ChildItem, Get-Service), their
    parameters start with a dash (-Recurse), and the case doesn't matter.
    Some Linux names work as aliases (ls, cat, cd, pwd). Get-Help NAME is
    the manual; Get-Command lists what's there.
full-volume-event-linux-habit =
    Not every Linux command has a PowerShell alias: grep, df or du don't
    exist here. The equivalents are cmdlets: Get-Volume or Get-PSDrive for
    the disks, Get-ChildItem for the files, Where-Object to filter. Get-Help
    and Get-Command to find them.
full-volume-event-parameter =
    ls is only an alias of Get-ChildItem, and Get-ChildItem has no -l nor
    -a: its parameters have names (-Force for hidden files, -Recurse to go
    down). Get-Help Get-ChildItem lists them.
full-volume-event-volume =
    D: (Data): 500 GB, about 11 MB left. That's the volume of the shares
    (D:\Shares). What fills it? Get-ChildItem can go down the whole drive
    (-Recurse), and its objects can be sorted by size before you look at
    them.
full-volume-event-culprit =
    There it is: plans-full-2029-11-03.zip, more than 400 GB, in D:\Backup,
    outside the shares, written on 3 November. A full copy of the plans,
    zipped and left behind. Write it down in cabinet-report.txt (the volume,
    the file, since when); the event log may tell you since when Windows
    has been complaining (Get-WinEvent or Get-EventLog).
full-volume-event-event-log =
    Event 2013 from srv (the file server): "The D: disk is at or near
    capacity", every few hours since 18 November. Windows had been saying
    so; nobody was reading.
full-volume-event-read-only =
    You are here to read: cabinet is Priya's to change. Write down what you
    found; she'll do what has to be done.
full-volume-event-end =
    Ifeoma: "I sent your report to Priya. She knew right away: on 3
    November, before the share was moved, she zipped all the plans as a
    precaution, and forgot the zip. She removed it from her place, and
    Plotter will deliver tomorrow's PDFs. She asks if you'd like to come
    on Monday, to see the Windows side."

    Well done! You have finished the chapter "The Other Side".

    WHAT HAPPENED
    The share was full because its volume was: df on Linux shows the
    server's disk, du only the share. The rest was out of Linux's sight.
    Through cabinet's OpenSSH (built into Windows since 2019), you landed
    in PowerShell, found the volume (Get-Volume, Get-PSDrive), the file
    (Get-ChildItem -Recurse, sorted by Length), and the warnings Windows
    had written (Get-WinEvent). You read, wrote down, and left the change
    to the person who administers the server.

    GOOD PRACTICE
    - df and du don't measure the same thing: on a network share, df is
      the server's volume.
    - PowerShell passes objects, not text: sort and select on properties
      (Sort-Object Length -Descending, Select-Object -First 5), and let
      the formatting come last.
    - Get-Help and Get-Command are the manual: the "manual first" reflex
      holds on Windows too.
    - On a server you don't administer, read and report: the volume, the
      file with its full path, the date, the events.
    - Watch the disks of the servers you depend on (a share that fills
      up stops services on the other side).

    ANOTHER WAY
    Linux's PowerShell (pwsh) runs the same cmdlets on Linux; Windows
    Admin Center and the Explorer show the same in windows. WSL brings a
    Linux to Windows workstations, the other way round. Administering
    Windows is a story of its own.

    DOCUMENTATION
    - OpenSSH for Windows: https://learn.microsoft.com/windows-server/administration/openssh/openssh-overview
    - Get-ChildItem: https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-childitem?view=powershell-5.1
    - Get-Volume: https://learn.microsoft.com/powershell/module/storage/get-volume
    - Get-WinEvent: https://learn.microsoft.com/powershell/module/microsoft.powershell.diagnostics/get-winevent?view=powershell-5.1
    - About pipelines: https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_pipelines?view=powershell-5.1
