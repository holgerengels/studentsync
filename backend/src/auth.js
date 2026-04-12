const express = require('express');
const router = express.Router();
// Use generic standard cookie/token mechanism simulating tix.
const jwt = require('jsonwebtoken');

const MOCK_USERS = [
    { username: 'admin', password: 'password', role: 'Administration' },
    { username: 'leiter', password: 'password', role: 'Abteilungsleitung' }
];

const SECRET = process.env.JWT_SECRET || 'synx_super_secret';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'synx_refresh_secret';

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    const user = MOCK_USERS.find(u => u.username === username && u.password === password);
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ username: user.username, role: user.role }, SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ username: user.username }, REFRESH_SECRET, { expiresIn: '7d' });
    
    // Tix style cookie assignment
    res.cookie('session_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
    res.cookie('refresh_token', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
    
    res.json({ success: true, user: { username: user.username, role: user.role } });
});

router.post('/refresh', (req, res) => {
    // Tix implements refresh for all devices identically
    const refreshToken = req.cookies?.refresh_token; // Assumes cookie-parser middleware
    if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });
    
    try {
        const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
        const user = MOCK_USERS.find(u => u.username === decoded.username);
        
        if (!user) throw new Error('User not found');
        
        const newToken = jwt.sign({ username: user.username, role: user.role }, SECRET, { expiresIn: '15m' });
        res.cookie('session_token', newToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
        
        res.json({ success: true, user: { username: user.username, role: user.role } });
    } catch(e) {
        res.status(401).json({ error: 'Invalid refresh token' });
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('session_token');
    res.clearCookie('refresh_token');
    res.json({ success: true });
});

router.get('/me', (req, res) => {
    const token = req.cookies?.session_token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    
    try {
        const decoded = jwt.verify(token, SECRET);
        res.json({ user: { username: decoded.username, role: decoded.role } });
    } catch(e) {
        // If expired, frontend must call refresh
        res.status(401).json({ error: 'Token expired' });
    }
});

module.exports = router;
