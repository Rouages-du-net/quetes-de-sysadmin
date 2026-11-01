### Histoire « La Ruche », chapitre « L'annuaire » : les comptes de l'équipe
### dans OpenLDAP. Les commandes, les attributs LDAP, les DN et les chemins
### ne se traduisent pas.

chapter-directory = L'annuaire
    .summary = Les comptes de l'équipe sont dans un annuaire LDAP : retirer une personne partie (vraiment), ajouter Sami avec un LDIF, un mot de passe chiffré et le bon groupe.

## Fichiers

# { $admin } : le DN de l'administrateur de l'annuaire ; { $password } : son mot de passe
directory-email-malik =
    De :     Malik
    À :      toi
    Objet :  L'annuaire, avant le Wi-Fi

    Prochaine étape : un vrai Wi-Fi pour les bureaux, où chacun se connecte
    avec son propre compte. Il s'appuiera sur l'annuaire LDAP que Sacha a
    installé sur le routeur (slapd). Mais il n'est plus à jour :

    - Camille est partie en décembre, son compte est toujours là ;
    - Sami, de l'Annexe, n'a pas de compte. Il lui faut le même genre
      d'entrée que les autres (Sami Lemaire, uid sami), et il doit être
      dans le groupe « bureaux », comme nous.

    Sacha avait gardé le fichier qui a servi pour Inès : modele-ines.ldif.

    Pour lire l'annuaire : ldapsearch -x (la base est déjà dans
    /etc/ldap/ldap.conf). Pour écrire, il faut s'identifier :
    { $admin }, mot de passe { $password } ; ou, en root sur cette
    machine, sudo … -Y EXTERNAL -H ldapi:/// (sans mot de passe).
    Tout est dans man ldapsearch, man ldapadd, man ldapmodify.

    Pour sudo : abeille-2027

## Événements

directory-event-clear =
    Attention : un mot de passe est stocké EN CLAIR dans l'annuaire
    (userPassword sans {"{"}SSHA{"}"} devant). Quiconque lit l'annuaire avec
    les bons droits, ou une sauvegarde, le voit. slappasswd en calcule une
    empreinte à mettre à la place ; ldappasswd change le mot de passe et
    stocke l'empreinte lui-même.
directory-event-uid-double =
    Attention : deux comptes ont le même uidNumber. Pour Linux, ce serait
    la même personne : mêmes fichiers, mêmes droits. Chaque compte a son
    propre numéro (un ldapsearch sur uidNumber montre ceux qui sont pris).
directory-event-camille-rest =
    L'entrée de Camille a disparu… mais pas son nom dans les groupes
    (memberUid: camille). Un groupe posixGroup ne contient que des noms :
    rien ne le met à jour quand une entrée est supprimée, et un futur
    compte « camille » hériterait de ses droits. Il faut l'en retirer
    (ldapmodify, delete: memberUid).
directory-event-sami-only =
    Sami a son compte, mais il n'est pas dans le groupe « bureaux » : le
    Wi-Fi des bureaux ne le laissera pas entrer. Un groupe posixGroup
    liste ses membres dans memberUid.
directory-event-stopped =
    slapd ne tourne plus : plus personne ne peut se connecter avec son
    compte de l'annuaire. Remets-le en route.
directory-event-end =
    Camille n'a plus de compte nulle part, Sami a le sien, avec un mot de
    passe chiffré, et il est dans le groupe des bureaux. Malik : « On est
    prêts pour le Wi-Fi ! »

    Bravo ! Tu as terminé le chapitre « L'annuaire ».

    CE QUI S'EST PASSÉ
    Un annuaire LDAP range des entrées en arbre : chacune a un nom unique
    (son DN, uid=sami,ou=people,dc=thehive,dc=example), des classes
    (inetOrgPerson pour une personne, posixAccount pour un compte Linux)
    qui exigent certains attributs, et des valeurs. On l'interroge avec
    ldapsearch et un filtre ; on le modifie avec des fichiers LDIF
    (ldapadd, ldapmodify) ou ldapdelete. Les groupes posixGroup ne
    contiennent que des noms : supprimer une entrée ne les met pas à jour.

    LA BONNE PRATIQUE
    - Un départ : supprimer le compte ET le retirer de tous les groupes
      (ldapsearch "(memberUid=camille)" pour les trouver).
    - Jamais de mot de passe en clair : {"{"}SSHA{"}"} (slappasswd), ou
      ldappasswd ; et le mot de passe choisi par la personne elle-même.
    - Un uidNumber unique par compte ; et une sauvegarde régulière
      (sudo slapcat > sauvegarde.ldif).

    UNE AUTRE VOIE
    FreeIPA (LDAP, Kerberos, certificats et règles sudo au même endroit),
    ou Samba en contrôleur de domaine Active Directory quand il y a des
    postes Windows. Pour la connexion unique des applis web (OIDC, SAML),
    Keycloak se branche sur l'annuaire. OpenLDAP seul : léger et standard,
    mais on écrit tout soi-même.

    LA DOCUMENTATION
    - OpenLDAP (outils, LDIF) : https://www.openldap.org/doc/admin26/dbtools.html
    - ldapmodify : https://manpages.debian.org/trixie/ldap-utils/ldapmodify.1.en.html
    - OpenLDAP sur Debian : https://wiki.debian.org/LDAP/OpenLDAPSetup
