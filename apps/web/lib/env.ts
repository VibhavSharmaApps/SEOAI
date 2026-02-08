// Environment variable validation and type-safe access
// This ensures all required env vars are present at build time

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  
  return value;
}

function getOptionalEnvVar(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue;
}

// Public environment variables (exposed to browser)
export const env = {
  // Supabase
  supabase: {
    url: getEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  },
  
  // App
  app: {
    url: getEnvVar('NEXT_PUBLIC_APP_URL'),
    env: getEnvVar('NODE_ENV', 'development'),
  },
} as const;

// Server-only environment variables (never exposed to browser)
export const serverEnv = {
  // Supabase
  supabase: {
    serviceRoleKey: getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
  },
  
  // Database
  database: {
    url: getEnvVar('DATABASE_URL'),
  },
  
  // AI Providers
  ai: {
    openaiKey: getOptionalEnvVar('OPENAI_API_KEY'),
    anthropicKey: getOptionalEnvVar('ANTHROPIC_API_KEY'),
  },
  
  // DataForSEO
  dataForSeo: {
    login: getOptionalEnvVar('DATAFORSEO_LOGIN'),
    password: getOptionalEnvVar('DATAFORSEO_PASSWORD'),
  },
} as const;

// Validate environment variables at build time
export function validateEnv() {
  try {
    // Validate all required env vars
    env.supabase.url;
    env.supabase.anonKey;
    env.app.url;
    serverEnv.supabase.serviceRoleKey;
    serverEnv.database.url;
    
    console.log('✅ Environment variables validated successfully');
    return true;
  } catch (error) {
    console.error('❌ Environment validation failed:', error);
    return false;
  }
}
