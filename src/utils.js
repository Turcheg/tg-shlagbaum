export const delay = (ms) => {
  return new Promise((r) => {
    setTimeout(r, ms);
  });
};
