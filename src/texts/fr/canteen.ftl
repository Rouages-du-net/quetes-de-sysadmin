### Ce que partagent les chapitres de « La Cantine » : la description de
### l'unité de l'appli, sa page et son code (Node.js). Les chemins, les
### noms d'unités et les messages de systemd ne se traduisent pas.

canteen-menu-description = Menu et réservations de la cantine (Node.js)

canteen-menu-page =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>La Cantine — le menu du jour</title></head>
    <body>
    <h1>La Cantine</h1>
    <p>Aujourd'hui : soupe de lentilles, couscous aux légumes, crumble aux pommes.</p>
    <p>Prix libre. Réservez votre place avant 11 h.</p>
    </body>
    </html>

canteen-server-js =
    // Le menu et les réservations de la Cantine : une petite appli Express.
    const express = require('express');
    const {"{"} Pool {"}"} = require('pg');

    const db = new Pool({"{"} connectionString: process.env.DATABASE_URL {"}"});
    const app = express();

    app.get('/', async (req, res) => {"{"}
      const {"{"} rows {"}"} = await db.query('SELECT plat FROM menu WHERE jour = CURRENT_DATE');
      res.send(page(rows));
    {"}"});

    // L'appli a besoin de sa base : sans elle, elle s'arrête.
    db.connect()
      {"."}then(() => app.listen(Number(process.env.PORT), '127.0.0.1'))
      {"."}catch((err) => {"{"} console.error(err); process.exit(1); {"}"});
    db.on('error', (err) => {"{"} console.error(err); process.exit(1); {"}"});
