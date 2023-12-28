#!/usr/bin/env node

const cfg = require('../lib/config.js');
const commands = require('../lib/commands.js');
const logger = require('../lib/logger.js');
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
    .boolean('delete')
    .describe('file', 'The file to work with')
    .describe('filter', 'Filter files by name')
    .describe('force', 'Skip the cache or force an operation')
    .boolean('force')
    .describe('id', 'Pass a device id to limit to one')
    .describe('json', 'Print JSON output')
    .boolean('json')
    .describe('keys', 'Alone shows all keys in message, pass a comma-sep list of keys to print')
    .describe('path', 'JSONPath for limiting MQTT results')
    .describe('parse', 'Parse a 3mf file after download')
    .boolean('parse')
    .describe('redact', 'Redact private info from logs (for screenshots)')
    .boolean('redact')
    .describe('set', 'For config, key to set')
    .describe('slim', 'Limit fields on status')
    .boolean('slim')
    .describe('upload', 'Upload a file [--upload=./foo.gcode.3mf]')
    .describe('value', 'For config, value to set with --key')
    .describe('yes', 'Auto select YES when prompted')
    .boolean('yes')
    .command('config', 'Show config (for bambu-farm) [--set foo --value bar]')
    .command('files', 'Show gcode files on machine [--id] [--filter] [--download] [--parse] [--delete] [--yes]')
    .command('login', 'Login and fetch machine information')
    .command('ls', 'Alias for machines')
    .command('machines', 'List current known machines')
    .command('mqtt', 'Show mqtt messages [--keys] [--json] [--path] (--json --keys ams,vt_tray) [--path $..ams.ams[0].tray[0]]')
    .command('parse', 'Parse details from a .3mf file [--file] [--force]')
    //.command('print', 'Pass file name on printer to print [--file]')
    .command('status', 'Check machine connectivity [--id to get detailed info] [--slim]')
    .command('timelapse', 'Show video files on machine [--id] [--filter] [--download] [--delete] [--yes]')
    .command('upload', 'Upload a .gcode or .gcode.3mf file [--id] [--upload]')
    .demandCommand(1, 'You need at least one command before moving on')
    .argv;

let cmd = args._[0];
let machine = args._[1];

if (args.slim) {
    args.slim = cfg.fixValue(args.slim);
}

if (config.slim && !('slim' in args)) { //TODO make this more dynamic
    args.slim = config.slim;
}

if (args.redact) {
    logger.REDACT = true;
}

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
            logger.error(`Found ${m.length} machines, please limit it more.`);
            logger.error(m.join(', '));
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
        logger.error(`Found more than one command for ${cmd}`);
        logger.error(c.join(', '));
        process.exit(1);
    } else if (c) {
        cmd = c;
    }
}

if (!machines) {
    cmd = 'login';
}

if (!commands[cmd]) {
    logger.error(`Could not find command: ${cmd}`);
    process.exit(1);
}
commands[cmd](args);
