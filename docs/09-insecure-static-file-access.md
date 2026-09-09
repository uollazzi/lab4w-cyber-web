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

Al suo posto, creare una lista che associa ogni utente ai file che può scaricare:

```ts
interface DownloadableFile {
  name: string;
  path: string;
}

const filesByUserId = new Map<number, DownloadableFile[]>([
  [
    1,
    [
      {
        name: "report.txt",
        path: join(process.cwd(), "user-files", "alice", "report.txt"),
      },
    ],
  ],
  [
    2,
    [
      {
        name: "report.txt",
        path: join(process.cwd(), "user-files", "bob", "report.txt"),
      },
    ],
  ],
]);
```

Poi aggiungere l'endpoint protetto:

```ts
app.get("/user-files/:filename", (req, res) => {
  const userId = getSessionUserId(req);

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const userFiles = filesByUserId.get(userId) ?? [];
  const requestedFile = userFiles.find(
    (file) => file.name === req.params.filename,
  );

  if (!requestedFile) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  res.download(requestedFile.path);
});
```

Il server recupera prima l'ID dalla sessione. Se Bob è autenticato, `userId` vale `2`
e la ricerca viene eseguita soltanto nella lista associata al numero `2`. Il file di
Alice è nella lista del numero `1`, quindi Bob non può ottenerlo.

Il percorso non viene costruito usando il testo della richiesta: arriva dalla lista
decisa dal server. Questo impedisce anche di trasformare `filename` in un path
traversal.

La `Map` rende visibile il controllo durante il laboratorio. In un'applicazione reale
la stessa associazione starebbe normalmente nel database: ogni documento avrebbe un
identificativo, un percorso interno e `owner_id`. La query dovrebbe cercare insieme
l'identificativo richiesto e l'ID dell'utente autenticato.

[Dockerfile](../app/Dockerfile)

La cartella viene copiata nell'immagine con:

```dockerfile
COPY user-files ./user-files
```

Questa riga rende disponibili i file al processo Node.js, ma non li rende pubblici da
sola. È `express.static` a saltare il controllo applicativo.
