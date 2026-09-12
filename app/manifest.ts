import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Potolok Planner',
    short_name: 'Potolok Planner',
    description: 'Планировщик и расчёт натяжных потолков',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f6f8',
    theme_color: '#17191d',
    lang: 'ru',
    orientation: 'portrait',
  };
}
