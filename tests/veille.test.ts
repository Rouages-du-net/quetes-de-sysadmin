// La Veille : le serveur petrin, six mois après « L'Audit ». Rejoué avec la
// console, dans chaque langue.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/moteur/console';
import { HISTOIRES } from '../src/moteur/chapitres';
import { prerequis } from '../src/moteur/deverrouillage';
import { LANGUES, LANGUE_DE_REFERENCE, traducteur } from '../src/textes';
import { dansLaLangue } from './noms';
import { CVE } from '../src/moteur/chapitres/veille';

const EFFACEUR = [...new Set([...HISTOIRES.find((h) => h.id === 'effaceur')!.chapitres.map((c) => c.id), ...prerequis('veille')])];
const MDP = 'levain-2028';

for (const langue of LANGUES)
  describe(`La Veille — ${langue}`, () => {
    const fr = langue === LANGUE_DE_REFERENCE;
    const L = (ligne: string) => dansLaLangue(traducteur(langue), ligne);
    const contient = (tout: string, texte: string) => fr && expect(tout).toContain(texte);
    const partie = (termines: string[] = []) => {
      const c = new Console({ langue, termines: [...EFFACEUR, ...termines] });
      const une = (l: string) => {
        let sortie = c.executer(L(l)) ?? '';
        if (c.shell.attente) sortie += '\n' + (c.executer(MDP) ?? '');
        return sortie;
      };
      const jouer = (lignes: string[]) => lignes.map(une).join('\n');
      const editer = (commande: string, changer: (texte: string) => string) => {
        une(commande);
        c.enregistrer(changer(c.edition!.texte));
        return c.quitterEdition();
      };
      jouer(['ssh petrin', 'yes']);
      return { c, jouer, editer };
    };

    // ——— Chapitre 1 : « Le bulletin » ———
    const VEILLE_DOC = () => `# ${fr ? 'Veille' : 'Watch'} — ${fr ? 'Le Fournil' : 'The Bakery'}

## ${fr ? 'Concerne ce serveur' : 'Concerns this server'}
${CVE.nginx.id} (nginx), ${CVE.rsync.id} (rsync), ${CVE.ssh.id} (openssh-server) — ${fr ? 'déjà protégé par la configuration' : 'already protected by the configuration'}.

## ${fr ? 'Sans objet' : 'Not applicable'}
${CVE.certbot.id} (python3-certbot-nginx) : ${fr ? "n'est pas installé sur ce serveur" : 'is not installed on this server'}.
${CVE.curl.id} (curl) : ${fr ? 'déjà corrigé, la version installée est au-delà de la version corrigée' : 'already fixed, the installed version is past the fixed version'}.`;

    it('chapitre 1 — solution : trier le bulletin, le reste sans objet', () => {
      const { c, jouer, editer } = partie();
      let tout = jouer(['cat bulletin-securite.txt']);
      contient(tout, 'BULLETIN DE SÉCURITÉ');
      tout = jouer(['apt list --installed']);
      expect(tout).not.toContain('certbot');
      const relecture = editer('nano veille.md', (t) => t.replace(/\(à compléter[^\n]*|\(to complete[^\n]*/g, 'x'));
      contient(relecture, 'Salomé relit ton tri');
      expect(c.termines).not.toContain('bulletin');
      editer('nano veille.md', VEILLE_DOC);
      expect(c.termines).toContain('bulletin');
    });

    it('chapitre 1 — fausses pistes : certbot ou curl classés « concerne »', () => {
      const { c, editer } = partie();
      const mauvais = () => `# ${fr ? 'Veille' : 'Watch'}
## ${fr ? 'Concerne ce serveur' : 'Concerns this server'}
${CVE.nginx.id}, ${CVE.rsync.id}, ${CVE.ssh.id}, ${CVE.certbot.id}, ${CVE.curl.id}
## ${fr ? 'Sans objet' : 'Not applicable'}
${fr ? 'rien' : 'nothing'}`;
      editer('nano veille.md', mauvais);
      expect(c.termines).not.toContain('bulletin');
    });

    // ——— Chapitre 2 : « La priorité » ———
    const PRIORITE_DOC = (inverse = false) => {
      const ids = inverse ? [CVE.rsync.id, CVE.nginx.id] : [CVE.nginx.id, CVE.rsync.id];
      return `# ${fr ? 'Priorité' : 'Priority'}
1. ${ids[0]} — ${fr ? 'joignable depuis internet (80, 443)' : 'reachable from the internet (80, 443)'}
2. ${ids[1]} — ${fr ? "aucun port en écoute, c'est un outil local" : 'no port at all, a local tool'}
${CVE.ssh.id} (openssh-server) : ${fr ? 'déjà protégé (KbdInteractiveAuthentication à no), rien à faire' : 'already protected (KbdInteractiveAuthentication set to no), nothing to do'}`;
    };

    it('chapitre 2 — solution : nginx avant rsync, avec pourquoi', () => {
      const { c, jouer, editer } = partie(['bulletin']);
      const tout = jouer(['ss -tlnp']);
      expect(tout).toContain(':80');
      expect(tout.split('\n').filter((l) => l.startsWith('LISTEN')).join('\n')).not.toContain('rsync');
      editer('nano priorite.md', () => PRIORITE_DOC(false));
      expect(c.termines).toContain('priorite');
    });

    it('chapitre 2 — fausse piste : classer par score seul (rsync avant nginx)', () => {
      const { c, jouer, editer } = partie(['bulletin']);
      const e = (id: string) => c.shell.drapeaux.has(id);
      jouer(['nmap -sV petrin.internal']);
      editer('nano priorite.md', () => PRIORITE_DOC(true));
      expect(e('score-seul') || !c.termines.includes('priorite')).toBe(true);
      expect(c.termines).not.toContain('priorite');
      editer('nano priorite.md', () => PRIORITE_DOC(false));
      expect(c.termines).toContain('priorite');
    });

    // ——— Chapitre 3 : « Le correctif » ———
    it('chapitre 3 — solution : apt update puis upgrade, le site tient', () => {
      const { c, jouer } = partie(['bulletin', 'priorite']);
      let tout = jouer(['sudo apt upgrade']);
      expect(tout).toContain('Upgrading: 0');
      expect(c.termines).not.toContain('correctif');
      jouer(['sudo apt update', 'sudo apt upgrade -y']);
      tout = jouer(['curl -I http://fournil.example/']);
      expect(tout).toContain('200');
      expect(c.termines).toContain('correctif');
    });

    // ——— Chapitre 4 : « Sans preuve, pas de certitude » ———
    it('chapitre 4 — solution : apt confirme, la tentative est trouvée dans le journal', () => {
      const { c, jouer } = partie(['bulletin', 'priorite', 'correctif']);
      let tout = jouer(['apt list --upgradable']);
      expect(tout).toContain('Listing... Done');
      expect(c.termines).not.toContain('preuve');
      tout = jouer(['grep "HTTP/2" /var/log/nginx/access.log']);
      expect(tout).toContain('203.0.113.77');
      jouer(['curl -I http://fournil.example/']);
      expect(c.termines).toContain('preuve');
    });

    // ——— Chapitre 5 : « Mettre en veille » ———
    const VINGT_ACTIF = (t: string) => t.replace('"0"', '"1"').replace('"0"', '"1"');
    const restreindre = (t: string) =>
      t
        .replace(/^(\s*"origin=\$\{distro_codename\},label=Debian";)$/m, '//$1')
        .replace(/^(\s*)"origin=Debian,codename=\$\{distro_codename\},label=Debian";$/m, '$1//"origin=Debian,codename=${distro_codename},label=Debian";')
        .replace('//Unattended-Upgrade::Mail "";', 'Unattended-Upgrade::Mail "root";');

    it('chapitre 5 — solution : unattended-upgrades restreint à la sécurité, une tâche cron hebdomadaire', () => {
      const { c, jouer, editer } = partie(['bulletin', 'priorite', 'correctif', 'preuve']);
      editer('sudo nano /etc/apt/apt.conf.d/20auto-upgrades', VINGT_ACTIF);
      expect(c.termines).not.toContain('routine');
      editer('sudo nano /etc/apt/apt.conf.d/50unattended-upgrades', restreindre);
      expect(c.termines).not.toContain('routine');
      editer('sudo crontab -e', (t) => `${t}\n0 9 * * 1 apt list --upgradable | mail -s "Veille hebdomadaire" root\n`);
      expect(c.termines).toContain('routine');
    });

    it('chapitre 5 — une autre voie : un timer systemd plutôt qu\'une tâche cron', () => {
      const { c, jouer, editer } = partie(['bulletin', 'priorite', 'correctif', 'preuve']);
      editer('sudo nano /etc/apt/apt.conf.d/20auto-upgrades', VINGT_ACTIF);
      editer('sudo nano /etc/apt/apt.conf.d/50unattended-upgrades', restreindre);
      editer(
        'sudo nano /etc/systemd/system/veille.service',
        () => '[Unit]\nDescription=Veille hebdomadaire\n\n[Service]\nType=oneshot\nExecStart=/bin/sh -c "apt list --upgradable | mail -s Veille root"\n',
      );
      editer(
        'sudo nano /etc/systemd/system/veille.timer',
        () => '[Unit]\nDescription=Veille hebdomadaire\n\n[Timer]\nOnCalendar=weekly\nPersistent=true\n\n[Install]\nWantedBy=timers.target\n',
      );
      jouer(['sudo systemctl enable --now veille.timer']);
      expect(c.termines).toContain('routine');
    });

    it('chapitre 5 — fausses pistes : actif sans restreindre à la sécurité, aucun rendez-vous', () => {
      const { c, jouer, editer } = partie(['bulletin', 'priorite', 'correctif', 'preuve']);
      const e = (id: string) => c.shell.drapeaux.has(id);
      editer('sudo nano /etc/apt/apt.conf.d/20auto-upgrades', VINGT_ACTIF);
      expect(e('active')).toBe(true);
      expect(e('securite')).toBe(false);
      editer('sudo nano /etc/apt/apt.conf.d/50unattended-upgrades', restreindre);
      expect(e('securite')).toBe(true);
      expect(c.termines).not.toContain('routine');
    });
  });
