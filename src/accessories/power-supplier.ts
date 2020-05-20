import { ComelitAccessory } from './comelit';
import { Service } from 'hap-nodejs';
import { ComelitSbClient, SupplierDeviceData } from 'comelit-client';
import { ComelitSbPlatform } from '../comelit-sb-platform';
import { PlatformAccessory } from 'homebridge';

export class PowerSupplier extends ComelitAccessory<SupplierDeviceData> {
  constructor(platform: ComelitSbPlatform, accessory: PlatformAccessory, client: ComelitSbClient) {
    super(platform, accessory, client);
  }

  protected initServices(): Service[] {
    return [this.initAccessoryInformation()];
  }

  update(data: SupplierDeviceData): void {
    console.log(`Power supply update ${data.instant_power}Wh`);
  }
}
