import app from "./app";
import { initDb } from "./plugins/db";

const start = async () => {
  try {
    await initDb();
    await app.listen({
      port: 3000,
      host: "0.0.0.0",
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
