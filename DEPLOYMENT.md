# Smart Hammer — Azure Deployment Guide

> **Stack:** React + Vite (frontend) | Node.js + Express + Socket.io (backend) | PostgreSQL
> **Subscription:** Azure for Students ($100 credit)
> **Services used:** App Service B1 | Static Web Apps (Free) | PostgreSQL Flexible Server | Blob Storage (Free 5GB)

---

## Table of Contents
1. [Push Code to Azure Repos](#1-push-code-to-azure-repos)
2. [Create Azure Resources](#2-create-azure-resources)
3. [Setup Azure Blob Storage (for image uploads)](#3-setup-azure-blob-storage)
4. [Configure Database](#4-configure-database)
5. [Setup Azure DevOps Pipeline](#5-setup-azure-devops-pipeline)
6. [Configure Variable Groups (Secrets)](#6-configure-variable-groups)
7. [Enable WebSockets on App Service](#7-enable-websockets)
8. [Run Your First Deployment](#8-run-your-first-deployment)
9. [Verify Everything Works](#9-verify-everything-works)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Push Code to Azure Repos

If your code is not yet pushed, run these commands from the project root:

```bash
# If you already have an Azure Repos remote, just push:
git add .
git commit -m "chore: add Azure DevOps pipeline and deployment config"
git push origin main
```

If you need to add the remote first:
```bash
git remote add origin https://dev.azure.com/YOUR_ORG/smart-hammer/_git/smart-hammer
git push -u origin main
```

> **Find your repo URL:** Azure DevOps → your project → Repos → Clone → HTTPS URL

---

## 2. Create Azure Resources

### 2a. Login to Azure Portal
Go to https://portal.azure.com and sign in with your student account.

### 2b. Create a Resource Group
A resource group keeps all your app's resources together.

1. Search **"Resource groups"** → **Create**
2. Fill in:
   - **Subscription:** Azure for Students
   - **Resource group name:** `smart-hammer-rg`
   - **Region:** `East US` (or closest to you — South India is a good choice)
3. Click **Review + create** → **Create**

---

### 2c. Create Azure App Service (Backend — Node.js)

> ⚠️ **Must use B1 tier** — the free F1 tier does NOT support WebSockets (required for Socket.io).
> B1 costs ~$13.14/month and is covered by your $100 student credit.

1. Search **"App Services"** → **Create** → **Web App**
2. Fill in:
   - **Subscription:** Azure for Students
   - **Resource Group:** `smart-hammer-rg`
   - **Name:** `smart-hammer-api` *(must be globally unique — try `smart-hammer-api-yourname`)*
   - **Publish:** Code
   - **Runtime stack:** Node 20 LTS
   - **Operating System:** Linux
   - **Region:** East US (same as your resource group)
3. **App Service Plan:** Create new
   - Name: `smart-hammer-plan`
   - Pricing Tier: **B1** (Basic)
4. Click **Review + create** → **Create**
5. After creation, note your URL: `https://smart-hammer-api.azurewebsites.net`

---

### 2d. Create Azure Static Web Apps (Frontend — React)

> ✅ **Free tier** — no cost, includes global CDN

1. Search **"Static Web Apps"** → **Create**
2. Fill in:
   - **Subscription:** Azure for Students
   - **Resource Group:** `smart-hammer-rg`
   - **Name:** `smart-hammer-web`
   - **Hosting Plan:** Free
   - **Region:** East US 2
   - **Source:** Other *(we deploy via Azure DevOps pipeline, not GitHub Actions)*
3. Click **Review + create** → **Create**
4. After creation, go to the resource → **Manage deployment token** → Copy the token (you'll need it later)

---

### 2e. Create Azure Database for PostgreSQL

> ⚠️ Uses student credit (~$12-25/month depending on tier). Use Burstable B1ms for lowest cost.

1. Search **"Azure Database for PostgreSQL"** → **Create** → **Flexible Server**
2. Fill in:
   - **Subscription:** Azure for Students
   - **Resource Group:** `smart-hammer-rg`
   - **Server name:** `smart-hammer-db` *(globally unique)*
   - **Region:** East US
   - **PostgreSQL version:** 16
   - **Workload type:** Development
3. **Compute + storage:**
   - Compute tier: **Burstable**
   - Compute size: **Standard_B1ms** (cheapest — ~$12/month)
   - Storage: 32 GB
4. **Authentication:**
   - Auth method: PostgreSQL authentication only
   - Admin username: `smarthammer_admin`
   - Password: Choose a strong password and **save it somewhere safe**
5. **Networking tab:**
   - Connectivity method: Public access
   - ✅ Check **"Allow public access from any Azure service"**
   - Add your current IP so you can connect to it locally
6. Click **Review + create** → **Create** (takes ~5 minutes)
7. After creation, note your **Server name**: `smart-hammer-db.postgres.database.azure.com`

---

## 3. Setup Azure Blob Storage

> ✅ **Free for Azure for Students** — 5 GB Locally Redundant Storage (LRS) for 12 months

### 3a. Create Storage Account
1. Search **"Storage accounts"** → **Create**
2. Fill in:
   - **Resource group:** `smart-hammer-rg`
   - **Storage account name:** `smarthammerstorage` *(lowercase, no hyphens)*
   - **Region:** East US
   - **Performance:** Standard
   - **Redundancy:** LRS (Locally-redundant storage)
3. Click **Review + create** → **Create**

### 3b. Create a Container for Images
1. Open your storage account → **Containers** (left sidebar) → **+ Container**
2. Name: `uploads`
3. Public access level: **Blob** (allows public read of images — needed for displaying auction images)
4. Click **Create**

### 3c. Get Connection String
1. In your storage account → **Access keys** (left sidebar)
2. Copy **Connection string** for key1 — you'll need this later

### 3d. Update Server Upload Middleware
After getting the connection string, you'll need to update the server to use Azure Blob Storage instead of local disk. See the `server/middleware/upload.azure.js` note at the bottom of this guide.

---

## 4. Configure Database

### 4a. Create the Database
Connect to your Azure PostgreSQL server using **psql** or **pgAdmin**:

```
Host:     smart-hammer-db.postgres.database.azure.com
Port:     5432
Database: postgres (default)
Username: smarthammer_admin
Password: [your password]
SSL:      Required
```

Using psql:
```bash
psql "host=smart-hammer-db.postgres.database.azure.com port=5432 dbname=postgres user=smarthammer_admin password=YOUR_PASSWORD sslmode=require"
```

### 4b. Create Database and Run Schema
```sql
-- Create the database
CREATE DATABASE smart_hammer;

-- Connect to it
\c smart_hammer

-- Exit, then reconnect to smart_hammer database and run schema:
\q
```

```bash
# Run the schema file
psql "host=smart-hammer-db.postgres.database.azure.com port=5432 dbname=smart_hammer user=smarthammer_admin password=YOUR_PASSWORD sslmode=require" -f server/schema.sql
```

### 4c. Firewall Rule
Make sure the App Service can reach the database:
1. Azure Portal → your PostgreSQL server → **Networking**
2. ✅ **"Allow public access from any Azure service within Azure to this server"** — ensure this is ON

---

## 5. Setup Azure DevOps Pipeline

### 5a. Open Azure DevOps
Go to https://dev.azure.com → your organization → your **smart-hammer** project

### 5b. Create Service Connection (for App Service)
1. **Project Settings** (bottom-left gear icon) → **Service connections** → **New service connection**
2. Choose **Azure Resource Manager** → **Next**
3. Authentication method: **Service principal (automatic)**
4. Scope level: **Subscription**
5. Select your **Azure for Students** subscription
6. Resource group: `smart-hammer-rg`
7. Service connection name: `smart-hammer-azure-connection`
8. ✅ Grant access permission to all pipelines
9. Click **Save**

### 5c. Create the Pipeline
1. **Pipelines** (left sidebar) → **New pipeline**
2. Where is your code? → **Azure Repos Git**
3. Select repository: **smart-hammer**
4. Configure: **Existing Azure Pipelines YAML file**
5. Branch: `main`
6. Path: `/azure-pipelines.yml`
7. Click **Continue** → **Save** (don't run yet — set variables first)

---

## 6. Configure Variable Groups

Variable groups store your secrets safely so they're never in the code.

### 6a. Create Variable Group
1. **Pipelines** → **Library** → **+ Variable group**
2. Name: `smart-hammer-vars`

### 6b. Add These Variables

| Variable Name | Value | Secret? |
|---|---|---|
| `AZURE_SERVICE_CONNECTION` | `smart-hammer-azure-connection` | No |
| `APP_SERVICE_NAME` | `smart-hammer-api` *(your App Service name)* | No |
| `STATIC_WEB_APP_TOKEN` | *(paste the deployment token from step 2d)* | **Yes** 🔒 |
| `VITE_API_URL` | `https://smart-hammer-api.azurewebsites.net/api` | No |
| `VITE_SOCKET_URL` | `https://smart-hammer-api.azurewebsites.net` | No |

> For each secret, click the 🔒 lock icon to make it a secret (masked in logs).

3. Click **Save**

### 6c. Link Variable Group to Pipeline
1. Open your pipeline → **Edit** → **Variables** → **Variable groups**
2. Link `smart-hammer-vars`
3. Save

### 6d. Set App Service Environment Variables
Go to Azure Portal → App Service `smart-hammer-api` → **Configuration** → **Application settings** → **+ New application setting**

Add each of these:

| Name | Value |
|---|---|
| `PORT` | `8080` |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgresql://smarthammer_admin:YOUR_PASSWORD@smart-hammer-db.postgres.database.azure.com:5432/smart_hammer?sslmode=require` |
| `JWT_SECRET` | `your-super-secret-jwt-key-min-32-chars` |
| `JWT_EXPIRES_IN` | `7d` |
| `CLIENT_URL` | `https://YOUR_STATIC_WEB_APP_URL.azurestaticapps.net` |
| `AZURE_STORAGE_CONNECTION_STRING` | *(your Blob Storage connection string from step 3c)* |
| `AZURE_STORAGE_CONTAINER` | `uploads` |

> Click **Save** at the top after adding all settings. The App Service will restart automatically.

---

## 7. Enable WebSockets

> ⚠️ **This step is critical for Socket.io real-time bidding to work.**

1. Azure Portal → App Service `smart-hammer-api`
2. **Configuration** → **General settings** tab
3. **Web sockets:** Toggle to **On**
4. **ARR Affinity:** **On** (keeps WebSocket sessions sticky)
5. Click **Save**

---

## 8. Run Your First Deployment

1. Go to Azure DevOps → **Pipelines** → your pipeline
2. Click **Run pipeline** → **Run**
3. Watch the pipeline run (~5-8 minutes total):
   - ✅ Build Node.js Server
   - ✅ Build React Client
   - ✅ Deploy to App Service
   - ✅ Deploy to Static Web Apps

> **First run:** Azure DevOps will ask you to approve the `production` environment. Click **Permit** when prompted.

---

## 9. Verify Everything Works

### Backend Health Check
Open in browser:
```
https://smart-hammer-api.azurewebsites.net/api/health
```
Expected response:
```json
{
  "success": true,
  "status": "healthy",
  "database": "connected"
}
```

### Frontend
Open your Static Web Apps URL:
```
https://YOUR_APP.azurestaticapps.net
```

### Full Flow Test
1. Register as a Buyer
2. Login
3. Browse auctions
4. Open auction detail — check console for "Socket connected: ..."
5. Place a bid — verify real-time update

---

## 10. Troubleshooting

### Pipeline fails: "AzureWebApp task — service connection not found"
→ Verify the `AZURE_SERVICE_CONNECTION` variable matches your service connection name exactly.

### Backend 503 / App Service won't start
1. Go to App Service → **Log stream** (real-time logs)
2. Common causes:
   - Wrong `DATABASE_URL` — check the connection string format
   - Missing env variable — double-check all Application Settings

### "Socket disconnected" / WebSocket errors
→ Ensure **Web sockets: On** in App Service General Settings (Step 7)

### React Router 404 on page refresh
→ The `staticwebapp.config.json` in `client/public/` fixes this — ensure it was deployed

### Images not loading after deploy
→ Local `server/uploads/` is not persistent on App Service. Use Azure Blob Storage.
   The connection string in `AZURE_STORAGE_CONNECTION_STRING` must be set correctly.

### PostgreSQL SSL error
→ Add `?sslmode=require` to the end of `DATABASE_URL`

---

## Cost Estimate (Azure for Students)

| Service | Tier | Monthly Cost |
|---|---|---|
| App Service | B1 Basic | ~$13.14 |
| Static Web Apps | Free | $0.00 |
| PostgreSQL Flexible | B1ms Burstable | ~$12.41 |
| Blob Storage | LRS (free 5GB) | $0.00 |
| **Total** | | **~$25.55/month** |

> Your $100 student credit covers ~4 months. After credit runs out, you pay normally.
> **Tip:** Stop the App Service and PostgreSQL when not in use to save credits.

---

## Quick Commands Reference

```bash
# Push latest changes (triggers auto-deploy)
git add .
git commit -m "your message"
git push origin main

# Check App Service logs
az webapp log tail --name smart-hammer-api --resource-group smart-hammer-rg

# Restart App Service
az webapp restart --name smart-hammer-api --resource-group smart-hammer-rg

# Stop App Service (save credits)
az webapp stop --name smart-hammer-api --resource-group smart-hammer-rg

# Start App Service
az webapp start --name smart-hammer-api --resource-group smart-hammer-rg
```
