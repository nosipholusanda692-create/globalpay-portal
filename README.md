# GlobalPay — Customer International Payments Portal

A secure React + Firebase web application for international banking payments.

---

## 🚀 Setup Instructions

### 1. Clone the project and install dependencies
```bash
npm install
```

### 2. Set up Firebase

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it (e.g. `globalpay-portal`)
3. Enable **Google Analytics** (optional)
4. In the left sidebar → **Authentication** → **Get started**
   - Click **Email/Password** → Enable → Save
5. In the left sidebar → **Firestore Database** → **Create database**
   - Choose **Start in production mode**
   - Select a region (e.g. `europe-west1` for SA proximity)
6. Go to **Project Settings** (gear icon) → **Your apps** → Click `</>` (Web)
   - Register the app, copy your config values
7. Open `src/firebase/config.js` and replace the placeholder values with your actual Firebase config

### 3. Deploy Firestore Security Rules
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

### 4. Run locally
```bash
npm start
```
The app will open at [http://localhost:3000](http://localhost:3000)

### 5. Build and deploy to Firebase Hosting (HTTPS)
```bash
npm run build
firebase deploy --only hosting
```
Your app will be live at `https://YOUR_PROJECT_ID.web.app` — automatically served over **HTTPS**.

---

## 🔒 Security Features Implemented

### 1. Password Hashing & Salting
- **Firebase Authentication** handles all password management
- Firebase uses **bcrypt** internally to hash and salt passwords before storage
- Plain-text passwords are **never stored anywhere** — not in Firebase Auth, not in Firestore
- Even if the database is compromised, passwords cannot be recovered

### 2. Input Whitelisting (RegEx Validation)
All user input is validated against strict RegEx patterns defined in `src/utils/validators.js`:

| Field | Pattern | Rule |
|---|---|---|
| Full Name | `/^[a-zA-Z\s'\-]{2,60}$/` | Letters, spaces, hyphens only |
| SA ID Number | `/^\d{13}$/` | Exactly 13 digits |
| Account Number | `/^\d{8,12}$/` | 8–12 digits |
| Username | `/^[a-zA-Z0-9_]{3,30}$/` | Alphanumeric + underscores |
| Password | Complex pattern | Min 8 chars, upper, lower, digit, special |
| Amount | `/^\d{1,7}(\.\d{1,2})?$/` | Max 10M, 2 decimal places |
| SWIFT Code | `/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/` | 8 or 11 chars |
| Recipient Account | `/^[A-Z0-9]{8,34}$/` | IBAN format |

Invalid input is **rejected with an error message** before it ever reaches the server.

### 3. HTTPS / SSL
- Firebase Hosting automatically serves all content over **HTTPS**
- **HSTS header** (`Strict-Transport-Security`) forces HTTPS even if HTTP is typed
- Protects against **Man-in-the-Middle (MITM)** attacks — all data in transit is encrypted
- The HTTPS lock is visible in the browser address bar

### 4. Protection Against Common Attacks

#### ✅ Brute Force
- **Client-side:** 5 failed login attempts → 15-minute lockout (`src/utils/rateLimiter.js`)
- **Server-side:** Firebase Authentication automatically rate-limits excessive login attempts

#### ✅ XSS (Cross-Site Scripting)
- All inputs are sanitized using `sanitizeInput()` before being stored in Firestore
- HTML special characters (`<`, `>`, `"`, `'`) are escaped
- React's JSX rendering inherently escapes output (no `dangerouslySetInnerHTML`)

#### ✅ Injection (SQL/NoSQL)
- Firestore uses structured document-based queries — no raw query strings
- All data is stored as typed fields (number, string) — not interpolated into queries
- Firestore Security Rules enforce strict data type validation server-side

#### ✅ Session Hijacking
- Firebase Auth uses **short-lived JWT tokens** (1 hour) that auto-refresh
- Tokens are stored in memory / secure storage, not in cookies accessible to JS
- `ProtectedRoute` component blocks unauthenticated access to the dashboard
- Firestore Rules ensure users can only access their own data (`uid` check)

#### ✅ Man-in-the-Middle (MITM)
- HTTPS/TLS encrypts all data between the browser and Firebase servers
- HSTS ensures browsers always use HTTPS after first visit

### 5. Firestore Security Rules (`firestore.rules`)
- Users can **only read/write their own documents** (checked by `uid`)
- Transaction `status` field can only be updated by server-side admin SDK (employee portal)
- Amount is validated server-side: must be a number between 0 and 10,000,000
- All other collections are blocked by default

### 6. Security HTTP Headers (`firebase.json`)
| Header | Protection |
|---|---|
| `X-Frame-Options: DENY` | Prevents clickjacking |
| `X-Content-Type-Options: nosniff` | Prevents MIME-type attacks |
| `Strict-Transport-Security` | Enforces HTTPS |
| `Content-Security-Policy` | Restricts resource loading |
| `Referrer-Policy` | Controls referrer leakage |

---

## 🔄 CI/CD Pipeline (`.github/workflows/deploy.yml`)

The DevSecOps pipeline runs automatically on every push to `main`:

1. **`npm audit`** — scans all dependencies for known CVEs (Common Vulnerabilities)
2. **`npm run build`** — creates an optimised production build
3. **Firebase deploy** — deploys to HTTPS hosting

**Why this improves security:**
- Catches vulnerable dependencies before they reach production
- Ensures only tested, built code is deployed
- Automates the process — no human error in deployment steps
- Secrets (Firebase keys) are stored in GitHub Secrets, never in code

---

## 📁 Project Structure

```
src/
├── firebase/
│   └── config.js          # Firebase initialisation
├── components/
│   ├── AuthContext.js      # Authentication state & methods
│   └── ProtectedRoute.js  # Route guard
├── pages/
│   ├── Register.js        # Registration page
│   ├── Login.js           # Login page
│   └── Dashboard.js       # Payment form + transaction history
├── utils/
│   ├── validators.js      # All RegEx validation + sanitization
│   └── rateLimiter.js     # Brute force protection
└── styles/
    └── global.css         # All styling
```

---
###Login Page
![Login] (<img width="1568" height="719" alt="Screenshot 2026-05-14 093244" src="https://github.com/user-attachments/assets/326b3fc5-e990-4e0d-a6ad-ec194592ea11" />
)
###Registration Page
![Registration] (<img width="1588" height="716" alt="Screenshot 2026-05-14 093428" src="https://github.com/user-attachments/assets/d90f29b0-4a88-41f3-b526-2b333f47fabd" />
)

###Payment screen
![Payment] (<img width="1592" height="729" alt="Screenshot 2026-05-14 092835" src="https://github.com/user-attachments/assets/572dbf94-68e6-4ade-931f-b65f33cb0a5b" />
)


## 🛠 Tools Used

| Tool | Purpose | Security Provided |
|---|---|---|
| **Firebase Authentication** | User auth | Password hashing/salting (bcrypt), rate limiting, JWT sessions |
| **Firebase Firestore** | Database | Server-side security rules, structured queries (no injection) |
| **Firebase Hosting** | Deployment | Automatic HTTPS/SSL, custom security headers |
| **React** | Frontend | Automatic output escaping (XSS prevention) |
| **GitHub Actions** | CI/CD | Automated dependency audit + deployment |
| **Custom validators.js** | Input validation | RegEx whitelisting of all inputs |
| **Custom rateLimiter.js** | Brute force | Client-side lockout after 5 failed attempts |
