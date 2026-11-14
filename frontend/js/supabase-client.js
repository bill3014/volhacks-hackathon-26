const SUPABASE_URL = "https://wrcjofhpvymccveoijnj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Qi-W8CyTLnrsA5nr75DuFQ_DGZTPDSw";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);