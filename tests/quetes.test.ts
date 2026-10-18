// Chaque chapitre est rejoué jusqu'au bout (solution attendue), avec des
// fausses pistes en chemin : le moteur doit les refuser sans bloquer la
// partie. Les parties sont rejouées dans chaque langue disponible ; les
// textes attendus, eux, sont vérifiés en français (langue de référence).

import { describe, expect, it } from 'vitest';
import { Shell } from '../src/moteur/shell';
import { HISTOIRES } from '../src/moteur/chapitres';
import { LANGUES, LANGUE_DE_REFERENCE } from '../src/textes';

const chapitre = (id: string) => HISTOIRES.flatMap((h) => h.chapitres).find((c) => c.id === id)!;

for (const langue of LANGUES)
  describe(`Langue : ${langue}`, () => {
    const reference = langue === LANGUE_DE_REFERENCE;
    // Un texte attendu, vérifié seulement dans la langue de référence.
    const contient = (tout: string, texte: string) => {
      if (reference) expect(tout).toContain(texte);
    };

    function jouer(id: string, commandes: string[]) {
      const s = new Shell(chapitre(id), langue);
      const sorties = ['cat ' + chapitre(id).accueil, ...commandes].map((c) => s.executer(c) ?? '');
      return { s, sorties, tout: sorties.join('\n') };
    }

    describe('L’Effaceur', () => {
      it('chapitre 1 — L’Île du Phare', () => {
        const { s, tout } = jouer('eveil', [
          'cat message.txt',
          'cd Colline/EcoleDesSignaux/SalleDExercice',
          'mv crabe Seau',
          'cd ../Cours',
          'ls -a',
          'cat .note_secrete',
          'cd ~/Jetee/Phare',
          'cd ~/Jetee',
          'mv filet ~/Port/Hangar',
          'cd Phare',
          'cd ~/Port/Remise',
          'ls -a',
          'mv .ampoule_de_secours ~/Jetee/Phare/Escalier/Lanterne',
          'cd ~/Jetee/Phare/Escalier/Lanterne',
          'mv .ampoule_de_secours ampoule',
        ]);
        contient(tout, 'Un énorme filet emmêlé bloque la porte du Phare');
        contient(tout, 'ne s’appelle pas exactement ampoule');
        expect(s.termine).toBe(true);
      });

      it('chapitre 1 — l’ampoule portée et renommée d’un coup', () => {
        const { s } = jouer('eveil', [
          'mv Jetee/filet Port/Hangar',
          'cd Port/Remise',
          'mv .ampoule_de_secours ~/Jetee/Phare/Escalier/Lanterne/ampoule',
        ]);
        expect(s.termine).toBe(true);
      });

      it('chapitre 2 — Le Bourg', () => {
        const { s, tout } = jouer('bourg', [
          'cd Mairie',
          'cd Archives',
          'grep Effaceur *',
          'ls -a',
          'cat .paillasson',
          'cd Archives',
          'grep -i effaceur chronique.txt',
          'cd ~/Ruelle',
          'cd ~/Boulangerie',
          'rm levain',
          'cp levain levain_2',
          'cp levain levain_3',
          'cd ~/Atelier',
          'touch engrenage',
          'cp engrenage engrenage_2',
          'cp engrenage engrenage_3',
          'cp engrenage engrenage_4',
          'cp engrenage engrenage_5',
          'cd ~/Ruelle',
          'cd Cour',
          'mv barricade ..',
          'rm barricade',
          'cd Cour/Egout',
          'cd Galerie',
          'cp ~/Marche/fromage .',
          'cd Galerie',
          'cat nour.txt',
          'cd ~/Ecole',
          'mkdir Classe',
        ]);
        contient(tout, 'La porte des Archives est fermée à clé');
        contient(tout, '« Pas mon dernier levain ! »');
        contient(tout, 'La barricade est trop lourde pour mv');
        contient(tout, 'l’Effaceur a effacé ma Classe');
        expect(s.termine).toBe(true);
      });

      it('chapitre 3 — La Racine', () => {
        const { s, tout } = jouer('racine', [
          'cat arrivee.txt',
          'ls -l',
          'chmod o-w souvenirs',
          'cat /var/log/effaceur.log',
          'grep cible /var/log/effaceur.log',
          'cp ~/effaceur.conf.corrige /etc/effaceur.conf',
          'grep "mot de passe" journal.txt',
          'sudo ls /root',
          'mauvais',
          'tournesol',
          'sudo cd /root',
          'sudo cp ~/effaceur.conf.corrige /etc/effaceur.conf',
        ]);
        contient(tout, 'Permission non accordée');
        contient(tout, 'Désolé, essayez de nouveau.');
        contient(tout, 'cd : commande introuvable');
        expect(s.termine).toBe(true);
      });
    });

    describe('Autres histoires', () => {
      it('Le Datacenter', () => {
        const L = '/var/log/nginx/access.log';
        const { s } = jouer('premier-jour', [
          'cat notes_awa.txt',
          `grep " 503 " ${L} | wc -l`,
          `cut -d " " -f 1 ${L} | sort | uniq -c | sort -n | tail -3`,
          'ps aux',
          'kill 4242',
          'sudo kill 4242',
          'bienvenue-2026',
          `echo "deny 198.51.100.77;" | sudo tee -a /etc/nginx/bloques.conf`,
          'sudo systemctl reload nginx',
          'ps aux',
          'sudo kill 4244',
          `grep " 503 " ${L} | wc -l > ~/rapport.txt`,
          'echo "Coupable : 198.51.100.77" >> rapport.txt',
        ]);
        expect(s.termine).toBe(true);
      });

      it('Le Datacenter, chapitre 2 — Deuxième jour', () => {
        const { s, tout } = jouer('deuxieme-jour', [
          'id',
          'id malo',
          'ls -l /var/log/nginx',
          'cat /home/malo/x',
          'usermod -aG adm malo',
          'sudo usermod -G adm malo',
          'bienvenue-2026',
          'groups malo',
          'sudo usermod -aG equipe-web malo',
          'sudo chmod o+r /var/log/nginx/access.log',
          'sudo chmod 640 /var/log/nginx/access.log',
          'chgrp equipe-web /srv/equipe',
          'sudo chmod 777 /srv/equipe',
          'sudo chgrp equipe-web /srv/equipe',
          'sudo chmod 770 /srv/equipe',
        ]);
        contient(tout, 'uid=1000(vous) gid=1000(vous) groupes=1000(vous),4(adm),27(sudo),1003(equipe-web)');
        contient(tout, '-rw-r----- www-data adm');
        contient(tout, 'usermod : Permission non accordée.');
        contient(tout, 'malo : malo adm');
        contient(tout, 'Malo n’est plus dans le groupe equipe-web'.replace('’', "'"));
        contient(tout, 'TOUS les comptes de la machine peuvent lire');
        contient(tout, "chgrp : modification du groupe de '/srv/equipe' : Opération non permise");
        contient(tout, 'n’importe quel compte'.replace('’', "'"));
        contient(tout, 'https://wiki.debian.org/SystemGroups');
        expect(s.termine).toBe(true);
      });

      it('Le Datacenter, chapitre 2 — une autre solution correcte', () => {
        const { s } = jouer('deuxieme-jour', [
          'sudo usermod -aG adm malo',
          'bienvenue-2026',
          'sudo chown root:equipe-web /srv/equipe',
          'sudo chmod g+w,o-rx /srv/equipe',
        ]);
        expect(s.termine).toBe(true);
      });

      it('Le Paquet perdu', () => {
        const { s } = jouer('paquet-perdu', [
          'cat carnet.txt',
          'ping 192.168.1.1',
          'ping 9.9.9.9',
          'ping lettres.example',
          'dig lettres.example',
          'cat /etc/resolv.conf',
          'dig @9.9.9.9 lettres.example',
          'sudo cp /etc/resolv.conf.box /etc/resolv.conf',
          'fourmiliere',
          'ping lettres.example',
          'traceroute lettres.example',
          'curl -I https://lettres.example',
        ]);
        expect(s.termine).toBe(true);
      });

      it('La Machine à remonter le temps', () => {
        const { s } = jouer('manuscrit', [
          'cd roman',
          'git log --oneline',
          'git diff HEAD~1 roman.txt',
          'git restore --source=HEAD~1 roman.txt',
          'git commit -m "x"',
          'git add roman.txt',
          'git commit -m "Restaure le chapitre 3"',
          'cd ../poemes',
          'git init',
          'git add .',
          'git commit -m "Premiers poèmes"',
        ]);
        expect(s.termine).toBe(true);
      });

      it('Les Archives', () => {
        const { s } = jouer('archives', [
          'cat notes_rosa.txt',
          'du -sh fonds',
          'df -h /media/cle',
          'tar -czf /media/cle/fonds.tar.gz fonds',
          'find fonds -name "*.tmp" -delete',
          'tar -czf /media/cle/fonds.tar.gz fonds',
          'tar -tzf /media/cle/fonds.tar.gz',
        ]);
        expect(s.termine).toBe(true);
      });
    });

    describe.runIf(reference)('Le manuel, premier réflexe', () => {
      const s = new Shell(chapitre('eveil'), langue);
      it('man affiche une vraie page', () => {
        const page = s.executer('man ls')!;
        for (const section of ['NOM', 'SYNOPSIS', 'DESCRIPTION', 'OPTIONS', 'EXEMPLES', 'VOIR AUSSI']) expect(page).toContain(section);
      });
      it('--help, man -k, whatis', () => {
        expect(s.executer('ls --help')).toContain('Utilisation : ls');
        expect(s.executer('man -k copie')).toContain('cp (1)');
        expect(s.executer('whatis mv')).toMatch(/^mv \(1\)/);
      });
      it('option inconnue : le vrai message', () => {
        expect(s.executer('ls -z')).toBe("ls : option invalide -- 'z'\nSaisissez « ls --help » pour plus d'informations.");
      });
      it('messages de man-db', () => {
        expect(s.executer('man')).toContain('Quelle page de manuel voulez-vous ?');
        expect(s.executer('man xyz')).toBe("Il n'y a pas de page de manuel pour xyz.");
      });
      it('chaque commande du jeu a une page', () => {
        for (const h of HISTOIRES) for (const c of h.chapitres) for (const cmd of c.commandes) expect(s.executer(`man ${cmd}`)).toContain('NOM');
      });
    });
    it('chaque commande du jeu a une page de manuel', () => {
      const s = new Shell(chapitre('eveil'), langue);
      for (const h of HISTOIRES)
        for (const c of h.chapitres)
          for (const cmd of c.commandes) expect(s.executer(`man ${cmd}`)).toMatch(new RegExp(`^${cmd.toUpperCase()}\\([18]\\)`));
    });
  });
