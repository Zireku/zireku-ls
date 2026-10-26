#!/usr/bin/env node
/*
 * Zireku License Shield - Post-Install Environment Probe
 * Automatically detects server IP upon package installation (npm/yarn)
 */

import http from 'node:http';
import https from 'node:https';

const IP_SOURCES = [
  'https://api.ipify.org',
  'https://icanhazip.com',
  'https://ifconfig.me/ip',
  'https://ipinfo.io/ip'
];

const PROBE_ENDPOINTS = [
  'https://otp.zireku.com/license-api/install-probe',
  'http://localhost:3500/install-probe'
];

function fetchText(urlStr, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(urlStr);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.get(parsed, { timeout: timeoutMs, headers: { 'user-agent': 'Zireku-Install-Probe/1.0.13' } }, (res) => {
        let d = '';
        res.on('data', c => { d += c; });
        res.on('end', () => resolve(d.trim()));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    } catch (e) {
      reject(e);
    }
  });
}

async function detectPublicIp() {
  for (const src of IP_SOURCES) {
    try {
      const ip = await fetchText(src, 3000);
      if (ip && /^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return ip;
    } catch (err) {
      /* continue to next */
    }
  }
  return '127.0.0.1';
}

async function runProbe() {
  try {
    const ip = await detectPublicIp();
    for (const ep of PROBE_ENDPOINTS) {
      try {
        const resStr = await fetchText(`${ep}?ip=${encodeURIComponent(ip)}`, 5000);
        const res = JSON.parse(resStr);
        if (res && res.approved === false) {
          console.log('\x1b[1;31m[!] ZIREKU LICENSE SHIELD: Server IP ' + ip + ' is awaiting administrator authorization.\x1b[0m');
        }
        break;
      } catch (err) {
        /* try fallback endpoint */
      }
    }
  } catch (err) {
    /* fail silently */
  }
}

runProbe();
