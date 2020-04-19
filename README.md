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
  "bridge_url": "192.168.1.2",
  "bridge_port": 80
}
```

## Advanced configuration

The plugin configurationallows you to add some special parameter in the `advanced` section.

- `update_rate_sec` - the timeout in seconds to pull for device status from the bridge. Default is to update every 5 seconds
- `blind_closing_time` - Number of seconds a blind/shutter will use to go from completely open to completely closed. Default is 35 seconds.
  This value is used to send the close/open command to the blind to stop it after a complete roll up/down.

```json
{
  "platform": "Comelit Serial Bridge",
  "bridge_url": "192.168.1.2",
  "bridge_port": 80,
  "advanced": {
    "update_rate_sec": 2,
    "blind_closing_time": 40
  }
}
```

## Version History

- 1.0.0 - Initial version
- 1.1.0 - Removed Vedo support (moved to separate plugin)
- 1.2.0 - Added dehumidifier support (beta)

## Screenshots

![Home application screenshot](https://github.com/madchicken/homebridge-comelit-hub/raw/master/images/home.png)
