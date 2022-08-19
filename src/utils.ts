import { Context } from "telegraf";
import { Update } from "telegraf/typings/core/types/typegram";

export const delay = (ms:number):Promise<void> => {
  return new Promise((r) => {
    setTimeout(r, ms);
  });
};
export const logctx = (ctx:Context): Update | null => {
  if(ctx?.update) {
    return {...ctx.update};
  }
  return null;
}
export const seq = ():string => {
  const timestamp = Math.floor( Number(new Date()) / 1000);
  return String(Math.floor(timestamp * 1000))
}