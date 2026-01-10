import express from 'express';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss';
import csrf from 'csurf';
import { body, validationResult } from 'express-validator';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

if (!process.env.SESSION_SECRET) {
  console.warn(
    '⚠️  SESSION_SECRET is not set. Using a weak default for development only.',
  );
}

// Trust proxy when deployed behind a load balancer / reverse proxy
app.set('trust proxy', 1);

// --- Core middlewares ---
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// CORS configuration
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'X-Session-Touch',
    ],
  }),
);

// --- Security middlewares ---

// 1) Input sanitization
app.use(
  mongoSanitize({
    onSanitize: ({ key }) => {
      console.warn(`Sanitized potentially malicious key: ${key}`);
    },
  }),
);

// 2) XSS filter
app.use((req, _res, next) => {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (typeof value === 'string') {
        obj[key] = xss(value);
      } else if (typeof value === 'object') {
        sanitize(value);
      }
    }
  };

  sanitize(req.body);
  sanitize(req.query);
  next();
});

// 3) Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// --- Session Management ---

// LOGIC:
// 1. We want the user to be logged out after 1 minute of inactivity (SESSION_INACTIVITY_MS).
// 2. However, we set the cookie itself to live for 24 hours (COOKIE_MAX_AGE).
//    Why? So the browser keeps sending the cookie even after 1 minute.
//    This allows our server middleware to receive the cookie, detect the timeout,
//    and send back the specific 440 error message.

const SESSION_INACTIVITY_MS = 1 * 60 * 1000; // 1 minute (Server logic)
const COOKIE_MAX_AGE = 24 * 60 * 60 * 1000;  // 24 hours (Browser cookie life)

app.use(
  session({
    name: 'hostelfix.sid',
    secret: process.env.SESSION_SECRET || 'hostelfix-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE, // Browser keeps cookie for 24h
    },
  }),
);

// --- Inactivity Timeout Middleware ---
app.use((req, res, next) => {
  // If no session exists at all, skip
  if (!req.session || !req.session.user) {
    console.log('[Timeout Check] No active session found.');
    return next();
  }

  const now = Date.now();
  const lastActivity = req.session.lastActivity || now;
  const timeSinceLastActivity = now - lastActivity;

  const isCheckOnly =
    req.path === '/api/session/me' &&
    req.method === 'GET' &&
    req.headers['x-session-touch'] === 'false';

  // DEBUG LOG: Watch this in your terminal!
  console.log(
    `[Timeout Check] User: ${req.session.user.email} | Idle: ${
      timeSinceLastActivity / 1000
    }s / 60s`,
  );

  // Initialize lastActivity if this is a new session
  if (!req.session.lastActivity) {
    if (!isCheckOnly) req.session.lastActivity = now;
    return next();
  }

  if (timeSinceLastActivity > SESSION_INACTIVITY_MS) {
    console.log('❌ Session expired! Destroying...');

    // Session expired - destroy it
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying expired session:', err);
      }
      res.clearCookie('hostelfix.sid');
      
      // Send specific 440 status code
      return res.status(440).json({
        ok: false,
        message: 'Session expired due to inactivity. Please log in again.',
      });
    });
  } else {
    // Update lastActivity and continue
    if (!isCheckOnly) req.session.lastActivity = now;
    next();
  }
});

// --- CSRF protection ---
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax',
  },
});

app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.status(200).json({ csrfToken: req.csrfToken() });
});

// Apply CSRF protection to sensitive routes
app.use('/api/secure', csrfProtection);

// --- Helper: Require authenticated session ---
const requireSession = (req, res, next) => {
  if (!req.session?.user) {
    return res.status(401).json({ ok: false, message: 'Not authenticated' });
  }
  next();
};

// --- Routes ---

app.post(
  '/api/session/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('role').isIn(['student', 'warden', 'staff']),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid input',
        errors: errors.array(),
      });
    }

    const { email, role } = req.body;
    const now = Date.now();

    req.session.user = {
      id: email,
      email,
      role,
      loginAt: new Date().toISOString(),
    };
    req.session.lastActivity = now;

    res.status(200).json({
      ok: true,
      message: 'Login successful. Session created.',
      user: req.session.user,
    });
  },
);

app.post('/api/session/logout', (req, res) => {
  if (!req.session) {
    return res.status(200).json({ ok: true, message: 'Already logged out' });
  }

  req.session.destroy((err) => {
    res.clearCookie('hostelfix.sid');
    if (err) {
      return res
        .status(500)
        .json({ ok: false, message: 'Failed to log out securely' });
    }
    return res.status(200).json({ ok: true, message: 'Logged out' });
  });
});

app.get('/api/session/me', requireSession, (req, res) => {
  res.status(200).json({ ok: true, user: req.session.user });
});

// Secure route example
app.get('/api/secure/complaints', requireSession, (req, res) => {
  res.status(200).json({
    ok: true,
    data: [
      {
        id: 'demo-1',
        title: 'Leaking tap in bathroom',
        status: 'in-progress',
        createdBy: req.session.user.email,
      },
    ],
  });
});

// --- HTTPS enforcement ---
app.use((req, res, next) => {
  if (
    NODE_ENV === 'production' &&
    req.headers['x-forwarded-proto'] &&
    req.headers['x-forwarded-proto'] !== 'https'
  ) {
    const httpsUrl = `https://${req.headers.host}${req.url}`;
    return res.redirect(301, httpsUrl);
  }
  next();
});

// --- Health Check ---
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// 404 & Error Handler
app.use((req, res) => {
  res.status(404).json({ ok: false, message: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Global error handler:', err);
  const status = err.status || 500;
  const message =
    NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error';
  res.status(status).json({ ok: false, message });
});

app.listen(PORT, () => {
  console.log(`HostelFix backend listening on port ${PORT} in ${NODE_ENV} mode`);
});