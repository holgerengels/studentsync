const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    task: { 
        type: String, 
        required: true
    },
    trigger: { 
        type: String, 
        required: true, 
        enum: ['MANUAL', 'CRON'] 
    },
    status: { 
        type: String, 
        required: true, 
        enum: ['SUCCESS', 'ERROR', 'IN_PROGRESS'] 
    },
    startTime: { 
        type: Date, 
        default: Date.now 
    },
    endTime: { 
        type: Date 
    },
    durationMs: { 
        type: Number 
    },
    summaryHtml: {
        type: String
    },
    details: { 
        type: mongoose.Schema.Types.Mixed // JSON object or array containing specific info/errors
    }
});

module.exports = mongoose.model('SyncLog', logSchema);
