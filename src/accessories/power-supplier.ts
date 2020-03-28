import { ComelitAccessory } from './comelit';
import { Categories, Service } from 'hap-nodejs';
import { ComelitSbClient, SupplierDeviceData } from 'comelit-client';

export class PowerSupplier extends ComelitAccessory<SupplierDeviceData> {
  constructor(log: Function, device: SupplierDeviceData, name: string, client: ComelitSbClient) {
    super(log, device, name, client, Categories.OTHER);
  }

  protected initServices(): Service[] {
    return [this.initAccessoryInformation()];
  }

  update(data: SupplierDeviceData): void {
    console.log(`Power supply update ${data.instant_power}Wh`);
  }
}
