// Le réseau simulé : du poste, on se connecte en ssh aux machines des
// histoires ; finir l'Effaceur donne les autres clés. Messages d'OpenSSH
// fidèles (en anglais, comme le vrai ssh). Rejoué dans chaque langue.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { hostKey, fingerprint, storyMachine } from '../src/engine/machines';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage } from './names';

// Les trois chapitres qui donnent les clés (le quatrième, ajouté ensuite, ne compte pas).
const ERASER = ['lighthouse', 'village', 'root'];

for (const language of LANGUAGES)
  describe(`Langue : ${language}`, () => {
    // Les lignes s'écrivent avec les noms français (voir noms.ts).
    const L = (line: string) => inLanguage(translator(language), line);
    const play = (c: Console, lines: string[]) => lines.map((l) => c.execute(L(l)) ?? '').join('\n');

    it('première connexion : empreinte, yes, bannière, chapitre, exit', () => {
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
      // Deuxième fois : la machine est connue, pas de question ; le chapitre reprend, avec où relire ses consignes.
      const reprise = play(c, ['ssh kingdom']);
      expect(reprise).not.toContain('authenticity');
      expect(reprise).toContain(L('cat welcome.txt'));
      expect(c.prompt()).toBe(L('you@kingdom:~$'));
    });

    it('no : la vérification de la clé d’hôte échoue', () => {
      const c = new Console({ language });
      expect(play(c, ['ssh kingdom', 'no'])).toContain('Host key verification failed.');
      expect(c.prompt()).toBe(L('you@desk:~$'));
    });

    it('fausses pistes : nom inconnu, mauvais port, mauvais utilisateur, poste lui-même', () => {
      const c = new Console({ language });
      expect(play(c, ['ssh nulle-part'])).toBe('ssh: Could not resolve hostname nulle-part: Name or service not known');
      expect(play(c, ['ssh -p 2222 kingdom'])).toBe(L('ssh: connect to host kingdom.internal port 2222: Connection refused'));
      expect(play(c, ['ssh desk'])).toBe(L('ssh: connect to host desk port 22: Connection refused'));
      expect(play(c, ['ssh', ''])).toContain('usage: ssh');
      expect(play(c, ['ssh root@kingdom', 'yes'])).toContain(L('root@kingdom.internal: Permission denied (publickey).'));
    });

    it('sans la clé : Permission denied, puis la clé gagnée en finissant l’Effaceur', () => {
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

    it('une clé privée trop ouverte est ignorée, comme avec le vrai ssh', () => {
      const c = new Console({ language });
      const output = play(c, ['chmod 644 ~/.ssh/id_kingdom', 'ssh kingdom', 'yes']);
      expect(output).toContain('WARNING: UNPROTECTED PRIVATE KEY FILE!');
      expect(output).toContain(L("Permissions 0644 for '/home/you/.ssh/id_kingdom' are too open."));
      expect(output).toContain(L('you@kingdom.internal: Permission denied (publickey).'));
      play(c, ['chmod 600 ~/.ssh/id_kingdom', 'ssh kingdom']);
      expect(c.prompt()).toBe(L('you@kingdom:~$'));
    });

    it('-i : une clé copiée ailleurs marche aussi', () => {
      const c = new Console({ language, knownHosts: '' });
      play(c, ['ssh -i ~/.ssh/id_kingdom you@192.0.2.10', 'yes']);
      expect(c.prompt()).toBe(L('you@kingdom:~$'));
    });

    it('hôtes connus gardés d’une partie à l’autre', () => {
      const c = new Console({ language });
      play(c, ['ssh kingdom', 'yes', 'exit']);
      const next = new Console({ language, knownHosts: c.knownHosts() });
      expect(play(next, ['ssh kingdom'])).not.toContain('authenticity');
    });

    it('la machine garde son état d’une connexion à l’autre', () => {
      const c = new Console({ language });
      play(c, ['ssh kingdom', 'yes', 'cd Hill/SignalSchool/PracticeRoom', 'mv crab Bucket', 'exit']);
      const back = play(c, ['ssh kingdom']);
      expect(back).toContain('— ');
      // Comme une nouvelle connexion : on repart de sa maison, le monde n'a pas bougé.
      expect(c.prompt()).toBe(L('you@kingdom:~$'));
      expect(play(c, ['ls Hill/SignalSchool/PracticeRoom/Bucket'])).toBe(L('crab'));
    });

    it('reboot coupe la session ssh ; la machine a redémarré quand on revient', () => {
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

    it('la machine réinstallée après l’incendie : nouvelle clé d’hôte, ssh refuse, ssh-keygen -R', () => {
      const finished = STORIES.find((h) => h.id === 'datacenter')!
        .chapters.slice(0, 3)
        .map((c) => c.id);
      const c = new Console({ language, finished: [...ERASER, ...finished] });
      // La clé de l'ancien serveur, connue depuis les chapitres précédents.
      const old = `datacenter.internal ${hostKey(storyMachine('datacenter')!)}`;
      c.workstation.place('test', '~/.ssh/known_hosts', { type: 'file', content: old, lines: true });
      const refusal = play(c, ['ssh datacenter']);
      expect(refusal).toContain('WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!');
      expect(refusal).toContain(L("ssh-keygen -f '/home/you/.ssh/known_hosts' -R 'datacenter.internal'"));
      expect(refusal).toContain('Host key verification failed.');
      expect(c.prompt()).toBe(L('you@desk:~$'));
      // Le nom court n'est pas celui écrit dans known_hosts.
      expect(play(c, ['ssh-keygen -R datacenter'])).toContain(L('Host datacenter not found'));
      expect(play(c, ['ssh-keygen -F datacenter.internal'])).toContain(L('# Host datacenter.internal found: line 1'));
      const retire = play(c, ['ssh-keygen -R datacenter.internal']);
      expect(retire).toContain(L('/home/you/.ssh/known_hosts updated.'));
      expect(c.workstation.read('~/.ssh/known_hosts.old')).toBe(old);
      const question = play(c, ['ssh datacenter']);
      expect(question).toContain(`ED25519 key fingerprint is ${fingerprint(storyMachine('datacenter')!, '-apres-incendie')}.`);
      play(c, ['yes']);
      expect(c.remote?.shell.chapter.id).toBe('fire');
      // Se reconnecter ne pose plus de question : la nouvelle clé est connue.
      play(c, ['exit']);
      expect(play(c, ['ssh datacenter'])).not.toContain('WARNING');
      expect(c.prompt()).toBe(L('you@datacenter:~$'));
      expect(play(c, ['exit', 'ssh-keygen -l -f ~/.ssh/known_hosts'])).toContain(
        `${fingerprint(storyMachine('datacenter')!, '-apres-incendie')} datacenter.internal (ED25519)`,
      );
    });

    it('Tab complète les machines de ~/.ssh/config', () => {
      const c = new Console({ language });
      // Les trois premières lettres du nom dans la langue (roy, kin) : Tab complète le reste.
      const start = (id: string) => L(`ssh ${id}`).slice(0, 7);
      expect(c.complete(start('kingdom'))).toBe(L('ssh kingdom '));
      expect(c.complete(start('library'))).toBe(L('ssh library '));
    });

    it.runIf(language === 'fr')('exit sur le poste explique où l’on est', () => {
      expect(play(new Console({ language }), ['exit'])).toContain(L('Tu es sur ton propre poste'));
    });
  });
