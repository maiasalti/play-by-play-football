# Deploying playbyplay.football to Netlify

This guide will walk you through deploying your NFL Live Game Simulator to **playbyplay.football** using Netlify.

## Prerequisites

✅ Domain purchased: playbyplay.football (GoDaddy)
✅ GitHub account (free)
✅ Netlify account (free) - Sign up at https://netlify.com

---

## Step 1: Push Code to GitHub

### 1.1 Initialize Git Repository (if not already done)

```bash
cd /Users/maiasalti/nfl-live-simulator
git init
git add .
git commit -m "Initial commit - NFL Live Game Simulator"
```

### 1.2 Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `nfl-live-simulator` (or `playbyplay-football`)
3. Make it **Public** or **Private** (your choice)
4. **DO NOT** initialize with README, .gitignore, or license (we already have these)
5. Click "Create repository"

### 1.3 Push to GitHub

GitHub will show you commands. Run these:

```bash
git remote add origin https://github.com/YOUR_USERNAME/nfl-live-simulator.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

---

## Step 2: Deploy to Netlify

### 2.1 Connect Netlify to GitHub

1. Go to https://app.netlify.com
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose **GitHub** as the provider
4. Authorize Netlify to access your GitHub account
5. Select your `nfl-live-simulator` repository

### 2.2 Configure Build Settings

Netlify should auto-detect the `netlify.toml` configuration. Verify these settings:

- **Build command:** (leave empty - no build needed)
- **Publish directory:** `.` (root directory)
- **Functions directory:** `netlify/functions`

Click **"Deploy site"**

### 2.3 Wait for Deployment

Netlify will:
1. Clone your repository
2. Deploy the static files
3. Set up the CORS proxy function
4. Give you a temporary URL like `random-name-12345.netlify.app`

This takes about 1-2 minutes. ✨

---

## Step 3: Connect Your Custom Domain

### 3.1 Add Domain to Netlify

1. In your Netlify site dashboard, click **"Domain settings"**
2. Click **"Add a domain"**
3. Enter: `playbyplay.football`
4. Click **"Verify"**
5. Netlify will confirm you own the domain

### 3.2 Configure DNS in GoDaddy

Netlify will show you DNS records to add. You have **two options**:

#### Option A: Use Netlify DNS (Recommended - Easier)

1. In Netlify, click **"Set up Netlify DNS"**
2. Netlify will give you **4 nameserver addresses** like:
   ```
   dns1.p01.nsone.net
   dns2.p01.nsone.net
   dns3.p01.nsone.net
   dns4.p01.nsone.net
   ```
3. Go to GoDaddy → My Products → DNS
4. Scroll to **Nameservers** section
5. Click **"Change"** → **"I'll use my own nameservers"**
6. Enter the 4 Netlify nameservers
7. Click **"Save"**

**DNS propagation takes 24-48 hours** (usually faster, ~1-2 hours)

#### Option B: Use GoDaddy DNS (More Control)

If you want to keep GoDaddy DNS:

1. In GoDaddy, go to My Products → DNS
2. Add these DNS records:

   **For the root domain (playbyplay.football):**
   - Type: `A`
   - Name: `@`
   - Value: `75.2.60.5` (Netlify's load balancer IP)
   - TTL: `600`

   **For www subdomain:**
   - Type: `CNAME`
   - Name: `www`
   - Value: `YOUR-SITE-NAME.netlify.app` (from step 2.3)
   - TTL: `3600`

3. Click **"Save"**

**DNS propagation: 1-24 hours**

### 3.3 Enable HTTPS

1. In Netlify → Domain settings
2. Scroll to **"HTTPS"**
3. Click **"Verify DNS configuration"**
4. Once DNS is configured, click **"Provision certificate"**

Netlify will automatically generate a free SSL certificate (Let's Encrypt).

---

## Step 4: Test Your Deployment

Once DNS has propagated:

1. Visit https://playbyplay.football
2. Check that the site loads correctly
3. Select a live NFL game
4. Verify the CORS proxy is working (check browser console for errors)
5. Test on mobile devices

---

## Step 5: Future Updates

To update your site:

```bash
# Make changes to your code
git add .
git commit -m "Description of changes"
git push

# Netlify will automatically rebuild and deploy!
```

Every `git push` triggers a new deployment. No manual steps needed! 🚀

---

## Troubleshooting

### CORS Proxy Not Working

Check browser console (F12) for errors. Common issues:

1. **404 on function**: Verify `netlify.toml` is in the root directory
2. **Function timeout**: ESPN API might be slow, increase timeout in `netlify.toml`
3. **Rate limiting**: ESPN might block Netlify's IP, consider caching or paid API

### Domain Not Loading

1. Check DNS propagation: https://dnschecker.org
2. Verify nameservers are correct in GoDaddy
3. Wait 24-48 hours for full propagation
4. Try clearing browser cache or incognito mode

### Site Loads but No Data

1. Check if ESPN API is down
2. Verify CORS proxy function logs in Netlify dashboard
3. Check localStorage (might have stale cache)

---

## Cost Estimate

- **Netlify (Free Tier):**
  - 100GB bandwidth/month
  - 125k function requests/month
  - Free SSL certificate
  - **Cost: $0/month** ✅

- **GoDaddy Domain:**
  - ~$10-15/year for `.football` domain

**Total: ~$1-2/month** 🎉

---

## Optional: Add Custom 404 Page

Create `404.html` in your project:

```html
<!DOCTYPE html>
<html>
<head>
    <title>404 - Page Not Found</title>
</head>
<body>
    <h1>404 - Play Not Found</h1>
    <p>This page doesn't exist. <a href="/">Return to home</a></p>
</body>
</html>
```

Netlify will automatically use it.

---

## Need Help?

- **Netlify Docs:** https://docs.netlify.com
- **Netlify Support:** https://answers.netlify.com
- **DNS Checker:** https://dnschecker.org

---

## Summary

✅ Code pushed to GitHub
✅ Deployed to Netlify
✅ CORS proxy function working
✅ Custom domain connected
✅ HTTPS enabled
✅ Auto-deploy on git push

**Your site is live at https://playbyplay.football! 🏈**
