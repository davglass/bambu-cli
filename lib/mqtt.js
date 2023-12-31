const cfg = require('./config.js');
const jp = require('jsonpath');
const logger = require('./logger.js');
const utils = require('./utils.js');

module.exports = (args) => {
    const machines = cfg.get('machines');
    
    if (!machines.length) {
        logger.error(`Failed to find machines`);
        process.exit(2);
    }
 
    machines.forEach(machine => {
        logger.log(`Connecting to ${machine.id}`);
        const client = utils.mqttClient(machine);

        client.on("connect", (e) => {
            client.unsubscribe(`device/${machine.id}/report`, () => {});
            setTimeout(() => {
                client.subscribe(`device/${machine.id}/report`, () => {});
            }, 1000);
        });
        client.on("message", (topic, message) => {
            const json = JSON.parse(message.toString());
            logger.debug(JSON.stringify(json, null, 4), topic);
            const key = Object.keys(json)[0];
            const command = json[key].command;
            //console.log(`[${machine.id}] (${topic}): ${command}`, JSON.stringify(json));
            logger.log(`[${machine.id}] (${topic}): ${command} (keys: ${Object.keys(json[key]).length})`);
            if (args.path) {
                let p = jp.query(json, args.path);
                logger.log(JSON.stringify(p, null, 4));
            } else if (args.json && args.keys !== true) {
                if (args.keys) {
                    if (!Array.isArray(args.keys)) {
                        args.keys = args.keys.split(',');
                    }
                    const keys = {};
                    Object.keys(json[key]).forEach(k => {
                        if (args.keys.includes(k)) {
                            const value = json[key][k];
                            keys[k] = value;
                        }
                    });
                    logger.log(JSON.stringify(keys, null, 4));
                } else {
                    logger.log(JSON.stringify(json[key], null, 4));
                }
            } else if (args.keys) {
                logger.log(Object.keys(json[key]).join(', '));
            }
        });
    });
};

