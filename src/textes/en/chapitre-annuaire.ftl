### Story "The Hive", chapter "The Directory": the team's accounts
### in OpenLDAP. Commands, LDAP attributes, DNs and paths are not
### translated.

chapitre-annuaire = The Directory
    .resume = The team's accounts are in an LDAP directory: remove someone who has left (for real), add Sami with an LDIF, a hashed password and the right group.

## Files

# { $admin }: the DN of the directory administrator; { $motdepasse }: their password
annuaire-courriel-malik =
    From:    Malik
    To:      you
    Subject: The directory, before the Wi-Fi

    Next step: proper Wi-Fi for the offices, where everyone logs in with
    their own account. It will rely on the LDAP directory Sacha set up
    on the router (slapd). But it's no longer up to date:

    - Camille left in December, and her account is still there;
    - Sami, from the Annexe, has no account. He needs the same kind of
      entry as everyone else (Sami Lemaire, uid sami), and he must be
      in the "bureaux" group, like us.

    Sacha kept the file that was used for Inès: modele-ines.ldif.

    To read the directory: ldapsearch -x (the base is already in
    /etc/ldap/ldap.conf). To write, you have to authenticate:
    { $admin }, password { $motdepasse }; or, as root on this
    machine, sudo … -Y EXTERNAL -H ldapi:/// (no password).
    It's all in man ldapsearch, man ldapadd, man ldapmodify.

    For sudo: bee-2027

## Events

annuaire-evenement-clair =
    Careful: a password is stored IN CLEAR TEXT in the directory
    (userPassword without {"{"}SSHA{"}"} in front). Anyone who reads the
    directory with the right permissions, or a backup, can see it.
    slappasswd computes a hash to put in its place; ldappasswd changes
    the password and stores the hash itself.
annuaire-evenement-uid-double =
    Careful: two accounts have the same uidNumber. To Linux, that would
    be the same person: same files, same permissions. Each account has
    its own number (an ldapsearch on uidNumber shows the ones taken).
annuaire-evenement-camille-reste =
    Camille's entry is gone… but not her name in the groups
    (memberUid: camille). A posixGroup only contains names: nothing
    updates it when an entry is deleted, and a future "camille" account
    would inherit her permissions. She must be removed from it
    (ldapmodify, delete: memberUid).
annuaire-evenement-sami-seul =
    Sami has his account, but he isn't in the "bureaux" group: the
    office Wi-Fi won't let him in. A posixGroup lists its members in
    memberUid.
annuaire-evenement-arrete =
    slapd is no longer running: nobody can log in with their directory
    account any more. Get it running again.
annuaire-evenement-fin =
    Camille no longer has an account anywhere, Sami has his, with a
    hashed password, and he is in the offices group. Malik: "We're
    ready for the Wi-Fi!"

    Well done! You have finished the chapter "The Directory".

    WHAT HAPPENED
    An LDAP directory stores entries in a tree: each has a unique name
    (its DN, uid=sami,ou=people,dc=laruche,dc=example), classes
    (inetOrgPerson for a person, posixAccount for a Linux account) that
    require certain attributes, and values. You query it with ldapsearch
    and a filter; you change it with LDIF files (ldapadd, ldapmodify) or
    ldapdelete. posixGroup groups only contain names: deleting an entry
    does not update them.

    GOOD PRACTICE
    - Someone leaves: delete the account AND remove it from every group
      (ldapsearch "(memberUid=camille)" to find them).
    - Never a clear-text password: {"{"}SSHA{"}"} (slappasswd), or
      ldappasswd; and the password chosen by the person themselves.
    - A unique uidNumber per account; and regular backups
      (sudo slapcat > sauvegarde.ldif).

    ANOTHER WAY
    FreeIPA (LDAP, Kerberos, certificates and sudo rules in one place),
    or Samba as an Active Directory domain controller when there are
    Windows machines. For single sign-on to web apps (OIDC, SAML),
    Keycloak plugs into the directory. OpenLDAP alone: lightweight and
    standard, but you write everything yourself.

    DOCUMENTATION
    - OpenLDAP (tools, LDIF): https://www.openldap.org/doc/admin26/dbtools.html
    - ldapmodify: https://manpages.debian.org/trixie/ldap-utils/ldapmodify.1.en.html
    - OpenLDAP on Debian: https://wiki.debian.org/LDAP/OpenLDAPSetup
