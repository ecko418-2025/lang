// Supabase Client Boilerplate
// Replace 'YOUR_SUPABASE_URL' and 'YOUR_SUPABASE_ANON_KEY' with your actual Supabase project credentials.

const SUPABASE_URL = 'https://nqwzybdymdzgvhtvjugo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_LychNAytZzXicbp23aJ9fg_P3o-JD8Y';

// Initialize the Supabase client
// We assume the Supabase JS library is loaded via CDN before this script
if (typeof window.supabase === 'undefined') {
  alert('无法加载 Supabase 核心代码库。这通常是因为您的网络无法访问 cdn.jsdelivr.net（国内常见情况）。建议您开启全局代理，或在代码中更换 CDN 源。');
} else {
  try {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabaseClient = supabase;
  } catch (err) {
    alert('Supabase 初始化代码出错（可能是密钥格式等问题）：' + err.message);
  }
}
