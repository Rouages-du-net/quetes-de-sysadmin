### Ce que partagent les chapitres du « Théâtre » : la description de
### l'appli, ses pages et son code (Node.js), les spectacles. Le SQL, les
### chemins et les messages des outils ne sont pas traduits.

theatre-boxoffice-description = Billetterie du théâtre (Node.js)
theatre-show-41 = La Reine des neiges
theatre-show-42 = Le Gardien du phare
theatre-show-43 = Douze jurés en colère

theatre-error-page =
    <!DOCTYPE html>
    <html lang="fr"><head><meta charset="utf-8"><title>Billetterie</title></head>
    <body><h1>Désolé !</h1><p>La billetterie est indisponible. Réessayez dans quelques minutes.</p></body></html>

too-many-clients-page =
    <!DOCTYPE html>
    <html lang="fr"><head><meta charset="utf-8"><title>Billetterie</title></head>
    <body><h1>Le Gardien du phare — première</h1><p>Choisissez votre place : plus que 7 au rang A.</p></body></html>

slow-query-page =
    <!DOCTYPE html>
    <html lang="fr"><head><meta charset="utf-8"><title>Billetterie — plan de salle</title></head>
    <body><h1>Le Gardien du phare — plan de salle</h1><p>214 places vendues, 166 libres.</p></body></html>

theatre-server-js =
    // La billetterie du théâtre : une petite appli Express avec un pool de
    // connexions PostgreSQL (pg).
    const express = require('express');
    const {"{"} Pool {"}"} = require('pg');

    const db = new Pool({"{"} connectionString: process.env.DATABASE_URL, max: Number(process.env.PG_POOL_MAX) {"}"});
    const app = express();

    // Choisir une place : la place reste bloquée jusqu'au paiement (ou pour toujours).
    app.post('/shows/:id/hold', async (req, res) => {"{"}
      const client = await db.connect();
      await client.query('BEGIN');
      await client.query("SELECT seat FROM seats WHERE show_id = $1 AND status = 'free' FOR UPDATE", [req.params.id]);
      holds.set(req.session.id, client); // COMMIT au retour du paiement
      res.redirect('/pay');
    {"}"});

    app.get('/shows/:id/seats', async (req, res) => {"{"}
      const {"{"} rows {"}"} = await db.query('SELECT seat, status FROM bookings WHERE show_id = $1', [req.params.id]);
      res.send(seatMap(rows));
    {"}"});

    app.listen(Number(process.env.PORT), '127.0.0.1');

read-only-stats-description = Statistiques de billetterie, rapport hebdomadaire (Python)

failover-page =
    <!DOCTYPE html>
    <html lang="fr"><head><meta charset="utf-8"><title>Billetterie</title></head>
    <body><h1>Douze jurés en colère</h1><p>Choisissez votre place : plus que 64.</p></body></html>
