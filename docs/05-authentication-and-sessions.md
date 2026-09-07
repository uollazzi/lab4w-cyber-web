# Vulnerability

L'autenticazione controlla chi sei. La sessione serve a ricordarlo nelle richieste
successive. Se il segno usato per riconoscere un utente è prevedibile, chiunque può
fingersi un altro utente.

Eseguire il login di Alice:

```sh
curl -i -X POST http://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}'
```

La risposta contiene:

```text
Set-Cookie: session=session-1
{"message":"Login successful","token":"session-1"}
```

Il numero è l'identificativo dell'utente. È quindi facile indovinare la sessione
dell'amministratore:

```sh
curl http://localhost:8080/profile -H "Cookie: session=session-3"
```

L'API restituisce il profilo `admin`, anche senza conoscere la sua password. Inoltre il
cookie non usa `HttpOnly`, quindi uno script eseguito nella pagina può leggerlo.

Il database contiene anche le password in chiaro. Una perdita del database rivelerebbe
subito `password123`, `password456` e `admin123`; le password devono invece essere
salvate tramite una funzione lenta progettata apposta, per esempio Argon2, scrypt o
bcrypt, usando un valore casuale diverso per ogni password.

## FIX

[server.ts](../app/src/server.ts)

Importare il generatore casuale e creare un archivio temporaneo delle sessioni:

```ts
import { randomBytes } from "node:crypto";

const sessions = new Map<string, number>();
```

Sostituire `getSessionUserId` con:

```ts
function getSessionUserId(req: express.Request): number | undefined {
  const sessionCookie = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("session="));
  const token = sessionCookie?.slice("session=".length);

  return token ? sessions.get(token) : undefined;
}
```

Nel login, dopo aver verificato la password, sostituire la creazione del token e la
risposta con:

```ts
const token = randomBytes(32).toString("hex");
sessions.set(token, user.id);

res.cookie("session", token, {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  maxAge: 30 * 60 * 1000,
});
res.json({ message: "Login successful" });
```

Il token casuale non contiene l'identificativo dell'utente e non è pratico da
indovinare. `HttpOnly` impedisce agli script della pagina di leggerlo, `SameSite`
limita l'invio da altri siti, `Secure` lo riserva a HTTPS in produzione e `maxAge`
gli dà una scadenza.

La `Map` va bene per il laboratorio. In produzione le sessioni devono stare in un
archivio condiviso e avere revoca, scadenza sul server e un nuovo token dopo il login.

[schema.sql](../app/src/schema.sql)

La colonna `password` può restare testuale, ma deve contenere il risultato della
funzione di derivazione, comprensivo di sale, parametri e hash, non la password
originale. Il login deve prima cercare l'utente solo per `username`, poi verificare la
password ricevuta con la funzione della libreria scelta. Non basta applicare SHA-256:
è troppo veloce e rende economici i tentativi automatici.
