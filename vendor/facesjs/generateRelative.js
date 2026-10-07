// Vendored from facesjs 5.0.3. The two imports below were bare package
// specifiers ("dlv", "dset") upstream; rewritten to relative paths so the
// module graph resolves in browsers (no bundler) and in node (test harness).
// dlv.js/dset.js are minimal local stand-ins (see those files).
import delve from "./dlv.js";
import { dset } from "./dset.js";
import { colors, generate, numberRanges } from "./generate.js";
import { features, races } from "./common.js";
import { deepCopy } from "./utils.js";
import { svgsGenders, svgsIndex } from "./svgs-index.js";

// Currently, race just affects skin color and hair color. Let's ignore hair color (since you could imagine it being dyed anyway) and figure out someone's race just based on skin color. If no race is found, return undefined.
const imputeRace = face => {
  return races.find(race => colors[race].skin.includes(face.body.color));
};
export const generateRelative = ({
  gender,
  race: inputRace,
  relative
}) => {
  const face = deepCopy(relative);
  const race = inputRace ?? imputeRace(face);
  const randomFace = generate(undefined, {
    gender,
    race
  });

  // Regenerate some properties always, and others with some probability

  const regenerateProperties = {
    accessories: "always",
    body: {
      color: inputRace !== undefined ? "always" : "sometimesIfRaceIsKnown",
      id: "sometimes",
      size: "always"
    },
    ear: "sometimes",
    eye: "sometimes",
    eyebrow: "sometimes",
    eyeLine: "sometimes",
    facialHair: "always",
    fatness: "always",
    glasses: "always",
    hair: {
      color: inputRace !== undefined ? "always" : "sometimesIfRaceIsKnown",
      flip: "always",
      id: "always"
    },
    hairBg: "always",
    head: {
      id: "sometimes",
      shave: "always"
    },
    jersey: "never",
    miscLine: "sometimes",
    mouth: "sometimes",
    nose: "sometimes",
    smileLine: "sometimes",
    teamColors: "never"
  };
  const probRegenerate = 0.25;
  const processRegenerateProperties = (objOutput, objRandom, regeneratePropertiesLocal) => {
    for (const [key, value] of Object.entries(regeneratePropertiesLocal)) {
      if (typeof value === "string") {
        if (value === "always" || (value === "sometimes" || value === "sometimesIfRaceIsKnown" && race !== undefined) && Math.random() < probRegenerate) {
          objOutput[key] = objRandom[key];
        }
      } else {
        processRegenerateProperties(objOutput[key], objRandom[key], value);
      }
    }
  };
  processRegenerateProperties(face, randomFace, regenerateProperties);

  // Override any ID properties that are not valid for the specified gender
  for (const key of features) {
    const svgIndex = svgsIndex[key].findIndex(id => id === face[key].id);
    const svgGender = svgsGenders[key][svgIndex];
    if (svgIndex < 0 || svgGender === "male" && gender === "female" || svgGender === "female" && gender === "male") {
      face[key].id = randomFace[key].id;
    }
  }

  // Override any numeric properties that are not valid for the specified gender
  for (const [path, ranges] of Object.entries(numberRanges)) {
    const current = delve(face, path);
    const range = ranges[gender];
    if (current < range[0] || current > range[1]) {
      dset(face, path, delve(randomFace, path));
    }
  }
  return face;
};