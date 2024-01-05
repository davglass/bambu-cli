
const cfg = require('./config.js');
const logger = require('./logger.js');

const RE = /^(\d{1,3}\.){3}\d{1,3}$/;

module.exports = (args) => {
    if (!args.id || !args.ip || args.ip === true) {
        logger.error(`Please pass a machine and an --ip`);
        process.exit(1);
    }
    if (!RE.test(args.ip)) {
        logger.error(`Please provide a valid IP Address.`);
        process.exit(1);
    }
    logger.info(`Setting ip address of ${args.id} to ${args.ip}`);
    const machines = cfg.get('machines');
    machines.forEach(m => {
        if (m.id === args.id) {
            m.ip = args.ip;
        }
    });
    cfg.set('machines', machines);
    logger.log(`IP address saved.`);
};
