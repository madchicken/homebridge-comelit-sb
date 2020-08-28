import { ComelitAccessory } from './comelit';
import { ComelitSbClient, LightDeviceData, ObjectStatus } from 'comelit-client';
import { HomebridgeAPI } from '../index';
import { ComelitSbPlatform } from '../comelit-sb-platform';
import {
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  PlatformAccessory,
  Service,
} from 'homebridge';

export class Lightbulb extends ComelitAccessory<LightDeviceData> {
  private lightbulbService: Service;

  constructor(platform: ComelitSbPlatform, accessory: PlatformAccessory, client: ComelitSbClient) {
    super(platform, accessory, client);
  }

  async identify() {
    if (this.isOn()) {
      this.lightbulbService.setCharacteristic(this.platform.Characteristic.On, false);
      setTimeout(() => {
        this.lightbulbService.setCharacteristic(this.platform.Characteristic.On, true);
      }, 1000);
    } else {
      this.lightbulbService.setCharacteristic(this.platform.Characteristic.On, true);
      setTimeout(() => {
        this.lightbulbService.setCharacteristic(this.platform.Characteristic.On, false);
      }, 1000);
    }
  }

  isOn(): boolean {
    return parseInt(this.device.status) === ObjectStatus.ON;
  }

  protected initServices(): Service[] {
    const accessoryInformation = this.initAccessoryInformation(); // common info about the accessory

    this.lightbulbService = new HomebridgeAPI.hap.Service.Lightbulb(
      this.accessory.displayName,
      null
    );

    this.lightbulbService =
      this.accessory.getService(this.platform.Service.Lightbulb) ||
      this.accessory.addService(this.platform.Service.Lightbulb);

    const status = parseInt(this.device.status);
    this.lightbulbService.setCharacteristic(
      this.platform.Characteristic.On,
      status === ObjectStatus.ON
    );

    this.lightbulbService
      .getCharacteristic(this.platform.Characteristic.On)
      .on(
        CharacteristicEventTypes.SET,
        async (yes: boolean, callback: CharacteristicSetCallback) => {
          const status = yes ? ObjectStatus.ON : ObjectStatus.OFF;
          try {
            await this.client.toggleDeviceStatus(this.id, status, 'light');
            callback();
          } catch (e) {
            this.log.error(e.message);
            callback(e);
          }
        }
      )
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        callback(null, this.device.status === `${ObjectStatus.ON}`);
      });

    return [accessoryInformation, this.lightbulbService];
  }

  public update(data: LightDeviceData) {
    const Characteristic = this.platform.Characteristic;
    const status = parseInt(data.status) === ObjectStatus.ON;
    console.log(`Updating status of light ${this.id}. New status is ${status}`);
    this.lightbulbService.getCharacteristic(Characteristic.On).updateValue(status);
  }
}
