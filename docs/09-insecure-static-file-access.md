# Vulnerability

Un file presente sul server non diventa sicuro soltanto perché il suo indirizzo non è
mostrato nell'interfaccia. Se la cartella è pubblicata come contenuto statico, chiunque
conosca o indovini il percorso può scaricarlo.

In questo branch Express pubblica direttamente la cartella `app/user-files`:

```ts
app.use("/user-files", express.static(join(process.cwd(), "user-files")));
```

Il documento di Alice è quindi raggiungibile senza login:

```text
http://localhost:8080/user-files/alice/report.txt
```

La risposta contiene:

```text
Report privato di Alice
Saldo disponibile: 1250 euro
```

Anche Bob potrebbe scaricarlo dopo aver imparato il percorso. Il middleware statico
controlla che il file esista, ma non sa chi lo possiede e non esegue alcun controllo di
autorizzazione.

Questa vulnerabilità assomiglia a un IDOR: `alice/report.txt` è il riferimento diretto
all'oggetto. È però diversa dal path traversal della lezione 07. Non serve usare `../`
e uscire dalla cartella prevista, perché il file privato è già stato pubblicato dentro
quella cartella.

## FIX

[server.ts](../app/src/server.ts)

Rimuovere la pubblicazione statica:

```ts
app.use("/user-files", express.static(join(process.cwd(), "user-files")));
```

Al suo posto, aggiungere un endpoint che ricava il proprietario dalla sessione e non
dall'indirizzo scelto dall'utente:

```ts
const downloadableFiles = new Set(["report.txt"]);

app.get("/user-files/:filename", async (req, res) => {
  const userId = getSessionUserId(req);
  const filename = req.params.filename;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (!downloadableFiles.has(filename)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const userResult = await pool.query(
    "SELECT username FROM users WHERE id = $1",
    [userId],
  );
  const username = userResult.rows[0]?.username;

  if (!username) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const filePath = join(process.cwd(), "user-files", username, filename);
  res.download(filePath);
});
```

Con la sessione di Bob, l'unico `report.txt` ottenibile viene cercato nella cartella
`bob`, perché il nome `bob` arriva dal database. Bob non può inserire `alice` nella
richiesta.

La lista `downloadableFiles` impedisce anche di trasformare il parametro in un path
traversal. In un'applicazione reale è meglio registrare i documenti nel database con
un identificativo casuale, il percorso interno e `owner_id`, poi controllare
`owner_id` prima di inviare il file.

[Dockerfile](../app/Dockerfile)

La cartella viene copiata nell'immagine con:

```dockerfile
COPY user-files ./user-files
```

Questa riga rende disponibili i file al processo Node.js, ma non li rende pubblici da
sola. È `express.static` a saltare il controllo applicativo.
