// The Mapping Party: DNS as code with OpenTofu (tofu, on the game's BIND).
// Each chapter is replayed to the end from the workstation (ssh cairn),
// with another solution and false leads, in each language; the expected
// texts are checked in French. Also: the engine (HCL, fmt, the state, the
// diagnostics' box) and the error explainer on its errors.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { translator } from '../src/texts';
import { machinesInLanguage, languagesFor } from './names';
import { name } from '../src/engine/world';
import { explain } from '../src/engine/explainer';
import { format, parse } from '../src/engine/hcl';
import { readState, renderDiagnostic, stateText, suggest, wrap } from '../src/engine/tofu';
import { FEMI_PID } from '../src/engine/chapters/mapping-party';

const PASSWORD = 'step-free-32';
const TILES_FIX = (x: string) => x.replace('adresses', 'addresses');
const WWW_41 = (x: string) => x.replace('addresses = ["198.51.100.40"]', 'addresses = ["198.51.100.41"]');
const STATUS_BLOCK = `

resource "dns_a_record_set" "status" {
  zone      = var.zone
  name      = "status"
  addresses = ["198.51.100.42"]
  ttl       = 300
}`;

describe('The Mapping Party: the engine', () => {
  it('reads and formats HCL like OpenTofu', () => {
    const src = 'resource "a" "b" {\nzone = var.zone\n    name = "x"\n  addresses = [ "1" , "2" ]\n  ttl= 300\n}\n';
    expect(format(src)).toBe('resource "a" "b" {\n  zone      = var.zone\n  name      = "x"\n  addresses = ["1", "2"]\n  ttl       = 300\n}\n');
    expect(format(format(src))).toBe(format(src));
    // A multi-line value ends the alignment group, like hclwrite.
    expect(format('x {\n  a = [\n    "1",\n  ]\n  bbb = 2\n}')).toBe('x {\n  a = [\n    "1",\n  ]\n  bbb = 2\n}');
    expect(parse('resource "a" "b" {\n  x = 1\n', 'm.tf').diagnostics[0].summary).toBe('Unclosed configuration block');
    expect(parse('x = \n', 'm.tf').diagnostics[0].summary).toBe('Invalid expression');
    expect(parse('foo\n', 'm.tf').diagnostics[0].detail).toContain('use the equals sign "=" to introduce the argument value');
  });

  it('boxes its diagnostics and keeps its state format', () => {
    const box = renderDiagnostic({ severity: 'error', summary: 'Unsupported argument', detail: 'An argument named "adresses" is not expected here. Did you mean "addresses"?', subject: { file: 'r.tf', start: { line: 2, col: 3, offset: 0 }, end: { line: 2, col: 11, offset: 0 } }, context: 'resource "x" "y"' }, { 'r.tf': 'a\n  adresses = []' });
    expect(box.split('\n')).toEqual([
      '╷',
      '│ Error: Unsupported argument',
      '│',
      '│   on r.tf line 2, in resource "x" "y":',
      '│    2:   adresses = []',
      '│',
      '│ An argument named "adresses" is not expected here. Did you mean',
      '│ "addresses"?',
      '╵',
    ]);
    expect(wrap('aaa bbb ccc', 7)).toBe('aaa bbb\nccc');
    expect(suggest('adresses', ['addresses', 'zone'])).toBe('addresses');
    expect(suggest('xyz', ['addresses'])).toBe('');
    const s = { serial: 3, lineage: 'l', outputs: {}, resources: [{ type: 'dns_a_record_set', name: 'w', attributes: { id: 'w.z.', addresses: ['1'] } }] };
    expect(readState(stateText(s)).state).toEqual(s);
    expect(readState('{"version": 4,').error).toMatch(/^Unsupported state file format: The state file could not be parsed as JSON: syntax error at byte offset \d+\.$/);
  });

  it('explains its errors', () => {
    const t = translator('en');
    const e = (errors: string[]) => explain({ failed: true, output: '', errors }, t);
    expect(e(['╷\n│ Error: Error acquiring the state lock\n│'])).toBe('tofu-lock');
    expect(e(['│ Error: Inconsistent dependency lock file'])).toBe('tofu-init');
    expect(e(['│ Error: No value for required variable'])).toBe('tofu-variable');
    expect(e(['│ Error: Unsupported argument'])).toBe('tofu-argument');
  });
});

for (const language of languagesFor('mapping-party'))
  describe(`The Mapping Party — ${language}`, () => {
    const fr = language === 'fr';
    const t = translator(language);
    const L = (line: string) => machinesInLanguage(t, line);
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);

    function play(finished: string[]) {
      const c = new Console({ language, finished: [...STORIES[0].chapters.map((x) => x.id), ...prerequisites('mapping-party'), ...finished] });
      const sh = () => c.remote?.shell ?? c.shell;
      const one = (l: string) => {
        const o = c.execute(L(l));
        let out = typeof o === 'string' ? o : '';
        if (sh().waiting) {
          const p = c.execute(machinesInLanguage(t, PASSWORD));
          out += '\n' + (typeof p === 'string' ? p : '');
        }
        if (c.shell.question && /continue connecting/.test(c.shell.question.prompt)) {
          const p = c.execute('yes');
          out += '\n' + (typeof p === 'string' ? p : '');
        }
        return out + '\n' + (sh().last?.errors ?? []).join('\n');
      };
      const log: string[] = [];
      const run = (...lines: string[]) => {
        const out = lines.map(one).join('\n');
        log.push(out);
        return out;
      };
      const edit = (command: string, change: (text: string) => string) => {
        const before = one(command);
        c.shell.saveEdition(change(c.shell.edition!.text));
        const out = `${before}\n${c.shell.quitEdition() ?? ''}`;
        log.push(out);
        return out;
      };
      run('ssh cairn');
      return { c, run, edit, everything: () => log.join('\n'), finished: () => c.remote!.shell.finished, state: () => c.remote!.shell.state };
    }

    // ——— Chapter 1: The First Plan ———

    it('chapter 1 — solution: init, fmt, validate, the variable, plan, apply, dig', () => {
      const { run, edit, finished, everything } = play([]);
      let all = run(`cat ~/${name(t, 'message_from_andile.txt')}`, 'cd /srv/dns', 'tofu plan');
      expect(all).toContain('Error: Inconsistent dependency lock file');
      contains(all, "n'a jamais été initialisée");
      all = run('tofu init');
      expect(all).toContain('- Installed hashicorp/dns v3.6.2 (unauthenticated)');
      expect(all).toContain('OpenTofu has been successfully initialized!');
      all = run('tofu fmt');
      expect(all).toMatch(/^records\.tf$/m);
      all = run('tofu validate');
      expect(all).toContain('│ An argument named "adresses" is not expected here. Did you mean');
      expect(all).toContain('│   on records.tf line 15, in resource "dns_a_record_set" "tiles":');
      edit('nano records.tf', TILES_FIX);
      all = run('tofu validate', 'tofu plan');
      expect(all).toContain('Success! The configuration is valid.');
      expect(all).toContain('The root module input variable "tiles_address" is not set');
      edit('nano terraform.tfvars', (x) => `${x}\ntiles_address = "192.0.2.180"`);
      all = run('tofu fmt', 'tofu plan');
      expect(all).toContain('dns_a_record_set.www: Refreshing state... [id=www.wayfinders.example.]');
      expect(all).toContain('  # dns_a_record_set.tiles will be created');
      expect(all).toContain('      + addresses = [\n          + "192.0.2.180",\n        ]');
      expect(all).toContain('      + id        = (known after apply)');
      expect(all).toContain('Plan: 1 to add, 0 to change, 0 to destroy.');
      all = run('tofu apply', 'yes');
      expect(all).toContain('dns_a_record_set.tiles: Creation complete after 0s [id=tiles.wayfinders.example.]');
      expect(all).toContain('Apply complete! Resources: 1 added, 0 changed, 0 destroyed.');
      expect(finished()).toBe(false);
      all = run('dig tiles.wayfinders.example +short');
      expect(all).toContain('192.0.2.180');
      expect(finished()).toBe(true);
      contains(everything(), 'Tu as terminé Le Premier Plan.');
    });

    it('chapter 1 — another solution: tofu fmt after the fix, -var-file, then the value kept; apply -auto-approve; host', () => {
      const { run, edit, finished } = play([]);
      run('cd /srv/dns', 'tofu init');
      edit('nano records.tf', TILES_FIX);
      run('tofu fmt');
      let all = run(`tofu apply -auto-approve -var tiles_address=192.0.2.180`);
      expect(all).toContain('Apply complete! Resources: 1 added, 0 changed, 0 destroyed.');
      contains(all, 'seulement dans ta ligne de commande');
      run('host tiles.wayfinders.example 127.0.0.1');
      expect(finished()).toBe(false);
      edit('nano terraform.tfvars', (x) => `${x}\ntiles_address = "192.0.2.180"`);
      all = run('tofu fmt', 'tofu plan');
      expect(all).toContain('No changes. Your infrastructure matches the configuration.');
      expect(finished()).toBe(true);
    });

    it('chapter 1 — false leads: the zone edited by hand, rndc reload refused, the state deleted', () => {
      const { run, edit, finished } = play([]);
      let all = edit('sudo nano /var/lib/bind/db.wayfinders.example', (x) => `${x}\ntiles IN A 192.0.2.180`);
      contains(all, 'Le fichier de zone a été modifié à la main');
      all = run('sudo rndc reload wayfinders.example');
      expect(all).toContain("rndc: 'reload' failed: dynamic zone");
      all = run('dig tiles.wayfinders.example +short');
      expect(all).not.toContain('192.0.2.180');
      all = run('cd /srv/dns', 'rm terraform.tfstate');
      contains(all, 'terraform.tfstate a disparu');
      run('cp terraform.tfstate.backup terraform.tfstate', 'tofu init');
      edit('nano records.tf', TILES_FIX);
      all = run('tofu fmt', 'tofu plan');
      expect(all).toContain('No value for required variable');
      expect(finished()).toBe(false);
    });

    // ——— Chapter 2: Drift ———

    it('chapter 2 — solution: the lock, the drift, the code follows, import, No changes', () => {
      const { run, edit, finished, everything, state } = play(['first-plan']);
      let all = run(`cat ~/${name(t, 'message_from_femi.txt')}`, 'cd /srv/dns', 'tofu plan');
      expect(all).toContain('Error: Error acquiring the state lock');
      expect(all).toMatch(/│   Who: {7}femi@\S+/);
      expect(all).toContain('│   Operation: OperationTypeApply');
      contains(all, 'tient le verrou');
      all = run('ps aux');
      expect(all).toMatch(new RegExp(`^femi +${FEMI_PID} .*tofu apply$`, 'm'));
      all = run(`kill ${FEMI_PID}`);
      expect(all).toContain(`(${FEMI_PID})`);
      all = run(`sudo kill ${FEMI_PID}`);
      expect((state().process as { pid: number }[]).some((p) => p.pid === FEMI_PID)).toBe(false);
      contains(all, 'libéré le verrou');
      all = run('ls -a', 'tofu plan');
      expect(all).not.toContain('.terraform.tfstate.lock.info');
      expect(all).toContain('Note: Objects have changed outside of OpenTofu');
      expect(all).toContain('  # dns_a_record_set.www has changed');
      expect(all).toContain('  # dns_a_record_set.www must be replaced');
      expect(all).toContain('      ~ ttl       = 60 -> 300 # forces replacement');
      expect(all).toContain('Plan: 1 to add, 0 to change, 1 to destroy.');
      contains(all, "l'hôte mort");
      all = edit('nano records.tf', (x) => WWW_41(x).replace('  ttl       = 300\n}\n\nresource "dns_cname_record"', '  ttl       = 60\n}\n\nresource "dns_cname_record"'));
      contains(all, 'dit maintenant ce qui est vrai');
      all = run('tofu plan');
      expect(all).toContain('No changes. Your infrastructure matches the configuration.');
      all = run('tofu apply');
      expect(all).toContain('Apply complete! Resources: 0 added, 0 changed, 0 destroyed.');
      edit('nano records.tf', (x) => x + STATUS_BLOCK);
      all = run('tofu import dns_a_record_set.status status.wayfinders.example.');
      expect(all).toContain('dns_a_record_set.status: Import prepared!');
      expect(all).toContain('Import successful!');
      expect(finished()).toBe(false);
      all = run('tofu plan');
      expect(all).toContain('No changes. Your infrastructure matches the configuration.');
      expect(finished()).toBe(true);
      contains(everything(), 'Tu as terminé Dérive.');
    });

    it('chapter 2 — another solution: TTL back to 300 (a replacement), an import block, dig', () => {
      const { run, edit, finished } = play(['first-plan']);
      run('cd /srv/dns', `sudo kill -INT ${FEMI_PID}`);
      edit('nano records.tf', (x) => WWW_41(x) + STATUS_BLOCK + '\n\nimport {\n  to = dns_a_record_set.status\n  id = "status.wayfinders.example."\n}');
      let all = run('tofu plan');
      expect(all).toContain('  # dns_a_record_set.status will be imported');
      expect(all).toContain('Plan: 1 to import, 1 to add, 0 to change, 1 to destroy.');
      all = run('tofu apply', 'yes');
      expect(all).toContain('dns_a_record_set.www: Destruction complete after 0s');
      expect(all).toContain('Apply complete! Resources: 1 imported, 1 added, 0 changed, 1 destroyed.');
      all = run('dig www.wayfinders.example +noall +answer');
      expect(all).toMatch(/www\.wayfinders\.example\.\s+300\s+IN\s+A\s+198\.51\.100\.41/);
      expect(finished()).toBe(false);
      run('tofu plan -detailed-exitcode');
      expect(finished()).toBe(true);
    });

    it('chapter 2 — false leads: force-unlock, -lock=false, the old code applied, the state edited, state rm', () => {
      const { run, edit, finished } = play(['first-plan']);
      let all = run('cd /srv/dns', 'tofu force-unlock 1234');
      expect(all).toContain('Local state cannot be unlocked by another process.');
      contains(all, 'ne peut rien');
      all = run('tofu apply -lock=false -auto-approve');
      contains(all, '-lock=false');
      contains(all, "l'hôte qui est tombé");
      all = run('dig www.wayfinders.example +short');
      expect(all).toContain('198.51.100.40');
      run(`sudo kill ${FEMI_PID}`);
      all = edit('nano terraform.tfstate', (x) => x.replace('"serial": ', '"serial": 1'));
      contains(all, 'modifié à la main');
      all = run('cp terraform.tfstate.backup terraform.tfstate', 'tofu state rm dns_cname_record.wiki');
      expect(all).toContain('Removed dns_cname_record.wiki');
      expect(all).toContain('Successfully removed 1 resource instance(s).');
      contains(all, 'pas le DNS');
      all = run('tofu import dns_cname_record.wiki wiki.wayfinders.example.');
      expect(all).toContain('Import successful!');
      edit('nano records.tf', WWW_41);
      run('tofu apply -auto-approve');
      expect(finished()).toBe(false);
    });
  });
