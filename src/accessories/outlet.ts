import { ComelitAccessory } from './comelit';
import { ComelitSbClient, OutletDeviceData } from 'comelit-client';
import { ComelitSbPlatform } from '../comelit-sb-platform';
import { CharacteristicEventTypes, PlatformAccessory, Service } from 'homebridge';

export class Outlet extends ComelitAccessory<OutletDeviceData> {
  static readonly ON = 1;
  static readonly OFF = 0;

  private outletService: Service;

  constructor(platform: ComelitSbPlatform, accessory: PlatformAccessory, client: ComelitSbClient) {
    super(platform, accessory, client);
  }

  protected initServices(): Service[] {
    const accessoryInformation = this.initAccessoryInformation();

    this.outletService =
      this.accessory.getService(this.platform.Service.Outlet) ||
      this.accessory.addService(this.platform.Service.Outlet);

    this.update(this.device);
    this.outletService
      .getCharacteristic(this.platform.Characteristic.InUse)
      .on(CharacteristicEventTypes.GET, async (callback: Function) => {
        const power = parseFloat(this.device.instant_power);
        callback(null, power > 0);
      });
    this.outletService
      .getCharacteristic(this.platform.Characteristic.On)
      .on(CharacteristicEventTypes.SET, async (yes: boolean, callback: Function) => {
        const status = yes ? Outlet.ON : Outlet.OFF;
        try {
          await this.client.toggleDeviceStatus(parseInt(this.device.objectId), status, 'other');
          this.device.status = `${status}`;
          callback();
        } catch (e) {
          callback(e);
        }
      });

    return [accessoryInformation, this.outletService];
  }

  public update(data: OutletDeviceData) {
    const status = parseInt(data.status);
    this.outletService.getCharacteristic(this.platform.Characteristic.On).updateValue(status > 0);
    const power = parseFloat(data.instant_power);
    this.outletService.getCharacteristic(this.platform.Characteristic.InUse).updateValue(power > 0);
  }
}
