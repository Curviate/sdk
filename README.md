# @curviate/sdk

The official TypeScript SDK for the [Curviate API](https://docs.curviate.com) — agent-native
LinkedIn infrastructure.

> **Status:** `0.1.0` — pre-GA. The surface is public but not yet stability-promised.

## Install

```bash
npm install @curviate/sdk
```

## Quick start

```ts
import { Curviate } from "@curviate/sdk";

const curviate = new Curviate({ apiKey: process.env.CURVIATE_API_KEY! });

const accounts = await curviate.accounts.list();
```

## Links

- API reference: https://docs.curviate.com
- Issues: https://github.com/curviate/sdk/issues

## License

MIT © Redmer Holding GmbH
