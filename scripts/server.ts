import express from "express";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// Load configuration
const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

applyEnvOverrides();

function applyEnvOverrides() {
  config.meta = config.meta || {};
  config.meta.instagram = config.meta.instagram || {};
  config.meta.messenger = config.meta.messenger || {};

  config.meta.appSecret = process.env.META_APP_SECRET || config.meta.appSecret;
  config.meta.verifyToken =
    process.env.META_VERIFY_TOKEN || config.meta.verifyToken;

  config.meta.instagram.appSecret =
    process.env.META_INSTAGRAM_APP_SECRET || config.meta.instagram.appSecret;
  config.meta.instagram.verifyToken =
    process.env.META_INSTAGRAM_VERIFY_TOKEN ||
    config.meta.instagram.verifyToken;
  config.meta.instagram.pageAccessToken =
    process.env.META_INSTAGRAM_PAGE_ACCESS_TOKEN ||
    config.meta.instagram.pageAccessToken;

  config.meta.messenger.appSecret =
    process.env.META_MESSENGER_APP_SECRET || config.meta.messenger.appSecret;
  config.meta.messenger.verifyToken =
    process.env.META_MESSENGER_VERIFY_TOKEN ||
    config.meta.messenger.verifyToken;
  config.meta.messenger.pageAccessToken =
    process.env.META_MESSENGER_PAGE_ACCESS_TOKEN ||
    config.meta.messenger.pageAccessToken;
}

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

function detectWebhookPlatform(payload: any) {
  const objectType = payload?.object;

  if (objectType === "instagram") {
    return "instagram";
  }

  if (objectType === "page") {
    return "messenger";
  }

  return null;
}

/**
 * Webhook Verification Endpoint (GET)
 * Meta sends this to verify your webhook URL
 */
function handleWebhookVerification(
  req: express.Request,
  res: express.Response,
) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("Webhook verification request received");

  const verifyTokens = getVerifyTokens();

  if (mode === "subscribe" && verifyTokens.has(token)) {
    console.log("Webhook verified successfully");
    res.status(200).send(challenge);
  } else {
    console.error("Webhook verification failed");
    res.status(403).send("Forbidden");
  }
}

/**
 * Webhook Event Handler (POST)
 * Receives Meta webhook events and forwards to OpenClaw
 */
async function handleMetaWebhookEvent(
  req: express.Request,
  res: express.Response,
) {
  // Always respond 200 immediately to avoid Meta retries
  res.sendStatus(200);

  try {
    const platform = detectWebhookPlatform(req.body);
    if (!platform) {
      console.log("Skipping unsupported webhook object:", req.body?.object);
      return;
    }

    console.log(
      `Webhook event received for ${platform}:`,
      JSON.stringify(req.body, null, 2),
    );

    // Process each entry in the webhook
    const entries = req.body.entry || [];
    for (const entry of entries) {
      await processMetaEntry(platform, entry);
    }
  } catch (error) {
    console.error("Error processing webhook:", error);
  }
}

/**
 * Process a Meta webhook entry
 */
async function processMetaEntry(platform: string, entry: any) {
  if (platform === "instagram") {
    const messaging = entry.messaging || [];
    const changes = entry.changes || [];

    for (const event of messaging) {
      if (event.message) {
        await handleInstagramMessage(event);
      }
    }

    for (const change of changes) {
      if (change.field === "comments") {
        await handleInstagramComment(change.value);
      } else if (change.field === "messages") {
        await handleInstagramMessageFieldChange(change.value);
      }
    }

    return;
  }

  if (platform === "messenger") {
    const messaging = entry.messaging || [];

    for (const event of messaging) {
      if (event.message) {
        await handleMessengerMessage(event);
      }
    }
  }
}

/**
 * Handle Instagram direct message
 */
async function handleInstagramMessage(event: any) {
  const payload = {
    source: "meta-webhook",
    platform: "instagram",
    event: {
      type: "message",
      sender: {
        id: event.sender.id,
      },
      message: {
        id: event.message.mid,
        text: event.message.text || "",
        timestamp: event.timestamp,
        attachments: event.message.attachments || [],
        commands: event.message.commands || [],
      },
      conversation: {
        id: event.sender.id, // Instagram uses sender ID as conversation ID
      },
    },
    metadata: {
      pageId: event.recipient.id,
      receivedAt: new Date().toISOString(),
    },
    callbacks: {
      sendMessage: {
        url: `https://graph.facebook.com/v24.0/me/messages`,
        token: config.meta.instagram.pageAccessToken,
        method: "POST",
        recipientId: event.sender.id,
      },
    },
  };

  await forwardToOpenClaw(event.sender.id, event.message.text || "");
}

/**
 * Handle Instagram messages field update from entry.changes[].value
 */
async function handleInstagramMessageFieldChange(value: any) {
  if (!value || !value.sender || !value.recipient || !value.message) {
    return;
  }

  const normalizedEvent = {
    sender: {
      id: value.sender.id,
    },
    recipient: {
      id: value.recipient.id,
    },
    timestamp: Number(value.timestamp) || Date.now(),
    message: {
      mid: value.message.mid,
      text: value.message.text || "",
      attachments: value.message.attachments || [],
      commands: value.message.commands || [],
    },
  };

  await handleInstagramMessage(normalizedEvent);
}

/**
 * Handle Instagram comment
 */
async function handleInstagramComment(commentData: any) {
  const payload = {
    source: "meta-webhook",
    platform: "instagram",
    event: {
      type: "comment",
      sender: {
        id: commentData.from.id,
        username: commentData.from.username,
      },
      message: {
        id: commentData.id,
        text: commentData.text,
        timestamp: Date.now(),
      },
      conversation: {
        id: commentData.media.id,
      },
    },
    metadata: {
      mediaId: commentData.media.id,
      receivedAt: new Date().toISOString(),
    },
    callbacks: {
      replyToComment: {
        url: `https://graph.facebook.com/v24.0/${commentData.id}/replies`,
        token: config.meta.instagram.pageAccessToken,
        method: "POST",
      },
    },
  };

  await forwardToOpenClaw(commentData.from.id, commentData.text || "");
}

/**
 * Handle Messenger message
 */
async function handleMessengerMessage(event: any) {
  const payload = {
    source: "meta-webhook",
    platform: "messenger",
    event: {
      type: "message",
      sender: {
        id: event.sender.id,
      },
      message: {
        id: event.message.mid,
        text: event.message.text || "",
        timestamp: event.timestamp,
        attachments: event.message.attachments || [],
        quick_reply: event.message.quick_reply || null,
      },
      conversation: {
        id: event.sender.id,
      },
    },
    metadata: {
      pageId: event.recipient.id,
      receivedAt: new Date().toISOString(),
    },
    callbacks: {
      sendMessage: {
        url: `https://graph.facebook.com/v24.0/me/messages`,
        token: config.meta.messenger.pageAccessToken,
        method: "POST",
        recipientId: event.sender.id,
      },
    },
  };

  await forwardToOpenClaw(event.sender.id, event.message.text || "");
}

/**
 * Forward processed event to OpenClaw
 */
async function forwardToOpenClaw(senderId: string, userMessage: string) {
  try {
    console.log("Forwarding to OpenClaw:", config.openclaw.hookUrl);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add API key if configured
    if (config.openclaw.apiKey) {
      headers["Authorization"] = `Bearer ${config.openclaw.apiKey}`;
    }

    // Send payload to Meta Instagram API webhook endpoint
    const instruction = `\
You are a helpful assistant that processes user messages received from Instagram for a business account.
You will help the user to navigate through their requests in a friendly and efficient manner.

You received the following user message from Instagram:
{
  "senderId": "${senderId}", // Instagram User ID
  "message": "${userMessage}" // The text message sent by the user
}


When you have your response ready, send it to this URL via a POST request:
${process.env.SKILL_SERVER || "http://localhost:8080"}/callbacks

The POST request body should be a JSON object with the following structure:
{
  "recipient": {
    "id": "<INSTAGRAM_USER_ID>"
  },
  "message": {
    "text": "<YOUR_RESPONSE_MESSAGE>"
  }
}
`;

    const body = {
      message: instruction,
      wakeMode: "now",
      model: "anthropic/claude-haiku-4-5",
      thinking: "low",
    };

    const response = await fetch(config.openclaw.hookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    console.log("OpenClaw response:", response.status);
  } catch (error: any) {
    console.error("Failed to forward to OpenClaw:", error.message);
    // Don't throw - we already responded 200 to Meta
  }
}

const app = express();
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "meta-webhook-server" });
});

app.get("/webhook/meta", handleWebhookVerification);
app.post("/webhook/meta", handleMetaWebhookEvent);

// Handle agent callbacks for sending messages
app.post("/callbacks", express.json(), async (req, res) => {
  const payload = req.body;

  console.log("Received callback request:", JSON.stringify(payload, null, 2));

  // Here you would implement sending messages back via Meta APIs
  // using the provided callback information in the payload.

  res.status(200).send("Callback received");
});

// Start server
const PORT = config.server.port || 8080;
const HOST = config.server.host || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Meta webhook server running on ${HOST}:${PORT}`);
  console.log(
    `Meta endpoint (recommended): http://${HOST}:${PORT}/webhook/meta`,
  );
  console.log(
    `Instagram endpoint (legacy): http://${HOST}:${PORT}/webhook/instagram`,
  );
  console.log(
    `Messenger endpoint (legacy): http://${HOST}:${PORT}/webhook/messenger`,
  );
  console.log(`OpenClaw hook URL: ${config.openclaw.hookUrl}`);
});
