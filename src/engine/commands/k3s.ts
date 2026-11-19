// k3s, the single binary of a lightweight Kubernetes (https://docs.k3s.io/):
// `k3s kubectl` (the same kubectl), `k3s --version`, `k3s check-config`
// (a short summary); and base64 (GNU coreutils: encode, -d, -w), which a
// Secret's values need.
// Sources: https://docs.k3s.io/cli, https://docs.k3s.io/cli/kubectl,
// https://www.gnu.org/software/coreutils/manual/html_node/base64-invocation.html.

import type { Command } from './index';
import { kubectl } from './kubectl';
import { K3S_VERSION, base64Decode, base64Encode } from '../k8s';

export const K3S: Record<string, Command> = {
  k3s: {
    ownOptions: true,
    section: 1,
    launch: ({ args, game, input, last }) => {
      const [sub, ...rest] = args;
      if (sub === '--version' || sub === '-v' || sub === 'version') return `k3s version ${K3S_VERSION} (6ab750f9)\ngo version go1.22.12`;
      if (sub === 'kubectl') return kubectl(game, rest, input, last);
      if (sub === 'check-config')
        return [
          '',
          'Verifying binaries in /var/lib/rancher/k3s/data/current/bin:',
          '- sha256sum: good',
          '- links: good',
          '',
          'System:',
          '- /usr/sbin iptables v1.8.11 (nf_tables): ok',
          '- swap: disabled',
          '- routes: ok',
          '',
          'Limits:',
          '- /proc/sys/kernel/keys/root_maxkeys: 1000000',
          '',
          'info: reading kernel config from /proc/config.gz ...',
          '',
          'Generally Necessary:',
          '- cgroup hierarchy: cgroups V2 mounted, cpu|cpuset|memory controllers status: good',
          '- CONFIG_NAMESPACES: enabled',
          '- CONFIG_NET_NS: enabled',
          '- CONFIG_CGROUPS: enabled',
          '- CONFIG_OVERLAY_FS: enabled',
          '',
          'STATUS: pass',
        ].join('\n');
      if (sub === 'server' || sub === 'agent')
        return game.error(`time="${new Date(0).toISOString()}" level=fatal msg="Error: preparing server: failed to start k3s: k3s is already running (see systemctl status k3s)"`.replace(/"1970[^"]*"/, '"now"'), 1);
      if (!sub)
        return 'NAME:\n   k3s - Kubernetes, but small and simple\n\nUSAGE:\n   k3s [global options] command [command options] [arguments...]\n\nVERSION:\n   ' + K3S_VERSION + ' (6ab750f9)\n\nCOMMANDS:\n   server        Run management server\n   agent         Run node agent\n   kubectl       Run kubectl\n   crictl        Run crictl\n   ctr           Run ctr\n   check-config  Run config check\n   etcd-snapshot\n   secrets-encrypt   Control secrets encryption and keys rotation\n   certificate   Manage K3s certificates\n   completion    Install shell completion script\n   help, h       Shows a list of commands or help for one command';
      return game.error(`${game.t('k3s-not-simulated', { command: sub })}`, 1);
    },
  },
  base64: {
    ownOptions: true,
    launch: ({ args, game, input }) => {
      let decode = false;
      let wrap = 76;
      const files: string[] = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-d' || a === '--decode') decode = true;
        else if (a === '-w' || a === '--wrap') wrap = Number(args[++i] ?? 76);
        else if (a.startsWith('--wrap=')) wrap = Number(a.slice(7));
        else if (/^-w\d+$/.test(a)) wrap = Number(a.slice(2));
        else if (a === '-i' || a === '--ignore-garbage') continue;
        else if (a.startsWith('-') && a !== '-') return game.error(`base64: invalid option -- '${a.replace(/^-+/, '')[0]}'\nTry 'base64 --help' for more information.`, 1);
        else files.push(a);
      }
      if (files.length > 1) return game.error(`base64: extra operand '${files[1]}'\nTry 'base64 --help' for more information.`, 1);
      let text: string | null = input ?? '';
      if (files.length && files[0] !== '-') {
        text = game.readFor('base64', files[0]);
        if (text === null) return '';
        text += '\n';
      }
      if (decode) {
        const clean = text.replace(/\s/g, '');
        const v = base64Decode(clean);
        if (v === null) return game.error('base64: invalid input', 1);
        return v.replace(/\n$/, '');
      }
      // A pipe's input ends with its newline (echo adds one, not echo -n): it is encoded too, like the real one.
      const noNewline = /\becho\s+-n\b[^|]*\|\s*base64\b/.test(game.commandLine);
      const enc = base64Encode(input !== null && !files.length && !noNewline ? text + (text.endsWith('\n') ? '' : '\n') : text);
      if (!wrap) return enc;
      return enc.match(new RegExp(`.{1,${wrap}}`, 'g'))?.join('\n') ?? '';
    },
  },
};
