#!/usr/bin/env node

/**
 * Simple integration test for Meta API Webhook Skill
 * This tests the webhook endpoint and OpenClaw integration
 */

const http = require('http');
const crypto = require('crypto');

// Test configuration
const SERVER_PORT = 3000;
const MOCK_OPENCLAW_PORT = 8080;
const META_APP_SECRET = 'test_secret';

// Mock OpenClaw server
let openclawRequestReceived = false;
let openclawPayload = null;

const mockOpenClawServer = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/hooks/agent') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      openclawRequestReceived = true;
      openclawPayload = JSON.parse(body);
      console.log('✓ Mock OpenClaw received hook request');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Test webhook POST with signature
function testWebhookPost() {
  return new Promise((resolve, reject) => {
    const testPayload = {
      object: 'page',
      entry: [{
        id: '123456789',
        time: Date.now(),
        messaging: [{
          sender: { id: 'user123' },
          recipient: { id: 'page456' },
          timestamp: Date.now(),
          message: {
            mid: 'mid.123',
            text: 'Hello, World!'
          }
        }]
      }]
    };

    const payload = JSON.stringify(testPayload);
    const signature = 'sha256=' + crypto
      .createHmac('sha256', META_APP_SECRET)
      .update(payload)
      .digest('hex');

    const options = {
      hostname: 'localhost',
      port: SERVER_PORT,
      path: '/webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-hub-signature-256': signature
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✓ Webhook POST accepted');
          resolve();
        } else {
          reject(new Error(`Webhook POST failed with status ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Test health endpoint
function testHealthEndpoint() {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${SERVER_PORT}/health`, (res) => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          const response = JSON.parse(data);
          if (response.status === 'ok') {
            console.log('✓ Health endpoint working');
            resolve();
          } else {
            reject(new Error('Health check failed'));
          }
        } else {
          reject(new Error(`Health check returned status ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

// Run tests
async function runTests() {
  console.log('Starting integration tests...\n');

  try {
    // Start mock OpenClaw server
    await new Promise((resolve) => {
      mockOpenClawServer.listen(MOCK_OPENCLAW_PORT, resolve);
    });
    console.log(`✓ Mock OpenClaw server started on port ${MOCK_OPENCLAW_PORT}\n`);

    // Wait for main server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Run tests
    await testHealthEndpoint();
    await testWebhookPost();

    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify OpenClaw received the hook
    if (openclawRequestReceived) {
      console.log('✓ OpenClaw hook was invoked');
      
      // Verify payload structure
      if (openclawPayload.skill === 'meta-api-webhook-skill') {
        console.log('✓ Payload contains correct skill name');
      }
      
      if (openclawPayload.event && openclawPayload.event.messageType === 'message') {
        console.log('✓ Payload contains message event');
      }
      
      if (openclawPayload.metaApiConfig && openclawPayload.metaApiConfig.accessToken) {
        console.log('✓ Payload contains Meta API config');
      }
      
      if (openclawPayload.callbacks && openclawPayload.callbacks.sendMessage) {
        console.log('✓ Payload contains callback endpoints');
      }
    } else {
      throw new Error('OpenClaw hook was not invoked');
    }

    console.log('\n✅ All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    mockOpenClawServer.close();
  }
}

// Start tests
runTests();
