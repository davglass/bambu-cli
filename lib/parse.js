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
            saveCache(cacheFile, info);
            printData(file, info, cb);
        });
};

const saveCache = (file, info) => {
    //console.log(`Saving parse data to cache: ${file}`);
    fs.writeFileSync(file, JSON.stringify(info, null, 4) + '\n', 'utf8');
};

const printData = (file, info, cb) => {
    //console.log(JSON.stringify(info, null, 4));
    const stat = fs.statSync(file);
    console.log();
    console.log(`File Information:`);
    console.log(`   Size:        ${pretty(stat.size)}`);
    console.log(`   Created:     ${stat.ctime.toLocaleString()}`);
    console.log(`   Last Mod:    ${stat.mtime.toLocaleString()}`);
    console.log(`   Last Access: ${stat.atime.toLocaleString()}`);
    console.log();
    const table = new Table();
    Object.values(info).forEach(i => {
        table.cell('Plate Name', `Plate ${i.plate}`);
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
    console.log(`Finished parsing in ${timer(START)}`);
    cb && cb();

};

module.exports = parse;

const colors = (c) => {
    if (Array.isArray(c)) {
        c.forEach((name, id) => {
            const color = chalk.bgHex(name)('  ');
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
    return info.join(', ');
};

const dedupe = (data) => {
    return data.filter((value, index) => {return data.indexOf(value) == index;});
};
