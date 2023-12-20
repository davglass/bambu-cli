const Table = require('easy-table');
const pretty = require('prettysize');
const path = require('path');
const ftp = require('basic-ftp');
const ProgressBar = require('progress');
const fs = require('fs');
const rl = require('readline-sync');
const timer = require('timethat').calc;

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

const deleteFiles = async(machine, list, dir) => {
    const start = new Date();
    const client = await makeClient(machine);
    console.log(`❌ Deleting ${list.length} remote file(s)`);
    for (const item of list) {
        const remote = `${dir}${item.file}`;
        console.log(`❌ Deleting file: ${remote}`);
        await deleteFile(client, remote);
    }
    await client.close();
    console.log(`Finished deleting ${list.length} file(s) in ${timer(start)}`);
};
module.exports.deleteFiles = deleteFiles;

const deleteFile = async(machine, remote) => {
    let client;
    let close = true;
    if (machine instanceof ftp.Client) {
        client = machine;
        close = false;
    } else {
        client = await makeClient(machine);
    }
    await client.remove(remote);
    if (remote.startsWith('/timelapse')) {
        let filename = remote.split('/')[2].replace('.mp4', '.jpg');
        filename = `/timelapse/thumbnail/${filename}`;
        console.log(`❌ Also deleting thumbnail file: ${filename}`);
        await client.remove(filename);
    }
    if (close) {
        await client.close();
    }
};
module.exports.deleteFile = deleteFile;

const downloadFiles = async(machine, list, dir, save) => {
    const start = new Date();
    const client = await makeClient(machine);
    let size = 0;
    let counter = 0;
    list.forEach(f => {
        size += f.size;
    });
    console.log(`🚀 Downloading ${list.length} file(s) from ${machine.id} (${pretty(size)})`);
    for (const item of list) {
        const remote = `${dir}${item.file}`;
        const local = path.join(save, item.file);
        //console.log(remote, local);
        if (fs.existsSync(local)) {
            const stat = fs.statSync(local);
            if (stat.size === item.size) {
                console.log(`⛔ Skipping ${item.file}, already downloaded (remote: ${pretty(item.size)}, local: ${pretty(stat.size)}).`);
                continue;
            }
        }
        counter++;
        await downloadFile(client, remote, local, item.size);
    }
    await client.close();
    console.log(`Finished downloading ${counter} file(s) in ${timer(start)}`);
};
module.exports.downloadFiles;

const downloadFile = async(machine, remote, local, size) => {
    // Yucky :(
    let client;
    let close = true;
    if (machine instanceof ftp.Client) {
        client = machine;
        close = false;
    } else {
        client = await makeClient(machine);
    }
    let trans = 0;
    console.log(`🚀 Downloading: ${remote.substr(1)} (${pretty(size)})`);
    const icon = (remote.startsWith('/timelapse')) ? '🎬' : '💾' ;
    const bar = new ProgressBar(`${icon} [:bar] :pcurrent of :ptotal :percent`, {
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
    if (close) {
        await client.close();
    }
};
module.exports.downloadFile = downloadFile;

const uploadFiles = async(machine, files) => {
    const client = await makeClient(machine);
    for (const item of files) {
        await uploadFile(client, item.file, item.size);
    }
    await client.close();
};
module.exports.uploadFiles = uploadFiles;

const uploadFile = async(machine, file, size) => {
    // Yucky :(
    let client;
    let close = true;
    if (machine instanceof ftp.Client) {
        client = machine;
        close = false;
    } else {
        client = await makeClient(machine);
    }
    const remote = `/${path.basename(file)}`;
    
    let trans = 0;
    console.log(`🚀 Uploading: ${remote.substr(1)} (${pretty(size)})`);
    const icon = '💾' ;
    const bar = new ProgressBar(`${icon} [:bar] :pcurrent of :ptotal :percent`, {
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
    await client.uploadFrom(file, remote);
    if (close) {
        await client.close();
    }
};

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
        console.error(`⛔ Failed to find machine: ${args.id}`);
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
    if (args.download) {
        if (args.download === true) {
            args.download = './';
        }
        args.download = path.resolve(args.download);
        if (!fs.existsSync(args.download)) {
            fs.mkdirSync(args.download, { recursive: true });
        }
        const stat = fs.statSync(args.download);
        if (!stat.isDirectory()) {
            console.error(`--download argument needs to be a directory, not a file!`);
            process.exit(1);
        }
        await downloadFiles(machine, list, dir, args.download);
        return cb({ downloaded: dir, remote: list });
    }
    if (args.delete) {
        if (!args.yes) {
            let confirm = rl.question(`Are you sure you want to delete ${list.length} file(s)? [y/N] `);
            if (!confirm) {
                confirm = 'n';
            }
            confirm = confirm.toLowerCase().substr(0, 1);
            if (confirm !== 'y') {
                console.error(`User didn't confirm deletion, bailing..`);
                process.exit(1);
            }
        }
        await deleteFiles(machine, list, dir);
        return;
    }
    cb({ table: table.toString(), count: count });
};
module.exports.tableView = tableView;
