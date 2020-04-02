import { ComelitSbClient, DeviceData, HomeIndex } from 'comelit-client';
import { ComelitAccessory } from './accessories/comelit';
import { Lightbulb } from './accessories/lightbulb';
import { Thermostat } from './accessories/thermostat';
import { Blind } from './accessories/blind';
import { Outlet } from './accessories/outlet';
import { PowerSupplier } from './accessories/power-supplier';
import { VedoAlarm } from './accessories/vedo-alarm';
import { Homebridge } from '../types';

import Timeout = NodeJS.Timeout;

export interface HubConfig {
  bridge_url: string;
  bridge_port?: number;
  blind_closing_time?: number;
  disable_alarm?: boolean;
  alarm_code?: string;
  alarm_address?: string;
  refresh_rate?: number;
}

export class ComelitSbPlatform {
  static KEEP_ALIVE_TIMEOUT = 5000;

  public mappedAccessories: Map<string, ComelitAccessory<DeviceData>> = new Map<
    string,
    ComelitAccessory<DeviceData>
  >();

  private readonly log: (message?: any, ...optionalParams: any[]) => void;

  private readonly homebridge: Homebridge;

  private client: ComelitSbClient;

  private readonly config: HubConfig;

  private keepAliveTimer: Timeout;

  private homeIndex: HomeIndex;

  constructor(
    log: (message?: any, ...optionalParams: any[]) => void,
    config: HubConfig,
    homebridge: Homebridge
  ) {
    this.log = (str: string) => log(`[COMELIT SB] ${str}`);
    this.log('Initializing platform: ', config);
    this.config = config;
    // Save the API object as plugin needs to register new accessory via this object
    this.homebridge = homebridge;
    this.log(`homebridge API version: ${homebridge.version}`);
  }

  async accessories(callback: (array: any[]) => void) {
    try {
      if (this.config.bridge_url) {
        this.client = new ComelitSbClient(
          this.config.bridge_url,
          this.config.bridge_port,
          this.updateAccessory.bind(this),
          this.log
        );
      } else {
        this.log(`bridge_url config missing, skipping config`);
        callback([]);
        return;
      }
      const login = await this.client.login();
      if (login === false) {
        this.log('Not logged, returning empty accessory array');
        this.mappedAccessories = new Map<string, ComelitAccessory<DeviceData>>();
      }
      this.log('Building accessories list...');
      this.homeIndex = await this.client.fecthHomeIndex();
      const lightIds = [...this.homeIndex.lightsIndex.keys()];
      this.log(`Found ${lightIds.length} lights`);

      try {
        lightIds.forEach(id => {
          const deviceData = this.homeIndex.lightsIndex.get(id);
          if (deviceData) {
            this.log(`Light ID: ${id}, ${deviceData.descrizione}`);
            this.mappedAccessories.set(
              id,
              new Lightbulb(this.log, deviceData, deviceData.descrizione, this.client)
            );
          }
        });
      } catch (e) {
        this.log(e);
      }
      const thermostatIds = [...this.homeIndex.thermostatsIndex.keys()];
      this.log(`Found ${thermostatIds.length} thermostats`);
      try {
        thermostatIds.forEach(id => {
          const deviceData = this.homeIndex.thermostatsIndex.get(id);
          if (deviceData) {
            this.log(`Thermostat ID: ${id}, ${deviceData.descrizione}`);
            this.mappedAccessories.set(
              id,
              new Thermostat(this.log, deviceData, deviceData.descrizione, this.client)
            );
          }
        });
      } catch (e) {
        this.log(e);
      }
      const shadeIds = [...this.homeIndex.blindsIndex.keys()];
      this.log(`Found ${shadeIds.length} shades`);
      try {
        shadeIds.forEach(id => {
          const deviceData = this.homeIndex.blindsIndex.get(id);
          if (deviceData) {
            this.log(`Blind ID: ${id}, ${deviceData.descrizione}`);
            this.mappedAccessories.set(
              id,
              new Blind(
                this.log,
                deviceData,
                deviceData.descrizione,
                this.client,
                this.config.blind_closing_time
              )
            );
          }
        });
      } catch (e) {
        this.log(e);
      }
      const outletIds = [...this.homeIndex.outletsIndex.keys()];
      this.log(`Found ${outletIds.length} outlets`);
      try {
        outletIds.forEach(id => {
          const deviceData = this.homeIndex.outletsIndex.get(id);
          if (deviceData) {
            this.log(`Outlet ID: ${id}, ${deviceData.descrizione}`);
            this.mappedAccessories.set(
              id,
              new Outlet(this.log, deviceData, deviceData.descrizione, this.client)
            );
          }
        });
      } catch (e) {
        this.log(e);
      }
      const supplierIds = [...this.homeIndex.supplierIndex.keys()];
      this.log(`Found ${supplierIds.length} suppliers`);
      try {
        supplierIds.forEach(id => {
          const deviceData = this.homeIndex.supplierIndex.get(id);
          if (deviceData) {
            this.log(`Supplier ID: ${id}, ${deviceData.descrizione}`);
            this.mappedAccessories.set(
              id,
              new PowerSupplier(this.log, deviceData, deviceData.descrizione, this.client)
            );
          }
        });
      } catch (e) {
        this.log(e);
      }

      this.log(`Found ${this.mappedAccessories.size} accessories`);
      this.log('Subscribed to root object');

      if (!this.config.disable_alarm) {
        if (this.config.alarm_code) {
          const alarmAddress = this.config.alarm_address;
          this.log(`Alarm is enabled, mapping it at ${alarmAddress}`);
          this.keepAlive(); // install keepalive (home index updater)
          callback([
            ...this.mappedAccessories.values(),
            new VedoAlarm(this.log, alarmAddress, this.config.alarm_code),
          ]);
          return;
        } else {
          this.log('Alarm enabled but not properly configured: missing access code');
        }
      }
      this.keepAlive(); // install keepalive (home index updater)
      callback([...this.mappedAccessories.values()]);
    } catch (e) {
      this.log(e);
      callback([]);
    }
  }

  updateAccessory(id: string, data: DeviceData) {
    try {
      const accessory = this.mappedAccessories.get(id);
      if (accessory) {
        accessory.update(data);
      }
    } catch (e) {
      this.log(e);
    }
  }

  async keepAlive() {
    this.keepAliveTimer = setTimeout(async () => {
      try {
        await this.client.updateHomeStatus(this.homeIndex);
      } catch (e) {
        this.log(e);
      }
      this.keepAlive();
    }, ComelitSbPlatform.KEEP_ALIVE_TIMEOUT);
  }

  private async shutdown() {
    if (this.client) {
      this.log('Shutting down old client...');
      if (this.keepAliveTimer) {
        clearTimeout(this.keepAliveTimer);
        this.keepAliveTimer = null;
      }
      await this.client.shutdown();
    }
  }
}
