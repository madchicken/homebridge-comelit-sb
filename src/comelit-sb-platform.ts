import { ComelitSbClient, DeviceData, HomeIndex } from 'comelit-client';
import { ComelitAccessory } from './accessories/comelit';
import { Lightbulb } from './accessories/lightbulb';
import { Thermostat } from './accessories/thermostat';
import { Blind } from './accessories/blind';
import { Outlet } from './accessories/outlet';
import { PowerSupplier } from './accessories/power-supplier';

import Timeout = NodeJS.Timeout;
import {
  API,
  APIEvent,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
  Categories,
} from 'homebridge';

export interface HubConfig extends PlatformConfig {
  bridge_url: string;
  bridge_port?: number;
  bridge_username?: string;
  bridge_password?: string;
  advanced: {
    stop_blinds: boolean;
    blind_closing_time?: number;
    update_rate_sec?: number;
    avoid_duplicates?: boolean;
    invert_plugs_status?: boolean;
    hide_lights?: boolean;
    hide_blinds?: boolean;
    hide_thermostats?: boolean;
    hide_dehumidifiers?: boolean;
    hide_power_suppliers?: boolean;
    hide_outlets?: boolean;
  };
}

const DEFAULT_UPDATE_TIMEOUT_SEC = 5;
const EMPTY_ADVANCED_CONF = {
  stop_blinds: false,
  update_rate_sec: null,
  blind_closing_time: null,
  avoid_duplicates: false,
  hide_lights: false,
  hide_blinds: false,
  hide_thermostats: false,
  hide_dehumidifiers: false,
  hide_power_suppliers: false,
  hide_outlets: false,
};

export class ComelitSbPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;
  public readonly PlatformAccessory: typeof PlatformAccessory;

  public mappedAccessories: Map<string, ComelitAccessory<DeviceData>> = new Map<
    string,
    ComelitAccessory<DeviceData>
  >();

  readonly log: Logger;

  private readonly api: API;

  private client: ComelitSbClient;

  private readonly config: HubConfig;

  private keepAliveTimer: Timeout;

  private updateRateSec: number;

  private blindClosingTime: number;

  private mappedNames: { [key: string]: boolean };

  public readonly accessories: PlatformAccessory[] = [];

  constructor(log: Logger, config: HubConfig, api: API) {
    this.log = log;
    this.log.info('Initializing platform: ', config);
    this.config = config;
    // Save the API object as plugin needs to register new accessory via this object
    this.api = api;
    this.log.info(`homebridge API version: ${api.version}`);
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;
    this.PlatformAccessory = this.api.platformAccessory;
    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => this.discoverDevices());
    this.api.on(APIEvent.SHUTDOWN, () => this.shutdown());
  }

  async discoverDevices() {
    try {
      if (this.hasValidConfig()) {
        this.mappedNames = {};
        const advanced = this.config.advanced || EMPTY_ADVANCED_CONF;
        this.updateRateSec = advanced.update_rate_sec || DEFAULT_UPDATE_TIMEOUT_SEC;
        this.blindClosingTime = advanced.blind_closing_time || null;
        this.client = new ComelitSbClient(
          this.config.bridge_url,
          this.config.bridge_port,
          this.config.bridge_username,
          this.config.bridge_password,
          this.updateAccessory.bind(this),
          this.log
        );
        const login = await this.client.login();
        if (login === false) {
          this.log.info('Not logged, returning empty accessory array');
          this.mappedAccessories = new Map<string, ComelitAccessory<DeviceData>>();
        }
        this.log.info('Building accessories list...');
        const homeIndex = await this.client.fetchHomeIndex();
        if (homeIndex) {
          if (advanced.hide_lights !== true) {
            this.mapLights(homeIndex);
          }
          if (advanced.hide_thermostats !== true) {
            this.mapThermostats(homeIndex);
          }
          if (advanced.hide_blinds !== true) {
            this.mapBlinds(homeIndex);
          }
          if (advanced.hide_outlets !== true) {
            this.mapOutlets(homeIndex);
          }
          if (advanced.hide_power_suppliers !== true) {
            this.mapSuppliers(homeIndex);
          }
        }
        this.log.info(`Found ${this.mappedAccessories.size} accessories`);
        await this.startPolling(homeIndex);
      } else {
        this.log.error(`Invalid config: bridge_url config is missing, can't map accessories`);
        return;
      }
    } catch (e) {
      this.log.error(e);
    }
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  private hasValidConfig() {
    return this.config && this.config.bridge_url;
  }

  getDeviceName(deviceData: DeviceData): string {
    let key = deviceData.descrizione;
    const advanced = this.config.advanced || EMPTY_ADVANCED_CONF;
    if (advanced.avoid_duplicates) {
      let index = 0;
      while (this.mappedNames[key] !== undefined) {
        index++;
        key = `${deviceData.descrizione} (${index})`;
      }
      this.mappedNames[key] = true;
    }
    return key;
  }

  private mapSuppliers(homeIndex: HomeIndex) {
    const supplierIds = [...homeIndex.supplierIndex.keys()];
    this.log.info(`Found ${supplierIds.length} suppliers`);
    try {
      supplierIds.forEach(id => {
        const deviceData = homeIndex.supplierIndex.get(id);
        if (deviceData) {
          this.log.info(`Supplier ID: ${id}, ${deviceData.descrizione}`);
          const accessory = this.createHapAccessory(deviceData, Categories.OTHER);
          this.mappedAccessories.set(id, new PowerSupplier(this, accessory, this.client));
        }
      });
    } catch (e) {
      this.log.info(e);
    }
  }

  private mapOutlets(homeIndex: HomeIndex) {
    const outletIds = [...homeIndex.outletsIndex.keys()];
    this.log.info(`Found ${outletIds.length} outlets`);
    try {
      outletIds.forEach(id => {
        const deviceData = homeIndex.outletsIndex.get(id);
        if (deviceData) {
          this.log.info(`Outlet ID: ${id}, ${deviceData.descrizione}`);
          const accessory = this.createHapAccessory(deviceData, Categories.OUTLET);
          this.mappedAccessories.set(
            id,
            new Outlet(this, accessory, this.client, this.config.advanced.invert_plugs_status)
          );
        }
      });
    } catch (e) {
      this.log.info(e);
    }
  }

  private mapBlinds(homeIndex: HomeIndex) {
    const shadeIds = [...homeIndex.blindsIndex.keys()];
    this.log.info(`Found ${shadeIds.length} shades`);
    try {
      shadeIds.forEach(id => {
        const deviceData = homeIndex.blindsIndex.get(id);
        if (deviceData) {
          this.log.info(`Blind ID: ${id}, ${deviceData.descrizione}`);
          const accessory = this.createHapAccessory(deviceData, Categories.WINDOW_COVERING);
          this.mappedAccessories.set(
            id,
            new Blind(
              this,
              accessory,
              this.client,
              this.config.advanced.stop_blinds,
              this.blindClosingTime
            )
          );
        }
      });
    } catch (e) {
      this.log.info(e);
    }
  }

  private mapThermostats(homeIndex: HomeIndex) {
    const thermostatIds = [...homeIndex.thermostatsIndex.keys()];
    this.log.info(`Found ${thermostatIds.length} thermostats`);
    try {
      thermostatIds.forEach(id => {
        const deviceData = homeIndex.thermostatsIndex.get(id);
        if (deviceData) {
          this.log.info(`Thermostat ID: ${id}, ${deviceData.descrizione}`);
          const accessory = this.createHapAccessory(deviceData, Categories.THERMOSTAT);
          this.mappedAccessories.set(id, new Thermostat(this, accessory, this.client));
        }
      });
    } catch (e) {
      this.log.info(e);
    }
  }

  private mapLights(homeIndex: HomeIndex) {
    const lightIds = [...homeIndex.lightsIndex.keys()];
    this.log.info(`Found ${lightIds.length} lights`);

    try {
      lightIds.forEach(id => {
        const deviceData = homeIndex.lightsIndex.get(id);
        if (deviceData) {
          this.log.info(`Light ID: ${id}, ${deviceData.descrizione}`);
          const accessory = this.createHapAccessory(deviceData, Categories.LIGHTBULB);
          this.mappedAccessories.set(id, new Lightbulb(this, accessory, this.client));
        }
      });
    } catch (e) {
      this.log.info(e);
    }
  }

  private createHapAccessory(deviceData: DeviceData, category: Categories, id?: string) {
    const uuid = this.api.hap.uuid.generate(id || deviceData.id);
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
    const accessory =
      existingAccessory ||
      new this.PlatformAccessory(this.getDeviceName(deviceData), uuid, category);
    accessory.context = deviceData;
    if (existingAccessory) {
      this.log.debug(`Reuse accessory from cache with uuid ${uuid} of type ${category}`);
    } else {
      this.log.debug(`Registering new accessory with uuid ${uuid} of type ${category}`);
      this.api.registerPlatformAccessories(
        'homebridge-comelit-sb-platform',
        'Comelit Serial Bridge',
        [accessory]
      );
    }
    return accessory;
  }

  updateAccessory(id: string, data: DeviceData) {
    try {
      const accessory = this.mappedAccessories.get(id);
      if (accessory) {
        accessory.updateDevice(data);
      }
    } catch (e) {
      this.log.info(e);
    }
  }

  async startPolling(homeIndex: HomeIndex) {
    this.keepAliveTimer = setTimeout(async () => {
      try {
        if (this.client) {
          if (homeIndex) {
            await this.client.updateHomeStatus(homeIndex);
          }
        }
      } catch (e) {
        this.log.info(e);
      }
      this.keepAliveTimer.refresh();
    }, this.updateRateSec * 1000);
  }

  private async shutdown() {
    if (this.client) {
      this.log.info('Shutting down SB client...');
      if (this.keepAliveTimer) {
        clearTimeout(this.keepAliveTimer);
        this.keepAliveTimer = null;
      }
      await this.client.shutdown();
    }
  }
}
