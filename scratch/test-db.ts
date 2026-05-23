import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function test() {
  console.log("Connecting to Supabase at:", supabaseUrl);
  
  // 1. Check Profiles
  const { data: profiles, error: pError } = await supabase
    .from("profiles")
    .select("*");
  if (pError) console.error("Error fetching profiles:", pError);
  else console.log("Profiles count:", profiles?.length, profiles);

  // 2. Check Households
  const { data: households, error: hError } = await supabase
    .from("households")
    .select("*");
  if (hError) console.error("Error fetching households:", hError);
  else console.log("Households count:", households?.length, households);

  // 3. Check Memberships
  const { data: members, error: mError } = await supabase
    .from("household_members")
    .select("*");
  if (mError) console.error("Error fetching members:", mError);
  else console.log("Members count:", members?.length, members);

  // 4. Check Wallets
  const { data: wallets, error: wError } = await supabase
    .from("wallets")
    .select("*");
  if (wError) console.error("Error fetching wallets:", wError);
  else console.log("Wallets count:", wallets?.length, wallets);
}

test();
