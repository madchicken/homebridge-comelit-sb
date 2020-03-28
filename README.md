[![npm version](https://badge.fury.io/js/homebridge-comelit-sb.svg)](https://badge.fury.io/js/homebridge-comelit-sb)

# Comelit Serial Bridge integration for Homebridge

This is an Homebridge platform plugin to expose Comelit Serial Bridge Automation to Apple HomeKit and use it with Siri.
The code uses API exposed by the official Comelit WEB admin.

Currently supported devices:

- Simple lights
- Blinds
- Thermostats
- Controlled plugs
- Vedo Alarm

Missing devices:

- Dehumidifiers
- RGB lights
- Dimmerable lights
- Irrigation

## Configuration

To configure Comelit platform you need to provide some information in the configuration.
Add the following section to the platform array in the Homebridge config.json file:

```json
{
  "platform": "Comelit",
  "name": "My Home",
  "bridge-url": "192.168.1.2"
}
```

## VEDO alarm support

VEDO alarm is currently supported if enabled. This plugin will check with the HUB if you have it and then it will automatically
map it as new accessory in HomeKit. Be aware to provide an alarm code in the config, otherwise the plugin won't be able
to mount the accessory.

```json
{
  "platform": "Comelit",
  "name": "My Home",
  "alarm_code": "12345678",
  "alarm_address": "192.168.1.3"
}
```

You can temporary disable alarm by adding `disable_alarm: true` in your config.

## Version History

1.0.0 - Initial version

## Screenshots

![Home application screenshot](https://github.com/madchicken/homebridge-comelit-hub/raw/master/images/home.png)
