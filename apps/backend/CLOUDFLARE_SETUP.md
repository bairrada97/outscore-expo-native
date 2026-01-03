# Cloudflare Setup Checklist

This guide covers all the Cloudflare resources and environment variables you need to configure for the Outscore API.

## 🔐 Secrets (Environment Variables)

### Required Secrets

1. **RAPIDAPI_KEY** ✅ (You're setting this now)
   ```bash
   cd apps/backend
   npx wrangler secret put RAPIDAPI_KEY
   ```
   - Your RapidAPI key for the Football API
   - Used to authenticate with `api-football-v1.p.rapidapi.com`

### Optional Secrets

2. **APPROVED_ORIGINS** (Optional)
   ```bash
   npx wrangler secret put APPROVED_ORIGINS
   ```
   - Comma-separated list of allowed CORS origins
   - Example: `https://app.outscore.com,https://www.outscore.com`
   - If not set, CORS will allow all origins

3. **NODE_ENV** (Optional)
   ```bash
   npx wrangler secret put NODE_ENV
   ```
   - Set to `production` for production environment
   - Affects bot protection strictness

4. **ENABLE_CLOUDFLARE_CHECK** (Optional)
   ```bash
   npx wrangler secret put ENABLE_CLOUDFLARE_CHECK
   ```
   - Set to `true` or `1` to enable strict Cloudflare IP checking
   - Used by bot protection middleware

5. **WORKER_ID** (Optional)
   ```bash
   npx wrangler secret put WORKER_ID
   ```
   - Unique identifier for this worker instance
   - Used for atomic operations and debugging

## 📦 Cloudflare Resources

### 1. R2 Buckets

You need to create two R2 buckets:

**Production Bucket:**
```bash
npx wrangler r2 bucket create outscore-match-data
```

**Preview/Development Bucket:**
```bash
npx wrangler r2 bucket create outscore-match-data-dev
```

These buckets are already configured in `wrangler.toml`:
- `outscore-match-data` → Production
- `outscore-match-data-dev` → Preview/Development

### 2. KV Namespaces

You need to create KV namespaces and update the IDs in `wrangler.toml`:

**Create Production KV Namespace:**
```bash
npx wrangler kv namespace create FOOTBALL_KV
```

**Create Preview KV Namespace:**
```bash
npx wrangler kv namespace create FOOTBALL_KV --preview
```

**Update `wrangler.toml`:**
After running the commands above, you'll get namespace IDs. Update lines 15-16 in `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "FOOTBALL_KV"
id = "YOUR_PRODUCTION_KV_NAMESPACE_ID"  # Replace this
preview_id = "YOUR_PREVIEW_KV_NAMESPACE_ID"  # Replace this
```

### 3. Durable Objects

Durable Objects are automatically created when you deploy. No manual setup needed, but make sure:

- The classes are exported in `src/index.ts` ✅ (Already done)
- The migrations are configured in `wrangler.toml` ✅ (Already done)

**Important:** If you're on the **free plan**, the migration uses `new_sqlite_classes` instead of `new_classes`. This is already configured in `wrangler.toml`.

**Durable Objects used:**
- `QuotaDurableObject` - For atomic quota tracking
- `RefreshSchedulerDurableObject` - For 15-second fixture refresh scheduling

### 4. Rate Limiter

**Note:** The rate limiter binding in `wrangler.toml` is currently **not used** in the code. The application uses a custom in-memory rate limiter middleware instead.

If you want to use Cloudflare's Rate Limiter binding in the future:
1. Create a rate limiter namespace in the [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Update the `namespace_id` in `wrangler.toml` (line 40) with your actual namespace ID
3. Note: Wrangler CLI doesn't support rate limiter management commands - use the Cloudflare Dashboard instead

For now, you can **ignore this configuration** - it won't affect your deployment.

## 🚀 Deployment Steps

1. **Set all secrets** (see above)

2. **Create R2 buckets:**
   ```bash
   npx wrangler r2 bucket create outscore-match-data
   npx wrangler r2 bucket create outscore-match-data-dev
   ```

3. **Create KV namespaces and update `wrangler.toml`:**
   ```bash
   npx wrangler kv namespace create FOOTBALL_KV
   npx wrangler kv namespace create FOOTBALL_KV --preview
   ```
   Then update the IDs in `wrangler.toml`

4. **Deploy the worker:**
   ```bash
   cd apps/backend
   npx wrangler deploy
   ```

## ✅ Verification

After deployment, verify everything works:

1. **Health check:**
   ```bash
   curl https://outscore-api.YOUR_SUBDOMAIN.workers.dev/health
   ```

2. **Test fixtures endpoint:**
   ```bash
   curl https://outscore-api.YOUR_SUBDOMAIN.workers.dev/fixtures?date=2025-01-15&timezone=UTC
   ```

3. **Check logs:**
   ```bash
   npx wrangler tail
   ```

## 📝 Notes

- **Secrets** are encrypted and only accessible at runtime
- **R2 buckets** store match data (cold storage)
- **KV namespaces** store hot data (today's matches)
- **Durable Objects** handle atomic operations and scheduling
- **Rate Limiter** helps prevent abuse (currently configured but not actively used in code)

## 🔍 Current Configuration Status

Based on `wrangler.toml`:

- ✅ Worker name: `outscore-api`
- ✅ R2 buckets: Configured (need to be created)
- ⚠️ KV namespaces: IDs need to be updated after creation
- ✅ Durable Objects: Configured (auto-created on deploy)
- ⚠️ Rate Limiter: Namespace ID `1001` may need verification
- ✅ Cron trigger: Configured (every minute as failsafe)
- ✅ Observability: Enabled

