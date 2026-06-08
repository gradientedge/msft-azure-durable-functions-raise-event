import { app } from '@azure/functions';
import './functions/activities'
import './functions/entities'
import './functions/orchestrators'
import './functions/triggers'

app.setup({
  enableHttpStream: true,
});
