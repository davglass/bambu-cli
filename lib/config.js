const fs = require('fs');
const path = require('path');
const options = { name: 'bambu-cli' };
const xdg = require('xdg-app-paths/cjs')(options);
const configDir = xdg.config(options);
const cacheDir = xdg.cache();
const configFile = path.join(configDir, 'config.json');

let config = {};

//Default command..
module.exports = (args) => {
    const logger = require('./logger.js');
    if (args.set && args.value) {
        module.exports.set(args.set, args.value);
    }
    logger.debug(`Config dir: ${configDir}`);
    logger.debug(`Config file: ${configFile}`);
    logger.debug(`Cache dir: ${cacheDir}`);
    logger.log(JSON.stringify(config, null, 4));
};

const removeConfig = () => {
    return writeConfig({});
};

const writeConfig = (_config) => {
    if (_config) {
        config = _config;
    }
    const json = JSON.stringify(config, null, 4) + '\n';
    fs.writeFileSync(configFile, json, 'utf8');
    return config;
};

const readConfig = () => {
    config = JSON.parse(fs.readFileSync(configFile, 'utf8').trim());
    return config;
};

[configDir, cacheDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

if (!fs.existsSync(configFile)) {
    writeConfig();
}

config = readConfig();

module.exports.writeConfig = writeConfig;
module.exports.readConfig = readConfig;

const fixValue = (value) => {
    if (value === 'null') {
        value = null;
    }
    if (value === 'false') {
        value = false;
    }
    if (value === 'true') {
        value = true;
    }
    return value;
};
module.exports.fixValue = fixValue;

module.exports.set = (key, value) => {
    value = fixValue(value);
    config[key] = value;
    if (value === null) {
        delete config[key];
    }
    return writeConfig();
};

module.exports.get = (key) => {
    const c = JSON.parse(JSON.stringify(config));
    if (key) {
        return c[key];
    }
    return c;
};

module.exports.remove = removeConfig;

const getMachine = (id) => {
    const machines = config.machines;
    let machine = null;
    if (machines && Array.isArray(machines)) {
        machines.forEach(_m => {
            if (_m.id === id) {
                machine = _m;
            }
        });
    }
    return machine;
};
module.exports.getMachine = getMachine;

module.exports.cacheDir = cacheDir;
