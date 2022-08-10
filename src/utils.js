export const delay = (ms) => {
  return new Promise((r) => {
    setTimeout(r, ms);
  });
};
export const logctx = (ctx) => {
  if(ctx?.update) {
    return {...ctx.update};
  }
  return null;
}