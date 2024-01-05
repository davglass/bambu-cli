module.exports.config = require('./config.js');
module.exports.login = require('./login.js');
module.exports.status = require('./status.js');
module.exports.files = require('./files.js');
module.exports.timelapse = require('./timelapse.js');
module.exports.parse = require('./parse.js');
module.exports.upload = require('./upload.js');
module.exports.machines = require('./machines.js');
module.exports.print = require('./print.js');
module.exports.mqtt = require('./mqtt.js');

module.exports['set-ip'] = require('./mip.js');

module.exports.ls = module.exports.machines; //Alias for machines
