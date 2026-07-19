const { createClient } = require('@supabase/supabase-js');

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(url, key);

async function main() {
  for (let i = 1; i <= 9; i += 1) {
    const email = `testuser${i}@qpro.local`;
    const username = `testuser${i}`;
    const apellido = `User${i}`;
    const displayName = `Test User ${i}`;

    const { error } = await supabase.auth.admin.createUser({
      email,
      password: 'Test123456!',
      email_confirm: true,
      user_metadata: {
        username,
        nombre: 'Test',
        apellido,
        display_name: displayName,
      },
    });

    if (error && !String(error.message).toLowerCase().includes('already')) {
      console.log(`${email} ERROR: ${error.message}`);
    } else {
      console.log(`${email} ok`);
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
