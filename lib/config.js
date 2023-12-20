const fs = require('fs');
const path = require('path');
const options = { name: 'bambu-cli' };
const xdg = require('xdg-app-paths/cjs')(options);
const configDir = xdg.config(options);
const configFile = path.join(configDir, 'config.json');

let config = {};

//Default command..
module.exports = () => {
    console.log(JSON.stringify(config, null, 4));
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

if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
}

if (!fs.existsSync(configFile)) {
    writeConfig();
}

config = readConfig();

module.exports.writeConfig = writeConfig;
module.exports.readConfig = readConfig;

module.exports.set = (key, value) => {
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

