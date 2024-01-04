const cfg = require('./config.js');
const Table = require('easy-table');
const namer = require('color-namer');

const utils = require('./utils.js');
const ftp = require('./ftp.js');
const logger = require('./logger.js');

const CONSTS = require('./const.js');

const statusCheck = {};

module.exports = (args) => {
    let machines = cfg.get('machines');
    
    if (args.id) {
        if (!args.json) {
            logger.log(`Showing only, ${args.id}`);
        }
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
    if (!args.json) {
        logger.log(`Checking connectivity for ${machines.length} machine(s)\n`);
    }
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
                        const l = utils.amsNumToLetter(a.id);
                        ams.push(l);
                    });
                    ams = ams.join(',');
                }
                let ext = 'n/a';
                if (m.external.color && m.external.type) {
                    const c = utils.colorBox(m.external.color, 1);
                    ext = `${c} #${m.external.color}/${m.external.type}`;
                    if (Number(m.ams.tray_now) === 254) {
                        ext += '*';
                    }
                }
                if (!slim) {
                    table.cell('ID', m.machine.id);
                }
                table.cell('Name', m.machine.name);
                if (!slim) {
                    table.cell('IP Address', m.machine.ip);
                }
                table.cell('FTP', utils.status(m.ftp));
                table.cell('MQTT', utils.status(m.mqtt));
                if (showExt) {
                    table.cell('Ext Spool', ext);
                }
                table.cell('AMS', ams);
                table.cell('Nozzle', m.nozzle);
                table.cell('Printing', m.printing);
                table.cell('Task', utils.truncate(m.task));
                table.cell('Percent', m.percent);
                table.cell('Remaining', m.remaining);
                table.cell('Speed', m.speed);
                table.newRow();
            });
            utils.saveMachineMeta(statusCheck);
            if (args.json) {
                console.log(JSON.stringify(statusCheck, null, 4));
            } else {
                logger.log(table.toString());
            }
            if (len === 1 && !args.json) {
                //console.log(JSON.stringify(statusCheck, null, 4));
                showDetails();
            }
            if (!args.json) {
                console.log();
                showErrors();
            }
        });
    });
};

const showErrors = () => {
    const single = Object.keys(statusCheck).length === 1 ? true : false;
    Object.values(statusCheck).forEach(machine => {
        if (machine.hms.length) {
            machine.hms.forEach(h => {
                const code = utils.hmsErrorToCode(h.attr, h.code);
                const str = utils.hmsErrorLookup(h.attr, h.code);
                const lvl = utils.hmsLevel(h.code);
                //console.log(code, str);
                let log = `[${code}] ${str}`;
                if (!single) {
                    log = `[${machine.machine.id}]${log}`;
                }
                logger[lvl](log);
                logger.log(utils.hmsErrorURL(machine.machine, h.attr, h.code));
            });
            console.log();
        }
    });
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
            const l = utils.amsNumToLetter(h.name.split('/')[1]);
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
            const amsID = utils.amsNumToLetter(a.id);
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
                    let colorBlock = utils.colorBox(color1, 2);
                    colorBlock += utils.colorBox(color2, 2);
                    table.cell(`Color`, colorBlock);
                    table.cell('Color Name', `${getColorName(color1)}/${getColorName(color2)}`);
                    table.cell(`Hex`, `#${color1}/#${color2}`);
            
                } else {
                    table.cell(`Color`, utils.colorBox(color, 4));
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
        
        const client = utils.mqttClient(m);

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

            statusCheck[m.id] = utils.mqttMessage(json, statusCheck[m.id]);

            if (json.info) {
                topics.info++;
            }
            if (json.print) {
                topics.print++;
            }
            //Checking for more than a few messages to make sure we get all the
            //data that we need to continue. Takes a few seconds longer but is more reliable
            if (topics.print > 2 && topics.info > 0) {
                statusMQTT(machines, cb);
                client.end();
            }
        });
    } else {
        cb();
    }
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

