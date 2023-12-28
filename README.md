# bambu-cli

[![npm version](https://badge.fury.io/js/bambu-cli.svg)](https://badge.fury.io/js/bambu-cli) [![Release Build](https://github.com/davglass/bambu-cli/actions/workflows/release.yml/badge.svg)](https://github.com/davglass/bambu-cli/actions/workflows/release.yml)

A simple CLI tool for BambuLab printers. Currently only tested with a pair of X1C's each with 2 AMS's.

## TODO

* ~~Add shortcuts~~
  * ~~Pass a partial machine name~~
  * ~~Pass a partial device id~~
  * ~~Truncate the comands:~~
    * ~~cli con (`bambu-cli config`)~~
    * ~~cli s (`bambu-cli status`)~~
    * ~~cli f xxx (`bambu-cli files [DEVICE ID]`)~~
    * ~~cli f 012 (`bambu-cli files [DEVICE ID]`)~~
* ~~Upload files to the ftp server~~.
* ~~Redact logging personal info for easier screenshots~~
* Run a background task that auto updates the config for filament type/color
* Trigger a print job from a file on the sdcard.
  * And choose a plate if file has more than one
  * Let the user override the filament type/color from AMS selection
* Test offline printers (mine are usually running).
* Get tests against other printer types (A1 & P1 series).
* Build a queue that would:
  * ~~Parse the file~~
  * ~~Know the colors needed~~
  * ~~Know which printer has the proper filament type/color~~
  * Know which printer is free
  * Send the file to the printer that is free and has the right filament type/color

## Installation

You need to have [Node.js](https://nodejs.org/en) installed and working on your computer. Use the LTS version.

    npm -g i bambu-cli

## Usage

The CLI startup will ask you to log into Bambu's main website to get a token and use that to gather machine info.
That is the only time the CLI will talk to the cloud, all other interactions are local between you and the printer.

It talks to the cloud to pull the list of devices you have bound to your account. Then it will attempt to listen to
the global MQTT server to get data from these devices (local IP). It then only saves that info locally so we can
talk to the printers over your local network.

## Login

`bambu-cli login` forces a login to refresh machine info.

## Config

`bambu-cli config` can be used with my other tool [Bambu Farm](https://github.com/davglass/bambu-farm)

    bambu-cli config
    {
        "username": "",
        "mqtt_user": "",
        "machines": [
            {
                "id": "",
                "name": "",
                "token": "",
                "ip": "",
                "model": "BL-P001",
                "make": "X1 Carbon"
            },
            {
                "id": "",
                "name": "",
                "token": "",
                "ip": "",
                "model": "BL-P001",
                "make": "X1 Carbon"
            }
        ]
    }

## Machines

This will list the machines known by the cli tool.

`bambi-cli machines/ls`

    bambu-cli ls
    Showing information about 2 machine(s)

    ID               Name        IP Address  Access Code
    ---------------  ----------  ----------  -----------
    [DEVICE ID]      [NAME]      [IP ADDR]   [ACCESS CODE]
    [DEVICE ID]      [NAME]      [IP ADDR]   [ACCESS CODE]

## Status

Shows status of all printers, or detailed status of a selected printer

    bambu-cli status
    Checking connectivity for 2 machine(s)

    ID               Name        IP Address  FTP  MQTT  AMS  Nozzle  Printing  Task               Percent  Remaining  Speed 
    ---------------  ----------  ----------  ---  ----  ---  ------  --------  -----------------  -------  ---------  ------
    [DEVICE ID]      [NAME]      [IP ADDR]   ✔    ✔     A,B  0.4     RUNNING   Surpise Box Batch  22%      1hour,54m  Normal
    [DEVICE ID]      [NAME]      [IP ADDR]   ✔    ✔     A,B  0.4     RUNNING   Surpise Box Batch  54%      31m        Normal


    bambu-cli status [DEVICE ID]
    Checking connectivity for 1 machine(s)

    ID               Name        IP Address  FTP  MQTT  AMS  Nozzle  Printing  Task               Percent  Remaining  Speed 
    ---------------  ----------  ----------  ---  ----  ---  ------  --------  -----------------  -------  ---------  ------
    [DEVICE ID]      [NAME]      [IP ADDR]   ✔    ✔     A,B  0.4     RUNNING   Surpise Box Batch  22%      1hour,54m  Normal

<img src="https://github.com/davglass/bambu-cli/blob/main/docs/status.png?raw=true">

## Files

Shows all .gcode/.3mf files on the local `ftp` server of the selected printer.

    bambu-cli files [DEVICE ID]
    Name                                             Date          Size           
    -----------------------------------------------  ------------  ---------------
    1-DL-44 Blaster_Black.gcode.3mf                  Dec 02 01:21  5.4 MB         
    2 Jon MK85.gcode.3mf                             Dec 15 13:35  47.2 MB        
    2-DL-44 Blaster_Black.gcode.3mf                  Dec 02 01:23  6.6 MB         
    3DBenchy.gcode.3mf                               Oct 26 14:27  2.8 MB         
    Alien-Keychain v1_plate_2.gcode.3mf              Nov 05 19:20  1.9 MB
    ...........
    Untitled14.gcode.3mf                             Nov 05 15:11  122.3 kB       
    -----------------------------------------------  ------------  ---------------
                                     # of Files: 43                Total: 528.4 MB

Add `--filter=<foo>` to limit the output. You can also pass `--download` to download all of the files shown from
the `ftp` server to your local machine. Replacing `--download` with `--parse` will parse meta data from the file. Using
`--delete` will delete the shown files.

    bambu-cli files [DEVICE ID] --filter "DL-44 Blaster.gco"
    Name                     Date          Size          
    -----------------------  ------------  --------------
    DL-44 Blaster.gcode.3mf  Dec 01 19:56  33.9 MB       
    -----------------------  ------------  --------------
              # of Files: 1                Total: 33.9 MB

    bambu-cli files [DEVICE ID] --filter "DL-44 Blaster.gco" --download
    Downloading  DL-44 Blaster.gcode.3mf to ./
     downloading [====================================================================] 33.9MB of 33.9MB 100% 0.0s


## Timelapse

Same as `files` except it shows the timelapse videos and allows you to download them the same way. `--delete` will also delete the remote files.

## Parse

This will parse a local `.gcode.3mf` file and show some details about it. Just added checking filaments against currently known printers and reporting which one a plate can be sent to.

<img src="https://github.com/davglass/bambu-cli/blob/main/docs/parser.png?raw=true">
<img src="https://github.com/davglass/bambu-cli/blob/main/docs/parser2.png?raw=true">


## Upload

    bambu-cli upload [DEVICE ID] --upload ./test-upload-multicolor.gcode.3mf 
    🚀 Uploading 1 file(s) to [DEVICE ID].
    🚀 Uploading: test-upload-multicolor.gcode.3mf (54 kB)
    💾 [====================================================================================================] 54kB of 54kB 100%


## MQTT

This command is used for debugging MQTT traffic:

    bambu-cli mqtt --json //Prints all messages
    bambu-cli mqtt --json --keys //Prints the top level "keys"
    bambu-cli mqtt --json --keys ams //Prints only the `ams` key
    bambu-cli mq --path $..ams.ams[0].tray //Prints AMS 1 `tray` Array
    bambu-cli mq --path $..ams.ams[0].tray[1] //Prints AMS 1 `tray` at index 1 

Supports [JSONPath](https://github.com/dchester/jsonpath#jsonpath-syntax) for filtering with `--path`

## Full Help

    bambu-cli <cmd> [machine-id/name] [args]
    ex: bambu-cli ls
    ex: bambu-cli files [machine-id]
    ex: bambu-cli status [machine-id]

    Commands:
      bambu-cli completion  Generate completion script for your shell
      bambu-cli config      Show config (for bambu-farm) [--set foo --value bar]
      bambu-cli files       Show gcode files on machine [--id] [--filter]
                            [--download] [--parse] [--delete] [--yes]
      bambu-cli login       Login and fetch machine information
      bambu-cli ls          Alias for machines
      bambu-cli machines    List current known machines
      bambu-cli mqtt        Show mqtt messages [--keys] [--json] (--json --keys
                            ams,vt_tray)
      bambu-cli parse       Parse details from a .3mf file [--file] [--force]
      bambu-cli status      Check machine connectivity [--id to get detailed info]
                            [--slim]
      bambu-cli timelapse   Show video files on machine [--id] [--filter]
                            [--download] [--delete] [--yes]
      bambu-cli upload      Upload a .gcode or .gcode.3mf file [--id] [--upload]

    Options:
      -h, --help      Show help                                            [boolean]
          --download  Download a file, optional set output path [--download=/foo]
          --delete    Delete a file, optional use --filter to limit to a single file
          --file      The file to work with
          --filter    Filter files by name
          --force     Skip the cache or force an operation
          --id        Pass a device id to limit to one
          --json      Print JSON output
          --keys      Alone shows all keys in message, pass a comma-sep list of keys
                      to print
          --parse     Parse a 3mf file after download
          --set       For config, key to set
          --slim      Limit fields on status
          --upload    Upload a file [--upload=./foo.gcode.3mf]
          --value     For config, value to set with --key
          --yes       Auto select YES when prompted
      -v, --version   Show version number                                  [boolean]

## Shoutouts

Thanks to these other open source projects for helping me figure some things out:

* [Doridian/OpenBambuAPI](https://github.com/Doridian/OpenBambuAPI)
* [greghesp/ha-bambulab](https://github.com/greghesp/ha-bambulab)
* [bambulab/BambuStudio](https://github.com/bambulab/BambuStudio)
