# Quick Deployment Guide - TL;DR

## Fastest Way to Deploy (Railway)

### 1. Pre-Deployment (5 minutes)

**Generate Secrets:**
```bash
# Run this 3 times to get secrets for JWT, Refresh, and Cookie
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Update Database Schema:**
Edit `backend/prisma/schema.prisma` line 2:
```prisma
provider = "postgresql"  // Change from "sqlite"
```

### 2. Deploy to Railway (10 minutes)

1. Go to https://railway.app and sign up with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select `CleanStreak_Simplified`
4. Click "Add PostgreSQL database"
5. Click on your web service → "Variables" tab
6. Add these variables:

```
NODE_ENV=production
PORT=3000
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<paste-generated-secret-1>
JWT_REFRESH_SECRET=<paste-generated-secret-2>
COOKIE_SECRET=<paste-generated-secret-3>
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
CORS_CREDENTIALS=true
```

7. Settings → Configure:
   - Root Directory: `backend`
   - Build Command: `npm install && npx prisma generate && npx prisma migrate deploy`
   - Start Command: `npm start`

8. Click "Generate Domain" to get your backend URL (e.g., `backend.railway.app`)

### 3. Deploy Frontend (5 minutes)

**Option A: Update app.html for production**

Edit `app.html` line 2124:
```javascript
const API_BASE_URL = 'https://your-backend-url.railway.app/api';
```

Then deploy `app.html` and `index.html` to:
- **Vercel**: `npx vercel --prod index.html`
- **Netlify**: Drag and drop `index.html` to https://app.netlify.com/drop
- **GitHub Pages**: Push to `gh-pages` branch

**Option B: Use Railway for frontend too**

1. In Railway, click "New" → "Empty Service"
2. Settings:
   - Root Directory: Leave empty (uses root)
   - The project already includes `package.json` and `start-frontend.sh`.
   - Build Command: (leave empty)
   - Start Command: `npm start`
3. Generate Domain

### 4. Update CORS (2 minutes)

In Railway backend variables, update:
```
CORS_ORIGIN=https://your-frontend-url.com
```

### 5. Test (3 minutes)

1. Visit your frontend URL
2. Register a new account
3. Add a room
4. Complete a task
5. Check streak tracking

Done! Your app is live 🎉

---

## Important Files to Update

### app.html (Line 2124)
```javascript
// BEFORE (development)
const API_BASE_URL = 'http://localhost:3000/api';

// AFTER (production)
const API_BASE_URL = 'https://your-backend-url.railway.app/api';
```

### backend/prisma/schema.prisma (Line 2)
```prisma
// BEFORE
provider = "sqlite"

// AFTER
provider = "postgresql"
```

---

## Cost Estimate

**Railway (Recommended):**
- $5 free credit per month
- Typical cost: $5-10/month after free credit
- Database included

**Alternative (Free but with limitations):**
- Render Free Tier (backend sleeps after inactivity)
- Netlify Free Tier (frontend)
- Total: $0/month (but slow cold starts)

---

## Troubleshooting

**Can't connect to database?**
- Check DATABASE_URL is set
- Run migrations: `npx prisma migrate deploy`

**CORS errors?**
- Update CORS_ORIGIN with your frontend URL
- Ensure COOKIE_SAME_SITE=none

**404 on API routes?**
- Check API_BASE_URL in index.html includes /api
- Example: `https://backend.railway.app/api`

**Need more help?**
See full guide in `DEPLOYMENT.md`
