import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type AuthBackdropProps = {
  children: ReactNode;
};

export function AuthBackdrop({ children }: AuthBackdropProps) {
  return (
    <View style={styles.root}>
      <LinearGradient
        pointerEvents="none"
        colors={['#FCE9EC', '#FBF9FA', '#EAF6FC', '#FBF9FA']}
        locations={[0, 0.3, 0.76, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(251,249,250,0)', 'rgba(251,249,250,0.1)', '#FBF9FA']}
        locations={[0, 0.56, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#FBF9FA',
  },
});
