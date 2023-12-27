const path = require('path');
const fs = require('fs');
const unzip = require('unzipper');
const Table = require('easy-table');
const chalk = require('chalk');
const pretty = require('prettysize');
const timer = require('timethat').calc;
const { XMLParser } = require("fast-xml-parser");
const { sync: md5sum } = require('md5-file');

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
        console.error(`⛔ Failed to find file in arguments.`);
        process.exit(1);
    }
    file = path.resolve(file);
    if (!fs.existsSync(file)) {
        console.error(`⛔ Failed to locate: ${file}`);
        process.exit(1);
    }
    const md5 = md5sum(file);
    const cacheFile = path.join(cfg.cacheDir, `${md5}.json`);
    
    if (file.indexOf('.gcode') === -1) {
        args.force = true;
        console.log(`⚠️  Warning, this is not a prepared file. No gcode, colors, filament, etc data is available. ⚠️\n`);
    }

    if (fs.existsSync(cacheFile) && !args.force) {
        console.log(`Loading cached data from: ${cacheFile}`);
        const cacheInfo = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        printData(file, cacheInfo, cb);
        return;
    }

    console.log(`Attempting to parse: ${file}`);
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
                //console.log(content.toString());
                //console.log(JSON.stringify(json.config.plate, null, 4));
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
                    //console.log(`Plate ${id} (${name})`);
                    const plate = `plate_${id}`;
                    info[plate] = info[plate] || {};
                    info[plate].name = name;
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
                //console.log(content.toString());
                //console.log(JSON.stringify(json.config.plate, null, 4));
                if (Array.isArray(json.config.plate)) {
                    json.config.plate.forEach((p) => {
                        let id;
                        p.metadata.forEach(m => {
                            if (m.key === 'index') {
                                id = m.value;
                            }
                        });
                        const plate = `plate_${id}`;
                        info[plate] = info[plate] || {};
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
            //console.log(JSON.stringify(_info, null, 4));
            saveCache(cacheFile, _info);
            printData(file, _info, cb);
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
    //console.log(`Saving parse data to cache: ${file}`);
    fs.writeFileSync(file, JSON.stringify(info, null, 4) + '\n', 'utf8');
};

const printData = (file, info, cb) => {
    //console.log(JSON.stringify(info, null, 4));
    const stat = fs.statSync(file);
    console.log();
    const type = (file.indexOf('.gcode') > -1) ? 'GCode Ready to Print' : 'Simple Project File (not ready to print)';
    console.log(`File Information:`);
    console.log(`   Type:        ${type}`);
    console.log(`   Size:        ${pretty(stat.size)}`);
    console.log(`   Created:     ${stat.ctime.toLocaleString()}`);
    console.log(`   Last Mod:    ${stat.mtime.toLocaleString()}`);
    console.log(`   Last Access: ${stat.atime.toLocaleString()}`);
    console.log();
    const table = new Table();
    Object.values(info).forEach(i => {
        table.cell('Plate', `Plate ${i.plate}`);
        table.cell('Bed Type', i.bed);
        table.cell('Nozzle', i.nozzle);
        table.cell('Filament Colors', colors(dedupe(i.colors)).join(', ') || 'n/a');
        table.cell('Filaments', filaments(i.filaments, 'type'));
        table.cell('Fil Used (m)', filaments(i.filaments, 'used_m'));
        table.cell('Fil Used (g)', filaments(i.filaments, 'used_g'));
        table.cell('GCode Lines', i.gcode_lines.toLocaleString());
        table.cell('Estimated Time', i.estimated);
        table.newRow();
    });
    console.log(table.toString());
    findPrinter(info);
    console.log();
    console.log(`Finished parsing in ${timer(START)}`);
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
    console.log(`File has filament type/colors of:\n\t${_colors.join(', ')}`);
    console.log();
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
        console.error(`⚠️  No printers found with these colors: ${colors.join(', ')}`);
    }
    Object.values(info).forEach((pl) => {
        //console.log(pl);
        const avail = [];
        Object.keys(valid).forEach(id => {
            //console.log(pl.plate, id, pl.filaments);
            pl.filaments.forEach(f => {
                const key = `${f.type}:::${f.color.replace('#', '')}`;
                //console.log('key', key);
                Object.keys(valid).forEach(id => {
                    //console.log(id, key, valid[id], valid[id].includes(key));
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
                    }
                });
            });
        });
        const per = {};
        avail.forEach(v => {
            per[v.id] = per[v.id] || [];
            per[v.id].push(v.filament);
        });
        //console.log(`Plate ${pl.plate}`, avail, per, pl.colors.length);
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
                ps.push(id);
            }
        });
        if (Array.isArray(ps)) {
            ps = ps.join(', ');
        }
        if (num > 0) {
            console.log(`Plate ${pl.plate} can be printed on ${num} printer${(num > 1) ? 's' : ''}: ${ps}`);
        } else {
            console.log(`⚠️  No capable printers found for Plate ${pl.plate}.`);
        }
    });
    //console.log(valid);
    //console.log(colors);
    //console.log(info);
};

module.exports = parse;

const colors = (c) => {
    if (Array.isArray(c)) {
        c.forEach((name, id) => {
            const color = chalk.bgHex(name)(' ');
            c[id] = `${color} ${name}`;
        });
    }
    return c;
};

const filaments = (_fil, _type) => {
    const info = [];
    //console.log(_fil);
    _fil.forEach((fil) => {
        if (fil[_type]) {
            info.push(fil[_type]);
        }
    });
    return dedupe(info).join(', ');
};

const dedupe = (data) => {
    return data.filter((value, index) => {return data.indexOf(value) == index;});
};
