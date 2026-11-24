// Story "The Language Café", chapter "Permission Denied, But…": Itzel moved
// the new site from her home to /srv/site with mv, pointed httpd at it, and
// the café's screen shows Rocky's test page: httpd gets 403. The Unix rights
// are fine; the files kept their home's SELinux label (user_home_t), which
// httpd_t may not read, and /srv/site is var_t in the policy anyway.
// The fix: teach the policy (semanage fcontext -a -t httpd_sys_content_t
// "/srv/site(/.*)?", or an equivalence with /var/www), then restorecon -Rv;
// semanage and audit2why come with policycoreutils-python-utils (dnf provides).
// Objective checked on the state: SELinux enforcing (now and at boot);
// httpd up and enabled; the site's home page and its stylesheet served to
// the noticeboard; every file of the site's root readable by httpd now and
// as the policy labels it (a relabel would change nothing that matters);
// no world-writable file there; httpd_read_user_content off; no custom
// module for httpd.
// False leads: setenforce 0 (or SELINUX=permissive), chmod 777, chcon alone
// (Kaveh's reboot for the kernel update relabels the disk: /.autorelabel),
// restorecon before semanage (var_t), httpd_read_user_content, an
// audit2allow module.
// Sources: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/using_selinux/troubleshooting-problems-related-to-selinux_using-selinux,
// semanage-fcontext(8), restorecon(8), https://docs.rockylinux.org/guides/security/learning_selinux/

import type { Chapter } from '../world';
import { f } from '../world';
import type { Game, Shell } from '../shell';
import { walk } from '../selinux';
import { httpd } from '../httpd-rhel';
import { typeOf } from '../rhel';
import {
  DOCROOT, HOME, PASSWORD, SITE, SITE_MARK, bodyFor, boolNow, boolSaved, customModules, enforcing, enforcingAtBoot, httpdEnabled, httpdUp, initialiseKettle, installed, kettle, kettleAccounts, kettleState, kettleWorld, labelsHold, noticeboardHost, passTime, reach, rebootKettle, seen, story,
} from './language-cafe';

/** The root httpd serves the café's site from (its virtual host's DocumentRoot). */
export const siteRoot = (j: Game): string => {
  const conf = httpd(kettle(j))?.loaded;
  return conf?.vhosts.find((v) => v.port === 80 && v.names.includes(SITE))?.root ?? conf?.main.root ?? DOCROOT;
};
const worldWritable = (j: Game) => {
  const n = kettle(j).find(siteRoot(j));
  let found = false;
  if (n) walk(n, siteRoot(j), (m) => void ((m.mode ?? '').charAt(7) === 'w' && (found = true)));
  return found;
};
const works = (j: Game) => reach(j, 'office', SITE, 80) === 200 && bodyFor(j, SITE, 80).includes(SITE_MARK) && reach(j, 'office', SITE, 80, '/css/style.css') === 200;
const types = (j: Game) => {
  const out = new Set<string>();
  const n = kettle(j).find(DOCROOT);
  if (n) walk(n, DOCROOT, (m, p) => p !== DOCROOT && out.add(typeOf(m.context)));
  return out;
};
const ruleFor = (j: Game) => labelsHold(j, siteRoot(j)).afterRelabel;

export const wrongLabel: Chapter = {
  id: 'wrong-label',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'systemctl', 'journalctl', 'curl', 'ssh', 'exit', 'ps', 'id', 'mv', 'cp', 'chmod', 'find', 'dnf', 'rpm', 'getenforce', 'setenforce', 'sestatus', 'getsebool', 'setsebool', 'chcon', 'restorecon', 'semanage', 'ausearch', 'audit2why', 'audit2allow', 'semodule'],
  home: HOME,
  welcome: 'message_from_thuy.txt',
  names: true,
  final: 'end',
  steps: ['test-page', 'error-log', 'labels', 'avc', 'tools-missing', 'tools', 'rule', 'relabelled', 'end'],
  password: PASSWORD,
  accounts: kettleAccounts(2),
  state: (t) => kettleState(t, 2),
  initialise: (j) => initialiseKettle(j, 2),
  hosts: { noticeboard: noticeboardHost() },
  createWorld: (t) =>
    kettleWorld(t, 2, {
      'message_from_thuy.txt': f(t('wrong-label-message-thuy')),
      'message_from_itzel.txt': f(t('wrong-label-message-itzel')),
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'test-page', condition: (j) => seen(j, 'HTTP Server Test Page') || seen(j, '403 Forbidden'), message: (j) => j.t('wrong-label-event-test-page') },
    { id: 'error-log', condition: (j) => seen(j, 'AH00132') || seen(j, 'AH00035'), message: (j) => j.t('wrong-label-event-error-log') },
    { id: 'labels', condition: (j) => seen(j, ':user_home_t:'), message: (j) => j.t('wrong-label-event-labels') },
    { id: 'avc', condition: (j) => seen(j, 'avc:  denied'), message: (j) => j.t('wrong-label-event-avc') },
    { id: 'tools-missing', condition: (j) => seen(j, /-bash: (semanage|audit2why|audit2allow): command not found/), message: (j) => j.t('wrong-label-event-tools-missing') },
    { id: 'tools', condition: (j) => installed(j, 'policycoreutils-python-utils'), message: (j) => j.t('wrong-label-event-tools') },
    { id: 'permissive', condition: (j) => !enforcing(j), message: (j) => j.t('wrong-label-event-permissive') },
    { id: 'config-off', condition: (j) => !enforcingAtBoot(j), message: (j) => j.t('wrong-label-event-config-off') },
    { id: 'chmod', condition: worldWritable, message: (j) => j.t('wrong-label-event-chmod') },
    { id: 'home-boolean', condition: (j) => boolNow(j, 'httpd_read_user_content') || boolSaved(j, 'httpd_read_user_content'), message: (j) => j.t('wrong-label-event-home-boolean') },
    { id: 'module', condition: customModules, message: (j) => j.t('wrong-label-event-module') },
    { id: 'var-t', condition: (j) => types(j).has('var_t') && !ruleFor(j), message: (j) => j.t('wrong-label-event-var-t') },
    { id: 'rule', condition: ruleFor, message: (j) => j.t('wrong-label-event-rule') },
    {
      // The site works with labels the policy doesn't give (chcon): Kaveh's reboot for the kernel update comes, and /.autorelabel with it.
      id: 'relabelled',
      condition: (j) => enforcing(j) && works(j) && !ruleFor(j) && !boolNow(j, 'httpd_read_user_content') && !customModules(j),
      action: (j) => rebootKettle(j),
      message: (j) => j.t(story(j).relabelled ? 'wrong-label-event-relabelled' : 'wrong-label-event-rebooted'),
    },
    {
      id: 'end',
      condition: (j) =>
        enforcing(j) &&
        enforcingAtBoot(j) &&
        httpdUp(j) &&
        httpdEnabled(j) &&
        works(j) &&
        labelsHold(j, siteRoot(j)).now &&
        labelsHold(j, siteRoot(j)).afterRelabel &&
        !worldWritable(j) &&
        !boolNow(j, 'httpd_read_user_content') &&
        !boolSaved(j, 'httpd_read_user_content') &&
        !customModules(j),
      message: (j) => j.t('wrong-label-event-end'),
    },
  ],
};

/** For tests: the label of a path on kettle. */
export const labelOf = (j: Game, path: string) => (kettle(j) as Shell).find(path)?.context;
