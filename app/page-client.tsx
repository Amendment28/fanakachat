"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  MessageCircle, 
  Gift, 
  TrendingUp, 
  Smartphone,
  CheckCircle,
  Star
} from "lucide-react";
import Link from "next/link";
import { getPricingForCountry, COUNTRIES } from "@/lib/currency";
import { getDefaultLanguageForCountry, type LanguageCode } from "@/lib/languages";

export default function HomeClient() {
  const [selectedCountry, setSelectedCountry] = useState("US");
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>("en");
  const [pricing, setPricing] = useState(getPricingForCountry("US"));
  const [translations, setTranslations] = useState<any>(null);
  const [manualLanguageOverride, setManualLanguageOverride] = useState(false);

  // Auto-detect on first load
  useEffect(() => {
    if (typeof window !== 'undefined' && !manualLanguageOverride) {
      const browserLang = navigator.language.split('-')[0] as LanguageCode;
      const detectedLang = browserLang in {en:1, sw:1, id:1, hi:1, tl:1, am:1, rw:1} ? browserLang : 'en';
      setSelectedLanguage(detectedLang);
      
      // Load detected language
      import(`@/messages/${detectedLang}.json`)
        .then((module) => setTranslations(module.default))
        .catch(() => {
          import(`@/messages/en.json`).then((module) => setTranslations(module.default));
        });
    }
  }, []);

  // When country changes (via dropdown), update language automatically
  useEffect(() => {
    setPricing(getPricingForCountry(selectedCountry));
    
    if (!manualLanguageOverride) {
      const defaultLang = getDefaultLanguageForCountry(selectedCountry);
      setSelectedLanguage(defaultLang);
      
      // Load translations
      import(`@/messages/${defaultLang}.json`)
        .then((module) => setTranslations(module.default))
        .catch(() => {
          // Fallback to English
          import(`@/messages/en.json`).then((module) => setTranslations(module.default));
        });
    }
  }, [selectedCountry, manualLanguageOverride]);
  
  // When language manually changed
  const handleLanguageChange = (lang: LanguageCode) => {
    setManualLanguageOverride(true);
    setSelectedLanguage(lang);
    import(`@/messages/${lang}.json`)
      .then((module) => setTranslations(module.default))
      .catch(() => {
        import(`@/messages/en.json`).then((module) => setTranslations(module.default));
      });
  };
  
  // Use translations or fallback to English text
  const t = (path: string): any => {
    if (!translations) {
      // Return empty array for features paths while loading
      if (path.includes('features')) return [];
      return path;
    }
    const keys = path.split('.');
    let value: any = translations;
    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) {
        // Return empty array for features, string for others
        return path.includes('features') ? [] : path;
      }
    }
    return value;
  };

  const features = [
    {
      icon: MessageCircle,
      titleKey: "landing.features.whatsappNative.title",
      descKey: "landing.features.whatsappNative.description"
    },
    {
      icon: Gift,
      titleKey: "landing.features.loyaltyProgram.title",
      descKey: "landing.features.loyaltyProgram.description"
    },
    {
      icon: Star,
      titleKey: "landing.features.appointments.title",
      descKey: "landing.features.appointments.description"
    },
    {
      icon: TrendingUp,
      titleKey: "landing.features.boostRetention.title",
      descKey: "landing.features.boostRetention.description"
    },
    {
      icon: Smartphone,
      titleKey: "landing.features.autoAward.title",
      descKey: "landing.features.autoAward.description"
    }
  ];

  const getPricingTiers = () => [
    {
      nameKey: "landing.pricing.starter.name",
      key: "starter",
      featuresKey: "landing.pricing.starter.features",
      ctaKey: "landing.pricing.starter.cta"
    },
    {
      nameKey: "landing.pricing.growth.name",
      key: "growth",
      featuresKey: "landing.pricing.growth.features",
      popular: true,
      ctaKey: "landing.pricing.growth.cta"
    },
    {
      nameKey: "landing.pricing.business.name",
      key: "business",
      featuresKey: "landing.pricing.business.features",
      ctaKey: "landing.pricing.business.cta"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/10">
      {/* Nav */}
      <nav className="border-b border-primary/10 bg-background/80 backdrop-blur-sm fixed w-full z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg" />
              <span className="text-xl font-bold text-charcoal">ChatRewards</span>
            </div>
            <div className="flex gap-4 items-center">
              <select
                value={selectedCountry}
                onChange={(e) => {
                  setSelectedCountry(e.target.value);
                  setManualLanguageOverride(false); // Reset language override when country changes
                }}
                className="border border-primary/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              >
                {Object.values(COUNTRIES).map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name} ({country.currency})
                  </option>
                ))}
              </select>
              <Link 
                href="/admin" 
                className="text-charcoal/70 hover:text-primary transition-colors"
              >
                {t('landing.nav.signIn')}
              </Link>
              <Link 
                href="/admin" 
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
              >
                {t('landing.nav.getStarted')}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-6xl font-bold text-charcoal mb-6 leading-tight">
              {t('landing.hero.title')}
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                {t('landing.hero.subtitle')}
              </span>
            </h1>
            <p className="text-xl text-charcoal/70 mb-8 max-w-2xl mx-auto">
              {t('landing.hero.description')}
            </p>
            <div className="flex gap-4 justify-center">
              <Link 
                href="/admin"
                className="bg-primary text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-primary-dark transition-all hover:scale-105 shadow-lg"
              >
                {t('landing.hero.startTrial')}
              </Link>
              <button className="border-2 border-primary text-primary px-8 py-4 rounded-lg text-lg font-semibold hover:bg-primary/5 transition-all">
                {t('landing.hero.watchDemo')}
              </button>
            </div>
          </motion.div>

          {/* Hero Image Placeholder */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-16 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl p-8 shadow-2xl"
          >
            <div className="aspect-video bg-white/50 rounded-lg flex items-center justify-center overflow-hidden">
              <img 
                src="/whatsapp-demo.jpg" 
                alt="FanakaChat WhatsApp loyalty program demo showing automated points and rewards"
                className="w-full h-full object-contain"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-charcoal mb-4">
              {t('landing.features.title')}
            </h2>
            <p className="text-xl text-charcoal/70">
              {t('landing.features.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="p-6 rounded-xl bg-gradient-to-br from-primary/5 to-secondary/5 hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-charcoal mb-2">
                  {t(feature.titleKey)}
                </h3>
                <p className="text-charcoal/70">
                  {t(feature.descKey)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-charcoal mb-4">
              {t('landing.pricing.title')}
            </h2>
            <p className="text-xl text-charcoal/70">
              {t('landing.pricing.subtitle').replace('{country}', COUNTRIES[selectedCountry]?.name || '')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {getPricingTiers().map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                className={`p-8 rounded-2xl ${
                  plan.popular
                    ? "bg-gradient-to-br from-primary to-primary-dark text-white shadow-2xl scale-105"
                    : "bg-white"
                }`}
              >
                {plan.popular && (
                  <div className="flex items-center gap-1 mb-4">
                    <Star className="w-4 h-4 fill-secondary text-secondary" />
                    <span className="text-sm font-semibold text-secondary">{t('landing.pricing.mostPopular')}</span>
                  </div>
                )}
                <h3 className={`text-2xl font-bold mb-2 ${plan.popular ? "text-white" : "text-charcoal"}`}>
                  {t(plan.nameKey)}
                </h3>
                <div className="mb-6">
                  <span className={`text-5xl font-bold ${plan.popular ? "text-white" : "text-primary"}`}>
                    {pricing?.symbol} {pricing?.[plan.key as keyof typeof pricing]?.toLocaleString()}
                  </span>
                  <span className={plan.popular ? "text-white/80" : "text-charcoal/60"}>
                    {t('landing.pricing.perMonth')}
                  </span>
                </div>
                <ul className="space-y-3 mb-8">
                  {(() => {
                    const features = t(plan.featuresKey);
                    const featureArray = Array.isArray(features) ? features : [];
                    return featureArray.map((feature: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle className={`w-5 h-5 flex-shrink-0 ${
                          plan.popular ? "text-secondary" : "text-primary"
                        }`} />
                        <span className={plan.popular ? "text-white/90" : "text-charcoal/80"}>
                          {feature}
                        </span>
                      </li>
                    ));
                  })()}
                </ul>
                <Link
                  href="/admin"
                  className={`block text-center py-3 rounded-lg font-semibold transition-all ${
                    plan.popular
                      ? "bg-secondary text-white hover:bg-secondary-dark"
                      : "bg-primary text-white hover:bg-primary-dark"
                  }`}
                >
                  {t(plan.ctaKey)}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary to-primary-dark">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            {t('landing.cta.title')}
          </h2>
          <p className="text-xl text-white/90 mb-8">
            {t('landing.cta.subtitle')}
          </p>
          <Link
            href="/admin"
            className="inline-block bg-secondary text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-secondary-dark transition-all hover:scale-105 shadow-lg"
          >
            {t('landing.cta.button')}
          </Link>
          <p className="text-white/70 mt-4">{t('landing.cta.noCreditCard')}</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-charcoal text-white/70 py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg" />
            <span className="text-xl font-bold text-white">ChatRewards</span>
          </div>
          <p className="mb-4">{t('landing.footer.tagline')}</p>
          <p className="text-sm">{t('landing.footer.copyright')}</p>
        </div>
      </footer>
    </div>
  );
}
