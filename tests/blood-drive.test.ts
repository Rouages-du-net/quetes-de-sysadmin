// The Blood Drive: two load balancers with keepalived (VRRP) and HAProxy.
// Each chapter is replayed to the end from the workstation (ssh lb1), with
// another solution and false leads, in each language; the expected texts
// are checked in French. Also: keepalived.conf and haproxy.cfg read like the
// real tools, and nftables knowing VRRP.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { translator } from '../src/texts';
import { inLanguage, machinesInLanguage, languagesFor } from './names';
import { parseKeepalived } from '../src/engine/keepalived';
import { checkReport, parseCfg } from '../src/engine/haproxy';
import { haproxyCfg, keepalivedConf } from '../src/engine/chapters/blood-drive';
import { runNft, traverse } from '../src/engine/nftables';
import { Shell } from '../src/engine/shell';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
const PASSWORD = 'donor-chair-12';
const KA = '/etc/keepalived/keepalived.conf';
const CFG = '/etc/haproxy/haproxy.cfg';

/** keepalived.conf with a vrrp_script checking haproxy, tracked by the instance. */
const tracked = (weight = -20, extra = '') => (t: string) =>
  t
    .replace('vrrp_instance VI_1 {', `vrrp_script chk_haproxy {\n    script "/usr/bin/killall -0 haproxy"\n    interval 2\n    weight ${weight}\n    fall 2\n    rise 2\n}\n\nvrrp_instance VI_1 {${extra}`)
    .replace(/(virtual_ipaddress \{\n\s+\S+\n\s+\})/, '$1\n    track_script {\n        chk_haproxy\n    }');
const httpchk = (t: string) =>
  t.replace('\tbalance roundrobin', '\tbalance roundrobin\n\toption httpchk GET /health\n\thttp-check expect status 200').replace(/(server web\d \S+:8080)$/gm, '$1 check inter 2s fall 3 rise 2');

describe('keepalived and HAProxy: their files read like the real tools', () => {
  it('reads keepalived.conf: blocks, scripts, instances, errors with line numbers', () => {
    const c = parseKeepalived(tracked()(keepalivedConf('lb1', 1)));
    expect(c.instances[0]).toMatchObject({ name: 'VI_1', state: 'MASTER', iface: 'eth0', vrid: 51, priority: 101, vips: ['192.0.2.108/24'], track: [{ name: 'chk_haproxy' }] });
    expect(c.scripts.chk_haproxy).toMatchObject({ script: '/usr/bin/killall -0 haproxy', interval: 2, weight: -20, fall: 2, rise: 2 });
    expect(c.errors).toEqual([]);
    const bad = parseKeepalived(keepalivedConf('lb1', 1).replace('priority 101', 'priorty 101').replace('virtual_router_id 51', 'virtual_router_id 300') + '\nvrrp_instance VI_2 {\n    interface eth0\n    virtual_router_id 52\n    track_script {\n        chk_none\n    }\n}');
    expect(bad.errors).toContain("(Line 12) Unknown keyword 'priorty'");
    expect(bad.errors.some((e) => e.includes("VRID '300' not valid - must be between 1 & 255"))).toBe(true);
    expect(bad.errors.some((e) => /^\(Line \d+\) \(VI_2\) track script chk_none not found, ignoring...$/.test(e))).toBe(true);
    const nopreempt = parseKeepalived(keepalivedConf('lb1', 1).replace('advert_int 1', 'advert_int 1\n    nopreempt'));
    expect(nopreempt.warnings).toEqual(['(VI_1) Warning - nopreempt will not work with initial state MASTER - clearing']);
    expect(nopreempt.instances[0].nopreempt).toBe(false);
  });

  it('checks haproxy.cfg like haproxy -c: valid, unknown keywords with a suggestion, a missing backend', () => {
    expect(checkReport(parseCfg(haproxyCfg(3)), 4242).lines).toEqual(['Configuration file is valid']);
    const typo = checkReport(parseCfg(haproxyCfg(3).replace('server web2 198.51.100.22:8080 check', 'server web2 198.51.100.22:8080 chek')), 4242);
    expect(typo.ok).toBe(false);
    expect(typo.lines[0]).toMatch(/^\[ALERT\] +\(4242\) : config : parsing \[\/etc\/haproxy\/haproxy\.cfg:\d+\] : 'server web2' unknown keyword 'chek'\. Did you mean 'check' maybe \?$/);
    expect(typo.lines.at(-1)).toBe('[ALERT]    (4242) : config : Fatal errors found in configuration.');
    const missing = checkReport(parseCfg(haproxyCfg(1).replace('default_backend be_booking', 'default_backend be_bookin')), 7);
    expect(missing.lines).toContain("[ALERT]    (7) : config : Proxy 'fe_booking': unable to find required default_backend: 'be_bookin'.");
    const orphan = parseCfg(haproxyCfg(1).replace('\tbalance roundrobin', '\tbalance roundrobin\n\thttp-check expect status 200'));
    expect(orphan.warnings[0]).toBe("config : backend 'be_booking' uses http-check rules without 'option httpchk', so the rules are ignored.");
    const cfg = parseCfg(haproxyCfg(3));
    expect(cfg.backends[0]).toMatchObject({ name: 'be_booking', balance: 'roundrobin', httpchk: { method: 'GET', uri: '/health' }, expect: { kind: 'status', value: '200' } });
    expect(cfg.backends[0].servers[1]).toMatchObject({ name: 'web2', addr: '198.51.100.22', port: 8080, check: true, inter: 2000, fall: 3, rise: 2 });
  });

  it('lets nftables match VRRP by name or number', () => {
    const s = new Shell(chapter('split-brain'), 'en');
    const { ruleset } = runNft(s, 'add table inet filter\nadd chain inet filter input { type filter hook input priority 0; policy drop; }\nadd rule inet filter input ip protocol 112 accept', { tables: [] });
    const p = { iif: 'eth0', oif: '', saddr: '192.0.2.104', daddr: '224.0.0.18', proto: 'vrrp' as const, sport: 0, dport: 0, ct: 'new' as const, size: 60 };
    expect(traverse(ruleset, 'input', 'filter', p).pass).toBe(true);
    expect(traverse(ruleset, 'input', 'filter', { ...p, proto: 'tcp', dport: 25 }).pass).toBe(false);
  });
});

for (const language of languagesFor('blood-drive'))
  describe(`The Blood Drive — ${language}`, () => {
    const fr = language === 'fr';
    const t = translator(language);
    const L = (line: string) => inLanguage(t, machinesInLanguage(t, line));
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);

    function play(finished: string[]) {
      const c = new Console({ language, finished: [...STORIES[0].chapters.map((x) => x.id), ...prerequisites('blood-drive'), ...finished] });
      const one = (l: string) => {
        const o = c.execute(L(l));
        let out = typeof o === 'string' ? o : '';
        if (c.shell.waiting) {
          const p = c.execute(machinesInLanguage(t, PASSWORD));
          out += '\n' + (typeof p === 'string' ? p : '');
        }
        if (c.shell.question) {
          const p = c.execute('yes');
          out += '\n' + (typeof p === 'string' ? p : '');
        }
        return out;
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
      run('ssh lb1');
      return { c, run, edit, everything: () => log.join('\n'), finished: () => c.remote!.shell.finished };
    }

    it('chapter 1 — solution: haproxy dead, the address stuck on lb1, a tracked check on both, the failover, haproxy back', () => {
      const { run, edit, finished, everything } = play([]);
      let all = run('cat message_from_zainab.txt', 'cat note_from_bastien.txt', 'systemctl status haproxy');
      expect(all).toContain('Active: failed (Result: exit-code)');
      expect(all).toContain('Start request repeated too quickly');
      contains(all, 'Regardez qui tient 192.0.2.108');
      all = run('ip a', 'curl -s http://donate.lindenvale.example/', 'cat /etc/keepalived/keepalived.conf');
      expect(all).toContain('inet 192.0.2.108/24 brd 192.0.2.255 scope global secondary eth0');
      contains(all, 'keepalived ne surveille que keepalived');
      all = run('ssh lb2', 'ip a', 'systemctl status haproxy', 'exit');
      expect(all).toContain('Active: active (running)');
      expect(all).not.toContain('192.0.2.108/24');
      all = edit(`sudo nano ${KA}`, tracked());
      all += run('sudo keepalived -t', 'sudo systemctl reload keepalived', 'sudo journalctl -u keepalived -n 12');
      expect(all).toContain('VRRP_Script(chk_haproxy) failed (exited with status 1)');
      expect(all).toContain('(VI_1) Changing effective priority from 101 to 81');
      expect(all).toContain('(VI_1) Master received advert from 192.0.2.105 with higher priority 100, ours 81');
      contains(all, "L'adresse a bougé");
      all = run('curl -si http://donate.lindenvale.example/', 'ip a');
      expect(all).toContain('HTTP/1.1 200 OK');
      expect(all).toMatch(/x-served-by: web\d/);
      expect(all).not.toContain('192.0.2.108/24');
      all = run('sudo systemctl restart haproxy', 'sleep 10', 'ip a');
      expect(all).toContain('192.0.2.108/24');
      contains(all, 'lb1 a repris l\'adresse');
      expect(finished()).toBe(false);
      run('ssh lb2');
      all = edit(`sudo nano ${KA}`, tracked());
      all += run('sudo systemctl reload keepalived', 'exit');
      contains(all, 'dans les deux sens');
      // The deliberate test: stop haproxy on the master, the site still answers, then start it again.
      all = run('sudo systemctl stop haproxy', 'sleep 10', 'curl -s -o /dev/null -w "%{http_code}" http://donate.lindenvale.example/', 'sudo systemctl start haproxy', 'sleep 10');
      expect(all).toContain('200');
      expect(finished()).toBe(true);
      contains(everything(), 'Vous avez terminé La Bascule qui n\'a pas eu lieu.');
    });

    it('chapter 1 — false leads: restarting only, both MASTER, nopreempt with a weight; another solution: weight 0 (FAULT)', () => {
      const { run, edit, finished, everything } = play([]);
      let all = run('sudo systemctl restart haproxy');
      contains(all, 'rien n\'a changé dans la conception');
      all = run('sudo systemctl stop haproxy', 'sleep 10', 'curl -s http://donate.lindenvale.example/', 'ip a');
      expect(all).toContain('192.0.2.108/24');
      run('ssh lb2');
      edit(`sudo nano ${KA}`, (x) => x.replace('state BACKUP', 'state MASTER').replace('priority 100', 'priority 101'));
      all = run('sudo keepalived -t');
      contains(all, 'ne fait ni deux maîtres');
      // nopreempt on lb2 with a weighted check on lb1: lb2 never takes the address from a master that still advertises.
      edit(`sudo nano ${KA}`, (x) => tracked(-20)(x.replace('state MASTER', 'state BACKUP').replace('priority 101', 'priority 100').replace('advert_int 1', 'advert_int 1\n    nopreempt')));
      run('sudo systemctl reload keepalived', 'exit');
      edit(`sudo nano ${KA}`, tracked());
      all = run('sudo systemctl reload keepalived', 'sleep 10', 'ip a');
      expect(all).toContain('192.0.2.108/24');
      contains(all, 'Avec nopreempt, un secours ne prend jamais');
      expect(finished()).toBe(false);
      // weight 0: a failed check puts lb1 in FAULT, it stops advertising, lb2 takes over.
      edit(`sudo nano ${KA}`, (x) => x.replace('weight -20', 'weight 0'));
      all = run('sudo systemctl reload keepalived', 'sudo journalctl -u keepalived -n 6', 'ip a');
      expect(all).toContain('(VI_1) Entering FAULT STATE');
      expect(all).not.toContain('192.0.2.108/24');
      all = run('sudo systemctl start haproxy', 'sleep 10', 'ip a');
      contains(all, 'mais l\'adresse reste sur lb2');
      run('ssh lb2');
      edit(`sudo nano ${KA}`, (x) => x.replace('weight -20', 'weight 0'));
      all = run('sudo systemctl reload keepalived', 'sleep 5');
      expect(finished()).toBe(true);
    });

    it('chapter 2 — solution: no check, an HTTP check of /health on both, web2 drained, repaired and put back', () => {
      const { run, edit, finished, everything } = play(['no-failover']);
      let all = run('cat message_from_zainab.txt', 'cat message_from_teodor.txt', 'sudo tail -n 12 /var/log/haproxy.log');
      expect(all).toMatch(/be_booking\/web3 \S+ 500 /);
      contains(all, 'Les erreurs 500 viennent de web3');
      all = run('echo "show stat" | socat stdio /run/haproxy/admin.sock');
      expect(all).toContain('E connect(5, AF=1 "/run/haproxy/admin.sock", 25): Permission denied');
      all = run('echo "show stat" | sudo socat stdio /run/haproxy/admin.sock | cut -d, -f1,2,5,18');
      expect(all).toContain('be_booking,web3,3,no check');
      contains(all, 'HAProxy ne vérifie pas du tout ses serveurs');
      all = edit(`sudo nano ${CFG}`, httpchk);
      all += run('sudo haproxy -c -f /etc/haproxy/haproxy.cfg', 'sudo systemctl reload haproxy', 'echo "show stat" | sudo socat stdio /run/haproxy/admin.sock | cut -d, -f2,18,37');
      expect(all).toContain('Configuration file is valid');
      expect(all).toContain('web3,DOWN,L7STS');
      expect(all).toContain('web1,UP,L7OK');
      all = run('sudo grep "is DOWN" /var/log/haproxy.log');
      expect(all).toContain('Server be_booking/web3 is DOWN, reason: Layer7 wrong status, code: 500, info: "Internal Server Error"');
      run('ssh lb2');
      edit(`sudo nano ${CFG}`, httpchk);
      all = run('sudo systemctl reload haproxy', 'exit');
      contains(all, 'lb2 vérifie de la même façon');
      all = run('echo "set server be_booking/web2 state drain" | sudo socat stdio /run/haproxy/admin.sock', 'echo "show stat" | sudo socat stdio /run/haproxy/admin.sock | grep web2 | cut -d, -f2,5,18');
      expect(all).toMatch(/web2,\d,DRAIN/);
      all = run('sleep 15', 'ssh web2');
      contains(all, 'Le technicien a éteint web2');
      expect(all).toContain('ssh: connect to host web2 port 22: Connection timed out');
      all = run('sleep 60');
      contains(all, 'web2 est revenu');
      expect(finished()).toBe(false);
      all = run('echo "set server be_booking/web2 state ready" | sudo socat stdio /run/haproxy/admin.sock', 'sleep 5');
      expect(finished()).toBe(true);
      contains(everything(), 'Vous avez terminé Le Serveur malade.');
    });

    it('chapter 2 — false leads: a TCP check only, the server line removed, a hard cut; another solution: maint', () => {
      const { run, edit, finished, everything } = play(['no-failover']);
      let all = edit(`sudo nano ${CFG}`, (x) => x.replace(/(server web\d \S+:8080)$/gm, '$1 check'));
      all += run('sudo systemctl reload haproxy', 'echo "show stat" | sudo socat stdio /run/haproxy/admin.sock | cut -d, -f2,18,37');
      expect(all).toContain('web3,UP,L4OK');
      contains(all, 'C\'est l\'application qui est malade, pas son port');
      all = edit(`sudo nano ${CFG}`, (x) => x.replace(/^\tserver web2 .*\n/m, ''));
      contains(all, 'La ligne server de web2 a disparu');
      edit(`sudo nano ${CFG}`, (x) => httpchk(x.replace(/ check/g, '').replace('\tserver web3', '\tserver web2 198.51.100.22:8080\n\tserver web3')));
      run('sudo systemctl reload haproxy');
      // Stopping web2's app while donors are on it cuts their bookings.
      all = run('ssh web2', 'sudo systemctl stop booking', 'exit');
      contains(all, 'leurs réservations se sont interrompues');
      all = run('ssh web2', 'sudo systemctl start booking', 'exit', 'sleep 10');
      // maint (disable server) instead of drain: no traffic and no checks.
      all = run('echo "disable server be_booking/web2" | sudo socat stdio /run/haproxy/admin.sock', 'sleep 20', 'sleep 60');
      contains(all, 'web2 est revenu');
      run('ssh lb2');
      edit(`sudo nano ${CFG}`, httpchk);
      run('sudo systemctl reload haproxy', 'exit');
      all = run('echo "enable server be_booking/web2" | sudo socat stdio /run/haproxy/admin.sock', 'sleep 5');
      expect(finished()).toBe(true);
    });

    it('chapter 3 — solution: two masters, the adverts on the wire, the firewall, persisted, a new VRID on both', () => {
      const { run, edit, finished, everything } = play(['no-failover', 'sick-server']);
      let all = run('cat message_from_kirsi.txt', 'ip -br a', 'sudo journalctl -u keepalived -n 20');
      expect(all).toContain('with lower priority 100, ours 101, forcing new election');
      expect(all).toContain('bogus VRRP packet received on eth0 !!!');
      contains(all, 'Un autre groupe VRRP partage le lien');
      all = run('ssh lb2', 'ip a');
      expect(all).toContain('inet 192.0.2.108/24');
      contains(all, 'deux maîtres');
      all = run('sudo tcpdump -i eth0 -c 6 vrrp');
      expect(all).toMatch(/IP lb1(\.internal)? > vrrp\.mcast\.net: VRRPv2, Advertisement, vrid 51, prio 101, authtype none, intvl 1s, length 20/);
      contains(all, 'tcpdump regarde les paquets avant le pare-feu');
      all = run('sudo nft list ruleset');
      expect(all).toContain('policy drop;');
      all = edit('sudo nano /etc/nftables.conf', (x) => x.replace('\t\tip protocol icmp accept', '\t\tip protocol icmp accept\n\t\tip protocol vrrp accept'));
      all += run('sudo nft -c -f /etc/nftables.conf', 'sudo systemctl restart nftables', 'sleep 5', 'ip a');
      expect(all).not.toContain('192.0.2.108/24');
      contains(all, 'Un seul maître de nouveau');
      contains(all, 'ne ramènera pas le cerveau coupé');
      all = edit(`sudo nano ${KA}`, (x) => x.replace('virtual_router_id 51', 'virtual_router_id 61'));
      all += run('sudo systemctl reload keepalived', 'exit');
      contains(all, 'deux groupes VRRP différents');
      expect(finished()).toBe(false);
      edit(`sudo nano ${KA}`, (x) => x.replace('virtual_router_id 51', 'virtual_router_id 61'));
      all = run('sudo keepalived -t', 'sudo systemctl reload keepalived', 'sleep 10', 'sudo tcpdump -c 4 -n vrrp');
      expect(all).toContain('vrid 61, prio 101');
      expect(finished()).toBe(true);
      contains(everything(), 'Vous avez terminé Le Cerveau coupé en deux.');
    });

    it("chapter 3 — false lead: Kirsi's message gives the symptom, not the causes (lb2's baseline, VRID 51)", () => {
      const { run } = play(['no-failover', 'sick-server']);
      const all = run('cat message_from_kirsi.txt');
      expect(all).toContain('192.0.2.108 moved from');
      expect(all).not.toContain('VRID');
      expect(all).not.toContain('nftables');
      expect(all).not.toContain('lb2');
    });

    it('chapter 3 — false leads: keepalived stopped on lb2, priorities; another solution: nft add rule then the file, unicast_peer', () => {
      const { run, edit, finished, everything } = play(['no-failover', 'sick-server']);
      run('ssh lb2');
      let all = run('sudo systemctl stop keepalived');
      contains(all, 'plus de secours non plus');
      run('sudo systemctl start keepalived');
      edit(`sudo nano ${KA}`, (x) => x.replace('priority 100', 'priority 90'));
      all = run('sudo systemctl reload keepalived', 'sleep 2');
      contains(all, 'Les priorités ne comptent qu\'entre des nœuds qui s\'entendent');
      all = run('sudo nft add rule inet filter input ip saddr 192.0.2.104 ip protocol vrrp accept', 'sleep 5', 'ip -br a');
      expect(all).not.toContain('192.0.2.108/24');
      all = edit('sudo nano /etc/nftables.conf', (x) => x.replace('\t\tip protocol icmp accept', '\t\tip protocol icmp accept\n\t\tip saddr 192.0.2.104 ip protocol 112 accept'));
      // unicast between the two: the routers no longer hear the pair's adverts.
      edit(`sudo nano ${KA}`, (x) => x.replace('advert_int 1', 'advert_int 1\n    unicast_src_ip 192.0.2.105\n    unicast_peer {\n        192.0.2.104\n    }'));
      run('sudo systemctl reload keepalived', 'exit');
      edit(`sudo nano ${KA}`, (x) => x.replace('advert_int 1', 'advert_int 1\n    unicast_src_ip 192.0.2.104\n    unicast_peer {\n        192.0.2.105\n    }'));
      all = run('sudo systemctl reload keepalived', 'sleep 10', 'sudo tcpdump -c 2 -n vrrp');
      expect(all).toContain('IP 192.0.2.104 > 192.0.2.105: VRRPv2, Advertisement, vrid 51, prio 101');
      expect(finished()).toBe(true);
    });
  });
