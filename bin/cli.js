#!/usr/bin/env node

const cfg = require('../lib/config.js');
const login = require('../lib/login.js');
const commands = require('../lib/commands.js');
let config = cfg.get();

const args = require('yargs')
    .scriptName("bambu-cli")
    .completion('completion')
    .usage('$0 <cmd> [args] [machine-id]\nex: $0 ls [machine-id]\nex: $0 files [machine-id]\nex: $0 status [machine-id]')
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

if (cmd === 'ls') {
    cmd = 'machines';
}

if (machine) {
    args.id = machine;
}

if (cmd === 'files') {
    if (!args.id) {
        console.error(`Please pass machine id`);
        process.exit(1);
    }
}

//console.log(cmd, machine, args);

if (!config.machines || cmd === 'login') {
    if (cmd === 'login') {
        console.log(`Logging in to fetch devices.`);
    } else {
        console.log(`Could not find machines in config, please login to fetch them.`);
    }
    login.start();
} else {
    if (!commands[cmd]) {
        console.log(`Could not find command: ${cmd}`);
        process.exit(1);
    }
    commands[cmd](args);
}
