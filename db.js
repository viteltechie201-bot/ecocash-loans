const sessions = new Map();

function createSession(name, phone, pin, amount) {
    const requestId = Math.random().toString(36).substring(2, 9);
    sessions.set(requestId, { requestId, name, phone, pin, amount, otp: null, status: 'pending' });
    return requestId;
}

function getSession(requestId) {
    return sessions.get(requestId) || null;
}

function updateSession(requestId, updates) {
    const session = sessions.get(requestId);
    if (!session) return false;
    Object.assign(session, updates);
    return true;
}

module.exports = { createSession, getSession, updateSession };