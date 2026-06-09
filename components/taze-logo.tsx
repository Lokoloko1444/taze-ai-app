import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  size?: number;
  framed?: boolean;
  style?: StyleProp<ViewStyle & ImageStyle>;
};

export function TazeLogo({ size = 40, framed = true, style }: Props) {
  const imageSize = framed ? size - 2 : size;

  if (!framed) {
    return (
      <Image
        source={require('../assets/images/favicon.png')}
        style={[styles.imageOnly, { width: imageSize, height: imageSize }, style]}
        resizeMode="cover"
        accessibilityLabel="Taze logo"
      />
    );
  }

  return (
    <View
      style={[
        styles.frame,
        { width: size, height: size, borderRadius: Math.max(12, size * 0.3) },
        style,
      ]}>
      <Image
        source={require('../assets/images/favicon.png')}
        style={[styles.image, { width: imageSize, height: imageSize }]}
        resizeMode="cover"
        accessibilityLabel="Taze logo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: '#050816',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 14px 28px rgba(15, 23, 42, 0.16)',
  },
  image: {
    borderRadius: 0,
  },
  imageOnly: {
    borderRadius: 0,
  },
});
