import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SPARA Corporation HR & Ops',
    short_name: 'SPARA HR',
    description: 'Leave, Salary Advance & Store Requests Portal',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#0f172a',
  };
}