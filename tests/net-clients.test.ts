// Network clients (commands/net-clients.ts): wget on top of the game's
// curl, nslookup and host with or without the story's network, and the tip
// for ifconfig and its cousins (net-tools isn't installed on Debian).
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { d, f, type Chapter } from '../src/engine/world';
import { newMemory, newTips } from '../src/engine/tips';

const mine = { owner: 'you' };
const chapter = (network: boolean): Chapter => ({
  id: 'net-clients-test',
  number: 1,
  commands: ['ls', 'cat', 'curl', 'dig', 'ip', 'ss'],
  home: '/home/you',
  welcome: 'n',
  final: '',
  events: [],
  ...(network
    ? {
        state: () => ({
          network: {
            machines: {},
            names: { 'www.cafe.example': '203.0.113.20' },
            resolvers: ['192.0.2.53'],
            routes: {},
            web: { 'www.cafe.example': { headers: ['HTTP/1.1 200 OK', 'Content-Type: text/html'], body: '<h1>Café</h1>' } },
          },
        }),
      }
    : {}),
  createWorld: () =>
    d({
      etc: d({ 'resolv.conf': f('nameserver 192.0.2.53', { lines: true, owner: 'root' }), hosts: f('127.0.0.1\tlocalhost\n192.0.2.77\tprinter.internal', { lines: true, owner: 'root' }) }),
      home: d({ you: d({ n: f('x', mine) }, undefined, mine) }),
    }),
});
const shell = (network = true, language: 'en' | 'fr' = 'en') => {
  const s = new Shell(chapter(network), language);
  s.colours = false;
  return s;
};

describe('wget', () => {
  it('saves the page under its name, tells the way, -qO- prints it, --spider only checks', () => {
    const s = shell();
    const log = s.execute('wget http://www.cafe.example/')!;
    expect(log).toMatch(/^--\d{4}-\d\d-\d\d \d\d:\d\d:\d\d--  http:\/\/www\.cafe\.example\/\nResolving www\.cafe\.example \(www\.cafe\.example\)\.\.\. 203\.0\.113\.20\n/);
    expect(log).toContain('HTTP request sent, awaiting response... 200 OK');
    expect(log).toContain('Saving to: ‘index.html’');
    expect(s.execute('cat index.html')).toBe('<h1>Café</h1>');
    s.execute('wget -q http://www.cafe.example/');
    expect(s.execute('ls')).toBe('index.html  index.html.1  n');
    expect(s.execute('wget -qO- http://www.cafe.example/')).toBe('<h1>Café</h1>');
    s.execute('wget -q -O page.html www.cafe.example');
    expect(s.execute('cat page.html')).toBe('<h1>Café</h1>');
    expect(s.execute('wget --spider http://www.cafe.example/')).toMatch(/^Spider mode enabled\. Check if remote file exists\.\n[\s\S]*Remote file exists and could contain further links,\nbut recursion is disabled -- not retrieving\.$/);
    expect(s.lastStatus).toBe(0);
  });

  it('a name nobody knows: exit code 4', () => {
    const s = shell();
    expect(s.execute('wget http://nowhere.example/')).toMatch(/Resolving nowhere\.example \(nowhere\.example\)\.\.\. failed: Name or service not known\.\nwget: unable to resolve host address ‘nowhere\.example’$/);
    expect(s.lastStatus).toBe(4);
    expect(s.execute('wget')).toBe("wget: missing URL\nUsage: wget [OPTION]... [URL]...\n\nTry `wget --help' for more options.");
  });
});

describe('nslookup and host', () => {
  it('ask the story DNS, never /etc/hosts', () => {
    const s = shell();
    expect(s.execute('nslookup www.cafe.example')).toBe('Server:\t\t192.0.2.53\nAddress:\t192.0.2.53#53\n\nNon-authoritative answer:\nName:\twww.cafe.example\nAddress: 203.0.113.20');
    expect(s.execute('nslookup printer.internal')).toBe("Server:\t\t192.0.2.53\nAddress:\t192.0.2.53#53\n\n** server can't find printer.internal: NXDOMAIN");
    expect(s.lastStatus).toBe(1);
    expect(s.execute('host www.cafe.example')).toBe('www.cafe.example has address 203.0.113.20');
    expect(s.execute('host printer.internal')).toBe('Host printer.internal not found: 3(NXDOMAIN)');
  });

  it('without a simulated network, no server answers', () => {
    const s = shell(false);
    expect(s.execute('nslookup www.cafe.example')).toBe(';; communications error to 192.0.2.53#53: timed out\n;; communications error to 192.0.2.53#53: timed out\n;; communications error to 192.0.2.53#53: timed out\n;; no servers could be reached\n');
    expect(s.execute('host www.cafe.example')).toBe(';; communications error to 192.0.2.53#53: timed out\n;; communications error to 192.0.2.53#53: timed out\n;; no servers could be reached');
    expect(s.lastStatus).toBe(1);
  });
});

describe('net-tools and the others not installed', () => {
  it('ifconfig, route, tracepath, mtr: command not found; ifconfig earns the tip about ip and ss', () => {
    const s = shell();
    for (const c of ['ifconfig', 'route', 'tracepath', 'mtr']) expect(s.execute(c)).toContain(`${c}: command not found`);
    s.execute('ifconfig');
    expect(newTips({ sh: s, before: s.cwd, tab: false, said: true }, newMemory(), [])).toEqual(['net-tools']);
    s.execute('ls');
    expect(newTips({ sh: s, before: s.cwd, tab: false, said: true }, newMemory(), [])).toEqual([]);
    expect(s.t('tip-net-tools')).toContain('ip a');
  });
});
