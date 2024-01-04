#!/usr/bin/env node

/*
This file pulls the latest HMS errors file and stores it
for use when checking MQTT data.
*/

const fs = require('fs');
const path = require('path');
const https = require('https');
const { parse } = require('url');
const pretty = require('prettysize');

const BASE = `https://e.bambulab.com/query.php?lang=en`;

const OUT = path.join(__dirname, '../data/hms.json');

const u = parse(BASE);

u.headers = {
    'user-agent': 'bambu-cli'
};

const req = https.get(u, (res) => {
    const status = res.statusCode;
    let data = '';
    res.on('data', d => {return data += d;});
    res.on('end', () => {
        if (status !== 200) {
            console.error(`Failed to fetch JSON data, status: ${status}`);
            return;
        }
        try {
            const json = JSON.parse(data);
            fs.writeFileSync(OUT, JSON.stringify(json, null, 4) + '\n', 'utf8');
            const stat = fs.statSync(OUT);
            console.log(`Fetched latest HMS error JSON, saved to file: ${pretty(stat.size)}`);
        } catch (e) {
            console.error(`Failed to parse JSON`);
            console.error(e);
        }
    });
});

req.on('error', (e) => {
    console.error(`Failed to fetch HMS data.`);
    console.error(e);
});
