import { ComelitSbClient, DeviceData, HomeIndex, OBJECT_SUBTYPE } from 'comelit-client';
import { ComelitAccessory } from './accessories/comelit';
import { Lightbulb } from './accessories/lightbulb';
import { Thermostat } from './accessories/thermostat';
import { Blind } from './accessories/blind';
import { Outlet } from './accessories/outlet';
import { PowerSupplier } from './accessories/power-supplier';
import { Homebridge, Logger } from '../types';

import Timeout = NodeJS.Timeout;
import { Dehumidifier } from './accessories/dehumidifier';

export interface HubConfig {
  bridge_url: string;
  bridge_port?: number;
  advanced: {
    stop_blinds: boolean;
    blind_closing_time?: number;
    update_rate_sec?: number;
    avoid_duplicates?: boolean;
  };
}

const DEFAULT_UPDATE_TIMEOUT_SEC = 5;
const EMPTY_ADVANCED_CONF = {
  stop_blinds: false,
  update_rate_sec: null,
  blind_closing_time: null,
};

export class ComelitSbPlatform {
  public mappedAccessories: Map<string, ComelitAccessory<DeviceData>> = new Map<
    string,
    ComelitAccessory<DeviceData>
  >();

  private readonly log: Logger;

  private readonly homebridge: Homebridge;

  private client: ComelitSbClient;

  private readonly config: HubConfig;

  private keepAliveTimer: Timeout;

  private homeIndex: HomeIndex;

  private updateRateSec: number;

  private blindClosingTime: number;

  private mappedNames: { [key: string]: boolean };

  constructor(log: Logger, config: HubConfig, homebridge: Homebridge) {
    this.log = log;
    this.log('Initializing platform: ', config);
    this.config = config;
    // Save the API object as plugin needs to register new accessory via this object
    this.homebridge = homebridge;
    this.log(`homebridge API version: ${homebridge.version}`);
    this.homebridge.on('didFinishLaunching', () => this.startPolling());
  }

  async accessories(callback: (array: any[]) => void) {
    try {
      this.mappedNames = {};
      if (this.config && this.config.bridge_url) {
        const advanced = this.config.advanced || EMPTY_ADVANCED_CONF;
        this.updateRateSec = advanced.update_rate_sec || DEFAULT_UPDATE_TIMEOUT_SEC;
        this.blindClosingTime = advanced.blind_closing_time || null;
        this.client = new ComelitSbClient(
          this.config.bridge_url,
          this.config.bridge_port,
          this.updateAccessory.bind(this),
          this.log
        );
      } else {
        this.log.error(`Invalid config: bridge_url config is missing, can't map accessories`);
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
      this.mapLights();
      this.mapThermostats();
      this.mapBlinds();
      this.mapOutlets();
      this.mapSuppliers();
      this.log(`Found ${this.mappedAccessories.size} accessories`);
      callback([...this.mappedAccessories.values()]);
    } catch (e) {
      this.log(e);
      callback([]);
    }
  }

  getDeviceName(deviceData: DeviceData): string {
    let key = deviceData.descrizione;
    if (this.config.advanced.avoid_duplicates) {
      let index = 0;
      while (this.mappedNames[key] !== undefined) {
        index++;
        key = `${deviceData.descrizione} (${index})`;
      }
      this.mappedNames[key] = true;
    }
    return key;
  }

  private mapSuppliers() {
    const supplierIds = [...this.homeIndex.supplierIndex.keys()];
    this.log(`Found ${supplierIds.length} suppliers`);
    try {
      supplierIds.forEach(id => {
        const deviceData = this.homeIndex.supplierIndex.get(id);
        if (deviceData) {
          this.log(`Supplier ID: ${id}, ${deviceData.descrizione}`);
          this.mappedAccessories.set(
            id,
            new PowerSupplier(this.log, deviceData, this.getDeviceName(deviceData), this.client)
          );
        }
      });
    } catch (e) {
      this.log(e);
    }
  }

  private mapOutlets() {
    const outletIds = [...this.homeIndex.outletsIndex.keys()];
    this.log(`Found ${outletIds.length} outlets`);
    try {
      outletIds.forEach(id => {
        const deviceData = this.homeIndex.outletsIndex.get(id);
        if (deviceData) {
          this.log(`Outlet ID: ${id}, ${deviceData.descrizione}`);
          this.mappedAccessories.set(
            id,
            new Outlet(this.log, deviceData, this.getDeviceName(deviceData), this.client)
          );
        }
      });
    } catch (e) {
      this.log(e);
    }
  }

  private mapBlinds() {
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
              this.config.advanced.stop_blinds,
              this.blindClosingTime
            )
          );
        }
      });
    } catch (e) {
      this.log(e);
    }
  }

  private mapThermostats() {
    const thermostatIds = [...this.homeIndex.thermostatsIndex.keys()];
    this.log(`Found ${thermostatIds.length} thermostats`);
    try {
      thermostatIds.forEach(id => {
        const deviceData = this.homeIndex.thermostatsIndex.get(id);
        if (deviceData) {
          this.log(`Thermostat ID: ${id}, ${deviceData.descrizione}`);
          this.mappedAccessories.set(
            id,
            new Thermostat(this.log, deviceData, this.getDeviceName(deviceData), this.client)
          );
          if (deviceData.sub_type === OBJECT_SUBTYPE.CLIMA_THERMOSTAT_DEHUMIDIFIER) {
            this.mappedAccessories.set(
              `${id}#D`,
              new Dehumidifier(this.log, deviceData, deviceData.descrizione, this.client)
            );
          }
        }
      });
    } catch (e) {
      this.log(e);
    }
  }

  private mapLights() {
    const lightIds = [...this.homeIndex.lightsIndex.keys()];
    this.log(`Found ${lightIds.length} lights`);

    try {
      lightIds.forEach(id => {
        const deviceData = this.homeIndex.lightsIndex.get(id);
        if (deviceData) {
          this.log(`Light ID: ${id}, ${deviceData.descrizione}`);
          this.mappedAccessories.set(
            id,
            new Lightbulb(this.log, deviceData, this.getDeviceName(deviceData), this.client)
          );
        }
      });
    } catch (e) {
      this.log(e);
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

  async startPolling() {
    this.keepAliveTimer = setTimeout(async () => {
      try {
        if (this.client) {
          await this.client.updateHomeStatus(this.homeIndex);
        }
      } catch (e) {
        this.log(e);
      }
      this.keepAliveTimer.refresh();
    }, this.updateRateSec * 1000);
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
