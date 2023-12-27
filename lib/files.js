const fs = require('fs');
const path = require('path');
const os = require('os');

const ftp = require('./ftp.js');
const parse = require('./parse.js');
const cfg = require('./config.js');
const logger = require('./logger.js');

module.exports = async(args) => {
    const machine = cfg.getMachine(args.id);
    const typeCheck = (name) => {
        return (name.indexOf('.gcode') > -1 && !name.startsWith('.'));
    };
    if (args.parse) {
        args.download = os.tmpdir();
    }
    await ftp.tableView(machine, '/', typeCheck, args, (opts) => {
        if (opts.table) {
            if (opts.count) {
                logger.log(opts.table);
            } else {
                logger.error(`No files found!`);
            }
        }
        if (opts.downloaded && args.parse) {
            const parseFile = () => {
                let file;
                if (files.length) {
                    file = files.pop();
                } else {
                    return;
                }
                parse({
                    file: file
                }, () => {
                    logger.log(`Cleaning up tmpfile:`, file);
                    fs.rmSync(file);
                    parseFile();
                });
            };
            logger.log();
            const files = [];
            opts.remote.forEach(f => {
                const p = path.join(args.download, f.file);
                files.push(p);
            });
            parseFile();
        }
    });
};


