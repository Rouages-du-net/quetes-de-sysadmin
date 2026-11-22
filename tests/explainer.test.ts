// The error explainer: the errors it recognises, as the game prints them in
// each language, and no explanation for a line that succeeded or for an
// error-looking text that is only a file's content.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { EXPLANATIONS, explain, markerPattern, markers, type Explanation } from '../src/engine/explainer';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage } from './names';

const chapter = (story: string, i = 0) => STORIES.find((s) => s.id === story)!.chapters[i];

// What the interface does (game.ts, submitNow): the line failed if it counts
// as a command in error (or a password was refused), and its own errors are
// read when the line produced new ones.
function session(story: string, language: string, i = 0) {
  const sh = new Shell(chapter(story, i), language);
  const t = translator(language);
  const run = (line: string): Explanation | null => {
    const secret = sh.maskedInput();
    const before = sh.commandsInError;
    const last = sh.last;
    const output = sh.execute(inLanguage(t, line)) ?? '';
    const failed = sh.commandsInError > before || (secret && (sh.waiting !== null || sh.lastStatus !== 0));
    const errors = sh.last !== last ? sh.last.errors.filter((e) => e && output.includes(e)) : null;
    return explain({ failed, output, errors }, t);
  };
  return { sh, run };
}

describe('Error explainer', () => {
  it('has a text for each explanation in every language', () => {
    for (const language of LANGUAGES) {
      const t = translator(language);
      for (const e of EXPLANATIONS) {
        expect(t.exists(`explainer-${e}`), `${language}: ${e}`).toBe(true);
        expect(markers(t, e).length, `${language}: ${e} has markers`).toBeGreaterThan(0);
      }
      expect(t.exists('explainer-button') && t.exists('display-explainer')).toBe(true);
    }
  });

  // A marker must be a message the game really prints: its words are in the engine or in the language's texts.
  it('only looks for messages the game prints', () => {
    const sources = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sources(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : []));
    const engine = sources('src/engine').map((f) => readFileSync(f, 'utf8')).join('\n');
    for (const language of LANGUAGES) {
      const texts = readdirSync(join('src/texts', language))
        .filter((f) => f.endsWith('.ftl') && f !== 'explainer.ftl')
        .map((f) => readFileSync(join('src/texts', language, f), 'utf8'))
        .join('\n');
      const own = readFileSync(join('src/texts', language, 'explainer.ftl'), 'utf8');
      const listed = [...own.matchAll(/^ {8}(\S.*)$/gm)].map((m) => m[1]);
      for (const marker of listed)
        for (const piece of marker.replace(/\$$/, '').split('*').map((p) => p.trim()).filter((p) => p.length > 3))
          expect(engine.includes(piece) || texts.includes(piece), `${language}: "${piece}"`).toBe(true);
    }
  });

  it('reads * and a final $ in a marker', () => {
    expect(markerPattern('Unit * not found.').test('Failed to start foo.service: Unit foo.service not found.')).toBe(true);
    expect(markerPattern(': not found$').test('sh: 1: foo: not found')).toBe(true);
    expect(markerPattern(': not found$').test('userdel: x mail spool (/var/mail/x) not found')).toBe(false);
    expect(markerPattern('a (b) c.').test('a (b) cd')).toBe(false);
  });

  for (const language of ['en', 'fr'])
    describe(language, () => {
      it('recognises the shell and file errors', () => {
        const { run } = session('eraser', language);
        expect(run('lss')).toBe('not-found');
        expect(run('cat nothing-here')).toBe('no-such-file');
        expect(run('cd /nowhere')).toBe('no-such-file');
        expect(run('cat /')).toBe('is-directory');
        expect(run('cd welcome.txt')).toBe('not-directory');
        expect(run('if then')).toBe('syntax');
        expect(run('ls )')).toBe('syntax');
      });

      it('recognises rights, sudo and services', () => {
        const { run } = session('datacenter', language);
        expect(run('touch /etc/x')).toBe('permission');
        expect(run('mkdir /etc/x')).toBe('permission');
        expect(run('echo hi > /etc/x')).toBe('permission');
        expect(run('kill 1')).toBe('not-permitted');
        expect(run('systemctl status nothing')).toBe('unit-not-found');
        expect(run('systemctl start nothing')).toBe('unit-not-found');
        // sudo: a wrong password, three times.
        expect(run('sudo ls /root')).toBe(null);
        expect(run('wrong')).toBe('sudo-password');
        expect(run('wrong')).toBe('sudo-password');
        expect(run('wrong')).toBe('sudo-password');
      });

      it('recognises PowerShell errors', () => {
        const { run } = session('music-school', language);
        expect(run('Get-Nothing')).toBe('ps-not-recognized');
        expect(run('Get-ChildItem')).toBe(null);
      });

      it('says nothing when the command succeeds', () => {
        const { run } = session('datacenter', language);
        for (const line of ['ls', 'pwd', 'cat notes_awa.txt', 'echo Permission denied', 'echo "No such file or directory"', 'cd /etc', 'ls -l']) expect(run(line), line).toBe(null);
      });

      it("doesn't take a file's content for the command's error", () => {
        const { sh, run } = session('datacenter', language);
        sh.execute('echo "sshd: Connection refused; cat: x: No such file or directory; error: Permission denied" > errors.log');
        expect(run('cat errors.log')).toBe(null);
        expect(run('grep refused errors.log')).toBe(null);
        // A missing file next to it: the explanation is for that error, read alone.
        expect(run('cat errors.log nothing-here')).toBe('no-such-file');
        // grep finding nothing fails (exit code 1), but prints no error.
        expect(run('grep absent errors.log')).toBe(null);
      });

      it('explains nothing for an error sent to /dev/null', () => {
        const { run } = session('eraser', language);
        expect(run('cat nothing-here 2>/dev/null')).toBe(null);
      });
    });

  it('the output alone, in each language', () => {
    const en = translator('en');
    const fr = translator('fr');
    const failed = (output: string) => ({ failed: true, output });
    expect(explain(failed('ssh: connect to host 192.0.2.10 port 22: Connection refused'), en)).toBe('refused');
    expect(explain(failed('ssh: connect to host 192.0.2.10 port 22: Connection timed out'), fr)).toBe('timed-out');
    expect(explain(failed("curl: (7) Failed to connect to a.example port 80 after 0 ms: Couldn't connect to server"), en)).toBe('refused');
    expect(explain(failed("curl: (7) Failed to connect to a.example port 80 after 3002 ms: Couldn't connect to server"), en)).toBe('timed-out');
    expect(explain(failed('curl: (6) Could not resolve host: shop.example'), fr)).toBe('resolve');
    expect(explain(failed('ssh: connect to host 192.0.2.10 port 22: No route to host'), en)).toBe('no-route');
    expect(explain(failed('2026/01/01 [emerg] 2411#2411: bind() to 0.0.0.0:80 failed (98: Address already in use)\nnginx: configuration file /etc/nginx/nginx.conf test failed'), en)).toBe('config-test');
    expect(explain(failed('nginx: [emerg] bind() to 0.0.0.0:80 failed (98: Address already in use)'), en)).toBe('config-test');
    expect(explain(failed('Error: listen tcp :9090: bind: address already in use\nlisten: Address already in use'), en)).toBe('address-in-use');
    expect(explain(failed('Job for nginx.service failed because the control process exited with error code.'), fr)).toBe('unit-failed');
    expect(explain(failed('theo@192.0.2.20: Permission denied (publickey).'), en)).toBe('ssh-denied');
    expect(explain(failed('ERROR! Syntax Error while loading YAML.\n  mapping values are not allowed in this context'), en)).toBe('yaml');
    expect(explain(failed('cp: error writing: Read-only file system'), en)).toBe('read-only');
    expect(explain(failed('cp : erreur d\u2019écriture : Aucun espace disponible sur le périphérique'), fr)).toBe('no-space');
    expect(explain(failed('Get-Content : Access to the path \'D:\\Logs\' is denied.'), en)).toBe('access-denied');
    expect(explain(failed('Sorry, user mei is not allowed to execute \'/usr/bin/apt\' as root on kneader.'), en)).toBe('sudoers');
    expect(explain(failed('sh: 1: systemctl: not found'), en)).toBe('not-found');
    // French messages are read with the French interface, English ones always.
    expect(explain(failed('touch : impossible de créer \u2018x\u2019 : Permission non accordée'), fr)).toBe('permission');
    expect(explain(failed('touch: cannot touch: Permission denied'), fr)).toBe('permission');
    // A CR LF script has its own story: left alone.
    expect(explain(failed('-bash: ./deploy.sh: /bin/bash^M: bad interpreter: No such file or directory'), en)).toBe(null);
    // Not failed: nothing, whatever the text.
    expect(explain({ failed: false, output: 'Permission denied' }, en)).toBe(null);
    // An error nobody explains.
    expect(explain(failed("ls: invalid option -- 'z'\nTry 'ls --help' for more information."), en)).toBe(null);
  });
});
