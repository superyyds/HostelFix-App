HostelFix Backend (CMT322 - Backend Rubric Support)
===================================================

This folder contains the **Express.js backend** for the HostelFix hostel management system.  
It is designed specifically to satisfy the backend rubric:

- **Web Hosting & HTTPS**
- **Session Management / Session Tracking**
- **Web Security Techniques**

You can demonstrate and test everything using Postman or the existing React frontend.

------------------------------------------------------------
1. Getting Started Locally
------------------------------------------------------------

1. Open a terminal in the project root and run:

```bash
cd server
npm install
npm run dev
```

2. The backend will start on `http://localhost:4000` by default.

3. The main health-check endpoint is:

- `GET http://localhost:4000/api/health`

  - Returns uptime, environment, and status JSON.

------------------------------------------------------------
2. Session Management / Tracking (Rubric Item 2)
------------------------------------------------------------

Implemented in `server.js` using **`express-session`** with:

- **Secure Session Cookie**
  - Cookie name: `hostelfix.sid`
  - `httpOnly: true` (cannot be accessed by JavaScript → protects against XSS cookie theft)
  - `secure: true` automatically in production (cookies only sent over HTTPS)
  - `sameSite: 'lax'` to reduce CSRF risk.

- **Server-side Session Object**
  - On successful login we store:
    - `req.session.user = { id, email, role, loginAt }`
  - Use this to enforce **role-based access** on secure routes.

- **Inactivity Timeout**
  - Constant: `SESSION_INACTIVITY_MS = 30 * 60 * 1000` (30 minutes)
  - Middleware checks `req.session.lastActivity`:
    - If idle > 30 mins → session is destroyed, cookie cleared, and the user receives HTTP **440** “Session expired due to inactivity”.
    - Otherwise, `lastActivity` is updated for each request.

- **Login / Logout / Current Session Routes**

  - `POST /api/session/login`
    - Body (JSON):
      - `email` (must be a valid email)
      - `role` (`student`, `warden`, or `staff`)
    - Uses **input validation** before creating a session.
    - On success: creates `req.session.user` and returns that user data.

  - `POST /api/session/logout`
    - Destroys the server-side session and clears the cookie.

  - `GET /api/session/me`
    - Requires an active session.
    - Returns the current logged-in user from the session.

  - **Protected Example Route**
    - `GET /api/secure/complaints`
    - Uses the `requireSession` middleware.
    - Only accessible when a valid session exists.

These features together satisfy:

- Login/logout flow
- Role tracking inside the session
- Server-side session with cookie-based session ID
- Inactivity-based automatic timeout

------------------------------------------------------------
3. Web Security Techniques (Rubric Item 3)
------------------------------------------------------------

At least **three robust security measures** are implemented and documented here:

1. **HTTP Security Headers with `helmet`**
   - Middleware: `app.use(helmet())`
   - Adds headers like:
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: SAMEORIGIN`
     - `X-XSS-Protection`
   - Protects against several browser-based attacks (XSS, clickjacking, MIME sniffing).

2. **Input Validation & Sanitization**
   - `express-validator`:
     - On `POST /api/session/login` we validate:
       - `email` is a real email.
       - `role` is one of `student | warden | staff`.
   - `express-mongo-sanitize`:
     - Strips out keys that look like `$` or `.` injection payloads.
   - Custom XSS filter using `xss`:
     - Walks through `req.body` and `req.query` and strips script tags / dangerous HTML.
   - **Effect:** Strong mitigation against **XSS** and **SQL/NoSQL injection style payloads**.

3. **Rate Limiting for Authentication (`express-rate-limit`)**
   - `authLimiter` is applied to `POST /api/session/login`.
   - Limits the number of login attempts per IP within a 15-minute window.
   - Helps mitigate **brute-force attacks**.

4. **CSRF Protection (`csurf`)**
   - Cookie-based CSRF tokens:
     - `GET /api/csrf-token` issues a CSRF token and CSRF cookie.
     - All routes under `/api/secure/*` require a valid `X-CSRF-Token` header.
   - Demonstrates **CSRF defense** in the backend.

5. **HTTPS Usage & Secure Cookies**
   - When `NODE_ENV=production`:
     - Session cookie uses `secure: true` → only sent over HTTPS.
     - Backend includes middleware that redirects `http://` → `https://` when behind a proxy (Render / Railway / Heroku).
   - You’ll typically deploy to a platform that automatically provisions an **SSL certificate**, so all requests are served over **HTTPS**.

Together, these cover and **demonstrate awareness of**:

- Input validation
- XSS prevention
- CSRF defense
- Brute-force defense (rate limiting)
- Secure cookies and HTTPS usage

------------------------------------------------------------
4. Web Hosting & HTTPS (Rubric Item 1)
------------------------------------------------------------

This backend is ready to be deployed to any **professional or free hosting platform**, such as:

- Render (recommended)
- Railway
- Azure App Service
- AWS Elastic Beanstalk / Lightsail

Typical deployment steps (Render example):

1. Push your project to GitHub.
2. On Render:
   - Create a new **Web Service**.
   - Connect your repository.
   - Set **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
3. Configure environment variables in Render:
   - `SESSION_SECRET` – long random string.
   - `NODE_ENV=production`
   - `PORT` – usually Render sets this automatically via `PORT` env.
   - `FRONTEND_ORIGIN` – your live front-end URL (e.g., `https://hostelfix-frontend.onrender.com`).
4. Render automatically issues an **SSL certificate** and serves your backend with **HTTPS**.

**Result for rubric:**

- **Web hosting** on a professional platform.
- **Website accessible and stable** via `/api/health`.
- **SSL enabled** (platform-managed HTTPS).

------------------------------------------------------------
5. How to Demonstrate in Your Presentation
------------------------------------------------------------

1. **Show Hosting & HTTPS**
   - Browser: open `https://<your-backend-url>/api/health`
   - Confirm the URL uses `https://` and returns JSON `{ status: "ok", ... }`.

2. **Show Session Management**
   - Use Postman or frontend:
     - `POST /api/session/login` with body:
       ```json
       { "email": "student@example.com", "role": "student" }
       ```
     - Show that:
       - Response contains `user` with the role.
       - Cookie `hostelfix.sid` is set.
     - Call `GET /api/session/me` to confirm session data is returned.
     - Call `POST /api/session/logout` and then `GET /api/session/me` to show it now fails with `401`.
   - To show timeout:
     - Explain that `SESSION_INACTIVITY_MS` is set to 30 minutes (you can temporarily lower this to 1 minute for demo).

3. **Show Security Features**
   - From browser dev tools / Postman:
     - Inspect response headers to show `helmet` headers.
   - Attempt to send a body with `<script>alert(1)</script>` in fields:
     - Show that it is sanitized in the response / logs.
   - Call `/api/secure/complaints` **without** logging in:
     - Show `401 Not authenticated`.
   - If you implement the CSRF token flow on the frontend for `/api/secure/*`, show that missing or invalid token results in a 403.

By walking through these, you will clearly demonstrate that the backend:

- Is deployed on a professional hosting platform with HTTPS.
- Implements robust session management and tracking.
- Uses multiple strong web security techniques in both design and code.


