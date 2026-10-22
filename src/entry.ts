import { Layer } from 'effect'
import { Runtime } from 'foldkit'

import { Flags, flags, init } from './main'
import { managedResources } from './managedResource'
import { Message } from './message'
import { Model } from './model'
import { AuthClient, CardTraderClient, TokenStore } from './service'
import { subscriptions } from './subscription'
import { update } from './update'
import { view } from './view'

const application = Runtime.makeApplication({
  Model,
  Flags,
  init,
  update,
  view,
  subscriptions,
  managedResources,
  resources: Layer.mergeAll(
    AuthClient.layer,
    CardTraderClient.layer,
    TokenStore.layer,
  ),
  container: document.getElementById('root'),
  routing: {
    onUrlRequest: request => Message.ClickedLink({ request }),
    onUrlChange: url => Message.ChangedUrl({ url }),
  },
  devTools: {
    Message,
  },
})

Runtime.run(application, { flags })
