import type { BunPlugin } from 'bun';

/** SVGs referenced from web/*.html are generated or copied by site-assets.ts. */
export default {
  name: 'external-svg',
  setup(build) {
    build.onResolve({ filter: /\.svg$/ }, (args) => ({
      path: args.path,
      external: true,
    }));
  },
} satisfies BunPlugin;
