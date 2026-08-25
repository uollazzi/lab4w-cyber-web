import express from "express";
import { pool, testDatabaseConnection } from "./db";

const app = express();

const PORT = 3000;

app.use(express.json());

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
