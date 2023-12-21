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
            client.subscribe(`device/${machine.id}/report`, () => {});
        });
        client.on("message", (topic, message) => {
            const json = JSON.parse(message.toString());
            //console.log(JSON.stringify(json, null, 4), machine, topic);
            const key = Object.keys(json)[0];
            const command = json[key].command;
            //console.log(`[${machine.id}] (${topic}): ${command}`, JSON.stringify(json));
            console.log(`[${machine.id}] (${topic}): ${command} (keys: ${Object.keys(json[key]).length})`);
        });
    });
};

