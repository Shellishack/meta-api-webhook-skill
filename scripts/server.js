const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');

// Load configuration
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

const app = express();
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

function getVerifyTokens() {
  const tokens = new Set();

  if (config.meta?.verifyToken) {
    tokens.add(config.meta.verifyToken);
  }
  if (config.meta?.instagram?.verifyToken) {
    tokens.add(config.meta.instagram.verifyToken);
  }
  if (config.meta?.messenger?.verifyToken) {
    tokens.add(config.meta.messenger.verifyToken);
  }

  return tokens;
}

function getCandidateSecrets(platform) {
  const secrets = [];

  if (config.meta?.appSecret) {
    secrets.push(config.meta.appSecret);
  }

  if (platform === 'instagram' && config.meta?.instagram?.appSecret) {
    secrets.push(config.meta.instagram.appSecret);
  }

  if (platform === 'messenger' && config.meta?.messenger?.appSecret) {
    secrets.push(config.meta.messenger.appSecret);
  }

  if (platform !== 'instagram' && config.meta?.instagram?.appSecret) {
    secrets.push(config.meta.instagram.appSecret);
  }

  if (platform !== 'messenger' && config.meta?.messenger?.appSecret) {
    secrets.push(config.meta.messenger.appSecret);
  }

  return [...new Set(secrets.filter(Boolean))];
}

function detectWebhookPlatform(payload) {
  const objectType = payload?.object;

  if (objectType === 'instagram') {
    return 'instagram';
  }

  if (objectType === 'page') {
    return 'messenger';
  }

  return null;
}

/**
 * Webhook Verification Endpoint (GET)
 * Meta sends this to verify your webhook URL
 */
function handleWebhookVerification(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  console.log('Webhook verification request received');

  const verifyTokens = getVerifyTokens();

  if (mode === 'subscribe' && verifyTokens.has(token)) {
    console.log('Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.error('Webhook verification failed');
    res.status(403).send('Forbidden');
  }
}

app.get('/webhook/meta', handleWebhookVerification);
app.get('/webhook/instagram', handleWebhookVerification);
app.get('/webhook/messenger', handleWebhookVerification);

/**
 * Webhook Event Handler (POST)
 * Receives Meta webhook events and forwards to OpenClaw
 */
async function handleMetaWebhookEvent(req, res) {
  // Always respond 200 immediately to avoid Meta retries
  res.sendStatus(200);
  
  try {
    const platform = detectWebhookPlatform(req.body);
    if (!platform) {
      console.log('Skipping unsupported webhook object:', req.body?.object);
      return;
    }

    // Validate signature
    const signature = req.headers['x-hub-signature-256'];
    const candidateSecrets = getCandidateSecrets(platform);
    const isValidSignature = candidateSecrets.some((secret) =>
      validateSignature(req.rawBody, signature, secret)
    );

    if (!isValidSignature) {
      console.error('Invalid webhook signature');
      return;
    }
    
    console.log(`Webhook event received for ${platform}:`, JSON.stringify(req.body, null, 2));
    
    // Process each entry in the webhook
    const entries = req.body.entry || [];
    for (const entry of entries) {
      await processMetaEntry(platform, entry);
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
  }
}

app.post('/webhook/meta', handleMetaWebhookEvent);
app.post('/webhook/instagram', handleMetaWebhookEvent);
app.post('/webhook/messenger', handleMetaWebhookEvent);

/**
 * Validate webhook signature using HMAC-SHA256
 */
function validateSignature(payload, signature, appSecret) {
  if (!signature || !appSecret || !payload) {
    return false;
  }
  
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex');

  if (signature.length !== expectedSignature.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Process a Meta webhook entry
 */
async function processMetaEntry(platform, entry) {
  if (platform === 'instagram') {
    const messaging = entry.messaging || [];
    const changes = entry.changes || [];

    for (const event of messaging) {
      if (event.message) {
        await handleInstagramMessage(event);
      }
    }

    for (const change of changes) {
      if (change.field === 'comments') {
        await handleInstagramComment(change.value);
      } else if (change.field === 'messages') {
        await handleInstagramMessageFieldChange(change.value);
      }
    }

    return;
  }

  if (platform === 'messenger') {
    const messaging = entry.messaging || [];

    for (const event of messaging) {
      if (event.message) {
        await handleMessengerMessage(event);
      } else if (event.postback) {
        await handleMessengerPostback(event);
      }
    }
  }
}

/**
 * Handle Instagram direct message
 */
async function handleInstagramMessage(event) {
  const payload = {
    source: 'meta-webhook',
    platform: 'instagram',
    event: {
      type: 'message',
      sender: {
        id: event.sender.id
      },
      message: {
        id: event.message.mid,
        text: event.message.text || '',
        timestamp: event.timestamp,
        attachments: event.message.attachments || [],
        commands: event.message.commands || []
      },
      conversation: {
        id: event.sender.id // Instagram uses sender ID as conversation ID
      }
    },
    metadata: {
      pageId: event.recipient.id,
      receivedAt: new Date().toISOString()
    },
    callbacks: {
      sendMessage: {
        url: `https://graph.facebook.com/v24.0/me/messages`,
        token: config.meta.instagram.pageAccessToken,
        method: 'POST',
        recipientId: event.sender.id
      }
    }
  };
  
  await forwardToOpenClaw(payload);
}

/**
 * Handle Instagram messages field update from entry.changes[].value
 */
async function handleInstagramMessageFieldChange(value) {
  if (!value || !value.sender || !value.recipient || !value.message) {
    return;
  }

  const normalizedEvent = {
    sender: {
      id: value.sender.id
    },
    recipient: {
      id: value.recipient.id
    },
    timestamp: Number(value.timestamp) || Date.now(),
    message: {
      mid: value.message.mid,
      text: value.message.text || '',
      attachments: value.message.attachments || [],
      commands: value.message.commands || []
    }
  };

  await handleInstagramMessage(normalizedEvent);
}

/**
 * Handle Instagram comment
 */
async function handleInstagramComment(commentData) {
  const payload = {
    source: 'meta-webhook',
    platform: 'instagram',
    event: {
      type: 'comment',
      sender: {
        id: commentData.from.id,
        username: commentData.from.username
      },
      message: {
        id: commentData.id,
        text: commentData.text,
        timestamp: Date.now()
      },
      conversation: {
        id: commentData.media.id
      }
    },
    metadata: {
      mediaId: commentData.media.id,
      receivedAt: new Date().toISOString()
    },
    callbacks: {
      replyToComment: {
        url: `https://graph.facebook.com/v24.0/${commentData.id}/replies`,
        token: config.meta.instagram.pageAccessToken,
        method: 'POST'
      }
    }
  };
  
  await forwardToOpenClaw(payload);
}

/**
 * Handle Messenger message
 */
async function handleMessengerMessage(event) {
  const payload = {
    source: 'meta-webhook',
    platform: 'messenger',
    event: {
      type: 'message',
      sender: {
        id: event.sender.id
      },
      message: {
        id: event.message.mid,
        text: event.message.text || '',
        timestamp: event.timestamp,
        attachments: event.message.attachments || [],
        quick_reply: event.message.quick_reply || null
      },
      conversation: {
        id: event.sender.id
      }
    },
    metadata: {
      pageId: event.recipient.id,
      receivedAt: new Date().toISOString()
    },
    callbacks: {
      sendMessage: {
        url: `https://graph.facebook.com/v24.0/me/messages`,
        token: config.meta.messenger.pageAccessToken,
        method: 'POST',
        recipientId: event.sender.id
      }
    }
  };
  
  await forwardToOpenClaw(payload);
}

/**
 * Handle Messenger postback
 */
async function handleMessengerPostback(event) {
  const payload = {
    source: 'meta-webhook',
    platform: 'messenger',
    event: {
      type: 'postback',
      sender: {
        id: event.sender.id
      },
      postback: {
        title: event.postback.title,
        payload: event.postback.payload
      },
      conversation: {
        id: event.sender.id
      }
    },
    metadata: {
      pageId: event.recipient.id,
      receivedAt: new Date().toISOString()
    },
    callbacks: {
      sendMessage: {
        url: `https://graph.facebook.com/v24.0/me/messages`,
        token: config.meta.messenger.pageAccessToken,
        method: 'POST',
        recipientId: event.sender.id
      }
    }
  };
  
  await forwardToOpenClaw(payload);
}

/**
 * Forward processed event to OpenClaw
 */
async function forwardToOpenClaw(payload) {
  try {
    console.log('Forwarding to OpenClaw:', config.openclaw.hookUrl);
    
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Add API key if configured
    if (config.openclaw.apiKey) {
      headers['Authorization'] = `Bearer ${config.openclaw.apiKey}`;
    }
    
    const response = await axios.post(config.openclaw.hookUrl, payload, {
      headers,
      timeout: 30000 // 30 second timeout
    });
    
    console.log('OpenClaw response:', response.status);
  } catch (error) {
    console.error('Failed to forward to OpenClaw:', error.message);
    // Don't throw - we already responded 200 to Meta
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'meta-webhook-server' });
});

// Start server
const PORT = config.server.port || 8080;
const HOST = config.server.host || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Meta webhook server running on ${HOST}:${PORT}`);
  console.log(`Meta endpoint (recommended): http://${HOST}:${PORT}/webhook/meta`);
  console.log(`Instagram endpoint (legacy): http://${HOST}:${PORT}/webhook/instagram`);
  console.log(`Messenger endpoint (legacy): http://${HOST}:${PORT}/webhook/messenger`);
  console.log(`OpenClaw hook URL: ${config.openclaw.hookUrl}`);
});
