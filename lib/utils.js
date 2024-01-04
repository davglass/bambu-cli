const chalk = require('chalk');
const mqtt = require('mqtt');
const tt = require('timethat');

const cfg = require('./config.js');
const CONSTS = require('./const.js');

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

const mqttMessage = (json, data) => {
    if (json.info) {
        data.hardware = json.info.module;
    }
    if (json.print) {
        data.hms = [];
        if (json.print.hms && json.print.hms.length) {
            data.hms = json.print.hms;
        }
        if ('subtask_name' in json.print) {
            let name = json.print.subtask_name.replace('.gcode.3mf', '').replace('.gcode', '');
            if (name === 'auto_cali_for_user_param.gcode') {
                name = 'Auto Calibration';
            }
            if (name) {
                data.task = name;
            }
        }
        data.printing = CONSTS.STAGES[json.print.stg_cur];
        data.nozzle = json.print.nozzle_diameter;
        if ('mc_remaining_time' in json.print) {
            data.remaining = timed(json.print.mc_remaining_time);
            data.remainingStamp = json.print.mc_remaining_time;
        }
        if ('mc_percent' in json.print) {
            data.percent = `${json.print.mc_percent}%`;
        }
        if ('spd_lvl' in json.print) {
            data.speed = CONSTS.SPEEDS[json.print.spd_lvl];
        }
        if ('ams' in json.print) {
            data.ams = json.print.ams;
        }
        if ('upgrade_state' in json.print) {
            data.update = json.print.upgrade_state;
        }
        if ('vt_tray' in json.print) {
            if (json.print.vt_tray.tray_type !== '') { //Empty External Spool
                data.external = {
                    color: json.print.vt_tray.tray_color.substr(0, 6),
                    type:  json.print.vt_tray.tray_type
                };
            }
        }
        //Cleanup
        if (data.printing === 'Idle') {
            data.percent = 'n/a';
            data.task = 'None';
            data.remaining = 'n/a';
            data.remainingStamp = false;
        }
    }
    return data;
};
module.exports.mqttMessage = mqttMessage;

const timed = (t) => {
    let stamp = (Date.now() + (t * 60) * 1000);
    return tt.calc(new Date(), stamp)
        .replace(', 0 seconds', '')
        .replace('ays', '')
        .replace('ay', '')
        .replace('econds', '')
        .replace('ours', '')
        .replace('our', '')
        .replace('inutes', '')
        .replace('inute', '')
        .replace(/ /g, '');
};

const saveMachineMeta = (data) => {
    const machines = cfg.get('machines');
    machines.forEach(m => {
        const s = data[m.id];
        if (!s) {
            return; //Machine isn't in status, skip it..
        }
        m.ams = 0;
        delete m.colors;
        m.filaments = [];
        m.external = { color: false, type: false };
        if (s && s.external && s.external.color) {
            m.external.color = s.external.color;
            m.external.type = s.external.type;
        }
        if (s && s.ams && s.ams.ams && Array.isArray(s.ams.ams)) {
            m.ams = s.ams.ams.length;
            s.ams.ams.forEach((a) => {
                a.tray.forEach(tray => {
                    let val = {
                        color: false,
                        type:  false
                    };
                    if (tray.cols) {
                        let color = tray.cols[0].substr(0, 6);
                        if (tray.cols.length > 1) {
                            let color2 = tray.cols[1].substr(0, 6);
                            color = `${color}/${color2}`;
                        }
                        val.color = color;
                        val.type = tray.tray_type;
                    }
                    m.filaments.push(val);
                });
            });
        }
    });
    cfg.set('machines', machines);
};
module.exports.saveMachineMeta = saveMachineMeta;

const truncate = (str, max) => {
    max = max || 20;
    const len = str.length;
    if (len > max) {
        str = `${str.substr(0, max)} ...`;
    }
    return str;
};
module.exports.truncate = truncate;


const padHMS = (num) => {
    let str = (num).toString(16);
    if (str.length < 8) {
        let a = (Array(8 - str.length + 1)).join('0');
        str = `${a}${str}`;
    }
    str = `${str.substr(0, 4)}_${str.substr(4, 4)}`;
    return str.toUpperCase();
};

const hmsLevel = (code) => {
    const lvl = (code >> 16);
    return CONSTS.HMS_LEVELS[lvl];
};
module.exports.hmsLevel = hmsLevel;

const hmsErrorToCode = (attr, code) => {
    attr = padHMS(attr);
    code = padHMS(code);
    return `HMS_${attr}_${code}`;
};

module.exports.hmsErrorToCode = hmsErrorToCode;

const hmsErrorLookup = (attr, code) => {
    attr = padHMS(attr);
    code = padHMS(code);
    const key = `${attr.replace('_', '')}${code.replace('_', '')}`;
    let err = 'Uknown Error';
    if (CONSTS.HMS_ERRORS[key]) {
        err = CONSTS.HMS_ERRORS[key];
    }
    return err;
};

module.exports.hmsErrorLookup = hmsErrorLookup;

const hmsErrorURL = (machine, attr, code) => {
    const e = hmsErrorToCode(attr, code).replace('HMS_', '').replace(/_/g, '');
    const d = machine.id;
    const s = 'device_hms';
    //https://e.bambulab.com/index.php?e=0700200000030002&d=00M09A390700801&s=device_hms&lang=en
    const url = `https://e.bambulab.com/index.php?e=${e}&d=${d}&s=${s}&lang=en`;
    return url;
};
module.exports.hmsErrorURL = hmsErrorURL;
