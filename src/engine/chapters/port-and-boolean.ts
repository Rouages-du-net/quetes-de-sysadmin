// Story "The Language Café", chapter "A Port and a Boolean": on Friday
// Tenzin added two virtual hosts and restarted httpd: the volunteers' rota
// on its own port, 8010, and the sign-up app behind a reverse proxy
// (ProxyPass to 127.0.0.1:8086). httpd hasn't started since: SELinux lets
// httpd_t bind only the ports typed http_port_t (8010 is
// unreserved_port_t), and once it binds, it may not connect to the app's
// port either (httpd_can_network_connect is off). And the rota must stay
// on the café's network.
// The fix: semanage port -a -t http_port_t -p tcp 8010, a restart;
// setsebool -P httpd_can_network_connect on; a rich rule for 8010 from
// 198.51.100.0/24, at runtime and permanently.
// Objective checked on the state: httpd up and enabled; the site and the
// sign-up app answer 200 to anyone, the rota to the café's network only,
// now and after a reboot (the permanent firewall, the saved booleans, the
// port's type); SELinux enforcing; nis_enabled off; no custom module.
// False leads: setsebool without -P, audit2why's nis_enabled (every
// NSS-using program on every unreserved port), Tenzin's audit2allow module,
// 8086 typed http_port_t (httpd still may not connect to it: that needs a
// boolean too), --add-port=8010/tcp (the rota open to the internet).
// Sources: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/using_selinux/configuring-selinux-for-applications-and-services-with-non-standard-configurations_using-selinux,
// semanage-port(8), setsebool(8), httpd_selinux(8), firewalld.richlanguage(5).

import type { Chapter } from '../world';
import { f } from '../world';
import type { Game } from '../shell';
import { httpdAllows } from '../selinux';
import {
  APP_PORT, HOME, KETTLE, PASSWORD, SIGNUP, SIGNUP_MARK, SITE, ROTA_MARK, VOLUNTEERS_PORT, bodyFor, boolNow, boolSaved, customModules, enforcing, enforcingAtBoot, httpdEnabled, httpdUp, initialiseKettle, kettle, kettleAccounts, kettleState, kettleWorld,
  noticeboardHost, openToAll, openToOffice, passTime, portTypeOf, reach, seen,
} from './language-cafe';

const allowsAfterBoot = (j: Game) =>
  httpdAllows(kettle(j), portTypeOf(j, APP_PORT), 'tcp_socket', 'name_connect', true) && httpdAllows(kettle(j), portTypeOf(j, VOLUNTEERS_PORT), 'tcp_socket', 'name_bind', true);
const rotaRight = (j: Game, config: 'runtime' | 'permanent') => openToOffice(j, VOLUNTEERS_PORT, config) && !openToAll(j, VOLUNTEERS_PORT, config);
const served = (j: Game, config: 'runtime' | 'permanent' = 'runtime') =>
  reach(j, 'internet', SITE, 80, '/', config) === 200 &&
  reach(j, 'internet', SIGNUP, 80, '/', config) === 200 &&
  bodyFor(j, SIGNUP, 80).includes(SIGNUP_MARK) &&
  reach(j, 'office', KETTLE, VOLUNTEERS_PORT, '/', config) === 200 &&
  bodyFor(j, KETTLE, VOLUNTEERS_PORT).includes(ROTA_MARK) &&
  reach(j, 'internet', KETTLE, VOLUNTEERS_PORT, '/', config) === 0;

export const portAndBoolean: Chapter = {
  id: 'port-and-boolean',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'systemctl', 'journalctl', 'ss', 'curl', 'ssh', 'exit', 'dnf', 'rpm', 'firewall-cmd', 'getenforce', 'setenforce', 'getsebool', 'setsebool', 'semanage', 'ausearch', 'audit2why', 'audit2allow', 'semodule', 'restorecon', 'chcon'],
  home: HOME,
  welcome: 'message_from_dilnoza.txt',
  names: true,
  final: 'end',
  steps: ['down', 'bind-avc', 'port', 'up', 'proxy-503', 'connect-avc', 'boolean', 'rota-office', 'end'],
  password: PASSWORD,
  accounts: kettleAccounts(3),
  state: (t) => kettleState(t, 3),
  initialise: (j) => initialiseKettle(j, 3),
  hosts: { noticeboard: noticeboardHost() },
  createWorld: (t) =>
    kettleWorld(t, 3, {
      'message_from_dilnoza.txt': f(t('port-and-boolean-message-dilnoza')),
      'notes_from_tenzin.txt': f(t('port-and-boolean-notes-tenzin')),
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'down', condition: (j) => seen(j, 'AH00072') || seen(j, 'Failed to start httpd.service') || seen(j, 'failed (Result: exit-code)'), message: (j) => j.t('port-and-boolean-event-down') },
    { id: 'bind-avc', condition: (j) => seen(j, 'name_bind'), message: (j) => j.t('port-and-boolean-event-bind-avc') },
    { id: 'nis', condition: (j) => boolNow(j, 'nis_enabled') || boolSaved(j, 'nis_enabled'), message: (j) => j.t('port-and-boolean-event-nis') },
    { id: 'module', condition: customModules, message: (j) => j.t('port-and-boolean-event-module') },
    { id: 'port', condition: (j) => ['http_port_t', 'http_cache_port_t'].includes(portTypeOf(j, VOLUNTEERS_PORT)), message: (j) => j.t('port-and-boolean-event-port') },
    { id: 'up', condition: httpdUp, message: (j) => j.t('port-and-boolean-event-up') },
    { id: 'proxy-503', condition: (j) => seen(j, '503 Service Unavailable') || seen(j, 'AH01114'), message: (j) => j.t('port-and-boolean-event-proxy-503') },
    { id: 'connect-avc', condition: (j) => seen(j, 'name_connect'), message: (j) => j.t('port-and-boolean-event-connect-avc') },
    { id: 'label-8086', condition: (j) => portTypeOf(j, APP_PORT) === 'http_port_t' && !boolNow(j, 'httpd_can_network_connect'), message: (j) => j.t('port-and-boolean-event-label-8086') },
    { id: 'boolean-runtime', condition: (j) => boolNow(j, 'httpd_can_network_connect') && !boolSaved(j, 'httpd_can_network_connect'), message: (j) => j.t('port-and-boolean-event-boolean-runtime') },
    { id: 'boolean', condition: (j) => boolSaved(j, 'httpd_can_network_connect') && boolNow(j, 'httpd_can_network_connect'), message: (j) => j.t('port-and-boolean-event-boolean') },
    { id: 'open-to-all', condition: (j) => openToAll(j, VOLUNTEERS_PORT, 'runtime') || openToAll(j, VOLUNTEERS_PORT, 'permanent'), message: (j) => j.t('port-and-boolean-event-open-to-all') },
    { id: 'rota-office', condition: (j) => rotaRight(j, 'runtime') || rotaRight(j, 'permanent'), message: (j) => j.t('port-and-boolean-event-rota-office') },
    {
      id: 'end',
      condition: (j) =>
        enforcing(j) &&
        enforcingAtBoot(j) &&
        httpdUp(j) &&
        httpdEnabled(j) &&
        served(j) &&
        served(j, 'permanent') &&
        allowsAfterBoot(j) &&
        !boolNow(j, 'nis_enabled') &&
        !boolSaved(j, 'nis_enabled') &&
        !customModules(j),
      message: (j) => j.t('port-and-boolean-event-end'),
    },
  ],
};
