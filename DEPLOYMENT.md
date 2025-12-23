# CleanStreak Deployment Guide

This guide covers multiple hosting options for deploying your CleanStreak application to production.

## Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Option 1: Railway (Recommended)](#option-1-railway-recommended)
3. [Option 2: Render](#option-2-render)
4. [Option 3: Vercel](#option-3-vercel)
5. [Option 4: DigitalOcean App Platform](#option-4-digitalocean-app-platform)
6. [Post-Deployment Steps](#post-deployment-steps)

---

## Pre-Deployment Checklist

### 1. Update Database Configuration

Your app currently uses SQLite. For production, you should use PostgreSQL.

**Update `backend/prisma/schema.prisma`:**

```prisma
datasource db {
  provider = "postgresql"  // Change from "sqlite"
  url      = env("DATABASE_URL")
}
```

### 2. Create Production Environment Variables

Create a `.env.production` file (DO NOT commit this):

```bash
# Production Environment Configuration
NODE_ENV=production
PORT=3000

# Database Configuration (PostgreSQL)
DATABASE_PROVIDER="postgresql"
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

# JWT Configuration - GENERATE NEW SECRETS!
JWT_SECRET="your-super-secret-jwt-key-min-32-characters-long"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-min-32-characters-long"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Cookie Configuration - GENERATE NEW SECRET!
COOKIE_SECRET="your-super-secret-cookie-key-min-32-characters-long"
COOKIE_SECURE=true
COOKIE_SAME_SITE="none"

# CORS Configuration - UPDATE WITH YOUR DOMAIN
CORS_ORIGIN="https://yourdomain.com"
CORS_CREDENTIALS=true

# Rate Limiting (Production settings)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Security
BCRYPT_SALT_ROUNDS=12

# Logging
LOG_LEVEL=info
```

**Generate secure secrets:**
```bash
# In terminal, run these commands to generate secure secrets:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Run this 3 times for JWT_SECRET, JWT_REFRESH_SECRET, and COOKIE_SECRET
```

### 3. Update Project Structure

Ensure your project root has these files:

```
CleanStreak_Simplified/
├── backend/
│   ├── src/
│   ├── prisma/
│   ├── package.json
│   └── .env
├── index.html          # Frontend file
├── .gitignore
└── DEPLOYMENT.md       # This file
```

### 4. Add Start Script

Ensure `backend/package.json` has production scripts:

```json
{
  "scripts": {
    "start": "node src/app.js",
    "build": "prisma generate && prisma migrate deploy",
    "postinstall": "prisma generate"
  }
}
```

---

## Option 1: Railway (Recommended)

Railway is the easiest option with great PostgreSQL support and free credits for testing.

### Steps:

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `CleanStreak_Simplified` repository

3. **Add PostgreSQL Database**
   - In your project, click "New"
   - Select "Database" → "PostgreSQL"
   - Railway will automatically create a database

4. **Configure Backend Service**
   - Click on your backend service
   - Go to "Variables" tab
   - Add these environment variables:
     ```
     NODE_ENV=production
     PORT=3000
     DATABASE_URL=${{Postgres.DATABASE_URL}}
     JWT_SECRET=<your-generated-secret>
     JWT_REFRESH_SECRET=<your-generated-secret>
     COOKIE_SECRET=<your-generated-secret>
     COOKIE_SECURE=true
     COOKIE_SAME_SITE=none
     CORS_ORIGIN=https://your-frontend-url.railway.app
     CORS_CREDENTIALS=true
     ```

5. **Configure Build Settings**
   - Go to "Settings" tab
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

6. **Deploy Frontend**
   - Add another service: "New" → "Empty Service"
   - Go to Settings → Root Directory: Leave empty (uses root)
   - The project already includes a `package.json` and `start-frontend.sh` for the frontend.
   - Build Command: (leave empty)
   - Start Command: `npm start` (or `sh start-frontend.sh`)

7. **Generate Domain**
   - Click "Generate Domain" for both services
   - Update `CORS_ORIGIN` in backend with frontend URL

8. **Deploy!**
   - Railway auto-deploys on push to main branch

### Railway Pricing:
- $5 free credit monthly
- Pay-as-you-go after that (~$5-10/month for small apps)

---

## Option 2: Render

Render offers a free tier with some limitations (services sleep after inactivity).

### Steps:

1. **Create Render Account**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub

2. **Create PostgreSQL Database**
   - Click "New +" → "PostgreSQL"
   - Name: `cleanstreak-db`
   - Region: Choose closest to you
   - Free tier selected
   - Click "Create Database"
   - Copy the "Internal Database URL"

3. **Deploy Backend**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - Name: `cleanstreak-backend`
     - Region: Same as database
     - Branch: `main`
     - Root Directory: `backend`
     - Runtime: `Node`
     - Build Command: `npm install && npx prisma generate && npx prisma migrate deploy`
     - Start Command: `npm start`
     - Instance Type: Free

4. **Add Environment Variables**
   - In the web service settings, add:
     ```
     NODE_ENV=production
     DATABASE_URL=<your-postgres-internal-url>
     JWT_SECRET=<your-generated-secret>
     JWT_REFRESH_SECRET=<your-generated-secret>
     COOKIE_SECRET=<your-generated-secret>
     COOKIE_SECURE=true
     COOKIE_SAME_SITE=none
     CORS_ORIGIN=https://your-frontend-url.onrender.com
     CORS_CREDENTIALS=true
     ```

5. **Deploy Frontend**
   - Click "New +" → "Static Site"
   - Connect repository
   - Configure:
     - Name: `cleanstreak-frontend`
     - Branch: `main`
     - Build Command: (leave empty)
     - Publish Directory: `.`

6. **Update CORS**
   - Go back to backend service
   - Update `CORS_ORIGIN` with your frontend URL

### Render Pricing:
- Free tier available (services sleep after 15min inactivity)
- Paid tier: $7/month for always-on services

---

## Option 3: Vercel

Vercel is excellent for frontend but requires serverless functions for backend.

### Steps:

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Create `vercel.json` in project root:**
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "backend/src/app.js",
         "use": "@vercel/node"
       },
       {
         "src": "index.html",
         "use": "@vercel/static"
       }
     ],
     "routes": [
       {
         "src": "/api/(.*)",
         "dest": "backend/src/app.js"
       },
       {
         "src": "/(.*)",
         "dest": "index.html"
       }
     ],
     "env": {
       "NODE_ENV": "production"
     }
   }
   ```

3. **Deploy**
   ```bash
   cd /Users/stephenkline/Documents/GitHub/CleanStreak_Simplified
   vercel
   ```

4. **Add Environment Variables**
   - Go to Vercel dashboard
   - Select your project → Settings → Environment Variables
   - Add all production environment variables

5. **Add PostgreSQL**
   - Use Vercel Postgres or external provider like Supabase
   - Get connection string and add to `DATABASE_URL`

### Vercel Pricing:
- Free for hobby projects
- Pro: $20/month

---

## Option 4: DigitalOcean App Platform

Good balance of features and pricing.

### Steps:

1. **Create DigitalOcean Account**
   - Go to [digitalocean.com](https://digitalocean.com)
   - Sign up

2. **Create App**
   - Go to Apps → Create App
   - Connect GitHub repository
   - Select `CleanStreak_Simplified`

3. **Configure Backend**
   - Type: Web Service
   - Source Directory: `backend`
   - Build Command: `npm install && npx prisma generate && npx prisma migrate deploy`
   - Run Command: `npm start`
   - HTTP Port: 3000

4. **Add Database**
   - Add Resource → Database → PostgreSQL
   - Copy connection details

5. **Add Environment Variables**
   - Add all production env vars
   - Use `${db.DATABASE_URL}` for database connection

6. **Configure Frontend**
   - Add Component → Static Site
   - Source Directory: `/`
   - Output Directory: `/`

### DigitalOcean Pricing:
- $5/month for basic apps
- $12/month for database

---

## Post-Deployment Steps

### 1. Run Database Migrations

```bash
# SSH into your production backend or use platform CLI
npx prisma migrate deploy
```

### 2. Test Your Deployment

1. **API Health Check:**
   ```bash
   curl https://your-backend-url.com/api/health
   ```

2. **Test Registration:**
   - Open your frontend URL
   - Try creating an account
   - Verify email/password validation

3. **Test Authentication:**
   - Log in with test account
   - Verify JWT tokens are working
   - Check cookies are set correctly

### 3. Update Frontend API URL

If backend and frontend are on different domains, update the API base URL in `app.html`:

```javascript
// Find the API configuration section (around line 50-100)
const API_BASE_URL = 'https://your-backend-url.com';
```

### 4. Configure Custom Domain (Optional)

Most platforms support custom domains:
- Add your domain in platform settings
- Update DNS records (CNAME or A record)
- Enable SSL/TLS (usually automatic)

### 5. Set Up Monitoring

**Basic health monitoring:**
```bash
# Add to backend package.json
"scripts": {
  "health-check": "curl https://your-api-url.com/api/health"
}
```

**Use services like:**
- UptimeRobot (free tier available)
- Pingdom
- Platform-specific monitoring

### 6. Enable HTTPS Only

Ensure these are set in production `.env`:
```bash
COOKIE_SECURE=true
COOKIE_SAME_SITE=none  # For cross-domain cookies
```

### 7. Backup Database

Set up automated backups (most platforms offer this):
- Railway: Automatic backups included
- Render: Available on paid plans
- DigitalOcean: Enable automated backups

---

## Common Issues & Solutions

### Issue: CORS Errors

**Solution:** Ensure `CORS_ORIGIN` includes your frontend domain:
```bash
CORS_ORIGIN=https://your-frontend.com,https://www.your-frontend.com
```

### Issue: Database Connection Errors

**Solution:** Check:
1. DATABASE_URL is correct
2. Database is running
3. Migrations have been applied: `npx prisma migrate deploy`

### Issue: 500 Errors on API Routes

**Solution:** Check logs:
```bash
# Railway
railway logs

# Render
# Check logs in dashboard

# Vercel
vercel logs
```

### Issue: Cookies Not Working

**Solution:** Ensure:
```bash
COOKIE_SECURE=true
COOKIE_SAME_SITE=none  # For cross-domain
```

And update frontend to include credentials:
```javascript
fetch(url, {
  credentials: 'include'
})
```

---

## Security Checklist

- [ ] Generate new JWT secrets (not dev secrets!)
- [ ] Generate new cookie secret
- [ ] Enable HTTPS only
- [ ] Set `NODE_ENV=production`
- [ ] Update CORS_ORIGIN to production domain
- [ ] Enable rate limiting (already configured)
- [ ] Use strong database password
- [ ] Don't commit `.env.production` to git
- [ ] Enable database backups
- [ ] Set up monitoring/alerts

---

## Quick Start (Railway - Easiest)

1. Push code to GitHub
2. Go to [railway.app](https://railway.app)
3. New Project → Deploy from GitHub
4. Add PostgreSQL database
5. Set environment variables
6. Generate domain
7. Done! Your app is live

---

## Need Help?

- Railway Docs: https://docs.railway.app
- Render Docs: https://render.com/docs
- Vercel Docs: https://vercel.com/docs
- Prisma Deploy: https://www.prisma.io/docs/guides/deployment
