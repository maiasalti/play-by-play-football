# Deploy to Azure Static Web Apps via VS Code

Complete guide to deploying **playbyplay.football** using Visual Studio Code.

## Prerequisites

- ✅ Visual Studio Code installed
- ✅ GitHub account (free)
- ✅ Azure account (free tier) - Sign up at https://azure.microsoft.com/free
- ✅ Domain: playbyplay.football (GoDaddy)

---

## Step 1: Install VS Code Extensions

### 1.1 Open VS Code
```bash
code /Users/maiasalti/nfl-live-simulator
```

### 1.2 Install Required Extensions

Click the Extensions icon (left sidebar) or press `Cmd+Shift+X`, then install:

1. **Azure Static Web Apps** (by Microsoft)
   - Search: "Azure Static Web Apps"
   - Click "Install"

2. **GitHub Pull Requests and Issues** (optional, helpful)
   - For GitHub integration

---

## Step 2: Push to GitHub (If Not Done)

### 2.1 Check Git Status

In VS Code terminal (`Ctrl+~` or `Cmd+~`):

```bash
git status
```

If you see "nothing to commit", you're good! Otherwise:

```bash
git add .
git commit -m "Ready for Azure deployment"
```

### 2.2 Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `nfl-live-simulator`
3. Set to **Public** (required for free Azure tier)
4. **DO NOT** initialize with README
5. Click "Create repository"

### 2.3 Push Code

In VS Code terminal:

```bash
# Replace YOUR_USERNAME with your GitHub username
git remote add origin https://github.com/YOUR_USERNAME/nfl-live-simulator.git
git branch -M main
git push -u origin main
```

---

## Step 3: Deploy to Azure Static Web Apps

### 3.1 Open Azure Extension

1. Click the **Azure icon** in VS Code left sidebar (looks like an "A")
2. Click "Sign in to Azure"
3. Follow the login flow in your browser
4. Return to VS Code

### 3.2 Create Static Web App

1. In Azure sidebar, expand **"Static Web Apps"**
2. Click the **"+"** icon (Create Static Web App)
3. You'll see a series of prompts at the top of VS Code:

   **Subscription:**
   - Select your Azure subscription (usually "Free Trial" or "Pay-As-You-Go")

   **Name for Static Web App:**
   - Enter: `playbyplay-football`

   **Region:**
   - Choose closest to your users (e.g., "West US 2", "East US 2")

   **Build preset:**
   - Select: **"Custom"**

   **Location of application code:**
   - Enter: `/` (root directory)

   **Build output location:**
   - Enter: `/` (root directory)

   **GitHub repository:**
   - Select your `nfl-live-simulator` repository

4. Azure will:
   - Create the Static Web App resource
   - Set up GitHub Actions for auto-deployment
   - Deploy your site
   - Takes 2-3 minutes

### 3.3 Monitor Deployment

1. In VS Code, you'll see output in the terminal
2. Or go to your GitHub repo → **Actions** tab
3. You'll see a workflow running: "Azure Static Web Apps CI/CD"
4. Click to see live deployment logs

### 3.4 Get Your URL

Once deployed:
1. In VS Code Azure sidebar → Static Web Apps
2. Right-click your app → **"Browse Site"**
3. Your site opens at: `https://playbyplay-football-RANDOM.azurestaticapps.net`

---

## Step 4: Add Azure Function (CORS Proxy)

Azure Static Web Apps can host serverless functions similar to Netlify.

### 4.1 Create Azure Functions Directory

In VS Code terminal:

```bash
mkdir -p api
```

### 4.2 Create Function File

I'll create this file for you in the next step.

### 4.3 Update Configuration

The `staticwebapp.config.json` file (I'll create) tells Azure how to route requests.

---

## Step 5: Connect GoDaddy Domain

### 5.1 Open Azure Portal

1. Go to https://portal.azure.com
2. Sign in with your Azure account
3. Search for **"Static Web Apps"** in the top search bar
4. Click on your app: `playbyplay-football`

### 5.2 Add Custom Domain

1. In the left menu, click **"Custom domains"**
2. Click **"+ Add"**
3. Select **"Custom domain on other DNS"**
4. Enter domain: `playbyplay.football`
5. Click **"Next"**

### 5.3 Get DNS Records

Azure will show you records to add:

**Option A: CNAME (Recommended)**
- Type: `CNAME`
- Name: `@` or `www`
- Value: `playbyplay-football-RANDOM.azurestaticapps.net`

**Option B: TXT (for root domain verification)**
- Type: `TXT`
- Name: `@`
- Value: `RANDOM-VERIFICATION-CODE`

### 5.4 Configure in GoDaddy

1. Go to https://dcc.godaddy.com/
2. Find **playbyplay.football** → Click "DNS"
3. Scroll to **"Records"** section

#### For Root Domain (playbyplay.football):

Since GoDaddy doesn't support CNAME for root domains, use **A records**:

1. Click **"Add"** → Select **"A"**
2. Settings:
   - Name: `@`
   - Value: Get from Azure (they'll show the IP)
   - TTL: `600`
3. Click **"Save"**

#### For www subdomain:

1. Click **"Add"** → Select **"CNAME"**
2. Settings:
   - Name: `www`
   - Value: `playbyplay-football-RANDOM.azurestaticapps.net`
   - TTL: `3600`
3. Click **"Save"**

#### Verification TXT Record:

1. Click **"Add"** → Select **"TXT"**
2. Settings:
   - Name: `@`
   - Value: (paste the verification code from Azure)
   - TTL: `600`
3. Click **"Save"**

### 5.5 Verify in Azure

1. Back in Azure Portal → Custom domains
2. Click **"Validate"**
3. If DNS has propagated, it will show "Valid"
4. Click **"Add"**

**DNS Propagation: 15 minutes to 24 hours** (usually 1-2 hours)

Check status: https://dnschecker.org/?domain=playbyplay.football

---

## Step 6: Enable HTTPS

Azure automatically provisions SSL certificates for custom domains.

1. In Azure Portal → Your Static Web App
2. Go to **"Custom domains"**
3. Wait for **"Certificate status"** to show **"Provisioning"** → **"Ready"**
4. Takes 5-15 minutes after DNS validation

---

## Step 7: Future Updates

### Deploy Updates Automatically

Every time you push to GitHub, Azure auto-deploys!

```bash
# Make changes to your code
git add .
git commit -m "Update description"
git push

# GitHub Actions triggers automatic deployment
# Check progress: GitHub repo → Actions tab
```

### Manual Deployment from VS Code

1. Right-click your app in Azure sidebar
2. Click **"Deploy to Static Web App"**
3. Select your GitHub branch: `main`

---

## Configuration Files

Azure needs these configuration files (I'll create them for you):

### `staticwebapp.config.json`
- Routes
- Function APIs
- Headers
- Redirects

### `api/cors-proxy/function.json`
- Azure Function definition

### `api/cors-proxy/index.js`
- CORS proxy logic

---

## Troubleshooting

### Site not loading after deployment

1. Check GitHub Actions: Repo → Actions → Look for errors
2. Check Azure logs: Portal → Static Web App → Monitoring → Application Insights
3. Clear browser cache

### Custom domain not working

1. Verify DNS with: https://dnschecker.org
2. Check DNS records in GoDaddy match Azure's instructions
3. Wait up to 48 hours for full propagation
4. Try incognito/private browsing mode

### CORS errors with ESPN API

1. Check function logs in Azure Portal
2. Verify `api/cors-proxy/index.js` deployed correctly
3. Check Application Insights for function errors

### SSL certificate not provisioning

1. Make sure DNS is fully propagated
2. TXT record must be present for verification
3. Can take up to 24 hours
4. Contact Azure support if stuck

---

## Cost (Free Tier Limits)

Azure Static Web Apps Free Tier:
- ✅ **100 GB bandwidth/month**
- ✅ **2 custom domains**
- ✅ **Free SSL certificates**
- ✅ **Azure Functions included** (1 million requests/month)
- ✅ **GitHub Actions included**

**Total Cost: $0/month** 🎉

(Only the domain costs ~$10-15/year)

---

## Monitoring Your Site

### Via Azure Portal

1. Go to https://portal.azure.com
2. Navigate to your Static Web App
3. Click **"Application Insights"** (if enabled)
4. View:
   - Request rates
   - Response times
   - Errors
   - Custom events

### Via VS Code

1. Azure sidebar → Your app
2. Right-click → **"View Logs"**

---

## Next Steps After Deployment

1. ✅ Test site: https://playbyplay.football
2. ✅ Verify CORS proxy works (select a live game)
3. ✅ Test on mobile devices
4. ✅ Share with friends! 🏈

---

## Quick Reference Commands

```bash
# View current deployment status
git status

# Deploy changes
git add .
git commit -m "Your message"
git push

# View Azure logs (in VS Code)
# Azure sidebar → Right-click app → View Logs

# Check DNS propagation
# Visit: https://dnschecker.org/?domain=playbyplay.football
```

---

## Support

- **Azure Docs:** https://docs.microsoft.com/en-us/azure/static-web-apps/
- **VS Code Extension:** https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azurestaticwebapps
- **Azure Support:** https://portal.azure.com → Help + support

---

**You're all set! Your NFL simulator will be live at playbyplay.football** 🏈
