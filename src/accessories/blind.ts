import { ComelitAccessory } from './comelit';
import { BlindDeviceData, ComelitSbClient, ObjectStatus } from 'comelit-client';
import { Callback, CharacteristicEventTypes, PlatformAccessory, Service } from 'homebridge';
import { ComelitSbPlatform } from '../comelit-sb-platform';
import Timeout = NodeJS.Timeout;

export class Blind extends ComelitAccessory<BlindDeviceData> {
  static readonly DECREASING = 0;
  static readonly INCREASING = 1;
  static readonly STOPPED = 2;

  static readonly OPEN = 100;
  static readonly CLOSED = 0;

  static readonly OPENING_CLOSING_TIME = 35; // 35 seconds to open approx. We should have this in the config

  private coveringService: Service;
  private timeout: Timeout;
  private readonly closingTime: number;
  private readonly sendStop: boolean;
  private positionState: number;

  constructor(
    platform: ComelitSbPlatform,
    accessory: PlatformAccessory,
    client: ComelitSbClient,
    sendStop: boolean,
    closingTime?: number
  ) {
    super(platform, accessory, client);
    this.sendStop = sendStop;
    this.closingTime = (closingTime || Blind.OPENING_CLOSING_TIME) * 1000;
    this.log.info(`Blind ${this.device.id} has closing time of ${this.closingTime}`);
  }

  protected initServices(): Service[] {
    const accessoryInformation = this.initAccessoryInformation();

    this.coveringService =
      this.accessory.getService(this.platform.Service.WindowCovering) ||
      this.accessory.addService(this.platform.Service.WindowCovering);

    this.coveringService.setCharacteristic(
      this.platform.Characteristic.PositionState,
      Blind.STOPPED
    );
    this.coveringService.setCharacteristic(this.platform.Characteristic.TargetPosition, Blind.OPEN);
    this.coveringService.setCharacteristic(
      this.platform.Characteristic.CurrentPosition,
      Blind.OPEN
    );
    this.positionState = Blind.STOPPED;

    this.coveringService
      .getCharacteristic(this.platform.Characteristic.TargetPosition)
      .on(CharacteristicEventTypes.SET, async (position: number, callback: Callback) => {
        try {
          if (this.timeout) {
            await this.resetTimeout();
            callback();
            return;
          }

          const currentPosition = this.coveringService.getCharacteristic(
            this.platform.Characteristic.CurrentPosition
          ).value as number;
          const status = position < currentPosition ? ObjectStatus.OFF : ObjectStatus.ON;
          await this.client.toggleDeviceStatus(this.id, status, 'shutter');
          this.timeout = setTimeout(async () => {
            if (this.sendStop) {
              this.resetTimeout();
            } else {
              this.timeout = null;
            }
          }, this.closingTime);
          callback();
        } catch (e) {
          callback(e);
        }
      });

    return [accessoryInformation, this.coveringService];
  }

  private async resetTimeout() {
    // A timeout was set, this means that we are already opening or closing the blind
    // Stop the blind and calculate a rough position
    this.log.info(`Stopping blind`);
    clearTimeout(this.timeout);
    this.timeout = null;
    await this.client.toggleDeviceStatus(
      this.id,
      this.positionState === Blind.DECREASING ? ObjectStatus.ON : ObjectStatus.OFF,
      'shutter'
    ); // stop the blind
  }

  public update(data: BlindDeviceData) {
    const status = parseInt(data.status);
    switch (status) {
      case ObjectStatus.ON:
        this.positionState = Blind.INCREASING;
        break;
      case ObjectStatus.OFF: {
        this.coveringService
          .getCharacteristic(this.platform.Characteristic.TargetPosition)
          .updateValue(this.positionState === Blind.INCREASING ? Blind.OPEN : Blind.CLOSED);
        this.coveringService
          .getCharacteristic(this.platform.Characteristic.CurrentPosition)
          .updateValue(this.positionState === Blind.INCREASING ? Blind.OPEN : Blind.CLOSED);
        this.positionState = Blind.STOPPED;
        break;
      }
      case ObjectStatus.IDLE:
        this.positionState = Blind.DECREASING;
        break;
    }
    this.log.info(`Blind update: status ${status}, state ${this.positionState}`);
    this.coveringService
      .getCharacteristic(this.platform.Characteristic.PositionState)
      .updateValue(this.positionState);
  }
}
