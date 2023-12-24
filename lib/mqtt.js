const cfg = require('./config.js');
const mqtt = require('mqtt');

module.exports = (args) => {
    const machines = cfg.get('machines');
    
    if (!machines.length) {
        console.error(`⛔ Failed to find machines`);
        process.exit(2);
    }
 
    machines.forEach(machine => {
        console.log(`Connecting to ${machine.id}`);
        const BASE = `mqtts://${machine.ip}:8883`;
        const client = mqtt.connect(BASE, {
            username:           'bblp',
            password:           machine.token,
            rejectUnauthorized: false,
            clientId:           `bambu-cli`
        });

        client.on("connect", (e) => {
            client.unsubscribe(`device/${machine.id}/report`, () => {});
            setTimeout(() => {
                client.subscribe(`device/${machine.id}/report`, () => {});
            }, 1000);
        });
        client.on("message", (topic, message) => {
            const json = JSON.parse(message.toString());
            const key = Object.keys(json)[0];
            const command = json[key].command;
            //console.log(`[${machine.id}] (${topic}): ${command}`, JSON.stringify(json));
            console.log(`[${machine.id}] (${topic}): ${command} (keys: ${Object.keys(json[key]).length})`);
            if (args.json) {
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
                    console.log(JSON.stringify(keys, null, 4));
                } else {
                    console.log(JSON.stringify(json[key], null, 4));
                }
            } else if (args.keys) {
                console.log(Object.keys(json[key]).join(', '));
            }
        });
    });
};

