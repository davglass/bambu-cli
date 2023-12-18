# bambu-cli

A simple CLI tool for BambuLab printers. Currently only tested with a pair of X1C's each with 2 AMS's.

## TODO

* Upload files to the ftp server
* Trigger a printjob from a file on the sdcard.
* Build a queue that would:
  * Parse the file
  * Know the colors needed
  * Know which printer is free
  * Send the file to the printer that is free and has the right colors

## Installation

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

<img src="docs/status.png?raw=true" width="300">

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

Add `--filter=<foo>` to limit the output. You can also pass `--download` to download the single file from
the `ftp` server to your local machine. Replacing `--download` with `--parse` will parse meta data from the file

    bambu-cli files [DEVICE ID] --filter "DL-44 Blaster.gco"
    Name                     Date          Size          
    -----------------------  ------------  --------------
    DL-44 Blaster.gcode.3mf  Dec 01 19:56  33.9 MB       
    -----------------------  ------------  --------------
              # of Files: 1                Total: 33.9 MB

    bambu-cli files [DEVICE ID] --filter "DL-44 Blaster.gco" --download
    Downloading  DL-44 Blaster.gcode.3mf to ./
     downloading [====================================================================] 33.9MB of 33.9MB 100% 0.0s

    bambu-cli files [DEVICE ID] --filter "DL-44 Blaster.gco" --parse
    Downloading  DL-44 Blaster.gcode.3mf to /var/folders/3f/l51wfms16l3c5zbtgzv95q_80000gn/T
     downloading [====================================================================] 33.9MB of 33.9MB 100% 0.0s

    Attempting to parse: /var/folders/3f/l51wfms16l3c5zbtgzv95q_80000gn/T/DL-44 Blaster.gcode.3mf

    File Information:
       Size:        33.9 MB
       Created:     12/18/2023, 8:52:26 AM
       Last Mod:    12/18/2023, 8:52:26 AM
       Last Access: 12/18/2023, 8:52:26 AM

    Plate Name  Bed Type        Nozzle  Filament Colors         Filaments   Fil Used (m)  Fil Used (g)   GCode Lines  Estimated Time
    ----------  --------------  ------  ----------------------  ----------  ------------  -------------  -----------  --------------
    Plate 1     Textured Plate  0.4        #000000              PLA         12.15         38.57          547,215      2h 45m 14s    
    Plate 2     Textured Plate  0.4        #000000,    #FFFFFF  PLA, PLA-S  24.82, 1.19   78.79, 3.74    1,056,541    6h 32m 8s     
    Plate 3     Textured Plate  0.4        #D3B7A7,    #FFFFFF  PLA, PLA-S  10.52, 0.11   33.41, 0.35    642,166      2h 25m 6s     
    Plate 4     Textured Plate  0.4        #D3B7A7,    #FFFFFF  PLA, PLA-S  2.07, 0.10    6.56, 0.31     164,146      34m 10s       
    Plate 5     Textured Plate  0.4        #9B9EA0              PLA         6.31          20.03          745,572      2h 27m 42s    
    Plate 6     Textured Plate  0.4        #000000              PLA         9.00          28.56          680,367      3h 19m 21s    
    Plate 7     Textured Plate  0.4        #000000,    #FFFFFF  PLA, PLA-S  44.75, 9.45   142.09, 29.55  1,682,337    13h 39m 14s   

    Cleaing up tmpfile: /var/folders/3f/l51wfms16l3c5zbtgzv95q_80000gn/T/DL-44 Blaster.gcode.3mf

## Full Help

    bambu-cli <cmd> [args] [machine-id]
    ex: bambu-cli ls [machine-id]
    ex: bambu-cli files [machine-id]
    ex: bambu-cli status [machine-id]

    Commands:
      bambu-cli completion  generate completion script
      bambu-cli config      Show config (for bambu-farm)
      bambu-cli files       Show files on machine [--id] [--filter] [--download]
                            [--parse]
      bambu-cli login       Login and fetch machine information
      bambu-cli ls          Alias for machines
      bambu-cli machines    List current known machines
      bambu-cli parse       Parse details from a .3mf file [--file]
      bambu-cli status      Check machine connectivity [--id to get detailed info]

    Options:
      -h, --help      Show help                                            [boolean]
          --download  Download a file, optional set output path [--download=/foo]
          --file      The file to work with
          --filter    Filter files by name
          --id        Pass a device id to limit to one
          --parse     Parse a 3mf file after download
      -v, --version   Show version number                                  [boolean]

## Shoutouts

Thanks to these other open source projects for helping me figure some things out:

* [Doridian/OpenBambuAPI](https://github.com/Doridian/OpenBambuAPI)
* [greghesp/ha-bambulab](https://github.com/greghesp/ha-bambulab)
* [bambulab/BambuStudio](https://github.com/bambulab/BambuStudio)
