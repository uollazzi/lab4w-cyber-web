# Vulnerability

Il browser allega automaticamente i cookie alle richieste dirette al sito che li ha
creati. Un altro sito può quindi tentare di far partire una richiesta usando la
sessione della vittima.

Prima aprire `http://localhost:8080/login-page` ed effettuare il login come Alice con
`alice` / `password123`, così il browser riceve il cookie `session`. Poi aprire:

```text
http://localhost:8081
```

Questa pagina appartiene a un'origine diversa, perché usa una porta diversa, e simula
un servizio dello stesso sito controllato dall'aggressore. Contiene un modulo nascosto
che invia automaticamente:

```text
POST http://localhost:8080/profile/email/change
email=attacker@evil.test
```

Il browser invia il cookie di Alice e l'applicazione cambia la sua email. Il server
vede una richiesta autenticata, ma non può sapere se Alice l'ha scelta oppure se è
stata costruita da un'altra pagina. Questo è un **Cross-Site Request Forgery**, CSRF.

Il problema non è l'uso di `POST`: anche un'altra pagina può costruire e inviare un
modulo `POST`. L'errore è che il server non richiede una prova segreta conosciuta dalla
pagina dell'applicazione e non leggibile dall'aggressore.

Il servizio `attacker` in [docker-compose.yml](../docker-compose.yml) serve soltanto a
mostrare le due origini: applicazione su `localhost:8080`, pagina ostile su
`localhost:8081`.

Il cookie usa già `SameSite=Strict`, come previsto dalla correzione della lezione 05.
Il browser lo invia comunque in questo esempio perché le due origini, pur avendo porte
diverse, appartengono allo stesso sito `localhost`. Per questo `SameSite` riduce molti
attacchi CSRF, ma non sostituisce il controllo eseguito dal server.

## FIX

[server.ts](../app/src/server.ts)

`randomBytes` è già importato dalla correzione della lezione sulle sessioni. Prima
degli endpoint, aggiungere un archivio temporaneo dei token:

```ts
const csrfTokens = new Map<number, string>();
```

Poi aggiungere la pagina legittima per la modifica dell'email:

```ts
app.get("/profile/email/change", (req, res) => {
  const userId = getSessionUserId(req);

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const csrfToken = randomBytes(32).toString("hex");
  csrfTokens.set(userId, csrfToken);

  res.send(`
    <!doctype html>
    <html lang="it">
      <head><meta charset="utf-8"><title>Modifica email</title></head>
      <body>
        <form method="post" action="/profile/email/change">
          <label>Nuova email <input name="email" type="email"></label>
          <input name="csrfToken" type="hidden" value="${csrfToken}">
          <button type="submit">Salva</button>
        </form>
      </body>
    </html>
  `);
});
```

Il campo `hidden` non viene mostrato nella pagina, ma il browser lo invia insieme
all'email quando Alice preme **Salva**.

Infine sostituire il `POST /profile/email/change` vulnerabile con:

```ts
app.post("/profile/email/change", async (req, res) => {
  const userId = getSessionUserId(req);

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const expectedToken = csrfTokens.get(userId);
  const receivedToken = String(req.body.csrfToken ?? "");

  if (!expectedToken || receivedToken !== expectedToken) {
    res.status(403).json({ error: "Invalid CSRF token" });
    return;
  }

  const email = String(req.body.email ?? "");
  const result = await pool.query(
    `UPDATE users
     SET email = $1
     WHERE id = $2
     RETURNING id, username, email`,
    [email, userId],
  );

  csrfTokens.delete(userId);
  res.json(result.rows[0]);
});
```

Il modulo `express.urlencoded` è già attivato nel codice e permette di ricevere i
campi del modulo HTML, compreso `csrfToken`.

La pagina ostile continua a inviare esattamente lo stesso `POST`, ma non può leggere
l'HTML della pagina legittima a causa della separazione tra origini del browser. Non
conosce quindi il valore casuale da aggiungere e il server risponde `403`.

`hidden` non significa segreto per Alice: il valore è visibile negli strumenti del
browser. Significa soltanto che un'altra origine non può leggerlo. Il token deve essere
casuale, associato alla sessione e verificato dal server; un semplice campo nascosto
con un valore fisso non offrirebbe alcuna protezione.

Il token è il controllo principale. Un cookie di sessione con `SameSite=Strict` e il
controllo degli header `Origin` sono difese aggiuntive, non sostituti universali del
token.

## VERIFICA DEL FIX

Dopo aver applicato la correzione, effettuare nuovamente il login come Alice e aprire:

```text
http://localhost:8081
```

La pagina ostile invia ancora lo stesso `POST /profile/email/change`, con l'email ma
senza `csrfToken`. Il cookie di Alice viene inviato, quindi la richiesta supera
l'autenticazione; il server rileva però che manca il token associato alla sessione e
risponde:

```text
403 Forbidden
{"error":"Invalid CSRF token"}
```

La prova raggiunge lo stesso endpoint `POST` sia prima sia dopo la correzione. Prima
l'email viene modificata; dopo la richiesta viene rifiutata precisamente dal controllo
del token.
