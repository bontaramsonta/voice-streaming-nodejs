import express from "express";

const app = express();

app.get("/", (_, res) => {
  res.json({ ok: new Date() });
});

export default app;
