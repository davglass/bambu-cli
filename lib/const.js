
const INIT = [
    { "info": { "sequence_id": "0", "command": "get_version" } },
    { "pushing": { "sequence_id": "0", "command": "pushall" } }
];
module.exports.MQTT_INIT = INIT;

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
    "eng_plate":      "Engineering Plate",
    "hot_plate":      "Hot Plate", 
    "textured_plate": "Textured Plate"
};
module.exports.PLATES = PLATES;
