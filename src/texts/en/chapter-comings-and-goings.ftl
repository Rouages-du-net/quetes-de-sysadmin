### Story "The Card Catalogue", chapter "Comings and Goings": a new
### librarian starts on Monday, another one left today. The story's shared
### texts (Tomas's handover, the conventions) are here too. Commands,
### cmdlets, account names, DNs, paths, passwords and outputs are not
### translated.

chapter-comings-and-goings = Comings and Goings
    .summary = Your first Friday on the libraries' domain controller: create the account of the librarian who starts on Monday, with the rights of his job and no more, and close the account of the one who left today, without deleting it.

## The story's shared files

card-catalogue-handover =
    register - handover notes (Tomas, 20 December 2029)

    The domain: lending.internal (NetBIOS name LENDING), three libraries:
    Central, Riverside, Hilltop.
      - register.internal (192.0.2.46): the domain controller, Windows
        Server 2022 (Active Directory, DNS). OpenSSH lands in PowerShell
        here, with your key. The ActiveDirectory module is installed:
        Get-Command -Module ActiveDirectory.
      - stacks (192.0.2.47): the file server (shares Staff, Events,
        Archives, Finance, Scans). From register: ssh stacks (your key is
        in %USERPROFILE%\.ssh, and authorised there).

    You are in Domain Admins: every account, every group, every server.
    Use it gently. Read Documents\conventions.txt before creating anything.

    Things I didn't finish:
      - svc_scans (OU=Service Accounts): created in December to replace
        Rafael's account in the scan import task on stacks. Not switched
        yet. Its password is in the vault (Nandini can export it).
      - The Events drive (GPO "Events Drive") is only linked where I
        tested it.
      - A clean-up of old accounts (some haven't logged on for months).

    Good luck. I'm at the city's IT department now, you can call.
    Tomas

card-catalogue-conventions =
    LENDING - how the domain is organised (Tomas)

    ACCOUNTS
      - Name (sAMAccountName): first letter of the first name + surname,
        lower case, no accents: Thanh Nguyen -> tnguyen.
      - Full name (Name, CN): "First Last". GivenName and Surname filled.
      - Where: OU=<branch>,OU=Branches,DC=lending,DC=internal
        (Central, Riverside or Hilltop).
      - Department, Title and Manager: as HR writes them in the ticket.
      - First password: chosen by us, given in person by the manager on
        the first morning, to be changed at the first logon. The domain
        wants at least 10 characters, three kinds (upper case, lower
        case, digits, symbols), and not the person's name.

    GROUPS (AGDLP)
      - A for Accounts go into G for Global groups, one per department:
        GG_Lending, GG_Children, GG_LocalHistory, GG_Management.
      - Global groups go into DL for Domain Local groups, one per share
        and level: DL_Staff_RW, DL_Events_RW, DL_Archives_RW,
        DL_Archives_RO, DL_Finance_RW.
      - P for Permissions: only DL_ groups appear in the NTFS permissions
        of stacks.
      - So a person goes into the GG_ group of their department, and
        nowhere else. Exceptions are written in the account's ticket.

    LEAVERS
      - Never deleted for a year: their SID owns files on stacks, their
        mailbox is archived, the auditors may ask.
      - On the last day: disabled, moved to OU=Leavers, taken out of
        their groups. The description says when they left.

## Files

comings-and-goings-email-nandini =
    From:  Nandini Mukherjee (network director)
    To:    you

    Hello, and welcome!

    Two HR tickets for you before the weekend, both in your Documents:

      - hr-0112-arrival.txt: Kofi Mensah starts on Monday at Riverside.
        Ines will give him his password at 9:00.
      - hr-0113-departure.txt: Mateo Rossi left Hilltop today. His last
        day went well; we keep in touch.

    Tomas's conventions are in Documents\conventions.txt. Have a good
    weekend!

    Nandini

comings-and-goings-ticket-arrival =
    HR ticket 0112 - ARRIVAL
    Opened 2 January 2030 by HR (Rebecca Owusu)

    Name:        Kofi Mensah
    Start:       Monday 7 January 2030
    Branch:      Riverside
    Department:  Children
    Title:       Youth Librarian
    Manager:     Ines Duarte (iduarte)

    Access: "same as Amara Okoye, same job, same branch". If easier,
    copy Amara's account.

    Exceptions: none.

comings-and-goings-ticket-departure =
    HR ticket 0113 - DEPARTURE
    Opened 4 January 2030 by HR (Rebecca Owusu)

    Name:        Mateo Rossi (mrossi)
    Last day:    Friday 4 January 2030
    Branch:      Hilltop
    Department:  Lending

    Please close his access tonight. His files on the Staff share stay
    where they are: Bongani will sort them out.

## Events

comings-and-goings-event-ous =
    The domain's tree: OU=Branches holds one OU per library, people
    live there; Groups, Leavers, Servers, Service Accounts and
    Workstations beside. A DN reads from the object up to the domain,
    as in "The Directory": Kofi's would be
    CN=Kofi Mensah,OU=Riverside,OU=Branches,DC=lending,DC=internal.
comings-and-goings-event-colleague =
    Amara is more than a youth librarian: she's in GG_Management (acting
    deputy at Riverside since the autumn) and, directly, in
    DL_Finance_RW, an exception while she covers the budget. "Same as
    Amara" would give Kofi the finance share on his first day. Give him
    his job's group, not his colleague's history.
comings-and-goings-event-agdlp =
    There it is, AGDLP: DL_Events_RW, the group in the share's NTFS
    permissions, doesn't hold people but global groups, GG_Children and
    GG_Management. A new youth librarian only needs GG_Children: the
    nesting does the rest.
comings-and-goings-event-complexity =
    Refused: the domain's password policy (Default Domain Policy) wants
    at least 10 characters, three kinds of characters, and nothing of
    the account's name or of the person's name in it. Careful: New-ADUser
    still created the account, without a password and disabled. Give it
    a password with Set-ADAccountPassword -Reset, or delete this
    half-made account and start again.
comings-and-goings-event-other-name =
    That account isn't named as the conventions say: first letter of the
    first name and the surname, in lower case, kmensah. Every script and
    every colleague will look for kmensah. Rename it (Set-ADUser
    -SamAccountName, and its UserPrincipalName), or remove it and create
    it again.
comings-and-goings-event-created =
    Kofi's account exists. Check it the way the ticket reads: Get-ADUser
    kmensah -Properties Department, Title, Manager, Enabled.
comings-and-goings-event-created-disabled =
    The account is disabled: New-ADUser creates a disabled account unless
    it is given a password the domain accepts and -Enabled $true.
    Enable-ADAccount, once it has a password.
comings-and-goings-event-wrong-ou =
    Kofi isn't in OU=Riverside,OU=Branches: the branch's policies and
    delegations won't reach him there. Move-ADObject moves an object to
    another OU (-TargetPath, a DN).
comings-and-goings-event-copied =
    Kofi now has Amara's extras: GG_Management, or DL_Finance_RW, the
    budgets and invoices. That's the trap of copying a colleague: you copy
    her history, her exceptions, her acting roles, not her job. Take him
    out of those groups (Remove-ADGroupMember, or
    Remove-ADPrincipalGroupMembership).
comings-and-goings-event-direct-dl =
    Kofi is directly in a DL_ group. It works today, but the conventions
    say AGDLP: people in GG_ groups only, GG_ groups in DL_ groups. A
    person in a DL_ group is an exception nobody will see when the
    department's rights change. Take him out, and put him in GG_Children.
comings-and-goings-event-admin =
    Kofi is now an administrator of the domain, or of its servers. A
    youth librarian needs story times, not the keys to every account.
    Take him out of that group at once.
comings-and-goings-event-no-change =
    Kofi's account has a password but he won't have to change it: the
    password you chose, which Ines will hand over on paper, would stay
    his. Set-ADUser kmensah -ChangePasswordAtLogon $true.
comings-and-goings-event-details =
    Almost: compare the account with the ticket, field by field: GivenName,
    Surname, Department, Title, Manager (Get-ADUser kmensah -Properties
    Department, Title, Manager). Set-ADUser fixes what differs.
comings-and-goings-event-arrival =
    Kofi is ready for Monday: in his branch, his job's group only, a
    first password he'll change at 9:01. Now Mateo.
comings-and-goings-event-deleted =
    Mateo's account is gone. With it went his SID: the files he owns on
    stacks now show an unknown S-1-5-21-… owner, the auditors' question
    "who had access in December?" has no answer, and a new account with
    the same name would be someone else. (The AD Recycle Bin isn't
    enabled in this domain.) Restart the chapter from the menu, and this
    time disable the account.
comings-and-goings-event-leaver-disabled =
    Mateo's account is disabled: nobody can log on with it any more, and
    it still exists, with its SID. Now, what does it still belong to?
comings-and-goings-event-leaver-groups =
    Mateo is out of his groups: if someone enabled the account by
    mistake one day, it would open nothing. One more thing: the OU where
    leavers wait.
comings-and-goings-event-leaver-groups-moved =
    Mateo is out of his groups, in OU=Leavers.
comings-and-goings-event-leaver-moved =
    Mateo is in OU=Leavers, but still in his groups: GG_Lending still
    lists him. Get-ADPrincipalGroupMembership mrossi says which ones
    (Domain Users, his primary group, stays).
comings-and-goings-event-end =
    Nandini: "Kofi starts on Monday, Mateo is closed. Thank you, and
    have a good weekend!"

    Well done! You have finished the chapter "Comings and Goings".

    WHAT HAPPENED
    Two HR tickets on a Friday. You created Kofi's account where the
    domain expects it (OU=Riverside,OU=Branches), with what the ticket
    says (Department, Title, Manager), a first password he must change,
    and one group, GG_Children: his department's. You closed Mateo's
    account without deleting it: disabled, out of his groups, moved to
    OU=Leavers.

    AGDLP
    Accounts go into Global groups (one per department, GG_), global
    groups into Domain Local groups (one per share and level, DL_), and
    only domain local groups receive Permissions on the files. When a
    department's rights change, you change one nesting, not forty
    accounts; when someone joins, one group is enough. Copying a
    colleague copies her exceptions with her job: start from the job.

    LIKE "THE DIRECTORY", IN ACTIVE DIRECTORY
    Active Directory is an LDAP directory: Kofi's DN,
    CN=Kofi Mensah,OU=Riverside,OU=Branches,DC=lending,DC=internal,
    reads like uid=…,ou=…,dc=… in OpenLDAP, and the LDAP filters you
    wrote with ldapsearch work here too:
    Get-ADUser -LDAPFilter '(&(department=Children)(title=Youth*))'.
    Get-ADUser -Filter "Department -eq 'Children'" is the same search in
    PowerShell's own language.

    GOOD PRACTICE
    - Create from the ticket and the conventions, not from a colleague.
    - A first password the person changes at the first logon
      (-ChangePasswordAtLogon $true), handed over in person.
    - A leaver is disabled, not deleted: the SID owns files, logs name
      it, and a deleted account can't be brought back without the AD
      Recycle Bin.
    - Out of the groups, with a description that says when and why.

    DOCUMENTATION
    - New-ADUser: https://learn.microsoft.com/powershell/module/activedirectory/new-aduser
    - Security groups and their scope: https://learn.microsoft.com/windows-server/identity/ad-ds/manage/understand-security-groups
    - Password must meet complexity requirements: https://learn.microsoft.com/windows-server/security/group-policy/password-must-meet-complexity-requirements
    - Disable-ADAccount: https://learn.microsoft.com/powershell/module/activedirectory/disable-adaccount
    - Move-ADObject: https://learn.microsoft.com/powershell/module/activedirectory/move-adobject
