# Embedding Sysadmin Quests in a website

— [Version française](INTEGRER.md)

The game is a standalone **web component**: a single JavaScript file, with no
dependency, no tracker and no request to the outside. It works in any HTML
page (static site, CMS, learning platform…).

## In two lines

```html
<script type="module" src="https://sysadmin.rouages.net/integration/quetes-de-sysadmin.js"></script>
<quetes-de-sysadmin></quetes-de-sysadmin>
```

To depend on no outside server, copy the file
`dist/integration/quetes-de-sysadmin.js` (after `npm run build`) to your site
and change the script's address.

The sysadmin.rouages.net server sends the `Access-Control-Allow-Origin: *`
header for this file (see `public/.htaccess`): a "module" script loaded from
another site requires it. If you host the file yourself on another domain
than your page, set the same header.

## Attributes

| Attribute | Values | Effect |
|---|---|---|
| `lang` | `en`, `fr` | the game's language; without it, the page's language (`lang` of a parent element), otherwise English; an unknown language gives English |
| `story` | a story's identifier: `eraser`, `datacenter`, `packet`, `time-machine`, `archives`… (the older French ids, `effaceur`, `paquet`…, still work) | the story opened at start, directly on its machine, even without its SSH key (without the attribute, you start from the workstation, or from the story in progress) |
| `save-key` | text | the save's key in `localStorage` (default `quetes-de-sysadmin`); change it to keep several games apart on one site |
| `theme` | `light`, `dark` | forces a theme (default: the system's) |

The story identifiers are still the French ones (they are internal names,
see CONTRIBUTING.md). The French attribute names used before still work:
`langue`, `histoire`, `cle`, and `theme="clair"` / `"sombre"`.

Example: a networking course that opens "The Lost Packet" directly:

```html
<quetes-de-sysadmin story="packet" save-key="networking-course" lang="en"></quetes-de-sysadmin>
```

## Colours

The game lives in a shadow root (Shadow DOM): its styles don't spill onto
the page, and the page's styles don't break it. To match your site, redefine
these CSS variables on the element. Without them, the game uses its
"machine room" theme: console light (phosphor green, amber LEDs) on a
charcoal background if the system is in dark mode, a "clean room" in light
mode.

```css
quetes-de-sysadmin {
  --qds-accent: #0b6e4f;
  --qds-ambre: #8a4f00;
  --qds-fond: #ffffff;
  --qds-carte: #f5f5f5;
  --qds-texte: #111111;
  --qds-discret: #555555;
  --qds-bord: #dddddd;
  --qds-terminal-fond: #101010;
  --qds-terminal-texte: #e0ffe0;
  --qds-terminal-invite: #ffcc66;
  --qds-police: system-ui, sans-serif;
  --qds-police-mono: ui-monospace, monospace;
}
```

`--qds-accent` colours the links, the buttons and the LEDs of finished
chapters; `--qds-ambre`, the LED of the next chapter to play and the
difficulty stars. Keep enough contrast (WCAG AA) between text and background.
(`ambre` is amber, `fond` background, `carte` card, `texte` text, `discret`
muted, `bord` border, `invite` prompt, `police` font.)

## Licence and credit

The code is under the **GPL v3 or later** and the texts under **CC BY-SA
4.0**: you may use, modify and redistribute it, provided you keep the same
licences and the credit shown under the game (the Sysadmin Quests project,
inspired by Terminus, created at MIT by Shawn Conrad and Michele
Pratusevich).

## Privacy

The game sends nothing: no data leaves the browser. Progress is kept in the
`localStorage` of the host page, under the chosen key.
