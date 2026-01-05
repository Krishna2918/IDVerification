export interface EnvironmentConfig {
  readonly name: string;
  readonly region: string;
  readonly account?: string;
  readonly isProd: boolean;
  readonly logRetentionDays: number;
  readonly enableDeletionProtection: boolean;
}

export const environments: Record<string, EnvironmentConfig> = {
  development: {
    name: 'development',
    region: 'ca-central-1',
    isProd: false,
    logRetentionDays: 7,
    enableDeletionProtection: false,
  },
  staging: {
    name: 'staging',
    region: 'ca-central-1',
    isProd: false,
    logRetentionDays: 14,
    enableDeletionProtection: false,
  },
  production: {
    name: 'production',
    region: 'ca-central-1',
    isProd: true,
    logRetentionDays: 90,
    enableDeletionProtection: true,
  },
};

export function getEnvironmentConfig(envName: string): EnvironmentConfig {
  const config = environments[envName];
  if (!config) {
    throw new Error(`Unknown environment: ${envName}. Valid options: ${Object.keys(environments).join(', ')}`);
  }
  return config;
}
