const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const yts = require('yt-search');
const ytdl = require('ytdl-core');
const pino = require('pino');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('QR Code එක scan කරපන් WhatsApp > Linked Devices > Link a Device');
        }

        if (connection === 'open') {
            console.log('✅ Bot Connected!');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode!== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting...', shouldReconnect);
            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const jid = m.key.remoteJid;
        const text = m.message.conversation || m.message.extendedTextMessage?.text || '';

        //.song command
        if (text.startsWith('.song ')) {
            const query = text.replace('.song ', '');
            await sock.sendMessage(jid, { text: `🔍 Searching: ${query}...` });

            try {
                const search = await yts(query);
                const video = search.videos[0];

                if (!video) {
                    await sock.sendMessage(jid, { text: '❌ Song එක හොයාගන්න බැරි උනා' });
                    return;
                }

                const info = await ytdl.getInfo(video.url);
                const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });

                await sock.sendMessage(jid, {
                    audio: { url: audioFormat.url },
                    mimetype: 'audio/mpeg',
                    fileName: `${video.title}.mp3`
                });

            } catch (err) {
                await sock.sendMessage(jid, { text: '❌ Download error: ' + err.message });
            }
        }

        // Help command
        if (text === '.help') {
            await sock.sendMessage(jid, {
                text: `🎵 *WhatsApp Songs Bot*\n\n.commands:\n.song [song name] - Song එක download කරලා එවනවා\n.help - මේ menu එක\nExample:.song Shape of You`
            });
        }
    });
}

startBot();
