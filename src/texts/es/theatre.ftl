### Lo que comparten los capítulos de «El Teatro»: la descripción de la
### unidad de la aplicación, sus páginas y su código (Node.js), los
### espectáculos. El SQL, las rutas y los mensajes de las herramientas no se
### traducen.

theatre-boxoffice-description = Taquilla del teatro (Node.js)
theatre-show-41 = La Reina de las Nieves
theatre-show-42 = El Guardián del Faro
theatre-show-43 = Doce jurados sin piedad

theatre-error-page =
    <!DOCTYPE html>
    <html lang="es"><head><meta charset="utf-8"><title>Taquilla</title></head>
    <body><h1>¡Lo sentimos!</h1><p>La taquilla no está disponible. Vuelve a intentarlo dentro de unos minutos.</p></body></html>

too-many-clients-page =
    <!DOCTYPE html>
    <html lang="es"><head><meta charset="utf-8"><title>Taquilla</title></head>
    <body><h1>El Guardián del Faro — noche del estreno</h1><p>Elige tu butaca: quedan 7 en la fila A.</p></body></html>

slow-query-page =
    <!DOCTYPE html>
    <html lang="es"><head><meta charset="utf-8"><title>Taquilla — plano de la sala</title></head>
    <body><h1>El Guardián del Faro — plano de la sala</h1><p>214 butacas vendidas, 166 libres.</p></body></html>

theatre-server-js =
    // La taquilla del teatro: una pequeña aplicación Express con un pool de
    // conexiones PostgreSQL (pg).
    const express = require('express');
    const {"{"} Pool {"}"} = require('pg');

    const db = new Pool({"{"} connectionString: process.env.DATABASE_URL, max: Number(process.env.PG_POOL_MAX) {"}"});
    const app = express();

    // Elegir una butaca: la butaca queda retenida hasta el pago (o para siempre).
    app.post('/shows/:id/hold', async (req, res) => {"{"}
      const client = await db.connect();
      await client.query('BEGIN');
      await client.query("SELECT seat FROM seats WHERE show_id = $1 AND status = 'free' FOR UPDATE", [req.params.id]);
      holds.set(req.session.id, client); // COMMIT cuando vuelve el pago
      res.redirect('/pay');
    {"}"});

    app.get('/shows/:id/seats', async (req, res) => {"{"}
      const {"{"} rows {"}"} = await db.query('SELECT seat, status FROM bookings WHERE show_id = $1', [req.params.id]);
      res.send(seatMap(rows));
    {"}"});

    app.listen(Number(process.env.PORT), '127.0.0.1');

read-only-stats-description = Estadísticas de entradas, informe semanal (Python)

failover-page =
    <!DOCTYPE html>
    <html lang="es"><head><meta charset="utf-8"><title>Taquilla</title></head>
    <body><h1>Doce jurados sin piedad</h1><p>Elige tu butaca: quedan 64.</p></body></html>
