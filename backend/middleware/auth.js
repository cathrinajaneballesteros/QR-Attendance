
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'sta-rosa-qr-secret-key-grade6-2026';

function auth(req, res, next) {
    try {
        var authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
        var token = '';
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        } else if (authHeader) {
            token = authHeader;
        }
        if (!token || token === 'null' || token === 'undefined') {
            return res.status(401).json({ error: 'No token provided' });
        }
        const secret = process.env.JWT_SECRET || JWT_SECRET;
        jwt.verify(token, secret, function(err, decoded) {
            if (err) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }
            req.user = decoded;
            next();
        });
    } catch (error) {
        return res.status(401).json({ error: 'Authentication failed' });
    }
}

module.exports = auth;

