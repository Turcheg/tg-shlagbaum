import pino from 'pino';
function wrap(logger:any) {
  const { error, child } = logger;
  function errorRearranger(...args: any[]) {
    if (typeof args[0] === 'string' && args.length > 1) {
      for (let i = 1; i < args.length; i++) {
        const arg: any = args[i];
        if (arg instanceof Error) {
          const [err] = args.splice(i, 1);
          args.unshift(err);
        }
      }
    }
    // @ts-ignore
    return error.apply(this, args);
  }
  // @ts-ignore
  function childModifier(...args) {
    // @ts-ignore
    const c = child.apply(this, args);
    c.error = errorRearranger;
    c.child = childModifier;
    return c;
  }
  logger.error = errorRearranger;
  logger.child = childModifier;
  return logger;
}

// @ts-ignore
export default function (opts):any {
  return wrap(pino(opts));
}
