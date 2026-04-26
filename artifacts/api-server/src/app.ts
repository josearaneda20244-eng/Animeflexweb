import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

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

/**
 * Helmet con CSP. Mantenemos COEP desactivado por compatibilidad con vídeo HLS y CDNs.
 * frame-ancestors 'none' previene clickjacking.
 */
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "img-src": ["'self'", "data:", "https:", "blob:"],
        "media-src": ["'self'", "https:", "blob:"],
        "connect-src": ["'self'", "https:", "wss:"],
        "frame-ancestors": ["'none'"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "upgrade-insecure-requests": [],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: {
      maxAge: 60 * 60 * 24 * 365, // 1 año
      includeSubDomains: true,
      preload: false,
    },
  }),
);

const allowedOrigins = [
  /\.replit\.dev$/,
  /\.replit\.app$/,
  /\.repl\.co$/,
  /localhost/,
  /animeflex\.eu$/,
  /\.animeflex\.eu$/,
  /animeflex\.lat$/,
  /\.animeflex\.lat$/,
  /\.vercel\.app$/,
  /\.railway\.app$/,
];

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.some((r) => r.test(origin))) return cb(null, true);
      cb(new Error("CORS not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    maxAge: 86400,
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

const strictLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 h
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Has alcanzado el límite. Intenta de nuevo en una hora." },
});

const streamLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones de stream. Espera un momento." },
});

/* Payload pequeño para auth (evita ataques de payload), grande para resto. */
const jsonAuth = express.json({ limit: "16kb" });
const jsonGeneral = express.json({ limit: "2mb" });

app.use("/api/auth/login", jsonAuth, authLimit);
app.use("/api/auth/register", jsonAuth, authLimit);
app.use("/api/auth/forgot-password", jsonAuth, strictLimit);
app.use("/api/auth/reset-password", jsonAuth, strictLimit);
app.use("/api/auth/send-verification", strictLimit);
app.use(jsonGeneral);
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api/stream", streamLimit);
app.use("/api", generalLimit);
app.use("/api", router);

export default app;
