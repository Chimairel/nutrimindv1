import type { PublicMealImage } from '@/types';

// Exact approved recipe identities and metadata from docs/meal-images/generated/approved-meal-images.csv.
// Unreviewed recipe names must not borrow an unrelated photograph via ingredient keywords.
export const reviewedMealImages: Record<string, PublicMealImage> = {
  'scrambled egg and rice plate': {
    url: '/meals/scrambled-egg-rice.jpg',
    altText: 'Fried egg served over a bowl of vegetable rice',
    kind: 'REPRESENTATIVE',
    attribution: {
      creator: 'PaulGorduiz106',
      sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Fried_rice_with_egg_(03-10-2021).jpg',
      licenseCode: 'CC_BY_SA_4_0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      modifications: 'Resized and cropped for display.',
    },
  },
  'pandesal, egg and tomato breakfast': {
    url: '/meals/pandesal.jpg',
    altText: 'Fresh Filipino pandesal rolls served on a plate',
    kind: 'REPRESENTATIVE',
    attribution: {
      creator: 'Jessartcam',
      sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Pinoy_Pandesal.jpg',
      licenseCode: 'CC_BY_SA_4_0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      modifications: 'Resized and cropped for display.',
    },
  },
  'banana peanut butter oatmeal': {
    url: '/meals/oatmeal.jpg',
    altText: 'A bowl of cooked oatmeal with milk',
    kind: 'REPRESENTATIVE',
    attribution: {
      creator: 'Renee Comet (Photographer)',
      sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Oatmeal_(1).jpg',
      licenseCode: 'PUBLIC_DOMAIN',
      licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
      modifications: 'Resized and cropped for display.',
    },
  },
  'beef rice bowl with cabbage': {
    url: '/meals/beef-bowl.jpg',
    altText: 'A braised beef and vegetable rice bowl',
    kind: 'REPRESENTATIVE',
    attribution: {
      creator: 'Andy Li',
      sourcePageUrl:
        'https://commons.wikimedia.org/wiki/File:Braised_Beef_Shin_Rice_Bowl_-_Tiger_Bites_Pig_2025-09-17.jpg',
      licenseCode: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en',
      modifications: 'Resized and cropped for display.',
    },
  },
  'pork rice bowl with carrots': {
    url: '/meals/pork-bowl.jpg',
    altText: 'A braised pork rice bowl with vegetables',
    kind: 'REPRESENTATIVE',
    attribution: {
      creator: 'Andy Li',
      sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Braised_Pork_Rice_Bowl_-_Noodles_Street_2025-10-15.jpg',
      licenseCode: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en',
      modifications: 'Resized and cropped for display.',
    },
  },
  'tuna cucumber rice bowl': {
    url: '/meals/tuna-bowl.jpg',
    altText: 'A tuna, salmon, cucumber, and vegetable rice bowl',
    kind: 'REPRESENTATIVE',
    attribution: {
      creator: 'Andy Li',
      sourcePageUrl:
        'https://commons.wikimedia.org/wiki/File:Salmon_%26_Tuna_Poke_Bowl_(M)_with_Spicy_Mayo_sauce_-_Kitokito_2025-04-25.jpg',
      licenseCode: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en',
      modifications: 'Resized and cropped for display.',
    },
  },
  'tofu vegetable rice bowl': {
    url: '/meals/tofu-bowl.jpg',
    altText: 'A tofu and vegetable rice bowl',
    kind: 'REPRESENTATIVE',
    attribution: {
      creator: 'Andy Li',
      sourcePageUrl:
        'https://commons.wikimedia.org/wiki/File:Salt_%26_Pepper_Tofu_Rice_Bowl_-_Tiger_Bites_Pig_2025-11-20.jpg',
      licenseCode: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en',
      modifications: 'Resized and cropped for display.',
    },
  },
};
