// The Ferry: the same services over IPv4 and IPv6. SLAAC and a static
// address, the DNS zone's AAAA records and serial; a firewall that only
// covered IPv4 (table ip → table inet, ICMPv6); nginx in IPv6 and a
// proxy_pass to the loopback the app really listens on. Replayed with the
// console, in every language; the expected texts are checked in French.
// Also: the IPv6 helpers, ip -6, ping6, curl -6 -v, nmap -6, nc -6, ss -6,
// nftables families and ufw's IPV6 setting.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { translator } from '../src/texts';
import { inLanguage, machinesInLanguage, languagesFor } from './names';
import { machineName } from '../src/engine/machines';
import { format6, parse6, eui64, linkLocalFor, slaacFor, inPrefix6, normalise6 } from '../src/engine/ipv6';
import { runNft, traverse, type Package } from '../src/engine/nftables';
import { Shell } from '../src/engine/shell';
import { verdict } from '../src/engine/firewall';

const BEFORE = [...new Set([...STORIES.find((h) => h.id === 'eraser')!.chapters.map((c) => c.id), ...prerequisites('ferry')])];
const MDP = 'tide-2029';
const ROUTER = 'fe80::200:5eff:fe00:5301';
const STATIC = '2001:db8:4e1:20::80';

describe('IPv6 addresses', () => {
  it('parses and writes them in their canonical form (RFC 5952)', () => {
    expect(format6(parse6('2001:0DB8:0000:0000:0000:0000:0000:0080')!)).toBe('2001:db8::80');
    expect(format6(parse6('2001:db8:0:1:0:0:0:1')!)).toBe('2001:db8:0:1::1');
    expect(format6(parse6('2001:db8:0:0:1:0:0:1')!)).toBe('2001:db8::1:0:0:1');
    expect(format6(parse6('::')!)).toBe('::');
    expect(format6(parse6('::ffff:192.0.2.1')!)).toBe('::ffff:c000:201');
    expect(parse6('2001:db8::1::2')).toBeNull();
    expect(parse6('2001:db8:g::1')).toBeNull();
    expect(normalise6('2001:db8:4e1:20:0:0:0:80')).toBe(STATIC);
  });

  it('builds the modified EUI-64 identifier, link-local and SLAAC addresses', () => {
    expect(eui64('00:00:5e:00:53:7c').toString(16)).toBe('2005efffe00537c');
    expect(linkLocalFor('00:00:5e:00:53:01')).toBe(ROUTER);
    expect(slaacFor('2001:db8:4e1:20::/64', '00:00:5e:00:53:2a')).toBe('2001:db8:4e1:20:200:5eff:fe00:532a');
    expect(inPrefix6('2001:db8:4e1:20::80', '2001:db8:4e1:20::/64')).toBe(true);
    expect(inPrefix6('2001:db8:4e1:21::80', '2001:db8:4e1:20::/64')).toBe(false);
  });
});

describe('nftables families', () => {
  const sh = new Shell(STORIES[0].chapters[0], 'en');
  const pkg = (family: 'ip' | 'ip6', port: number, saddr = family === 'ip' ? '198.51.100.7' : '2001:db8:c0:61::10'): Package => ({ family, iif: 'eth0', oif: '', saddr, daddr: family === 'ip' ? '192.0.2.52' : STATIC, proto: 'tcp', sport: 40000, dport: port, ct: 'new', size: 60 });
  const input = (rules: string, family = 'ip') => runNft(sh, `table ${family} f { chain input { type filter hook input priority filter; policy drop; ${rules} } }`, { tables: [] }).ruleset;

  it('a table ip only sees IPv4, a table inet both; ip and ip6 matches keep to their family', () => {
    expect(traverse(input('tcp dport 22 accept'), 'input', 'filter', pkg('ip', 5432)).pass).toBe(false);
    expect(traverse(input('tcp dport 22 accept'), 'input', 'filter', pkg('ip6', 5432)).pass).toBe(true);
    const inet = input('ip saddr 198.51.100.0/24 tcp dport 5432 accept', 'inet');
    expect(traverse(inet, 'input', 'filter', pkg('ip', 5432)).pass).toBe(true);
    expect(traverse(inet, 'input', 'filter', pkg('ip6', 5432)).pass).toBe(false);
    const six = input('ip6 saddr 2001:db8:c0::/48 tcp dport 5432 accept', 'inet');
    expect(traverse(six, 'input', 'filter', pkg('ip6', 5432)).pass).toBe(true);
    expect(traverse(six, 'input', 'filter', pkg('ip6', 5432, '2001:db8:ff::1')).pass).toBe(false);
  });

  it('ICMPv6 types, and their errors', () => {
    const r = input('icmpv6 type { nd-neighbor-solicit, 136 } accept', 'inet');
    const ns: Package = { ...pkg('ip6', 0), proto: 'icmpv6', icmpType: 'nd-neighbor-solicit' };
    expect(traverse(r, 'input', 'filter', ns).pass).toBe(true);
    expect(traverse(r, 'input', 'filter', { ...ns, icmpType: 'nd-neighbor-advert' }).pass).toBe(true);
    expect(traverse(r, 'input', 'filter', { ...ns, icmpType: 'echo-request' }).pass).toBe(false);
    expect(() => input('icmpv6 type nd-neighbour-solicit accept', 'inet')).toThrow(/Could not parse ICMPv6 type/);
    expect(() => input('ip6 saddr 2001:db8::zz accept', 'inet')).toThrow(/Could not resolve hostname/);
  });
});

describe('ufw and IPv6', () => {
  it('IPV6=no leaves IPv6 unfiltered; rules added then exist for IPv4 only', () => {
    const pf = { enabled: true, incoming: 'deny' as const, outgoing: 'allow' as const, rules: [{ action: 'allow' as const, to: '22/tcp', ports: [22], forEachOf: null, v6: false }], ipv6: false };
    expect(verdict(pf, 5432, '2001:db8::1')).toBe('accepted');
    expect(verdict(pf, 5432, '198.51.100.7')).toBe('blocked');
    pf.ipv6 = true;
    expect(verdict(pf, 22, '2001:db8::1')).toBe('blocked');
    expect(verdict(pf, 22, '198.51.100.7')).toBe('accepted');
  });
});

for (const language of languagesFor('ferry'))
  describe(`The Ferry — ${language}`, () => {
    const fr = language === 'fr';
    const t = translator(language);
    const L = (line: string) => inLanguage(t, line);
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);
    const Q = machineName(t, 'quay');
    const LOOK = machineName(t, 'lookout');
    const part = (finished: string[] = []) => {
      const c = new Console({ language, finished: [...BEFORE, ...finished] });
      const one = (l: string) => {
        let output = c.execute(machinesInLanguage(c.t, L(l))) ?? '';
        if (c.shell.waiting) output += '\n' + (c.execute(machinesInLanguage(c.t, MDP)) ?? '');
        return output;
      };
      const play = (lines: string[]) => lines.map(one).join('\n');
      const edit = (command: string, change: (text: string) => string) => {
        one(command);
        c.save(change(c.edition!.text));
        return c.quitEdition();
      };
      play(['ssh quay', 'yes']);
      const main = () => ((c.shell as unknown as { principal: typeof c.shell }).principal ?? c.shell);
      return { c, play, edit, flag: (id: string) => main().flags.has(id), done: (id: string) => c.finished.includes(id) };
    };
    const zone = '/etc/bind/zones/db.ferry.example';
    const newZone = (x: string, address = STATIC, serial = '2029041001') => x.replaceAll('2001:db8:4e1:20:200:5eff:fe00:532a', address).replace('2029031501', serial);
    const stanza = (x: string, extra = `\tgateway ${ROUTER}\n`) => `${x}\n\niface eth0 inet6 static\n\taddress ${STATIC}/64\n${extra}`;

    // ——— Chapter 1: "The New Card" ———

    it('chapter 1 — solution: ip -6, the link-local router, a static address now and in the file, the zone and its serial', () => {
      const { play, edit, flag, done } = part();
      let all = play(['cat message_from_amaru.txt', 'ip -6 addr', 'ip link', 'ip -6 route']);
      expect(all).toContain('inet6 2001:db8:4e1:20:200:5eff:fe00:537c/64 scope global dynamic');
      expect(all).toContain(`default via ${ROUTER} dev eth0 proto ra metric 1024`);
      expect(flag('addresses') && flag('mac') && flag('route')).toBe(true);
      contains(all, "l'adresse de lien local");
      all = play([`ping -6 -c 2 ${ROUTER}`]);
      expect(all).toContain('ping: connect: Invalid argument');
      contains(all, 'après un %');
      all = play([`ping -c 2 ${ROUTER}%eth0`]);
      expect(all).toContain(`64 bytes from ${ROUTER}%eth0: icmp_seq=1 ttl=64`);
      all = play(['dig www.ferry.example AAAA +short']);
      expect(all).toContain('2001:db8:4e1:20:200:5eff:fe00:532a');
      expect(flag('old-record')).toBe(true);
      all = play([`sudo ip -6 addr add ${STATIC}/64 dev eth0`, 'ip -6 addr show dev eth0']);
      expect(all).toContain(`inet6 ${STATIC}/64 scope global`);
      expect(flag('static-now')).toBe(true);
      expect(flag('static-boot')).toBe(false);
      edit('sudo nano /etc/network/interfaces', (x) => stanza(x));
      expect(flag('static-boot')).toBe(true);
      edit(`sudo nano ${zone}`, (x) => newZone(x));
      all = play([`sudo named-checkzone ferry.example ${zone}`, 'sudo rndc reload']);
      expect(all).toContain('loaded serial 2029041001');
      expect(flag('zone-loaded')).toBe(true);
      expect(flag('serial')).toBe(false);
      expect(done('new-card')).toBe(true);
      all = play([`ssh ${LOOK}`, 'yes', 'ping6 -c 2 www.ferry.example']);
      expect(all).toContain(`64 bytes from ${STATIC}: icmp_seq=1`);
      all = play(['curl -6 -v http://www.ferry.example/']);
      expect(all).toContain(`*   Trying [${STATIC}]:80...`);
      expect(all).toContain('failed: Connection refused');
    });

    it('chapter 1 — another solution: only the file, systemctl restart networking, and an accept_ra 2 without gateway', () => {
      const { play, edit, done, flag } = part();
      edit('sudo nano /etc/network/interfaces', (x) => stanza(x, '\taccept_ra 2\n'));
      expect(flag('static-boot')).toBe(true);
      expect(flag('static-now')).toBe(false);
      let all = play(['sudo ifup eth0']);
      expect(all).toContain('ifup: interface eth0 already configured');
      contains(all, 'systemctl restart networking');
      play(['sudo systemctl restart networking']);
      expect(flag('static-now')).toBe(true);
      all = play(['ip -6 route']);
      expect(all).toContain(`default via ${ROUTER} dev eth0 proto ra`);
      expect(all).not.toContain('2001:db8:4e1:20:200:5eff:fe00:537c');
      edit(`sudo nano ${zone}`, (x) => newZone(x, '2001:0db8:04e1:0020:0000:0000:0000:0080', '2029041002'));
      play(['sudo rndc reload']);
      expect(done('new-card')).toBe(true);
    });

    it('chapter 1 — another solution: ifdown eth0 && ifup eth0 on one line keeps the session', () => {
      const { c, play, edit, flag } = part();
      edit('sudo nano /etc/network/interfaces', (x) => stanza(x));
      expect(flag('static-now')).toBe(false);
      const all = play(['sudo ifdown eth0 && sudo ifup eth0']);
      // The server's shell runs ifup right after ifdown: ssh never notices.
      expect(all).not.toContain('client_loop: send disconnect: Broken pipe');
      expect(flag('cut')).toBe(false);
      expect(flag('static-now')).toBe(true);
      expect(c.shell.hostName).toBe(Q);
      expect(play(['ip -6 addr show dev eth0'])).toContain(`inet6 ${STATIC}/64 scope global`);
      // ifdown alone, then a command that doesn't bring it back: the session goes.
      expect(play(['sudo ifdown eth0; ls'])).toContain('client_loop: send disconnect: Broken pipe');
      play(['ssh quay']);
      expect(flag('cut')).toBe(true);
    });

    it('chapter 1 — false leads: ifdown over ssh, the same serial, the SLAAC address in the zone, accept_ra 0 without a gateway, another prefix', () => {
      const { play, edit, flag, done } = part();
      let all = play(['sudo ifdown eth0']);
      expect(all).toContain('client_loop: send disconnect: Broken pipe');
      contains(all, 'Amaru, au bureau, a tapé ifup eth0');
      play(['ssh quay']);
      expect(flag('cut')).toBe(true);
      all = play(['sudo ip -6 addr add 2001:db8:4e1:21::80/64 dev eth0']);
      contains(all, 'pas dans le préfixe du lien');
      play(['sudo ip -6 addr del 2001:db8:4e1:21::80/64 dev eth0']);
      all = play(['sudo ip -6 addr add 2001:db8:4e1:20::80 dev eth0', 'sudo ip -6 addr add 2001:db8:4e1:20::80 dev eth0']);
      expect(all).toContain('RTNETLINK answers: File exists');
      edit('sudo nano /etc/network/interfaces', (x) => stanza(x, '\taccept_ra 0\n'));
      expect(flag('no-route-boot')).toBe(true);
      edit('sudo nano /etc/network/interfaces', (x) => x.replace('\taccept_ra 0', `\tgateway ${ROUTER}`));
      // The zone with the SLAAC address, then the same serial.
      edit(`sudo nano ${zone}`, (x) => newZone(x, '2001:db8:4e1:20:200:5eff:fe00:537c', '2029031501'));
      all = play(['sudo rndc reload']);
      expect(flag('serial')).toBe(true);
      contains(all, 'numéro de série');
      all = play(['dig @ns2.islenet.example www.ferry.example AAAA +short']);
      expect(all).toContain('2001:db8:4e1:20:200:5eff:fe00:532a');
      edit(`sudo nano ${zone}`, (x) => x.replace('2029031501', '2029041001'));
      all = play(['sudo rndc reload']);
      expect(flag('slaac-record')).toBe(true);
      contains(all, 'recassera');
      expect(done('new-card')).toBe(false);
      edit(`sudo nano ${zone}`, (x) => x.replaceAll('2001:db8:4e1:20:200:5eff:fe00:537c', STATIC).replace('2029041001', '2029041002'));
      play(['sudo rndc reload']);
      expect(done('new-card')).toBe(true);
    });

    // ——— Chapter 2: "The Other Door" ———

    const C1 = ['new-card'];
    const INET = (x: string) =>
      x
        .replace('table ip filter', 'table inet filter')
        .replace('\t\ticmp type echo-request accept', '\t\ticmp type echo-request accept\n\t\ticmpv6 type { nd-neighbor-solicit, nd-neighbor-advert, nd-router-advert, packet-too-big, echo-request } accept');

    it('chapter 2 — solution: nmap -6 and nmap from lookout, ss, the ruleset, a table inet with ICMPv6', () => {
      const { play, edit, flag, done } = part(C1);
      let all = play([`ssh ${LOOK}`, 'yes', `nmap -6 ${Q}.ferry.example`]);
      expect(all).toMatch(/5432\/tcp +open +postgresql/);
      expect(all).toMatch(/8080\/tcp +open/);
      expect(all).toContain('Not shown: 996 closed tcp ports (reset)');
      expect(all).toContain(`Nmap scan report for ${Q}.ferry.example (${STATIC})`);
      expect(flag('scan6')).toBe(true);
      all = play([`nmap ${Q}.ferry.example`]);
      expect(all).toContain('Not shown: 997 filtered tcp ports (no-response)');
      expect(all).not.toContain('5432/tcp');
      expect(flag('scan4')).toBe(true);
      all = play([`nc -zv -6 ${Q}.ferry.example 5432`, `nc -zv -4 ${Q}.ferry.example 5432`, 'exit']);
      expect(all).toContain(`Connection to ${Q}.ferry.example (${STATIC}) 5432 port [tcp/postgresql] succeeded!`);
      expect(all).toContain('port 5432 (tcp) timed out: Operation now in progress');
      all = play(['sudo ss -tlnp']);
      expect(all).toMatch(/\[::\]:5432 +\[::\]:\*/);
      expect(all).toMatch(/\*:8080 +\*:\*/);
      expect(flag('sockets')).toBe(true);
      all = play(['ss -tln6']);
      expect(all).not.toContain('0.0.0.0:5432');
      all = play(['sudo nft list ruleset']);
      expect(flag('ruleset')).toBe(true);
      contains(all, 'ne voit que les paquets IPv4');
      edit('sudo nano /etc/nftables.conf', INET);
      all = play(['sudo nft -c -f /etc/nftables.conf', 'sudo systemctl reload nftables']);
      expect(flag('closed-now')).toBe(true);
      expect(flag('closed-boot')).toBe(true);
      expect(done('other-door')).toBe(true);
      all = play([`ssh ${LOOK}`, `nmap -6 -p 22,53,80,5432,8080 ${Q}.ferry.example`, `ping6 -c 1 ${Q}.ferry.example`]);
      expect(all).toMatch(/5432\/tcp +filtered/);
      expect(all).toContain(`64 bytes from ${STATIC}`);
    });

    it('chapter 2 — another solution: an ip6 table beside the ip one, by nft commands, then saved', () => {
      const { play, edit, done, flag } = part(C1);
      let all = play([
        'sudo nft add table ip6 filter6',
        "sudo nft 'add chain ip6 filter6 input { type filter hook input priority filter; policy drop; }'",
        'sudo nft add rule ip6 filter6 input ct state established,related accept',
        'sudo nft add rule ip6 filter6 input meta l4proto ipv6-icmp accept',
        'sudo nft add rule ip6 filter6 input tcp dport { 22, 53, 80 } accept',
        'sudo nft add rule ip6 filter6 input udp dport 53 accept',
      ]);
      expect(flag('closed-now')).toBe(true);
      expect(done('other-door')).toBe(false);
      all += play(['ls', 'ls']);
      expect(flag('not-saved')).toBe(true);
      contains(all, 'ne sont pas celles de /etc/nftables.conf');
      edit('sudo nano /etc/nftables.conf', (x) => `${x}\n\ntable ip6 filter6 {\n\tchain input {\n\t\ttype filter hook input priority filter; policy drop;\n\t\tct state established,related accept\n\t\tmeta l4proto ipv6-icmp accept\n\t\ttcp dport { 22, 53, 80 } accept\n\t\tudp dport 53 accept\n\t}\n}`);
      all = play(['sudo nft -c -f /etc/nftables.conf']);
      expect(done('other-door')).toBe(true);
    });

    it('chapter 2 — false leads: turning IPv6 off, ICMPv6 dropped, a missing rule, the office cut', () => {
      const { play, edit, flag, done } = part(C1);
      let all = play(['sudo sysctl -w net.ipv6.conf.all.disable_ipv6=1', 'ip -6 addr']);
      expect(flag('disabled')).toBe(true);
      contains(all, 'porte close');
      expect(all).not.toContain(STATIC);
      play(['sudo sysctl -w net.ipv6.conf.all.disable_ipv6=0']);
      // The link-local address comes back, not the static one (and no SLAAC: the inet6 static stanza set autoconf 0).
      all = play(['ip -6 addr show dev eth0']);
      expect(all).toContain('scope link');
      expect(all).not.toContain(STATIC);
      play([`sudo ip -6 addr add ${STATIC}/64 dev eth0`]);
      // A table inet without ICMPv6: IPv6 dies.
      edit('sudo nano /etc/nftables.conf', (x) => x.replace('table ip filter', 'table inet filter'));
      all = play(['sudo systemctl reload nftables']);
      expect(flag('nd-dropped')).toBe(true);
      contains(all, 'sollicitation de voisin');
      all = play([`ssh ${LOOK}`, 'yes', `ping6 -c 2 ${Q}.ferry.example`, `nmap -6 ${Q}.ferry.example`, 'exit']);
      expect(all).toContain('Destination unreachable: Address unreachable');
      expect(all).toContain('Note: Host seems down');
      // ICMPv6 back, but the DNS rule forgotten in IPv6, and the office's rule gone.
      edit('sudo nano /etc/nftables.conf', (x) =>
        INET(x)
          .replace('tcp dport { 22, 53, 80 } accept', 'ip6 nexthdr tcp tcp dport { 22, 80 } accept\n\t\tip protocol tcp tcp dport 53 accept')
          .replace(/\t\tip saddr 198\.51\.100\.40 tcp dport 5432 accept\n/, ''),
      );
      all = play(['sudo systemctl reload nftables']);
      expect(flag('v6-stricter')).toBe(true);
      expect(flag('office-cut')).toBe(true);
      expect(done('other-door')).toBe(false);
      edit('sudo nano /etc/nftables.conf', (x) => x.replace('ip6 nexthdr tcp tcp dport { 22, 80 } accept\n\t\tip protocol tcp tcp dport 53 accept', 'tcp dport { 22, 53, 80 } accept\n\t\tip saddr 198.51.100.40 tcp dport 5432 accept'));
      play(['sudo systemctl reload nftables']);
      expect(done('other-door')).toBe(true);
    });

    // ——— Chapter 3: "Both Ways" ———

    const C2 = ['new-card', 'other-door'];
    const SITE = '/etc/nginx/sites-available/ferry';

    it('chapter 3 — solution: curl -6 -v from lookout, ss, the 502 and its log, listen [::]:80, HOST=127.0.0.1', () => {
      const { play, edit, flag, done } = part(C2);
      let all = play([`ssh ${LOOK}`, 'yes', 'curl -6 -v http://www.ferry.example/']);
      expect(all).toContain(`connect to ${STATIC} port 80 from 2001:db8:c0:61::10 port`);
      expect(flag('refused6')).toBe(true);
      all = play(['curl -v http://www.ferry.example/booking/', 'exit']);
      expect(all).toContain('*   Trying 192.0.2.52:80...');
      expect(all).toContain('< HTTP/1.1 502 Bad Gateway');
      expect(flag('bad-gateway')).toBe(true);
      all = play(['sudo ss -tlnp']);
      expect(all).toMatch(/\[::1\]:3000 +\[::\]:\*/);
      expect(flag('sockets')).toBe(true);
      all = play(['sudo tail -n 3 /var/log/nginx/error.log']);
      expect(all).toContain('connect() failed (111: Connection refused) while connecting to upstream, client: 198.51.100.61');
      expect(flag('error-log')).toBe(true);
      edit(`sudo nano ${SITE}`, (x) => x.replace('\tlisten 80 default_server;', '\tlisten 80 default_server;\n\tlisten [::]:80 default_server;'));
      all = play(['sudo nginx -t']);
      expect(flag('not-reloaded')).toBe(true);
      play(['sudo systemctl reload nginx']);
      expect(flag('listen6')).toBe(true);
      edit('sudo nano /etc/default/booking', (x) => x.replace('HOST=localhost', 'HOST=127.0.0.1'));
      all = play(['sudo systemctl restart booking']);
      expect(flag('upstream-ok')).toBe(true);
      expect(done('both-ways')).toBe(true);
      contains(all, 'Vous avez terminé Le Bac');
      all = play([`ssh ${LOOK}`, 'curl -6 http://www.ferry.example/booking/', 'curl -4 -I http://www.ferry.example/']);
      expect(all).toContain('<h1>');
      expect(all).toContain('HTTP/1.1 200 OK');
    });

    it('chapter 3 — another solution: listen [::]:80 ipv6only=off alone, proxy_pass to [::1]', () => {
      const { play, edit, done } = part(C2);
      edit(`sudo nano ${SITE}`, (x) => x.replace('\tlisten 80 default_server;', '\tlisten [::]:80 ipv6only=off default_server;').replace('http://127.0.0.1:3000/', 'http://[::1]:3000/'));
      let all = play(['sudo nginx -t', 'sudo systemctl reload nginx', 'sudo ss -tln']);
      expect(all).toMatch(/\*:80 +\*:\*/);
      all = play(['curl -4 http://localhost/booking/', 'curl http://[::1]/booking/']);
      expect(all).not.toContain('502');
      expect(done('both-ways')).toBe(true);
    });

    it('chapter 3 — false leads: ipv6only=off next to listen 80, proxy_pass to localhost, the app on every address', () => {
      const { play, edit, flag, done } = part(C2);
      edit(`sudo nano ${SITE}`, (x) => x.replace('\tlisten 80 default_server;', '\tlisten 80 default_server;\n\tlisten [::]:80 ipv6only=off;'));
      let all = play(['sudo nginx -t', 'sudo systemctl reload nginx']);
      expect(all).toContain('test is successful');
      expect(flag('bind-conflict') || /Address already in use/.test(play(['sudo journalctl -u nginx -n 5']))).toBe(true);
      expect(flag('listen6')).toBe(false);
      edit(`sudo nano ${SITE}`, (x) => x.replace('\tlisten [::]:80 ipv6only=off;', '\tlisten [::]:80;').replace('http://127.0.0.1:3000/', 'http://localhost:3000/'));
      play(['sudo systemctl reload nginx']);
      expect(flag('listen6')).toBe(true);
      // localhost: nginx tries ::1 first, which answers.
      all = play(['curl -s http://localhost/booking/']);
      expect(all).toContain('<h1>');
      expect(done('both-ways')).toBe(true);
      edit('sudo nano /etc/default/booking', (x) => x.replace('HOST=localhost', 'HOST=0.0.0.0'));
      all = play(['sudo systemctl restart booking']);
      expect(flag('exposed')).toBe(true);
    });
  });
