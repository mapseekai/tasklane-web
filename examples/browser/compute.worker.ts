import { browserHost, serve, output } from '@mapseekai/tasklane/host';
import type { Tasks } from './tasks.js';

serve<Tasks>(browserHost(self), {
  convert(input) {
    const result = Float32Array.from(input);
    return output(result, [result.buffer]);
  },
});
