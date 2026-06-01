# Supabase OAuth Setup — Fix "localhost" redirect

The "site can't be reached localhost:3000" error happens because Supabase
doesn't know your live deployment URL. Fix it in 2 minutes:

## Step 1 — Set your Site URL

1. Open your Supabase project dashboard
2. Go to: **Authentication → URL Configuration**
3. Set **Site URL** to your Vercel URL:
   ```
   https://your-app-name.vercel.app
   ```

## Step 2 — Add Redirect URLs

In the same page, under **Redirect URLs**, click **Add URL** and add:
```
https://your-app-name.vercel.app/auth/callback
```

If you have a custom domain, add that too:
```
https://yourdomain.com/auth/callback
```

## Step 3 — Save & redeploy

Click Save. Redeploy on Vercel (or it picks up automatically).

## Why this happened

The app code uses `window.location.origin` (your real URL) for the redirect —
it never sends to localhost. But Supabase blocks any redirect URL that isn't
whitelisted in your dashboard. Once you add your Vercel URL above, it works.

## Vercel environment variables

Make sure these are set in Vercel → Settings → Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL       = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = your-anon-key
```
