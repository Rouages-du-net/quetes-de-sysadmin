### Was die Kapitel von „Die Kantine“ teilen: die Beschreibung der Unit
### der App, ihre Seite und ihr Code (Node.js). Pfade, Unit-Namen und die
### Meldungen von systemd werden nicht übersetzt.

canteen-menu-description = Speiseplan und Reservierungen der Kantine (Node.js)

canteen-menu-page =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Die Kantine — heute auf dem Speiseplan</title></head>
    <body>
    <h1>Die Kantine</h1>
    <p>Heute: Linsensuppe, Gemüsecouscous, Apfelcrumble.</p>
    <p>Zahl, was du kannst. Reservier deinen Platz vor 11 Uhr.</p>
    </body>
    </html>

canteen-server-js =
    // Speiseplan und Reservierungen der Kantine: eine kleine Express-App.
    const express = require('express');
    const {"{"} Pool {"}"} = require('pg');

    const db = new Pool({"{"} connectionString: process.env.DATABASE_URL {"}"});
    const app = express();

    app.get('/', async (req, res) => {"{"}
      const {"{"} rows {"}"} = await db.query('SELECT dish FROM menu WHERE day = CURRENT_DATE');
      res.send(page(rows));
    {"}"});

    // Die App braucht ihre Datenbank: Ohne sie beendet sie sich.
    db.connect()
      {"."}then(() => app.listen(Number(process.env.PORT), '127.0.0.1'))
      {"."}catch((err) => {"{"} console.error(err); process.exit(1); {"}"});
    db.on('error', (err) => {"{"} console.error(err); process.exit(1); {"}"});
