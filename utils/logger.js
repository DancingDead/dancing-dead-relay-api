const fs = require('fs');
const path = require('path');

class Logger {
    constructor(logFileName = 'app.log') {
        this.logFilePath = path.join(__dirname, '..', 'logs', logFileName);

        // Créer le dossier logs s'il n'existe pas
        const logDir = path.dirname(this.logFilePath);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        let logMessage = `[${timestamp}] [${level}] ${message}`;

        if (data) {
            logMessage += '\n' + JSON.stringify(data, null, 2);
        }

        return logMessage + '\n';
    }

    write(level, message, data = null) {
        const formattedMessage = this.formatMessage(level, message, data);

        // Écrire dans le fichier
        try {
            fs.appendFileSync(this.logFilePath, formattedMessage);
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }

        // Aussi afficher dans la console
        console.log(formattedMessage.trim());
    }

    info(message, data = null) {
        this.write('INFO', message, data);
    }

    error(message, data = null) {
        this.write('ERROR', message, data);
    }

    warn(message, data = null) {
        this.write('WARN', message, data);
    }

    debug(message, data = null) {
        this.write('DEBUG', message, data);
    }

    success(message, data = null) {
        this.write('SUCCESS', message, data);
    }
}

module.exports = Logger;
