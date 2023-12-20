const fs = require('fs');
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
                console.log(`No files found!`);
            }
        }
        if (opts.downloaded && args.parse) {
            console.log();
            parse({
                file: opts.downloaded
            }, () => {
                console.log(`Cleaning up tmpfile:`, opts.downloaded);
                fs.rmSync(opts.downloaded);
            });
        }
    });
};

