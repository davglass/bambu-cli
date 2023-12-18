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
    .describe('file', 'The file to work with')
    .describe('filter', 'Filter files by name')
    .describe('id', 'Pass a device id to limit to one')
    .describe('parse', 'Parse a 3mf file after download')
    .command('config', 'Show config (for bambu-farm)')
    .command('files', 'Show files on machine [--id] [--filter] [--download] [--parse]')
    .command('login', 'Login and fetch machine information')
    .command('ls', 'Alias for machines')
    .command('machines', 'List current known machines')
    .command('parse', 'Parse details from a .3mf file [--file]')
    .command('status', 'Check machine connectivity [--id to get detailed info]')
    .demandCommand(1, 'You need at least one command before moving on')
    .argv;

let cmd = args._[0];
let machine = args._[1];

//Machine alias resolving..
const machines = config.machines;
if (machine) {
    if (machines) {
        let m;
        machines.forEach((_m) => {
            ['id', 'name'].forEach(key => {
                if (_m[key].toLowerCase().indexOf(machine.toLowerCase()) > -1) {
                    if (m) {
                        m = [m];
                    } else {
                        if (Array.isArray(m)) {
                            m.push(_m.id);
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

if (cmd === 'files') {
    if (!args.id) {
        console.error(`Please pass machine id`);
        process.exit(1);
    }
}

//console.log(cmd, machine, args);

if (!commands[cmd]) {
    console.log(`Could not find command: ${cmd}`);
    process.exit(1);
}
commands[cmd](args);
