const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const router = express.Router();
const pino = require('pino');
const moment = require('moment-timezone');
const axios = require('axios');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    getContentType,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
} = require('@whiskeysockets/baileys');

const FIREBASE_URL = 'https://ceylon--network-default-rtdb.asia-southeast1.firebasedatabase.app/';

const config = {
    BOT_NAME: 'PinTa_Bot',
    PREFIX: '.',
    MAX_RETRIES: 3,
    OWNER_NUMBER: '94705123369'
};

const activeSockets = new Map();
const socketCreationTime = new Map();
const SESSION_BASE_PATH = './session';

// Anti-Spam & Duplicate Tracker
const userMessageTracker = new Map();
const SPAM_THRESHOLD = 5; 
const SPAM_TIMEFRAME = 20000; 

// සියලුම Bad Words ලැයිස්තුව
const badWords = [
    'eta', 'eta deka', 'uranawa', 'urapan', 'puka', 'puke hila', 'puke mail', 'mayil', 'puke maila', 'mayila', 'puke arinawa', 'puka palanawa', 'puka wate', 'puka sududa', 'pukmantha', 'labba', 'paka', 'pake', 'pakaya', 'pakayaa', 'pakata', 'pako', 'ponna', 'ponnaya', 'polla', 'pai kota', 'payi kota', 'koi pata', 'paiya', 'payiya', 'payya', 'walla', 'valla', 'lowanawa', 'lovanawa', 'lewakanawa', 'hukanawa', 'taukanawa', 'hukapan', 'hukannaa', 'hukanna', 'huththa', 'hutta', 'huttige', 'huththige', 'huththik', 'huttik', 'gotukola hukanna', 'wambatu paiya', 'balli', 'belli', 'bellige', 'para balli', 'para belli', 'wesi', 'vesi', 'wesige', 'vesige', 'wesa', 'vesa', 'wesawa', 'vesawa', 'patta wesi', 'patta vesi', 'kari', 'keri', 'muhudu hukanna', 'tau', 'taukanda', 'taukanna', 'tahukanna', 'tahike', 'taike', 'kari thambiyo', 'gotukola ponnaya', 'gon bijja', 'kariya', 'haminenawa', 'haminenava', 'wesauththa', 'ponna wesa manamali', 'ponna pakaya', 'nilmanel huththi', 'ehelamal wesi', 'ahalamal vesi', 'paka', 'pakaa', 'walaththaya', 'valaththaya', 'valattaya', 'topa', 'kimbi simba', 'kibi siba', 'gon kariya', 'kari seen', 'kari scene', 'kanna pori', 'konakapala', 'geta mirikanawa', 'kimbi kawaiya', 'kibi kavayya', 'attimba', 'ambakissa', 'wataella', 'ake purinawa', 'ake purinna', 'kuttan chuti', 'kuttan chooty', 'walla patta', 'wallapatta', 'pol kawaiya', 'pol kavayya', 'palam koka', 'kes puri', 'kespuriya', 'kas puriya', 'lolla', 'loolla', 'badu', 'kari lodaya', 'keri londaya', 'baduwa', 'kalu badda', 'kanna poriya', 'kenna poriya', 'wate yanawa', 'watey yanawa', 'kimba', 'umbe amma', 'umbe ammata', 'umbe ammage', 'ammata hukanna', 'thoge ammata', 'appata hukanawa', 'appata hukanna', 'ammage redda', 'redda ussanawa', 'redda ussagena', 'hamba kariya', 'kari hambayo', 'diwa danawa', 'eraganin', 'araganin', 'wela', 'vela', 'ganu hora', 'genu hora', 'kari sepa', 'badu awa', 'badu ava', 'leli puka', 'lali puka', 'kotu paiya', 'daara payya', 'tomba hila', 'kari mayil', 'pai chooty', 'pi chooti', 'tofa', 'huk', 'bada wenawa', 'bek gahanawa', 'back gahanawa', 'backside okay', 'jackson', 'jack gahanawa', 'jack gahapan', 'jack ghpn', 'junda', 'anta', 'pettiya', 'pettiya kadanawa', 'pettiya kedilada', 'pettiya kadilada', 'polim danawa', 'polimak danawa', 'kona kapanawa', 'thongale', 'ma mala', 'mae mala', 'mae ate', 'ma ate', 'poro para', 'sakkili', 'sakkiliya', 'sakkili balla', 'huka', 'luv juce', 'luv juice', 'love juice', 'kimbi juice', 'kibi juse', 'kukku', 'thana', 'than deka', 'hukanawane ithin', 'dara baduwa', 'besike', 'besige', 'besikge', 'ammt', 'pamkaya', 'humtha', 'humkanawa', 'tauk', 'huptho', 'paca', 'pacaya', 'esi', 'esige putha',
    'ඇට', 'ඇට දෙක', 'උරනවා', 'උරපං', 'උරපන්', 'පුක', 'පුකේ හිල', 'පුකේ මයිල්', 'පුකේ මයිලා', 'පුකේ අරිනවා', 'පුක පලනවා', 'පුක වටේ', 'පුක සුදුද', 'පුක්මන්තා', 'ලබ්බ', 'පක', 'පකේ', 'පකයා', 'පකය', 'පකට', 'පකෝ', 'පොන්නයා', 'පොල්ල', 'පයිකොටා', 'කොයිපටා', 'පයිය', 'පයියා', 'වල්ල', 'ලොවනවා', 'ලෙවකනවා', 'හුකනවා', 'ටඋකනවා', 'හුකපං', 'හුකන්න', 'හුකන්නා', 'හුත්ත', 'හුත්තා', 'හුත්තිගෙ පුතා', 'හුත්තිගේ පුතා', 'හුත්තිගෙ කොල්ලා', 'හුත්තික් කොල්ලා', 'උත්ති', 'උත්තියේ', 'උත්තික් කොල්ලා', 'හුකනවා දාලා', 'හුකනව දාලා', 'ගොටුකොළ හුකන්නා', 'වම්බටු පයියා', 'බැල්ලි', 'බැල්ලිගෙ පුතා', 'පර බැල්ලි', 'පර වේසි', 'වේස බැල්ලි', 'වේස බල්ලා', 'වේසාවා', 'වේසිගෙ පුතා', 'වේසිගේ පුතා', 'පට්ට වේසි', 'කැරි වේසි', 'මුහුදු හුකන්නා', 'ටෞ', 'ටෞකණ්ඩ', 'ටෞකන්න', 'ටහුකන්න', 'ටහිකේ', 'ටඉකේ', 'කැරි තම්බියො', 'ගොටුකොළ පොන්නයා', 'ගොං බිජ්ජා', 'පොන්න කැරියා', 'හැමිනෙනව', 'හැමිනෙනවා', 'වේසෞත්තා', 'පොන්න වේස මනමාලි', 'පොන්න පකයා', 'නිල්මානෙල් හුත්ති', 'ඇහැළමල් වේසි', 'පොන්න පකා', 'වලත්තයා', 'ටොපා', 'කිඹි සිඹා', 'කිඹිසිඹා', 'ගොං කැරිය', 'කැරිය', 'කැරියා', 'කැරි සීන්', 'කැන්න පොරි', 'කොනකපාල', 'කොනකපාලා', 'ගැට මිරිකනවා', 'කිඹි කාවයියා', 'ඇට්ටිම්බ', 'අම්බකිස්ස', 'වටඇල්ල', 'අකේ පුරින්නා', 'අකේ පුරිනවා', 'කුට්ටං චූටි', 'වල්ල පට්ට', 'පොල් කාවයිය', 'පොල් කාවයියා', 'පාලම් කොකා', 'කෑස් පුරියා', 'කැස් පුරි', 'කැස්පුරි', 'කෑස්පුරි', 'ලොල්ලා', 'බඩු කාරයා', 'බඩු ලොල්ලා', 'කැරි ලොඳයා', 'කැරි බඩුව', 'කළු බඩ්ඩ', 'කැන්න පොරියා', 'වටේ යනවා', 'කිම්බ', 'උඹෙ අම්මා', 'උඹේ අම්මා', 'උඹෙ අම්මගෙ', 'උඹෙ අම්මට', 'අම්මට හුකන්න', 'අම්මට හුකනවා', 'තොගෙ අම්මට', 'අප්පට හුකනවා', 'අප්පට හුකන්න', 'අම්මගෙ රෙද්ද', 'අම්මාගේ රෙද්ද', 'රෙද්ද උස්සනවා', 'රෙද්ද උස්සගෙන', 'හම්බ කැරියා', 'කැරි හම්බයො', 'දිව දානව', 'දිව දානවා', 'ඇරගනින්', 'වැල', 'වැල බලනවා', 'ගැනු හොරා', 'ගෑණු හොරා', 'කැරි', 'කැරි සැප', 'බඩු ආව', 'බඩු ආවා', 'ලෑලි පුක', 'කෝටු පයිය', 'දාර පයිය', 'ටොම්බ හිල', 'කැරි මයිල්', 'පයි චූටි', 'සක්', 'ෆක්', 'හුක්', 'බඩ වෙනවා', 'බැක් ගහනව', 'බැක් ගහනවා', 'බැක්සයිඩ් ඕකේ', 'ජැක් ගහපන්', 'ජුන්ඩා', 'ඇන්ට පාර', 'පෙට්ටිය', 'පෙට්ටිය කඩනවා', 'පෙට්ටිය කැඩිලද', 'පෝලිම් දානවා', 'පෝලිමක් දානවා', 'කොන කපනවා', 'තොංගලේ', 'මෑ මල', 'මෑ ඇටේ', 'පොරෝ පාර', 'සක්කිලියා', 'සක්කිලි', 'සක්කිලි බල්ලා', 'හුකා', 'ලව් ජූස්', 'කිඹි ජූස්', 'කුක්කු', 'තන', 'තන් දෙක', 'හුකනවනෙ ඉතින්', 'හුකනවනේ ඉතින්', 'දාර බඩුව', 'බේසිකෙ', 'බේසිගෙ', 'බේසික්ගෙ', 'අම්ම්ට', 'පම්කයා', 'හුම්තා', 'හුම්කන', 'ටෞක්', 'හුප්තා', 'පම්කයා', 'පම්ක', 'ඒසි'
];

if (!fs.existsSync(SESSION_BASE_PATH)) {
    fs.mkdirSync(SESSION_BASE_PATH, { recursive: true });
}

async function cleanDuplicateFiles(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const { data } = await axios.get(`${FIREBASE_URL}/session.json`);
        if (!data) return;
        const sessionKeys = Object.keys(data).filter(key => key.startsWith(`empire_${sanitizedNumber}_`) && key.endsWith('.json')).sort((a, b) => {
            const timeA = parseInt(a.match(/empire_\d+_(\d+)\.json/)?.[1] || 0);
            const timeB = parseInt(b.match(/empire_\d+_(\d+)\.json/)?.[1] || 0);
            return timeB - timeA;
        });
        if (sessionKeys.length > 1) {
            for (let i = 1; i < sessionKeys.length; i++) {
                await axios.delete(`${FIREBASE_URL}/session/${sessionKeys[i].replace('.json', '')}.json`);
            }
        }
    } catch (error) {}
}

function setupCommandHandlers(socket, number) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

        let msgType = getContentType(msg.message);
        if (msgType === 'ephemeralMessage') {
            msg.message = msg.message.ephemeralMessage.message;
            msgType = getContentType(msg.message);
        }

        let body = '';
        if (msgType === 'conversation') {
            body = msg.message.conversation;
        } else if (msgType === 'extendedTextMessage') {
            body = msg.message.extendedTextMessage.text;
        } else if (msgType === 'imageMessage' && msg.message.imageMessage.caption) {
            body = msg.message.imageMessage.caption;
        } else if (msgType === 'videoMessage' && msg.message.videoMessage.caption) {
            body = msg.message.videoMessage.caption;
        }

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const senderNumber = sender.split('@')[0];
        const botNumber = socket.user.id.split(':')[0];
        const isBot = botNumber === senderNumber;
        const isGroup = from.endsWith('@g.us');
        const textLower = body.toLowerCase().trim();

        let isAdmin = false;
        if (isGroup) {
            try {
                const groupMetadata = await socket.groupMetadata(from);
                const adminList = groupMetadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id);
                isAdmin = adminList.includes(sender);
            } catch (e) {}
        }
        const isFromMe = msg.key.fromMe || isBot;

        // Auto Reply for Hi / Hello
        if (textLower === 'hi' || textLower === 'hello') {
            try {
                await socket.sendMessage(from, { text: 'Hello! Welcome to the group! 👋' }, { quoted: msg });
            } catch (err) {}
        }

        // Moderation Features (Only if not Admin and not Bot)
        if (!isFromMe && !isAdmin && isGroup && body !== '') {

            // 1. Any Link Delete
            const isAnyLink = body.match(/(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi);
            if (isAnyLink) {
                try { 
                    await socket.sendMessage(from, { delete: msg.key }); 
                    return; 
                } catch (err) {}
            }

            // 2. Bad Words Delete + English Warning
            const containsBadWord = badWords.some(word => textLower.includes(word.toLowerCase()));
            if (containsBadWord) {
                try {
                    await socket.sendMessage(from, { delete: msg.key });
                    const warningMsg = `⚠️ *WARNING*\n\n@${senderNumber}, Please do not use bad words in this group!`;
                    await socket.sendMessage(from, { text: warningMsg, mentions: [sender] });
                    return;
                } catch (err) {}
            }

            // 3. Anti-Spam & Duplicate Tracker
            const currentTime = Date.now();
            const trackerKey = `${from}-${sender}`;
            const userRecord = userMessageTracker.get(trackerKey) || { text: '', count: 0, startTime: currentTime };

            // Check Duplicate (එකම මැසේජ් එක දෙපාරක් දැමීම)
            if (userRecord.text === body) {
                try { 
                    await socket.sendMessage(from, { delete: msg.key }); 
                    return; 
                } catch (err) {}
            }

            // Check Spam (මැසේජ් 5ක් එක දිගට දැමීම)
            if ((currentTime - userRecord.startTime) < SPAM_TIMEFRAME) {
                userRecord.count += 1;
                if (userRecord.count >= SPAM_THRESHOLD) {
                    try { 
                        await socket.sendMessage(from, { delete: msg.key }); 
                        return; 
                    } catch (err) {}
                }
            } else {
                userRecord.count = 1;
                userRecord.startTime = currentTime;
            }
            
            userRecord.text = body;
            userMessageTracker.set(trackerKey, userRecord);
        }
    });
}

async function restoreSession(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const credsKey = `creds_${sanitizedNumber}`;
        const { data } = await axios.get(`${FIREBASE_URL}/session/${credsKey}.json`);
        return data || null;
    } catch (error) { return null; }
}

async function fullDeleteSession(number) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    try {
        const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
        if (fs.existsSync(sessionPath)) fs.removeSync(sessionPath);
        const pathsToDelete = [`session/creds_${sanitizedNumber}`, `numbers/${sanitizedNumber}`];
        for (const p of pathsToDelete) {
            try { await axios.delete(`${FIREBASE_URL}/${p}.json`); } catch (e) {}
        }
        if (activeSockets.has(sanitizedNumber)) {
            try { activeSockets.get(sanitizedNumber).ws.close(); } catch (e) {}
            activeSockets.delete(sanitizedNumber);
            socketCreationTime.delete(sanitizedNumber);
        }
    } catch (err) {}
}

function setupAutoRestart(socket, number) { 
    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        const cleanNumber = number.replace(/[^0-9]/g, '');
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode === 401) { 
               await fullDeleteSession(number);
            } else {
                await delay(10000);
                activeSockets.delete(cleanNumber);
                socketCreationTime.delete(cleanNumber);
                const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
                await EmpirePair(number, mockRes);
            }
        }
    });
}

async function EmpirePair(number, res) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
    await cleanDuplicateFiles(sanitizedNumber);
    const restoredCreds = await restoreSession(sanitizedNumber);
    if (restoredCreds) {
        fs.ensureDirSync(sessionPath);
        fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(restoredCreds, null, 2));
    }
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const logger = pino({ level: 'fatal' });

    try {
        const socket = makeWASocket({
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
            printQRInTerminal: false, logger, browser: Browsers.macOS('Safari')
        });

        socketCreationTime.set(sanitizedNumber, Date.now());
        setupAutoRestart(socket, sanitizedNumber);
        setupCommandHandlers(socket, sanitizedNumber);

        if (!socket.authState.creds.registered) {
            let retries = config.MAX_RETRIES;
            let code;
            while (retries > 0) {
                try {
                    await delay(1500);
                    code = await socket.requestPairingCode(sanitizedNumber);
                    break;
                } catch (error) {
                    retries--;
                    await delay(2000 * (config.MAX_RETRIES - retries));
                }
            }
            if (!res.headersSent) res.send({ code });
        }

        socket.ev.on('creds.update', async () => {
            await saveCreds();
            const fileContent = await fs.readFile(path.join(sessionPath, 'creds.json'), 'utf8');
            await axios.put(`${FIREBASE_URL}/session/creds_${sanitizedNumber}.json`, JSON.parse(fileContent));
        });

        socket.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                activeSockets.set(sanitizedNumber, socket);
            }
        });
    } catch (error) {
        if (!res.headersSent) res.status(503).send({ error: 'Service Unavailable' });
    }
}

router.get('/', async (req, res) => {
    const { number } = req.query;
    if (!number) return res.status(400).send({ error: 'Number required' });
    if (activeSockets.has(number.replace(/[^0-9]/g, ''))) return res.status(200).send({ status: 'already_connected' });
    await EmpirePair(number, res);
});

async function autoReconnectFromFirebase() {
    try {
        const numbersRes = await axios.get(`${FIREBASE_URL}/numbers.json`);
        const numbers = numbersRes.data || [];
        for (const number of numbers) {
            if (!activeSockets.has(number)) {
                const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
                await EmpirePair(number, mockRes);
                await delay(1000);
            }
        }
    } catch (error) {}
}
autoReconnectFromFirebase();

module.exports = router;
