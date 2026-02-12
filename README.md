# Meta API Webhook Skill

Allow OpenClaw to handle Meta Graph API webhooks, and send responses & manage content in Instagram and Facebook.

## Overview

This OpenClaw skill provides a Node.js server that:
- Listens to Meta Graph API webhook notifications from Facebook and Instagram
- Verifies webhook signatures for security
- Processes incoming events (messages, comments, reactions, etc.)
- Invokes OpenClaw via its hook system at `/hooks/agent`
- Provides Meta API callback information to OpenClaw for managing messages and content

## Features

- ✅ Webhook verification endpoint (GET /webhook)
- ✅ Webhook notification endpoint (POST /webhook)
- ✅ Signature verification for security
- ✅ Support for messaging events (messages, postbacks, reads, deliveries)
- ✅ Support for change events (comments, reactions)
- ✅ OpenClaw hook integration
- ✅ Meta API client for sending messages and managing content
- ✅ Health check endpoint

## Prerequisites

- Node.js 14+ 
- OpenClaw instance with hooks configured
- Meta App with webhook subscriptions configured
- Facebook Page or Instagram Business Account

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Shellishack/meta-api-webhook-skill.git
cd meta-api-webhook-skill
```

2. Install dependencies:
```bash
npm install
```

3. Copy the example environment file and configure:
```bash
cp .env.example .env
```

4. Edit `.env` with your credentials:
```env
META_APP_SECRET=your_app_secret_here
META_VERIFY_TOKEN=your_verify_token_here
META_ACCESS_TOKEN=your_page_access_token_here
OPENCLAW_HOOK_URL=http://localhost:8080/hooks/agent
OPENCLAW_API_KEY=your_openclaw_api_key_here
PORT=3000
```

## Configuration

### Meta App Setup

1. Create a Meta App at [developers.facebook.com](https://developers.facebook.com)
2. Add the Webhooks product
3. Configure webhook subscriptions for your Page or Instagram account
4. Subscribe to the events you want to handle (messages, feed, etc.)
5. Set your webhook URL to: `https://your-domain.com/webhook`
6. Use your `META_VERIFY_TOKEN` for verification

### OpenClaw Setup

Ensure your OpenClaw instance has:
- Hooks enabled and configured
- The hook endpoint accessible at `/hooks/agent`
- (Optional) API authentication configured

## Usage

### Start the Server

Development mode with auto-reload:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

### Server Endpoints

- `GET /webhook` - Webhook verification endpoint (used by Meta)
- `POST /webhook` - Webhook notification endpoint (receives events from Meta)
- `GET /health` - Health check endpoint

## How It Works

1. **Webhook Reception**: Meta sends webhook notifications to `POST /webhook`
2. **Signature Verification**: The server verifies the webhook signature using your app secret
3. **Event Processing**: The server parses the event and extracts relevant information
4. **OpenClaw Invocation**: The server calls OpenClaw's hook endpoint at `/hooks/agent` with:
   - Event data (message content, sender info, etc.)
   - Meta API configuration
   - Callback endpoints for OpenClaw to use
5. **OpenClaw Processing**: OpenClaw processes the event and can use the provided callbacks to:
   - Send messages back to users
   - Post comments
   - React to content
   - Manage other Meta API operations

## Payload Structure

When invoking OpenClaw, the skill sends a payload like:

```json
{
  "skill": "meta-api-webhook-skill",
  "event": {
    "type": "messaging",
    "objectType": "page",
    "senderId": "123456789",
    "recipientId": "987654321",
    "timestamp": 1234567890,
    "messageType": "message",
    "message": {
      "mid": "message_id",
      "text": "Hello!"
    }
  },
  "metaApiConfig": {
    "accessToken": "your_access_token",
    "apiVersion": "v18.0",
    "baseUrl": "https://graph.facebook.com"
  },
  "callbacks": {
    "sendMessage": {
      "url": "https://graph.facebook.com/v18.0/me/messages",
      "method": "POST",
      "authToken": "your_access_token"
    },
    "sendComment": {
      "url": "https://graph.facebook.com/v18.0/{object-id}/comments",
      "method": "POST",
      "authToken": "your_access_token"
    },
    "reactToContent": {
      "url": "https://graph.facebook.com/v18.0/{object-id}/likes",
      "method": "POST",
      "authToken": "your_access_token"
    }
  }
}
```

## Meta API Client

The skill includes a `MetaAPIClient` class for interacting with Meta APIs:

```javascript
const MetaAPIClient = require('./src/metaApiClient');

const client = new MetaAPIClient(accessToken);

// Send a text message
await client.sendTextMessage(recipientId, 'Hello!');

// Post a comment
await client.postComment(postId, 'Great post!');

// Like content
await client.likeObject(postId);

// Send typing indicator
await client.sendTypingIndicator(recipientId, true);

// Mark message as seen
await client.markSeen(recipientId);
```

## Security

- Webhook signatures are verified using HMAC SHA-256
- Verification token must match for webhook subscription
- API keys should be kept secure in environment variables
- HTTPS should be used in production

## Deployment

For production deployment:
1. Use a process manager like PM2
2. Set up HTTPS (required by Meta)
3. Configure environment variables securely
4. Set up monitoring and logging
5. Ensure OpenClaw is accessible from the webhook server

Example with PM2:
```bash
pm2 start src/server.js --name meta-webhook-skill
```

## Troubleshooting

### Webhook Verification Fails
- Check that `META_VERIFY_TOKEN` matches the token set in Meta App settings
- Ensure the webhook URL is publicly accessible

### Signature Verification Fails
- Verify `META_APP_SECRET` is correct
- Check that the request is coming from Meta

### OpenClaw Hook Fails
- Verify `OPENCLAW_HOOK_URL` is correct and accessible
- Check if authentication is required and `OPENCLAW_API_KEY` is set
- Review OpenClaw logs for hook processing errors

## License

MIT
