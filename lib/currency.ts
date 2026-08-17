// Currency configuration for 9 African countries

export interface CountryConfig {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  phonePrefix: string;
  pointsPerUnit: number; // Default: 1 point per X currency units
}

export const COUNTRIES: Record<string, CountryConfig> = {
  KE: {
    code: "KE",
    name: "Kenya",
    currency: "KES",
    currencySymbol: "KES",
    phonePrefix: "+254",
    pointsPerUnit: 100, // 1 point per 100 KES
  },
  TZ: {
    code: "TZ",
    name: "Tanzania",
    currency: "TZS",
    currencySymbol: "TZS",
    phonePrefix: "+255",
    pointsPerUnit: 2000, // 1 point per 2000 TZS
  },
  GH: {
    code: "GH",
    name: "Ghana",
    currency: "GHS",
    currencySymbol: "GH₵",
    phonePrefix: "+233",
    pointsPerUnit: 15, // 1 point per 15 GHS
  },
  NG: {
    code: "NG",
    name: "Nigeria",
    currency: "NGN",
    currencySymbol: "₦",
    phonePrefix: "+234",
    pointsPerUnit: 1500, // 1 point per 1500 NGN
  },
  ZA: {
    code: "ZA",
    name: "South Africa",
    currency: "ZAR",
    currencySymbol: "R",
    phonePrefix: "+27",
    pointsPerUnit: 20, // 1 point per 20 ZAR
  },
  UG: {
    code: "UG",
    name: "Uganda",
    currency: "UGX",
    currencySymbol: "UGX",
    phonePrefix: "+256",
    pointsPerUnit: 4000, // 1 point per 4000 UGX
  },
  RW: {
    code: "RW",
    name: "Rwanda",
    currency: "RWF",
    currencySymbol: "RWF",
    phonePrefix: "+250",
    pointsPerUnit: 1200, // 1 point per 1200 RWF
  },
  ET: {
    code: "ET",
    name: "Ethiopia",
    currency: "ETB",
    currencySymbol: "ETB",
    phonePrefix: "+251",
    pointsPerUnit: 60, // 1 point per 60 ETB
  },
  ZM: {
    code: "ZM",
    name: "Zambia",
    currency: "ZMW",
    currencySymbol: "ZMW",
    phonePrefix: "+260",
    pointsPerUnit: 25, // 1 point per 25 ZMW
  },
  IN: {
    code: "IN",
    name: "India",
    currency: "INR",
    currencySymbol: "₹",
    phonePrefix: "+91",
    pointsPerUnit: 1000, // 1 point per 1000 INR
  },
  ID: {
    code: "ID",
    name: "Indonesia",
    currency: "IDR",
    currencySymbol: "Rp",
    phonePrefix: "+62",
    pointsPerUnit: 150000, // 1 point per 150,000 IDR
  },
  PH: {
    code: "PH",
    name: "Philippines",
    currency: "PHP",
    currencySymbol: "₱",
    phonePrefix: "+63",
    pointsPerUnit: 500, // 1 point per 500 PHP
  },
  US: {
    code: "US",
    name: "United States",
    currency: "USD",
    currencySymbol: "$",
    phonePrefix: "+1",
    pointsPerUnit: 10, // 1 point per $10
  },
};

// Detect country from phone number
export function detectCountryFromPhone(phoneNumber: string): CountryConfig | null {
  // Remove spaces, dashes, parentheses
  const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, "");
  
  // Try to match phone prefix
  for (const country of Object.values(COUNTRIES)) {
    if (cleaned.startsWith(country.phonePrefix)) {
      return country;
    }
  }
  
  return null;
}

// Format currency amount
export function formatCurrency(amount: number, countryCode: string): string {
  const country = COUNTRIES[countryCode];
  if (!country) return `${amount}`;
  
  return `${country.currencySymbol} ${amount.toLocaleString()}`;
}

// Calculate points from amount spent
export function calculatePoints(amount: number, countryCode: string): number {
  const country = COUNTRIES[countryCode];
  if (!country) return 0;
  
  return Math.floor(amount / country.pointsPerUnit);
}

// Get pricing tiers for a country
export function getPricingForCountry(countryCode: string) {
  const country = COUNTRIES[countryCode];
  if (!country) return null;

  // Base pricing in USD equivalent
  const starterUSD = 15;
  const growthUSD = 35;
  const businessUSD = 80;

  // Currency conversion rates (approximate, update regularly)
  const conversionRates: Record<string, number> = {
    KES: 130,    // 1 USD = 130 KES
    TZS: 2500,   // 1 USD = 2500 TZS
    GHS: 12,     // 1 USD = 12 GHS
    NGN: 1600,   // 1 USD = 1600 NGN
    ZAR: 18,     // 1 USD = 18 ZAR
    UGX: 3700,   // 1 USD = 3700 UGX
    RWF: 1300,   // 1 USD = 1300 RWF
    ETB: 120,    // 1 USD = 120 ETB
    ZMW: 27,     // 1 USD = 27 ZMW
    INR: 83,     // 1 USD = 83 INR
    IDR: 15500,  // 1 USD = 15,500 IDR
    PHP: 56,     // 1 USD = 56 PHP
    USD: 1,      // 1 USD = 1 USD
  };

  const rate = conversionRates[country.currency] || 1;

  return {
    starter: Math.round(starterUSD * rate),
    growth: Math.round(growthUSD * rate),
    business: Math.round(businessUSD * rate),
    currency: country.currency,
    symbol: country.currencySymbol,
  };
}
