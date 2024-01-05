const config = require('./config.js');
const https = require('https');
const mqtt = require('mqtt');
const { parse } = require('url');
const rl = require('readline-sync');
const jwt = require('jsonwebtoken');
const logger = require('./logger.js');

const BASE = 'https://bambulab.com/api/sign-in/form';
const API = `https://api.bambulab.com`;
const MQTT = 'mqtts://us.mqtt.bambulab.com:8883';

const INIT = { "pushing": { "sequence_id": "0", "command": "pushall" } };

const start = () => {
    logger.log(`Logging into bambulab.com (Credentials will not be saved)`);
    let q = `[bambulab.com] username: `;
    const _u = config.get('username');
    if (_u) {
        q += `(${_u})`;
    }
    let username = rl.question(q);
    if (!username && _u) {
        username = _u;
    }
    const passwd = rl.question(`[bambulab.com] password: `, { hideEchoBack: true });
    logger.log(`Logging in as: ${username}`);
    config.set('username', username);
    getTokens(username, passwd, (err, tokens) => {
        if (err) {
            logger.error(`We found an error while logging in: ${err}`);
            process.exit(1);
        }
        logger.debug(`Tokens`, tokens);
        getDevices(tokens, (err, devices) => {
            if (err) {
                logger.error(`We found an error while fetching devices: ${err}`);
                process.exit(1);
            }
            const machines = [];
            devices.forEach(d => {
                const m = {
                    id:    d.dev_id,
                    name:  d.name,
                    token: d.dev_access_code,
                    ip:    null,
                    model: d.dev_model_name,
                    make:  d.dev_product_name
                };
                machines.push(m);
            });
            logger.log(`Found ${machines.length} devices.`);
            machines.forEach(m => {
                logger.log('> ', m.name);
            });
            config.set('machines', machines);
            getIPs(tokens, machines, (err, machines) => {
                logger.log(`Finished gathering all login/device details..`);
            });
        });
    });
};

module.exports = start;

const getIPs = (tokens, machines, cb) => {
    const token = tokens.token;
    logger.log(`Attempting to find device IP addresses, please wait, this may take a few seconds..`);
    // Decode the JWT and get the username for the global MQTT server
    const j = jwt.decode(token);
    const user = j.username;
    config.set('mqtt_user', j.username);
    const client = mqtt.connect(MQTT, {
        username:           user,
        password:           token,
        rejectUnauthorized: false
    });
    client.on("connect", (e) => {
        machines.forEach(m => {
            client.unsubscribe(`device/${m.id}/report`, () => {});
            setTimeout(() => {
                client.subscribe(`device/${m.id}/report`, () => {});
                client.publish(`device/${m.id}/request`, JSON.stringify(INIT));
            }, 1000);
        });
    });
    client.on("message", (topic, message) => {
        const device = topic.split('/')[1];
        const machine = getDevice(device);
        const json = JSON.parse(message.toString());
        logger.debug(`MQTT Message:`, JSON.stringify(json, null, 4));
        if (json.print && json.print.ipcam) {
            if (json.print.ipcam.rtsp_url) {
                const ip = parse(json.print.ipcam.rtsp_url).hostname;
                logger.log(`Found IP for ${machine.name}: ${ip}`);
                machines.forEach((m) => {
                    if (m.id === device) {
                        m.ip = ip;
                    }
                });
                config.set('machines', machines);
                validate();
            } else {
                client.end();
                if (!DONE) {
                    setIPs(machines);
                }
                DONE = true;
            }
        }
    });
    let DONE;
    const setIPs = () => {
        logger.warn(`Doh! Machine IP doesn't appear in the messages.`);
        logger.warn(`Let's do this by hand, gather the IP addresses of your printer(s)..`);
        for (const m of machines) {
            const ip = rl.question(`What is the IP address of ${m.name}? `);
            if (ip) {
                m.ip = ip;
            }
        }
        config.set('machines', machines);
        logger.log(`Finished setting up machines. All Good!`);
    };

    const validate = () => {
        const machines = config.get('machines');
        let done = 0;
        machines.forEach((m) => {
            if (m.ip) {
                done++;
            }
        });
        if (done === machines.length) {
            logger.log(`Found all machine IP addresses..`);
            client.end();
        }
    };

};

const getDevice = (id) => {
    let machine;
    config.get('machines').forEach(m => {
        if (m.id === id) {
            machine = m;
        }
    });
    return machine;
};

const getDevices = (tokens, cb) => {
    logger.log(`Fetching devices from their API.`);
    const url = parse(`${API}/v1/iot-service/api/user/bind`);
    url.headers = {
        Authorization: `Bearer ${tokens.token}`
    };
    logger.debug(`URL:`, url);

    https.get(url, (res) => {
        let data = '';
        res.on('data', d => {return data += d;});
        res.on('end', () => {
            const json = JSON.parse(data);
            logger.debug(`JSON:`, JSON.stringify(json, null, 4));
            //Not sure when an error would occur here??
            cb(json.error, json.devices);
        });
    });
};

const getTokens = (username, passwd, cb) => {
    const u = parse(BASE);
    u.method = 'POST';
    const json = JSON.stringify({ account: username, password: passwd, apiError: "" });
    logger.debug(`Payload:`, json);
    u.headers = {
        'content-type':   'application/json',
        'content-length': json.length
    };
    logger.debug(`getTokens`, u);
    const req = https.request(u, (res) => {
        const code = res.statusCode;
        const tokens = {};
        logger.debug(`Headers:`, res.headers);
        res.headers['set-cookie'].forEach(c => {
            const token = c.split(';')[0].split('=');
            if (token[0] === 'token' || token[0] === 'refreshToken') {
                tokens[token[0]] = token[1];
            }
        });
        let data = '';
        res.on('data', d => {return data += d;});
        res.on('end', () => {
            if (code !== 200) {
                const json = JSON.parse(data);
                logger.debug(`JSON`, JSON.stringify(json, null, 4));
                return cb(json.error);
            }
            cb(null, tokens);
        });
    });
    req.write(json);
    req.end();
};
