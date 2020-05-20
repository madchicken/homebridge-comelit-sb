import { ComelitSbClient, DeviceData } from 'comelit-client';
import { Characteristic, Controller, Service } from 'hap-nodejs';
import { AccessoryPlugin, Logger, PlatformAccessory } from 'homebridge';
import { ComelitSbPlatform } from '../comelit-sb-platform';

export abstract class ComelitAccessory<T extends DeviceData> implements AccessoryPlugin {
  readonly platform: ComelitSbPlatform;
  readonly accessory: PlatformAccessory;
  readonly log: Logger;
  readonly device: T;
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
      .setCharacteristic(Characteristic.Name, this.accessory.displayName)
      .setCharacteristic(Characteristic.Manufacturer, 'Comelit')
      .setCharacteristic(Characteristic.Model, 'None')
      .setCharacteristic(Characteristic.FirmwareRevision, 'None')
      .setCharacteristic(Characteristic.SerialNumber, this.accessory.context.objectId);
    return accessoryInformation;
  }

  protected abstract initServices(): Service[];

  public abstract update(data: T): void;
}
