# Plugins

A plugin is a named collection of rules. Lodestar ships one official plugin and supports custom third-party plugins.

## Official Plugin

| Plugin                                                            | Focus                                                                 |
| ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| [`@retemper/lodestar-plugin-architecture`](/plugins/architecture) | Layer boundaries, module encapsulation, circular dependency detection |

## Using Plugins

Plugins are imported as **named exports** and passed directly to the `plugins` array:

```ts
import { defineConfig } from '@retemper/lodestar';
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';

export default defineConfig({
  plugins: [pluginArchitecture],
  rules: {
    'architecture/layers': {
      severity: 'error',
      options: {
        layers: [
          { name: 'domain', path: 'src/domain/**' },
          { name: 'application', path: 'src/application/**', canImport: ['domain'] },
        ],
      },
    },
    'architecture/no-circular': 'error',
  },
});
```

Only rules from registered plugins can be configured. A rule name is prefixed with its plugin's namespace (`architecture/`).

## Third-Party Plugins

Any npm package that exports a `definePlugin()` result can be used:

```ts
import { pluginMyTeam } from 'lodestar-plugin-my-team';

export default defineConfig({
  plugins: [pluginMyTeam],
});
```

See [Custom Plugins](/guide/custom-plugins) for how to create your own.
