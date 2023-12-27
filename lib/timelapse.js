const ftp = require('./ftp.js');
const cfg = require('./config.js');
const logger = require('./logger.js');

module.exports = async(args) => {
    const machine = cfg.getMachine(args.id);
    const typeCheck = (name) => {
        return (name.indexOf('video_') > -1 && !name.startsWith('.'));
    };
    await ftp.tableView(machine, '/timelapse', typeCheck, args, (opts) => {
        if (opts.table) {
            if (opts.count) {
                logger.log(opts.table);
            } else {
                logger.error(`No files found!`);
            }
        }
    });
};
