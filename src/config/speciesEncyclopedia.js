/**
 * Wild Trails — Species Encyclopedia
 *
 * Educational wildlife data for each species in the simulation.
 * All values use approximate ranges (~) for child-friendly learning.
 * Language is simple and accessible for all ages.
 */

export const SPECIES_DATA = {
  moose: {
    commonName: 'Moose',
    scientificName: 'Alces alces',
    category: 'Mammal',
    approximateWeight: '~350–700 kg',
    approximateHeight: '~1.8–2.1 m at shoulder',
    approximateLength: '~2.4–3.1 m',
    topSpeed: '~55 km/h',
    averageLifespan: '~15–25 years',
    diet: ['Aquatic plants', 'Bark', 'Twigs', 'Leaves', 'Shrubs'],
    dietDescription: 'Eats plants, bark, and water plants from ponds and rivers.',
    favouriteHabitat: ['Boreal forests', 'Wetlands', 'Lakes'],
    conservationStatus: 'Least Concern',
    predators: ['Wolves', 'Bears', 'Mountain lions'],
    geographicRange: 'Northern North America, Scandinavia, Russia',
    sounds: 'Low grunts and bellowing calls during mating season',
    footprints: 'Large heart-shaped hoofprints, about 15 cm long',
    funFacts: [
      'Moose are excellent swimmers and can dive underwater for plants.',
      'A moose\'s antlers can grow up to 1.8 metres wide — that\'s wider than most cars!',
      'Moose can run as fast as a horse for short distances.',
      'Baby moose can outrun a human within just five days of being born.',
      'Moose have a special flap of skin under their chin called a "bell."',
      'A moose\'s long legs help it walk through deep snow that would trap other animals.',
      'Moose are the largest members of the deer family.',
      'Moose lose their antlers every winter and grow new ones each spring.',
    ],
  },

  deer: {
    commonName: 'Deer',
    scientificName: 'Cervus elaphus',
    category: 'Mammal',
    approximateWeight: '~90–240 kg',
    approximateHeight: '~1–1.5 m at shoulder',
    approximateLength: '~1.6–2.5 m',
    topSpeed: '~70 km/h',
    averageLifespan: '~10–20 years',
    diet: ['Grass', 'Leaves', 'Flowers', 'Berries', 'Acorns'],
    dietDescription: 'Eats grass, leaves, flowers, and sometimes fruit.',
    favouriteHabitat: ['Forests', 'Meadows', 'Grasslands'],
    conservationStatus: 'Least Concern',
    predators: ['Wolves', 'Bears', 'Mountain lions', 'Foxes (fawns)'],
    geographicRange: 'Europe, Asia, North America, and introduced worldwide',
    sounds: 'Males roar loudly during autumn mating season',
    footprints: 'Two-toed hoofprints shaped like upside-down hearts',
    funFacts: [
      'Deer can rotate their ears independently to detect danger from any direction.',
      'A deer\'s eyes are on the sides of its head, giving it almost 360° vision.',
      'Deer can jump up to 3 metres high — higher than a basketball hoop!',
      'Baby deer (fawns) have no scent, which helps them hide from predators.',
      'Male deer grow new antlers every year, covered in soft "velvet."',
      'Deer are excellent swimmers and often cross rivers to find food.',
      'Some deer species can run nearly as fast as a car on a city street.',
      'Deer have been on Earth for millions of years — they\'re older than humans!',
    ],
  },

  bear: {
    commonName: 'Brown Bear',
    scientificName: 'Ursus arctos',
    category: 'Mammal',
    approximateWeight: '~250–350 kg',
    approximateHeight: '~1–1.3 m at shoulder',
    approximateLength: '~1.7–2.5 m',
    topSpeed: '~50 km/h',
    averageLifespan: '~20–30 years',
    diet: ['Fish', 'Berries', 'Honey', 'Small mammals', 'Roots', 'Insects'],
    dietDescription: 'Eats meat, fish, berries, honey, and sometimes insects.',
    favouriteHabitat: ['Forests', 'Rivers', 'Mountains', 'Meadows'],
    conservationStatus: 'Least Concern',
    predators: ['Very few — other bears, wolves (cubs only)'],
    geographicRange: 'North America, Europe, and Northern Asia',
    sounds: 'Deep growling, woofing, and jaw popping when agitated',
    footprints: 'Very large paw prints with claw marks, about 25 cm long',
    funFacts: [
      'Bears can smell food from several kilometres away — their nose is 7 times better than a dog\'s!',
      'Bears can recognise hundreds of different smells in their territory.',
      'A bear can eat up to 40 kg of food per day before winter sleep.',
      'Bears don\'t truly hibernate — they enter a deep sleep called "torpor."',
      'Bear cubs are born tiny — about the size of a squirrel!',
      'Bears have been known to use rocks as tools to scratch themselves.',
      'Grizzly bears can run as fast as a horse over short distances.',
      'Bears are surprisingly good climbers — even large adults can scale trees.',
    ],
  },

  fox: {
    commonName: 'Red Fox',
    scientificName: 'Vulpes vulpes',
    category: 'Mammal',
    approximateWeight: '~5–12 kg',
    approximateHeight: '~35–40 cm at shoulder',
    approximateLength: '~45–90 cm (plus tail)',
    topSpeed: '~48 km/h',
    averageLifespan: '~3–5 years in wild',
    diet: ['Small mammals', 'Birds', 'Insects', 'Berries', 'Eggs'],
    dietDescription: 'Eats small animals, insects, berries, and sometimes fruit.',
    favouriteHabitat: ['Forest edges', 'Grasslands', 'Urban areas', 'Mountains'],
    conservationStatus: 'Least Concern',
    predators: ['Eagles', 'Wolves', 'Coyotes', 'Bears'],
    geographicRange: 'Found on every continent except Antarctica',
    sounds: 'High-pitched barks and screams, especially at night',
    footprints: 'Small oval paw prints, similar to a small dog\'s',
    funFacts: [
      'Foxes use Earth\'s magnetic field when hunting — they pounce toward magnetic north!',
      'Foxes have excellent hearing and can hear a mouse underground.',
      'A fox\'s bushy tail helps it balance when running and keeps it warm while sleeping.',
      'Fox kits play-fight to practise hunting skills from a very young age.',
      'Foxes are the only member of the dog family that can climb trees.',
      'Red foxes live on every continent except Antarctica.',
      'Foxes can make over 40 different sounds to communicate.',
      'A group of foxes is called a "skulk" or "leash."',
    ],
  },

  rabbit: {
    commonName: 'European Rabbit',
    scientificName: 'Oryctolagus cuniculus',
    category: 'Mammal',
    approximateWeight: '~1–2.5 kg',
    approximateHeight: '~15–20 cm at shoulder',
    approximateLength: '~35–45 cm',
    topSpeed: '~45 km/h',
    averageLifespan: '~1–3 years in wild',
    diet: ['Grass', 'Clover', 'Wildflowers', 'Vegetables', 'Bark'],
    dietDescription: 'Eats grass, clover, wildflowers, and sometimes bark in winter.',
    favouriteHabitat: ['Meadows', 'Grasslands', 'Forest edges', 'Burrows'],
    conservationStatus: 'Least Concern',
    predators: ['Foxes', 'Hawks', 'Owls', 'Snakes', 'Weasels'],
    geographicRange: 'Originally Europe, now found worldwide',
    sounds: 'Quiet thumping feet and soft squeaks',
    footprints: 'Small elongated prints with two long back feet and two round front feet',
    funFacts: [
      'Rabbit teeth never stop growing — they wear down by chewing tough plants.',
      'Rabbits communicate by thumping their back feet on the ground.',
      'A rabbit can turn its ears 180° to listen in any direction.',
      'Baby rabbits are called "kittens" — just like baby cats!',
      'Rabbits can see nearly 360° around them without turning their head.',
      'A happy rabbit will jump and twist in the air — this is called a "binky!"',
      'Rabbits can run in zigzag patterns to escape predators.',
      'Wild rabbits live in underground burrow systems called "warrens."',
    ],
  },
};

/**
 * Get a random fun fact for a species.
 * Uses a simple hash of animalId + counter to cycle through facts.
 */
let _factCounter = 0;
export function getRandomFunFact(species) {
  const data = SPECIES_DATA[species];
  if (!data?.funFacts?.length) return null;
  _factCounter++;
  return data.funFacts[_factCounter % data.funFacts.length];
}

/**
 * Get a specific fun fact by index (for deterministic display).
 */
export function getFunFactByIndex(species, index) {
  const data = SPECIES_DATA[species];
  if (!data?.funFacts?.length) return null;
  return data.funFacts[index % data.funFacts.length];
}

/**
 * Get species data by ID, resolving species from compound IDs like "deer-2".
 */
export function getSpeciesData(animalId) {
  if (!animalId) return null;
  const baseSpecies = animalId.replace(/-\d+$/, '');
  return SPECIES_DATA[baseSpecies] || null;
}

/**
 * Conservation status badge colors.
 */
export const CONSERVATION_COLORS = {
  'Least Concern': '#4ADE80',
  'Near Threatened': '#FACC15',
  'Vulnerable': '#FB923C',
  'Endangered': '#F87171',
  'Critically Endangered': '#EF4444',
};
