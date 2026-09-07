# Vulnerability

Il browser allega automaticamente i cookie alle richieste dirette al sito che li ha
creati. Un altro sito può quindi tentare di far partire una richiesta usando la
sessione della vittima.

Prima aprire `http://localhost:8080/login-page` ed effettuare il login come Alice con
`alice` / `password123`, così il browser riceve il cookie `session`. Poi aprire:

```text
http://127.0.0.1:8081
```

Questa pagina appartiene a un'origine diversa e simula il sito dell'aggressore. Dopo
due secondi manda il browser verso:

```text
http://localhost:8080/profile/email/change?email=attacker@evil.test
```

Il browser invia il cookie di Alice e l'applicazione cambia la sua email. Il server
vede una richiesta autenticata, ma non può sapere se Alice l'ha scelta oppure se è
stata costruita da un'altra pagina. Questo è un **Cross-Site Request Forgery**, CSRF.

Due errori rendono possibile l'attacco:

- una richiesta `GET`, che dovrebbe soltanto leggere dati, modifica invece l'account;
- il server non richiede una prova segreta che la pagina dell'applicazione conosce e
  quella dell'aggressore non può leggere.

Il servizio `attacker` in [docker-compose.yml](../docker-compose.yml) serve soltanto a
mostrare le due origini: applicazione su `localhost:8080`, pagina ostile su
`127.0.0.1:8081`.

## FIX

[server.ts](../app/src/server.ts)

Importare `randomBytes` da `node:crypto`, se non è già stato fatto nella correzione
della lezione sulle sessioni, e aggiungere:

```ts
const csrfTokens = new Map<number, string>();

app.get("/csrf-token", (req, res) => {
  const userId = getSessionUserId(req);

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = randomBytes(32).toString("hex");
  csrfTokens.set(userId, token);
  res.json({ csrfToken: token });
});
```

Poi eliminare `GET /profile/email/change` e sostituirlo con:

```ts
app.post("/profile/email", async (req, res) => {
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

Il modulo `express.urlencoded` è già attivato nel codice e permette di ricevere un
formulario HTML. Il formulario legittimo deve ottenere `/csrf-token` e inviare il
valore ricevuto insieme alla nuova email.

Il sito ostile può ancora inviare una richiesta, ma non può leggere il token restituito
dall'applicazione a causa della separazione tra origini del browser. Il server risponde
quindi `403`.

Usare `POST` evita modifiche tramite collegamenti, immagini e sistemi di cache, ma da
solo non basta: un altro sito può creare un formulario `POST`. Il token è il controllo
principale. Un cookie di sessione con `SameSite=Strict` e il controllo degli header
`Origin` sono difese aggiuntive, non sostituti universali del token.
