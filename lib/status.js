const cfg = require('./config.js');
const Table = require('easy-table');
const mqtt = require('mqtt');
const chalk = require('chalk');
const tt = require('timethat');
const namer = require('color-namer');

const ftp = require('./ftp.js');
const logger = require('./logger.js');

const CONSTS = require('./const.js');

const statusCheck = {};

const status = (value) => {
    return ' ' + chalk.bold((value) ? chalk.green(`✔`) : chalk.red(`✘`));
};

module.exports = (args) => {
    let machines = cfg.get('machines');
    
    if (args.id) {
        logger.log(`Showing only, ${args.id}`);
        const m = cfg.getMachine(args.id);
        if (!m) {
            logger.error(`Failed to find machine: ${args.id}`);
            process.exit(2);
        }
        return showAll(args, [m]);
    }

    showAll(args, machines);
};

const showAll = (args, _machines) => {
    const len = _machines.length;
    let machines = JSON.parse(JSON.stringify(_machines));
    logger.log(`Checking connectivity for ${machines.length} machine(s)\n`);
    statusFTP(machines, () => {
        machines = JSON.parse(JSON.stringify(_machines));
        statusMQTT(machines, () => {
            const table = new Table();
            let showExt = false;
            const slim = (len === 1) ? false : (args.slim || false);
            Object.keys(statusCheck).forEach(id => {
                const m = statusCheck[id];
                if (m.external.color && m.external.type) {
                    showExt = true;
                }
            });
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
                let ext = 'n/a';
                if (m.external.color && m.external.type) {
                    const c = chalk.bgHex(m.external.color)('    ');
                    ext = `${c} #${m.external.color}/${m.external.type}`;
                }
                if (!slim) {
                    table.cell('ID', m.machine.id);
                }
                table.cell('Name', m.machine.name);
                if (!slim) {
                    table.cell('IP Address', m.machine.ip);
                }
                table.cell('FTP', status(m.ftp));
                table.cell('MQTT', status(m.mqtt));
                if (showExt) {
                    table.cell('Ext Spool', ext);
                }
                table.cell('AMS', ams);
                table.cell('Nozzle', m.nozzle);
                table.cell('Printing', m.printing);
                table.cell('Task', trunc(m.task));
                table.cell('Percent', m.percent);
                table.cell('Remaining', m.remaining);
                table.cell('Speed', m.speed);
                table.newRow();
            });
            saveMeta();
            logger.log(table.toString());
            if (len === 1) {
                //console.log(JSON.stringify(statusCheck, null, 4));
                showDetails();
            }
        });
    });
};

const saveMeta = () => {
    const machines = cfg.get('machines');
    machines.forEach(m => {
        const s = statusCheck[m.id];
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
                        let color = tray.cols[0];
                        val.color = color.substr(0, 6);
                        val.type = tray.tray_type;
                    }
                    m.filaments.push(val);
                });
            });
        }
    });
    cfg.set('machines', machines);
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
        logger.warn(`New Firmware detected: ${machine.update.ota_new_version_number}\n`);
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
    logger.log(table.toString());
    
    if (machine.remainingStamp) {
        const stamp = (Date.now() + (machine.remainingStamp * 60) * 1000);
        console.log(`Estimated completion time: ${(new Date(stamp)).toLocaleString()}`);
    }

    if (machine.ams && machine.ams.ams) {
        logger.log();
        const ams = machine.ams.ams;
        //console.log(JSON.stringify(machine.ams, null, 4));
        const current = Number(machine.ams.tray_now);
        const table = new Table();
        let tc = 0;
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
        logger.log(table.toString());
        logger.log(`* denotes active filament`);
        logger.log(`Filament color names are in Pantone..`);
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
        statusCheck[m.id].external = { color: false, type: false };
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
            rejectUnauthorized: false,
            clientId:           `bambu-cli`
        });

        client.on('error', () => {
            client.end();
            statusMQTT(machines, cb);
        });
        
        client.on("connect", (e) => {
            statusCheck[m.id].mqtt = true;
            client.unsubscribe(`device/${m.id}/report`, () => {});
            setTimeout(() => {
                client.subscribe(`device/${m.id}/report`, () => {});
                CONSTS.MQTT_INIT.forEach((init) => {
                    client.publish(`device/${m.id}/request`, JSON.stringify(init));
                });
            }, 500);
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
                //statusCheck[m.id].printing = json.print.gcode_state;
                statusCheck[m.id].printing = CONSTS.STAGES[json.print.stg_cur];
                statusCheck[m.id].nozzle = json.print.nozzle_diameter;
                if ('mc_remaining_time' in json.print) {
                    statusCheck[m.id].remaining = timed(json.print.mc_remaining_time);
                    statusCheck[m.id].remainingStamp = json.print.mc_remaining_time;
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
                if ('vt_tray' in json.print) {
                    if (json.print.vt_tray.tray_type !== '') { //Empty External Spool
                        statusCheck[m.id].external = {
                            color: json.print.vt_tray.tray_color.substr(0, 6),
                            type:  json.print.vt_tray.tray_type
                        };
                    }
                }
                //Cleanup
                if (statusCheck[m.id].printing === 'Idle') {
                    //statusCheck[m.id].printing = 'IDLE';
                    statusCheck[m.id].percent = 'n/a';
                    statusCheck[m.id].task = 'None';
                    statusCheck[m.id].remaining = 'n/a';
                    statusCheck[m.id].remainingStamp = false;
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
        .replace('ays', '')
        .replace('ay', '')
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

