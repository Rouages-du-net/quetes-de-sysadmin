// The simulated network: from the workstation, ssh to the stories'
// machines; finishing the Eraser gives the other keys. Faithful OpenSSH
// messages (in English, like the real ssh). Replayed in each language.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { hostKey, fingerprint, storyMachine } from '../src/engine/machines';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage } from './names';

// The three chapters that give the keys (the fourth, added later, doesn't count).
const ERASER = ['lighthouse', 'village', 'root'];

for (const language of LANGUAGES)
  describe(`Language: ${language}`, () => {
    // The lines are written with the French names (see names.ts).
    const L = (line: string) => inLanguage(translator(language), line);
    const play = (c: Console, lines: string[]) => lines.map((l) => c.execute(L(l)) ?? '').join('\n');

    it('first connection: fingerprint, yes, banner, chapter, exit', () => {
      const c = new Console({ language });
      expect(c.prompt()).toBe(L('you@desk:~$'));
      const question = play(c, ['ssh kingdom']);
      expect(question).toContain(L("The authenticity of host 'kingdom.internal (192.0.2.10)' can't be established."));
      expect(question).toMatch(/ED25519 key fingerprint is SHA256:[A-Za-z0-9+/]{43}\./);
      expect(c.prompt()).toBe('Are you sure you want to continue connecting (yes/no/[fingerprint])?');
      expect(play(c, ['peut-être'])).toBe('');
      expect(c.prompt()).toBe("Please type 'yes', 'no' or the fingerprint:");
      const connection = play(c, ['yes']);
      expect(connection).toContain(L("Warning: Permanently added 'kingdom.internal' (ED25519) to the list of known hosts."));
      expect(connection).toContain(L('Linux kingdom'));
      expect(c.prompt()).toBe(L('you@kingdom:~$'));
      expect(c.remote?.shell.chapter.id).toBe('lighthouse');
      expect(play(c, ['exit'])).toBe(L('logout\nConnection to kingdom.internal closed.'));
      expect(c.prompt()).toBe(L('you@desk:~$'));
      // Second time: the machine is known, no question; the chapter resumes, with where to reread its instructions.
      const reprise = play(c, ['ssh kingdom']);
      expect(reprise).not.toContain('authenticity');
      expect(reprise).toContain(L('cat welcome.txt'));
      expect(c.prompt()).toBe(L('you@kingdom:~$'));
    });

    it('no: host key verification fails', () => {
      const c = new Console({ language });
      expect(play(c, ['ssh kingdom', 'no'])).toContain('Host key verification failed.');
      expect(c.prompt()).toBe(L('you@desk:~$'));
    });

    it('false leads: unknown name, wrong port, wrong user, the workstation itself', () => {
      const c = new Console({ language });
      expect(play(c, ['ssh nulle-part'])).toBe('ssh: Could not resolve hostname nulle-part: Name or service not known');
      expect(play(c, ['ssh -p 2222 kingdom'])).toBe(L('ssh: connect to host kingdom.internal port 2222: Connection refused'));
      expect(play(c, ['ssh desk'])).toBe(L('ssh: connect to host desk port 22: Connection refused'));
      expect(play(c, ['ssh', ''])).toContain('usage: ssh');
      expect(play(c, ['ssh root@kingdom', 'yes'])).toContain(L('root@kingdom.internal: Permission denied (publickey).'));
    });

    it('without the key: Permission denied, then the key earned by finishing the Eraser', () => {
      const c = new Console({ language });
      expect(c.isOpen('datacenter')).toBe(false);
      expect(play(c, ['ssh datacenter', 'yes'])).toContain(L('you@datacenter.internal: Permission denied (publickey).'));
      const end = new Console({ language, finished: ERASER.slice(0, 2) });
      end.connect('kingdom');
      expect(end.remote?.shell.chapter.id).toBe('root');
      const last = play(end, ['cat arrival.txt', 'chmod o-w memories', 'sudo cp ~/eraser.conf.fixed /etc/eraser.conf', 'sunflower']);
      expect(end.finished).toEqual(ERASER);
      expect(last).toContain('~/.ssh/id_datacenter');
      expect(play(end, ['exit', 'ls -a ~/.ssh'])).toContain(L('id_library'));
      play(end, ['ssh datacenter', 'yes']);
      expect(end.prompt()).toBe(L('you@datacenter:~$'));
      expect(end.remote?.story.id).toBe(L('datacenter'));
    });

    it('a private key that is too open is ignored, as with the real ssh', () => {
      const c = new Console({ language });
      const output = play(c, ['chmod 644 ~/.ssh/id_kingdom', 'ssh kingdom', 'yes']);
      expect(output).toContain('WARNING: UNPROTECTED PRIVATE KEY FILE!');
      expect(output).toContain(L("Permissions 0644 for '/home/you/.ssh/id_kingdom' are too open."));
      expect(output).toContain(L('you@kingdom.internal: Permission denied (publickey).'));
      play(c, ['chmod 600 ~/.ssh/id_kingdom', 'ssh kingdom']);
      expect(c.prompt()).toBe(L('you@kingdom:~$'));
    });

    it('-i: a key copied elsewhere works too', () => {
      const c = new Console({ language, knownHosts: '' });
      play(c, ['ssh -i ~/.ssh/id_kingdom you@192.0.2.10', 'yes']);
      expect(c.prompt()).toBe(L('you@kingdom:~$'));
    });

    it('known hosts kept from one game to the next', () => {
      const c = new Console({ language });
      play(c, ['ssh kingdom', 'yes', 'exit']);
      const next = new Console({ language, knownHosts: c.knownHosts() });
      expect(play(next, ['ssh kingdom'])).not.toContain('authenticity');
    });

    it('the machine keeps its state from one connection to the next', () => {
      const c = new Console({ language });
      play(c, ['ssh kingdom', 'yes', 'cd Hill/SignalSchool/PracticeRoom', 'mv crab Bucket', 'exit']);
      const back = play(c, ['ssh kingdom']);
      expect(back).toContain('— ');
      // Like a new connection: start again from your home, the world hasn't changed.
      expect(c.prompt()).toBe(L('you@kingdom:~$'));
      expect(play(c, ['ls Hill/SignalSchool/PracticeRoom/Bucket'])).toBe(L('crab'));
    });

    it('reboot cuts the ssh session; the machine has restarted when you come back', () => {
      const finished = STORIES.find((h) => h.id === 'datacenter')!
        .chapters.slice(0, 2)
        .map((c) => c.id);
      const c = new Console({ language, finished: [...ERASER, ...finished] });
      play(c, ['ssh datacenter', 'yes']);
      expect(c.remote?.shell.chapter.id).toBe('reboot-night');
      const cut = play(c, ['sudo reboot', 'welcome-2026']);
      expect(cut).toContain(L('Connection to datacenter.internal closed by remote host.'));
      expect(c.prompt()).toBe(L('you@desk:~$'));
      play(c, ['ssh datacenter']);
      expect(play(c, ['journalctl -b -u catalogue -n 1'])).toContain('Failed to start catalogue.service');
    });

    it('the machine reinstalled after the fire: new host key, ssh refuses, ssh-keygen -R', () => {
      const finished = STORIES.find((h) => h.id === 'datacenter')!
        .chapters.slice(0, 3)
        .map((c) => c.id);
      const c = new Console({ language, finished: [...ERASER, ...finished] });
      // The old server's key, known from the previous chapters.
      const old = `datacenter.internal ${hostKey(storyMachine('datacenter')!)}`;
      c.workstation.place('test', '~/.ssh/known_hosts', { type: 'file', content: old, lines: true });
      const refusal = play(c, ['ssh datacenter']);
      expect(refusal).toContain('WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!');
      expect(refusal).toContain(L("ssh-keygen -f '/home/you/.ssh/known_hosts' -R 'datacenter.internal'"));
      expect(refusal).toContain('Host key verification failed.');
      expect(c.prompt()).toBe(L('you@desk:~$'));
      // The short name is not the one written in known_hosts.
      expect(play(c, ['ssh-keygen -R datacenter'])).toContain(L('Host datacenter not found'));
      expect(play(c, ['ssh-keygen -F datacenter.internal'])).toContain(L('# Host datacenter.internal found: line 1'));
      const retire = play(c, ['ssh-keygen -R datacenter.internal']);
      expect(retire).toContain(L('/home/you/.ssh/known_hosts updated.'));
      expect(c.workstation.read('~/.ssh/known_hosts.old')).toBe(old);
      const question = play(c, ['ssh datacenter']);
      expect(question).toContain(`ED25519 key fingerprint is ${fingerprint(storyMachine('datacenter')!, '-after-fire')}.`);
      play(c, ['yes']);
      expect(c.remote?.shell.chapter.id).toBe('fire');
      // Reconnecting asks no more questions: the new key is known.
      play(c, ['exit']);
      expect(play(c, ['ssh datacenter'])).not.toContain('WARNING');
      expect(c.prompt()).toBe(L('you@datacenter:~$'));
      expect(play(c, ['exit', 'ssh-keygen -l -f ~/.ssh/known_hosts'])).toContain(
        `${fingerprint(storyMachine('datacenter')!, '-after-fire')} datacenter.internal (ED25519)`,
      );
    });

    it('Tab completes the machines of ~/.ssh/config', () => {
      const c = new Console({ language });
      // The first three letters of the name in the language (roy, kin): Tab completes the rest.
      const start = (id: string) => L(`ssh ${id}`).slice(0, 7);
      expect(c.complete(start('kingdom'))).toBe(L('ssh kingdom '));
      expect(c.complete(start('library'))).toBe(L('ssh library '));
    });

    it.runIf(language === 'fr')('exit on the workstation explains where you are', () => {
      expect(play(new Console({ language }), ['exit'])).toContain(L('Tu es sur ton propre poste'));
    });
  });
