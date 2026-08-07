import Fastify from "fastify";
import itemsRoutes from "./routes/items";
import offersRoutes from "./routes/offers";
import uiRoutes from "./routes/ui";

const app = Fastify({
  logger: true,
});

// Register routes
app.register(uiRoutes);
app.register(itemsRoutes, { prefix: "/api" });
app.register(offersRoutes, { prefix: "/api" });

export default app;
