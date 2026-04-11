const postgres = require('postgres');

const projectRef = 'dgafjyrittkskxlgswvf';
const password = 'iSU3aOFvpUlnZnRG';
const regions = ['ap-southeast-1', 'us-east-1'];
    const partition = 'aws-1'; // New partition found in .temp/pooler-url

async function test() {
  for (const region of regions) {
    const host = `${partition}-${region}.pooler.supabase.com`;
    const connectionString = `postgresql://postgres.${projectRef}:${password}@${host}:6543/postgres`;
    console.log(`Testing ${region}...`);
    const sql = postgres(connectionString, { timeout: 5 });
    try {
      const result = await sql`SELECT 1`;
      console.log(`✅ Success with ${region}`);
      process.exit(0);
    } catch (err) {
      console.log(`❌ Failed with ${region}: ${err.message}`);
    } finally {
      await sql.end();
    }
  }
}

test();
