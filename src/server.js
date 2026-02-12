require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration
const META_APP_SECRET = process.env.META_APP_SECRET;
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const OPENCLAW_HOOK_URL = process.env.OPENCLAW_HOOK_URL || 'http://localhost:8080/hooks/agent';
const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY;

// Verify webhook signature
function verifySignature(req, res, buf) {
  const signature = req.headers['x-hub-signature-256'];
  
  if (!signature) {
    console.log('No signature found in request');
    return false;
  }

  const signatureHash = signature.split('sha256=')[1];
  const expectedHash = crypto
    .createHmac('sha256', META_APP_SECRET)
    .update(buf)
    .digest('hex');

  if (signatureHash !== expectedHash) {
    console.log('Invalid signature');
    return false;
  }

  return true;
}

// Webhook verification endpoint (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
      console.log('Webhook verified');
      res.status(200).send(challenge);
    } else {
      console.log('Verification failed');
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// Webhook notification endpoint (POST)
app.post('/webhook', express.json({ verify: verifySignature }), async (req, res) => {
  try {
    const body = req.body;

    // Respond quickly to Meta
    res.status(200).send('EVENT_RECEIVED');

    // Process the webhook event
    if (body.object === 'page' || body.object === 'instagram') {
      for (const entry of body.entry) {
        await processWebhookEntry(entry, body.object);
      }
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Process individual webhook entry
async function processWebhookEntry(entry, objectType) {
  try {
    // Extract messaging events
    const messagingEvents = entry.messaging || [];
    const changes = entry.changes || [];

    for (const event of messagingEvents) {
      await handleMessagingEvent(event, objectType);
    }

    for (const change of changes) {
      await handleChangeEvent(change, objectType);
    }
  } catch (error) {
    console.error('Error processing webhook entry:', error);
  }
}

// Handle messaging events
async function handleMessagingEvent(event, objectType) {
  try {
    const senderId = event.sender?.id;
    const recipientId = event.recipient?.id;
    const timestamp = event.timestamp;

    let eventData = {
      type: 'messaging',
      objectType,
      senderId,
      recipientId,
      timestamp,
      event
    };

    // Check for different message types
    if (event.message) {
      eventData.messageType = 'message';
      eventData.message = event.message;
    } else if (event.postback) {
      eventData.messageType = 'postback';
      eventData.postback = event.postback;
    } else if (event.read) {
      eventData.messageType = 'read';
      eventData.read = event.read;
    } else if (event.delivery) {
      eventData.messageType = 'delivery';
      eventData.delivery = event.delivery;
    }

    // Invoke OpenClaw hook
    await invokeOpenClawHook(eventData);
  } catch (error) {
    console.error('Error handling messaging event:', error);
  }
}

// Handle change events (comments, reactions, etc.)
async function handleChangeEvent(change, objectType) {
  try {
    const eventData = {
      type: 'change',
      objectType,
      field: change.field,
      value: change.value
    };

    // Invoke OpenClaw hook
    await invokeOpenClawHook(eventData);
  } catch (error) {
    console.error('Error handling change event:', error);
  }
}

// Invoke OpenClaw hook system
async function invokeOpenClawHook(eventData) {
  try {
    // Prepare payload for OpenClaw
    const payload = {
      skill: 'meta-api-webhook-skill',
      event: eventData,
      metaApiConfig: {
        accessToken: META_ACCESS_TOKEN,
        apiVersion: 'v18.0',
        baseUrl: 'https://graph.facebook.com'
      },
      callbacks: {
        sendMessage: {
          url: `https://graph.facebook.com/v18.0/me/messages`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          authToken: META_ACCESS_TOKEN
        },
        sendComment: {
          url: `https://graph.facebook.com/v18.0/{object-id}/comments`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          authToken: META_ACCESS_TOKEN
        },
        reactToContent: {
          url: `https://graph.facebook.com/v18.0/{object-id}/likes`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          authToken: META_ACCESS_TOKEN
        }
      }
    };

    // Call OpenClaw hook
    const headers = {
      'Content-Type': 'application/json'
    };

    if (OPENCLAW_API_KEY) {
      headers['Authorization'] = `Bearer ${OPENCLAW_API_KEY}`;
    }

    const response = await axios.post(OPENCLAW_HOOK_URL, payload, { headers });
    
    console.log('OpenClaw hook invoked successfully:', response.status);
    return response.data;
  } catch (error) {
    console.error('Error invoking OpenClaw hook:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'meta-api-webhook-skill',
    timestamp: new Date().toISOString()
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Meta API Webhook Skill server listening on port ${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`OpenClaw Hook URL: ${OPENCLAW_HOOK_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
