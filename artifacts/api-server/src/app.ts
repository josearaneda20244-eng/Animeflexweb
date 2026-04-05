import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

const allowedOrigins = [
  /\.replit\.dev$/,
  /\.replit\.app$/,
  /\.repl\.co$/,
  /localhost/,
];

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.some((r) => r.test(origin))) return cb(null, true);
      cb(new Error("CORS not allowed"));
    },
    credentials: true,
  }),
);

const generalLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones. Inténtalo en unos minutos." },
});

const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de acceso. Espera 15 minutos." },
  skipSuccessfulRequests: true,
});

const streamLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones de stream. Espera un momento." },
});

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth/login", authLimit);
app.use("/api/auth/register", authLimit);
app.use("/api/stream", streamLimit);
app.use("/api", generalLimit);
app.use("/api", router);

export default app;
