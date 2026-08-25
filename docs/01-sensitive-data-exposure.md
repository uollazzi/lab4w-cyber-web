# Vulnerability

Principio del minimo privilegio/minima esposizione: un componente dovrebbe avere accesso solo ai dati necessari.
Data minimization: non bisogna inviare al client dati che non gli servono.

Anche se le password fossero correttamente hashate, non dovrebbero comunque essere restituite dall'API.

La sicurezza non riguarda solo **impedire agli hacker di entrare**, ma anche evitare di consegnare informazioni che non devono avere.

## FIX

[server.ts](../app/src/server.ts)

```ts
const result = await pool.query(`
    SELECT id, username, email, role, created_at
    FROM users
    ORDER BY id
`);
```
