// « La flotte » : Ansible. Chaque chapitre rejoué dans chaque langue : la
// solution, une autre, et les fausses pistes.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage } from './names';

const ERASER = STORIES.find((h) => h.id === 'effaceur')!.chapters.map((c) => c.id);
const BEFORE = [...new Set([...ERASER, ...prerequisites('flotte')])];

for (const language of LANGUAGES)
  describe(`Langue : ${language}`, () => {
    const fr = language === 'fr';
    const L = (line: string) => inLanguage(translator(language), line);
    const part = (finished: string[], chapter: string) => {
      const c = new Console({ language, finished: [...BEFORE, ...finished] });
      const play = (lines: string[]) => lines.map((l) => c.execute(L(l)) ?? '').join('\n');
      const write = (file: string, change: (text: string) => string) => {
        c.execute(`nano ${file}`);
        c.save(change(c.edition!.text));
        return c.quitEdition();
      };
      play(['ssh pilote', 'yes']);
      expect(c.remote?.shell.chapter.id).toBe(chapter);
      const centre = (n: string) => c.remote!.shell.internal(n)!;
      return { c, jouer: play, ecrire: write, centre };
    };

    describe("L'inventaire", () => {
      it('solution : le bon dossier, les clés d’hôte, le bon compte, le centre qui manque', () => {
        const { c, jouer: play, ecrire: write } = part([], 'inventaire');
        let all = play(['ansible centres -m ping']);
        expect(all).toContain('[WARNING]: No inventory was parsed, only implicit localhost is available');
        all = play(['cd ansible', 'ansible centres -m ping']);
        expect(all).toContain('north | UNREACHABLE! => {');
        expect(all).toContain('"msg": "Failed to connect to the host via ssh: Host key verification failed."');
        if (fr) expect(all).toContain('ne pose\njamais'.replace('\n', ' '));
        for (const n of ['north', 'south', 'east']) play([`ssh deploy@${n}`, 'yes', 'exit']);
        all = play(['ansible centres -m ping']);
        expect(all).toContain('theo@north: Permission denied (publickey,password).');
        write('ansible.cfg', (t) => t.replace('remote_user = theo', 'remote_user = deploy'));
        all = play(['ansible centres -m ping', 'ansible-inventory --graph']);
        expect(all).toContain('"ping": "pong"');
        expect(all).toContain('  |--@centres:\n  |  |--north\n  |  |--south');
        if (fr) expect(all).toContain('connaît que deux');
        expect(c.finished).not.toContain('inventaire');
        write('inventory.ini', (t) => `${t}\neast\n`);
        all = play(['ansible centres -m ping']);
        expect(all).toContain('east | SUCCESS => {');
        if (fr) expect(all).toContain('https://docs.ansible.com/ansible/latest/inventory_guide/intro_inventory.html');
        expect(c.finished).toContain('inventaire');
      });

      it('autre solution : host_key_checking coupé, -u deploy ; et les commandes', () => {
        const { c, jouer: play, ecrire: write } = part([], 'inventaire');
        play(['cd ansible']);
        write('ansible.cfg', (t) => `${t}\nhost_key_checking = False\n`);
        write('inventory.ini', (t) => `${t}\neast\n`);
        let all = play(['ansible --version', 'ansible-doc -l', 'ansible-doc ping', 'man ansible', 'ansible centres -x', 'ansible']);
        expect(all).toContain('ansible [core 2.18.6]');
        expect(all).toContain('ansible.builtin.lineinfile');
        expect(all).toContain('> ANSIBLE.BUILTIN.PING');
        expect(all).toContain('ansible: error: unrecognized arguments: -x');
        expect(all).toContain('ansible: error: the following arguments are required: pattern');
        all = play(['ansible centres -m ping -u deploy', 'ansible centres --list-hosts']);
        expect(all).toContain('  hosts (3):');
        expect(c.finished).toContain('inventaire');
      });
    });

    describe('Le playbook', () => {
      const fix = (line: string) => (t: string) =>
        t
          .replace(/shell: echo "(.*)" >> \/etc\/motd/, `copy:\n            content: "${line}\\n"\n            dest: /etc/motd`)
          .replace('command: mkdir /srv/shared', 'file:\n            path: /srv/shared\n            state: directory\n            mode: "0755"');

      it('solution : copy et file, puis une deuxième exécution qui ne change rien', () => {
        const { c, jouer: play, ecrire: write, centre } = part(['inventaire'], 'playbook');
        let all = play(['cd ansible', 'ansible-playbook site.yml']);
        expect(all).toMatch(/fatal: \[north\]: FAILED! => \{"changed": true, "cmd": \["mkdir", "\/srv\/shared"\], "rc": 1/);
        expect(all).toMatch(/north +: ok=3 +changed=1 +unreachable=0 +failed=1/);
        if (fr) expect(all).toContain('ligne en double');
        expect(c.remote!.shell.status).toBe(2);
        const line = c.t('playbook-ligne-motd');
        write('site.yml', fix(line));
        // La répétition ne change rien.
        all = play(['ansible-playbook site.yml --check --diff']);
        expect(all).toContain('--- before: /etc/motd');
        expect(centre('south').read('/etc/motd')!.split(line).length - 1).toBe(1);
        all = play(['ansible-playbook site.yml']);
        expect(all).toMatch(/south +: ok=4 +changed=1 +unreachable=0 +failed=0/);
        if (fr) expect(all).toContain('en le relançant');
        expect(c.finished).not.toContain('playbook');
        all = play(['ansible-playbook site.yml', 'ansible centres -a "cat /etc/motd"']);
        expect(all).toMatch(/east +: ok=4 +changed=0 +unreachable=0 +failed=0/);
        expect(centre('north').read('/etc/motd')).toBe(`${line}\n`);
        expect(c.finished).toContain('playbook');
      });

      it('autre solution : command avec creates ; fausses pistes : lineinfile qui garde le doublon, YAML et module mal écrits', () => {
        const { c, jouer: play, ecrire: write, centre } = part(['inventaire'], 'playbook');
        const line = c.t('playbook-ligne-motd');
        play(['cd ansible']);
        // Une erreur de YAML : Ansible montre la ligne fautive.
        write('site.yml', (t) => t.replace('      apt:\n', '      apt: name: htop\n'));
        let all = play(['ansible-playbook site.yml --syntax-check']);
        expect(all).toContain('ERROR! Syntax Error while loading YAML.\n  mapping values are not allowed in this context');
        write('site.yml', (t) => t.replace('      apt: name: htop\n', '      aptt:\n'));
        all = play(['ansible-playbook site.yml']);
        expect(all).toContain("ERROR! couldn't resolve module/action 'aptt'");
        write('site.yml', (t) =>
          t
            .replace('      aptt:\n', '      apt:\n')
            .replace(/shell: echo "(.*)" >> \/etc\/motd/, `lineinfile:\n            path: /etc/motd\n            regexp: Ansible\n            line: "${line}"`)
            .replace('command: mkdir /srv/shared', 'command: mkdir /srv/shared creates=/srv/shared'),
        );
        play(['ansible-playbook site.yml', 'ansible-playbook site.yml']);
        // lineinfile remplace la dernière ligne trouvée : sur north, la ligne en double reste.
        expect(centre('north').read('/etc/motd')!.split(line).length - 1).toBe(2);
        expect(c.finished).not.toContain('playbook');
        write('site.yml', (t) => t.replace(`lineinfile:\n            path: /etc/motd\n            regexp: Ansible\n            line: "${line}"`, `copy:\n            content: "${line}\\n"\n            dest: /etc/motd`));
        play(['ansible-playbook site.yml', 'ansible-playbook site.yml']);
        expect(c.finished).toContain('playbook');
      });
    });

    describe('La répétition', () => {
      const sameName = (t: string) => t.replace(/notify: (\S+) ssh/, (_, word: string) => `notify: ${word.toLowerCase()} ssh`);

      it('solution : la répétition, le handler, un centre, puis tous', () => {
        const { c, jouer: play, ecrire: write, centre } = part(['inventaire', 'playbook'], 'repetition');
        let all = play(['cd ansible', 'ansible-playbook ssh.yml --check --diff']);
        expect(all).toContain('+PasswordAuthentication no');
        expect(all).toContain("ERROR! The requested handler '");
        expect(centre('north').read('/etc/ssh/sshd_config')).not.toContain('PasswordAuthentication no');
        if (fr) expect(all).toContain('majuscules comprises');
        // Sans corriger, sur north : le fichier change, sshd n'est pas rechargé.
        all = play(['ansible-playbook ssh.yml --limit north']);
        expect(centre('north').state.sshd.load.passwordauthentication).toBe('yes');
        if (fr) expect(all).toContain('ne notifie plus');
        write('ssh.yml', sameName);
        all = play(['ansible-playbook ssh.yml --limit north']);
        expect(all).toMatch(/north +: ok=2 +changed=0/);
        all = play(['ansible north -b -m service -a "name=ssh state=reloaded"', 'ansible north -m ping']);
        expect(all).toContain('north | CHANGED => {');
        expect(centre('north').state.sshd.load.passwordauthentication).toBe('no');
        all = play(['ansible-playbook ssh.yml']);
        expect(all).toContain('RUNNING HANDLER [');
        expect(c.finished).not.toContain('repetition');
        all = play(['ansible-playbook ssh.yml']);
        expect(all).toMatch(/east +: ok=2 +changed=0 +unreachable=0 +failed=0/);
        if (fr) expect(all).toContain('https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_handlers.html');
        expect(c.finished).toContain('repetition');
      });

      it('autre solution : le handler renommé dès la répétition, puis --limit et tous', () => {
        const { c, jouer: play, ecrire: write } = part(['inventaire', 'playbook'], 'repetition');
        play(['cd ansible']);
        write('ssh.yml', (t) => t.replace(/- name: (\S+) ssh\n/, (_, word: string) => `- name: ${word[0].toUpperCase()}${word.slice(1)} ssh\n`));
        let all = play(['ansible-playbook ssh.yml --check']);
        expect(all).not.toContain('ERROR!');
        all = play(['ansible-playbook ssh.yml -l north', 'ansible-playbook ssh.yml', 'ansible-playbook ssh.yml']);
        if (fr) expect(all).toContain("qu'on s'y connecte toujours");
        expect(c.finished).toContain('repetition');
      });
    });
  });
