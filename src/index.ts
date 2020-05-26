import { ComelitSbPlatform } from './comelit-sb-platform';
import { API } from 'homebridge';

export let HomebridgeAPI: API;

export default function(homebridge: API) {
  HomebridgeAPI = homebridge;
  homebridge.registerPlatform('Comelit Serial Bridge', ComelitSbPlatform);
}
