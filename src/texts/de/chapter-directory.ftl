### Geschichte „Der Bienenstock“, Kapitel „Der Verzeichnisdienst“: die
### Konten des Teams in OpenLDAP. Befehle, LDAP-Attribute, DNs und Pfade
### werden nicht übersetzt.

chapter-directory = Der Verzeichnisdienst
    .summary = Die Konten des Teams liegen in einem LDAP-Verzeichnis: eine Person entfernen, die gegangen ist (wirklich), Sami mit einem LDIF, einem gehashten Passwort und der richtigen Gruppe hinzufügen.

## Dateien

# { $admin }: der DN der Administration des Verzeichnisses; { $password }: ihr Passwort
directory-email-malik =
    Von:     Malik
    An:      dich
    Betreff: Das Verzeichnis, vor dem WLAN

    Nächster Schritt: ein ordentliches WLAN für die Büros, in dem sich
    alle mit ihrem eigenen Konto anmelden. Es wird sich auf das
    LDAP-Verzeichnis stützen, das Sacha auf dem Router eingerichtet hat
    (slapd). Aber es ist nicht mehr aktuell:

    - Camille ist im Dezember gegangen, und ihr Konto ist noch da;
    - Sami, aus der Nebenstelle, hat kein Konto. Er braucht dieselbe Art
      von Eintrag wie alle anderen (Sami Lemaire, uid sami), und er muss
      in der Gruppe „bueros“ sein, wie wir.

    Sacha hat die Datei aufbewahrt, die für Inès benutzt wurde:
    ines-vorlage.ldif.

    Um das Verzeichnis zu lesen: ldapsearch -x (die Basis steht schon in
    /etc/ldap/ldap.conf). Zum Schreiben musst du dich authentifizieren:
    { $admin }, Passwort { $password }; oder, als root auf dieser
    Maschine, sudo … -Y EXTERNAL -H ldapi:/// (ohne Passwort).
    Alles steht in man ldapsearch, man ldapadd, man ldapmodify.

    Für sudo: biene-2027

## Ereignisse

directory-event-clear =
    Vorsicht: Ein Passwort ist IM KLARTEXT im Verzeichnis gespeichert
    (userPassword ohne {"{"}SSHA{"}"} davor). Jede Person, die das
    Verzeichnis mit den richtigen Rechten liest, oder ein Backup, kann es
    sehen. slappasswd berechnet einen Hash, den man an seine Stelle setzt;
    ldappasswd ändert das Passwort und speichert den Hash selbst.
directory-event-uid-double =
    Vorsicht: Zwei Konten haben dieselbe uidNumber. Für Linux wäre das
    dieselbe Person: dieselben Dateien, dieselben Rechte. Jedes Konto hat
    seine eigene Nummer (ein ldapsearch auf uidNumber zeigt die belegten).
directory-event-camille-rest =
    Camilles Eintrag ist weg… aber nicht ihr Name in den Gruppen
    (memberUid: camille). Eine posixGroup enthält nur Namen: Nichts
    aktualisiert sie, wenn ein Eintrag gelöscht wird, und ein künftiges
    Konto „camille“ würde ihre Rechte erben. Sie muss daraus entfernt
    werden (ldapmodify, delete: memberUid).
directory-event-sami-only =
    Sami hat sein Konto, aber er ist nicht in der Gruppe „bueros“: Das WLAN
    der Büros lässt ihn nicht herein. Eine posixGroup listet ihre
    Mitglieder in memberUid auf.
directory-event-stopped =
    slapd läuft nicht mehr: Niemand kann sich mehr mit dem Konto aus dem
    Verzeichnis anmelden. Bring es wieder zum Laufen.
directory-event-end =
    Camille hat nirgends mehr ein Konto, Sami hat seins, mit einem
    gehashten Passwort, und er ist in der Gruppe der Büros. Malik: „Wir
    sind bereit für das WLAN!“

    Gut gemacht! Du hast das Kapitel „Der Verzeichnisdienst“ abgeschlossen.

    WAS PASSIERT IST
    Ein LDAP-Verzeichnis speichert Einträge in einem Baum: Jeder hat einen
    eindeutigen Namen (seinen DN, uid=sami,ou=people,dc=thehive,dc=example),
    Klassen (inetOrgPerson für eine Person, posixAccount für ein
    Linux-Konto), die bestimmte Attribute verlangen, und Werte. Man fragt
    es mit ldapsearch und einem Filter ab; man ändert es mit LDIF-Dateien
    (ldapadd, ldapmodify) oder ldapdelete. Gruppen vom Typ posixGroup
    enthalten nur Namen: Einen Eintrag zu löschen, aktualisiert sie nicht.

    GUTE PRAXIS
    - Eine Person geht: das Konto löschen UND es aus jeder Gruppe entfernen
      (ldapsearch "(memberUid=camille)", um sie zu finden).
    - Nie ein Passwort im Klartext: {"{"}SSHA{"}"} (slappasswd), oder
      ldappasswd; und das Passwort von der Person selbst gewählt.
    - Eine eindeutige uidNumber pro Konto; und regelmäßige Backups
      (sudo slapcat > backup.ldif).

    EIN ANDERER WEG
    FreeIPA (LDAP, Kerberos, Zertifikate und sudo-Regeln an einem Ort),
    oder Samba als Domänencontroller für Active Directory, wenn es
    Windows-Maschinen gibt. Für Single Sign-on bei Web-Apps (OIDC, SAML)
    hängt sich Keycloak an das Verzeichnis. OpenLDAP allein: leicht und
    standardisiert, aber man schreibt alles selbst.

    DOKUMENTATION
    - OpenLDAP (Werkzeuge, LDIF): https://www.openldap.org/doc/admin26/dbtools.html
    - ldapmodify: https://manpages.debian.org/trixie/ldap-utils/ldapmodify.1.en.html
    - OpenLDAP unter Debian: https://wiki.debian.org/LDAP/OpenLDAPSetup

# Die Organisation an der Spitze des Verzeichnisses (Attribut o).
directory-organisation = Der Bienenstock
