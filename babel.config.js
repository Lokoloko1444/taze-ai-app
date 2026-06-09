module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['expo/internal/babel-preset'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './',
          },
          extensions: ['.tsx', '.ts', '.js', '.json'],
        },
      ],
      // Keep reanimated plugin last per docs.
      'react-native-reanimated/plugin',
    ],
  };
};
