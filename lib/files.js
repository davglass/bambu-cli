const Table = require('easy-table');
const ftp = require('basic-ftp');
const pretty = require('prettysize');
const path = require('path');
const ProgressBar = require('progress');
const os = require('os');
const fs = require('fs');

const parse = require('./parse.js');

const cfg = require('./config.js');

module.exports = async(args) => {
    //console.log(args);
    let filter = args.filter;
    if (filter === true) {
        filter = null;
    }
    const machines = cfg.get('machines');
    let machine;
    machines.forEach(_m => {
        if (_m.id === args.id) {
            machine = _m;
        }
    });
    if (!machine) {
        console.error(`Failed to find machine: ${args.id}`);
        process.exit(2);
    }
    //console.log(`Fetching files for ${args.id}`);
    const files = await listFTP(machine, '/');
    const table = new Table();
    files.sort((a, b) => {
        const file1 = a.name.toLowerCase();
        const file2 = b.name.toLowerCase();
        if (file1 > file2) {
            return 1;
        }
        return -1;
    });
    const list = [];
    let count = 0;
    files.forEach((f) => {
        if (f.name.indexOf('.gcode') > -1 && !f.name.startsWith('.')) {
            if (filter) {
                if (f.name.toLowerCase().indexOf(filter.toLowerCase()) === -1) {
                    return;
                }
            }
            count++;
            list.push({ file: f.name, size: f.size });
            table.cell('Name', f.name);
            table.cell('Date', f.rawModifiedAt);
            table.cell('Size', f.size, (s) => { return pretty(s); });
            table.newRow();
        }
    });
    table.total('Name', {
        printer: Table.aggr.printer('# of Files: ', () => { return count; }),
        init:    0
    });
    table.total('Size', {
        printer: Table.aggr.printer('Total: ', pretty),
        init:    0
    });
    if (count === 1 && (args.download || args.parse)) {
        if (args.download === true) {
            args.download = './';
        }
        if (args.parse) {
            args.download = os.tmpdir();
        }
        const remote = `/${list[0].file}`;
        const local = path.resolve(args.download, list[0].file);
        console.log(`Downloading `, list[0].file, 'to', args.download);
        //console.log('remote:', remote);
        //console.log('local:', local);
        await downloadFile(machine, remote, local, list[0].size);
        if (args.parse) {
            console.log();
            parse({
                file: local
            }, () => {
                console.log(`Cleaing up tmpfile:`, local);
                fs.rmSync(local);
            });
        }
    } else {
        console.log(table.toString());
    }
};

const downloadFile = async(machine, remote, local, size) => {
    const client = new ftp.Client();
    let trans = 0;
    const bar = new ProgressBar(' downloading [:bar] :pcurrent of :ptotal :percent :etas', {
        complete:   '=',
        incomplete: ' ',
        width:      100,
        total:      size
    });

    client.trackProgress(info => {
        let bytes = info.bytes;
        if (bytes === 0) {
            return;
        }
        bar.tick(bytes - trans, {
            pcurrent: pretty(bytes).replace(' ', ''),
            ptotal:   pretty(size).replace(' ', '')
        });
        trans = bytes;
    });
    const secureOptions = {
        checkServerIdentity: () => { return null; },
        rejectUnauthorized:  false //Needed for the Self Signed Cert
    };
    try {
        await client.access({
            host:          machine.ip,
            user:          'bblp',
            password:      machine.token,
            port:          990,
            secure:        'implicit',
            secureOptions: secureOptions
        });
        await client.downloadTo(local, remote);
        await client.close();
    } catch (e) {
        return false;
    }
};

const listFTP = async(machine, dir) => {
    const client = new ftp.Client();
    const secureOptions = {
        checkServerIdentity: () => { return null; },
        rejectUnauthorized:  false //Needed for the Self Signed Cert
    };
    try {
        await client.access({
            host:          machine.ip,
            user:          'bblp',
            password:      machine.token,
            port:          990,
            secure:        'implicit',
            secureOptions: secureOptions
        });
        const list = await client.list(dir);
        await client.close();
        return list;
    } catch (e) {
        return [];
    }
};
