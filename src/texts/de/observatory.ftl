### Was die Kapitel von „Die Sternwarte“ teilen: die Beschreibungen der
### Dienste, die Seite der Galerie und ihr Code (Node.js). Pfade,
### Unit-Namen und die Meldungen der Werkzeuge werden nicht übersetzt.

observatory-gallery-description = Fotogalerie des Astronomievereins (Node.js)
observatory-stacking-description = Stacking der Fotos der Nacht (stack-night)

observatory-gallery-page =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Astronomieverein — Galerie</title></head>
    <body>
    <h1>Unser Himmel</h1>
    <p>Die Geminiden, 13.–14. Dezember: 214 Meteore, gezählt vom Feld des Vereins aus.</p>
    <p>Der Orionnebel (M42), 3 h Belichtung. Jupiter und seine Monde.</p>
    </body>
    </html>

observatory-server-js =
    // Die Galerie des Vereins: eine kleine Express-App. Jede Seite
    // verkleinert die Fotos, die sie zeigt (sharp): Sie braucht eine CPU,
    // während die Mitglieder darin blättern.
    const express = require('express');
    const sharp = require('sharp');

    const app = express();
    app.use('/photos', express.static('/srv/skygallery/photos'));
    app.get('/', async (req, res) => {"{"}
      res.send(await page(await thumbnails('/srv/skygallery/photos')));
    {"}"});
    app.listen(8080, '127.0.0.1');
