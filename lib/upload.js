const cfg = require('./config.js');
const ftp = require('./ftp.js');
const path = require('path');
const fs = require('fs');
const logger = require('./logger.js');

module.exports = async(args) => {
    const machine = cfg.getMachine(args.id);
    if (!machine) {
        logger.error(`Failed to find machine: ${args.id}`);
        process.exit(2);
    }
    let file;
    if (args.upload === true || !args.upload) {
        logger.error(`Please pass a valid file with --upload ./path/to/file.gcode.3mf`);
        process.exit(1);
    }
    file = path.resolve(args.upload);
    if (!fs.existsSync(file)) {
        logger.error(`Failed to find local file.`);
        process.exit(1);
    }
    const stat = fs.statSync(file);
    const files = [];
    if (stat.isDirectory()) {
        fs.readdirSync(file).forEach(f => {
            if (f.indexOf('.gcode') > -1) {
                const t = path.resolve(file, f);
                files.push({
                    file: t,
                    size: fs.statSync(t).size
                });
            }
        });
    } else {
        files.push({
            file: path.resolve(file),
            size: stat.size
        });
    }
    logger.log(`🚀 Uploading ${files.length} file(s) to ${machine.id}.`);
    await ftp.uploadFiles(machine, files);
};
