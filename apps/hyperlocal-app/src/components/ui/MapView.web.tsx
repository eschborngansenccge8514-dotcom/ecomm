import React from 'react';
import { View, Text } from 'react-native';

const MapView = ({ children, style, ...props }: any) => {
  return (
    <View style={[{ backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ color: '#9ca3af', fontSize: 12 }}>Map is not available on web</Text>
      {children}
    </View>
  );
};

export const Marker = ({ children }: any) => <View>{children}</View>;
export const Polyline = () => null;

export default MapView;
