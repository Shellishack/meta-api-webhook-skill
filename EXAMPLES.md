# Example OpenClaw Integration

This document shows examples of how OpenClaw would receive and respond to Meta webhook events.

## Example 1: Receiving a Message

When a user sends a message on Facebook or Instagram, the webhook skill sends this payload to OpenClaw:

```json
{
  "skill": "meta-api-webhook-skill",
  "event": {
    "type": "messaging",
    "objectType": "page",
    "senderId": "1234567890",
    "recipientId": "0987654321",
    "timestamp": 1707721200000,
    "messageType": "message",
    "message": {
      "mid": "m_abc123def456",
      "text": "Hello, I need help with my order"
    }
  },
  "metaApiConfig": {
    "accessToken": "EAAxxxxxx...",
    "apiVersion": "v18.0",
    "baseUrl": "https://graph.facebook.com"
  },
  "callbacks": {
    "sendMessage": {
      "url": "https://graph.facebook.com/v18.0/me/messages",
      "method": "POST",
      "authToken": "EAAxxxxxx..."
    },
    "sendComment": {
      "url": "https://graph.facebook.com/v18.0/{object-id}/comments",
      "method": "POST",
      "authToken": "EAAxxxxxx..."
    },
    "reactToContent": {
      "url": "https://graph.facebook.com/v18.0/{object-id}/likes",
      "method": "POST",
      "authToken": "EAAxxxxxx..."
    }
  }
}
```

## Example 2: OpenClaw Responding to a Message

OpenClaw can use the provided callback information to send a response. Here's how OpenClaw might use the callback:

### Using the provided callbacks directly

```javascript
// In OpenClaw's hook handler
async function handleMetaWebhook(payload) {
  const { event, callbacks } = payload;
  
  if (event.messageType === 'message' && event.message.text) {
    const senderId = event.senderId;
    const messageText = event.message.text;
    
    // Process the message with AI/logic
    const response = await processUserMessage(messageText);
    
    // Send response using the callback
    const sendMessageUrl = callbacks.sendMessage.url;
    const authToken = callbacks.sendMessage.authToken;
    
    await fetch(sendMessageUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        recipient: { id: senderId },
        message: { text: response },
        messaging_type: 'RESPONSE'
      })
    });
  }
}
```

### Using axios (if available in OpenClaw)

```javascript
const axios = require('axios');

async function handleMetaWebhook(payload) {
  const { event, metaApiConfig } = payload;
  
  if (event.messageType === 'message') {
    const response = await generateAIResponse(event.message.text);
    
    await axios.post(
      `${metaApiConfig.baseUrl}/${metaApiConfig.apiVersion}/me/messages`,
      {
        recipient: { id: event.senderId },
        message: { text: response }
      },
      {
        params: { access_token: metaApiConfig.accessToken }
      }
    );
  }
}
```

## Example 3: Handling Different Event Types

### Postback Event (Button Click)

```json
{
  "skill": "meta-api-webhook-skill",
  "event": {
    "type": "messaging",
    "objectType": "page",
    "senderId": "1234567890",
    "recipientId": "0987654321",
    "timestamp": 1707721200000,
    "messageType": "postback",
    "postback": {
      "title": "Get Started",
      "payload": "GET_STARTED_PAYLOAD"
    }
  },
  "metaApiConfig": { /* ... */ },
  "callbacks": { /* ... */ }
}
```

OpenClaw handler:
```javascript
if (event.messageType === 'postback') {
  const payload = event.postback.payload;
  
  switch(payload) {
    case 'GET_STARTED_PAYLOAD':
      // Send welcome message
      break;
    case 'HELP':
      // Send help information
      break;
  }
}
```

### Comment Event

```json
{
  "skill": "meta-api-webhook-skill",
  "event": {
    "type": "change",
    "objectType": "page",
    "field": "feed",
    "value": {
      "item": "comment",
      "comment_id": "123456_789012",
      "post_id": "123456",
      "from": {
        "id": "987654",
        "name": "John Doe"
      },
      "message": "Great post!"
    }
  },
  "metaApiConfig": { /* ... */ },
  "callbacks": { /* ... */ }
}
```

OpenClaw handler:
```javascript
if (event.type === 'change' && event.field === 'feed') {
  const commentData = event.value;
  
  // Reply to comment
  await axios.post(
    callbacks.sendComment.url.replace('{object-id}', commentData.comment_id),
    null,
    {
      params: {
        access_token: callbacks.sendComment.authToken,
        message: 'Thank you for your feedback!'
      }
    }
  );
}
```

## Example 4: Advanced Response with Rich Content

OpenClaw sending a message with quick replies:

```javascript
async function sendQuickReply(senderId, callbacks) {
  const url = callbacks.sendMessage.url;
  const token = callbacks.sendMessage.authToken;
  
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      recipient: { id: senderId },
      message: {
        text: "How can I help you today?",
        quick_replies: [
          {
            content_type: "text",
            title: "Track Order",
            payload: "TRACK_ORDER"
          },
          {
            content_type: "text",
            title: "Contact Support",
            payload: "CONTACT_SUPPORT"
          }
        ]
      },
      messaging_type: 'RESPONSE'
    }),
    params: {
      access_token: token
    }
  });
}
```

## Example 5: Error Handling

OpenClaw should handle potential errors when using callbacks:

```javascript
async function handleMetaWebhook(payload) {
  const { event, callbacks, metaApiConfig } = payload;
  
  try {
    // Process event
    const response = await processMessage(event);
    
    // Send response
    try {
      await sendMessageToMeta(
        callbacks.sendMessage.url,
        callbacks.sendMessage.authToken,
        event.senderId,
        response
      );
    } catch (sendError) {
      console.error('Failed to send message to Meta:', sendError);
      // Log to monitoring system
      // Could retry with exponential backoff
    }
  } catch (error) {
    console.error('Error handling Meta webhook:', error);
    // Send fallback message
    await sendFallbackMessage(event.senderId, callbacks);
  }
}
```

## Example 6: Using Typing Indicators

Show typing indicator while processing:

```javascript
async function handleMessageWithTyping(payload) {
  const { event, metaApiConfig } = payload;
  const senderId = event.senderId;
  const baseUrl = metaApiConfig.baseUrl;
  const apiVersion = metaApiConfig.apiVersion;
  const token = metaApiConfig.accessToken;
  
  // Send typing_on
  await axios.post(
    `${baseUrl}/${apiVersion}/me/messages`,
    {
      recipient: { id: senderId },
      sender_action: 'typing_on'
    },
    { params: { access_token: token } }
  );
  
  // Process message (takes time)
  const response = await generateAIResponse(event.message.text);
  
  // Send typing_off
  await axios.post(
    `${baseUrl}/${apiVersion}/me/messages`,
    {
      recipient: { id: senderId },
      sender_action: 'typing_off'
    },
    { params: { access_token: token } }
  );
  
  // Send actual response
  await axios.post(
    `${baseUrl}/${apiVersion}/me/messages`,
    {
      recipient: { id: senderId },
      message: { text: response }
    },
    { params: { access_token: token } }
  );
}
```

## Complete OpenClaw Hook Handler Example

```javascript
// Complete example of an OpenClaw hook handler for Meta webhooks

module.exports = async function handleMetaWebhookHook(req, res) {
  const payload = req.body;
  
  // Verify it's from the Meta webhook skill
  if (payload.skill !== 'meta-api-webhook-skill') {
    return res.status(400).json({ error: 'Invalid skill' });
  }
  
  const { event, callbacks, metaApiConfig } = payload;
  
  try {
    // Route based on event type
    if (event.type === 'messaging') {
      await handleMessagingEvent(event, callbacks, metaApiConfig);
    } else if (event.type === 'change') {
      await handleChangeEvent(event, callbacks, metaApiConfig);
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing Meta webhook:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
};

async function handleMessagingEvent(event, callbacks, config) {
  const { senderId, messageType } = event;
  
  switch(messageType) {
    case 'message':
      const userMessage = event.message.text;
      const aiResponse = await getAIResponse(userMessage);
      await sendMessage(senderId, aiResponse, callbacks, config);
      break;
      
    case 'postback':
      await handlePostback(senderId, event.postback, callbacks, config);
      break;
      
    case 'read':
      // Message was read, update status
      console.log(`Message read by ${senderId}`);
      break;
  }
}

async function handleChangeEvent(event, callbacks, config) {
  const { field, value } = event;
  
  if (field === 'feed' && value.item === 'comment') {
    // Auto-reply to comment
    await replyToComment(value.comment_id, callbacks);
  }
}

async function sendMessage(recipientId, text, callbacks, config) {
  const url = callbacks.sendMessage.url;
  const token = callbacks.sendMessage.authToken;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: 'RESPONSE'
    }),
    params: { access_token: token }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.status}`);
  }
  
  return response.json();
}
```

## Tips for OpenClaw Integration

1. **Respond Quickly**: Meta expects a 200 response within 20 seconds
2. **Process Async**: Use async processing for time-consuming operations
3. **Handle Errors**: Always implement error handling and fallbacks
4. **Rate Limits**: Be aware of Meta's API rate limits
5. **Validate Events**: Always validate the incoming event structure
6. **Logging**: Log all webhook events for debugging
7. **Idempotency**: Handle duplicate webhook deliveries gracefully
