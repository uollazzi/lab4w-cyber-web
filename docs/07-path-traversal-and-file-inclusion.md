# Vulnerability

Un nome di file fornito dall'utente non deve poter uscire dalla cartella prevista.

L'endpoint `GET /files` dovrebbe leggere soltanto i documenti presenti in
`app/files/public`. Questa richiesta è lecita:

```text
http://localhost:8080/files?name=welcome.txt
```

Il server concatena però il valore ricevuto al percorso della cartella. I segmenti
`..` significano "sali alla cartella superiore". Aprire:

```text
http://localhost:8080/files?name=../../package.json
```

Il percorso viene risolto così:

```text
/app/files/public/../../package.json
/app/package.json
```

La risposta mostra quindi un file che non appartiene alla cartella pubblica. Questo è
un **path traversal**, o attraversamento delle directory.

Qui il file viene soltanto letto. In altri sistemi lo stesso errore può essere usato
per includere ed eseguire un file scelto dall'aggressore, oppure per scrivere fuori
dalla cartella prevista. Questi casi sono chiamati inclusione arbitraria di file e
scrittura arbitraria di file, e possono avere conseguenze ancora più gravi.

## FIX

[server.ts](../app/src/server.ts)

Prima dell'endpoint, definire esplicitamente i file pubblici disponibili:

```ts
const publicFiles = new Map([
  ["welcome.txt", join(process.cwd(), "files", "public", "welcome.txt")],
]);
```

Poi sostituire l'endpoint `GET /files` con:

```ts
app.get("/files", async (req, res) => {
  const filename = String(req.query.name ?? "welcome.txt");
  const filePath = publicFiles.get(filename);

  if (!filePath) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  try {
    const content = await readFile(filePath, "utf8");
    res.type("text/plain").send(content);
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});
```

La lista associa un nome pubblico a un percorso deciso dal programma. L'utente può
scegliere `welcome.txt`, ma non può costruire un percorso. Con
`../../package.json`, la ricerca nella lista non trova alcun elemento e restituisce
`404`.

Quando i file possibili sono molti e una lista chiusa non è pratica, bisogna risolvere
il percorso completo e verificare che inizi ancora dalla cartella consentita. Togliere
soltanto la stringa `../` non è una protezione affidabile: esistono separatori e
codifiche differenti, e il controllo può essere aggirato.

[Dockerfile](../app/Dockerfile)

La riga seguente non è una correzione della vulnerabilità, ma rende disponibili nel
contenitore soltanto i file necessari alla funzione:

```dockerfile
COPY files ./files
```

Evitare `COPY . .` riduce i file presenti nell'immagine e quindi quelli che un difetto
potrebbe esporre.
