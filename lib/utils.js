const chalk = require('chalk');
const mqtt = require('mqtt');

const mqttClient = (machine) => {
    const BASE = `mqtts://${machine.ip}:8883`;
    const client = mqtt.connect(BASE, {
        username:           'bblp',
        password:           machine.token,
        rejectUnauthorized: false,
        clientId:           `bambu-cli`
    });
    return client;
};
module.exports.mqttClient = mqttClient;

const dedupe = (data) => {
    return data.filter((value, index) => {return data.indexOf(value) == index;});
};
module.exports.dedupe = dedupe;

const amsTrayNumToLetters = (num) => {
    num = Number(num);
    const ams = Math.floor(num / 4);
    const letter = (String.fromCharCode(97 + ams)).toUpperCase();
    let tray = (num - (ams * 4)) + 1; 
    return `AMS ${letter}${tray}`;
};
module.exports.amsTrayNumToLetters = amsTrayNumToLetters;

const amsNumToLetter = (num) => {
    num = Number(num);
    return (String.fromCharCode(97 + num)).toUpperCase();
};
module.exports.amsNumToLetter = amsNumToLetter;

const colorBox = (hex, spaces) => {
    const str = Array(spaces + 1).join(' ');
    return chalk.bgHex(hex)(str);
};
module.exports.colorBox = colorBox;

const status = (value) => {
    return ' ' + chalk.bold((value) ? chalk.green(`✔`) : chalk.red(`✘`));
};
module.exports.status = status;
