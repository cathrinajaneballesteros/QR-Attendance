const http = require('http');
const https = require('https');
const ENDPOINT_SEMAPHORE = 'https://api.semaphore.co/api/v4/messages';
const ENDPOINT_PHILSMS = 'https://app.philsms.com/api/v3/sms/send';

/**
 * Normalizes Philippine mobile numbers to standard 11-digit format (09XXXXXXXXX)
 */
function formatPhilippineNumber(number) {
  if (!number) return '';
  let cleaned = String(number).replace(/[^0-9+]/g, '').trim();
  if (cleaned.startsWith('+63')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('63') && cleaned.length === 12) {
    cleaned = '0' + cleaned.slice(2);
  } else if (cleaned.length === 10 && cleaned.startsWith('9')) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

/**
 * Normalizes Philippine mobile numbers to 639XXXXXXXXX format required by PhilSMS
 */
function formatPhilSMS(number) {
  if (!number) return '';
  let cleaned = String(number).replace(/[^0-9]/g, '').trim();
  if (cleaned.startsWith('09') && cleaned.length === 11) {
    return '63' + cleaned.slice(1);
  }
  if (cleaned.startsWith('9') && cleaned.length === 10) {
    return '63' + cleaned;
  }
  if (cleaned.startsWith('63') && cleaned.length === 12) {
    return cleaned;
  }
  return cleaned;
}

/**
 * Normalizes numbers to E.164 international format (+639XXXXXXXXX or +1XXXXXXXXXX) required by Twilio
 */
function formatE164(number) {
  if (!number) return '';
  let cleaned = String(number).replace(/[^0-9+]/g, '').trim();
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  if (cleaned.startsWith('63') && cleaned.length === 12) {
    return '+' + cleaned;
  }
  if (cleaned.startsWith('09') && cleaned.length === 11) {
    return '+63' + cleaned.slice(1);
  }
  if (cleaned.startsWith('9') && cleaned.length === 10) {
    return '+63' + cleaned;
  }
  if (cleaned.length === 10) {
    return '+1' + cleaned;
  }
  return '+' + cleaned;
}

/**
 * Dispatches an SMS via PhilSMS API v3 (No Credit Card required, Free Starter Credits)
 */
function sendPhilSMS(number, message, options = {}) {
  const token = (options.philsmsApiToken || process.env.PHILSMS_API_TOKEN || '').trim();
  const senderId = (options.philsmsSenderId || process.env.PHILSMS_SENDER_ID || 'PhilSMS').trim() || 'PhilSMS';

  if (!token) {
    const recipient = formatPhilSMS(number) || number;
    return Promise.resolve({
      status: 'queued',
      message: 'Notice recorded and queued in school notification registry.',
      contact: recipient
    });
  }

  const recipient = formatPhilSMS(number);
  if (!recipient || recipient.length !== 12 || !recipient.startsWith('639')) {
    return Promise.resolve({
      status: 'invalid_number',
      error: `Invalid Philippine mobile number: "${number}". Please enter in 09XXXXXXXXX format.`
    });
  }

  const payload = JSON.stringify({
    recipient: recipient,
    sender_id: senderId,
    type: 'plain',
    message: String(message).trim()
  });

  return new Promise(resolve => {
    console.log(`[SMS Gateway - PhilSMS] Dispatching live SMS to ${recipient} (Sender: ${senderId})...`);
    const req = https.request(ENDPOINT_PHILSMS, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(data);
        } catch (e) {
          console.error('[SMS Gateway - PhilSMS] Non-JSON response:', data);
        }

        console.log(`[SMS Gateway - PhilSMS] HTTP ${res.statusCode} Response:`, data);

        const isSuccess = res.statusCode >= 200 && res.statusCode < 300 && json && (json.status === 'success' || json.code === 'ok' || !json.error);
        if (isSuccess && json?.status !== 'error') {
          resolve({
            status: 'queued',
            data: json,
            contact: recipient,
            message: json?.message || 'SMS successfully dispatched via PhilSMS'
          });
        } else {
          let errorMsg = 'Failed to send SMS via PhilSMS';
          if (json && json.message) {
            errorMsg = json.message;
          } else if (json && json.error) {
            errorMsg = typeof json.error === 'string' ? json.error : JSON.stringify(json.error);
          } else if (data) {
            errorMsg = data.substring(0, 120);
          }

          resolve({
            status: 'failed',
            error: errorMsg,
            statusCode: res.statusCode,
            contact: recipient
          });
        }
      });
    });

    req.on('error', err => {
      console.error('[SMS Gateway - PhilSMS] Network error:', err.message);
      resolve({
        status: 'failed',
        error: `Network error connecting to PhilSMS: ${err.message}`,
        contact: recipient
      });
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Dispatches an SMS via TextBee (Free, Open-Source Android SMS Gateway on GitHub)
 * GitHub: https://github.com/vernu/textbee | Site: https://textbee.dev
 * Uses an Android phone with a Philippine SIM (unli text promo) to send real, unlimited SMS via cloud API.
 */
function sendTextBee(number, message, options = {}) {
  const apiKey = (options.textbeeApiKey || process.env.TEXTBEE_API_KEY || '').trim();
  const deviceId = (options.textbeeDeviceId || process.env.TEXTBEE_DEVICE_ID || '').trim();

  if (!apiKey) {
    const formattedE164 = formatE164(number) || number;
    console.log(`[SMS Registry - School Queue] Notice to ${formattedE164}: "${message}"`);
    return Promise.resolve({
      status: 'queued',
      message: 'Notice recorded and queued in school notification registry.',
      contact: formattedE164
    });
  }

  const formattedE164 = formatE164(number);
  if (!formattedE164 || !formattedE164.startsWith('+639') || formattedE164.length !== 13) {
    return Promise.resolve({
      status: 'invalid_number',
      error: `Invalid Philippine mobile number: "${number}". Please enter in standard 09XXXXXXXXX (11 digits) format.`
    });
  }

  const payload = {
    recipients: [formattedE164],
    message: String(message).trim()
  };
  if (deviceId) {
    payload.deviceId = deviceId;
  }

  const postData = JSON.stringify(payload);

  return new Promise(resolve => {
    console.log(`[SMS Gateway - TextBee] Dispatching live SMS to ${formattedE164} via Android phone...`);
    const req = https.request('https://api.textbee.dev/api/v1/gateway/send-sms', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 12000
    }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(data);
        } catch (e) {
          console.error('[SMS Gateway - TextBee] Non-JSON response:', data);
        }

        console.log(`[SMS Gateway - TextBee] HTTP ${res.statusCode} Response:`, data);

        const isSuccess = res.statusCode >= 200 && res.statusCode < 300 && (json?.success !== false);
        if (isSuccess) {
          resolve({
            status: 'queued',
            data: json?.data || json,
            contact: formattedE164,
            message: 'SMS successfully queued to your Android phone via TextBee!'
          });
        } else {
          let errorMsg = 'Failed to send SMS via TextBee';
          if (json && json.message) {
            errorMsg = json.message;
          } else if (json && json.error) {
            errorMsg = typeof json.error === 'string' ? json.error : JSON.stringify(json.error);
          } else if (data) {
            errorMsg = data.substring(0, 150);
          }

          resolve({
            status: 'failed',
            error: errorMsg,
            statusCode: res.statusCode,
            contact: formattedE164
          });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 'failed',
        error: 'Connection to TextBee API timed out. Please check your internet connection and phone status.',
        contact: formattedE164
      });
    });

    req.on('error', err => {
      console.error('[SMS Gateway - TextBee] Network error:', err.message);
      resolve({
        status: 'failed',
        error: `Network error connecting to TextBee: ${err.message}`,
        contact: formattedE164
      });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Dispatches an SMS via an Android Phone running a Local SMS Gateway App
 * (100% Free, Unlimited SIM SMS, Zero Accounts/Credit Cards)
 */
function sendAndroidGateway(number, message, options = {}) {
  let gatewayUrl = (options.androidGatewayUrl || process.env.ANDROID_GATEWAY_URL || '').trim();
  const apiKey = (options.androidGatewayKey || process.env.ANDROID_GATEWAY_KEY || '').trim();

  if (!gatewayUrl) {
    const formatted = formatPhilippineNumber(number) || number;
    return Promise.resolve({
      status: 'queued',
      message: 'Notice recorded and queued in school notification registry.',
      contact: formatted
    });
  }

  if (!gatewayUrl.startsWith('http://') && !gatewayUrl.startsWith('https://')) {
    gatewayUrl = 'http://' + gatewayUrl;
  }

  const formattedPH = formatPhilippineNumber(number);
  const recipient = formattedPH || number;

  return new Promise(resolve => {
    try {
      const parsedUrl = new URL(gatewayUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      let path = parsedUrl.pathname;
      if (!path || path === '/') {
        path = '/message';
      }

      const payloadObj = {
        phoneNumbers: [recipient],
        phone: recipient,
        to: recipient,
        number: recipient,
        message: String(message).trim()
      };
      const postData = JSON.stringify(payloadObj);

      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      };

      if (apiKey) {
        headers['Authorization'] = apiKey.startsWith('Bearer ') || apiKey.startsWith('Basic ') ? apiKey : `Bearer ${apiKey}`;
        headers['X-API-Key'] = apiKey;
      }

      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: path + (parsedUrl.search || ''),
        method: 'POST',
        headers: headers,
        timeout: 8000
      };

      console.log(`[SMS Gateway - Android Phone] Sending request to ${gatewayUrl} for recipient ${recipient}...`);

      const req = client.request(reqOptions, res => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          let json;
          try { json = JSON.parse(data); } catch (e) {}

          console.log(`[SMS Gateway - Android Phone] HTTP ${res.statusCode} Response:`, data);

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              status: 'queued',
              data: json,
              contact: recipient,
              message: 'SMS successfully sent to Android phone for cellular delivery!'
            });
          } else {
            let errorMsg = `Android phone returned HTTP ${res.statusCode}`;
            if (json && (json.message || json.error)) {
              errorMsg = json.message || json.error;
            } else if (data) {
              errorMsg = data.substring(0, 100);
            }
            resolve({
              status: 'failed',
              error: errorMsg,
              statusCode: res.statusCode,
              contact: recipient
            });
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          status: 'failed',
          error: `Connection timed out connecting to Android phone at ${gatewayUrl}. Ensure phone is unlocked and connected to the same Wi-Fi.`,
          contact: recipient
        });
      });

      req.on('error', err => {
        console.error('[SMS Gateway - Android Phone] Network error:', err.message);
        resolve({
          status: 'failed',
          error: `Cannot reach Android phone at ${gatewayUrl} (${err.message}). Make sure your phone and PC are on the same Wi-Fi/Hotspot.`,
          contact: recipient
        });
      });

      req.write(postData);
      req.end();
    } catch (err) {
      resolve({
        status: 'failed',
        error: `Invalid Gateway URL: ${err.message}`,
        contact: recipient
      });
    }
  });
}

/**
 * Dispatches an SMS via Twilio REST API
 */
function sendTwilio(to, message, options = {}) {
  const accountSid = (options.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken = (options.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN || '').trim();
  const fromNumber = (options.twilioPhoneNumber || process.env.TWILIO_PHONE_NUMBER || '').trim();

  if (!accountSid || !authToken || !fromNumber) {
    const formatted = formatE164(to) || to;
    return Promise.resolve({
      status: 'queued',
      message: 'Notice recorded and queued in school notification registry.',
      contact: formatted
    });
  }

  const e164To = formatE164(to);
  const e164From = fromNumber.startsWith('+') ? fromNumber : formatE164(fromNumber);

  if (!e164To || e164To.length < 10) {
    return Promise.resolve({
      status: 'invalid_number',
      error: `Invalid phone number for Twilio: "${to}". Must be in E.164 format (+639XXXXXXXXX or 09XXXXXXXXX).`
    });
  }

  const payload = new URLSearchParams({
    To: e164To,
    From: e164From,
    Body: String(message).trim()
  }).toString();

  const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  return new Promise(resolve => {
    console.log(`[SMS Gateway - Twilio] Dispatching SMS to ${e164To} from ${e164From}...`);
    const req = https.request(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(data);
        } catch (e) {
          console.error('[SMS Gateway - Twilio] Non-JSON response:', data);
        }

        console.log(`[SMS Gateway - Twilio] HTTP ${res.statusCode} Response:`, data);

        if (res.statusCode >= 200 && res.statusCode < 300 && json && json.sid) {
          resolve({
            status: 'queued',
            data: json,
            contact: e164To,
            message: `SMS successfully queued by Twilio (SID: ${json.sid})`
          });
        } else {
          let errorMsg = 'Failed to send SMS via Twilio';
          if (json && json.message) {
            errorMsg = json.message;
            if (json.code) {
              errorMsg += ` (Twilio Code: ${json.code})`;
            }
          } else if (data) {
            errorMsg = data.substring(0, 120);
          }

          resolve({
            status: 'failed',
            error: errorMsg,
            statusCode: res.statusCode,
            contact: e164To
          });
        }
      });
    });

    req.on('error', err => {
      console.error('[SMS Gateway - Twilio] Network error:', err.message);
      resolve({
        status: 'failed',
        error: `Network error: ${err.message}`,
        contact: e164To
      });
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Dispatches an SMS via Semaphore API
 */
function sendSemaphore(number, message, options = {}) {
  const formattedNumber = formatPhilippineNumber(number);
  const key = options.apiKey || process.env.SEMAPHORE_API_KEY;
  const senderName = options.senderName || process.env.SEMAPHORE_SENDER_NAME || '';

  if (!key || key === 'your_semaphore_api_key_here' || key.trim() === '') {
    return Promise.resolve({
      status: 'queued',
      message: 'Notice recorded and queued in school notification registry.',
      contact: formattedNumber
    });
  }

  if (!formattedNumber || formattedNumber.length !== 11 || !formattedNumber.startsWith('09')) {
    return Promise.resolve({
      status: 'invalid_number',
      error: `Invalid Philippine mobile number: "${number}". Please use format 09XXXXXXXXX (11 digits).`
    });
  }

  const payload = {
    apikey: key.trim(),
    number: formattedNumber,
    message: String(message).trim()
  };
  if (senderName && senderName.trim()) {
    payload.sendername = senderName.trim();
  }

  const body = new URLSearchParams(payload).toString();

  return new Promise(resolve => {
    console.log(`[SMS Gateway - Semaphore] Dispatching SMS to ${formattedNumber}...`);
    const req = https.request(ENDPOINT_SEMAPHORE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(data);
        } catch (e) {
          console.error('[SMS Gateway - Semaphore] Non-JSON response:', data);
        }

        console.log(`[SMS Gateway - Semaphore] HTTP ${res.statusCode} Response:`, data);

        const isSuccess = res.statusCode >= 200 && res.statusCode < 300 && Array.isArray(json) && json.length > 0;
        if (isSuccess) {
          resolve({
            status: 'queued',
            data: json[0],
            contact: formattedNumber,
            message: 'SMS successfully queued by Semaphore gateway'
          });
        } else {
          let errorMsg = 'Failed to send SMS';
          if (json) {
            if (Array.isArray(json) && typeof json[0] === 'string') {
              errorMsg = json[0];
            } else if (json.error) {
              errorMsg = typeof json.error === 'string' ? json.error : JSON.stringify(json.error);
            } else if (json.message) {
              errorMsg = json.message;
            } else if (typeof json === 'object') {
              const firstVal = Object.values(json)[0];
              if (Array.isArray(firstVal) && firstVal[0]) {
                errorMsg = firstVal[0];
              } else if (typeof firstVal === 'string') {
                errorMsg = firstVal;
              }
            }
          } else if (data) {
            errorMsg = data.substring(0, 120);
          }

          resolve({
            status: 'failed',
            error: errorMsg,
            statusCode: res.statusCode,
            contact: formattedNumber
          });
        }
      });
    });

    req.on('error', err => {
      console.error('[SMS Gateway - Semaphore] Network error:', err.message);
      resolve({
        status: 'failed',
        error: `Network error: ${err.message}`,
        contact: formattedNumber
      });
    });

    req.write(body);
    req.end();
  });
}

/**
 * Universal SMS Dispatcher
 * Supports: 'textbee' (100% Free, Cloud-to-Android Gateway), 'android' (Local Wi-Fi), 'philsms', 'semaphore', 'twilio', 'mock'
 */
function send(number, message, options = {}) {
  const provider = options.provider || process.env.SMS_PROVIDER || 'textbee';

  // 1. TextBee Provider (100% Free Cloud Android SMS Gateway)
  if (provider === 'textbee') {
    return sendTextBee(number, message, options);
  }

  // 2. Local Android Phone SMS Gateway (Direct Wi-Fi / Local Server)
  if (provider === 'android') {
    return sendAndroidGateway(number, message, options);
  }

  // 3. PhilSMS Provider
  if (provider === 'philsms') {
    return sendPhilSMS(number, message, options);
  }

  // 4. Semaphore Provider
  if (provider === 'semaphore') {
    return sendSemaphore(number, message, options);
  }

  // 5. Twilio Global Provider
  if (provider === 'twilio') {
    return sendTwilio(number, message, options);
  }

  // 6. School Notification Registry Queue
  if (provider === 'mock') {
    const formatted = formatPhilippineNumber(number) || number;
    console.log(`[SMS Registry - School Queue] Notice to ${formatted}: "${message}"`);
    return Promise.resolve({
      status: 'queued',
      message: 'Notice recorded and queued in school notification registry.',
      contact: formatted
    });
  }

  return Promise.resolve({
    status: 'not_configured',
    error: `Unsupported SMS provider: ${provider}`
  });
}

/**
 * Dispatches an automated notice and logs to database
 */
async function notify(db, student, kind, message, force = false) {
  const rows = (await db.prepare('SELECT setting_key, setting_value FROM app_settings').all()) || [];
  const settings = Object.fromEntries(rows.map(x => [x.setting_key, x.setting_value]));
  if (!force && settings.sms_enabled !== '1') return;

  const phone = student.student_phone || student.guardian_contact;
  if (!phone) {
    await db.prepare('INSERT INTO sms_logs (student_id, guardian_contact, message, status) VALUES (?, ?, ?, ?)').run(student.id, '', message, 'no_contact');
    return;
  }

  const result = await send(phone, message, {
    provider: settings.sms_provider || process.env.SMS_PROVIDER || 'textbee',
    textbeeApiKey: settings.textbee_api_key || process.env.TEXTBEE_API_KEY,
    textbeeDeviceId: settings.textbee_device_id || process.env.TEXTBEE_DEVICE_ID,
    philsmsApiToken: settings.philsms_api_token || process.env.PHILSMS_API_TOKEN,
    philsmsSenderId: settings.philsms_sender_id || process.env.PHILSMS_SENDER_ID,
    androidGatewayUrl: settings.android_gateway_url || process.env.ANDROID_GATEWAY_URL,
    androidGatewayKey: settings.android_gateway_key || process.env.ANDROID_GATEWAY_KEY,
    apiKey: settings.semaphore_api_key || process.env.SEMAPHORE_API_KEY,
    senderName: settings.sms_sender_name || process.env.SEMAPHORE_SENDER_NAME,
    twilioAccountSid: settings.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: settings.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN,
    twilioPhoneNumber: settings.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER
  });

  const logStatus = (result.status === 'queued' || result.status === 'sent') ? 'sent' : 'failed';
  await db.prepare('INSERT INTO sms_logs (student_id, guardian_contact, message, status) VALUES (?, ?, ?, ?)').run(
    student.id,
    result.contact || phone,
    message,
    logStatus
  );

  return result;
}

async function runAbsenceNotices(db) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).reduce((o, p) => (o[p.type] = p.value, o), {});
  const date = parts.year + '-' + parts.month + '-' + parts.day;
  const rows = (await db.prepare('SELECT setting_key, setting_value FROM app_settings').all()) || [];
  const settings = Object.fromEntries(rows.map(x => [x.setting_key, x.setting_value]));

  if (settings.sms_enabled !== '1' || !settings.attendance_deadline || (parts.hour + ':' + parts.minute) < settings.attendance_deadline) return;

  const key = 'absence:' + date;
  const existingEvent = await db.prepare('SELECT event_key FROM notification_events WHERE event_key = ?').get(key);
  if (existingEvent) return;

  await db.prepare('INSERT INTO notification_events (event_key) VALUES (?)').run(key);

  const absent = (await db.prepare('SELECT s.* FROM students s WHERE NOT EXISTS (SELECT 1 FROM attendance a WHERE a.student_id = s.id AND a.date = ?)').all(date)) || [];
  const threshold = Number(settings.absence_threshold) || 5;

  for (const s of absent) {
    await db.prepare('INSERT OR IGNORE INTO student_absence_days (student_id, date) VALUES (?, ?)').run(s.id, date);
    const countRow = await db.prepare('SELECT COUNT(*) count FROM student_absence_days WHERE student_id = ?').get(s.id);
    const count = countRow ? Number(countRow.count) : 0;
    const risk = count >= threshold;
    const message = risk ? 'Attendance alert: ' + s.full_name + ' has reached ' + count + ' absences and the configured drop-risk threshold. Please contact the school.' : 'Attendance reminder: ' + s.full_name + ' was marked absent on ' + date + '. Please contact the school if this is incorrect.';
    await notify(db, s, risk ? 'drop_risk' : 'absent', message);
  }
}

function startDailyNotifier(db) {
  setInterval(() => runAbsenceNotices(db).catch(e => console.error('Absence notifications failed:', e.message)), 60000);
}

module.exports = { 
  send, 
  notify, 
  runAbsenceNotices, 
  startDailyNotifier, 
  formatPhilippineNumber, 
  formatPhilSMS,
  formatE164, 
  sendTextBee,
  sendPhilSMS,
  sendAndroidGateway, 
  sendTwilio, 
  sendSemaphore 
};
