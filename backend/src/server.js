const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const routes = require('./routes');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

const mongoose = require('mongoose');
const config = require('./config');

const { registerDomain } = require('./domains/registry');
const DummyDomain = require('./domains/DummyDomain');
const ASV = require('./domains/ASV');
const Schulkonsole = require('./domains/Schulkonsole');
const Untis = require('./domains/Untis');
const WebUntisDomain = require('./domains/WebUntis');

if (config.domains) {
    config.domains.forEach(d => {
        if (d.name === 'dummy') registerDomain(new DummyDomain());
        else if (d.name === 'asv') registerDomain(ASV);
        else if (d.name === 'schulkonsole') registerDomain(Schulkonsole);
        else if (d.name === 'untis') registerDomain(Untis);
        else if (d.name === 'webuntis') registerDomain(WebUntisDomain);
    });
}

// Connect to MongoDB for logging
const mongoUri = config.mongodb?.uri || 'mongodb://localhost:27017/studentsync_logs';
mongoose.connect(mongoUri)
    .then(() => console.log('Connected to MongoDB Logging Database'))
    .catch(err => console.error('MongoDB connection error:', err.message));

// Middleware
const cookieParser = require('cookie-parser');
app.use(cors({ credentials: true, origin: 'http://localhost:5173' }));
app.use(bodyParser.json());
app.use(cookieParser());

// Routes
const authRoutes = require('./auth');
app.use('/auth', authRoutes);
app.use('/api', routes);

// Serve Static Frontend
app.use(express.static(path.join(__dirname, '../../frontend/dist')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist', 'index.html'));
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`StudentSync Node Server running on port ${PORT}`);
        
        // Start Background Jobs via Unified Scheduler
        const { startScheduler } = require('./scheduler');
        startScheduler();
    });
}

module.exports = app;
