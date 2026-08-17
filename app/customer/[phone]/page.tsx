"use client";

import { motion } from "framer-motion";
import { Gift, History, TrendingUp, Award } from "lucide-react";
import { use } from "react";

export default function CustomerDashboard({ params }: { params: Promise<{ phone: string }> }) {
  const { phone } = use(params);
  
  // Mock data - will be replaced with Supabase
  const customer = {
    name: "John Kamau",
    phone: phone,
    points: 450,
    tier: "Gold"
  };

  const transactions = [
    { id: 1, type: "earned", points: 50, description: "Purchase - Maize Flour 2kg", date: "2026-08-08" },
    { id: 2, type: "earned", points: 30, description: "Purchase - Cooking Oil 1L", date: "2026-08-06" },
    { id: 3, type: "redeemed", points: -100, description: "Redeemed - 10% Discount", date: "2026-08-05" },
    { id: 4, type: "earned", points: 75, description: "Purchase - Sugar 5kg", date: "2026-08-03" },
  ];

  const rewards = [
    { id: 1, name: "10% Off Next Purchase", points: 100, available: true },
    { id: 2, name: "Free Delivery", points: 200, available: true },
    { id: 3, name: "20% Off Next Purchase", points: 300, available: true },
    { id: 4, name: "Free Product (up to KES 500)", points: 500, available: false },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/10">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary to-primary-dark text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-white/20 rounded-lg" />
            <span className="text-lg font-bold">ChatRewards</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Welcome back, {customer.name}!</h1>
          <p className="text-white/80">{customer.phone}</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Points Balance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-secondary to-secondary-dark text-white rounded-2xl p-8 mb-8 shadow-2xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 mb-2">Your Points Balance</p>
              <p className="text-6xl font-bold">{customer.points}</p>
              <p className="text-white/80 mt-2 flex items-center gap-2">
                <Award className="w-5 h-5" />
                {customer.tier} Member
              </p>
            </div>
            <Gift className="w-20 h-20 opacity-20" />
          </div>
        </motion.div>

        {/* Available Rewards */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-charcoal mb-4 flex items-center gap-2">
            <Gift className="w-6 h-6 text-primary" />
            Available Rewards
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {rewards.map((reward, i) => (
              <motion.div
                key={reward.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className={`bg-white rounded-xl p-6 shadow-lg ${
                  reward.available ? "border-2 border-primary" : "opacity-50"
                }`}
              >
                <h3 className="font-bold text-lg text-charcoal mb-2">{reward.name}</h3>
                <div className="flex items-center justify-between">
                  <span className="text-primary font-bold">{reward.points} points</span>
                  {reward.available ? (
                    <button className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors">
                      Redeem
                    </button>
                  ) : (
                    <span className="text-charcoal/40 text-sm">Not enough points</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-charcoal mb-4 flex items-center gap-2">
            <History className="w-6 h-6 text-primary" />
            Recent Activity
          </h2>
          <div className="space-y-4">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between border-b border-primary/10 pb-4 last:border-0">
                <div>
                  <p className="font-medium text-charcoal">{tx.description}</p>
                  <p className="text-sm text-charcoal/60">{tx.date}</p>
                </div>
                <div className={`font-bold text-lg ${
                  tx.type === "earned" ? "text-primary" : "text-accent"
                }`}>
                  {tx.points > 0 ? "+" : ""}{tx.points}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
