-- ChatRewards Database Schema

-- Businesses table
CREATE TABLE businesses (
  id BIGSERIAL PRIMARY KEY,
  business_name TEXT NOT NULL,
  owner_email TEXT UNIQUE NOT NULL,
  whatsapp_number TEXT,
  twilio_account_sid TEXT,
  twilio_auth_token TEXT,
  twilio_phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers table
CREATE TABLE customers (
  id BIGSERIAL PRIMARY KEY,
  business_id BIGINT REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  points_balance INTEGER DEFAULT 0,
  points_per_100_currency INTEGER DEFAULT 1, -- How many points per 100 KES/NGN/etc
  opt_in_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, phone)
);

-- Transactions table
CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('earn', 'redeem')),
  points INTEGER NOT NULL,
  description TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rewards table
CREATE TABLE rewards (
  id BIGSERIAL PRIMARY KEY,
  business_id BIGINT REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  points_required INTEGER NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_customers_business ON customers(business_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_transactions_customer ON transactions(customer_id);
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX idx_rewards_business ON rewards(business_id);

-- Row Level Security (RLS)
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

-- Policies (add after Supabase Auth is set up)
-- Business owners can only see their own data
CREATE POLICY "Business owners can view their own business" ON businesses
  FOR SELECT USING (auth.uid() = owner_email::uuid);

CREATE POLICY "Business owners can view their customers" ON customers
  FOR ALL USING (business_id IN (
    SELECT id FROM businesses WHERE owner_email::uuid = auth.uid()
  ));

CREATE POLICY "Business owners can view their transactions" ON transactions
  FOR ALL USING (customer_id IN (
    SELECT id FROM customers WHERE business_id IN (
      SELECT id FROM businesses WHERE owner_email::uuid = auth.uid()
    )
  ));

CREATE POLICY "Business owners can manage their rewards" ON rewards
  FOR ALL USING (business_id IN (
    SELECT id FROM businesses WHERE owner_email::uuid = auth.uid()
  ));
