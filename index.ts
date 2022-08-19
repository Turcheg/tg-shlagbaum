import getLogger from './src/logger';
import config from './src/config';
import App from './src/app';

const logger = getLogger(config.logger);
const app = new App(config, logger);

(async function () {
  try {
    await app.init();
    logger.info('Init completed');
    app.run();
    logger.info('App is running');
  } catch (e) {
    logger.error('Exception occured on top thread', e);
    process.exit(1);
  }
})();

export default {}