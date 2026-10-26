/**
 * ZIREKU LICENSE & SECURITY SHIELD
 * (C) 2026 Zireku Developer Owner. All Rights Reserved.
 * Automated release pipeline active.
 * Unauthorized duplication, redistribution, or reverse engineering is strictly prohibited.
 */

import http from 'node:http';
import https from 'node:https';

export const PACKAGE_VERSION = '1.0.7';

let isVerified = false;
let verifiedIp = null;
let securityToken = null;

const IP_SOURCES = [
  'https://api.ipify.org',
  'https://icanhazip.com',
  'https://ifconfig.me/ip',
  'https://ipinfo.io/ip'
];

const LICENSE_ENDPOINTS = [
  'https://otp.zireku.com/license-api/check',
  'http://localhost:3500/check'
];

function fetchText(urlStr, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(urlStr);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      const req = client.get(parsedUrl, { timeout: timeoutMs }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode < 500) {
            resolve(data.trim());
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
    } catch (e) {
      reject(e);
    }
  });
}

function isNewerVersion(remote, local) {
  try {
    const rParts = (remote || '').split('.').map(p => parseInt(p, 10) || 0);
    const lParts = (local || '').split('.').map(p => parseInt(p, 10) || 0);
    for (let i = 0; i < 3; i++) {
      const r = rParts[i] ?? 0;
      const l = lParts[i] ?? 0;
      if (r > l) return true;
      if (r < l) return false;
    }
  } catch (e) {
    // ignore
  }
  return false;
}

function displayUpdateBanner(currentVersion, latestVersion) {
  const ANSI_YELLOW_BOLD = '\x1b[1;33m';
  const ANSI_RESET = '\x1b[0m';
  console.log(`${ANSI_YELLOW_BOLD}[UPDATE] New version available: v${latestVersion} (Current: v${currentVersion})${ANSI_RESET}`);
}

export async function checkForUpdates(currentVersion = PACKAGE_VERSION) {
  try {
    for (const ep of LICENSE_ENDPOINTS) {
      try {
        const base = ep.replace(/\/check$/, '');
        const raw = await fetchText(`${base}/version`, 2500);
        const json = JSON.parse(raw);
        if (json && json.latestVersion && isNewerVersion(json.latestVersion, currentVersion)) {
          displayUpdateBanner(currentVersion, json.latestVersion);
          return { updateAvailable: true, currentVersion, latestVersion: json.latestVersion };
        }
      } catch (e) {}
    }
    // Fallback to npm if configured
    const rawNpm = await fetchText('https://registry.npmjs.org/zireku-ls/latest', 3000);
    const jsonNpm = JSON.parse(rawNpm);
    if (jsonNpm && jsonNpm.version && isNewerVersion(jsonNpm.version, currentVersion)) {
      displayUpdateBanner(currentVersion, jsonNpm.version);
      return { updateAvailable: true, currentVersion, latestVersion: jsonNpm.version };
    }
  } catch (err) {
    // Fail-safe silently, do not disturb client application
  }
  return { updateAvailable: false, currentVersion };
}

async function detectPublicIp() {
  for (const src of IP_SOURCES) {
    try {
      const ip = await fetchText(src, 5000);
      if (ip && /^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
        return ip;
      }
    } catch (err) {
      // try next source
    }
  }
  return '127.0.0.1';
}

async function queryLicenseServer(ip) {
  for (const endpoint of LICENSE_ENDPOINTS) {
    try {
      const raw = await fetchText(`${endpoint}?ip=${encodeURIComponent(ip)}`, 6000);
      const json = JSON.parse(raw);
      if (json && json.status) {
        return json;
      }
    } catch (err) {
      // try next endpoint
    }
  }
  return { status: 'PENDING', message: `Awaiting authorization for IP ${ip}...` };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Anti debugging check
function checkExecutionEnvironment() {
  const argv = (process.execArgv || []).join(' ');
  if (argv.includes('--inspect') || argv.includes('--inspect-brk') || argv.includes('--debug')) {
    process.exit(1);
  }
}

export async function verifyLicense() {
  checkExecutionEnvironment();

  if (isVerified) {
    return { success: true, ip: verifiedIp, token: securityToken };
  }

  // Detect current server IP
  const currentIp = await detectPublicIp();
  const startTime = Date.now();
  let showedDeniedBanner = false;

  const ANSI_RED_BOLD = '\x1b[1;31m';
  const ANSI_RED = '\x1b[31m';
  const ANSI_GREEN_BOLD = '\x1b[1;32m';
  const ANSI_GREEN = '\x1b[32m';
  const ANSI_YELLOW = '\x1b[33m';
  const ANSI_RESET = '\x1b[0m';

  while (true) {
    checkExecutionEnvironment();
    try {
      const result = await queryLicenseServer(currentIp);

      if (result.status === 'APPROVED') {
        isVerified = true;
        verifiedIp = currentIp;
        securityToken = result.signature || Buffer.from(`ZIREKU_SEC_${currentIp}`).toString('hex');

        // Clear in-place pending line cleanly if it was waiting
        if (showedDeniedBanner) {
          process.stdout.write('\r\x1b[K');
          console.log(`${ANSI_GREEN_BOLD}Your IP address is allowed ${currentIp} !${ANSI_RESET}`);
        }

        // Check for updates asynchronously in background (fail-safe)
        if (result.latestVersion && isNewerVersion(result.latestVersion, PACKAGE_VERSION)) {
          displayUpdateBanner(PACKAGE_VERSION, result.latestVersion);
        } else {
          checkForUpdates(PACKAGE_VERSION).catch(() => {});
        }

        return { success: true, ip: currentIp, token: securityToken };
      }

      // If status is REJECTED or PENDING, show Red not allowed message once
      if (!showedDeniedBanner) {
        console.log(`${ANSI_RED_BOLD}Your IP address is not allowed ${currentIp} !${ANSI_RESET}`);
        showedDeniedBanner = true;
      }

      // Stay calm on 1 line with elapsed timer
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const waitMessage = `${ANSI_YELLOW}[*] Awaiting authorization for IP ${currentIp}... [${elapsed}s]${ANSI_RESET}`;
      process.stdout.write(`\r${waitMessage}\x1b[K`);

      await sleep(3000);
    } catch (err) {
      if (!showedDeniedBanner) {
        console.log(`${ANSI_RED_BOLD}Your IP address is not allowed ${currentIp} !${ANSI_RESET}`);
        showedDeniedBanner = true;
      }

      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const waitMessage = `${ANSI_YELLOW}[*] Awaiting authorization for IP ${currentIp}... [${elapsed}s]${ANSI_RESET}`;
      process.stdout.write(`\r${waitMessage}\x1b[K`);

      await sleep(3000);
    }
  }
}

export function createSecurityMiddleware() {
  return function (req, res, next) {
    if (!isVerified) {
      if (res && typeof res.writeHead === 'function') {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'License verification in progress. Please wait.' }));
        return;
      }
      throw new Error('[ZIREKU-LS] Security violation: License not verified.');
    }
    if (typeof next === 'function') next();
  };
}

export function isLicenseActive() {
  return isVerified;
}

export function getSecuritySignature() {
  if (!isVerified) throw new Error('[ZIREKU-LS] Access Denied: Unlicensed environment');
  return securityToken;
}

export function validateAppIntegrity() {
  return isVerified === true && !!securityToken;
}

export default {
  PACKAGE_VERSION,
  checkForUpdates,
  verifyLicense,
  createSecurityMiddleware,
  isLicenseActive,
  getSecuritySignature,
  validateAppIntegrity
};
