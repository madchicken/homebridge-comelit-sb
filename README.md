[![npm version](https://badge.fury.io/js/homebridge-comelit-sb-platform.svg)](https://badge.fury.io/js/homebridge-comelit-sb-platform)

# Comelit Serial Bridge integration for Homebridge

This is an Homebridge platform plugin to expose Comelit Serial Bridge Automation to Apple HomeKit and use it with Siri.
The code uses API exposed by the official Comelit WEB admin.

Currently supported devices:

- Simple lights
- Blinds
- Thermostats
- Controlled plugs
- Dehumidifiers (beta)

Missing devices:

- RGB lights
- Dimmerable lights
- Irrigation

## Configuration

To configure Comelit platform you need to provide some information in the configuration.
Add the following section to the platform array in the Homebridge config.json file:

```json
{
  "platform": "Comelit Serial Bridge",
  "name": "My awesome house",
  "bridge_url": "192.168.1.2",
  "bridge_port": 80
}
```

## Advanced configuration

The plugin configuration allows you to add some special parameter in the `advanced` section.

- `update_rate_sec` - the timeout in seconds to pull for device status from the bridge. Default is to update every 5 seconds
- `stop_blinds` - This flag tells to the plugin if it should send the stop signal after the shutter is completely rolled up or down. Some installations need it.
- `blind_closing_time` - If the `stop_blinds` flag is set to true, this will represent the number of seconds the plugin will send the stop signal to a blind/shutter. Default is 35 seconds.
- `avoid_duplicates` - If the flag is on, then the platform will try to not duplicate names for mapped devices. For example, if you have a light and a thermostat both named _kitchen_ one of them will get the name _kitchen (2)_.
  Useful when you are using Alexa plugin than doesn't allow name duplicates.

Example of advanced config:

```json
{
  "platform": "Comelit Serial Bridge",
  "bridge_url": "192.168.1.2",
  "bridge_port": 80,
  "advanced": {
    "update_rate_sec": 2,
    "stop_blinds": true,
    "blind_closing_time": 40,
    "avoid_duplicates": true
  }
}
```

## Version History

- 1.0.0 - Initial version
- 1.1.0 - Removed Vedo support (moved to separate plugin)
- 1.2.0 - Added dehumidifier support (beta)
- 1.2.1 - Bug fixing
- 1.2.2 - Do not map dehumidifier if not supported by the system

## Screenshots

![Home application screenshot](https://github.com/madchicken/homebridge-comelit-hub/raw/master/images/home.png)
