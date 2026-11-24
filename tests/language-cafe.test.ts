// The Language Café: a Debian sysadmin on Rocky Linux 10 (dnf, firewalld),
// then SELinux (file labels, a port type, a boolean). Each chapter is
// replayed from the workstation (ssh kettle), with another solution and the
// false leads, in each language; the expected texts are checked in French.
// Also: firewalld's rich rules.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { translator } from '../src/texts';
import { inLanguage, machinesInLanguage, languagesFor } from './names';
import { parseRich, richText } from '../src/engine/firewalld';
import { machineName } from '../src/engine/machines';

const BEFORE = [...new Set([...STORIES.find((h) => h.id === 'eraser')!.chapters.map((c) => c.id), ...prerequisites('language-cafe')])];
const PASSWORD = 'samovar-24';
const RICH = `'rule family="ipv4" source address="198.51.100.0/24" port port="8010" protocol="tcp" accept'`;

describe('The Language Café: the engine', () => {
  it('reads and writes back firewalld rich rules', () => {
    expect(richText(parseRich('rule family=ipv4 source address=198.51.100.0/24 port port=8010 protocol=tcp accept'))).toBe('rule family="ipv4" source address="198.51.100.0/24" port port="8010" protocol="tcp" accept');
    expect(() => parseRich('rule port port="8010" protocol="tcp"')).toThrow('INVALID_RULE: no action, no log, no audit');
    expect(() => parseRich('rule source address="198.51.100.0/24" accept')).toThrow('INVALID_FAMILY');
  });
});

for (const language of languagesFor('language-cafe'))
  describe(`The Language Café — ${language}`, () => {
    const fr = language === 'fr';
    const t = translator(language);
    const L = (line: string) => inLanguage(t, machinesInLanguage(t, line));
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);
    const board = machineName(t, 'noticeboard');

    const part = (finished: string[] = []) => {
      const c = new Console({ language, finished: [...BEFORE, ...finished] });
      const one = (l: string) => {
        let output = c.execute(L(l)) ?? '';
        if (c.shell.waiting) output += '\n' + (c.execute(PASSWORD) ?? '');
        return output;
      };
      const play = (lines: string[]) => lines.map(one).join('\n');
      play(['ssh kettle', 'yes']);
      const main = () => ((c.shell as unknown as { principal: typeof c.shell }).principal ?? c.shell);
      return { c, play, flag: (id: string) => main().flags.has(id), done: (id: string) => c.finished.includes(id) };
    };

    // ——— Chapter 1: New Neighbour ———

    it('chapter 1 — solution: dnf, systemctl enable --now, http and https at runtime and permanently', () => {
      const { play, flag, done } = part();
      let all = play(['apt install apache2']);
      expect(all).toContain('-bash: apt: command not found');
      contains(all, "n'est pas une Debian");
      all = play(['cat /etc/os-release', 'dnf search httpd', 'sudo dnf install httpd']);
      expect(all).toContain('Installing dependencies:');
      all = play(['y']);
      expect(all).toContain('Complete!');
      expect(flag('installed')).toBe(true);
      all = play(['sudo systemctl enable --now httpd', 'curl -I http://localhost/']);
      expect(all).toContain('HTTP/1.1 403 Forbidden');
      all = play([`ssh ${board}`, 'yes', 'curl -I http://www.commontongue.example/', 'exit']);
      expect(all).toContain("Couldn't connect to server");
      expect(flag('blocked')).toBe(true);
      all = play(['sudo firewall-cmd --add-service=http --add-service=https']);
      expect(all).toContain('success');
      contains(all, 'prochain');
      expect(done('new-neighbour')).toBe(false);
      all = play(['sudo firewall-cmd --permanent --add-service=http --add-service=https']);
      contains(all, 'Vous avez terminé Nouveau voisin');
      expect(done('new-neighbour')).toBe(true);
      expect(play(['rpm -q httpd'])).toContain('httpd-2.4.63-13.el10_2.8.x86_64');
    });

    it('chapter 1 — another solution: permanent rules then a reload; and the false leads', () => {
      const { play, flag, done } = part();
      play(['sudo dnf install -y httpd', 'sudo systemctl start httpd']);
      expect(flag('not-enabled')).toBe(true);
      play(['sudo firewall-cmd --add-service=http', 'sudo firewall-cmd --reload']);
      expect(flag('lost')).toBe(true);
      expect(play(['sudo firewall-cmd --permanent --add-port=80/tcp', 'sudo firewall-cmd --permanent --add-service=https'])).toContain('success');
      expect(flag('permanent-only')).toBe(true);
      play(['sudo setenforce 0']);
      expect(flag('selinux-off')).toBe(true);
      play(['sudo firewall-cmd --reload', 'sudo systemctl enable httpd']);
      expect(done('new-neighbour')).toBe(false);
      play(['sudo setenforce 1']);
      expect(done('new-neighbour')).toBe(true);
      expect(play(['firewall-cmd --add-service=ssh'])).toContain('Authorization failed.');
    });

    // ——— Chapter 2: Permission Denied, But… ———

    it('chapter 2 — solution: the labels, the audit log, semanage fcontext and restorecon', () => {
      const { play, flag, done } = part(['new-neighbour']);
      let all = play(['curl http://localhost/']);
      expect(all).toContain('HTTP Server Test Page');
      all = play(['sudo tail -3 /var/log/httpd/error_log', 'ls -lZ /srv/site']);
      expect(all).toContain('AH00132: file permissions deny server access: /srv/site/index.html');
      expect(all).toMatch(/-rw-r--r--\. 1 itzel itzel unconfined_u:object_r:user_home_t:s0/);
      expect(flag('labels')).toBe(true);
      all = play(['sudo ausearch -m avc -ts recent', 'audit2why']);
      expect(all).toContain('avc:  denied  { read }');
      expect(all).toContain('-bash: audit2why: command not found');
      all = play(['dnf provides semanage', 'sudo dnf install -y policycoreutils-python-utils', 'sudo ausearch -m avc -ts recent | audit2why']);
      expect(all).toContain('policycoreutils-python-utils-3.11-1.el10.noarch');
      expect(all).toContain('The boolean httpd_read_user_content was set incorrectly.');
      all = play(['sudo restorecon -Rv /srv/site']);
      expect(all).toContain('to unconfined_u:object_r:var_t:s0');
      expect(flag('var-t')).toBe(true);
      play(['sudo semanage fcontext -a -t httpd_sys_content_t "/srv/site(/.*)?"']);
      expect(flag('rule')).toBe(true);
      all = play(['sudo restorecon -Rv /srv/site']);
      contains(all, 'Vous avez terminé Permission refusée');
      expect(done('wrong-label')).toBe(true);
      expect(play(['curl -s http://localhost/'])).toContain('common-tongue-site');
    });

    it('chapter 2 — another solution: an equivalence with /var/www', () => {
      const { play, done } = part(['new-neighbour']);
      play(['sudo dnf install -y policycoreutils-python-utils', 'sudo semanage fcontext -a -e /var/www /srv/site', 'sudo restorecon -R /srv/site']);
      expect(done('wrong-label')).toBe(true);
      expect(play(['sudo semanage fcontext -l -C'])).toContain('/srv/site = /var/www');
    });

    it('chapter 2 — false leads: setenforce 0, chmod 777, a home boolean, chcon lost at the relabel', () => {
      const { play, flag, done } = part(['new-neighbour']);
      play(['sudo setenforce 0']);
      expect(flag('permissive')).toBe(true);
      expect(done('wrong-label')).toBe(false);
      play(['sudo setenforce 1', 'sudo chmod 777 /srv/site/index.html']);
      expect(flag('chmod')).toBe(true);
      play(['sudo chmod 644 /srv/site/index.html', 'sudo setsebool httpd_read_user_content on']);
      expect(flag('home-boolean')).toBe(true);
      expect(done('wrong-label')).toBe(false);
      play(['sudo setsebool httpd_read_user_content off']);
      const all = play(['sudo chcon -R -t httpd_sys_content_t /srv/site']);
      expect(flag('relabelled')).toBe(true);
      contains(all, 'réétiqueté');
      expect(done('wrong-label')).toBe(false);
      expect(play(['ls -Z /srv/site/index.html'])).toContain(':var_t:');
      play(['sudo dnf install -y policycoreutils-python-utils', 'sudo semanage fcontext -a -t httpd_sys_content_t "/srv/site(/.*)?"', 'sudo restorecon -Rv /srv/site']);
      expect(done('wrong-label')).toBe(true);
    });

    it('chapter 2 — false lead: an audit2allow module', () => {
      const { play, flag, done } = part(['new-neighbour']);
      play(['sudo dnf install -y policycoreutils-python-utils']);
      const all = play(['sudo ausearch -m avc | audit2allow -M sitefix', 'sudo semodule -i sitefix.pp']);
      expect(all).toContain('semodule -i sitefix.pp');
      expect(flag('module')).toBe(true);
      play(['sudo semanage fcontext -a -t httpd_sys_content_t "/srv/site(/.*)?"', 'sudo restorecon -R /srv/site']);
      expect(done('wrong-label')).toBe(false);
      expect(play(['sudo semodule -r sitefix'])).toContain('Removing last sitefix module');
      expect(done('wrong-label')).toBe(true);
    });

    // ——— Chapter 3: A Port and a Boolean ———

    it('chapter 3 — solution: semanage port, setsebool -P, a rich rule', () => {
      const { play, flag, done } = part(['new-neighbour', 'wrong-label']);
      let all = play(['systemctl status httpd']);
      expect(all).toContain('could not bind to address [::]:8010');
      all = play(['sudo ausearch -m avc -c httpd']);
      expect(all).toContain('{ name_bind }');
      play(['sudo semanage port -a -t http_port_t -p tcp 8010', 'sudo systemctl restart httpd']);
      expect(flag('up')).toBe(true);
      all = play(['curl -I -H "Host: signup.commontongue.example" http://localhost/']);
      expect(all).toContain('503 Service Unavailable');
      all = play(['sudo ausearch -m avc -ts recent | audit2why']);
      expect(all).toContain('# setsebool -P httpd_can_network_connect 1');
      expect(all).toContain('# setsebool -P nis_enabled 1');
      play(['sudo setsebool -P httpd_can_network_connect on']);
      expect(play(['curl -s -H "Host: signup.commontongue.example" http://localhost/'])).toContain('common-tongue-signup');
      play([`sudo firewall-cmd --add-rich-rule=${RICH}`]);
      expect(done('port-and-boolean')).toBe(false);
      all = play(['sudo firewall-cmd --runtime-to-permanent']);
      contains(all, 'Vous avez terminé Un port et un booléen');
      expect(done('port-and-boolean')).toBe(true);
      const rota = play([`ssh ${board}`, 'yes', `curl -s http://${machineName(t, 'kettle')}:8010/`]);
      expect(rota, rota).toContain('common-tongue-rota');
    });

    it('chapter 3 — false leads: nis_enabled, 8086 typed, a boolean without -P, 8010 open to all', () => {
      const { play, flag, done } = part(['new-neighbour', 'wrong-label']);
      play(['sudo setsebool -P nis_enabled on', 'sudo systemctl restart httpd']);
      expect(flag('nis')).toBe(true);
      expect(flag('up')).toBe(true);
      play(['sudo setsebool -P nis_enabled off', 'sudo semanage port -a -t http_port_t -p tcp 8086']);
      expect(flag('label-8086')).toBe(true);
      play(['sudo semanage port -d -p tcp 8086', 'sudo semanage port -a -t http_port_t -p tcp 8010', 'sudo setsebool httpd_can_network_connect on']);
      expect(flag('boolean-runtime')).toBe(true);
      play(['sudo firewall-cmd --add-port=8010/tcp', 'sudo firewall-cmd --permanent --add-port=8010/tcp']);
      expect(flag('open-to-all')).toBe(true);
      expect(done('port-and-boolean')).toBe(false);
      play(['sudo firewall-cmd --permanent --remove-port=8010/tcp', `sudo firewall-cmd --permanent --add-rich-rule=${RICH}`, 'sudo firewall-cmd --reload']);
      expect(done('port-and-boolean')).toBe(false);
      play(['sudo setsebool -P httpd_can_network_connect on']);
      expect(done('port-and-boolean')).toBe(true);
    });
  });
