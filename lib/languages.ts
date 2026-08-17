// Supported languages for all 12 countries

export const LANGUAGES = {
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    countries: ["KE", "NG", "GH", "ZA", "ZM", "UG", "IN", "PH"],
  },
  sw: {
    code: "sw",
    name: "Swahili",
    nativeName: "Kiswahili",
    countries: ["KE", "TZ", "UG"],
  },
  id: {
    code: "id",
    name: "Indonesian",
    nativeName: "Bahasa Indonesia",
    countries: ["ID"],
  },
  hi: {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    countries: ["IN"],
  },
  tl: {
    code: "tl",
    name: "Tagalog",
    nativeName: "Tagalog",
    countries: ["PH"],
  },
  am: {
    code: "am",
    name: "Amharic",
    nativeName: "አማርኛ",
    countries: ["ET"],
  },
  rw: {
    code: "rw",
    name: "Kinyarwanda",
    nativeName: "Ikinyarwanda",
    countries: ["RW"],
  },
} as const;

export type LanguageCode = keyof typeof LANGUAGES;

// Get languages available for a country
export function getLanguagesForCountry(countryCode: string): LanguageCode[] {
  return Object.entries(LANGUAGES)
    .filter(([_, lang]) => lang.countries.includes(countryCode))
    .map(([code]) => code as LanguageCode);
}

// Detect language from browser
export function detectBrowserLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";
  
  const browserLang = navigator.language.split("-")[0];
  return (browserLang in LANGUAGES ? browserLang : "en") as LanguageCode;
}

// Get default language for a country
export function getDefaultLanguageForCountry(countryCode: string): LanguageCode {
  const countryLanguageMap: Record<string, LanguageCode> = {
    KE: "sw",  // Kenya - Swahili
    TZ: "sw",  // Tanzania - Swahili
    UG: "sw",  // Uganda - Swahili
    GH: "en",  // Ghana - English
    NG: "en",  // Nigeria - English
    ZA: "en",  // South Africa - English
    RW: "rw",  // Rwanda - Kinyarwanda
    ET: "am",  // Ethiopia - Amharic
    ZM: "en",  // Zambia - English
    IN: "hi",  // India - Hindi
    ID: "id",  // Indonesia - Bahasa Indonesia
    PH: "tl",  // Philippines - Tagalog
    US: "en",  // United States - English
  };
  
  return countryLanguageMap[countryCode] || "en";
}
