const cfg = require('./config.js');
const Table = require('easy-table');
const login = require('../lib/login.js');

module.exports.machines = (args) => {
    const machines = cfg.get('machines');
    console.log(`Showing information about ${machines.length} machine(s)\n`);
    const table = new Table();
    machines.forEach((m) => {
        table.cell('ID', m.id);
        table.cell('Name', m.name);
        table.cell('IP Address', m.ip);
        table.cell('Access Code', m.token);
        table.newRow();
    });
    console.log(table.toString());
};

module.exports.ls = module.exports.machines;

module.exports.config = (args) => {
    const config = cfg.get();
    console.log(JSON.stringify(config, null, 4));
};

module.exports.login = (args) => {
    console.log(`Logging in to fetch devices.`);
    login.start();
};

module.exports.status = require('./status.js');
module.exports.files = require('./files.js');
module.exports.parse = require('./parse.js');

