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
export const seq = () => {
  const timestamp = Math.floor(new Date() / 1000);
  return Math.floor(timestamp * 1000)
}