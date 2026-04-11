
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'apps/dashboard/.env.local' });

async function check() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  // Try to insert a dummy expense with repairs_maintenance
  const { data, error } = await supabase
    .from('expenses')
    .insert({
       merchant_id: '00000000-0000-0000-0000-000000000000', // Dummy
       receipt_url: 'http://test.com',
       receipt_storage_path: 'test',
       category: 'repairs_maintenance'
    });

  if (error) {
    console.log('INSERT ERROR:', error.message);
  } else {
    console.log('INSERT SUCCESS');
  }
}

check();
