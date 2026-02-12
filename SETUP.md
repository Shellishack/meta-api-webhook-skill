# Setup Guide

This guide will walk you through setting up the Meta API Webhook Skill for OpenClaw.

## Prerequisites

- Node.js 14 or higher
- npm or yarn
- A Meta Developer account
- A Facebook Page or Instagram Business Account
- An OpenClaw instance with hooks enabled

## Step 1: Create a Meta App

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app or select an existing one
3. Add the "Webhooks" product to your app
4. Note your App Secret (found in Settings > Basic)

## Step 2: Configure Webhooks in Meta

1. In the Webhooks section of your Meta App:
   - Select the object you want to subscribe to (Page or Instagram)
   - Click "Edit Subscription"
   - Enter your webhook URL: `https://your-domain.com/webhook`
   - Enter a Verify Token (you can create any string - save it for later)
   - Select the webhook fields you want to receive:
     - For messaging: `messages`, `messaging_postbacks`, `message_deliveries`, `message_reads`
     - For content: `feed`, `comments`, `reactions`

2. Get your Page Access Token:
   - Go to the Messenger settings in your app
   - Under "Access Tokens", generate a token for your Page
   - Save this token securely

## Step 3: Set Up OpenClaw

Ensure your OpenClaw instance has:
1. Hooks enabled in the configuration
2. The hook endpoint accessible at `/hooks/agent`
3. (Optional) API authentication configured if you want to secure the hook calls

Note the OpenClaw hook URL (e.g., `http://your-openclaw-instance:8080/hooks/agent`)

## Step 4: Install the Skill

1. Clone this repository:
```bash
git clone https://github.com/Shellishack/meta-api-webhook-skill.git
cd meta-api-webhook-skill
```

2. Install dependencies:
```bash
npm install
```

3. Create your `.env` file:
```bash
cp .env.example .env
```

4. Edit `.env` with your credentials:
```env
# From Meta App Settings
META_APP_SECRET=your_app_secret_from_meta

# The verify token you created in step 2
META_VERIFY_TOKEN=your_verify_token_here

# Page access token from step 2
META_ACCESS_TOKEN=your_page_access_token

# OpenClaw configuration
OPENCLAW_HOOK_URL=http://your-openclaw-instance:8080/hooks/agent
OPENCLAW_API_KEY=your_api_key_if_required

# Server configuration
PORT=3000
NODE_ENV=production
```

## Step 5: Deploy the Server

### Option A: Local Development

```bash
npm run dev
```

### Option B: Production Deployment

For production, you'll need:
- A server with a public domain or IP
- HTTPS enabled (required by Meta)
- A process manager like PM2

Example with PM2:
```bash
npm install -g pm2
pm2 start src/server.js --name meta-webhook-skill
pm2 save
pm2 startup
```

### Option C: Deploy with Docker (Optional)

Create a `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "src/server.js"]
```

Build and run:
```bash
docker build -t meta-webhook-skill .
docker run -p 3000:3000 --env-file .env meta-webhook-skill
```

## Step 6: Set Up HTTPS (Required for Production)

Meta requires HTTPS for webhooks. Options:

### Using Nginx as Reverse Proxy

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Using Cloudflare Tunnel (Easy option)

```bash
cloudflared tunnel --url http://localhost:3000
```

## Step 7: Verify the Webhook

1. Once your server is running on a public HTTPS URL, go back to Meta Webhooks settings
2. Click "Verify" next to your webhook URL
3. Meta will send a GET request with the verification token
4. If successful, you'll see a green checkmark

## Step 8: Test the Integration

1. Send a message to your Facebook Page
2. Check the server logs - you should see:
   ```
   Webhook verified
   OpenClaw hook invoked successfully: 200
   ```
3. Check your OpenClaw logs to see if it received the hook

## Troubleshooting

### Webhook Verification Fails

- Ensure `META_VERIFY_TOKEN` in `.env` matches the token in Meta settings
- Check that your server is accessible at the webhook URL
- Look for error logs on the server

### Signature Verification Fails

- Verify `META_APP_SECRET` is correct
- Ensure you're using the correct app
- Check server logs for "Invalid signature" messages

### OpenClaw Hook Fails

- Verify `OPENCLAW_HOOK_URL` is correct and accessible from the server
- Check if OpenClaw requires authentication
- Review OpenClaw logs for hook processing errors

### HTTPS Issues

- Ensure SSL certificates are valid
- Check that port 443 is open
- Verify reverse proxy configuration

## Testing

Run the integration tests:
```bash
npm test
```

## Monitoring

Check server health:
```bash
curl https://your-domain.com/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "meta-api-webhook-skill",
  "timestamp": "2026-02-12T07:00:00.000Z"
}
```

## Next Steps

- Configure OpenClaw to handle the webhook events
- Implement custom logic in OpenClaw to process messages
- Use the Meta API client to send responses
- Monitor logs and set up alerts
- Scale as needed

## Support

For issues or questions:
- Check the README.md for documentation
- Review the example payload in the main README
- Check Meta's webhook documentation
- Review OpenClaw's hook documentation
