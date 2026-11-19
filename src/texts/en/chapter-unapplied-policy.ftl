### Story "The Card Catalogue", chapter "The Policy That Doesn't Apply":
### a GPO that maps the Events drive reaches only part of the people it is
### for: a link on the wrong OU, and security filtering one group short.
### Commands, cmdlets, account names, computer names, GPO names and outputs
### are not translated.

chapter-unapplied-policy = The Policy That Doesn't Apply
    .summary = The posters for the spring story times are on the Events share, but half the people who need them have no E: drive. Read what Group Policy applied on their workstations, find why the GPO doesn't reach them, and fix it without handing the drive to everyone.

## Files

unapplied-policy-email-nandini =
    From:  Nandini Mukherjee (network director)
    To:    you

    Good morning,

    The posters for the spring story times are ready on the Events
    share, and the branches should print them today. Except:

      - Josephine (Hilltop) has no E: drive. She's on HILL-DESK1.
      - Kofi (Riverside) neither, on RIVER-DESK1.
      - And me! I'm on CENTRAL-DESK1, no E: either. Yet the children's
        team here at Central has had it since the autumn.

    Bongani (HILL-DESK2) says he has no E: either, but he never uses
    it. Thanh doesn't need it, he's on the lending desk.

    They're all logged on right now. Tomas said the drive comes from
    "a GPO". Could you have a look?

    Nandini

## Events

unapplied-policy-event-no-rsop =
    "Does not have RSoP data": gpresult shows what was applied on THIS
    computer, at its logons. Josephine never logged on to register. The
    resulting set of policy lives on her workstation: gpresult can read
    it remotely (man gpresult: /s, /user), and so can
    Get-GPResultantSetOfPolicy.
unapplied-policy-event-gpupdate-here =
    That refreshed register's own policy: the domain controller, and
    you. The librarians' workstations refresh on their own (every 90
    minutes, or at the next logon), or when asked from here: Get-Help
    Invoke-GPUpdate.
unapplied-policy-event-josephine =
    Her workstation applied Staff Drives (S:), and filtered Archives
    Drive out (she isn't in local history). But Events Drive appears
    nowhere: neither applied nor filtered out. A GPO that gpresult
    doesn't even list wasn't found on the way down from the domain to
    her OU: no link reaches her. Where is it linked? (Get-Help
    Get-GPInheritance, Get-GPOReport.)
unapplied-policy-event-links =
    Events Drive is linked to OU=Central only, where Tomas tested it.
    Riverside and Hilltop inherit what is linked above them (the domain,
    OU=Branches), not what is linked on a sister OU. Tomas's conventions
    say where a GPO for the staff goes.
unapplied-policy-event-root =
    A link on the domain's root: every account and every computer of
    the domain now reads this GPO at each logon and refresh, the domain
    controller and the servers included, and only the security
    filtering stands between the drive and everyone. The conventions
    keep the root for the Default Domain Policy: link it to OU=Branches
    instead (Remove-GPLink, New-GPLink).
unapplied-policy-event-enforced =
    Enforced only wins over a blocked inheritance and over GPOs linked
    lower down. It doesn't make a GPO reach an OU it isn't linked above,
    nor get past security filtering. Nothing here blocks inheritance:
    take it off (Set-GPLink … -Enforced No).
unapplied-policy-event-linked =
    Every branch is now below a link of Events Drive. Is it enough?
    Refresh a workstation and read its result again; Nandini's too.
unapplied-policy-event-nandini =
    At Central, where the link has always been, Nandini's workstation
    lists Events Drive under "filtered out": Filtering: Denied
    (Security). The GPO reached her account; its permissions didn't let
    it apply. Who may apply it? (Get-Help Get-GPPermission.)
unapplied-policy-event-filtering =
    Apply Group Policy: GG_Children only. Tomas tested with the
    children's team; the managers were forgotten. The share it maps,
    Events, is for DL_Events_RW: GG_Children and GG_Management.
# { $accounts }: account names (not translated).
unapplied-policy-event-everyone =
    Now the drive reaches people it isn't for: { $accounts }… Every
    lending assistant, every archivist, the service accounts if the link
    is high enough, get an E: they can't even open (the share's NTFS
    permissions are for DL_Events_RW). Security filtering should name
    the same groups as the share, not Authenticated Users. (Authenticated
    Users keeps GpoRead: computers need to read the GPO.)
unapplied-policy-event-filtered =
    The managers may apply it now, and nobody else gained it.
unapplied-policy-event-filtered-unlinked =
    The managers may apply it now, and nobody else gained it. At Central,
    that's enough; Riverside and Hilltop still have no link above them.
unapplied-policy-event-right =
    In the directory, the policy is right: every children's librarian
    and every manager of the three branches would get E:, nobody else.
    But the workstations apply it at their next refresh: ask one now
    (Get-Help Invoke-GPUpdate -Examples), then check with gpresult.
unapplied-policy-event-end =
    Josephine, a minute later: "E: is there! Printing the posters."

    Well done! You have finished the chapter "The Policy That Doesn't
    Apply".

    WHAT HAPPENED
    Tomas made the GPO "Events Drive" in the autumn and tested it at
    Central with the children's team: he linked it to OU=Central and
    filtered it to GG_Children. Two layers, two symptoms. At Riverside
    and Hilltop, gpresult didn't list the GPO at all: no link above
    their OU. At Central, it listed it as "Denied (Security)" for
    Nandini: reached, but not allowed. You linked it where the staff
    are, gave GG_Management the right to apply it, and asked a
    workstation to refresh.

    GOOD PRACTICE
    - Start from the result, on the person's computer: gpresult /s
      COMPUTER /user DOMAIN\user /r (or Get-GPResultantSetOfPolicy).
      Applied, filtered out (and why), or absent: three different
      problems.
    - Absent: a link problem (where it is linked, inheritance blocked,
      the object in another OU than you think). "Denied (Security)":
      security filtering. "Disabled (Link)", "Disabled (GPO)",
      "Not Applied (Empty)": the GPO itself.
    - Link where the objects are, filter with the groups the setting is
      about. Not at the root, not Enforced, not Authenticated Users by
      reflex.
    - Keep GpoRead for Authenticated Users (or Domain Computers) when
      you filter: since the MS16-072 update, computers read the user
      GPOs too.
    - After a change: Invoke-GPUpdate -Computer, or wait for the
      background refresh (90 minutes, give or take 30).

    LIKE "THE DIRECTORY", IN ACTIVE DIRECTORY
    A GPO lives in the directory (CN={"{"}GUID{"}"},CN=Policies,CN=System) and
    an OU points to it with its gPLink attribute, which the module shows
    as LinkedGroupPolicyObjects: Get-ADOrganizationalUnit
    'OU=Branches,DC=lending,DC=internal' | Select-Object -ExpandProperty
    LinkedGroupPolicyObjects shows the link you added.

    DOCUMENTATION
    - gpresult: https://learn.microsoft.com/windows-server/administration/windows-commands/gpresult
    - Security filtering: https://learn.microsoft.com/troubleshoot/windows-server/group-policy/apply-group-policy-objects-users-computers
    - New-GPLink: https://learn.microsoft.com/powershell/module/grouppolicy/new-gplink
    - Set-GPPermission: https://learn.microsoft.com/powershell/module/grouppolicy/set-gppermission
    - Invoke-GPUpdate: https://learn.microsoft.com/powershell/module/grouppolicy/invoke-gpupdate
