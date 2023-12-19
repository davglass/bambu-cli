const Table = require('easy-table');
const pretty = require('prettysize');
const path = require('path');
const ftp = require('basic-ftp');
const ProgressBar = require('progress');
const os = require('os');
const rl = require('readline-sync');

const makeClient = async(machine) => {
    if (!machine) {
        throw('No machine passed to makeFTPClient');
    }
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
    } catch (e) {
        console.log(e);
    }
    return client;
};
module.exports.makeClient = makeClient;


const deleteFile = async(machine, remote) => {
    const client = await makeClient(machine);
    await client.remove(remote);
    await client.close();
};
module.exports.deleteFile = deleteFile;

const downloadFile = async(machine, remote, local, size) => {
    const client = await makeClient(machine);
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
    await client.downloadTo(local, remote);
    await client.close();
};
module.exports.downloadFile = downloadFile;

const listFTP = async(machine, dir) => {
    dir = dir || '/';
    const client = await makeClient(machine);
    const list = await client.list(dir);
    await client.close();
    return list;
};
module.exports.list = listFTP;

const tableView = async(machine, dir, typeCheck, args, cb) => {
    dir = dir || '/';
    //console.log(args);
    let filter = args.filter;
    if (filter === true) {
        filter = null;
    }
    if (!dir.endsWith('/')) {
        dir += '/';
    }
    if (!machine) {
        console.error(`Failed to find machine: ${args.id}`);
        process.exit(2);
    }
    //console.log(`Fetching files for ${args.id}`);
    const files = await listFTP(machine, dir);
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
        //if (f.name.indexOf('.gcode') > -1 && !f.name.startsWith('.')) {
        if (typeCheck(f.name)) {
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
    if (count === 1 && (args.download || args.parse || args.delete)) {
        if (args.download === true) {
            args.download = './';
        }
        if (args.parse) {
            args.download = os.tmpdir();
        }
        const remote = `${dir}${list[0].file}`;
        //console.log('remote:', remote);
        //console.log('local:', local);
        if (args.delete) {
            if (!args.yes) {
                let confirm = rl.question(`Are you sure you want to delete ${list[0].file}? [y/N] `);
                if (!confirm) {
                    confirm = 'n';
                }
                confirm = confirm.toLowerCase().substr(0, 1);
                if (confirm !== 'y') {
                    console.error(`User didn't confirm deletion, bailing..`);
                    process.exit(1);
                }
            }
            console.log(`Deleting file: ${remote}`);
            await deleteFile(machine, remote);
            console.log(`Remote file deleted`);
            return;
        }
        console.log(`Downloading `, list[0].file, 'to', args.download);
        const local = path.resolve(args.download, list[0].file);
        await downloadFile(machine, remote, local, list[0].size);
        cb({ downloaded: local, remote: remote });
    } else {
        cb({ table: table.toString(), count: count });
    }
};
module.exports.tableView = tableView;
