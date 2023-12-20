const cfg = require('./config.js');
const Table = require('easy-table');
const mqtt = require('mqtt');
const chalk = require('chalk');
const tt = require('timethat');
const namer = require('color-namer');

const ftp = require('./ftp.js');

const CONSTS = require('./const.js');

const statusCheck = {};

const status = (value) => {
    return ' ' + chalk.bold((value) ? chalk.green(`✔`) : chalk.red(`✘`));
};

module.exports = (args) => {
    let machines = cfg.get('machines');
    
    if (args.id) {
        console.log(`Showing only, ${args.id}`);
        let m;
        machines.forEach(_m => {
            if (_m.id === args.id) {
                m = _m;
            }
        });
        if (!m) {
            console.error(`Failed to find machine: ${args.id}`);
            process.exit(2);
        }
        return showAll([m]);
    }

    showAll(machines);
};

const showAll = (_machines) => {
    const len = _machines.length;
    let machines = JSON.parse(JSON.stringify(_machines));
    console.log(`Checking connectivity for ${machines.length} machine(s)\n`);
    statusFTP(machines, () => {
        machines = JSON.parse(JSON.stringify(_machines));
        statusMQTT(machines, () => {
            const table = new Table();
            Object.keys(statusCheck).forEach(id => {
                const m = statusCheck[id];
                let ams = 'n/a';
                if (m.ams && Array.isArray(m.ams.ams)) {
                    ams = [];
                    m.ams.ams.forEach((a) => {
                        const l = amsNumToLetter(a.id);
                        ams.push(l);
                    });
                    ams = ams.join(',');
                }
                table.cell('ID', m.machine.id);
                table.cell('Name', m.machine.name);
                table.cell('IP Address', m.machine.ip);
                table.cell('FTP', status(m.ftp));
                table.cell('MQTT', status(m.mqtt));
                table.cell('AMS', ams);
                table.cell('Nozzle', m.nozzle);
                table.cell('Printing', m.printing);
                table.cell('Task', trunc(m.task));
                table.cell('Percent', m.percent);
                table.cell('Remaining', m.remaining);
                table.cell('Speed', m.speed);
                table.newRow();
            });
            console.log(table.toString());
            if (len === 1) {
                //console.log(JSON.stringify(statusCheck, null, 4));
                showDetails();
            }
        });
    });
};

const trunc = (str) => {
    const len = str.length;
    if (len > 20) {
        str = `${str.substr(0, 20)} ...`;
    }
    return str;
};

const showDetails = () => {
    const id = Object.keys(statusCheck)[0];
    const machine = statusCheck[id];
    //console.log(machine);

    //Show firmware update info..
    if (machine.update && machine.update.ota_new_version_number) {
        console.log(`⚠️ New Firmware detected: ${machine.update.ota_new_version_number}`);
    }
    const table = new Table();
    table.cell('Model', machine.machine.make);
    machine.hardware.forEach(h => {
        if (h.sn === id) {
            table.cell('Machine firm', h.sw_ver);
        }
        if (h.name === 'ahb') {
            table.cell('AMS Hub firm', h.sw_ver);
        }
        if (h.name.startsWith('ams/')) {
            const l = amsNumToLetter(h.name.split('/')[1]);
            table.cell(`AMS ${l} firm`, h.sw_ver);
        }
    });
    table.newRow();
    console.log(table.toString());

    if (machine.ams && machine.ams.ams) {
        console.log();
        const ams = machine.ams.ams;
        //console.log(JSON.stringify(machine.ams, null, 4));
        const current = Number(machine.ams.tray_now);
        const table = new Table();
        let tc = 1;
        ams.forEach(a => {
            const amsID = amsNumToLetter(a.id);
            //console.log(`AMS ${amsID}: ${a.temp}°C`);

            const trays = a.tray;
            trays.forEach((tray) => {
                const id = Number(tray.id) + 1;
                let amsName = `${amsID} ${id}`;
                if (tc === current) {
                    amsName += '*';
                }
                table.cell('AMS', amsName);
                if (Object.keys(tray).length === 1) {
                    //console.log(`Slot ${id} is empty!`);
                    table.cell(`Color`, 'Empty');
                    table.cell('Color Name', 'Empty');
                    table.cell(`Hex`, ' ');
                    table.cell('Type', 'Empty');
                    table.cell('Brand', 'Empty');
                    table.cell('Remain', `0%`);
                    table.newRow();
                    return;
                }
                const color = tray.tray_color.substr(0, 6);
                if (tray.cols.length > 1) { //Mulicolor
                    const color1 = tray.cols[0].substr(0, 6);
                    const color2 = tray.cols[1].substr(0, 6);
                    let colorBlock = chalk.bgHex(color1)('  ');
                    colorBlock += chalk.bgHex(color2)('  ');
                    table.cell(`Color`, colorBlock);
                    table.cell('Color Name', `${getColorName(color1)}/${getColorName(color2)}`);
                    table.cell(`Hex`, `#${color1}/#${color2}`);
            
                } else {
                    table.cell(`Color`, chalk.bgHex(color)('    '));
                    table.cell('Color Name', getColorName(color));
                    table.cell(`Hex`, `#${color}`);
                }
                table.cell('Type', tray.tray_type);
                //table.cell('Brand', brand);
                table.cell('Brand', CONSTS.FILAMENT_NAMES[tray.tray_info_idx]);
                table.cell('Remain', `${tray.remain}%`);
                table.newRow();
                tc++;
            });
        });
        console.log(table.toString());
        console.log(`* denotes active filament`);
        console.log(`Filament color names are in Pantone..`);
    }
};

const getColorName = (hex) => {
    const options = {
        pick: ['basic', 'pantone']
    };
    //const n = namer(`#${hex}`, options).basic[0].name;
    const n = namer(`#${hex}`, options).pantone[0].name;
    //console.log(namer(`#${hex}`));process.exit();
    //console.log(color, namer(`#${color}`, { pick: ['basic'] }).basic[0].name);
    return `${n.substr(0, 1).toUpperCase()}${n.substr(1)}`;
};

const amsNumToLetter = (num) => {
    num = Number(num);
    return (String.fromCharCode(97 + num)).toUpperCase();
};

const statusMQTT = (machines, cb) => {
    const m = machines.pop();
    if (m) {
        statusCheck[m.id] = statusCheck[m.id] || {};
        statusCheck[m.id].machine = m;
        statusCheck[m.id].ams = 'None';
        statusCheck[m.id].mqtt = false;
        statusCheck[m.id].printing = false;
        statusCheck[m.id].task = 'None';
        statusCheck[m.id].percent = 'n/a';
        statusCheck[m.id].remaining = 'n/a';
        statusCheck[m.id].speed = 'n/a';

        const BASE = `mqtts://${m.ip}:8883`;
        const client = mqtt.connect(BASE, {
            username:           'bblp',
            password:           m.token,
            rejectUnauthorized: false
        });

        client.on('error', () => {
            client.end();
            statusMQTT(machines, cb);
        });
        
        client.on("connect", (e) => {
            statusCheck[m.id].mqtt = true;
            client.subscribe(`device/${m.id}/report`, () => {});
            CONSTS.MQTT_INIT.forEach((init) => {
                client.publish(`device/${m.id}/request`, JSON.stringify(init));
            });
        });
        const topics = {
            info:  0,
            print: 0
        };

        client.on('message', (topic, message) => {
            const json = JSON.parse(message.toString());
            //const key = Object.keys(json)[0];
            //const cmd = json[key].command;
            if (json.info) {
                topics.info = 1;
                statusCheck[m.id].hardware = json.info.module;
            }
            if (json.print) {
                topics.print = 1;
                if ('subtask_name' in json.print) {
                    let name = json.print.subtask_name.replace('.gcode.3mf', '').replace('.gcode', '');
                    if (name === 'auto_cali_for_user_param.gcode') {
                        name = 'Auto Calibration';
                    }
                    if (name) {
                        statusCheck[m.id].task = name;
                    }
                }
                statusCheck[m.id].printing = json.print.gcode_state;
                statusCheck[m.id].nozzle = json.print.nozzle_diameter;
                if ('mc_remaining_time' in json.print) {
                    statusCheck[m.id].remaining = timed(json.print.mc_remaining_time);
                }
                if ('mc_percent' in json.print) {
                    statusCheck[m.id].percent = `${json.print.mc_percent}%`;
                }
                if ('spd_lvl' in json.print) {
                    statusCheck[m.id].speed = CONSTS.SPEEDS[json.print.spd_lvl];
                }
                if ('ams' in json.print) {
                    statusCheck[m.id].ams = json.print.ams;
                }
                if ('upgrade_state' in json.print) {
                    statusCheck[m.id].update = json.print.upgrade_state;
                }
                //Cleanup
                if (statusCheck[m.id].printing === 'FINISH') {
                    statusCheck[m.id].printing = 'IDLE';
                    statusCheck[m.id].percent = 'n/a';
                    statusCheck[m.id].task = 'None';
                    statusCheck[m.id].remaining = 'n/a';

                }
            }
            if (topics.print && topics.info) {
                statusMQTT(machines, cb);
                client.end();
            }
        });
    } else {
        cb();
    }
};

const timed = (t) => {
    let stamp = (Date.now() + (t * 60) * 1000);
    return tt.calc(new Date(), stamp)
        .replace(', 0 seconds', '')
        .replace('econds', '')
        .replace('ours', '')
        .replace('our', '')
        .replace('inutes', '')
        .replace('inute', '')
        .replace(/ /g, '');
};

const statusFTP = async(machines, cb) => {
    const m = machines.pop();
    if (m) {
        const alive = await checkFTP(m);
        statusCheck[m.id] = statusCheck[m.id] || {};
        statusCheck[m.id].machine = m;
        statusCheck[m.id].ftp = alive;
        statusFTP(machines, cb);
    } else {
        cb();
    }
};

const checkFTP = async(machine) => {
    const client = await ftp.makeClient(machine);
    try {
        const list = await client.list('/');
        await client.close();
        return (list.length) ? true : false;
    } catch (e) {
        return false;
    }
};

