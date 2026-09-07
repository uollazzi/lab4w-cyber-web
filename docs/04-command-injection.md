# Vulnerability

Un dato ricevuto dall'utente non deve diventare una parte di un comando del sistema
operativo.

L'endpoint `GET /tools/ping` concatena il parametro `host` al comando `ping` e passa
tutto a una shell. Aprire:

```text
http://localhost:8080/tools/ping?host=127.0.0.1%3Bid
```

`%3B` rappresenta il carattere `;`. Il comando finale diventa:

```sh
ping -c 1 127.0.0.1;id
```

La shell interpreta `;` come separatore ed esegue due comandi. Dopo il risultato di
`ping` appare quindi anche l'identità dell'utente del contenitore, per esempio:

```text
uid=0(root) gid=0(root) groups=0(root)
```

Questo è un attacco di **command injection**. `id` è stato scelto perché mostra il
problema senza cancellare o modificare file. Un aggressore potrebbe usare lo stesso
difetto per leggere dati, modificare il sistema o avviare altri programmi, nei limiti
dei permessi del processo Node.js.

## FIX

[server.ts](../app/src/server.ts)

Sostituire l'importazione di `exec` con:

```ts
import { execFile } from "node:child_process";
import { isIP } from "node:net";
```

Poi sostituire l'endpoint `GET /tools/ping` con:

```ts
app.get("/tools/ping", (req, res) => {
  const host = String(req.query.host ?? "127.0.0.1");

  if (isIP(host) !== 4) {
    res.status(400).json({ error: "Invalid IPv4 address" });
    return;
  }

  execFile("ping", ["-c", "1", host], { timeout: 5000 },
    (error, stdout, stderr) => {
      res.type("text/plain").send(stdout || stderr || error?.message);
    },
  );
});
```

La correzione applica due controlli distinti:

- `isIP` accetta solo un vero indirizzo IPv4;
- `execFile` avvia direttamente `ping` e passa ogni argomento separatamente, senza
  chiedere a una shell di interpretare la stringa.

Con `127.0.0.1;id`, la validazione risponde con errore `400`. Anche senza la
validazione, usando `execFile` il carattere `;` rimarrebbe parte dell'argomento e non
diventerebbe il separatore di un secondo comando.

La soluzione ancora più sicura è non avviare comandi di sistema quando la stessa
operazione può essere svolta da una libreria con un'interfaccia limitata.
