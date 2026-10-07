export const deepCopy = object => {
  return JSON.parse(JSON.stringify(object));
};
export const randInt = (a, b) => {
  return Math.floor(Math.random() * (1 + b - a)) + a;
};
export const randUniform = (a, b) => {
  return Math.random() * (b - a) + a;
};
export const randChoice = array => {
  return array[Math.floor(Math.random() * array.length)];
};