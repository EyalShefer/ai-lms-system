/**
 * Remotion Configuration
 * Video generation settings for AI-LMS educational videos
 */

import { Config } from '@remotion/cli/config';

// Output format settings
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

// Performance settings
Config.setConcurrency(2);

// Public directory for assets (fonts, images)
Config.setPublicDir('./public');

// Webpack configuration for Hebrew font support
Config.overrideWebpackConfig((config) => {
  return {
    ...config,
    module: {
      ...config.module,
      rules: [
        ...(config.module?.rules ?? []),
        // Hebrew font support (Rubik, Heebo)
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/,
          type: 'asset/resource'
        }
      ]
    }
  };
});
