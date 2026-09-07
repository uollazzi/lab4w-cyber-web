import express from "express";
import { exec } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pool, testDatabaseConnection } from "./db";

const app = express();

const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

function getSessionUserId(req: express.Request): number | undefined {
  const sessionCookie = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("session="));
  const token = sessionCookie?.slice("session=".length);
  const match = /^session-(\d+)$/.exec(token ?? "");

  return match ? Number(match[1]) : undefined;
}

app.get("/", (_req, res) => {
  res.json({
    message: "Web Security Course",
    application: "Express + TypeScript",
    status: "running",
  });
});

app.get("/health", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS current_time");

    res.json({
      application: "ok",
      database: "ok",
      databaseTime: result.rows[0].current_time,
    });
  } catch (error) {
    console.error("Database error:", error);

    res.status(500).json({
      application: "ok",
      database: "error",
    });
  }
});

app.get("/users", async (_req, res) => {
  try {
    // FIX
    const result = await pool.query(`
      SELECT *
      FROM users
      ORDER BY id
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

app.get("/users/search", async (req, res) => {
  const username = req.query.username;

  // VULNERABLE: user input is concatenated directly into the SQL query.
  const query = `
    SELECT id, username, email, role
    FROM users
    WHERE username = '${username}'
  `;

  console.log("Executing query:", query);

  try {
    const result = await pool.query(query);

    res.json(result.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Database error",
    });
  }
});

app.get("/welcome", (req, res) => {
  const name = req.query.name ?? "visitatore";

  // VULNERABLE: user input is inserted directly into the HTML page.
  res.send(`
    <!doctype html>
    <html lang="it">
      <head>
        <meta charset="utf-8">
        <title>Benvenuto</title>
      </head>
      <body>
        <h1>Benvenuto, ${name}!</h1>
      </body>
    </html>
  `);
});

app.get("/tools/ping", (req, res) => {
  const host = String(req.query.host ?? "127.0.0.1");
  const countArgument = process.platform === "win32" ? "-n" : "-c";

  // VULNERABLE: the shell interprets both the command and the user input.
  exec(`ping ${countArgument} 1 ${host}`, { timeout: 5000 }, (error, stdout, stderr) => {
    res.type("text/plain").send(stdout || stderr || error?.message);
  });
});

app.get("/login-page", (_req, res) => {
  res.send(`
    <!doctype html>
    <html lang="it">
      <head><meta charset="utf-8"><title>Login</title></head>
      <body>
        <form method="post" action="/login">
          <label>Username <input name="username"></label>
          <label>Password <input name="password" type="password"></label>
          <button type="submit">Accedi</button>
        </form>
      </body>
    </html>
  `);
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const result = await pool.query(
    `SELECT id, username, email, role
     FROM users
     WHERE username = $1 AND password = $2`,
    [username, password],
  );

  if (result.rowCount === 0) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const user = result.rows[0];
  // VULNERABLE: the token is predictable and readable by browser scripts.
  const token = `session-${user.id}`;

  res.cookie("session", token, { httpOnly: false });
  res.json({ message: "Login successful", token });
});

app.get("/profile", async (req, res) => {
  const userId = getSessionUserId(req);

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const result = await pool.query(
    "SELECT id, username, email, role FROM users WHERE id = $1",
    [userId],
  );

  res.json(result.rows[0]);
});

app.get("/accounts/:userId", async (req, res) => {
  const currentUserId = getSessionUserId(req);

  if (!currentUserId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // VULNERABLE: authentication is checked, but ownership is not.
  const result = await pool.query(
    "SELECT id, username, email, role FROM users WHERE id = $1",
    [req.params.userId],
  );

  res.json(result.rows[0]);
});

app.patch("/accounts/:userId/role", async (req, res) => {
  const currentUserId = getSessionUserId(req);

  if (!currentUserId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // VULNERABLE: every authenticated user can assign every role.
  const result = await pool.query(
    `UPDATE users
     SET role = $1
     WHERE id = $2
     RETURNING id, username, email, role`,
    [req.body.role, req.params.userId],
  );

  res.json(result.rows[0]);
});

app.get("/files", async (req, res) => {
  const filename = String(req.query.name ?? "welcome.txt");
  // VULNERABLE: ../ can leave the intended public directory.
  const filePath = join(process.cwd(), "files", "public", filename);

  try {
    const content = await readFile(filePath, "utf8");
    res.type("text/plain").send(content);
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

app.get("/profile/email/change", async (req, res) => {
  const userId = getSessionUserId(req);

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // VULNERABLE: a state-changing request has no CSRF protection.
  const result = await pool.query(
    `UPDATE users
     SET email = $1
     WHERE id = $2
     RETURNING id, username, email`,
    [req.query.email, userId],
  );

  res.json(result.rows[0]);
});

app.get("/products", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        products.id,
        products.name,
        products.description,
        products.price,
        products.owner_id,
        users.username AS owner
      FROM products
      JOIN users ON users.id = products.owner_id
      ORDER BY products.id
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

testDatabaseConnection()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Application listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Unable to connect to database:", error);
    process.exit(1);
  });
