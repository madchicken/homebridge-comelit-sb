import { ComelitAccessory } from './comelit';
import {
  ClimaMode,
  ClimaOnOff,
  ComelitSbClient,
  ThermoSeason,
  ThermostatDeviceData,
} from 'comelit-client';
import { ComelitSbPlatform } from '../comelit-sb-platform';
import { CharacteristicEventTypes, PlatformAccessory, Service, VoidCallback } from 'homebridge';
import { TargetHeatingCoolingState, TemperatureDisplayUnits } from './hap';

export class Thermostat extends ComelitAccessory<ThermostatDeviceData> {
  private thermostatService: Service;

  constructor(platform: ComelitSbPlatform, accessory: PlatformAccessory, client: ComelitSbClient) {
    super(platform, accessory, client);
  }

  protected initServices(): Service[] {
    const accessoryInformation = this.initAccessoryInformation();

    this.thermostatService =
      this.accessory.getService(this.platform.Service.Thermostat) ||
      this.accessory.addService(this.platform.Service.Thermostat);
    this.update(this.device);

    this.thermostatService
      .getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .on(CharacteristicEventTypes.SET, async (temperature: number, callback: VoidCallback) => {
        try {
          const currentTemperature = this.thermostatService.getCharacteristic(
            this.platform.Characteristic.TargetTemperature
          ).value;
          const normalizedTemp = temperature * 10;
          if (currentTemperature !== temperature) {
            await this.client.setTemperature(parseInt(this.device.objectId), normalizedTemp);
            this.device.temperatura = `${normalizedTemp}`;
          }
          callback();
        } catch (e) {
          callback(e);
        }
      });

    this.thermostatService
      .getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .on(CharacteristicEventTypes.SET, async (state: number, callback: VoidCallback) => {
        const currentState = this.thermostatService.getCharacteristic(
          this.platform.Characteristic.TargetHeatingCoolingState
        ).value;
        try {
          if (currentState !== state) {
            this.log.info(`Modifying state of ${this.accessory.displayName} to ${state}`);
            if (currentState === TargetHeatingCoolingState.OFF) {
              // before doing anything, we need to turn on the thermostat
              await this.client.toggleThermostatStatus(
                parseInt(this.device.objectId),
                ClimaOnOff.ON_THERMO
              );
            }

            if (
              currentState === TargetHeatingCoolingState.AUTO &&
              state !== TargetHeatingCoolingState.OFF
            ) {
              // if in AUTO mode, switch to MANUAL here
              await this.client.switchThermostatMode(
                parseInt(this.device.objectId),
                ClimaMode.MANUAL
              );
            }

            switch (state) {
              case TargetHeatingCoolingState.AUTO:
                await this.client.switchThermostatMode(
                  parseInt(this.device.objectId),
                  ClimaMode.AUTO
                );
                break;
              case TargetHeatingCoolingState.COOL:
                await this.client.switchThermostatSeason(
                  parseInt(this.device.objectId),
                  ThermoSeason.SUMMER
                );
                break;
              case TargetHeatingCoolingState.HEAT:
                await this.client.switchThermostatSeason(
                  parseInt(this.device.objectId),
                  ThermoSeason.WINTER
                );
                break;
              case TargetHeatingCoolingState.OFF:
                await this.client.toggleThermostatStatus(
                  parseInt(this.device.objectId),
                  ClimaOnOff.OFF_THERMO
                );
                break;
            }
          }
          callback();
        } catch (e) {
          callback(e);
        }
      });

    return [accessoryInformation, this.thermostatService];
  }

  public update(data: ThermostatDeviceData): void {
    const currentCoolingState = this.isOff()
      ? TargetHeatingCoolingState.OFF
      : this.isWinter()
      ? TargetHeatingCoolingState.HEAT
      : TargetHeatingCoolingState.COOL;
    this.thermostatService
      .getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
      .updateValue(currentCoolingState);

    let targetState;
    if (this.isOff()) {
      targetState = TargetHeatingCoolingState.OFF;
    } else if (this.isAuto()) {
      targetState = TargetHeatingCoolingState.AUTO;
    } else {
      if (this.isWinter()) {
        targetState = TargetHeatingCoolingState.HEAT;
      } else {
        targetState = TargetHeatingCoolingState.COOL;
      }
    }
    this.thermostatService
      .getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .updateValue(targetState);

    console.log(
      `Current cooling state is now ${currentCoolingState}, target state is ${targetState}`
    );
    const temperature = data.temperatura ? parseFloat(data.temperatura) / 10 : 0;
    this.log.info(`Temperature for ${this.accessory.displayName} is ${temperature}`);
    this.thermostatService
      .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .updateValue(temperature);

    const activeThreshold = data.soglia_attiva;
    const targetTemperature = activeThreshold ? parseFloat(activeThreshold) / 10 : 0;
    this.log.info(`Threshold for ${this.accessory.displayName} is ${targetTemperature}`);
    this.thermostatService
      .getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .updateValue(targetTemperature);
    this.thermostatService
      .getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      .updateValue(TemperatureDisplayUnits.CELSIUS);
  }

  isOff(): boolean {
    return (
      this.device.auto_man === ClimaMode.OFF_AUTO || this.device.auto_man === ClimaMode.OFF_MANUAL
    );
  }

  isAuto(): boolean {
    return this.device.auto_man === ClimaMode.OFF_AUTO || this.device.auto_man === ClimaMode.AUTO;
  }

  isWinter(): boolean {
    return this.device.est_inv === ThermoSeason.WINTER;
  }
}
