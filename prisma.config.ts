import path from 'node:path';
import { defineConfig } from 'prisma/config';

/** Konfiguracija Prisme (zamjena za zastarjeli `package.json#prisma` blok). */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
