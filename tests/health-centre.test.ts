// The Health Centre: a rural practice's KVM/libvirt hypervisor. Each chapter
// is replayed to the end from the workstation (ssh hearth), with another
// solution and false leads, in each language; the expected texts are
// checked in French. Also: the domain XML as libvirt reads it (libxml2's and
// the schema's errors), qemu-img's sizes, virsh's tables.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';
import { SCHEMA_ERROR, chainOf, configFromXml, domainXml, libvirt, parseXml, qemuBytes, qemuSize, scaledKiB, usedShare } from '../src/engine/libvirt';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
const PASSWORD = 'waiting-room-30';
const IMG = '/var/lib/libvirt/images';

describe('libvirt and QEMU: XML, sizes, units', () => {
  it('reads a domain XML like libvirt: libxml2 errors, the schema, its own checks', () => {
    const s = new Shell(chapter('wrong-side'), 'en');
    const xml = domainXml(s, 'portal', true);
    const doc = parseXml(xml, 'domain_definition');
    expect('error' in doc).toBe(false);
    const conf = configFromXml(doc as never);
    expect(conf).toMatchObject({ name: 'portal', memory: 4194304, vcpus: 2, ifaces: [{ type: 'network', source: 'default', mac: '52:54:00:5b:9e:41' }] });
    const broken = parseXml(xml.replace("<model type='virtio'/>\n", "<model type='virtio'>\n"), 'domain_definition');
    expect((broken as { error: string }).error).toMatch(/^\(domain_definition\):\d+: Opening and ending tag mismatch: model line \d+ and interface\n/);
    const brige = configFromXml(parseXml(xml.replace("<interface type='network'>", "<interface type='brige'>"), 'x') as never);
    expect(brige).toEqual({ error: SCHEMA_ERROR });
    const multicast = configFromXml(parseXml(xml.replace('52:54:00:5b:9e:41', '01:54:00:5b:9e:41'), 'x') as never);
    expect(multicast).toEqual({ error: "XML error: expected unicast mac address, found multicast '01:54:00:5b:9e:41'" });
    expect((parseXml('<domain>', 'x') as { error: string }).error).toMatch(/Premature end of data in tag domain line 1/);
  });

  it('writes sizes like QEMU and reads them like virsh and qemu-img', () => {
    expect(qemuSize(21.4 * 1024 ** 3)).toBe('21.4 GiB');
    expect(qemuSize(200 * 1024 ** 3)).toBe('200 GiB');
    expect(qemuSize(196 * 1024)).toBe('196 KiB');
    expect(scaledKiB('6G')).toBe(6 * 1024 * 1024);
    expect(scaledKiB('6GiB')).toBe(6 * 1024 * 1024);
    expect(scaledKiB('4194304')).toBe(4194304);
    expect(scaledKiB('6GB')).toBe(5859375);
    expect(qemuBytes('20G')).toBe(20 * 1024 ** 3);
    expect(qemuBytes('512M')).toBe(512 * 1024 ** 2);
  });

  it('follows a backing chain, and a running domain reads what it opened', () => {
    const s = new Shell(chapter('cold-start'), 'en');
    const c = chainOf(s, `${IMG}/ledger.before-upgrade`);
    expect(c.links.map((l) => l.path.split('/').at(-1))).toEqual(['ledger.before-upgrade', 'ledger.before-yearend', 'ledger.before-update', 'ledger.qcow2']);
    expect(c.missing).toBeNull();
    expect(usedShare(s, IMG)).toBeGreaterThan(0.98);
  });
});

for (const language of LANGUAGES)
  describe(`The Health Centre — ${language}`, () => {
    const fr = language === 'fr';
    const t = translator(language);
    const L = (line: string) => inLanguage(t, machinesInLanguage(t, line));
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);

    function play(finished: string[]) {
      const c = new Console({ language, finished: [...STORIES[0].chapters.map((x) => x.id), ...prerequisites('health-centre'), ...finished] });
      const one = (l: string) => {
        const o = c.execute(L(l));
        let out = typeof o === 'string' ? o : '';
        if (c.shell.waiting) {
          const p = c.execute(machinesInLanguage(t, PASSWORD));
          out += '\n' + (typeof p === 'string' ? p : '');
        }
        return out;
      };
      const run = (...lines: string[]) => lines.map(one).join('\n');
      const edit = (command: string, change: (text: string) => string) => {
        const before = one(command);
        c.shell.saveEdition(change(c.shell.edition!.text));
        return `${before}\n${c.shell.quitEdition() ?? ''}`;
      };
      /** ssh to a guest, until the prompt is the one wanted (two guests sharing an address take turns). */
      const sshTo = (name: string) => {
        let all = '';
        for (let k = 0; k < 4; k++) {
          all += run(`ssh ${name}`);
          if (c.shell.question) all += run('yes');
          if (c.shell.host === name) return all;
          all += run('exit');
        }
        return all;
      };
      run('ssh hearth', 'yes');
      return { c, run, edit, sshTo, hearth: () => c.remote!.shell, finished: () => c.remote!.shell.finished };
    }

    it('chapter 1 — solution: list --all, the pause, the chain, room, blockcommit, cleanup, resume, autostart, ssh', () => {
      const { run, finished, hearth } = play([]);
      let all = run('cat message_from_grace.txt', 'cat note_from_ilse.txt', 'cat message_from_priya.txt', 'virsh list --all');
      expect(all).toMatch(/ -\s+ledger\s+shut off/);
      contains(all, 'autostart');
      all = run('virsh dominfo ledger');
      expect(all).toContain('Autostart:      disable');
      all = run('virsh start ledger', 'virsh list');
      expect(all).toContain("Domain 'ledger' started");
      contains(all, 'werror=enospc');
      all = run('virsh domstate ledger --reason', 'virsh domblkerror ledger', 'df -h /var');
      expect(all).toContain('paused (I/O error)');
      expect(all).toContain('vda: no space');
      expect(all).toMatch(/\/dev\/sda3 +240G +240G +0 100% \/var/);
      all = run('virsh domblklist ledger', 'sudo qemu-img info --backing-chain /var/lib/libvirt/images/ledger.before-upgrade');
      expect(all).toContain('Failed to get shared "write" lock');
      contains(all, '--force-share');
      all = run('sudo qemu-img info -U --backing-chain /var/lib/libvirt/images/ledger.before-upgrade', 'virsh snapshot-list ledger');
      expect(all).toContain('backing file: /var/lib/libvirt/images/ledger.before-yearend');
      expect(all).toContain('virtual size: 200 GiB (214748364800 bytes)');
      expect(all).toMatch(/before-yearend +2029-12-28 17:05:44 \+0000 +disk-snapshot/);
      all = run('virsh blockcommit ledger vda --active --pivot --verbose');
      expect(all).toContain('Commit failed');
      contains(all, 'fusion');
      all = run('sudo ls -l /var/lib/libvirt/images', 'sudo rm /var/lib/libvirt/images/ledger-test-clone.qcow2', 'virsh blockcommit ledger vda --active --pivot --verbose');
      expect(all).toContain('Block commit: [100 %]\nSuccessfully pivoted');
      contains(all, '--metadata');
      expect(finished()).toBe(false);
      all = run(
        'virsh domblklist ledger',
        'sudo rm /var/lib/libvirt/images/ledger.before-update /var/lib/libvirt/images/ledger.before-yearend /var/lib/libvirt/images/ledger.before-upgrade',
        'virsh snapshot-delete ledger before-upgrade --metadata',
        'virsh snapshot-delete ledger before-yearend --metadata',
        'virsh snapshot-delete ledger before-update --metadata',
        'df -h /var',
      );
      expect(all).toContain(' vda      /var/lib/libvirt/images/ledger.qcow2');
      expect(all).toContain('Domain snapshot before-update deleted');
      expect(all).toMatch(/\/dev\/sda3 +240G +\d+G +\d+G +5\d% \/var/);
      all = run('virsh resume ledger', 'virsh autostart ledger', 'ls /etc/libvirt/qemu/autostart');
      expect(all).toContain("Domain 'ledger' resumed");
      expect(all).toContain("Domain 'ledger' marked as autostarted");
      expect(all).toContain('ledger.xml');
      expect(finished()).toBe(false);
      all = run('ssh ledger', 'yes');
      contains(all, 'CE QUI S');
      expect(finished()).toBe(true);
      all = run('ls /srv/ledger/books', 'exit');
      expect(all).toContain('2030.db');
      expect(libvirt(hearth()).domains.ledger.config.disks[0].source).toBe(`${IMG}/ledger.qcow2`);
    });

    it('chapter 1 — another way: snapshot-delete merges each external snapshot (after an overlay removed by mistake)', () => {
      const { run, finished } = play([]);
      run('virsh start ledger', 'virsh list');
      let all = run('sudo rm /var/lib/libvirt/images/ledger.before-update', 'df -h /var', 'sudo lsof +L1');
      contains(all, 'lsof');
      expect(all).toMatch(/\/dev\/sda3 +240G +240G +0 100% \/var/);
      expect(all).toContain('/var/lib/libvirt/images/ledger.before-update (deleted)');
      all = run('virsh shutdown ledger', 'virsh list');
      contains(all, 'bouton');
      expect(all).toMatch(/ 3\s+ledger\s+paused/);
      all = run('sudo rm /var/lib/libvirt/images/ledger-test-clone.qcow2', 'virsh snapshot-delete ledger before-update', 'virsh snapshot-delete ledger before-yearend', 'virsh snapshot-delete ledger before-upgrade', 'virsh snapshot-list ledger', 'sudo ls /var/lib/libvirt/images');
      expect(all).toContain('Domain snapshot before-upgrade deleted');
      expect(all).not.toContain('ledger.before-yearend');
      all = run('virsh resume ledger', 'virsh autostart ledger', 'ssh ledger', 'yes');
      expect(finished()).toBe(true);
    });

    it('chapter 1 — false leads: revert and undefine refused, destroy, then an overlay removed and the chain broken', () => {
      const { run, finished } = play([]);
      let all = run('virsh snapshot-revert ledger before-update');
      expect(all).toContain('error: unsupported configuration: revert to external snapshot not supported yet');
      contains(all, 'comptes');
      all = run('virsh undefine ledger');
      expect(all).toContain("error: Requested operation is not valid: cannot delete inactive domain with 3 snapshots");
      all = run('virsh start ledger', 'virsh list', 'virsh destroy ledger');
      expect(all).toContain("Domain 'ledger' destroyed");
      contains(all, 'débranche');
      all = run('sudo rm /var/lib/libvirt/images/ledger.before-yearend', 'virsh start ledger');
      expect(all).toContain(
        "error: Failed to start domain 'ledger'\nerror: Cannot access backing file '/var/lib/libvirt/images/ledger.before-yearend' of storage file '/var/lib/libvirt/images/ledger.before-upgrade' (as uid:64055, gid:64055): No such file or directory",
      );
      contains(all, 'cassée');
      expect(finished()).toBe(false);
    });

    it('chapter 2 — solution: portal on br0, the reception reaches it; the copy gets its own MAC and machine-id', () => {
      const { run, edit, sshTo, finished } = play(['cold-start']);
      let all = run('cat message_from_grace.txt', 'virsh domiflist portal', 'virsh net-dhcp-leases default');
      expect(all).toMatch(/vnet3 +network +default +virtio +52:54:00:5b:9e:41/);
      expect(all).toMatch(/52:54:00:5b:9e:41 +ipv4 +192\.168\.122\.47\/24 +portal/);
      contains(all, 'NAT');
      all = run('ssh reception', 'yes', 'cat note_from_hamid.txt', 'curl http://192.168.122.47/', 'curl http://agenda.internal/', 'curl http://agenda.internal/', 'exit');
      expect(all).toContain('Failed to connect to 192.168.122.47');
      expect(all).toContain('TRAINING COPY - not real appointments');
      expect(all).toContain('<h1>Appointment book</h1>');
      contains(all, 'routeur');
      contains(all, 'virt-clone');
      all = run('virsh domiflist agenda', 'cat /etc/network/interfaces');
      expect(all).toMatch(/vnet0 +bridge +br0 +virtio +52:54:00:a6:3e:10/);
      expect(all).toContain('bridge_ports eno1');
      all = edit('virsh edit portal', (x) => x.replace("<interface type='network'>", "<interface type='bridge'>").replace("<source network='default'/>", "<source bridge='br0'/>"));
      expect(all).toContain("Domain 'portal' XML configuration edited.");
      contains(all, 'définition');
      all = run('virsh dumpxml portal | grep source', 'virsh shutdown portal', 'virsh list --all', 'virsh start portal', 'virsh domifaddr portal', 'virsh domifaddr portal --source arp');
      expect(all).toContain("<source network='default'");
      expect(all).toMatch(/ -\s+portal\s+shut off/);
      expect(all).toMatch(/vnet\d +52:54:00:5b:9e:41 +ipv4 +192\.0\.2\.150\/0/);
      all = run('ssh reception', 'curl http://portal.internal/', 'exit');
      expect(all).toContain('<h1>Book an appointment</h1>');
      contains(all, 'portal.internal');
      all = run('virsh domiflist agenda-training', 'virsh shutdown agenda-training', 'virsh list --all');
      expect(all).toMatch(/bridge +br0 +virtio +52:54:00:a6:3e:10/);
      all = edit('virsh edit agenda-training', (x) => x.replace("      <mac address='52:54:00:a6:3e:10'/>\n", ''));
      expect(all).toContain("Domain 'agenda-training' XML configuration edited.");
      all = run('virsh start agenda-training', 'virsh domiflist agenda-training', 'virsh domifaddr agenda-training --source arp');
      expect(all).not.toMatch(/bridge +br0 +virtio +52:54:00:a6:3e:10/);
      expect(all).toContain('192.0.2.90/0');
      contains(all, 'machine-id');
      expect(finished()).toBe(false);
      all = sshTo('agenda-training');
      all = run('cat /etc/machine-id', 'sudo rm /etc/machine-id', 'sudo systemd-machine-id-setup', 'hostnamectl', 'sudo reboot');
      expect(all).toContain('Initializing machine ID from VM UUID.');
      expect(all).toMatch(/closed by remote host/);
      expect(finished()).toBe(true);
      contains(all, 'CE QUI S');
      all = run('virsh domifaddr agenda-training --source arp');
      expect(all).toContain('192.0.2.151/0');
      all = run('ssh reception', 'curl http://agenda.internal/', 'curl http://agenda.internal/', 'exit');
      expect(all).not.toContain('TRAINING COPY');
    });

    it('chapter 2 — false leads: DNAT, promiscuous mode, a typo in the XML, a reboot after the edit, the original changed', () => {
      const { run, edit, sshTo, finished, hearth } = play(['cold-start']);
      let all = run('sudo iptables -t nat -A PREROUTING -p tcp --dport 8080 -j DNAT --to-destination 192.168.122.47:80');
      contains(all, 'DNAT');
      all = run('sudo ip link set br0 promisc on');
      contains(all, 'promiscuité');
      all = edit('virsh edit portal', (x) => x.replace("<interface type='network'>", "<interface type='brige'>"));
      expect(all).toContain('error: XML document failed to validate against schema: Unable to validate doc against /usr/share/libvirt/schemas/domain.rng');
      all = edit('virsh edit portal', (x) => x.replace('    </interface>', '    </interfac>'));
      expect(all).toMatch(/error: \(domain_definition\):\d+: Opening and ending tag mismatch: interface line \d+ and interfac/);
      all = edit('virsh edit portal', (x) => x.replace("<interface type='network'>", "<interface type='bridge'>").replace("<source network='default'/>", "<source bridge='br1'/>"));
      expect(all).toContain('edited');
      all = run('virsh shutdown portal', 'virsh start portal');
      expect(all).toContain("error: Failed to start domain 'portal'\nerror: Cannot get interface MTU on 'br1': No such device");
      edit('virsh edit portal', (x) => x.replace("<source bridge='br1'/>", "<source bridge='br0'/>"));
      run('virsh start portal', 'virsh list');
      expect(libvirt(hearth()).domains.portal.lanIp).toBe('192.0.2.150');
      // The original changed instead of the copy: its MAC.
      all = edit('virsh edit agenda', (x) => x.replace("52:54:00:a6:3e:10", '52:54:00:a6:3e:11'));
      contains(all, 'original');
      edit('virsh edit agenda', (x) => x.replace("52:54:00:a6:3e:11", '52:54:00:a6:3e:10'));
      // A new MAC alone: the copy keeps the same address.
      all = run('virsh shutdown agenda-training');
      edit('virsh edit agenda-training', (x) => x.replace("      <mac address='52:54:00:a6:3e:10'/>\n", ''));
      all = run('virsh start agenda-training', 'virsh list', 'virsh reboot agenda-training');
      contains(all, '192.0.2.90');
      all = sshTo('agenda-training');
      run('sudo truncate -s 0 /etc/machine-id', 'exit');
      expect(finished()).toBe(false);
      all = run('virsh reboot agenda-training', 'virsh list');
      expect(libvirt(hearth()).domains['agenda-training'].lanIp).not.toBe('192.0.2.90');
      expect(finished()).toBe(false);
      run('ssh reception', 'yes', 'curl http://portal.internal/', 'exit');
      expect(finished()).toBe(true);
    });

    it('chapter 3 — solution: setmem --live --config, a snapshot, blockresize, growpart and resize2fs, the snapshots deleted', () => {
      const { run, sshTo, finished } = play(['cold-start', 'wrong-side']);
      let all = run('cat message_from_grace.txt', 'cat note_from_joon.txt', 'free -h');
      expect(all).toMatch(/Swap: +8[.,]0Gi +[1-9][.,]\dGi/);
      contains(all, 'swap');
      all = run('virsh dominfo records', 'virsh nodeinfo', 'virsh dommemstat records');
      expect(all).toContain('Max memory:     16777216 KiB');
      expect(all).toContain('Memory size:    33554432 KiB');
      expect(all).toMatch(/disk_caches \d+/);
      contains(all, 'ballon');
      all = run('virsh setmem records 6G --live --config', 'free -h', 'virsh dominfo records');
      expect(all).toMatch(/Swap: +8[.,]0Gi +0B/);
      expect(all).toContain('Used memory:    6291456 KiB');
      all = sshTo('records');
      all = run('df -h /', 'cat /srv/records/RETENTION.txt', 'exit');
      expect(all).toMatch(/\/dev\/vda1 +20G +20G +\d+M +100% \//);
      contains(all, 'retour');
      all = run('virsh snapshot-create-as records before-grow "before growing vda"', 'virsh snapshot-list records');
      expect(all).toContain('Domain snapshot before-grow created');
      expect(all).toMatch(/before-grow +\d{4}-\d\d-\d\d [\d:]+ \+0000 +running/);
      all = run('sudo qemu-img resize /var/lib/libvirt/images/records.qcow2 +20G');
      expect(all).toContain('Failed to get "write" lock');
      all = run('virsh blockresize records vda 40G');
      expect(all).toContain("Block device 'vda' is resized");
      all = sshTo('records');
      all = run('lsblk', 'sudo dmesg | tail -n 2', 'sudo growpart /dev/vda 1', 'sudo resize2fs /dev/vda1', 'df -h /', 'exit');
      expect(all).toMatch(/vda +254:0 +0 +40G +0 disk/);
      expect(all).toContain('detected capacity change from 41943040 to 83886080');
      expect(all).toContain('CHANGED: partition=1 start=2048 old: size=41940959 end=41943006 new: size=83883999 end=83886046');
      expect(all).toContain('The filesystem on /dev/vda1 is now 10485499 (4k) blocks long.');
      expect(all).toMatch(/\/dev\/vda1 +40G +20G +20G +50% \//);
      expect(finished()).toBe(false);
      all = run('virsh snapshot-delete records before-grow', 'virsh snapshot-list records', 'virsh snapshot-delete records before-trixie');
      expect(all).toContain('Domain snapshot before-trixie deleted');
      expect(finished()).toBe(true);
      contains(all, 'CE QUI S');
    });

    it('chapter 3 — another way, with false leads: --config alone, too much memory, a shrink refused; then qemu-img resize while it is off', () => {
      const { run, sshTo, finished } = play(['cold-start', 'wrong-side']);
      let all = run('virsh setmem records 20G');
      expect(all).toContain('error: invalid argument: cannot set memory higher than max memory');
      all = run('virsh setmem records 6G --config', 'free -h');
      contains(all, '--live');
      all = run('virsh setmaxmem records 8G');
      expect(all).toContain('cannot resize the maximum memory on an active domain');
      all = run('virsh shutdown records', 'virsh list --all', 'sudo qemu-img resize /var/lib/libvirt/images/records.qcow2 10G');
      expect(all).toContain("qemu-img: warning: Shrinking an image will delete all data beyond the shrunken image's end.");
      contains(all, '--shrink');
      all = run('virsh snapshot-create-as records before-grow', 'sudo qemu-img resize /var/lib/libvirt/images/records.qcow2 +20G', 'sudo qemu-img info /var/lib/libvirt/images/records.qcow2', 'virsh start records', 'free -h');
      expect(all).toContain('Image resized.');
      expect(all).toContain('virtual size: 40 GiB (42949672960 bytes)');
      expect(all).toMatch(/2 +before-grow/);
      all = sshTo('records');
      run('sudo growpart /dev/vda 1', 'sudo resize2fs /dev/vda1', 'exit');
      run('virsh snapshot-delete records before-grow', 'virsh snapshot-delete records before-trixie');
      expect(finished()).toBe(true);
    });
  });

