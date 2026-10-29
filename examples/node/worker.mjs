import { serve, output } from '@mapseekai/tasklane/host';
import { nodeHost } from '@mapseekai/tasklane/node';

serve(nodeHost(), {
  convert(input) {
    const result = Float32Array.from(input);
    return output(result, [result.buffer]);
  },
});
