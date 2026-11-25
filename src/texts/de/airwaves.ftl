### What the chapters of "The Airwaves" share: the files of the federation's
### certificate authority on mast (Kwame's notes, the policy) and the pages
### of its sites. Commands, options, paths and outputs are not translated.

airwaves-readme-ca-1 =
    Die Zertifizierungsstelle des Äther-Verbunds -- Kwame, Februar 2028
    
    Unsere Namen enden auf airwaves.internal: keine öffentliche Stelle wird
    sie zertifizieren, also haben wir unsere eigene. Die PCs der Stationen
    vertrauen unserer Root, weil ich ca.crt auf jedem von ihnen installiert
    habe (Firefox und das System).
    
      ca.crt            das Zertifikat der Root (Airwaves Root CA, 10 Jahre)
      private/ca.key    der private Schlüssel der Root: die Kronjuwelen
      ca.srl            die zuletzt benutzte Seriennummer
      issued/           eine Kopie jedes signierten Zertifikats
    
    So habe ich das Zertifikat des Intranets gemacht (8. Februar 2028):
    
      openssl req -new -key /etc/nginx/ssl/intranet.key -subj /CN=intranet.airwaves.internal -out intranet.csr
      openssl x509 -req -in intranet.csr -CA ca.crt -CAkey private/ca.key -days 825 -out intranet.crt
    
    Dann nach /etc/nginx/ssl/ kopieren und nginx neu laden.
    Bevor du irgendetwas signierst, lies POLICY.txt.
airwaves-readme-ca-2 =
    { airwaves-readme-ca-1 }
    
    März 2030 -- die ausstellende CA
    
    Die Root sollte nicht jedes Zertifikat signieren: ihr Schlüssel sollte
    offline schlafen. Am 11. März habe ich eine Zwischenzertifizierungsstelle
    gemacht, von der Root signiert: issuing/ (Airwaves Issuing CA 1). Sie
    läuft mit openssl ca und ihrer eigenen openssl.cnf (Datenbank
    index.txt, serial, newcerts/). Ab jetzt signiert sie die Zertifikate
    der Server und der Laptops. Der Schlüssel der Root verlässt mast
    nächste Woche.
airwaves-readme-ca-3 =
    { airwaves-readme-ca-2 }
    
    April 2030
    
    Der Schlüssel der Root liegt auf einem USB-Stick in Adaezes Tresor; die
    Sperrliste (CRL) der Root, bei derselben Zeremonie geschrieben, liegt in
    crl/root.crl (ein Jahr gültig). Laptops: je ein Client-Zertifikat,
    ausgestellt von issuing/ (Kopien in issuing/certs/ und
    issuing/newcerts/).
airwaves-policy =
    Äther-Verbund -- Zertifikatsrichtlinie (Version 2, Januar 2030)
    
    1. Server-Zertifikate
       - jeder Name, den ein Client benutzt, kommt in subjectAltName
         (DNS:...); Browser ignorieren den Common Name
       - Gültigkeit: ein Jahr (365 Tage), nie mehr als 398
       - keine CA (basicConstraints CA:FALSE)
       - Schlüssel: EC P-256 oder RSA mit mindestens 2048 Bit
    2. Die Schlüssel der CA
       - nur für root lesbar (chmod 600), nie anderswohin kopiert
       - nur die Zertifikate werden verteilt, nie die Schlüssel
    3. Sperrung
       - ein verlorener oder gestohlener Schlüssel: sein Zertifikat am
         selben Tag sperren und die Sperrliste veröffentlichen
airwaves-site-intranet =
    <!DOCTYPE html>
    <html lang="de"><head><title>Äther-Intranet</title></head>
    <body><h1>Äther-Verbund</h1><p>Das Programm dieser Woche, der Dienstplan der Moderation, die gemeinsamen Jingles.</p></body></html>
airwaves-site-archive =
    <!DOCTYPE html>
    <html lang="de"><head><title>Äther-Archiv</title></head>
    <body><h1>Sendungsarchiv</h1><p>Jede Sendung der fünf Stationen seit 2019.</p></body></html>
airwaves-site-contrib =
    <!DOCTYPE html>
    <html lang="de"><head><title>Äther-Beiträge</title></head>
    <body><h1>Beiträge</h1><p>Aufnahmen von unterwegs: der Uploader schickt sie hierher.</p></body></html>
