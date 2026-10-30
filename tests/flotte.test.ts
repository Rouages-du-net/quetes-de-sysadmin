// « La flotte » : Ansible. Chaque chapitre rejoué dans chaque langue : la
// solution, une autre, et les fausses pistes.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/moteur/console';
import { HISTOIRES } from '../src/moteur/chapitres';
import { prerequis } from '../src/moteur/deverrouillage';
import { LANGUES, LANGUE_DE_REFERENCE, traducteur } from '../src/textes';
import { dansLaLangue } from './noms';

const EFFACEUR = HISTOIRES.find((h) => h.id === 'effaceur')!.chapitres.map((c) => c.id);
const AVANT = [...new Set([...EFFACEUR, ...prerequis('flotte')])];

for (const langue of LANGUES)
  describe(`Langue : ${langue}`, () => {
    const fr = langue === LANGUE_DE_REFERENCE;
    const L = (ligne: string) => dansLaLangue(traducteur(langue), ligne);
    const partie = (termines: string[], chapitre: string) => {
      const c = new Console({ langue, termines: [...AVANT, ...termines] });
      const jouer = (lignes: string[]) => lignes.map((l) => c.executer(L(l)) ?? '').join('\n');
      const ecrire = (fichier: string, changer: (texte: string) => string) => {
        c.executer(`nano ${fichier}`);
        c.enregistrer(changer(c.edition!.texte));
        return c.quitterEdition();
      };
      jouer(['ssh pilote', 'yes']);
      expect(c.distant?.shell.chapitre.id).toBe(chapitre);
      const centre = (n: string) => c.distant!.shell.interne(n)!;
      return { c, jouer, ecrire, centre };
    };

    describe("L'inventaire", () => {
      it('solution : le bon dossier, les clés d’hôte, le bon compte, le centre qui manque', () => {
        const { c, jouer, ecrire } = partie([], 'inventaire');
        let tout = jouer(['ansible centres -m ping']);
        expect(tout).toContain('[WARNING]: No inventory was parsed, only implicit localhost is available');
        tout = jouer(['cd ansible', 'ansible centres -m ping']);
        expect(tout).toContain('north | UNREACHABLE! => {');
        expect(tout).toContain('"msg": "Failed to connect to the host via ssh: Host key verification failed."');
        if (fr) expect(tout).toContain('ne pose\njamais'.replace('\n', ' '));
        for (const n of ['north', 'south', 'east']) jouer([`ssh deploy@${n}`, 'yes', 'exit']);
        tout = jouer(['ansible centres -m ping']);
        expect(tout).toContain('theo@north: Permission denied (publickey,password).');
        ecrire('ansible.cfg', (t) => t.replace('remote_user = theo', 'remote_user = deploy'));
        tout = jouer(['ansible centres -m ping', 'ansible-inventory --graph']);
        expect(tout).toContain('"ping": "pong"');
        expect(tout).toContain('  |--@centres:\n  |  |--north\n  |  |--south');
        if (fr) expect(tout).toContain('connaît que deux');
        expect(c.termines).not.toContain('inventaire');
        ecrire('inventory.ini', (t) => `${t}\neast\n`);
        tout = jouer(['ansible centres -m ping']);
        expect(tout).toContain('east | SUCCESS => {');
        if (fr) expect(tout).toContain('https://docs.ansible.com/ansible/latest/inventory_guide/intro_inventory.html');
        expect(c.termines).toContain('inventaire');
      });

      it('autre solution : host_key_checking coupé, -u deploy ; et les commandes', () => {
        const { c, jouer, ecrire } = partie([], 'inventaire');
        jouer(['cd ansible']);
        ecrire('ansible.cfg', (t) => `${t}\nhost_key_checking = False\n`);
        ecrire('inventory.ini', (t) => `${t}\neast\n`);
        let tout = jouer(['ansible --version', 'ansible-doc -l', 'ansible-doc ping', 'man ansible', 'ansible centres -x', 'ansible']);
        expect(tout).toContain('ansible [core 2.18.6]');
        expect(tout).toContain('ansible.builtin.lineinfile');
        expect(tout).toContain('> ANSIBLE.BUILTIN.PING');
        expect(tout).toContain('ansible: error: unrecognized arguments: -x');
        expect(tout).toContain('ansible: error: the following arguments are required: pattern');
        tout = jouer(['ansible centres -m ping -u deploy', 'ansible centres --list-hosts']);
        expect(tout).toContain('  hosts (3):');
        expect(c.termines).toContain('inventaire');
      });
    });

    describe('Le playbook', () => {
      const corriger = (ligne: string) => (t: string) =>
        t
          .replace(/shell: echo "(.*)" >> \/etc\/motd/, `copy:\n            content: "${ligne}\\n"\n            dest: /etc/motd`)
          .replace('command: mkdir /srv/shared', 'file:\n            path: /srv/shared\n            state: directory\n            mode: "0755"');

      it('solution : copy et file, puis une deuxième exécution qui ne change rien', () => {
        const { c, jouer, ecrire, centre } = partie(['inventaire'], 'playbook');
        let tout = jouer(['cd ansible', 'ansible-playbook site.yml']);
        expect(tout).toMatch(/fatal: \[north\]: FAILED! => \{"changed": true, "cmd": \["mkdir", "\/srv\/shared"\], "rc": 1/);
        expect(tout).toMatch(/north +: ok=3 +changed=1 +unreachable=0 +failed=1/);
        if (fr) expect(tout).toContain('ligne en double');
        expect(c.distant!.shell.statut).toBe(2);
        const ligne = c.t('playbook-ligne-motd');
        ecrire('site.yml', corriger(ligne));
        // La répétition ne change rien.
        tout = jouer(['ansible-playbook site.yml --check --diff']);
        expect(tout).toContain('--- before: /etc/motd');
        expect(centre('south').lire('/etc/motd')!.split(ligne).length - 1).toBe(1);
        tout = jouer(['ansible-playbook site.yml']);
        expect(tout).toMatch(/south +: ok=4 +changed=1 +unreachable=0 +failed=0/);
        if (fr) expect(tout).toContain('en le relançant');
        expect(c.termines).not.toContain('playbook');
        tout = jouer(['ansible-playbook site.yml', 'ansible centres -a "cat /etc/motd"']);
        expect(tout).toMatch(/east +: ok=4 +changed=0 +unreachable=0 +failed=0/);
        expect(centre('north').lire('/etc/motd')).toBe(`${ligne}\n`);
        expect(c.termines).toContain('playbook');
      });

      it('autre solution : command avec creates ; fausses pistes : lineinfile qui garde le doublon, YAML et module mal écrits', () => {
        const { c, jouer, ecrire, centre } = partie(['inventaire'], 'playbook');
        const ligne = c.t('playbook-ligne-motd');
        jouer(['cd ansible']);
        // Une erreur de YAML : Ansible montre la ligne fautive.
        ecrire('site.yml', (t) => t.replace('      apt:\n', '      apt: name: htop\n'));
        let tout = jouer(['ansible-playbook site.yml --syntax-check']);
        expect(tout).toContain('ERROR! Syntax Error while loading YAML.\n  mapping values are not allowed in this context');
        ecrire('site.yml', (t) => t.replace('      apt: name: htop\n', '      aptt:\n'));
        tout = jouer(['ansible-playbook site.yml']);
        expect(tout).toContain("ERROR! couldn't resolve module/action 'aptt'");
        ecrire('site.yml', (t) =>
          t
            .replace('      aptt:\n', '      apt:\n')
            .replace(/shell: echo "(.*)" >> \/etc\/motd/, `lineinfile:\n            path: /etc/motd\n            regexp: Ansible\n            line: "${ligne}"`)
            .replace('command: mkdir /srv/shared', 'command: mkdir /srv/shared creates=/srv/shared'),
        );
        jouer(['ansible-playbook site.yml', 'ansible-playbook site.yml']);
        // lineinfile remplace la dernière ligne trouvée : sur north, la ligne en double reste.
        expect(centre('north').lire('/etc/motd')!.split(ligne).length - 1).toBe(2);
        expect(c.termines).not.toContain('playbook');
        ecrire('site.yml', (t) => t.replace(`lineinfile:\n            path: /etc/motd\n            regexp: Ansible\n            line: "${ligne}"`, `copy:\n            content: "${ligne}\\n"\n            dest: /etc/motd`));
        jouer(['ansible-playbook site.yml', 'ansible-playbook site.yml']);
        expect(c.termines).toContain('playbook');
      });
    });

    describe('La répétition', () => {
      const memeNom = (t: string) => t.replace(/notify: (\S+) ssh/, (_, mot: string) => `notify: ${mot.toLowerCase()} ssh`);

      it('solution : la répétition, le handler, un centre, puis tous', () => {
        const { c, jouer, ecrire, centre } = partie(['inventaire', 'playbook'], 'repetition');
        let tout = jouer(['cd ansible', 'ansible-playbook ssh.yml --check --diff']);
        expect(tout).toContain('+PasswordAuthentication no');
        expect(tout).toContain("ERROR! The requested handler '");
        expect(centre('north').lire('/etc/ssh/sshd_config')).not.toContain('PasswordAuthentication no');
        if (fr) expect(tout).toContain('majuscules comprises');
        // Sans corriger, sur north : le fichier change, sshd n'est pas rechargé.
        tout = jouer(['ansible-playbook ssh.yml --limit north']);
        expect(centre('north').etat.sshd.charge.passwordauthentication).toBe('yes');
        if (fr) expect(tout).toContain('ne notifie plus');
        ecrire('ssh.yml', memeNom);
        tout = jouer(['ansible-playbook ssh.yml --limit north']);
        expect(tout).toMatch(/north +: ok=2 +changed=0/);
        tout = jouer(['ansible north -b -m service -a "name=ssh state=reloaded"', 'ansible north -m ping']);
        expect(tout).toContain('north | CHANGED => {');
        expect(centre('north').etat.sshd.charge.passwordauthentication).toBe('no');
        tout = jouer(['ansible-playbook ssh.yml']);
        expect(tout).toContain('RUNNING HANDLER [');
        expect(c.termines).not.toContain('repetition');
        tout = jouer(['ansible-playbook ssh.yml']);
        expect(tout).toMatch(/east +: ok=2 +changed=0 +unreachable=0 +failed=0/);
        if (fr) expect(tout).toContain('https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_handlers.html');
        expect(c.termines).toContain('repetition');
      });

      it('autre solution : le handler renommé dès la répétition, puis --limit et tous', () => {
        const { c, jouer, ecrire } = partie(['inventaire', 'playbook'], 'repetition');
        jouer(['cd ansible']);
        ecrire('ssh.yml', (t) => t.replace(/- name: (\S+) ssh\n/, (_, mot: string) => `- name: ${mot[0].toUpperCase()}${mot.slice(1)} ssh\n`));
        let tout = jouer(['ansible-playbook ssh.yml --check']);
        expect(tout).not.toContain('ERROR!');
        tout = jouer(['ansible-playbook ssh.yml -l north', 'ansible-playbook ssh.yml', 'ansible-playbook ssh.yml']);
        if (fr) expect(tout).toContain("qu'on s'y connecte toujours");
        expect(c.termines).toContain('repetition');
      });
    });
  });
