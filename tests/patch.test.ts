// « La Rustine », « Le cadenas » : Caddy et son HTTPS automatique. Rejoué
// dans chaque langue : la solution, une autre (une liste d'adresses, caddy
// reload, ufw allow http), et les fausses pistes.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { HISTOIRES } from '../src/engine/chapters';
import { prerequis } from '../src/engine/unlocking';
import { LANGUES } from '../src/texts';
import { formater, lireCaddyfile } from '../src/engine/caddy';
import { dansLaLangue, machinesDansLaLangue } from './names';

const EFFACEUR = HISTOIRES.find((h) => h.id === 'effaceur')!.chapitres.map((c) => c.id);
const AVANT = [...new Set([...EFFACEUR, ...prerequis('rustine')])];
const CADDYFILE = '/etc/caddy/Caddyfile';
const WWW = '\nwww.cycles.example {\n\tredir https://cycles.example{uri} permanent\n}\n';

describe('Le Caddyfile', () => {
  it('adresses, options globales, erreurs de Caddy', () => {
    const c = lireCaddyfile('{\n\temail admin@cycles.example\n}\n\ncycles.example, www.cycles.example {\n\troot * /srv\n\tfile_server\n}\n\n:8080 {\n\trespond "ok"\n}');
    expect(c.sites.map((s) => s.adresses.map((a) => `${a.hote}:${a.port}`))).toEqual([['cycles.example:443', 'www.cycles.example:443'], [':8080']]);
    expect(c.globales[0].args).toEqual(['admin@cycles.example']);
    expect(c.nonFormate).toBeNull();
    // Un seul site, sans accolades.
    expect(lireCaddyfile('cycles.example\nfile_server').sites[0].directives[0].nom).toBe('file_server');
    expect(() => lireCaddyfile('cycles.example {\n\tfile-server\n}')).toThrow('/etc/caddy/Caddyfile:2: unrecognized directive: file-server');
    expect(() => lireCaddyfile('{\n\temial x\n}')).toThrow('unrecognized global option: emial');
    expect(() => lireCaddyfile('cycles.example {\n\troot\n}')).toThrow("Wrong argument count or unexpected line ending after 'root'");
    expect(() => lireCaddyfile('cycles.example {\n\tfile_server\n')).toThrow('Unexpected EOF');
    expect(() => lireCaddyfile('}\n')).toThrow("Unexpected '}' because no matching opening brace");
    expect(() => lireCaddyfile('a.example {\n}\na.example {\n}')).toThrow('ambiguous site definition: a.example');
    expect(formater('a.example   {\n    root *   /srv\n\n\n  file_server\n}\n')).toBe('a.example {\n\troot * /srv\n\n\tfile_server\n}');
    expect(lireCaddyfile('a.example {\n    file_server\n}').nonFormate).toBe(2);
  });
});

for (const langue of LANGUES)
  describe(`Langue : ${langue}`, () => {
    const fr = langue === 'fr';
    const partie = () => {
      const c = new Console({ langue, termines: AVANT });
      const L = (l: string) => dansLaLangue(c.t, machinesDansLaLangue(c.t, l));
      const jouer = (lignes: string[]) =>
        lignes
          .map((l) => {
            let s = c.executer(L(l)) ?? '';
            if (c.shell.attente) s += c.executer(L('rayons-2027')) ?? '';
            return s;
          })
          .join('\n');
      const ecrire = (fichier: string, changer: (texte: string) => string) => {
        c.executer(`sudo nano ${fichier}`);
        if (c.shell.attente) c.executer(L('rayons-2027'));
        c.enregistrer(changer(c.edition!.texte));
        return c.quitterEdition();
      };
      jouer(['ssh rustine', 'yes']);
      expect(c.distant?.shell.chapitre.id).toBe('cadenas');
      return { c, jouer, ecrire, L };
    };

    it('solution : le nom du site, le pare-feu, puis www', () => {
      const { c, jouer, ecrire } = partie();
      let tout = jouer(['cat message_de_ines.txt', 'systemctl status caddy', 'curl -I http://localhost', 'curl https://cycles.example']);
      expect(tout).toContain('"msg":"server is listening only on the HTTP port, so no automatic HTTPS will be applied to this server"');
      expect(tout).toContain('HTTP/1.1 200 OK');
      expect(tout).toContain("curl: (7) Failed to connect to cycles.example port 443 after 0 ms: Couldn't connect to server");
      if (fr) expect(tout).toContain('par le nom du site');
      tout = ecrire(CADDYFILE, (t) => t.replace(':80 {', 'cycles.example {'));
      tout += jouer(['caddy validate --config /etc/caddy/Caddyfile', 'sudo systemctl reload caddy', 'journalctl -u caddy -n 8', 'curl https://cycles.example']);
      expect(tout).toContain('Valid configuration');
      expect(tout).toContain('203.0.113.40: Timeout during connect (likely firewall problem)');
      expect(tout).toContain('"msg":"will retry"');
      expect(tout).toContain('curl: (35) OpenSSL/3.5.1: error:0A000438:SSL routines::tlsv1 alert internal error');
      if (fr) expect(tout).toContain('ufw ne laisse entrer que ssh');
      tout = jouer(['sudo ufw status', 'sudo ufw allow 80/tcp', 'sudo ufw allow 443/tcp', 'journalctl -u caddy -n 3', 'curl -I http://cycles.example', 'curl https://cycles.example']);
      expect(tout).toContain('"msg":"certificate obtained successfully","identifier":"cycles.example"');
      expect(tout).toContain('HTTP/1.1 308 Permanent Redirect\nConnection: close\nLocation: https://cycles.example/');
      expect(tout).toContain(c.t('cadenas-site').split('\n')[0]);
      expect(tout).toContain(c.t('cadenas-site').split('\n').at(-1));
      if (fr) expect(tout).toContain('adresse des affiches');
      expect(c.termines).not.toContain('cadenas');
      tout = jouer(['curl https://www.cycles.example']);
      expect(tout).toContain('tlsv1 alert internal error');
      ecrire(CADDYFILE, (t) => `${t}\n${WWW}`);
      tout = jouer(['sudo systemctl reload caddy', 'curl -I https://www.cycles.example', 'sudo ls /var/lib/caddy/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory']);
      expect(tout).toContain('HTTP/2 301 \nalt-svc: h3=":443"; ma=2592000\nlocation: https://cycles.example/');
      expect(tout).toContain('cycles.example/  www.cycles.example/');
      if (fr) expect(tout).toContain('https://caddyserver.com/docs/automatic-https');
      expect(c.termines).toContain('cadenas');
    });

    it('autre solution : une liste d’adresses, ufw allow http et https, caddy reload', () => {
      const { c, jouer, ecrire } = partie();
      jouer(['sudo ufw allow http', 'sudo ufw allow https']);
      ecrire(CADDYFILE, (t) => t.replace(':80 {', 'cycles.example, www.cycles.example {'));
      let tout = jouer(['caddy reload --config /etc/caddy/Caddyfile', 'journalctl -u caddy | grep obtained', 'sudo ss -tlnp']);
      expect(tout).toContain('"identifier":"www.cycles.example"');
      expect(tout).toContain('*:443');
      tout = jouer(['curl https://www.cycles.example', 'caddy version', 'caddy adapt --config /etc/caddy/Caddyfile --pretty']);
      expect(tout).toContain(c.t('cadenas-site').split('\n')[0]);
      expect(tout).toContain('v2.10.2');
      expect(tout).toContain('"listen": [\n\t\t\t\t\t\t":443"\n\t\t\t\t\t]');
      expect(c.termines).toContain('cadenas');
    });

    it('fausses pistes : http://, une directive mal écrite, caddy run, le seul port 443, le format', () => {
      const { c, jouer, ecrire } = partie();
      let tout = jouer(['caddy reload', 'caddy run', 'caddy frobnicate', 'caddy validate --config /nulle/part']);
      expect(tout).toContain('Error: no config file to load');
      expect(tout).toContain('bind: address already in use');
      expect(tout).toContain('Error: unknown command "frobnicate" for "caddy"');
      expect(tout).toContain('Error: reading config from file: open /nulle/part: no such file or directory');
      // http:// : un site en HTTP seulement.
      tout = ecrire(CADDYFILE, (t) => t.replace(':80 {', 'http://cycles.example {'));
      tout += jouer(['sudo systemctl reload caddy']);
      if (fr) expect(tout).toContain('le nom seul suffit');
      // Une directive mal écrite : le rechargement échoue, Caddy garde l'ancienne configuration.
      ecrire(CADDYFILE, (t) => t.replace('http://cycles.example {', 'cycles.example {').replace('\tfile_server', '\tfile-server'));
      tout = jouer(['caddy validate --config /etc/caddy/Caddyfile', 'sudo systemctl reload caddy', 'journalctl -u caddy -n 3', 'systemctl is-active caddy']);
      expect(tout).toContain('Error: adapting config using caddyfile: /etc/caddy/Caddyfile:16: unrecognized directive: file-server');
      expect(tout).toContain('Job for caddy.service failed');
      expect(tout).toContain('active');
      // Le seul port 443 : Caddy a son certificat (TLS-ALPN), mais HTTP reste fermé dehors.
      ecrire(CADDYFILE, (t) => t.replace('\tfile-server', '    file_server'));
      tout = jouer(['sudo ufw allow 443/tcp', 'sudo systemctl reload caddy', 'caddy validate --config /etc/caddy/Caddyfile']);
      expect(tout).toContain("Caddyfile input is not formatted; run 'caddy fmt --overwrite' to fix inconsistencies");
      if (fr) expect(tout).toContain('un avertissement');
      tout = jouer(['caddy fmt --overwrite /etc/caddy/Caddyfile', 'sudo caddy fmt --overwrite /etc/caddy/Caddyfile', 'caddy validate --config /etc/caddy/Caddyfile']);
      expect(tout).toContain('Error: open /etc/caddy/Caddyfile: permission denied');
      expect(tout).not.toContain('not formatted');
      ecrire(CADDYFILE, (t) => `${t}\n${WWW}`);
      jouer(['sudo systemctl reload caddy', 'curl -I https://www.cycles.example']);
      expect(c.distant!.shell.drapeaux.has('certificat')).toBe(true);
      expect(c.termines).not.toContain('cadenas');
      jouer(['sudo ufw allow 80/tcp']);
      expect(c.termines).toContain('cadenas');
    });
  });
