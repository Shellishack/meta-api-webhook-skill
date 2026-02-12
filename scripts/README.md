# Meta Graph API + OpenClaw Webhook Integration

Complete webhook server for Instagram and Facebook Messenger that forwards events to OpenClaw for AI-powered message handling.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure credentials:**
  Copy `.env.example` to `.env` and set your Meta tokens/secrets there. Keep `config.json` for non-secret settings like host/port and OpenClaw URL.

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Configure Meta App webhooks** (see Meta App Setup section)

5. **Configure OpenClaw hooks** (see OpenClaw Setup section)

---

## Configuration

### Option 1: JSON Configuration (config.json)

```json
{
  "meta": {
    "appSecret": "",
    "verifyToken": "",
    "instagram": {
      "pageAccessToken": ""
    },
    "messenger": {
      "pageAccessToken": ""
    }
  },
  "openclaw": {
    "hookUrl": "http://localhost:3000/hooks/agent",
    "apiKey": ""
  },
  "server": {
    "port": 8080,
    "host": "0.0.0.0"
  }
}
```

### Option 2: YAML Configuration (config.yaml)

If you prefer YAML, you'll need to modify `server.js` to use a YAML parser:

```bash
npm install js-yaml
```

Then update the config loading line in `server.js`:
```javascript
const yaml = require('js-yaml');
const config = yaml.load(fs.readFileSync('./config.yaml', 'utf8'));
```

### Environment Variables (.env)

Create `scripts/.env` from `.env.example`:

```bash
# macOS/Linux
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

Required values:

```env
META_APP_SECRET=your_meta_app_secret
META_VERIFY_TOKEN=your_custom_verify_token
META_INSTAGRAM_PAGE_ACCESS_TOKEN=your_instagram_page_access_token
META_MESSENGER_PAGE_ACCESS_TOKEN=your_messenger_page_access_token
```

**Where to find credentials:**

- **appSecret**: Meta App Dashboard → Settings → Basic → App Secret
- **verifyToken**: Create any random string (e.g., "my_secure_token_123") and set it in `.env`
- **pageAccessToken**: Meta App Dashboard → Product (Instagram/Messenger) → Settings → Generate Token

---

## Meta App Setup

### 1. Create/Configure Meta App

1. Go to https://developers.facebook.com/apps/
2. Create a new app or use existing app
3. Add "Instagram" and/or "Messenger" products

### 2. Configure Webhooks

Use one callback URL for both products:
1. In your Meta App webhook configuration, set Callback URL to: `https://your-domain.com/webhook/meta`
2. Enter your **Verify Token** (matches `meta.verifyToken` in `config.json`)
3. Subscribe Instagram fields (e.g., **messages**, **comments**) and Messenger fields (e.g., **messages**, **messaging_postbacks**)
4. Save changes

### 3. Get Page Access Tokens

**Instagram:**
1. Instagram → Configuration → Page Access Tokens
2. Select your Instagram account
3. Generate Token → Copy to `config.json`

**Messenger:**
1. Messenger → Configuration → Page Access Tokens
2. Select your Facebook Page
3. Generate Token → Copy to `config.json`

### 4. Local Testing with ngrok

For local development:

```bash
# Install ngrok
npm install -g ngrok

# Start webhook server
npm start

# In another terminal, expose port 8080
ngrok http 8080
```

Use the ngrok HTTPS URL in Meta App Dashboard:
- `https://abc123.ngrok.io/webhook/meta`

---

## OpenClaw Setup

### Hook Configuration

Add to your OpenClaw `config.yaml`:

```yaml
hooks:
  - name: meta-webhooks
    enabled: true
    endpoint: /hooks/agent
    authentication:
      type: none  # or bearer_token if you set apiKey
    processors:
      - type: meta-handler
        config:
          auto_respond: true
          log_conversations: true
```

### Payload Format

OpenClaw receives this payload structure:

```json
{
  "source": "meta-webhook",
  "platform": "instagram" | "messenger",
  "event": {
    "type": "message" | "comment" | "postback",
    "sender": {
      "id": "user_id",
      "username": "username"
    },
    "message": {
      "id": "message_id",
      "text": "message content",
      "timestamp": 1234567890,
      "attachments": []
    },
    "conversation": {
      "id": "conversation_id"
    }
  },
  "metadata": {
    "pageId": "page_id",
    "receivedAt": "2025-02-12T10:30:00Z"
  },
  "callbacks": {
    "sendMessage": {
      "url": "https://graph.facebook.com/v18.0/me/messages",
      "token": "page_access_token",
      "method": "POST",
      "recipientId": "user_id"
    }
  }
}
```

### OpenClaw Handler Example

```javascript
// Example OpenClaw webhook handler
async function handleMetaWebhook(payload) {
  const { event, platform, callbacks } = payload;
  
  // Extract user message
  const userMessage = event.message.text;
  const senderId = event.sender.id;
  
  // Generate AI response using Claude
  const aiResponse = await generateClaudeResponse(userMessage);
  
  // Send response back to Meta
  const { url, token, recipientId } = callbacks.sendMessage;
  
  await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: aiResponse }
    })
  });
  
  // Log conversation if configured
  if (config.log_conversations) {
    await logConversation(platform, senderId, userMessage, aiResponse);
  }
}
```

### Sending Messages Back to Meta

Use the callback information provided in the payload:

```javascript
// Instagram/Messenger text message
await axios.post(callbacks.sendMessage.url, {
  recipient: { id: callbacks.sendMessage.recipientId },
  message: { text: "Your response here" }
}, {
  headers: { 'Authorization': `Bearer ${callbacks.sendMessage.token}` }
});

// Instagram comment reply
await axios.post(callbacks.replyToComment.url, {
  message: "Your reply here"
}, {
  headers: { 'Authorization': `Bearer ${callbacks.replyToComment.token}` }
});
```

---

## Testing

### 1. Verify Webhook Endpoint

Start the server and check Meta's webhook verification:

```bash
npm start
```

In Meta App Dashboard, save your webhook URL. You should see:
```
Webhook verification request received
Webhook verified successfully
```

### 2. Test Message Flow

Send a test message:
1. **Instagram**: Send a DM to your Instagram account
2. **Messenger**: Send a message to your Facebook Page

**Expected flow:**
1. Meta sends webhook → Your server
2. Server validates signature ✓
3. Server forwards to OpenClaw ✓
4. OpenClaw processes with Claude ✓
5. OpenClaw calls Meta API ✓
6. User receives AI response ✓

**Server logs:**
```
Webhook event received: { ... }
Forwarding to OpenClaw: http://localhost:3000/hooks/agent
OpenClaw response: 200
```

### 3. Manual Testing

Test the OpenClaw endpoint directly:

```bash
curl -X POST http://localhost:3000/hooks/agent \
  -H "Content-Type: application/json" \
  -d '{
    "source": "meta-webhook",
    "platform": "instagram",
    "event": {
      "type": "message",
      "sender": {"id": "test_user"},
      "message": {"text": "Hello!"}
    }
  }'
```

---

## Troubleshooting

### Webhook Verification Fails
- ✅ Verify `verifyToken` matches in both `config.json` and Meta Dashboard
- ✅ Use HTTPS (required by Meta) - use ngrok for local testing
- ✅ Check server logs for errors

### Events Not Reaching OpenClaw
- ✅ Verify `openclaw.hookUrl` is correct
- ✅ Ensure OpenClaw is running and accessible
- ✅ Check server logs: `Forwarding to OpenClaw: ...`
- ✅ Test OpenClaw endpoint with curl

### Signature Validation Errors
- ✅ Verify `appSecret` is correct for each platform
- ✅ Ensure raw request body is used for validation
- ✅ Check server logs for signature mismatch details

### OpenClaw Can't Send Messages
- ✅ Verify `pageAccessToken` has proper permissions
- ✅ Check token hasn't expired (Meta tokens can expire)
- ✅ Ensure OpenClaw uses the callback URL from payload
- ✅ Check Meta API error responses in OpenClaw logs

### Messages Delayed or Missing
- ✅ Server responds 200 immediately (prevents retries)
- ✅ Check for errors in async processing
- ✅ Monitor OpenClaw response time (<30s timeout)
- ✅ Review Meta webhook retry logs in Meta Dashboard

---

## Security Checklist

Before production deployment:

- [ ] Use HTTPS (required by Meta)
- [ ] Signature validation enabled (default in code)
- [ ] Secrets in `config.json` are secure (not in git)
- [ ] Add `config.json` to `.gitignore`
- [ ] Use environment variables in production
- [ ] Set up proper logging and monitoring
- [ ] Consider rate limiting
- [ ] Review Meta's security best practices

---

## Architecture

```
Meta Graph API
    |
    | Webhook POST
    ↓
Your Server (this code)
    |
    | HTTP POST to /hooks/agent
    ↓
OpenClaw
    |
    | Process with Claude
    ↓
OpenClaw calls Meta Graph API
    |
    | Send response message
    ↓
User receives AI reply
```

---

## Production Deployment

### Environment Variables

For production, use environment variables instead of `config.json`:

```javascript
// Update server.js
const config = {
  meta: {
    instagram: {
      appSecret: process.env.INSTAGRAM_APP_SECRET,
      verifyToken: process.env.INSTAGRAM_VERIFY_TOKEN,
      pageAccessToken: process.env.INSTAGRAM_PAGE_ACCESS_TOKEN
    },
    messenger: {
      appSecret: process.env.MESSENGER_APP_SECRET,
      verifyToken: process.env.MESSENGER_VERIFY_TOKEN,
      pageAccessToken: process.env.MESSENGER_PAGE_ACCESS_TOKEN
    }
  },
  openclaw: {
    hookUrl: process.env.OPENCLAW_HOOK_URL,
    apiKey: process.env.OPENCLAW_API_KEY
  },
  server: {
    port: process.env.PORT || 8080,
    host: process.env.HOST || '0.0.0.0'
  }
};
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 8080
CMD ["npm", "start"]
```

---

## Support & Resources

- [Meta Graph API Documentation](https://developers.facebook.com/docs/graph-api)
- [Instagram Messaging API](https://developers.facebook.com/docs/instagram-api/guides/messaging)
- [Messenger Platform](https://developers.facebook.com/docs/messenger-platform)
- [Meta Webhooks Reference](https://developers.facebook.com/docs/graph-api/webhooks)

---

## License

MIT
