# Deploy to Vercel (Easiest Method!)

Deploy **playbyplay.football** to Vercel in under 10 minutes. This is the simplest deployment option.

## Why Vercel?

✅ **Easiest deployment** - Just connect GitHub and click deploy
✅ **Free tier** - 100GB bandwidth, unlimited requests
✅ **Auto SSL** - Free HTTPS certificates
✅ **Instant deploys** - Every git push auto-deploys
✅ **Best performance** - Global CDN with edge caching
✅ **Simple UI** - No complicated configurations

---

## Prerequisites

- ✅ GitHub account (free)
- ✅ Vercel account (free) - Sign up at https://vercel.com
- ✅ Domain: playbyplay.football (GoDaddy)

---

## Step 1: Push to GitHub (If Not Done)

### 1.1 Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `nfl-live-simulator`
3. Set to **Public** or **Private** (both work with Vercel)
4. **DO NOT** initialize with README
5. Click "Create repository"

### 1.2 Push Your Code

In terminal:

```bash
cd /Users/maiasalti/nfl-live-simulator

# If remote not set:
git remote add origin https://github.com/YOUR_USERNAME/nfl-live-simulator.git

# Push to GitHub
git push -u origin main
```

---

## Step 2: Deploy to Vercel (3 minutes!)

### 2.1 Sign Up / Log In

1. Go to https://vercel.com
2. Click **"Sign Up"** (or "Log In" if you have an account)
3. Choose **"Continue with GitHub"**
4. Authorize Vercel to access your GitHub

### 2.2 Import Your Repository

1. Click **"Add New..."** → **"Project"**
2. Find `nfl-live-simulator` in the list
3. Click **"Import"**

### 2.3 Configure Project

Vercel auto-detects everything from `vercel.json`, but verify:

- **Framework Preset:** Other (or None)
- **Root Directory:** `./` (leave default)
- **Build Command:** (leave empty)
- **Output Directory:** (leave empty)
- **Install Command:** (leave empty)

Click **"Deploy"**

### 2.4 Wait for Deployment

- Takes 30-60 seconds
- You'll see a fancy animation
- When done, you'll see: **"Congratulations! 🎉"**

### 2.5 Your Site Is Live!

Vercel gives you a URL:
```
https://nfl-live-simulator-RANDOM.vercel.app
```

Click **"Visit"** to test it!

---

## Step 3: Connect Your Custom Domain (5 minutes)

### 3.1 Add Domain in Vercel

1. In your Vercel project dashboard
2. Click **"Settings"** (top menu)
3. Click **"Domains"** (left sidebar)
4. Enter: `playbyplay.football`
5. Click **"Add"**

### 3.2 Vercel Shows You DNS Records

You'll see instructions for two options. Choose **Option A** (easier):

**Option A: Point domain to Vercel (Recommended)**

Vercel will show:
- **Type:** `A`
- **Name:** `@`
- **Value:** `76.76.21.21` (Vercel's IP)

And:
- **Type:** `CNAME`
- **Name:** `www`
- **Value:** `cname.vercel-dns.com`

### 3.3 Configure DNS in GoDaddy

1. Go to https://dcc.godaddy.com/
2. Find **playbyplay.football** → Click **"DNS"**
3. Delete any existing `A` or `CNAME` records for `@` and `www`

**Add A Record (root domain):**
1. Click **"Add"** → Select **"A"**
2. Settings:
   - **Name:** `@`
   - **Value:** `76.76.21.21`
   - **TTL:** `600` (10 minutes)
3. Click **"Save"**

**Add CNAME Record (www subdomain):**
1. Click **"Add"** → Select **"CNAME"**
2. Settings:
   - **Name:** `www`
   - **Value:** `cname.vercel-dns.com`
   - **TTL:** `3600` (1 hour)
3. Click **"Save"**

### 3.4 Verify in Vercel

1. Back in Vercel → Domains section
2. Click **"Refresh"** or wait 1-2 minutes
3. Status will change from "Invalid Configuration" → "Valid Configuration"
4. Vercel automatically provisions SSL certificate (takes 5-10 minutes)

### 3.5 Wait for DNS Propagation

- **Time:** 15 minutes to 24 hours (usually 30-60 minutes)
- **Check status:** https://dnschecker.org/?domain=playbyplay.football

Once all regions show green checkmarks, your site is live!

---

## Step 4: Test Your Deployment

1. Visit https://playbyplay.football
2. Verify the site loads
3. Click on a live game (if available)
4. Check browser console (F12) - should see no CORS errors
5. Test on mobile device

---

## Step 5: Future Updates (Auto-Deploy)

Every time you push to GitHub, Vercel **automatically deploys**!

```bash
# Make changes to your code
git add .
git commit -m "Update description"
git push

# Vercel automatically:
# 1. Detects the push
# 2. Builds the site
# 3. Deploys to production
# 4. Live in 30 seconds!
```

### Monitor Deployments

1. Go to https://vercel.com/dashboard
2. Click your project
3. See deployment status in real-time
4. Click any deployment to see logs

---

## Configuration Files

Vercel uses these configuration files (already created):

### `vercel.json`
```json
{
  "version": 2,
  "builds": [
    { "src": "index.html", "use": "@vercel/static" },
    { "src": "api/**/*.js", "use": "@vercel/node" }
  ],
  "routes": [...]
}
```

### `/api/cors-proxy.js`
Serverless function that proxies ESPN API requests.

---

## Vercel Dashboard Features

### Production URL
- Main domain: `playbyplay.football`
- Also works: `nfl-live-simulator.vercel.app`

### Preview Deployments
- Every branch gets a unique URL
- Great for testing before merging to main

### Analytics (Optional)
- Enable in Settings → Analytics
- See visitor stats, page views, etc.

### Environment Variables (If Needed)
- Settings → Environment Variables
- Add API keys securely
- Currently not needed for ESPN API

---

## Troubleshooting

### Site not loading

1. **Check deployment status:** Vercel dashboard → Deployments
2. **View build logs:** Click on the deployment → "Building" tab
3. **Common issue:** Make sure `index.html` exists in root directory

### Custom domain not working

1. **Verify DNS:** https://dnschecker.org
2. **Check GoDaddy records:**
   - `@` → A → `76.76.21.21`
   - `www` → CNAME → `cname.vercel-dns.com`
3. **Wait longer:** DNS can take up to 48 hours
4. **Clear browser cache:** Try incognito mode

### CORS errors with ESPN API

1. **Check function logs:** Vercel dashboard → Your project → Logs tab
2. **Verify function deployed:** Should see `/api/cors-proxy.js` in Functions tab
3. **Test function directly:** Visit `https://playbyplay.football/api/cors-proxy?url=https://site.api.espn.com/...`

### SSL certificate not working

1. **Wait:** Can take 5-15 minutes after DNS validation
2. **Check status:** Vercel dashboard → Settings → Domains
3. **Should show:** "SSL Certificate: Active"

### Deployment failed

1. **View logs:** Click the failed deployment → "Building" tab
2. **Common fixes:**
   - Make sure `vercel.json` is valid JSON
   - Verify `api/cors-proxy.js` has no syntax errors
   - Try re-deploying: Deployments → Click "..." → "Redeploy"

---

## Cost (Free Tier Limits)

Vercel Free Tier (Hobby):
- ✅ **100 GB bandwidth/month** (more than enough)
- ✅ **100 GB-hours serverless function execution**
- ✅ **Unlimited websites**
- ✅ **Unlimited API routes**
- ✅ **Free SSL certificates**
- ✅ **Global CDN**
- ✅ **Automatic HTTPS**

**Estimated usage for this app:**
- Static files: ~5 MB
- API calls: ~1000/day max
- Well within free tier! ✅

**Total Cost: $0/month** 🎉

(Only the domain costs ~$10-15/year)

---

## Performance Optimization

Vercel automatically optimizes:
- ✅ **Compression:** Gzip/Brotli for all assets
- ✅ **Caching:** Smart cache headers
- ✅ **CDN:** Files served from 70+ edge locations worldwide
- ✅ **HTTP/2:** Faster loading
- ✅ **Image optimization:** (if you add images later)

---

## Using Vercel CLI (Optional)

For advanced users:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from terminal
cd /Users/maiasalti/nfl-live-simulator
vercel

# Deploy to production
vercel --prod
```

---

## Comparison: Vercel vs Netlify vs Azure

| Feature | Vercel | Netlify | Azure |
|---------|--------|---------|-------|
| Ease of Use | ⭐⭐⭐⭐⭐ Easiest | ⭐⭐⭐⭐ Easy | ⭐⭐⭐ Moderate |
| Free Tier | 100GB | 100GB | 100GB |
| Functions | ✅ Built-in | ✅ Built-in | ✅ Built-in |
| Custom Domain | ✅ Free SSL | ✅ Free SSL | ✅ Free SSL |
| Auto Deploy | ✅ Instant | ✅ Fast | ✅ Fast |
| Best For | Next.js, Static | JAMstack | Enterprise |

**Recommendation: Use Vercel!** 🏆 (Simplest and fastest)

---

## Next Steps After Deployment

1. ✅ Test site: https://playbyplay.football
2. ✅ Verify CORS proxy works
3. ✅ Test on mobile
4. ✅ Share with friends! 🏈
5. Consider adding:
   - Custom 404 page
   - Favicon
   - Analytics
   - SEO meta tags

---

## Quick Reference

```bash
# Deploy updates
git add .
git commit -m "Your message"
git push
# Vercel auto-deploys in 30 seconds!

# View logs
# Vercel dashboard → Your project → Logs

# Check DNS
# https://dnschecker.org/?domain=playbyplay.football
```

---

## Support

- **Vercel Docs:** https://vercel.com/docs
- **Community:** https://github.com/vercel/vercel/discussions
- **Support:** https://vercel.com/support

---

## Summary

1. Push code to GitHub ✅
2. Import to Vercel (3 clicks) ✅
3. Add custom domain in Vercel ✅
4. Configure DNS in GoDaddy ✅
5. Wait for SSL (automatic) ✅
6. Site live at https://playbyplay.football! 🏈

**Total time: ~10 minutes** (plus DNS wait time)

---

**You're all set! Enjoy your live NFL simulator!** 🎉
