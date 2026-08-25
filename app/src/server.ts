import express from "express";

const app = express();

const PORT = 3000;

app.get("/", (_req, res) => {
  res.json({
    message: "Web Security Course",
    application: "Express + TypeScript",
    status: "running",
  });
});

app.listen(PORT, () => {
  console.log(`Application listening on port ${PORT}`);
});
