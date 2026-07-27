const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const bodyParser = require('body-parser');
const cors = require('cors'); // Added CORS

const app = express();
const port = 3001;

app.use(cors()); // Enable CORS for all origins
app.use(bodyParser.json());

let qrCodeData = '';
let clientStatus = 'DISCONNECTED';

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './sessions'
    }),
    puppeteer: {
        headless: true,
        // Pointing to common Google Chrome paths on Windows
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('QR Received. Scan the code below:');
    qrcodeTerminal.generate(qr, { small: true }); // Display QR in terminal
    qrCodeData = qr;
    clientStatus = 'QR_READY';
});

client.on('ready', () => {
    console.log('WhatsApp Client is Ready!');
    clientStatus = 'CONNECTED';
    qrCodeData = '';
});

client.on('authenticated', () => {
    console.log('WhatsApp Authenticated');
});

client.on('auth_failure', () => {
    console.log('Auth Failure, please restart');
    clientStatus = 'DISCONNECTED';
});

client.on('disconnected', () => {
    console.log('Client Disconnected');
    clientStatus = 'DISCONNECTED';
});

// API to get QR Code status
app.get('/status', async (req, res) => {
    if (clientStatus === 'CONNECTED') {
        return res.json({ status: 'CONNECTED' });
    }
    if (qrCodeData) {
        const qrImage = await qrcode.toDataURL(qrCodeData);
        return res.json({ status: 'QR_READY', qr: qrImage });
    }
    res.json({ status: 'INITIALIZING' });
});

// API to send message
app.post('/send-message', async (req, res) => {
    const { phone, message } = req.body;

    if (clientStatus !== 'CONNECTED') {
        return res.status(500).json({ success: false, error: 'WhatsApp is not connected' });
    }

    try {
        const formattedPhone = phone.includes('@c.us') ? phone : `${phone.replace(/\D/g, '')}@c.us`;
        await client.sendMessage(formattedPhone, message);
        res.json({ success: true });
    } catch (err) {
        console.error('Send Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

client.initialize();

app.listen(port, () => {
    console.log(`WhatsApp Gateway listening at http://localhost:${port}`);
});
