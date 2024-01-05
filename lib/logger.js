const chalk = require('chalk');
const cfg = require('./config.js');
const os = require('os');

const HOME = os.homedir();
const USER = os.userInfo().username;
const USERNAME = cfg.get('username');
const MQTT = cfg.get('mqtt_user');

const MACHINES = cfg.get('machines');

const DEBUG = `🐞`;
const ERROR = `⛔`;
const WARN = `⚠️ `;
const INFO = `ℹ️`;

let DEBUGGING = false;

module.exports.setDebug = (val) => {
    DEBUGGING = val;
};

module.exports.REDACT = false;

const redactMachineInfo = (args) => {
    MACHINES.forEach(m => {
        ['name', 'id', 'ip', 'token'].forEach(key => {
            args.forEach((a, idx) => {
                //Redact this string globally
                const re = new RegExp(m[key], `g`);
                //Use the first 2 and last 2 characters, but blank the rest
                //keeping the same string length (due to table rendering)
                const f = m[key].substr(0, 2);
                const l = m[key].substr(-2);
                const len = m[key].length;
                const mid = (Array(m[key].substr(2, len - 3).length)).join('*');
                const value = `${f}${mid}${l}`;
                args[idx] = args[idx].replace(re, value);
            });
        });
    });
    return args;
    
};

const redactUserInfo = (args) => {
    args.forEach((a, idx) => {
        [HOME, USERNAME, MQTT, USER].forEach(v => {
            let re = new RegExp(v, `g`);
            args[idx] = args[idx].replace(re, (Array(v.length + 1).join('*')));
        });
    });
    return args;
};

const redact = (args) => {
    if (module.exports.REDACT) {
        args = Array.from(args);
        args = redactMachineInfo(args);
        args = redactUserInfo(args);
    }
    return args;
};

const debug = function() {
    if (!DEBUGGING) {
        return;
    }
    const a = redact(arguments);
    console.log(DEBUG, ...a);
};
module.exports.debug = debug;

const log = function() {
    const a = redact(arguments);
    console.log(...a);
};
module.exports.log = log;

const info = function() {
    const a = redact(arguments);
    //console.log(INFO, chalk.blue(`[INFO]`), ...a);
    console.log(INFO, ...a);
};
module.exports.info = info;

const error = function() {
    const a = redact(arguments);
    console.error(ERROR, chalk.red(`[ERR!]`), ...a);
};
module.exports.error = error;

const warn = function() {
    const a = redact(arguments);
    console.error(WARN, chalk.yellow(`[WARN]`), ...a);
};
module.exports.warn = warn;
