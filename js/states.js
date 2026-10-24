export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo",
  "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa",
  "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba",
  "Yobe", "Zamfara",
];

/** Map full-state names to catalogue availability keys. */
export function catalogLocationForState(state = "") {
  const map = {
    FCT: "Abuja",
    Abuja: "Abuja",
    Oyo: "Ibadan",
    Rivers: "Port Harcourt",
    Lagos: "Lagos",
  };
  return map[state] || state;
}

export const LOCATIONS = NIGERIAN_STATES;

export const CATEGORIES = [
  "All",
  "Champagne",
  "Whisky",
  "Cognac",
  "Wines",
  "Sparkling Wines",
  "Spirits",
  "Beer & Ciders",
  "Mixers & Soft Drinks",
  "Extras",
];
