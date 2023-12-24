#!/usr/bin/env node

const cfg = require('../lib/config.js');
const commands = require('../lib/commands.js');
let config = cfg.get();

const args = require('yargs')
    .scriptName("bambu-cli")
    .completion('completion', 'Generate completion script for your shell')
    .usage('$0 <cmd> [machine-id/name] [args]\n ex: $0 ls\n ex: $0 files [machine-id]\n ex: $0 status [machine-id]')
    .help('h')
    .alias('h', 'help')
    .alias('v', 'version')
    .describe('download', 'Download a file, optional set output path [--download=/foo]')
    .describe('delete', 'Delete a file, optional use --filter to limit to a single file')
    .describe('file', 'The file to work with')
    .describe('filter', 'Filter files by name')
    .describe('force', 'Skip the cache or force an operation')
    .describe('id', 'Pass a device id to limit to one')
    .describe('json', 'Print JSON output')
    .describe('keys', 'Alone shows all keys in message, pass a comma-sep list of keys to print')
    .describe('parse', 'Parse a 3mf file after download')
    .describe('upload', 'Upload a file [--upload=./foo.gcode.3mf]')
    .describe('yes', 'Auto select YES when prompted')
    .command('config', 'Show config (for bambu-farm)')
    .command('files', 'Show gcode files on machine [--id] [--filter] [--download] [--parse] [--delete] [--yes]')
    .command('login', 'Login and fetch machine information')
    .command('ls', 'Alias for machines')
    .command('machines', 'List current known machines')
    .command('mqtt', 'Show mqtt messages [--keys] [--json] (--json --keys ams,vt_tray)')
    .command('parse', 'Parse details from a .3mf file [--file] [--force]')
    //.command('print', 'Pass file name on printer to print [--file]')
    .command('status', 'Check machine connectivity [--id to get detailed info]')
    .command('timelapse', 'Show video files on machine [--id] [--filter] [--download] [--delete] [--yes]')
    .command('upload', 'Upload a .gcode or .gcode.3mf file [--id] [--upload]')
    .demandCommand(1, 'You need at least one command before moving on')
    .argv;

let cmd = args._[0];
let machine = args._[1];

//Machine alias resolving..
const machines = config.machines;
if (machine) {
    machine = String(machine);
    if (machines) {
        let m;
        machines.forEach((_m) => {
            ['id', 'name'].forEach(key => {
                if (_m[key].toLowerCase().indexOf(machine.toLowerCase()) > -1) {
                    if (!Array.isArray(m) && m) {
                        m = [m];
                        if (!m.includes(_m.id)) {
                            m.push(_m.id);
                        }
                    } else {
                        if (Array.isArray(m)) {
                            if (!m.includes(_m.id)) {
                                m.push(_m.id);
                            }
                        } else {
                            m = _m.id;
                        }
                    }
                }
            });
        });
        if (Array.isArray(m)) {
            console.error(`Found ${m.length} machines, please limit it more.`);
            console.error(m.join(', '));
            process.exit(1);
        } else if (m) {
            machine = m;
        }
    }
    args.id = machine;
}
if (!commands[cmd]) {
    let c;
    Object.keys(commands).forEach(_cmd => {
        if (_cmd.startsWith(cmd)) {
            if (!Array.isArray(c) && c) {
                c = [c];
                c.push(_cmd);
            } else {
                if (Array.isArray(c)) {
                    c.push(_cmd);
                } else {
                    c = _cmd;
                }
            }
        }
    });
    if (Array.isArray(c)) {
        console.error(`Found more than one command for ${cmd}`);
        console.error(c.join(', '));
        process.exit(1);
    } else if (c) {
        cmd = c;
    }
}

if (!machines) {
    cmd = 'login';
}

if (!commands[cmd]) {
    console.log(`Could not find command: ${cmd}`);
    process.exit(1);
}
commands[cmd](args);
