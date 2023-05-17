// Export widget models and views, and the npm package version number.

/**  ---  VERSION ---  **/
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-var-requires
const data = require('../package.json');
import {MODULE_VERSION} from './version';
export const version = MODULE_VERSION;


/**  ---  CONTENT ---  **/
export * from './version';
export * from './widgets';
