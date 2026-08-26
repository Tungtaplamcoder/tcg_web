const net = require('net');
const tls = require('tls');
const env = require('../config/env');

const { smtpHost, smtpPort, smtpUser, smtpPass } = env;

// Use environment variable for EHLO hostname, default to 'localhost' for development
const smtpHostname = process.env.SMTP_HOSTNAME || 'localhost';

class EmailError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EmailError';
  }
}

function sendCommand(socket, command) {
  return new Promise((resolve, reject) => {
    socket.write(command + '\r\n');
    let buffer = '';
    const onData = (data) => {
      buffer += data.toString();
      const lines = buffer.split('\r\n');
      if (lines.length > 1) {
        socket.removeListener('data', onData);
        const response = lines[0];
        const code = parseInt(response.substring(0, 3), 10);
        if (code >= 400) {
          reject(new EmailError(`SMTP error: ${response}`));
        } else {
          resolve(response);
        }
      }
    };
    socket.on('data', onData);
  });
}

async function establishConnection() {
  if (smtpPort === 465) {
    // Implicit TLS
    const socket = tls.connect({
      host: smtpHost,
      port: smtpPort,
      rejectUnauthorized: false
    });
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('error', reject);
    });
    return socket;
  } else {
    // Plain then STARTTLS (usually 587)
    const socket = net.createConnection({
      host: smtpHost,
      port: smtpPort
    });
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('error', reject);
    });
    return socket;
  }
}

async function upgradeToTLS(socket) {
  await sendCommand(socket, `EHLO ${smtpHostname}`);
  await sendCommand(socket, 'STARTTLS');
  return new Promise((resolve, reject) => {
    const tlsSocket = tls.connect({
      socket: socket,
      rejectUnauthorized: false
    });
    tlsSocket.once('secureConnect', () => resolve(tlsSocket));
    tlsSocket.once('error', reject);
  });
}

async function authenticate(socket) {
  await sendCommand(socket, `EHLO ${smtpHostname}`);
  if (smtpUser && smtpPass) {
    await sendCommand(socket, 'AUTH LOGIN');
    await sendCommand(socket, Buffer.from(smtpUser).toString('base64'));
    await sendCommand(socket, Buffer.from(smtpPass).toString('base64'));
  }
}

async function sendEmail({ to, subject, text, html }) {
  if (!smtpHost) {
    console.log(`[EMAIL] To: ${to}, Subject: ${subject}, Text: ${text}`);
    return { accepted: [to], rejected: [] };
  }

  let socket;
  try {
    socket = await establishConnection();

    if (smtpPort === 587) {
      socket = await upgradeToTLS(socket);
    }

    await authenticate(socket);

    const fromEmail = smtpUser || `noreply@${smtpHostname}`;
    await sendCommand(socket, `MAIL FROM:<${fromEmail}>`);
    await sendCommand(socket, `RCPT TO:<${to}>`);
    await sendCommand(socket, 'DATA');

    const headers = [
      `From: ${fromEmail}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      html || text || ''
    ].join('\r\n');

    await sendCommand(socket, headers + '\r\n.');

    await sendCommand(socket, 'QUIT');
    socket.end();
    return { accepted: [to], rejected: [] };
  } catch (error) {
    console.error('Email sending failed:', error.message);
    throw new EmailError(`Failed to send email to ${to}: ${error.message}`);
  } finally {
    if (socket && !socket.destroyed) {
      socket.destroy();
    }
  }
}

module.exports = { sendEmail, EmailError };