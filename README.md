# Lokal JS

Library for interacting with Lokal Client REST API

```sh
npm i lokal-js
```

```js
import { Lokal } from 'lokal-js';

async function main() {
  const lokal = new Lokal();
  
  const tunnel = await lokal.newTunnel()
    .setLocalAddress('localhost:3000')
    .setTunnelType('HTTP')
    // .setPublicAddress('myapp.k.lokal-so.site')
    .setLANAddress('my-app.local')
    .showStartupBanner()
    .ignoreDuplicate()
    .create();

  const lanAddress = await tunnel.getLANAddress();
  console.log('LAN Address:', lanAddress);
}

main().catch(console.error);
```
