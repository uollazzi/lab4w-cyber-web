# Vulnerability

Essere autenticati non significa poter leggere o modificare ogni oggetto. Dopo aver
capito chi fa la richiesta, il server deve controllare se quella persona può compiere
proprio quell'azione su proprio quell'oggetto.

## IDOR

La vulnerabilità della sessione vista nella lezione precedente è già corretta in
questo branch: il token è casuale, salvato sul server e protetto con `HttpOnly`.

Prima effettuare il login come Alice e salvare il cookie ricevuto:

```sh
curl -c alice-cookies.txt -X POST http://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}'
```

La richiesta seguente usa quella sessione valida, ma chiede l'account numero `2`, che
appartiene a Bob:

```sh
curl http://localhost:8080/accounts/2 \
  -b alice-cookies.txt
```

Il server controlla soltanto che esista una sessione e restituisce:

```json
{"id":2,"username":"bob","email":"bob@example.com","role":"user"}
```

Questo è un **riferimento diretto non sicuro a un oggetto**, spesso chiamato IDOR.
Cambiare `2` nell'indirizzo permette di provare ad accedere agli altri account.

## Escalation dei privilegi

Alice può anche assegnarsi il ruolo amministratore:

```sh
curl -X PATCH http://localhost:8080/accounts/1/role \
  -b alice-cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"role":"admin"}'
```

Il controllo mancante è sul potere di cambiare ruoli. Il server sa che la richiesta
arriva da Alice, ma non verifica che Alice sia già amministratrice. Passare da utente
normale ad amministratore è un'**escalation verticale dei privilegi**.

## FIX IDOR

[server.ts](../app/src/server.ts)

Sostituire l'endpoint `GET /accounts/:userId` con:

```ts
app.get("/accounts/:userId", async (req, res) => {
  const currentUserId = getSessionUserId(req);
  const requestedUserId = Number(req.params.userId);

  if (!currentUserId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (currentUserId !== requestedUserId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const result = await pool.query(
    "SELECT id, username, email, role FROM users WHERE id = $1",
    [requestedUserId],
  );

  res.json(result.rows[0]);
});
```

Con la sessione di Alice e l'indirizzo `/accounts/2`, i due numeri non coincidono e il
server risponde `403 Forbidden`. Il controllo deve essere sul server: nascondere un
pulsante nell'interfaccia non impedisce di costruire la richiesta a mano.

## FIX escalation dei privilegi

[server.ts](../app/src/server.ts)

Sostituire l'endpoint `PATCH /accounts/:userId/role` con:

```ts
app.patch("/accounts/:userId/role", async (req, res) => {
  const currentUserId = getSessionUserId(req);
  const requestedRole = String(req.body.role);

  if (!currentUserId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const actorResult = await pool.query(
    "SELECT role FROM users WHERE id = $1",
    [currentUserId],
  );

  if (actorResult.rows[0]?.role !== "admin") {
    res.status(403).json({ error: "Administrator role required" });
    return;
  }

  if (!["user", "admin"].includes(requestedRole)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  const result = await pool.query(
    `UPDATE users
     SET role = $1
     WHERE id = $2
     RETURNING id, username, email, role`,
    [requestedRole, req.params.userId],
  );

  res.json(result.rows[0]);
});
```

Qui ci sono due controlli diversi: il ruolo di chi agisce deve essere `admin` e il
nuovo ruolo deve appartenere a una lista chiusa. Le query con parametri impediscono
l'iniezione SQL, ma non sostituiscono questi controlli di autorizzazione.
