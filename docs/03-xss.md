# Vulnerability

I dati forniti dall'utente devono rimanere testo e non devono diventare elementi
eseguibili di una pagina web.

L'endpoint `GET /welcome` inserisce il parametro `name` direttamente nel codice HTML.
Aprire nel browser:

```text
http://localhost:8080/welcome?name=%3Cscript%3Ealert(%27XSS%27)%3C%2Fscript%3E
```

La parte codificata dell'indirizzo corrisponde a:

```html
<script>alert('XSS')</script>
```

Il server costruisce quindi una pagina che contiene:

```html
<h1>Benvenuto, <script>alert('XSS')</script>!</h1>
```

Il browser non vede quella stringa come un nome: trova un elemento `script` e ne
esegue il contenuto. Questa è una **XSS riflessa**, perché il valore arriva nella
richiesta e viene subito riflesso nella risposta.

Un attacco reale potrebbe provare a compiere azioni con la sessione dell'utente o a
mostrare una pagina falsa. La finestra `alert` serve solo a rendere visibile il difetto
senza causare danni.

## FIX

[server.ts](../app/src/server.ts)

Aggiungere questa funzione prima degli endpoint:

```ts
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
```

Poi sostituire l'endpoint `GET /welcome` con:

```ts
app.get("/welcome", (req, res) => {
  const name = String(req.query.name ?? "visitatore");
  const safeName = escapeHtml(name);

  res.send(`
    <!doctype html>
    <html lang="it">
      <head>
        <meta charset="utf-8">
        <title>Benvenuto</title>
      </head>
      <body>
        <h1>Benvenuto, ${safeName}!</h1>
      </body>
    </html>
  `);
});
```

La funzione trasforma i caratteri che hanno un significato speciale nell'HTML. Per
esempio, `<` diventa `&lt;`: il browser mostra il testo `<script>` ma non crea più un
elemento `script`, quindi non esegue `alert`.

La codifica va scelta in base al punto in cui si inserisce il dato. Questa soluzione è
adatta al testo dentro un elemento HTML; un valore inserito in JavaScript, CSS o in un
indirizzo richiederebbe una protezione diversa. Nei progetti reali è preferibile usare
un sistema di template che esegua automaticamente la codifica, invece di costruire
l'HTML a mano.
