const cfg = require('./config.js');
const ftp = require('./ftp.js');
const path = require('path');
const fs = require('fs');

module.exports = async(args) => {
    const machine = cfg.getMachine(args.id);
    if (!machine) {
        console.error(`⛔ Failed to find machine: ${args.id}`);
        process.exit(2);
    }
    let file;
    if (args.upload === true || !args.upload) {
        console.error(`⛔ Please pass a valid file with --upload ./path/to/file.gcode.3mf`);
        process.exit(1);
    }
    file = path.resolve(args.upload);
    if (!fs.existsSync(file)) {
        console.error(`⛔ Failed to find local file.`);
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
    console.log(`🚀 Uploading ${files.length} file(s) to ${machine.id}.`);
    await ftp.uploadFiles(machine, files);
};
