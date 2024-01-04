const path = require('path');
const fs = require('fs');

// From BambuStudio hms/hms_en.json

const HMS_ERRORS_FILE = path.join(__dirname, '../data/hms.json');

const HMS_ERRORS = {};
if (fs.existsSync(HMS_ERRORS_FILE)) {
    const json = require(HMS_ERRORS_FILE);
    json.data.device_hms.en.forEach(i => {
        HMS_ERRORS[i.ecode] = i.intro;
    });
}
module.exports.HMS_ERRORS = HMS_ERRORS;

const HMS_LEVELS = {
    '0': 'log', //Unknown
    '1': 'error', //Fatal
    '2': 'warn', //Serious
    '3': 'info', //Common
    '4': 'info' //Info
};
module.exports.HMS_LEVELS = HMS_LEVELS;

// From https://github.com/greghesp/ha-bambulab
const INIT = [
    { "info": { "sequence_id": "0", "command": "get_version" } },
    { "pushing": { "sequence_id": "0", "command": "pushall" } }
];
module.exports.MQTT_INIT = INIT;

// From https://github.com/greghesp/ha-bambulab
const FILAMENT_NAMES = {
    "default":   "Unknown",
    "GFB00":     "Bambu ABS",
    "GFB01":     "Bambu ASA",
    "GFN03":     "Bambu PA-CF",
    "GFN05":     "Bambu PA6-CF",
    "GFN04":     "Bambu PAHT-CF",
    "GFC00":     "Bambu PC",
    "GFT01":     "Bambu PET-CF",
    "GFG00":     "Bambu PETG Basic",
    "GFG50":     "Bambu PETG-CF",
    "GFA11":     "Bambu PLA Aero",
    "GFA00":     "Bambu PLA Basic",
    "GFA03":     "Bambu PLA Impact",
    "GFA07":     "Bambu PLA Marble",
    "GFA01":     "Bambu PLA Matte",
    "GFA02":     "Bambu PLA Metal",
    "GFA05":     "Bambu PLA Silk",
    "GFA08":     "Bambu PLA Sparkle",
    "GFA09":     "Bambu PLA Tough",
    "GFA50":     "Bambu PLA-CF",
    "GFS03":     "Bambu Support For PA/PET",
    "GFS02":     "Bambu Support For PLA",
    "GFS01":     "Bambu Support G",
    "GFS00":     "Bambu Support W",
    "GFU01":     "Bambu TPU 95A",
    "GFB99":     "Generic ABS",
    "GFB98":     "Generic ASA",
    "GFS98":     "Generic HIPS",
    "GFN98":     "Generic PA-CF",
    "GFN99":     "Generic PA",
    "GFC99":     "Generic PC",
    "GFG99":     "Generic PETG",
    "GFG98":     "Generic PETG-CF",
    "GFL99":     "Generic PLA",
    "GFL95":     "Generic PLA-High Speed",
    "GFL96":     "Generic PLA Silk",
    "GFL98":     "Generic PLA-CF",
    "GFS99":     "Generic PVA",
    "GFU99":     "Generic TPU",
    "GFL05":     "Overture Matte PLA",
    "GFL04":     "Overture PLA",
    "GFB60":     "PolyLite ABS",
    "GFB61":     "PolyLite ASA",
    "GFG60":     "PolyLite PETG",
    "GFL00":     "PolyLite PLA",
    "GFL01":     "PolyTerra PLA",
    "GFL03":     "eSUN PLA+",
    "GFSL99_01": "Generic PLA Silk",
    "GFSL99_12": "Generic PLA Silk"
};
module.exports.FILAMENT_NAMES = FILAMENT_NAMES;

const SPEEDS = {
    1: 'Silent',
    2: 'Normal',
    3: 'Sport',
    4: 'Ludicrous'
};
module.exports.SPEEDS = SPEEDS;


const PLATES = {
    "cool_plate":     "Cool Plate",
    "eng_plate":      "Eng Plate",
    "hot_plate":      "Hot Plate", 
    "textured_plate": "Text Plate"
};
module.exports.PLATES = PLATES;

const STAGES = {
    '-1': 'Idle',
    '0':  'Printing',
    '1':  'Auto bed leveling',
    '2':  'Heatbed preheating',
    '3':  'Sweeping XY mech mode',
    '4':  'Changing filament',
    '5':  'M400 pause',
    '6':  'Paused due to filament runout',
    '7':  'Heating hotend',
    '8':  'Calibrating extrusion',
    '9':  'Scanning bed surface',
    '10': 'Inspecting first layer',
    '11': 'Identifying build plate type',
    '12': 'Calibrating Micro Lidar',
    '13': 'Homing toolhead',
    '14': 'Cleaning nozzle tip',
    '15': 'Checking extruder temperature',
    '16': 'Printing was paused by the user',
    '17': 'Pause of front cover falling',
    '18': 'Calibrating the micro lida',
    '19': 'Calibrating extrusion flow',
    '20': 'Paused due to nozzle temperature malfunction',
    '21': 'Paused due to heat bed temperature malfunction',
    '22': 'Filament unloading',
    '23': 'Skip step pause',
    '24': 'Filament loading',
    '25': 'Motor noise calibration',
    '26': 'Paused due to AMS lost',
    '27': 'Paused due to low speed of the heat break fan',
    '28': 'Paused due to chamber temperature control error',
    '29': 'Cooling chamber',
    '30': 'Paused by the Gcode inserted by user',
    '31': 'Motor noise showoff',
    '32': 'Nozzle filament covered detected pause',
    '33': 'Cutter error pause',
    '34': 'First layer error pause',
    '35': 'Nozzle clog pause'
};
module.exports.STAGES = STAGES;
