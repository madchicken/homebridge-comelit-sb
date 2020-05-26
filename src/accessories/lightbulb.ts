import { ComelitAccessory } from './comelit';
import { ComelitSbClient, LightDeviceData, ObjectStatus } from 'comelit-client';
import { HomebridgeAPI } from '../index';
import { ComelitSbPlatform } from '../comelit-sb-platform';
import { CharacteristicEventTypes, PlatformAccessory, Service } from 'homebridge';

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
      .on(CharacteristicEventTypes.SET, async (yes: boolean, callback: Function) => {
        const status = yes ? ObjectStatus.ON : ObjectStatus.OFF;
        try {
          await this.client.toggleDeviceStatus(parseInt(this.device.objectId), status, 'light');
          this.device.status = `${status}`;
          callback();
        } catch (e) {
          callback(e);
        }
      });

    return [accessoryInformation, this.lightbulbService];
  }

  public update(data: LightDeviceData) {
    const status = parseInt(data.status) === ObjectStatus.ON;
    console.log(
      `Updating status of light ${parseInt(this.device.objectId)}. New status is ${status}`
    );
    this.lightbulbService.getCharacteristic(this.platform.Characteristic.On).updateValue(status);
  }
}
