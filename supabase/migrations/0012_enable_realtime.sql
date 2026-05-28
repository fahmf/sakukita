-- Saku Kita — Enable Supabase Realtime for synchronization (0012)
-- Enables Realtime replication for critical tables to allow multi-device sync

ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE categories;
ALTER PUBLICATION supabase_realtime ADD TABLE budgets;
ALTER PUBLICATION supabase_realtime ADD TABLE savings_goals;
ALTER PUBLICATION supabase_realtime ADD TABLE debts;
ALTER PUBLICATION supabase_realtime ADD TABLE recurring_transactions;
