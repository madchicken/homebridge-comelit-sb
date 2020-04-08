import { ComelitAccessory } from './comelit';
import { BlindDeviceData, ComelitSbClient, ObjectStatus } from 'comelit-client';
import {
  Callback,
  Categories,
  Characteristic,
  CharacteristicEventTypes,
  Service,
} from 'hap-nodejs';
import { HomebridgeAPI } from '../index';
import { PositionState } from 'hap-nodejs/dist/lib/gen/HomeKit';
import Timeout = NodeJS.Timeout;

export class Blind extends ComelitAccessory<BlindDeviceData> {
  static readonly OPEN = 100;
  static readonly CLOSED = 0;

  static readonly OPENING_CLOSING_TIME = 35; // 35 seconds to open approx. We should have this in the config

  private coveringService: Service;
  private timeout: Timeout;
  private readonly closingTime: number;
  private positionState: number;

  constructor(
    log: Function,
    device: BlindDeviceData,
    name: string,
    client: ComelitSbClient,
    closingTime?: number
  ) {
    super(log, device, name, client, Categories.WINDOW_COVERING);
    this.closingTime = (closingTime || Blind.OPENING_CLOSING_TIME) * 1000;
    this.log(`Blind ${device.id} has closing time of ${this.closingTime}`);
  }

  protected initServices(): Service[] {
    const accessoryInformation = this.initAccessoryInformation();

    this.coveringService = new HomebridgeAPI.hap.Service.WindowCovering(
      this.device.descrizione,
      null
    );

    this.coveringService.setCharacteristic(Characteristic.PositionState, PositionState.STOPPED);
    this.coveringService.setCharacteristic(Characteristic.TargetPosition, Blind.OPEN);
    this.coveringService.setCharacteristic(Characteristic.CurrentPosition, Blind.OPEN);
    this.positionState = PositionState.STOPPED;

    this.coveringService
      .getCharacteristic(Characteristic.TargetPosition)
      .on(CharacteristicEventTypes.SET, async (position: number, callback: Callback) => {
        try {
          if (this.timeout) {
            await this.resetTimeout();
            callback();
            return;
          }

          const currentPosition = this.coveringService.getCharacteristic(
            Characteristic.CurrentPosition
          ).value as number;
          const status = position < currentPosition ? ObjectStatus.OFF : ObjectStatus.ON;
          await this.client.toggleDeviceStatus(parseInt(this.device.objectId), status, 'shutter');
          this.timeout = setTimeout(async () => {
            this.resetTimeout();
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
    this.log(`Stopping blind`);
    clearTimeout(this.timeout);
    this.timeout = null;
    await this.client.toggleDeviceStatus(
      parseInt(this.device.objectId),
      this.positionState === PositionState.DECREASING ? ObjectStatus.ON : ObjectStatus.OFF,
      'shutter'
    ); // stop the blind
  }

  public update(data: BlindDeviceData) {
    const status = parseInt(data.status);
    switch (status) {
      case ObjectStatus.ON:
        this.positionState = PositionState.INCREASING;
        break;
      case ObjectStatus.OFF: {
        this.coveringService
          .getCharacteristic(Characteristic.TargetPosition)
          .updateValue(this.positionState === PositionState.INCREASING ? Blind.OPEN : Blind.CLOSED);
        this.coveringService
          .getCharacteristic(Characteristic.CurrentPosition)
          .updateValue(this.positionState === PositionState.INCREASING ? Blind.OPEN : Blind.CLOSED);
        this.positionState = PositionState.STOPPED;
        break;
      }
      case ObjectStatus.IDLE:
        this.positionState = PositionState.DECREASING;
        break;
    }
    this.log(`Blind update: status ${status}, state ${this.positionState}`);
    this.coveringService
      .getCharacteristic(Characteristic.PositionState)
      .updateValue(this.positionState);
  }
}
