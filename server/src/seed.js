export async function seedAdmin(store) {
  const n = await store.countUsers();
  if (n > 0) return;
  await store.createUser({ name: 'Administrator', email: 'admin@gridguard.local', password: 'admin123', role: 'administrator' });
  console.log('[seed] admin@gridguard.local / admin123');
}
