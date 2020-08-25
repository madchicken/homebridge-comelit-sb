import { ComelitSbClient, DeviceData } from 'comelit-client';
import { AccessoryPlugin, Controller, Logger, PlatformAccessory, Service } from 'homebridge';
import { ComelitSbPlatform } from '../comelit-sb-platform';

export abstract class ComelitAccessory<T extends DeviceData> implements AccessoryPlugin {
  readonly platform: ComelitSbPlatform;
  readonly accessory: PlatformAccessory;
  readonly log: Logger;
  protected device: T;
  readonly client: ComelitSbClient;

  services: Service[];
  reachable: boolean;

  protected constructor(
    platform: ComelitSbPlatform,
    accessory: PlatformAccessory,
    client: ComelitSbClient
  ) {
    this.platform = platform;
    this.accessory = accessory;
    this.device = this.accessory.context as T;
    this.log = platform.log;
    this.client = client;
    this.services = this.initServices();
    this.reachable = true;
  }

  get id(): number {
    return parseInt(this.device.objectId);
  }

  getServices(): Service[] {
    return this.services;
  }

  getControllers(): Controller[] {
    return [];
  }

  identify(): void {}

  protected initAccessoryInformation(): Service {
    const accessoryInformation = this.accessory.getService(
      this.platform.Service.AccessoryInformation
    );
    accessoryInformation!
      .setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName)
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Comelit')
      .setCharacteristic(this.platform.Characteristic.Model, 'None')
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, 'None')
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        this.accessory.context.objectId
      );
    return accessoryInformation;
  }

  protected abstract initServices(): Service[];

  protected abstract update(data: T): void;

  updateDevice(data: T) {
    this.device = { ...this.device, ...data };
    this.update(data);
  }
}
