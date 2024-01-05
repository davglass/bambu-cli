const path = require('path');
const fs = require('fs');
const unzip = require('unzipper');
const Table = require('easy-table');
const pretty = require('prettysize');
const timer = require('timethat').calc;
const colorDiff = require('color-difference');
const { XMLParser } = require("fast-xml-parser");
const { sync: md5sum } = require('md5-file');
const logger = require('./logger.js');

const utils = require('./utils.js');
const cfg = require('./config.js');

const CONSTS = require('./const.js');

let START;

const parse = (args, cb) => {
    START = new Date();
    let file = args.file;
    if (args && args._ && args._[1]) {
        file = args._[1];
    }

    if (!file || file === true) {
        logger.error(`Failed to find file in arguments.`);
        process.exit(1);
    }
    file = path.resolve(file);
    if (!fs.existsSync(file)) {
        logger.error(`Failed to locate: ${file}`);
        process.exit(1);
    }
    const md5 = md5sum(file);
    const cacheFile = path.join(cfg.cacheDir, `${md5}.json`);
    
    if (file.indexOf('.gcode') === -1) {
        args.force = true;
        logger.warn(`This is not a prepared file. No gcode, colors, filament, etc data is available.\n`);
    }

    if (fs.existsSync(cacheFile) && !args.force) {
        logger.log(`Loading cached data from: ${cacheFile}`);
        const cacheInfo = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        printData(file, cacheInfo, cb);
        return;
    }

    logger.log(`Attempting to parse: ${file}`);
    const info = {};
    fs.createReadStream(file)
        .pipe(unzip.Parse())
        .on('entry', async(entry) => {
            if (entry.path === 'Metadata/model_settings.config') {
                const content = await entry.buffer();
                const options = {
                    ignoreAttributes:    false,
                    attributeNamePrefix: "",
                    isArray:             (name, jpath, isLeafNode, isAttribute) => { 
                        if (jpath === 'config.plate') {
                            return true;
                        }
                    }
                };
                const parser = new XMLParser(options);
                const json = parser.parse(content);
                logger.debug(content.toString());
                logger.debug(JSON.stringify(json.config.plate, null, 4));
                json.config.plate.forEach(p => {
                    const meta = p.metadata;
                    let id;
                    let name;
                    meta.forEach(m => {
                        if (m.key === 'plater_id') {
                            id = Number(m.value);
                        }
                        if (m.key === 'plater_name') {
                            name = m.value;
                        }
                    });
                    logger.debug(`Plate ${id} (${name})`);
                    const plate = `plate_${id}`;
                    info[plate] = info[plate] || {};
                    info[plate].name = name;
                    info[plate].plate = id;
                });
            }
            if (entry.path === 'Metadata/slice_info.config') {
                const content = await entry.buffer();
                const options = {
                    ignoreAttributes:    false,
                    attributeNamePrefix: "",
                    isArray:             (name, jpath, isLeafNode, isAttribute) => { 
                        if (jpath === 'config.plate.filament' || jpath === 'config.plate') {
                            return true;
                        }
                    }
                };
                const parser = new XMLParser(options);
                const json = parser.parse(content);
                logger.debug(content.toString());
                logger.debug(JSON.stringify(json.config.plate, null, 4));
                if (Array.isArray(json.config.plate)) {
                    json.config.plate.forEach((p) => {
                        let id;
                        p.metadata.forEach(m => {
                            if (m.key === 'index') {
                                id = Number(m.value);
                            }
                        });
                        const plate = `plate_${id}`;
                        info[plate] = info[plate] || {};
                        info[plate].plate = id;
                        const c = [];
                        const filaments = [];
                        p.filament.forEach(f => {
                            delete f.id;
                            c.push(f.color);
                            filaments.push(f);
                        });
                        info[plate].colors = c;
                        info[plate].filaments = filaments;
                    });
                }
            }
            if (entry.path.startsWith('Metadata/plate_') && (entry.path.endsWith('.json') || entry.path.endsWith('.gcode'))) {
                const plate = entry.path.replace('Metadata/', '').replace('.json', '').replace('.gcode', '');
                const content = await entry.buffer();
                info[plate] = info[plate] || {};
                if (entry.path.endsWith('.json')) {
                    const json = JSON.parse(content.toString());
                    const o = {
                        plate:       Number(plate.replace('plate_', '')),
                        bed:         CONSTS.PLATES[json.bed_type],
                        nozzle:      json.nozzle_diameter.toFixed(1),
                        colors:      [],
                        filaments:   [],
                        gcode_lines: 0,
                        estimated:   'n/a'
                    };
                    Object.keys(o).forEach(k => {
                        if (!info[plate][k]) {
                            info[plate][k] = o[k];
                        }
                    });
                } else if (entry.path.endsWith('.gcode')) {
                    const text = content.toString().split('\n');
                    info[plate].gcode_lines = text.length;
                    text.some(line => {
                        if (line.indexOf('total estimated time') > -1) {
                            info[plate].estimated = line.split('; ')[1].split(': ')[1];
                            return true;
                        }
                        return false;
                    });
                } else {
                    entry.autodrain();
                }
            } else {
                entry.autodrain();
            }
        })
        .on('end', () => {
            const _info = filterData(info);
            logger.debug(JSON.stringify(_info, null, 4));
            saveCache(cacheFile, _info);
            printData(file, _info, cb);
            if (file.indexOf('.gcode') === -1) {
                args.force = true;
                console.log();
                logger.warn(`This is not a prepared file. No gcode, colors, filament, etc data is available.`);
            }
        });
};

const filterData = (info) => {
    Object.keys(info).forEach(plate => {
        const len = Object.keys(info[plate]).length;
        if (len === 1) {
            delete info[plate];
        }
    });
    return info;
};

const saveCache = (file, info) => {
    logger.debug(`Saving parse data to cache: ${file}`);
    fs.writeFileSync(file, JSON.stringify(info, null, 4) + '\n', 'utf8');
};

const plateSort = (_a, _b) => {
    const a = Number(_a.plate);
    const b = Number(_b.plate);
    if (a > b) {
        return 1;
    }
    return -1;
};

const printData = (file, info, cb) => {
    logger.debug(JSON.stringify(info, null, 4));
    const stat = fs.statSync(file);
    logger.log();
    const type = (file.indexOf('.gcode') > -1) ? 'GCode Ready to Print' : 'Simple Project File (not ready to print)';
    logger.log(`File Information:`);
    logger.log(`   Type:        ${type}`);
    logger.log(`   Size:        ${pretty(stat.size)}`);
    logger.log(`   Created:     ${stat.ctime.toLocaleString()}`);
    logger.log(`   Last Mod:    ${stat.mtime.toLocaleString()}`);
    logger.log(`   Last Access: ${stat.atime.toLocaleString()}`);
    logger.log();
    const table = new Table();
    let hasNames = false;
    Object.values(info).forEach(i => {
        if (i.name) {
            hasNames = true;
        }
    });
    Object.values(info).sort(plateSort).forEach(i => {
        i.gcode_lines = i.gcode_lines || 0;
        i.colors = i.colors || [];
        i.filaments = i.filaments || [];
        table.cell('Plate', `Plate ${i.plate}`);
        if (hasNames) {
            table.cell('Name', i.name || 'Unknown');
        }
        table.cell('Bed Type', i.bed);
        table.cell('Nozzle', i.nozzle);
        table.cell('Filament Colors', colors(utils.dedupe(i.colors)).join(', ') || 'n/a');
        table.cell('Filaments', filaments(i.filaments, 'type'));
        table.cell('Fil Used (m)', filaments(i.filaments, 'used_m'));
        table.cell('Fil Used (g)', filaments(i.filaments, 'used_g'));
        table.cell('GCode Lines', i.gcode_lines.toLocaleString());
        table.cell('Estimated Time', i.estimated);
        table.newRow();
    });
    logger.log(table.toString());
    if (file.indexOf('.gcode') > -1) {
        findPrinter(info);
    }
    logger.log();
    logger.log(`Finished parsing in ${timer(START)}`);
    cb && cb();

};

const findPrinter = (info) => {
    const machines = cfg.get('machines');
    //console.log(machines);
    //console.log(JSON.stringify(info, null, 4));
    const colors = {};
    const valid = {};
    Object.values(info).forEach(i => {
        i.filaments.forEach(f => {
            const key = `${f.type}:::${f.color.replace('#', '')}`;
            colors[key] = 1;
        });
    });
    const _colors = [];
    Object.keys(colors).forEach((c) => {
        _colors.push(c.split(':::').join(' #'));
    });
    logger.log(`File has filament type/colors of:\n\t${_colors.join(', ')}`);
    logger.log();
    machines.forEach(m => {
        valid[m.id] = valid[m.id] || [];
        m.filaments.forEach(f => {
            const key = `${f.type}:::${f.color}`;
            if (colors[key]) {
                //console.log(key);
                valid[m.id].push(key);
            }
        });
    });
    Object.values(valid).forEach(v => {
        v.forEach(k => {
            delete colors[k];
        });
    });
    if (colors.length) {
        logger.warn(`No printers found with these colors: ${colors.join(', ')}`);
    }
    Object.values(info).forEach((pl) => {
        logger.debug(pl);
        const avail = [];
        const missing = [];
        Object.keys(valid).forEach(id => {
            logger.debug(pl.plate, id, pl.filaments);
            pl.filaments.forEach(f => {
                const key = `${f.type}:::${f.color.replace('#', '')}`;
                logger.debug('key', key);
                Object.keys(valid).forEach(id => {
                    logger.debug(id, key, valid[id], valid[id].includes(key));
                    if (valid[id].includes(key)) {
                        let has = false;
                        avail.forEach(k => {
                            if (k.id === id && k.filament === key) {
                                has = true;
                            }
                        });
                        if (!has) {
                            avail.push({
                                id:       id,
                                filament: key
                            });
                        }
                    } else {
                        let has = false;
                        missing.forEach(k => {
                            if (k.id === id && k.filament === key) {
                                has = true;
                            }
                        });
                        if (!has) {
                            missing.push({
                                id:       id,
                                filament: key
                            });
                        }
                    }
                });
            });
        });
        const per = {};
        avail.forEach(v => {
            per[v.id] = per[v.id] || [];
            per[v.id].push(v.filament);
        });
        logger.debug(`Plate ${pl.plate}`, avail, per, missing, pl.colors.length);
        let num = 0;
        let ps = 'None';
        Object.keys(per).forEach(id => {
            const values = per[id];
            //console.log(id, values);
            if (values.length === pl.colors.length) {
                if (!Array.isArray(ps)) {
                    ps = [];
                }
                num++;
                ps.push(`[${id}] ${cfg.getMachine(id).name}`);
            }
        });
        if (Array.isArray(ps)) {
            ps = ps.join(', ');
        }
        if (num > 0) {
            logger.log(`Plate ${pl.plate} can be printed on ${num} printer${(num > 1) ? 's' : ''}: ${ps}`);
        } else {
            logger.warn(`No capable printers found for Plate ${pl.plate}.`);
            if (missing.length) {
                logger.warn(`Found ${missing.length} missing filament colors:`);
                missing.forEach(m => {
                    const fil = m.filament.split(':::');
                    const type = m.filament.split(':::')[0];
                    const color = m.filament.split(':::')[1];
                    const _m = cfg.getMachine(m.id);
                    //console.log(_m.filaments);
                    const _colors = [];
                    _m.filaments.forEach((f, idx) => {
                        if (f.type === type && f.color.indexOf('/') === -1) {
                            // NOTE: lower diff means closer color..
                            const diff = colorDiff.compare(color, f.color);
                            logger.debug(color, f.color, diff);
                            _colors.push({
                                color:  f.color,
                                type:   f.type,
                                fcolor: f.color,
                                tray:   idx,
                                diff:   diff
                            });
                        }
                    });
                    // NOTE: lower diff means closer color..
                    _colors.sort((_a, _b) => {
                        const a = _a.diff;
                        const b = _b.diff;
                        if (a > b) {
                            return 1;
                        }
                        return -1;
                    });
                    //console.log(_colors, fil);
                    let inform = `[${m.id}] ${cfg.getMachine(m.id).name} missing: ${fil[0]} ${utils.colorBox(fil[1], 1)} #${fil[1]}`;
                    const guess = _colors[0];
                    if (guess) {
                        const amsID = utils.amsTrayNumToLetters(guess.tray);
                        inform += ` best guess: ${guess.type} ${utils.colorBox(guess.fcolor, 1)} #${guess.fcolor} (${amsID})`;
                    } else {
                        inform += ` no compatible filaments found.`;
                    }
                    logger.warn(inform);
                });
            }
        }
    });
    logger.debug('valid:', valid);
    logger.debug('colors:', colors);
    logger.debug('info:', info);
};

module.exports = parse;

const colors = (c) => {
    if (Array.isArray(c)) {
        c.forEach((name, id) => {
            const color = utils.colorBox(name, 1);
            c[id] = `${color} ${name}`;
        });
    }
    return c;
};

const filaments = (_fil, _type) => {
    const info = [];
    //console.log(_fil);
    if (Array.isArray(_fil)) {
        _fil.forEach((fil) => {
            if (fil[_type]) {
                info.push(fil[_type]);
            }
        });
    }
    return utils.dedupe(info).join(', ');
};

