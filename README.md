# Lokal JS

Library for interacting with Lokal Client REST API

```js
import { Lokal } from 'lokal-js';

async function main() {
  const lokal = new Lokal();
  
  const tunnel = await lokal.newTunnel()
    .setLocalAddress('localhost:3000')
    .setTunnelType('HTTP')
    .setPublicAddress('my-app')
    .showStartupBanner()
    .create();

  const publicAddress = await tunnel.getPublicAddress();
  console.log('Public Address:', publicAddress);
}

main().catch(console.error);
```
