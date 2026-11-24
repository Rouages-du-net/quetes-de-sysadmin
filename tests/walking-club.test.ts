// The Walking Club: rootless Podman. Each chapter is replayed to the end
// from the workstation (ssh stile), with other solutions and false leads, in
// each language; the expected texts are checked in French. Also: the
// engine (podman.ts: mappings, Quadlet's conversion, messages) and the
// error explainer on Podman's errors.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { translator } from '../src/texts';
import { inLanguage, machinesInLanguage, languagesFor } from './names';
import { explain } from '../src/engine/explainer';
import { convert, toHost, toNs, type IdMap } from '../src/engine/podman';
import { humanSize, table } from '../src/engine/commands/podman';

const PASSWORD = 'switchback-27';
const IMAGE = 'registry.example/openpaths/trailbook:2.3';
const DATA = '/srv/trailbook/data';
const RANGES = 'sudo usermod --add-subuids 296608-362143 --add-subgids 296608-362143 trailbook';
const RUN_U = `podman run -d --name trailbook -p 127.0.0.1:8080:8080 -v ${DATA}:/data:U ${IMAGE}`;
const QUADLET = `[Unit]
Description=Trailbook, the club's walks

[Container]
Image=${IMAGE}
PublishPort=127.0.0.1:8080:8080
Volume=${DATA}:/data:U

[Install]
WantedBy=default.target
`;

describe('The Walking Club: the engine', () => {
  it('maps ids like a user namespace', () => {
    const map: IdMap[] = [
      { container: 0, host: 997, size: 1 },
      { container: 1, host: 296608, size: 65536 },
    ];
    expect(toHost(map, 0)).toBe(997);
    expect(toHost(map, 1000)).toBe(297607);
    expect(toHost(map, 70000)).toBeNull();
    expect(toNs(map, 297607)).toBe(1000);
    expect(toNs(map, 1000)).toBe(65534);
  });

  it('converts a .container file like Quadlet, and refuses an unknown key', () => {
    const ok = convert('/var/lib/trailbook/.config/containers/systemd/web.container', QUADLET, '/usr/libexec/podman/quadlet');
    expect(ok.unit?.name).toBe('web.service');
    expect(ok.unit?.container).toBe('systemd-web');
    expect(ok.unit?.wanted).toBe(true);
    expect(ok.unit?.text).toContain('[X-Container]');
    expect(ok.unit?.text).toContain('ExecStart=/usr/bin/podman run --name systemd-%N --cidfile=%t/%N.cid --replace --rm --cgroups=split --sdnotify=conmon -d');
    expect(convert('/x/web.container', '[Container]\nImage=a.example/b:1\nPorts=80', 'q').error).toBe("converting \"web.container\": unsupported key 'Ports' in group 'Container' in /x/web.container");
    expect(convert('/x/web.container', '[Container]\nPublishPort=8080:8080', 'q').error).toBe('converting "web.container": no Image or Rootfs key specified');
  });

  it('prints like podman', () => {
    expect(humanSize(142_318_592)).toBe('142 MB');
    expect(humanSize(1_500_000_000)).toBe('1.5 GB');
    expect(table([['A', 'B'], ['x', 'y']])).toBe('A           B\nx           y');
  });

  it("explains Podman's errors", () => {
    const t = translator('en');
    const why = (text: string) => explain({ failed: true, output: '', errors: [text] }, t);
    expect(why('ERRO[0000] cannot find UID/GID for user trailbook: no subuid ranges found for user "trailbook" in /etc/subuid - check rootless mode in man pages.')).toBe('podman-subids');
    expect(why("Failed to bind port 80 (Permission denied) for option '-t 80-80:8080-8080'")).toBe('privileged-port');
    expect(why('Failed to connect to user scope bus via local transport: $DBUS_SESSION_BUS_ADDRESS and $XDG_RUNTIME_DIR not defined (consider using --machine=<user>@.host --user to connect to bus of other user)')).toBe('user-bus');
  });
});

for (const language of languagesFor('walking-club'))
  describe(`The Walking Club — ${language}`, () => {
    const fr = language === 'fr';
    const t = translator(language);
    const L = (line: string) => inLanguage(t, machinesInLanguage(t, line));
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);

    function play(finished: string[], id: string) {
      const c = new Console({ language, finished: [...STORIES[0].chapters.map((x) => x.id), ...prerequisites('walking-club'), ...finished] });
      const one = (l: string) => {
        const o = c.execute(L(l));
        let out = typeof o === 'string' ? o : '';
        if (c.shell.waiting) {
          const p = c.execute(machinesInLanguage(t, inLanguage(t, PASSWORD)));
          out += '\n' + (typeof p === 'string' ? p : '');
        }
        if (c.shell.question && /continue connecting/.test(c.shell.question.prompt)) {
          const p = c.execute('yes');
          out += '\n' + (typeof p === 'string' ? p : '');
        }
        return out;
      };
      const run = (...lines: string[]) => lines.map(one).join('\n');
      const edit = (command: string, text: string) => {
        const before = one(command);
        c.shell.saveEdition(text);
        return `${before}\n${c.shell.quitEdition() ?? ''}`;
      };
      run('ssh stile');
      return { c, run, edit, finished: () => c.finished.includes(id) };
    }

    // ——— Chapter 1: No Root Needed ———

    it('chapter 1 — solution: subordinate ids, migrate, port 8080, the data chowned with :U', () => {
      const { run, finished } = play([], 'no-root-needed');
      let all = run('cat message_from_soo-ah.txt', 'cat notes_from_bolat.txt', `ls -ln ${DATA}`, 'sudo -iu trailbook', `podman pull ${IMAGE}`);
      expect(all).toContain('no subuid ranges found for user "trailbook" in /etc/subuid - check rootless mode in man pages.');
      expect(all).toContain('WARN[0000] Using rootless single mapping into the namespace.');
      expect(all).toContain('WARN[0000] The cgroupv2 manager is set to systemd but there is no systemd user session available');
      expect(all).toContain('(requested 0:42 for /etc/gshadow): Check /etc/subuid and /etc/subgid if configured locally and run "podman system migrate": lchown /etc/gshadow: invalid argument): exit status 1');
      contains(all, "podman n'a trouvé aucun identifiant subordonné");
      all = run('exit', 'cat /etc/subuid', RANGES, 'cat /etc/subgid');
      expect(all).toMatch(/^trailbook:296608:65536$/m);
      contains(all, 'trailbook a maintenant sa propre plage');
      all = run('sudo -iu trailbook', `podman pull ${IMAGE}`);
      expect(all).toContain('potentially insufficient UIDs or GIDs');
      contains(all, 'podman le garde');
      all = run('podman system migrate', `podman pull ${IMAGE}`, 'podman images');
      expect(all).toContain('Writing manifest to image destination');
      expect(all).toMatch(/registry\.example\/openpaths\/trailbook\s+2\.3\s+[0-9a-f]{12}\s+3 weeks ago\s+142 MB/);
      contains(all, 'stockage propre à trailbook');
      all = run(`podman run -d --name trailbook -p 80:8080 -v ${DATA}:/data ${IMAGE}`);
      expect(all).toContain("Error: pasta failed with exit code 1:\nFailed to bind port 80 (Permission denied) for option '-t 80-80:8080-8080'");
      contains(all, 'net.ipv4.ip_unprivileged_port_start');
      all = run('podman ps -a', `podman run -d --name trailbook -p 127.0.0.1:8080:8080 -v ${DATA}:/data ${IMAGE}`);
      expect(all).toMatch(/Created\s+0\.0\.0\.0:80->8080\/tcp\s+trailbook/);
      expect(all).toContain('Error: creating container storage: the container name "trailbook" is already in use by');
      all = run('podman rm trailbook', `podman run -d --name trailbook -p 127.0.0.1:8080:8080 -v ${DATA}:/data ${IMAGE}`, 'podman logs trailbook');
      expect(all).toContain('msg="cannot open database" path=/data/trailbook.db err="unable to open database file: permission denied"');
      contains(all, "L'application s'est arrêtée aussitôt");
      all = run('podman unshare cat /proc/self/uid_map', `podman unshare ls -ln ${DATA}`, `ls -ln ${DATA}`);
      expect(all).toContain('         0        997          1\n         1     296608      65536');
      expect(all).toMatch(/-rw-r--r-- 1 65534 65534 2412544 .* trailbook\.db/);
      expect(all).toMatch(/-rw-r--r-- 1 1000 1000 2412544 .* trailbook\.db/);
      all = run('podman rm trailbook', RUN_U);
      expect(all).toContain('Error: failed to chown recursively host path: lchown /srv/trailbook/data: operation not permitted');
      contains(all, 'root peut d');
      all = run('exit', `sudo chown -R trailbook:trailbook ${DATA}`, 'sudo -iu trailbook', 'podman rm trailbook', RUN_U);
      expect(all).toMatch(/^[0-9a-f]{64}$/m);
      contains(all, 'Trailbook tourne sans root sous trailbook');
      expect(finished()).toBe(true);
      all = run('podman top trailbook user huser', `ls -ln ${DATA}`, 'podman ps', 'exit', 'curl -k https://walks.openpaths.example/', 'ps aux');
      expect(all).toMatch(/USER\s+HUSER\ntrailbook\s+297607/);
      expect(all).toMatch(/-rw-r--r-- 1 297607 297607 2412544/);
      expect(all).toMatch(/Up \d+ seconds\s+127\.0\.0\.1:8080->8080\/tcp\s+trailbook/);
      expect(all).toContain('1873');
      expect(all).toMatch(/^297607 +\d+ .*\/usr\/local\/bin\/trailbook serve/m);
    });

    it('chapter 1 — another solution: --userns=keep-id with the data given to trailbook', () => {
      const { run, finished } = play([], 'no-root-needed');
      run(RANGES, `sudo chown -R trailbook:trailbook ${DATA}`);
      const all = run(`sudo -u trailbook podman run -d --name trailbook --userns=keep-id -p 8080:8080 -v ${DATA}:/data ${IMAGE}`, 'sudo -u trailbook podman top trailbook user huser', 'sudo -u trailbook podman exec trailbook id');
      expect(all).toContain('Trying to pull registry.example/openpaths/trailbook:2.3...');
      expect(all).toMatch(/USER\s+HUSER\n997\s+trailbook/);
      expect(all).toContain('uid=997(997) gid=997(997)');
      expect(finished()).toBe(true);
    });

    it('chapter 1 — another solution: podman unshare chown to the image user', () => {
      const { run, finished } = play([], 'no-root-needed');
      run(RANGES, `sudo chown -R trailbook:trailbook ${DATA}`, 'sudo -iu trailbook');
      let all = run(`podman unshare chown -R 1000:1000 ${DATA}`, `podman unshare ls -ln ${DATA}`, `podman unshare chown 70000 ${DATA}`);
      expect(all).toMatch(/-rw-r--r-- 1 1000 1000 2412544/);
      expect(all).toContain("chown: changing ownership of '/srv/trailbook/data': Invalid argument");
      all = run(`podman run -d --name trailbook -p 127.0.0.1:8080:8080 -v ${DATA}:/data ${IMAGE}`, 'curl http://127.0.0.1:8080/');
      expect(all).toContain('1873');
      expect(finished()).toBe(true);
    });

    it('chapter 1 — false leads: sudo podman, chmod 777, the unprivileged ports lowered, a range that overlaps', () => {
      const { run, finished } = play([], 'no-root-needed');
      let all = run(`sudo podman run -d --name trailbook -p 8080:8080 -v ${DATA}:/data ${IMAGE}`, 'curl -k https://walks.openpaths.example/');
      expect(all).toContain('1873');
      contains(all, 'sudo podman lance Podman en root');
      expect(finished()).toBe(false);
      all = run('sudo podman rm -f trailbook', 'sudo usermod --add-subuids 100000-165535 --add-subgids 100000-165535 trailbook');
      contains(all, 'chevauche');
      all = run('sudo usermod --del-subuids 100000-165535 --del-subgids 100000-165535 trailbook', RANGES, `sudo chmod -R 777 ${DATA}`);
      contains(all, 'chmod 777 (ou o+w)');
      all = run('sudo sysctl -w net.ipv4.ip_unprivileged_port_start=0');
      contains(all, "n'importe quel programme");
      all = run(`sudo -u trailbook podman run -d --name trailbook -p 8080:8080 -v ${DATA}:/data ${IMAGE}`, 'curl http://localhost:8080/');
      expect(all).toContain('1873');
      expect(finished()).toBe(false);
      run('sudo sysctl -w net.ipv4.ip_unprivileged_port_start=1024');
      expect(finished()).toBe(false);
      run(`sudo chmod 755 ${DATA}`, `sudo chmod 644 ${DATA}/trailbook.db`);
      expect(finished()).toBe(true);
    });

    it('chapter 1 — a container without the data runs on an empty database', () => {
      const { run, finished } = play([], 'no-root-needed');
      run(RANGES);
      const all = run(`sudo -u trailbook podman run -d --name trailbook -p 8080:8080 -v trailbook-data:/data ${IMAGE}`, 'sudo -u trailbook podman logs trailbook', 'curl -k https://walks.openpaths.example/');
      expect(all).toContain('msg="database created" path=/data/trailbook.db walks=0 signups=0');
      contains(all, 'sur une base vide');
      expect(finished()).toBe(false);
    });

    // ——— Chapter 2: Logged Out ———

    it('chapter 2 — solution: a Quadlet unit, the account lingering, a reboot', () => {
      const { run, edit, finished } = play(['no-root-needed'], 'logged-out');
      let all = run('cat message_from_ayasha.txt', 'sudo journalctl --since "2033-04-13 18:00" --until "2033-04-13 18:05"');
      expect(all).toContain('Removed session 41.');
      expect(all).toContain('Stopped user@997.service - User Manager for UID 997.');
      contains(all, 'logind arrête');
      all = run('sudo -iu trailbook', 'podman ps -a', 'systemctl --user status');
      expect(all).toMatch(/Exited \(143\) 15 hours ago\s+127\.0\.0\.1:8080->8080\/tcp\s+trailbook/);
      expect(all).toContain('Failed to connect to user scope bus via local transport: $DBUS_SESSION_BUS_ADDRESS and $XDG_RUNTIME_DIR not defined');
      contains(all, "qu'une connexion définit");
      all = edit('nano ~/.config/containers/systemd/trailbook.container', QUADLET);
      all += run('/usr/libexec/podman/quadlet -dryrun -user', 'exit', 'sudo loginctl enable-linger trailbook', 'loginctl list-users');
      expect(all).toContain('---trailbook.service---');
      expect(all).toContain('ExecStart=/usr/bin/podman run --name systemd-%N');
      expect(all).toMatch(/997 trailbook yes\s+lingering/);
      contains(all, 'trailbook persiste');
      contains(all, 'redémarre echalier');
      all = run('sudo -iu trailbook', 'export XDG_RUNTIME_DIR=/run/user/$(id -u)', 'systemctl --user status trailbook', 'systemctl --user enable trailbook', 'podman ps');
      expect(all).toContain('Loaded: loaded (/var/lib/trailbook/.config/containers/systemd/trailbook.container; generated)');
      expect(all).toContain('Active: active (running)');
      expect(all).toContain('Failed to enable unit: Unit /run/user/997/systemd/generator/trailbook.service is transient or generated');
      expect(all).toMatch(/127\.0\.0\.1:8080->8080\/tcp\s+systemd-trailbook/);
      expect(all).not.toContain('WARN[0000]');
      expect(finished()).toBe(false);
      all = run('exit', 'sudo reboot');
      expect(finished()).toBe(true);
      contains(all, 'Tu as terminé Déconnexion.');
      all = run('ssh stile', 'curl -k https://walks.openpaths.example/', 'sudo journalctl -u user@997 -b');
      expect(all).toContain('1873');
      expect(all).toContain("Started trailbook.service - Trailbook, the club's walks.");
    });

    it('chapter 2 — another solution: systemctl --user -M from root, the container named, linger last', () => {
      const { run, edit, finished } = play(['no-root-needed'], 'logged-out');
      edit('sudo nano /var/lib/trailbook/.config/containers/systemd/walks.container', QUADLET.replace('[Container]\n', '[Container]\nContainerName=trailbook\n'));
      let all = run('sudo systemctl --user -M trailbook@ daemon-reload');
      expect(all).toContain('Failed to connect to user scope bus via machine transport: No such file or directory');
      all = run('sudo loginctl enable-linger trailbook', 'sudo systemctl --user -M trailbook@ status walks', 'sudo -u trailbook podman ps');
      expect(all).toContain("● walks.service - Trailbook, the club's walks");
      expect(all).toMatch(/127\.0\.0\.1:8080->8080\/tcp\s+trailbook$/m);
      run('sudo reboot', 'ssh stile');
      expect(finished()).toBe(true);
    });

    it('chapter 2 — false leads: nohup, a root unit, generate systemd, a reboot without linger, a Quadlet error', () => {
      const { run, edit, finished } = play(['no-root-needed'], 'logged-out');
      let all = run('sudo -iu trailbook', 'podman rm trailbook', `nohup podman run -d --name trailbook -p 127.0.0.1:8080:8080 -v ${DATA}:/data:U ${IMAGE}`, 'podman generate systemd trailbook');
      expect(all).toContain('DEPRECATED command:\nIt is recommended to use Quadlets for running containers and pods under systemd.');
      contains(all, 'nohup protège seulement');
      contains(all, 'podman generate systemd marche encore');
      all = edit('nano ~/.config/containers/systemd/trailbook.container', QUADLET.replace('PublishPort', 'Ports'));
      all += run('/usr/libexec/podman/quadlet -dryrun -user');
      expect(all).toContain("converting \"trailbook.container\": unsupported key 'Ports' in group 'Container' in /var/lib/trailbook/.config/containers/systemd/trailbook.container");
      contains(all, 'Quadlet a refusé le fichier');
      run('exit');
      all = edit('sudo nano /etc/systemd/system/trailbook.service', `[Service]\nExecStart=/usr/bin/sudo -u trailbook /usr/bin/podman start -a trailbook\n\n[Install]\nWantedBy=multi-user.target\n`);
      contains(all, 'remet le lanceur root en place');
      all = run('curl -k https://walks.openpaths.example/', 'sudo reboot', 'ssh stile', 'curl -k https://walks.openpaths.example/');
      expect(all).toContain('502 Bad Gateway');
      contains(all, 'echalier a redémarré, et le site ne répond pas');
      expect(finished()).toBe(false);
    });
  });
