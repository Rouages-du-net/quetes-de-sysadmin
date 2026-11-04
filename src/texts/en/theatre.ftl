### What the chapters of "The Theatre" share: the app's unit description,
### its pages and its code (Node.js), the shows. SQL, paths and the tools'
### messages are not translated.

theatre-boxoffice-description = Theatre ticket office (Node.js)
theatre-show-41 = The Snow Queen
theatre-show-42 = The Lighthouse Keeper
theatre-show-43 = Twelve Angry Jurors

theatre-error-page =
    <!DOCTYPE html>
    <html lang="en"><head><meta charset="utf-8"><title>Ticket office</title></head>
    <body><h1>Sorry!</h1><p>The ticket office is unavailable. Please try again in a few minutes.</p></body></html>

too-many-clients-page =
    <!DOCTYPE html>
    <html lang="en"><head><meta charset="utf-8"><title>Ticket office</title></head>
    <body><h1>The Lighthouse Keeper — opening night</h1><p>Pick your seat: 7 left in row A.</p></body></html>

slow-query-page =
    <!DOCTYPE html>
    <html lang="en"><head><meta charset="utf-8"><title>Ticket office — seat map</title></head>
    <body><h1>The Lighthouse Keeper — seat map</h1><p>214 seats sold, 166 free.</p></body></html>

theatre-server-js =
    // The theatre's ticket office: a small Express app with a pool of
    // PostgreSQL connections (pg).
    const express = require('express');
    const {"{"} Pool {"}"} = require('pg');

    const db = new Pool({"{"} connectionString: process.env.DATABASE_URL, max: Number(process.env.PG_POOL_MAX) {"}"});
    const app = express();

    // Picking a seat: the seat stays held until the payment (or forever).
    app.post('/shows/:id/hold', async (req, res) => {"{"}
      const client = await db.connect();
      await client.query('BEGIN');
      await client.query("SELECT seat FROM seats WHERE show_id = $1 AND status = 'free' FOR UPDATE", [req.params.id]);
      holds.set(req.session.id, client); // COMMIT when the payment comes back
      res.redirect('/pay');
    {"}"});

    app.get('/shows/:id/seats', async (req, res) => {"{"}
      const {"{"} rows {"}"} = await db.query('SELECT seat, status FROM bookings WHERE show_id = $1', [req.params.id]);
      res.send(seatMap(rows));
    {"}"});

    app.listen(Number(process.env.PORT), '127.0.0.1');
