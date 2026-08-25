# Vulnerability

I dati forniti dall'utente devono rimanere dati e non devono diventare codice.

La query SQL viene costruita concatenando direttamente il valore di `username`.

Con questo input:

```text
' OR '1'='1
```

la condizione diventa sempre vera e l'API restituisce tutti gli utenti.

Il problema non è il carattere `'` da solo. Il problema è che il programma inserisce
il testo ricevuto dentro il comando SQL. In questo modo una parte dell'input viene
interpretata dal database come un'istruzione.

Iniezioni più gravi possono anche modificare o cancellare dati, ma dipende dai permessi
dell'utente del database e da come il programma invia le query. Per il laboratorio è
sufficiente mostrare la lettura di tutti gli utenti: rende visibile il problema senza
distruggere il database.

## FIX

[server.ts](../app/src/server.ts)

Sostituire l'endpoint `GET /users/search` con:

```ts
app.get("/users/search", async (req, res) => {
  const username = req.query.username;

  const query = `
    SELECT id, username, email, role
    FROM users
    WHERE username = $1
  `;

  try {
    const result = await pool.query(query, [username]);

    res.json(result.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Database error",
    });
  }
});
```

`$1` è un segnaposto: indica dove dovrà essere usato il primo valore.
L'array `[username]` contiene quel valore.

Il comando SQL e i dati vengono quindi inviati separatamente:

```text
Comando: WHERE username = $1
Dato:    ' OR '1'='1
```

Il database tratta tutto l'input come un nome utente da cercare. Non lo interpreta più
come una parte del comando SQL e, non trovando un utente con quel nome, restituisce una
lista vuota.
