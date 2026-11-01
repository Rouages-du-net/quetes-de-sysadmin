// /etc/apache2 as Debian's apache2 package installs it (abridged: the
// comments of apache2.conf are shortened, and only a few modules of
// mods-available are there). Based on the package's files:
// https://salsa.debian.org/apache-team/apache2/-/tree/master/debian/config-dir
// The texts are those of the real files, in English.

import { d, f, type Directory } from './world';

const root = { owner: 'root' };
const file = (text: string) => f(text, { lines: true, owner: 'root' });
const place = (children: Parameters<typeof d>[0]) => d(children, undefined, root);
const link = (target: string) => f('', { owner: 'root', link: target });

export const APACHE2_CONF = `# This is the main Apache server configuration file.  It contains the
# configuration directives that give the server its instructions.
# See http://httpd.apache.org/docs/2.4/ for detailed information about
# the directives and /usr/share/doc/apache2/README.Debian about Debian specific
# hints.
#
# Summary of how the Apache 2 configuration works in Debian:
# The Apache 2 web server configuration in Debian is quite different to
# upstream's suggested way to configure the web server. This is because Debian's
# default Apache2 installation attempts to make adding and removing modules,
# virtual hosts, and extra configuration directives as flexible as possible, in
# order to make automating the changes and administering the server as easy as
# possible.
#
#	/etc/apache2/
#	|-- apache2.conf
#	|	\`--  ports.conf
#	|-- mods-enabled
#	|	|-- *.load
#	|	\`-- *.conf
#	|-- conf-enabled
#	|	\`-- *.conf
#	\`-- sites-enabled
#		\`-- *.conf
#
# * Configuration files in the mods-enabled/, conf-enabled/ and sites-enabled/
#   directories contain particular configuration snippets which manage modules,
#   global configuration fragments, or virtual host configurations,
#   respectively.
#
#   They are activated by symlinking available configuration files from their
#   respective *-available/ counterparts. These should be managed by using our
#   helpers a2enmod/a2dismod, a2ensite/a2dissite and a2enconf/a2disconf. See
#   their respective man pages for detailed information.

DefaultRuntimeDir \${APACHE_RUN_DIR}
PidFile \${APACHE_PID_FILE}
Timeout 300
KeepAlive On
MaxKeepAliveRequests 100
KeepAliveTimeout 5

# These need to be set in /etc/apache2/envvars
User \${APACHE_RUN_USER}
Group \${APACHE_RUN_GROUP}

HostnameLookups Off

# ErrorLog: The location of the error log file.
# If you do not specify an ErrorLog directive within a <VirtualHost>
# container, error messages relating to that virtual host will be
# logged here.
ErrorLog \${APACHE_LOG_DIR}/error.log

LogLevel warn

# Include module configuration:
IncludeOptional mods-enabled/*.load
IncludeOptional mods-enabled/*.conf

# Include list of ports to listen on
Include ports.conf

# Sets the default security model of the Apache2 HTTPD server. It does
# not allow access to the root filesystem outside of /usr/share and /var/www.
# The former is used by web applications packaged in Debian,
# the latter may be used for local directories served by the web server. If
# your system is serving content from a sub-directory in /srv you must allow
# access here, or in any related virtual host.
<Directory />
	Options FollowSymLinks
	AllowOverride None
	Require all denied
</Directory>

<Directory /usr/share>
	AllowOverride None
	Require all granted
</Directory>

<Directory /var/www/>
	Options Indexes FollowSymLinks
	AllowOverride None
	Require all granted
</Directory>

# AccessFileName: The name of the file to look for in each directory
# for additional configuration directives.  See also the AllowOverride
# directive.
AccessFileName .htaccess

# The following lines prevent .htaccess and .htpasswd files from being
# viewed by Web clients.
<FilesMatch "^\\.ht">
	Require all denied
</FilesMatch>

LogFormat "%v:%p %h %l %u %t \\"%r\\" %>s %O \\"%{Referer}i\\" \\"%{User-Agent}i\\"" vhost_combined
LogFormat "%h %l %u %t \\"%r\\" %>s %O \\"%{Referer}i\\" \\"%{User-Agent}i\\"" combined
LogFormat "%h %l %u %t \\"%r\\" %>s %O" common
LogFormat "%{Referer}i -> %U" referer
LogFormat "%{User-agent}i" agent

# Include of directories ignores editors' and dpkg's backup files,
# see README.Debian for details.

# Include generic snippets of statements
IncludeOptional conf-enabled/*.conf

# Include the virtual host configurations:
IncludeOptional sites-enabled/*.conf`;

export const PORTS_CONF = `# If you just change the port or add more ports here, you will likely also
# have to change the VirtualHost statement in
# /etc/apache2/sites-enabled/000-default.conf

Listen 80

<IfModule ssl_module>
	Listen 443
</IfModule>

<IfModule mod_gnutls.c>
	Listen 443
</IfModule>`;

export const CONF_DEFAULT = `<VirtualHost *:80>
	# The ServerName directive sets the request scheme, hostname and port that
	# the server uses to identify itself. This is used when creating
	# redirection URLs. In the context of virtual hosts, the ServerName
	# specifies what hostname must appear in the request's Host: header to
	# match this virtual host. For the default virtual host (this file) this
	# value is not decisive as it is used as a last resort host regardless.
	# However, you must set it for any further virtual host explicitly.
	#ServerName www.example.com

	ServerAdmin webmaster@localhost
	DocumentRoot /var/www/html

	# Available loglevels: trace8, ..., trace1, debug, info, notice, warn,
	# error, crit, alert, emerg.
	# It is also possible to configure the loglevel for particular
	# modules, e.g.
	#LogLevel info ssl:warn

	ErrorLog \${APACHE_LOG_DIR}/error.log
	CustomLog \${APACHE_LOG_DIR}/access.log combined

	# For most configuration files from conf-available/, which are
	# enabled or disabled at a global level, it is possible to
	# include a line for only one particular virtual host. For example the
	# following line enables the CGI configuration for this host only
	# after it has been globally disabled with "a2disconf".
	#Include conf-available/serve-cgi-bin.conf
</VirtualHost>`;

const CONF_SSL_DEFAULT = `<VirtualHost *:443>
	ServerAdmin webmaster@localhost

	DocumentRoot /var/www/html

	ErrorLog \${APACHE_LOG_DIR}/error.log
	CustomLog \${APACHE_LOG_DIR}/access.log combined

	#   SSL Engine Switch:
	#   Enable/Disable SSL for this virtual host.
	SSLEngine on

	SSLCertificateFile      /etc/ssl/certs/ssl-cert-snakeoil.pem
	SSLCertificateKeyFile   /etc/ssl/private/ssl-cert-snakeoil.key
</VirtualHost>`;

const SECURITY_CONF = `# Changing the following options will not really affect the security of the
# server, but might make attacks slightly more difficult in some cases.

#
# ServerTokens
# This directive configures what you return as the Server HTTP response
# Header. The default is 'Full' which sends information about the OS-Type
# and compiled in modules.
# Set to one of:  Full | OS | Minimal | Minor | Major | Prod
# where Full conveys the most information, and Prod the least.
#ServerTokens Minimal
ServerTokens OS
#ServerTokens Full

#
# Optionally add a line containing the server version and virtual host
# name to server-generated pages (internal error documents, FTP directory
# listings, mod_status and mod_info output etc., but not CGI generated
# documents or custom error documents).
# Set to "EMail" to also include a mailto: link to the ServerAdmin.
# Set to one of:  On | Off | EMail
#ServerSignature Off
ServerSignature On

#
# Allow TRACE method
#
# Set to "extended" to also reflect the request body (only for testing and
# diagnostic purposes).
#
# Set to one of:  On | Off | extended
TraceEnable Off`;

const OTHER_CONF_HOSTS = `# Define an access log for VirtualHosts that don't define their own logfile
CustomLog \${APACHE_LOG_DIR}/other_vhosts_access.log vhost_combined`;

const CHARSET_CONF = `# Read the documentation before enabling AddDefaultCharset.
# In general, it is only a good idea if you know that all your files
# have this encoding. It will override any encoding given in the files
# in meta http-equiv or xml encoding tags.

#AddDefaultCharset UTF-8`;

const DIR_CONF = `<IfModule mod_dir.c>
	DirectoryIndex index.html index.cgi index.pl index.php index.xhtml index.htm
</IfModule>`;

const MIME_CONF = `<IfModule mod_mime.c>
	#
	# TypesConfig points to the file containing the list of mappings from
	# filename extension to MIME-type.
	#
	TypesConfig /etc/mime.types

	AddType application/x-compress .Z
	AddType application/x-gzip .gz .tgz
	AddType application/x-bzip2 .bz2

	AddLanguage fr .fr
	AddLanguage en .en

	AddCharset us-ascii	.ascii .us-ascii
	AddCharset ISO-8859-1  .iso8859-1  .latin1
	AddCharset UTF-8	   .utf8
</IfModule>`;

const MPM_EVENT_CONF = `# event MPM
# StartServers: initial number of server processes to start
# MinSpareThreads: minimum number of worker threads which are kept spare
# MaxSpareThreads: maximum number of worker threads which are kept spare
# ThreadsPerChild: constant number of worker threads in each server process
# MaxRequestWorkers: maximum number of worker threads
# MaxConnectionsPerChild: maximum number of requests a server process serves
StartServers			 2
MinSpareThreads		 25
MaxSpareThreads		 75
ThreadLimit			 64
ThreadsPerChild		 25
MaxRequestWorkers	  150
MaxConnectionsPerChild   0`;

// The modules enabled by the package, then a few others from mods-available.
export const ACTIVE_MODULES = [
  'access_compat',
  'alias',
  'auth_basic',
  'authn_core',
  'authn_file',
  'authz_core',
  'authz_host',
  'authz_user',
  'autoindex',
  'deflate',
  'dir',
  'env',
  'filter',
  'mime',
  'mpm_event',
  'negotiation',
  'reqtimeout',
  'setenvif',
  'status',
];
const OTHER_MODULES = ['expires', 'headers', 'proxy', 'proxy_http', 'rewrite', 'socache_shmcb', 'ssl', 'userdir'];
const CONFS_MODULES: Record<string, string> = { dir: DIR_CONF, mime: MIME_CONF, mpm_event: MPM_EVENT_CONF };

/** /etc/apache2, plus `sites` in sites-available; `active`: the enabled modules. */
export function etcApache2(sitesInMore: Record<string, string> = {}, activeSites: Record<string, string> = { '000-default.conf': '../sites-available/000-default.conf' }, active = ACTIVE_MODULES): Directory {
  const all = [...ACTIVE_MODULES, ...OTHER_MODULES].sort();
  const available: Record<string, ReturnType<typeof f>> = {};
  for (const m of all) {
    available[`${m}.load`] = file(`LoadModule ${m}_module /usr/lib/apache2/modules/mod_${m}.so`);
    if (CONFS_MODULES[m]) available[`${m}.conf`] = file(CONFS_MODULES[m]);
  }
  const inService: Record<string, ReturnType<typeof f>> = {};
  for (const m of active) {
    inService[`${m}.load`] = link(`../mods-available/${m}.load`);
    if (CONFS_MODULES[m]) inService[`${m}.conf`] = link(`../mods-available/${m}.conf`);
  }
  return place({
    'apache2.conf': file(APACHE2_CONF),
    'ports.conf': file(PORTS_CONF),
    envvars: file(
      '# envvars - default environment variables for apache2ctl\n\nexport APACHE_RUN_USER=www-data\nexport APACHE_RUN_GROUP=www-data\nexport APACHE_PID_FILE=/var/run/apache2$SUFFIX/apache2.pid\nexport APACHE_RUN_DIR=/var/run/apache2$SUFFIX\nexport APACHE_LOCK_DIR=/var/lock/apache2$SUFFIX\nexport APACHE_LOG_DIR=/var/log/apache2$SUFFIX',
    ),
    'mods-available': place(available),
    'mods-enabled': place(inService),
    'conf-available': place({
      'charset.conf': file(CHARSET_CONF),
      'other-vhosts-access-log.conf': file(OTHER_CONF_HOSTS),
      'security.conf': file(SECURITY_CONF),
    }),
    'conf-enabled': place({
      'charset.conf': link('../conf-available/charset.conf'),
      'other-vhosts-access-log.conf': link('../conf-available/other-vhosts-access-log.conf'),
      'security.conf': link('../conf-available/security.conf'),
    }),
    'sites-available': place({ '000-default.conf': file(CONF_DEFAULT), 'default-ssl.conf': file(CONF_SSL_DEFAULT), ...Object.fromEntries(Object.entries(sitesInMore).map(([n, t]) => [n, file(t)])) }),
    'sites-enabled': place(Object.fromEntries(Object.entries(activeSites).map(([n, c]) => [n, link(c)]))),
  });
}

/** /usr/lib/apache2/modules: one .so file per module (LoadModule opens them). */
export function modulesApache2(): Directory {
  const all = [...ACTIVE_MODULES, ...OTHER_MODULES].sort();
  return place({ modules: place(Object.fromEntries(all.map((m) => [`mod_${m}.so`, f('', { owner: 'root', size: 30_000 + m.length * 1_000 })]))) });
}

// The package's welcome page (abridged), in English like the real one.
export const APACHE_WELCOME = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>Apache2 Debian Default Page: It works</title>
  </head>
  <body>
    <h1>Apache2 Debian Default Page</h1>
    <p>It works!</p>
    <p>This is the default welcome page used to test the correct operation of the Apache2 server after
    installation on Debian systems. If you can read this page, it means that the Apache HTTP server
    installed at this site is working properly. You should <b>replace this file</b> (located at
    <tt>/var/www/html/index.html</tt>) before continuing to operate your HTTP server.</p>
  </body>
</html>`;
