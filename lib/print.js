const cfg = require('./config.js');
const mqtt = require('mqtt');
const status = require('./status.js');
const logger = require('./logger.js');

module.exports = (args) => {
    const machine = cfg.getMachine(args.id);
    
    if (!machine) {
        logger.error(`Failed to find machine: ${args.id}`);
        process.exit(2);
    }

    if (!args.file || args.file === true) {
        logger.error(`Please pass a file to start the print with. It needs to be uploaded first!`);
        process.exit(1);
    }
    let remote = args.file;
    if (remote.startsWith('/')) {
        remote = remote.substr(1);
    }
    logger.log(`Sending print command to ${machine.id}`);
    const BASE = `mqtts://${machine.ip}:8883`;
    const client = mqtt.connect(BASE, {
        username:           'bblp',
        password:           machine.token,
        rejectUnauthorized: false,
        clientId:           `bambu-cli`
    });

    client.on('error', () => {
        client.end();
    });
    
    client.on("connect", (e) => {
        const print = {
            "print": {
                "sequence_id":    "0",
                "command":        "project_file",
                "param":          `Metadata/plate_1.gcode`, //TODO Figure out if the file has more than one plate and pick it
                "project_id":     "0",
                "profile_id":     "0",
                "task_id":        "0",
                "subtask_id":     "0",
                "subtask_name":   remote.replace('.3mf', '').replace('.gcode', ''),
                "url":            `ftp:///${remote}`, //In theory, this can be a folder??
                "timelapse":      true,
                "bed_type":       "auto",
                "bed_levelling":  true,
                "flow_cali":      true,
                "vibration_cali": true,
                "layer_inspect":  true,
                "use_ams":        true,
                //"ams_mapping": [ 7, 3 ] //Black & White (Red Skull)
                //"ams_mapping": [ 0, 5 ] //Red & Brown (Red Skull)
                //"ams_mapping":    [5, 2] //Gray & White (Gray Skull)
                "ams_mapping":    [7, 2] //Purple & White (Gray Skull)
            }
        };
        logger.log(print);
        client.publish(`device/${machine.id}/request`, JSON.stringify(print));
        client.end();
        setTimeout(() => {
            logger.log(`Finished sending job to ${machine.id}, use status to check on it.`);
            status({});
        }, 1000);
    });
};
