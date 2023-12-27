const Table = require('easy-table');
const cfg = require('./config.js');
const logger = require('./logger.js');

module.exports = (args) => {
    const machines = cfg.get('machines');
    logger.log(`Showing information about ${machines.length} machine(s)\n`);
    const table = new Table();
    machines.forEach((m) => {
        table.cell('ID', m.id);
        table.cell('Name', m.name);
        table.cell('IP Address', m.ip);
        table.cell('Access Code', m.token);
        table.newRow();
    });
    logger.log(table.toString());
};

