const fs = require('fs');
const path = require('path');
const os = require('os');

const ftp = require('./ftp.js');
const parse = require('./parse.js');
const cfg = require('./config.js');

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
                console.log(opts.table);
            } else {
                console.log(`⛔ No files found!`);
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
                    console.log(`Cleaning up tmpfile:`, file);
                    fs.rmSync(file);
                    parseFile();
                });
            };
            console.log();
            const files = [];
            opts.remote.forEach(f => {
                const p = path.join(args.download, f.file);
                files.push(p);
            });
            parseFile();
        }
    });
};


