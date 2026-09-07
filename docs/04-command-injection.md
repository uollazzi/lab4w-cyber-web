# Vulnerability

Un dato ricevuto dall'utente non deve diventare una parte di un comando del sistema
operativo.

L'endpoint `GET /tools/ping` concatena il parametro `host` al comando `ping` e passa
tutto a una shell. Aprire:

```text
http://localhost:8080/tools/ping?host=127.0.0.1%26%26whoami
```

`%26%26` rappresenta i caratteri `&&`. Il programma sceglie automaticamente il
parametro di `ping` adatto al sistema operativo. Il comando finale diventa:

```sh
# macOS e Linux
ping -c 1 127.0.0.1 && whoami

# Windows
ping -n 1 127.0.0.1 && whoami
```

Sia la shell di macOS/Linux sia quella di Windows interpretano `&&` come separatore ed
eseguono `whoami` dopo un `ping` riuscito. Con Docker appare l'utente del contenitore:

```text
root
```

Eseguendo Node.js direttamente su Windows apparirebbe invece un valore simile a
`COMPUTER\\utente`. Questo è un attacco di **command injection**. `whoami` è stato
scelto perché mostra il problema senza cancellare o modificare file. Un aggressore potrebbe usare lo stesso
difetto per leggere dati, modificare il sistema o avviare altri programmi, nei limiti
dei permessi del processo Node.js.

## FIX

[server.ts](../app/src/server.ts)

Sostituire l'importazione di `exec` con quella seguente e, prima di compilare,
sostituire anche l'intero endpoint come indicato subito dopo:

```ts
import { execFile } from "node:child_process";
import { isIP } from "node:net";
```

Poi sostituire l'endpoint `GET /tools/ping` con:

```ts
app.get("/tools/ping", (req, res) => {
  const host = String(req.query.host ?? "127.0.0.1");
  const countArgument = process.platform === "win32" ? "-n" : "-c";

  if (isIP(host) !== 4) {
    res.status(400).json({ error: "Invalid IPv4 address" });
    return;
  }

  execFile("ping", [countArgument, "1", host], { timeout: 5000 },
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

Con `127.0.0.1&&whoami`, la validazione risponde con errore `400`. Anche senza la
validazione, usando `execFile` i caratteri `&&` rimarrebbero parte dell'argomento e non
diventerebbero il separatore di un secondo comando. La scelta tra `-n` e `-c` mantiene
la funzione compatibile con Windows, macOS e Linux.

La soluzione ancora più sicura è non avviare comandi di sistema quando la stessa
operazione può essere svolta da una libreria con un'interfaccia limitata.
