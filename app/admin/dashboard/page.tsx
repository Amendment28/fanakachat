"use client";

import { useEffect, useState } from "react";
import { Users, TrendingUp, Gift, Activity, Globe } from "lucide-react";
import { COUNTRIES, getPricingForCountry } from "@/lib/currency";
import { getDefaultLanguageForCountry, type LanguageCode, LANGUAGES } from "@/lib/languages";

interface Customer {
  id: string;
  name: string;
  phoneNumber: string;
  points: number;
  totalSpent: number;
  currency: string;
  createdAt: string;
  _count: {
    transactions: number;
  };
}

interface Reward {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
  isActive: boolean;
}

interface Transaction {
  id: string;
  type: string;
  points: number;
  amount: number | null;
  currency: string | null;
  createdAt: string;
  customer: {
    name: string;
    phoneNumber: string;
  };
  reward: {
    name: string;
  } | null;
  redemptionCode: string | null;
}

export default function AdminDashboard() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<"customers" | "rewards" | "transactions">("customers");
  const [loading, setLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState("US");
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>("en");
  const [translations, setTranslations] = useState<any>(null);

  // Demo shop ID (in production, get from auth session)
  const SHOP_ID = "cmsphaxgp0000dxndn50fqouz";

  // Auto-detect country/language on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const browserLang = navigator.language.split('-')[0] as LanguageCode;
      const detectedLang = browserLang in LANGUAGES ? browserLang : 'en';
      setSelectedLanguage(detectedLang);
      
      // Load translations
      import(`@/messages/${detectedLang}.json`)
        .then((module) => setTranslations(module.default))
        .catch(() => {
          import(`@/messages/en.json`).then((module) => setTranslations(module.default));
        });
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  // When country changes, update language
  useEffect(() => {
    const defaultLang = getDefaultLanguageForCountry(selectedCountry);
    setSelectedLanguage(defaultLang);
    
    import(`@/messages/${defaultLang}.json`)
      .then((module) => setTranslations(module.default))
      .catch(() => {
        import(`@/messages/en.json`).then((module) => setTranslations(module.default));
      });
  }, [selectedCountry]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [customersRes, rewardsRes, transactionsRes] = await Promise.all([
        fetch(`/api/customers?shopId=${SHOP_ID}`),
        fetch(`/api/rewards?shopId=${SHOP_ID}`),
        fetch(`/api/transactions?shopId=${SHOP_ID}&limit=20`),
      ]);

      const customersData = await customersRes.json();
      const rewardsData = await rewardsRes.json();
      const transactionsData = await transactionsRes.json();

      setCustomers(customersData.customers || []);
      setRewards(rewardsData.rewards || []);
      setTransactions(transactionsData.transactions || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const t = (path: string): any => {
    if (!translations) return path;
    const keys = path.split('.');
    let value: any = translations;
    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) return path;
    }
    return value;
  };

  const stats = {
    totalCustomers: customers.length,
    totalPoints: customers.reduce((sum, c) => sum + c.points, 0),
    activeRewards: rewards.filter((r) => r.isActive).length,
    recentTransactions: transactions.length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-charcoal/70">{t('admin.loading') || 'Loading dashboard...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/10">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-primary/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg" />
              <h1 className="text-2xl font-bold text-charcoal">ChatRewards Admin</h1>
            </div>
            <div className="flex items-center gap-4">
              {/* Country/Currency Selector */}
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="border border-primary/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white"
              >
                {Object.values(COUNTRIES).map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name} ({country.currency})
                  </option>
                ))}
              </select>

              {/* Language Selector */}
              <select
                value={selectedLanguage}
                onChange={(e) => {
                  const lang = e.target.value as LanguageCode;
                  setSelectedLanguage(lang);
                  import(`@/messages/${lang}.json`)
                    .then((module) => setTranslations(module.default))
                    .catch(() => {
                      import(`@/messages/en.json`).then((module) => setTranslations(module.default));
                    });
                }}
                className="border border-primary/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white"
              >
                {Object.values(LANGUAGES).map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.nativeName}
                  </option>
                ))}
              </select>

              <button className="text-sm text-charcoal/70 hover:text-primary transition-colors">
                {t('admin.settings') || 'Settings'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-primary/10 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-charcoal/60">{t('admin.stats.totalCustomers') || 'Total Customers'}</p>
                <p className="text-3xl font-bold text-charcoal mt-2">{stats.totalCustomers}</p>
              </div>
              <div className="bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl p-3">
                <Users className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-primary/10 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-charcoal/60">{t('admin.stats.totalPoints') || 'Total Points Awarded'}</p>
                <p className="text-3xl font-bold text-charcoal mt-2">{stats.totalPoints.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl p-3">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-secondary/20 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-charcoal/60">{t('admin.stats.activeRewards') || 'Active Rewards'}</p>
                <p className="text-3xl font-bold text-charcoal mt-2">{stats.activeRewards}</p>
              </div>
              <div className="bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-xl p-3">
                <Gift className="w-6 h-6 text-secondary" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-accent/20 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-charcoal/60">{t('admin.stats.recentTransactions') || 'Recent Transactions'}</p>
                <p className="text-3xl font-bold text-charcoal mt-2">{stats.recentTransactions}</p>
              </div>
              <div className="bg-gradient-to-br from-accent/20 to-accent/10 rounded-xl p-3">
                <Activity className="w-6 h-6 text-accent" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-primary/10">
          <div className="border-b border-primary/10">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {["customers", "rewards", "transactions"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`${
                    activeTab === tab
                      ? "border-primary text-primary"
                      : "border-transparent text-charcoal/50 hover:text-primary hover:border-primary/30"
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors`}
                >
                  {t(`admin.tabs.${tab}`) || tab}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Customers Tab */}
            {activeTab === "customers" && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold text-charcoal">{t('admin.tabs.customers') || 'Customers'}</h2>
                  <button className="bg-gradient-to-r from-primary to-primary/90 text-white px-4 py-2 rounded-lg text-sm hover:shadow-lg transition-all hover:scale-105">
                    {t('admin.actions.addCustomer') || 'Add Customer'}
                  </button>
                </div>
                {customers.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-charcoal/60">{t('admin.empty.customers') || 'No customers yet'}</p>
                    <p className="text-sm text-charcoal/40 mt-2">
                      {t('admin.empty.customersHint') || 'Customers will appear here when they interact with your WhatsApp bot'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-primary/10">
                      <thead>
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-charcoal/60 uppercase tracking-wider">
                            {t('admin.table.customer') || 'Customer'}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-charcoal/60 uppercase tracking-wider">
                            {t('admin.table.points') || 'Points'}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-charcoal/60 uppercase tracking-wider">
                            {t('admin.table.totalSpent') || 'Total Spent'}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-charcoal/60 uppercase tracking-wider">
                            {t('admin.table.transactions') || 'Transactions'}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-charcoal/60 uppercase tracking-wider">
                            {t('admin.table.joined') || 'Joined'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-primary/5">
                        {customers.map((customer) => (
                          <tr key={customer.id} className="hover:bg-primary/5 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-charcoal">{customer.name}</div>
                                <div className="text-sm text-charcoal/60">{customer.phoneNumber}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                {customer.points} {t('admin.table.pointsLabel') || 'points'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal">
                              {customer.currency} {customer.totalSpent.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal/60">
                              {customer._count.transactions}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal/60">
                              {new Date(customer.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Rewards Tab */}
            {activeTab === "rewards" && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold text-charcoal">{t('admin.tabs.rewards') || 'Rewards'}</h2>
                  <button className="bg-gradient-to-r from-primary to-primary/90 text-white px-4 py-2 rounded-lg text-sm hover:shadow-lg transition-all hover:scale-105">
                    {t('admin.actions.createReward') || 'Create Reward'}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {rewards.map((reward) => (
                    <div
                      key={reward.id}
                      className={`border rounded-xl p-6 transition-all hover:shadow-lg ${
                        reward.isActive ? "bg-white/80 border-primary/20" : "bg-charcoal/5 border-charcoal/20 opacity-60"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-semibold text-charcoal">{reward.name}</h3>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            reward.isActive ? "bg-primary/10 text-primary" : "bg-charcoal/10 text-charcoal/60"
                          }`}
                        >
                          {reward.isActive ? (t('admin.status.active') || 'Active') : (t('admin.status.inactive') || 'Inactive')}
                        </span>
                      </div>
                      {reward.description && (
                        <p className="text-sm text-charcoal/60 mb-4">{reward.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-primary">{reward.pointsCost}</span>
                        <span className="text-sm text-charcoal/60">{t('admin.table.pointsLabel') || 'points'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transactions Tab */}
            {activeTab === "transactions" && (
              <div>
                <h2 className="text-lg font-semibold text-charcoal mb-6">{t('admin.tabs.transactions') || 'Recent Transactions'}</h2>
                {transactions.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-charcoal/60">{t('admin.empty.transactions') || 'No transactions yet'}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-primary/10">
                      <thead>
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-charcoal/60 uppercase tracking-wider">
                            {t('admin.table.customer') || 'Customer'}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-charcoal/60 uppercase tracking-wider">
                            {t('admin.table.type') || 'Type'}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-charcoal/60 uppercase tracking-wider">
                            {t('admin.table.points') || 'Points'}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-charcoal/60 uppercase tracking-wider">
                            {t('admin.table.amount') || 'Amount'}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-charcoal/60 uppercase tracking-wider">
                            {t('admin.table.date') || 'Date'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-primary/5">
                        {transactions.map((transaction) => (
                          <tr key={transaction.id} className="hover:bg-primary/5 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-charcoal">{transaction.customer.name}</div>
                                <div className="text-sm text-charcoal/60">{transaction.customer.phoneNumber}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  transaction.type === "EARN"
                                    ? "bg-primary/10 text-primary"
                                    : "bg-secondary/20 text-secondary"
                                }`}
                              >
                                {transaction.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`text-sm font-semibold ${
                                  transaction.points > 0 ? "text-primary" : "text-accent"
                                }`}
                              >
                                {transaction.points > 0 ? "+" : ""}
                                {transaction.points}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal">
                              {transaction.amount && transaction.currency
                                ? `${transaction.currency} ${transaction.amount.toLocaleString()}`
                                : transaction.reward?.name || "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal/60">
                              {new Date(transaction.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
