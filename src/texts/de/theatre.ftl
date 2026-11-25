### Was die Kapitel von „Das Theater“ teilen: die Beschreibung der Unit
### der App, ihre Seiten und ihr Code (Node.js), die Stücke. SQL, Pfade und
### die Meldungen der Werkzeuge werden nicht übersetzt.

theatre-boxoffice-description = Ticketkasse des Theaters (Node.js)
theatre-show-41 = Die Schneekönigin
theatre-show-42 = Der Leuchtturmwärter
theatre-show-43 = Die zwölf Geschworenen

theatre-error-page =
    <!DOCTYPE html>
    <html lang="de"><head><meta charset="utf-8"><title>Ticketkasse</title></head>
    <body><h1>Entschuldigung!</h1><p>Die Ticketkasse ist nicht erreichbar. Bitte versuch es in ein paar Minuten noch einmal.</p></body></html>

too-many-clients-page =
    <!DOCTYPE html>
    <html lang="de"><head><meta charset="utf-8"><title>Ticketkasse</title></head>
    <body><h1>Der Leuchtturmwärter — Premiere</h1><p>Wähl deinen Platz: noch 7 frei in Reihe A.</p></body></html>

slow-query-page =
    <!DOCTYPE html>
    <html lang="de"><head><meta charset="utf-8"><title>Ticketkasse — Saalplan</title></head>
    <body><h1>Der Leuchtturmwärter — Saalplan</h1><p>214 Plätze verkauft, 166 frei.</p></body></html>

theatre-server-js =
    // Die Ticketkasse des Theaters: eine kleine Express-App mit einem Pool
    // von PostgreSQL-Verbindungen (pg).
    const express = require('express');
    const {"{"} Pool {"}"} = require('pg');

    const db = new Pool({"{"} connectionString: process.env.DATABASE_URL, max: Number(process.env.PG_POOL_MAX) {"}"});
    const app = express();

    // Einen Platz wählen: Der Platz bleibt bis zur Zahlung reserviert (oder für immer).
    app.post('/shows/:id/hold', async (req, res) => {"{"}
      const client = await db.connect();
      await client.query('BEGIN');
      await client.query("SELECT seat FROM seats WHERE show_id = $1 AND status = 'free' FOR UPDATE", [req.params.id]);
      holds.set(req.session.id, client); // COMMIT, wenn die Zahlung zurückkommt
      res.redirect('/pay');
    {"}"});

    app.get('/shows/:id/seats', async (req, res) => {"{"}
      const {"{"} rows {"}"} = await db.query('SELECT seat, status FROM bookings WHERE show_id = $1', [req.params.id]);
      res.send(seatMap(rows));
    {"}"});

    app.listen(Number(process.env.PORT), '127.0.0.1');

read-only-stats-description = Ticketstatistik, Wochenbericht (Python)

failover-page =
    <!DOCTYPE html>
    <html lang="de"><head><meta charset="utf-8"><title>Ticketkasse</title></head>
    <body><h1>Die zwölf Geschworenen</h1><p>Wähl deinen Platz: noch 64 frei.</p></body></html>
