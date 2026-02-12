---
name: meta-webhooks
description: Provides a pre-built Node.js webhook server for Meta Graph API (Instagram, Facebook Messenger) that integrates with OpenClaw for automated message handling and real-time conversations. The server is started by OpenClaw during initialization.
---

# Meta Webhooks Integration Skill

This skill provides a pre-built Node.js webhook server that receives Meta Graph API notifications (Instagram messages/comments, Facebook Messenger) and forwards them to OpenClaw for intelligent processing and response. The server is automatically started by OpenClaw during agent initialization.

## When to Use This Skill

Use this skill when the user wants to:
- Set up Meta (Instagram/Facebook) webhook integration with OpenClaw
- Configure the included webhook server for Meta Graph API notifications
- Enable automated message responses via OpenClaw
- Handle real-time conversations from Instagram or Facebook Messenger
- Debug or troubleshoot the Meta webhook server

## Core Workflow

The integration works in this flow:
1. **Meta Graph API** sends webhook notifications → **Node.js Server** (recommended: `/webhook/meta`)
2. **Node.js Server** validates signature, processes event → calls **OpenClaw** at `/hooks/agent`
3. **OpenClaw** processes the webhook with Claude → calls back to **Meta Graph API** to send messages/responses

## What the Skill Provides

This skill includes a pre-built Node.js webhook server that OpenClaw starts during initialization. The server includes:

### 1. Pre-Built Node.js Webhook Server
- Express server with a unified Meta webhook endpoint (`/webhook/meta`) and legacy compatibility routes
- Webhook verification handler (responds to Meta's GET challenges)
- Signature validation for security
- Event parsing and forwarding to OpenClaw
- Error handling and logging
- Automatically started by OpenClaw during agent initialization

### 2. Configuration Management
- The skill helps configure `config.json` or `config.yaml` with user credentials
- Validates required Meta app credentials and OpenClaw settings
- Ensures proper configuration before starting the server

### 3. Setup Guidance
- Instructions for configuring Meta App webhooks to point to the server
- Guidance on obtaining required Meta API credentials
- Testing procedures to verify webhook delivery
- Troubleshooting common issues

### 4. Server Lifecycle Management
- Automatic startup during OpenClaw initialization
- Health monitoring and restart capabilities
- Graceful shutdown on OpenClaw termination
- Log aggregation for debugging

## Server Architecture

### Included Server Structure

The pre-built server (server.js) includes:

```javascript
// Already implemented in the skill
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const config = require('./config.json');

// Webhook verification endpoint (GET)
app.get('/webhook/:platform', verifyWebhook);

// Webhook event handler (POST)
app.post('/webhook/:platform', handleWebhookEvent);

// Signature validation
function validateSignature(req, signature) {
  // Computes HMAC-SHA256 of request body
  // Compares with X-Hub-Signature-256 header
}

// Forward to OpenClaw
async function forwardToOpenClaw(event, platform) {
  // Formats payload for OpenClaw
  // POSTs to config.openclaw.hookUrl
  // Includes metadata about event source
}
```

### OpenClaw Initialization

When OpenClaw starts with this skill enabled:
1. Validates configuration file exists and contains required credentials
2. Starts the webhook server on the configured port
3. Registers the server process for lifecycle management
4. Monitors server health and logs

### Configuration File Format

**JSON format (default):**
```json
{
  "meta": {
    "instagram": {
      "appSecret": "your_instagram_app_secret",
      "verifyToken": "your_verify_token",
      "pageAccessToken": "your_page_access_token"
    },
    "messenger": {
      "appSecret": "your_messenger_app_secret", 
      "verifyToken": "your_verify_token",
      "pageAccessToken": "your_page_access_token"
    }
  },
  "openclaw": {
    "hookUrl": "http://localhost:3000/hooks/agent",
    "apiKey": "optional_auth_key"
  },
  "server": {
    "port": 8080,
    "host": "0.0.0.0"
  }
}
```

**YAML format (if user prefers):**
```yaml
meta:
  instagram:
    appSecret: your_instagram_app_secret
    verifyToken: your_verify_token
    pageAccessToken: your_page_access_token
  messenger:
    appSecret: your_messenger_app_secret
    verifyToken: your_verify_token
    pageAccessToken: your_page_access_token

openclaw:
  hookUrl: http://localhost:3000/hooks/agent
  apiKey: optional_auth_key

server:
  port: 8080
  host: 0.0.0.0
```

### OpenClaw Payload Format

When forwarding webhooks to OpenClaw, send this payload structure:

```json
{
  "source": "meta-webhook",
  "platform": "instagram" | "messenger",
  "event": {
    "type": "message" | "comment" | "mention",
    "sender": {
      "id": "user_id",
      "username": "username"
    },
    "message": {
      "id": "message_id",
      "text": "message content",
      "timestamp": 1234567890
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
      "method": "POST"
    }
  }
}
```

This tells OpenClaw how to call back to Meta APIs.

### OpenClaw Hook Configuration

Include instructions for setting up OpenClaw hooks:

**OpenClaw config.yaml section:**
```yaml
hooks:
  - name: meta-webhooks
    enabled: true
    endpoint: /hooks/agent
    authentication:
      type: none  # or bearer_token if needed
    processors:
      - type: meta-message-handler
        config:
          auto_respond: true
          log_conversations: true
```

**OpenClaw handler instructions:**

The OpenClaw instance needs to be configured to:
1. Accept webhook payloads at `/hooks/agent`
2. Parse the Meta event structure
3. Use Claude to generate responses
4. Call back to Meta Graph API using the `callbacks.sendMessage` info

Provide example code or pseudocode showing how OpenClaw should handle the callback.

### Security Best Practices

The pre-built server includes:
1. **Signature verification** - validates X-Hub-Signature-256 header
2. **HTTPS enforcement** in production environments
3. **Rate limiting** on webhook endpoints
4. **Input validation** before forwarding to OpenClaw
5. **Credential security** - config.json is git-ignored by default

### Error Handling

The server implements robust error handling:
- Meta webhook failures → logs errors and returns 200 (to avoid retries)
- OpenClaw unreachable → queues for retry with exponential backoff
- Invalid signatures → rejects with 401
- Malformed payloads → logs and skips processing

## Example Interactions

### Initial Setup
```
User: "Set up Meta webhooks for Instagram messages"

Skill response:
1. Check if config.json exists, create from template if needed
2. Guide user to add Meta app secret, verify token, and Instagram page access token
3. Validate configuration
4. Note that server will start automatically when OpenClaw initializes
5. Provide Meta App webhook configuration instructions (URL: http://your-domain/webhook/meta)
```

### Complete Integration
```
User: "Enable Meta integration for both Instagram and Messenger"

Skill response:
1. Ensure config.json has sections for both platforms
2. Guide credential collection for both Instagram and Messenger
3. Validate all required fields
4. Explain that server uses `/webhook/meta` for both Instagram and Messenger events
5. Provide testing instructions for both platforms
```

### Troubleshooting
```
User: "My Instagram webhooks aren't working"

Skill response:
1. Check if server is running (should be started by OpenClaw)
2. Review server logs for signature validation errors
3. Verify Meta App webhook configuration points to correct URL
4. Test webhook endpoint directly
5. Check OpenClaw hook configuration
```

## Skill File Structure

The skill includes these files:

```
meta-api-webhook-skill/
├── server.js              # Pre-built webhook server (started by OpenClaw)
├── config.example.json    # Template with placeholder values
├── package.json           # Node.js dependencies (pre-installed)
├── .gitignore            # Excludes config.json from version control
├── README.md             # Setup and usage instructions
└── test/
    └── test-webhook.js   # Testing utilities

# User creates during setup:
config.json                # User's actual credentials (not in repo)
```

## Dependencies

Include in package.json:
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "axios": "^1.6.0",
    "body-parser": "^1.20.0",
    "dotenv": "^16.3.0"
  }
}
```

## Communication Style

When helping users configure Meta webhook integration:
- **Ask about their needs** - which platforms (Instagram, Messenger, or both)
- **Guide credential collection** - help them obtain Meta App credentials
- **Explain the flow** - make sure they understand Meta → Server → OpenClaw → Meta
- **Emphasize automatic startup** - server starts when OpenClaw initializes, no manual npm start needed
- **Include testing steps** - how to verify webhooks are working
- **Warn about common issues** - signature validation failures, HTTPS requirements for production, etc.

## Common Variations

Be prepared to handle:
- Different Meta platforms (Instagram only, Messenger only, both)
- YAML vs JSON config preferences
- Different OpenClaw authentication methods
- Custom event types (reactions, story mentions, etc.)
- Webhook retries and idempotency
- Multiple OpenClaw instances (load balancing)

## Setup Process

When assisting users:
1. **Validate/create config.json** - ensure structure matches config.example.json
2. **Collect credentials** - guide user to obtain Meta App secrets and tokens
3. **Explain automatic startup** - clarify that OpenClaw starts the server during initialization
4. **Provide Meta App configuration** - webhook URLs, verify tokens
5. **Testing procedure** - how to verify webhooks are being received
6. **Next steps** - monitoring, troubleshooting, production deployment

The goal is that a user can add their credentials to config.json, restart OpenClaw, and have a working integration within 15 minutes.
