import { ComelitAccessory } from './comelit';
import { ComelitSbClient, OutletDeviceData } from 'comelit-client';
import { ComelitSbPlatform } from '../comelit-sb-platform';
import {
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  PlatformAccessory,
  Service,
} from 'homebridge';

export class Outlet extends ComelitAccessory<OutletDeviceData> {
  static ON = 1;
  static OFF = 0;

  private outletService: Service;

  constructor(
    platform: ComelitSbPlatform,
    accessory: PlatformAccessory,
    client: ComelitSbClient,
    invertStatus: boolean = false
  ) {
    super(platform, accessory, client);
    if (invertStatus) {
      Outlet.ON = 0;
      Outlet.OFF = 1;
    }
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
      .on(
        CharacteristicEventTypes.SET,
        async (yes: boolean, callback: CharacteristicSetCallback) => {
          const status = yes ? Outlet.ON : Outlet.OFF;
          try {
            this.log.debug(
              `Setting outlet status to ${status} for outlet ${this.device.descrizione}`
            );
            const success = await this.client.toggleDeviceStatus(this.id, status, 'other');
            if (success) {
              callback();
            } else {
              callback(
                new Error(
                  `Something went wrong calling toggleDeviceStatus for outlet ${this.device.descrizione}`
                )
              );
            }
          } catch (e) {
            this.log.error(e.message);
            callback(e);
          }
        }
      )
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        callback(null, this.device.status === `${Outlet.ON}`);
      });

    return [accessoryInformation, this.outletService];
  }

  public update(data: OutletDeviceData) {
    const status = parseInt(data.status);
    this.outletService.updateCharacteristic(this.platform.Characteristic.On, status === Outlet.ON);
    const power = parseFloat(data.instant_power);
    this.outletService.updateCharacteristic(this.platform.Characteristic.InUse, power > 0);
  }
}
