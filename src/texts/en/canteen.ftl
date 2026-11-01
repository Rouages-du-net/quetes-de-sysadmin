### What the chapters of "The Canteen" share: the app's unit description,
### its page and its code (Node.js). Paths, unit names and systemd's
### messages are not translated.

canteen-menu-description = Canteen menu and bookings (Node.js)

canteen-menu-page =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>The Canteen — today's menu</title></head>
    <body>
    <h1>The Canteen</h1>
    <p>Today: lentil soup, vegetable couscous, apple crumble.</p>
    <p>Pay what you can. Book your seat before 11 am.</p>
    </body>
    </html>

canteen-server-js =
    // The Canteen's menu and bookings: a small Express app.
    const express = require('express');
    const {"{"} Pool {"}"} = require('pg');

    const db = new Pool({"{"} connectionString: process.env.DATABASE_URL {"}"});
    const app = express();

    app.get('/', async (req, res) => {"{"}
      const {"{"} rows {"}"} = await db.query('SELECT dish FROM menu WHERE day = CURRENT_DATE');
      res.send(page(rows));
    {"}"});

    // The app needs its database: without it, it stops.
    db.connect()
      {"."}then(() => app.listen(Number(process.env.PORT), '127.0.0.1'))
      {"."}catch((err) => {"{"} console.error(err); process.exit(1); {"}"});
    db.on('error', (err) => {"{"} console.error(err); process.exit(1); {"}"});
