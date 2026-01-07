/**
 * GitHub Webhook Handler for Automatic Deployment
 *
 * Handles GitHub webhook events for automatic deployment on o2switch
 * Verifies signature, pulls latest code, installs dependencies, and restarts server
 */

const express = require('express');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Webhook secret (stored in .env)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Deployment script path
const DEPLOY_SCRIPT = path.join(__dirname, '../deploy.sh');

// Deployment log file
const DEPLOY_LOG = path.join(__dirname, '../deploy.log');

/**
 * Verify GitHub webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - x-hub-signature-256 header from GitHub
 * @returns {boolean} - True if signature is valid
 */
function verifyGitHubSignature(payload, signature) {
  if (!signature || !WEBHOOK_SECRET) {
    return false;
  }

  // GitHub sends signature as "sha256=<hash>"
  const sigHashAlg = 'sha256';
  const sigHeaderName = `${sigHashAlg}=`;

  if (!signature.startsWith(sigHeaderName)) {
    return false;
  }

  // Extract the hash from the signature header
  const receivedHash = signature.substring(sigHeaderName.length);

  // Calculate expected hash
  const hmac = crypto.createHmac(sigHashAlg, WEBHOOK_SECRET);
  const expectedHash = hmac.update(payload).digest('hex');

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(receivedHash, 'hex'),
    Buffer.from(expectedHash, 'hex')
  );
}

/**
 * Log deployment event
 * @param {string} message - Log message
 * @param {string} level - Log level (INFO, ERROR, SUCCESS)
 */
function logDeployment(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}\n`;

  console.log(logMessage.trim());

  // Append to deployment log file
  fs.appendFileSync(DEPLOY_LOG, logMessage, 'utf8');
}

/**
 * Execute deployment script
 * @returns {Promise<string>} - Script output
 */
function executeDeploy() {
  return new Promise((resolve, reject) => {
    logDeployment('Starting deployment...', 'INFO');

    exec(`bash ${DEPLOY_SCRIPT}`, (error, stdout, stderr) => {
      if (error) {
        logDeployment(`Deployment failed: ${error.message}`, 'ERROR');
        logDeployment(`stderr: ${stderr}`, 'ERROR');
        reject(error);
        return;
      }

      if (stderr) {
        logDeployment(`stderr: ${stderr}`, 'WARN');
      }

      logDeployment('Deployment completed successfully', 'SUCCESS');
      logDeployment(`stdout: ${stdout}`, 'INFO');

      resolve(stdout);
    });
  });
}

/**
 * POST /webhook/deploy
 * GitHub webhook endpoint for automatic deployment
 */
router.post('/deploy', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // 1. Check if webhook secret is configured
    if (!WEBHOOK_SECRET) {
      logDeployment('Webhook secret not configured in .env', 'ERROR');
      return res.status(500).json({
        success: false,
        error: 'Webhook secret not configured'
      });
    }

    // 2. Get GitHub signature from headers
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
      logDeployment('Missing x-hub-signature-256 header', 'ERROR');
      return res.status(401).json({
        success: false,
        error: 'Missing signature'
      });
    }

    // 3. Verify signature
    const rawBody = req.body.toString('utf8');
    const isValid = verifyGitHubSignature(rawBody, signature);

    if (!isValid) {
      logDeployment('Invalid webhook signature', 'ERROR');
      return res.status(401).json({
        success: false,
        error: 'Invalid signature'
      });
    }

    // 4. Parse payload
    const payload = JSON.parse(rawBody);

    // 5. Check if it's a push event
    const eventType = req.headers['x-github-event'];
    if (eventType !== 'push') {
      logDeployment(`Ignoring event type: ${eventType}`, 'INFO');
      return res.status(200).json({
        success: true,
        message: `Event type ${eventType} ignored`
      });
    }

    // 6. Optional: Check if push is to main branch
    const branch = payload.ref?.split('/').pop();
    if (branch !== 'main') {
      logDeployment(`Ignoring push to branch: ${branch}`, 'INFO');
      return res.status(200).json({
        success: true,
        message: `Branch ${branch} ignored (only main triggers deployment)`
      });
    }

    // 7. Log deployment trigger
    const commits = payload.commits || [];
    const commitMessages = commits.map(c => c.message).join(', ');
    logDeployment(`Deployment triggered by push to ${branch}`, 'INFO');
    logDeployment(`Commits: ${commitMessages}`, 'INFO');
    logDeployment(`Pusher: ${payload.pusher?.name || 'unknown'}`, 'INFO');

    // 8. Execute deployment (async, don't wait for completion)
    // Send response immediately to GitHub
    res.status(202).json({
      success: true,
      message: 'Deployment started',
      branch,
      commits: commits.length
    });

    // 9. Execute deployment in background
    executeDeploy().catch(error => {
      logDeployment(`Deployment execution failed: ${error.message}`, 'ERROR');
    });

  } catch (error) {
    logDeployment(`Webhook error: ${error.message}`, 'ERROR');
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /webhook/status
 * Check webhook status and last deployment
 */
router.get('/status', (req, res) => {
  try {
    // Check if webhook is configured
    const isConfigured = !!WEBHOOK_SECRET;

    // Get last deployment log entries
    let lastDeployments = [];
    if (fs.existsSync(DEPLOY_LOG)) {
      const logContent = fs.readFileSync(DEPLOY_LOG, 'utf8');
      const lines = logContent.split('\n').filter(l => l.trim());
      lastDeployments = lines.slice(-10); // Last 10 entries
    }

    res.json({
      success: true,
      webhook: {
        configured: isConfigured,
        endpoint: '/webhook/deploy',
        method: 'POST'
      },
      lastDeployments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
