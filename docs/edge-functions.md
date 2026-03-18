# Edge Function Deploy And Test Commands

This project uses these Supabase Edge Functions:

- `resolve-wordpress-post-id`
- `sync-codes`
- `sync-letroso`
- `sync-nyt-puzzles`

Project ref used below:

```bash
wffqfwfcpiqpqmhbyhlz
```

Project URL used below:

```bash
https://wffqfwfcpiqpqmhbyhlz.supabase.co
```

## Before Deploying

Log in once on this Mac:

```bash
supabase login
```

All deploy commands below use `--use-api` because these functions use shared code under `supabase/functions/_shared`.

## Re-Deploy All Edge Functions

Run these from the repo root:

```bash
supabase functions deploy resolve-wordpress-post-id --use-api --no-verify-jwt --project-ref wffqfwfcpiqpqmhbyhlz
supabase functions deploy sync-codes --use-api --no-verify-jwt --project-ref wffqfwfcpiqpqmhbyhlz
supabase functions deploy sync-letroso --use-api --no-verify-jwt --project-ref wffqfwfcpiqpqmhbyhlz
supabase functions deploy sync-nyt-puzzles --use-api --no-verify-jwt --project-ref wffqfwfcpiqpqmhbyhlz
```

If you changed only one function, you only need to re-deploy that one function.

## Test `sync-codes`

Dry-run test:

```bash
curl -sS -X POST \
  'https://wffqfwfcpiqpqmhbyhlz.supabase.co/functions/v1/sync-codes' \
  -H 'Content-Type: application/json' \
  -H 'X-Webhook-Secret: YOUR_SYNC_CODES_WEBHOOK_SECRET' \
  --data '{"dryRun":true,"limit":1}'
```

Real run:

```bash
curl -sS -X POST \
  'https://wffqfwfcpiqpqmhbyhlz.supabase.co/functions/v1/sync-codes' \
  -H 'Content-Type: application/json' \
  -H 'X-Webhook-Secret: YOUR_SYNC_CODES_WEBHOOK_SECRET' \
  --data '{"limit":1}'
```

## Test `sync-letroso`

Dry-run test:

```bash
curl -sS -X POST \
  'https://wffqfwfcpiqpqmhbyhlz.supabase.co/functions/v1/sync-letroso' \
  -H 'Content-Type: application/json' \
  -H 'X-Webhook-Secret: YOUR_SYNC_LETROSO_WEBHOOK_SECRET' \
  --data '{"dryRun":true}'
```

Real run:

```bash
curl -sS -X POST \
  'https://wffqfwfcpiqpqmhbyhlz.supabase.co/functions/v1/sync-letroso' \
  -H 'Content-Type: application/json' \
  -H 'X-Webhook-Secret: YOUR_SYNC_LETROSO_WEBHOOK_SECRET' \
  --data '{}'
```

## Test `sync-nyt-puzzles`

Dry-run test:

```bash
curl -sS -X POST \
  'https://wffqfwfcpiqpqmhbyhlz.supabase.co/functions/v1/sync-nyt-puzzles' \
  -H 'Content-Type: application/json' \
  -H 'X-Webhook-Secret: YOUR_NYT_PUZZLES_SYNC_WEBHOOK_SECRET' \
  --data '{"dryRun":true}'
```

Real run for all three NYT puzzles:

```bash
curl -sS -X POST \
  'https://wffqfwfcpiqpqmhbyhlz.supabase.co/functions/v1/sync-nyt-puzzles' \
  -H 'Content-Type: application/json' \
  -H 'X-Webhook-Secret: YOUR_NYT_PUZZLES_SYNC_WEBHOOK_SECRET' \
  --data '{}'
```

Real run for just one puzzle:

```bash
curl -sS -X POST \
  'https://wffqfwfcpiqpqmhbyhlz.supabase.co/functions/v1/sync-nyt-puzzles' \
  -H 'Content-Type: application/json' \
  -H 'X-Webhook-Secret: YOUR_NYT_PUZZLES_SYNC_WEBHOOK_SECRET' \
  --data '{"puzzles":["wordle"]}'
```

## Test `resolve-wordpress-post-id`

This function is not a dry-run function. It updates the `roblox_game_code_articles` row you pass in.

You must provide:

- a real `articleId` from `roblox_game_code_articles`
- the matching `ourArticleUrl`

Test command:

```bash
curl -sS -X POST \
  'https://wffqfwfcpiqpqmhbyhlz.supabase.co/functions/v1/resolve-wordpress-post-id' \
  -H 'Content-Type: application/json' \
  -H 'X-Webhook-Secret: YOUR_WORDPRESS_LOOKUP_WEBHOOK_SECRET' \
  --data '{"articleId":"YOUR_ARTICLE_ID","ourArticleUrl":"https://www.technerdiness.com/your-article/"}'
```

## Expected Results

- `sync-codes`, `sync-letroso`, and `sync-nyt-puzzles` should return JSON with `"ok": true` when the webhook secret matches.
- `resolve-wordpress-post-id` should return `200` with `resolved: true` if the article URL matches a WordPress post.
- `401 Unauthorized` means the webhook secret sent by `curl` does not match the deployed Edge Function secret.

## After Deploying Function Code Changes

Remember:

- editing files locally does not update the live Edge Function
- pushing to GitHub does not update the live Edge Function
- you must re-run the deploy command after every Edge Function code change
