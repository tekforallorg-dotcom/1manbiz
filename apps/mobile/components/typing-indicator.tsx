import { useEffect, useRef } from "react";
import { View, Animated, Easing } from "react-native";
import { colors as designColors } from "@1manbiz/design";

// WhatsApp-style typing bubble shown while BizBot composes an autonomous reply.
// Three dots pulse in sequence. Core Animated only, so no native rebuild is
// needed (Reanimated worklets crash in Expo Go at import time).
export function TypingIndicator() {
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;
  const d3 = useRef(new Animated.Value(0)).current;
  const dots = [d1, d2, d3];

  useEffect(() => {
    const targets = [d1, d2, d3];
    const make = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 320, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.delay(640 - delay),
        ]),
      );
    const anims = targets.map((v, i) => make(v, i * 160));
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [d1, d2, d3]);

  return (
    <View className="self-start bg-surface-muted rounded-2xl px-3.5 py-3 mb-2 flex-row items-center">
      {dots.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: designColors.textMuted,
            marginRight: i === 2 ? 0 : 5,
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
            transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
          }}
        />
      ))}
    </View>
  );
}
